#!/bin/sh
# OCM provider installer for macOS (Apple Silicon).
#
# Read this before running it. It is short on purpose: piping an unread script into
# a shell is a bad habit, and the owners worth recruiting first are the ones who
# would rather look.
#
# What it does:
#   1. refuses to run on anything but Apple Silicon macOS
#   2. installs uv (isolated Python runtime manager) if missing
#   3. downloads the agent to /opt/ocm
#   4. stores your provider token root-only in /etc/ocm/agent.env
#   5. installs a launchd daemon so the agent survives reboot
#
# Usage:
#   OCM_HOST_TOKEN="ocm_host_…" sh install.sh
set -eu

GATEWAY="${OCM_GATEWAY_URL:-wss://api.ocm.getdasha.com}"
SOURCE="${OCM_SOURCE_URL:-https://api.ocm.getdasha.com}"
AGENT_ID="${OCM_AGENT_ID:-$(hostname -s)}"
PREFIX=/opt/ocm

die() { printf '\nerror: %s\n' "$1" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "this installer is for macOS"
[ "$(uname -m)" = "arm64" ] || die "Apple Silicon is required — MLX cannot run on an Intel Mac"
[ "$(id -u)" = "0" ] || die "run with sudo: the launchd daemon and /etc/ocm need root"
[ -n "${OCM_HOST_TOKEN:-}" ] || die "set OCM_HOST_TOKEN to the provider token from your console"

# Check the credential BEFORE installing anything. A token that the gateway will
# refuse used to install cleanly and then fail forever on the socket, where a 401
# is indistinguishable from the gateway being down. Fail here instead, with the
# reason, while the person is still watching the terminal.
printf 'checking your provider token …\n'
VERIFY=$(curl -fsS -H "Authorization: Bearer $OCM_HOST_TOKEN" "$SOURCE/v1/provider/verify" 2>/dev/null) || {
  REASON=$(curl -sS -H "Authorization: Bearer $OCM_HOST_TOKEN" "$SOURCE/v1/provider/verify" 2>/dev/null \
           | sed -n 's/.*"message":"\([^"]*\)".*/\1/p')
  die "${REASON:-could not reach $SOURCE to check the token}"
}
printf '  token accepted\n'

printf 'OCM provider install\n  host    %s (%s)\n  gateway %s\n\n' \
  "$AGENT_ID" "$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo mac)" "$GATEWAY"

if ! command -v uv >/dev/null 2>&1 && [ ! -x /var/root/.local/bin/uv ]; then
  printf 'installing uv …\n'
  curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null
fi
UV="$(command -v uv || echo /var/root/.local/bin/uv)"
[ -x "$UV" ] || die "uv not found after install"

mkdir -p "$PREFIX/agent" "$PREFIX/bin"
printf 'downloading agent …\n'
curl -fsSL "$SOURCE/agent.py" -o "$PREFIX/agent/agent.py" || die "could not fetch $SOURCE/agent.py"

# The token lives in a root-only file, never in the plist — plists are world-readable.
install -d -m 700 /etc/ocm
umask 077
cat > /etc/ocm/agent.env <<ENV
OCM_HOST_TOKEN=$OCM_HOST_TOKEN
OCM_GATEWAY_URL=$GATEWAY
OCM_AGENT_ID=$AGENT_ID
ENV
chmod 600 /etc/ocm/agent.env

cat > "$PREFIX/bin/ocm-agent-run" <<RUN
#!/bin/bash
export PATH=/usr/local/bin:/var/root/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin
export HOME=/var/root
set -a; . /etc/ocm/agent.env; set +a
exec "$UV" run --quiet --python 3.12 $PREFIX/agent/agent.py "$@"
RUN
chmod +x "$PREFIX/bin/ocm-agent-run"

# Rotating a token had no supported path, so people edited ocm-agent-run by hand —
# which silently breaks the daemon, because that file is regenerated on reinstall
# and is not where the token lives. This is the one command that does it correctly.
cat > "$PREFIX/bin/ocm-agent-token" <<'TOK'
#!/bin/sh
# Replace this machine's provider token and restart the agent.
#   sudo /opt/ocm/bin/ocm-agent-token 'ocm_host_...'
#
# Use this rather than editing any file by hand: the token lives in
# /etc/ocm/agent.env, and ocm-agent-run is regenerated on every reinstall.
set -eu
[ "$(id -u)" = "0" ] || { echo "run with sudo" >&2; exit 1; }
[ $# -eq 1 ] || { echo "usage: ocm-agent-token 'ocm_host_...'" >&2; exit 1; }
BASE=$(sed -n 's|^OCM_GATEWAY_URL=||p' /etc/ocm/agent.env | sed 's|^wss://|https://|; s|^ws://|http://|')
[ -n "$BASE" ] || BASE=https://api.ocm.getdasha.com
printf 'checking token ...\n'
if ! curl -fsS -H "Authorization: Bearer $1" "$BASE/v1/provider/verify" >/dev/null 2>&1; then
  curl -sS -H "Authorization: Bearer $1" "$BASE/v1/provider/verify" 2>/dev/null \
    | sed -n 's/.*"message":"\([^"]*\)".*/error: \1/p' >&2
  echo "nothing was changed" >&2
  exit 1
fi
umask 077
TMP=$(mktemp)
grep -v '^OCM_HOST_TOKEN=' /etc/ocm/agent.env > "$TMP" || true
printf 'OCM_HOST_TOKEN=%s\n' "$1" >> "$TMP"
cat "$TMP" > /etc/ocm/agent.env
rm -f "$TMP"
chmod 600 /etc/ocm/agent.env
launchctl kickstart -k system/com.ocm.agent
echo "token accepted, written, and agent restarted."
echo "watch it connect:  tail -f /var/log/ocm-agent.log"
TOK
chmod +x "$PREFIX/bin/ocm-agent-token"

printf 'checking the local chain …\n'
set -a; . /etc/ocm/agent.env; set +a
"$UV" run --quiet --python 3.12 "$PREFIX/agent/agent.py" --doctor \
  || die "doctor failed — fix the above before connecting"

cat > /Library/LaunchDaemons/com.ocm.agent.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.ocm.agent</string>
  <key>ProgramArguments</key><array><string>$PREFIX/bin/ocm-agent-run</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>/var/log/ocm-agent.log</string>
  <key>StandardErrorPath</key><string>/var/log/ocm-agent.log</string>
  <key>WorkingDirectory</key><string>$PREFIX</string>
</dict></plist>
PLIST
chmod 644 /Library/LaunchDaemons/com.ocm.agent.plist

launchctl bootout system/com.ocm.agent 2>/dev/null || true
launchctl bootstrap system /Library/LaunchDaemons/com.ocm.agent.plist

cat <<DONE

installed.

  status   launchctl print system/com.ocm.agent
  logs     tail -f /var/log/ocm-agent.log
  check    sudo $PREFIX/bin/ocm-agent-run --doctor
  rotate   sudo $PREFIX/bin/ocm-agent-token 'ocm_host_…'
  stop     sudo launchctl bootout system/com.ocm.agent
  remove   sudo launchctl bootout system/com.ocm.agent; sudo rm -rf $PREFIX /etc/ocm \\
             /Library/LaunchDaemons/com.ocm.agent.plist

Your Mac should appear in the console within a few seconds.

Note: prompts routed to this machine are visible to you in plaintext. That is true of
every provider, and is why the network claims no confidentiality it cannot enforce.
DONE
