#!/usr/bin/env bash
# Measure host-socket stability — one of §05's two decisive numbers.
#
# Polls the public /v1/network and records each host's uptime_s. uptime_s going
# BACKWARDS means the socket dropped and the agent re-registered, which is the
# event we actually care about. Read-only; costs nothing.
#
#   ./scripts/socket-watch.sh [minutes] [interval_seconds]
set -uo pipefail
MINUTES="${1:-240}"; INTERVAL="${2:-60}"
LOG="${OCM_SOCKET_LOG:-/tmp/ocm-socket-watch.log}"
_here="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$_here/.deploy.env" ] && . "$_here/.deploy.env"
API="${OCM_API:?set OCM_API in ocm/.deploy.env}"
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
