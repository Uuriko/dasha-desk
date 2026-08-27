#!/bin/sh
set -eu

LABEL=com.getdasha.compute.provider
APP_DIR="$HOME/Library/Application Support/Dasha Compute"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
BIN_DIR="$HOME/bin"

if [ "${1:-}" = "--help" ]; then
  echo "DASHA_PROVIDER_ID=... DASHA_PROVIDER_KEY=... DASHA_MODEL_MAP=... ./install.sh"
  exit 0
fi
if [ "$(uname -s)" != Darwin ]; then
  echo "Dasha Compute's service installer currently supports macOS." >&2
  exit 1
fi
: "${DASHA_PROVIDER_ID:?Set DASHA_PROVIDER_ID from the Dasha registration page}"
: "${DASHA_PROVIDER_KEY:?Set DASHA_PROVIDER_KEY from the Dasha registration page}"
: "${DASHA_MODEL_MAP:?Set DASHA_MODEL_MAP, for example qwen3-8b=qwen3:8b}"
DASHA_COORDINATOR_URL=${DASHA_COORDINATOR_URL:-https://lobby.getdasha.com/compute/api}

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
