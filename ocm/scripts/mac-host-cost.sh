#!/usr/bin/env bash
# On-demand Dedicated Host prices for EC2 Mac, from the AWS Pricing API. Read-only.
#
# Mac instances bill on the HOST reservation, not the instance hour — the instance
# hour is $0.00. So this queries productFamily "Dedicated Host"; filtering on
# instanceType alone returns the misleading $0.00 line.
#
# The Pricing API is only served from us-east-1, regardless of the region priced.
#
#   ./scripts/mac-host-cost.sh ["US West (Oregon)"]
set -uo pipefail

LOC="${1:-US West (Oregon)}"
PROFILE="${AWS_PROFILE:-ocm}"

printf '\nEC2 Mac Dedicated Host — on-demand, %s\n\n' "$LOC"

aws --profile "$PROFILE" --region us-east-1 pricing get-products \
  --service-code AmazonEC2 --max-results 100 --output json \
  --filters "Type=TERM_MATCH,Field=productFamily,Value=Dedicated Host" \
            "Type=TERM_MATCH,Field=location,Value=$LOC" \
| python3 -c '
import json,sys
d=json.load(sys.stdin); rows=set()
for raw in d.get("PriceList",[]):
    p=json.loads(raw) if isinstance(raw,str) else raw
    a=p["product"]["attributes"]
    it=a.get("instanceType") or a.get("instanceFamily") or "?"
    if "mac" not in it.lower(): continue
    for t in p["terms"].get("OnDemand",{}).values():
        for dim in t["priceDimensions"].values():
            u=float(dim["pricePerUnit"]["USD"])
            if u: rows.add((u,it))
if not rows:
    print("  no Mac host prices returned for this location"); sys.exit()
print("  family              per hour    per 24h min    per 30 days")
print("  " + "-"*54)
for u,it in sorted(rows):
    print(f"  {it:14} {u:>9.4f}  {u*24:>12.2f} {u*24*30:>13,.0f}")
'

cat <<'NOTE'

  Dedicated Hosts for Mac have a 24-hour MINIMUM allocation period.
  Stopping or terminating the INSTANCE does not stop the bill — only
  `aws ec2 release-hosts` does, and not before 24h have elapsed.
  The per-24h column is therefore the real minimum purchase price.
NOTE
