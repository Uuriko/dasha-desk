#!/bin/sh
set -eu

LABEL=com.getdasha.compute.provider
APP_DIR="$HOME/Library/Application Support/Dasha Compute"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
BIN_DIR="$HOME/bin"
KEY_FILE=${DASHA_PROVIDER_KEY_FILE:-./.dasha-provider-key}
KEY_FILE_TO_DELETE=

if [ "${1:-}" = "--help" ]; then
  cat <<'EOF'
Save the one-time provider token with hidden input, then run install.sh
without putting the token in a shell command or here-document:

  python3 provider/save-provider-key.py
  DASHA_PROVIDER_ID=... DASHA_MODEL_MAP=... ./install.sh

install.sh reads .dasha-provider-key (or DASHA_PROVIDER_KEY_FILE), stores
the token in macOS Keychain, and deletes the file. launchd never receives
the token on ProgramArguments. The prompt refuses an existing file or
a terminal that cannot hide input. The one-time Keychain write still
passes the token to security -w.

Required: DASHA_PROVIDER_ID, DASHA_MODEL_MAP
Optional: DASHA_COORDINATOR_URL (default https://lobby.getdasha.com/compute/api)
Optional: DASHA_PROVIDER_KEY_FILE (default ./.dasha-provider-key)
EOF
  exit 0
fi
if [ "$(uname -s)" != Darwin ]; then
  echo "Dasha Compute's service installer currently supports macOS." >&2
  exit 1
fi
: "${DASHA_PROVIDER_ID:?Set DASHA_PROVIDER_ID from the Dasha registration page}"
: "${DASHA_MODEL_MAP:?Set DASHA_MODEL_MAP, for example qwen3-8b=qwen3:8b}"
DASHA_COORDINATOR_URL=${DASHA_COORDINATOR_URL:-https://lobby.getdasha.com/compute/api}

if [ -f "$KEY_FILE" ]; then
  chmod 600 "$KEY_FILE"
  DASHA_PROVIDER_KEY=$(tr -d '\r\n' < "$KEY_FILE")
  KEY_FILE_TO_DELETE=$KEY_FILE
elif [ -z "${DASHA_PROVIDER_KEY:-}" ]; then
  echo "Write the one-time provider token to $KEY_FILE (mode 0600), then rerun ./install.sh." >&2
  echo "Do not put DASHA_PROVIDER_KEY on the command line." >&2
  exit 1
fi

case "$DASHA_PROVIDER_ID" in (*[!A-Za-z0-9_-]*|'') echo "Invalid provider ID." >&2; exit 1;; esac
case "$DASHA_PROVIDER_KEY" in (*[!A-Za-z0-9_-]*|'') echo "Invalid provider key." >&2; exit 1;; esac
case "$DASHA_MODEL_MAP" in (*[!A-Za-z0-9_.:,=-]*|'') echo "Invalid model map." >&2; exit 1;; esac
case "$DASHA_COORDINATOR_URL" in (https://*|http://127.0.0.1:*|http://localhost:*) ;; (*) echo "Coordinator must use HTTPS or local HTTP." >&2; exit 1;; esac
case "$DASHA_COORDINATOR_URL" in (*[!A-Za-z0-9._~:/?=%-]*) echo "Coordinator URL contains unsupported characters." >&2; exit 1;; esac

PYTHON=$(command -v python3) || { echo "Python 3 is required." >&2; exit 1; }
command -v security >/dev/null || { echo "macOS Keychain is unavailable." >&2; exit 1; }
command -v launchctl >/dev/null || { echo "launchctl is unavailable." >&2; exit 1; }

DASHA_COORDINATOR_URL=$DASHA_COORDINATOR_URL DASHA_PROVIDER_ID=$DASHA_PROVIDER_ID DASHA_PROVIDER_KEY=$DASHA_PROVIDER_KEY DASHA_MODEL_MAP=$DASHA_MODEL_MAP "$PYTHON" provider/agent.py --doctor

mkdir -p "$APP_DIR" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/Dasha Compute" "$BIN_DIR"
install -m 755 provider/agent.py "$APP_DIR/agent.py"
install -m 755 provider/run-provider "$APP_DIR/run-provider"
install -m 755 provider/dasha-compute "$BIN_DIR/dasha-compute"
umask 077
{
  printf "DASHA_COORDINATOR_URL='%s'\n" "$DASHA_COORDINATOR_URL"
  printf "DASHA_PROVIDER_ID='%s'\n" "$DASHA_PROVIDER_ID"
  printf "DASHA_MODEL_MAP='%s'\n" "$DASHA_MODEL_MAP"
  printf "DASHA_PYTHON='%s'\n" "$PYTHON"
  printf "DASHA_BENCHMARK_PATH='%s'\n" "$APP_DIR/benchmark.json"
} > "$APP_DIR/provider.env"
security add-generic-password -U -a "$DASHA_PROVIDER_ID" -s "$LABEL" -w "$DASHA_PROVIDER_KEY" >/dev/null
if [ -n "$KEY_FILE_TO_DELETE" ] && [ -f "$KEY_FILE_TO_DELETE" ]; then
  rm -f "$KEY_FILE_TO_DELETE"
fi
DASHA_MODEL_MAP=$DASHA_MODEL_MAP DASHA_BENCHMARK_PATH="$APP_DIR/benchmark.json" "$PYTHON" "$APP_DIR/agent.py" --benchmark

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$APP_DIR/run-provider</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/Dasha Compute/provider.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/Dasha Compute/provider-error.log</string>
</dict></plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"
echo "Dasha Compute installed and running."
echo "Manage it with: $BIN_DIR/dasha-compute status|doctor|benchmark|logs|restart|uninstall"
