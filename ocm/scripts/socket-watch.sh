#!/usr/bin/env bash
# Measure host-socket stability — one of §05's two decisive numbers.
#
# Polls the public /v1/network and records each host's uptime_s. uptime_s going
# BACKWARDS means the socket dropped and the agent re-registered, which is the
# event we actually care about. Read-only; costs nothing.
#
#   ./scripts/socket-watch.sh [minutes] [interval_seconds]
#
# Two hard-won guards:
#   - A lockfile, because several overlapping instances poll the same endpoint and
#     produce a log nobody can interpret.
#   - It re-execs from a snapshot of itself. Bash reads a script lazily by byte
#     offset, so editing this file while it runs makes the live instance resume at
#     the wrong offset and die on garbage. The snapshot makes edits harmless.
set -uo pipefail

if [ -z "${OCM_WATCH_SNAPSHOT:-}" ]; then
  # Resolve the real project directory BEFORE re-exec: afterwards $0 is the snapshot
  # in a temp dir and .deploy.env would no longer be findable from it.
  _home="$(cd "$(dirname "$0")/.." && pwd)"
  _snap=$(mktemp -t ocm-socket-watch); cp "$0" "$_snap"; chmod +x "$_snap"
  OCM_WATCH_SNAPSHOT="$_snap" OCM_WATCH_HOME="$_home" exec "$_snap" "$@"
fi
trap 'rm -f "$OCM_WATCH_SNAPSHOT" "$LOCK" 2>/dev/null' EXIT

LOCK=/tmp/ocm-socket-watch.lock
if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
  echo "another socket-watch is already running (pid $(cat "$LOCK")) — refusing to start a second"
  exit 3
fi
echo $$ > "$LOCK"

_here="${OCM_WATCH_HOME:-$(cd "$(dirname "$0")/.." 2>/dev/null && pwd)}"
[ -f "$_here/.deploy.env" ] && . "$_here/.deploy.env"
API="${OCM_API:?set OCM_API in ocm/.deploy.env}"
MINUTES="${1:-240}"; INTERVAL="${2:-60}"
# One log per run: a shared path means concurrent runs overwrite each other's data.
LOG="${OCM_SOCKET_LOG:-/tmp/ocm-socket-watch-$(date -u +%Y%m%dT%H%M%SZ).log}"
ln -sf "$LOG" /tmp/ocm-socket-watch-latest.log 2>/dev/null
PREV=-1; DROPS=0; SAMPLES=0; MISSING=0
DEADLINE=$(( $(date +%s) + MINUTES * 60 ))
PREV=-1; DROPS=0; SAMPLES=0; MISSING=0

echo "$(date -u +%H:%M:%SZ) socket-watch start: ${MINUTES}m at ${INTERVAL}s" | tee "$LOG"
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  U=$(curl -s --max-time 20 "$API/v1/network" 2>/dev/null \
      | python3 -c 'import json,sys
try:
  h=json.load(sys.stdin)["hosts"]
  print(h[0]["uptime_s"] if h else -1)
except Exception: print(-2)' 2>/dev/null || echo -2)
  SAMPLES=$((SAMPLES+1))
  T=$(date -u +%H:%M:%SZ)
  if [ "$U" -lt 0 ] 2>/dev/null; then
    MISSING=$((MISSING+1)); echo "$T  NO HOST (u=$U)" | tee -a "$LOG"
  elif [ "$PREV" -ge 0 ] && [ "$U" -lt "$PREV" ]; then
    DROPS=$((DROPS+1)); echo "$T  RECONNECT — uptime fell $PREV -> $U" | tee -a "$LOG"
  fi
  PREV=$U
  sleep "$INTERVAL"
done
echo "$(date -u +%H:%M:%SZ) done: ${SAMPLES} samples, ${DROPS} reconnect(s), ${MISSING} no-host, final uptime ${PREV}s" | tee -a "$LOG"
