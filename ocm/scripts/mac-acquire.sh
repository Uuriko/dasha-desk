#!/usr/bin/env bash
# Acquire a 24 GiB Mac Dedicated Host in us-west-2.
#
# There is no AWS API for free Dedicated Host capacity, so an allocation attempt is
# the only probe. A FAILED attempt is free; a SUCCESSFUL one starts a 24-hour,
# non-refundable $21.07 (mac2-m2) or $29.52 (mac-m4) commitment and this script exits.
#
# Only the two us-west-2 types with exactly 24 GiB are tried, cheapest first.
#
#   ./scripts/mac-acquire.sh [max_minutes] [interval_seconds]
set -uo pipefail

export AWS_PROFILE="${AWS_PROFILE:-ocm}"
export AWS_REGION=us-west-2
MAX_MIN="${1:-720}"
INTERVAL="${2:-300}"
LOG="${OCM_ACQUIRE_LOG:-/tmp/ocm-mac-acquire.log}"
DEADLINE=$(( $(date +%s) + MAX_MIN * 60 ))
ROUND=0

log() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*" | tee -a "$LOG"; }

log "start: seeking 24 GiB Mac in us-west-2 (mac2-m2 then mac-m4), every ${INTERVAL}s for ${MAX_MIN}m"

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  ROUND=$((ROUND+1))
  SUMMARY=""
  for TYPE in mac2-m2.metal mac-m4.metal; do
    for AZ in us-west-2a us-west-2b us-west-2c; do
      OUT=$(aws ec2 allocate-hosts --instance-type "$TYPE" --availability-zone "$AZ" \
            --quantity 1 --auto-placement on \
            --tag-specifications "ResourceType=dedicated-host,Tags=[{Key=Project,Value=ocm},{Key=AcquiredBy,Value=mac-acquire}]" \
            --query "HostIds[0]" --output text 2>&1)
      case "$OUT" in
        h-*)
          log "ACQUIRED $OUT  type=$TYPE az=$AZ"
          log "billing has started: 24h minimum, release with: aws ec2 release-hosts --host-ids $OUT"
          printf '%s' "$OUT" > /tmp/ocm-host-id.txt
          exit 0
          ;;
        *)
          REASON=$(printf '%s' "$OUT" | grep -oE 'InsufficientHostCapacity|HostLimitExceeded|UnauthorizedOperation|[A-Za-z]+Exception' | head -1)
          SUMMARY="$SUMMARY ${TYPE%%.*}/${AZ##*-}:${REASON:-err}"
          ;;
      esac
    done
  done
  log "round $ROUND —$SUMMARY"
  [ "$(date +%s)" -ge "$DEADLINE" ] && break
  sleep "$INTERVAL"
done

log "gave up after ${MAX_MIN}m — no 24 GiB Mac capacity in us-west-2 during that window"
exit 1
