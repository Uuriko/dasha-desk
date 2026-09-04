#!/usr/bin/env bash
# OCM AWS preflight — read-only. Creates nothing, costs nothing.
#
#   confirms you are pointed at the OCM account and NOT at [default]/[botmed]
#   reports the mac2 Dedicated Host quota (the long pole, usually 0 on a new account)
#   reports any Dedicated Host still ALLOCATED and therefore still billing
#
# Usage:  ./scripts/aws-preflight.sh
set -uo pipefail

PROFILE="${AWS_PROFILE:-ocm}"
# Deployment identifiers live in .deploy.env (gitignored) so no account id, bucket
# name or instance id is baked into a file that will be published.
_here="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$_here/.deploy.env" ] && . "$_here/.deploy.env"
REGION="${AWS_REGION:-${OCM_REGION:-us-west-2}}"
aws_() { aws --profile "$PROFILE" --region "$REGION" "$@"; }

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32mok\033[0m    %s\n' "$*"; }
warn() { printf '  \033[33mwarn\033[0m  %s\n' "$*"; }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; }

say "Identity  (profile=$PROFILE region=$REGION)"
if [ "$PROFILE" = "default" ] || [ "${PROFILE#botmed}" != "$PROFILE" ]; then
  bad "profile '$PROFILE' is not the OCM account — run 'direnv allow' in ocm/"
  exit 1
fi
if ! ident=$(aws_ sts get-caller-identity --output json 2>&1); then
  bad "no valid credentials for profile '$PROFILE'"
  printf '        %s\n' "$ident"
  printf '        fix: aws sso login --profile %s   (see docs/AWS-ACCOUNT.md §1)\n' "$PROFILE"
  exit 1
fi
acct=$(printf '%s' "$ident" | python3 -c 'import json,sys;print(json.load(sys.stdin)["Account"])')
arn=$(printf '%s' "$ident"  | python3 -c 'import json,sys;print(json.load(sys.stdin)["Arn"])')
ok "account $acct"
ok "$arn"
# Guard against pointing at the wrong account. The expected id comes from
# .deploy.env rather than being hard-coded into a publishable file.
if [ -n "${OCM_ACCOUNT_ID:-}" ] && [ "$acct" != "$OCM_ACCOUNT_ID" ]; then
  bad "account $acct is not the expected OCM account — stop and fix the profile"
  exit 1
fi

say "Root access keys"
if aws_ iam get-account-summary --output json 2>/dev/null \
   | grep -q '"AccountAccessKeysPresent": 0'; then
  ok "no root access keys"
else
  warn "root access keys may exist — delete them (docs/AWS-ACCOUNT.md §1.1)"
fi

say "Root MFA"
if aws_ iam get-account-summary --query 'SummaryMap.AccountMFAEnabled' --output text 2>/dev/null | grep -q '^1$'; then
  ok "root MFA enabled"
else
  bad "root MFA NOT enabled"
fi

say "Organization"
org=$(aws_ organizations describe-organization --query 'Organization.[Id,MasterAccountId]' --output text 2>/dev/null)
if [ -n "$org" ]; then
  set -- $org
  if [ "$2" = "$acct" ]; then
    warn "this IS the management account of $1 — workloads belong in a member account"
  else
    ok "member account of $1"
  fi
else
  ok "not in an Organization"
fi

say "Mac Dedicated Host quota"
# Only the family this project actually uses is treated as blocking. Every other
# Mac family sitting at 0 is the desired state: it caps accidental allocation.
TARGET_FAMILY="${OCM_MAC_FAMILY:-mac2-m2}"
quotas=$(aws_ service-quotas list-service-quotas --service-code ec2 \
  --query "Quotas[?contains(QuotaName,'mac')].[QuotaName,Value]" --output text 2>/dev/null)
if [ -z "$quotas" ]; then
  warn "could not read quotas (needs servicequotas:ListServiceQuotas)"
else
  target_line=$(printf '%s\n' "$quotas" | grep -E "Dedicated ${TARGET_FAMILY} Hosts")
  target_value=$(printf '%s' "$target_line" | awk '{print $NF}')
  case "${target_value:-0}" in
    0.0|0) warn "$TARGET_FAMILY = 0 — request an increase; no Mac host can be allocated" ;;
    *)     ok   "$TARGET_FAMILY = $target_value  (a host can be allocated: \$21.07 per 24h minimum)" ;;
  esac
  others=$(printf '%s\n' "$quotas" | grep -vE "Dedicated ${TARGET_FAMILY} Hosts" | awk '$NF!="0.0"')
  if [ -n "$others" ]; then
    printf '%s\n' "$others" | while IFS=$'\t' read -r name value; do
      warn "$name = $value — unused family above 0; consider lowering it"
    done
  else
    ok "all other Mac families capped at 0"
  fi
fi

say "mac2-m2.metal availability in $REGION"
azs=$(aws_ ec2 describe-instance-type-offerings --location-type availability-zone \
  --filters Name=instance-type,Values=mac2-m2.metal \
  --query "InstanceTypeOfferings[].Location" --output text 2>/dev/null)
[ -n "$azs" ] && ok "offered in: $azs" || warn "mac2-m2.metal not offered in $REGION — pick another region"

say "Dedicated Hosts currently allocated  (\$\$\$)"
hosts=$(aws_ ec2 describe-hosts \
  --query "Hosts[?State!='released'].[HostId,HostProperties.InstanceFamily,State,AllocationTime]" \
  --output text 2>/dev/null)
if [ -z "$hosts" ]; then
  ok "none allocated — not paying for a Mac"
else
  bad "hosts still allocated and BILLING:"
  printf '%s\n' "$hosts" | sed 's/^/        /'
  printf '        release when the 24h minimum has elapsed:\n'
  printf '        aws --profile %s ec2 release-hosts --host-ids <id>\n' "$PROFILE"
fi

say "Cost guardrails"
b=$(aws --profile "$PROFILE" --region us-east-1 budgets describe-budgets \
      --account-id "$acct" --query 'length(Budgets)' --output text 2>/dev/null)
case "$b" in ''|0|None) warn "no AWS Budget configured (docs/AWS-ACCOUNT.md §2.5)" ;;
             *) ok "$b budget(s) configured" ;; esac

m=$(aws_ ce get-anomaly-monitors --query 'length(AnomalyMonitors)' --output text 2>/dev/null)
case "$m" in ''|0|None) warn "no cost anomaly monitor" ;; *) ok "$m anomaly monitor(s)" ;; esac

say "Month-to-date spend"
start=$(date -u +%Y-%m-01); end=$(date -u -v+1d +%Y-%m-%d 2>/dev/null || date -u -d '+1 day' +%Y-%m-%d)
aws --profile "$PROFILE" --region us-east-1 ce get-cost-and-usage \
  --time-period Start="$start",End="$end" --granularity MONTHLY --metrics UnblendedCost \
  --query 'ResultsByTime[0].Total.UnblendedCost.[Amount,Unit]' --output text 2>/dev/null \
  | awk 'NF{printf "  %.2f %s\n",$1,$2}' || warn "Cost Explorer not enabled yet"

printf '\n'
