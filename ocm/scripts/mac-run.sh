#!/usr/bin/env bash
# Run a shell command on the OCM Mac host via SSM. No inbound ports, no SSH key.
#
#   ./scripts/mac-run.sh 'sysctl -n hw.model'
#   ./scripts/mac-run.sh -f script.sh          # send a whole script
#
# Parameters go via a JSON file: the CLI's shorthand --parameters parser mangles
# newlines, which silently corrupts any multi-line script.
set -uo pipefail
export AWS_PROFILE="${AWS_PROFILE:-ocm}" AWS_REGION="${AWS_REGION:-us-west-2}"
_here="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$_here/.deploy.env" ] && . "$_here/.deploy.env"
IID="${OCM_MAC_INSTANCE:-$(cat /tmp/ocm-instance-id.txt 2>/dev/null)}"
[ -n "$IID" ] || { echo "no instance id (set OCM_MAC_INSTANCE)"; exit 2; }

if [ "${1:-}" = "-f" ]; then CMD=$(cat "$2"); else CMD="$*"; fi

PJ=$(mktemp /tmp/ocm-ssm-params.XXXXXX.json)
printf '%s' "$CMD" | python3 -c '
import json,sys
print(json.dumps({"commands":[sys.stdin.read()],"executionTimeout":["3600"]}))
' > "$PJ"

CID=$(aws ssm send-command --instance-ids "$IID" \
  --document-name AWS-RunShellScript \
  --parameters "file://$PJ" \
  --timeout-seconds 3600 --query "Command.CommandId" --output text) || { rm -f "$PJ"; exit 1; }
rm -f "$PJ"

for _ in $(seq 1 360); do
  ST=$(aws ssm get-command-invocation --command-id "$CID" --instance-id "$IID" \
       --query "Status" --output text 2>/dev/null)
  case "$ST" in Success|Failed|Cancelled|TimedOut) break;; esac
  sleep 5
done
aws ssm get-command-invocation --command-id "$CID" --instance-id "$IID" \
  --query "StandardOutputContent" --output text
ERR=$(aws ssm get-command-invocation --command-id "$CID" --instance-id "$IID" --query "StandardErrorContent" --output text 2>/dev/null)
[ -n "$ERR" ] && [ "$ERR" != "None" ] && printf '\n--- stderr ---\n%s\n' "$ERR"
[ "$ST" = "Success" ] || { echo "[status: $ST]"; exit 1; }
exit 0
