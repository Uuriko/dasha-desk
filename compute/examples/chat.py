#!/usr/bin/env python3
import json
import os
import urllib.request

base_url = os.getenv("DASHA_COORDINATOR_URL", "http://127.0.0.1:8787")
api_key = os.getenv("DASHA_API_KEY", "dasha-local-consumer")
payload = json.dumps({
    "model": "qwen3-8b",
    "messages": [{"role": "user", "content": "Make the timeline stranger in one sentence."}],
}).encode()
request = urllib.request.Request(
    f"{base_url}/v1/chat/completions",
    data=payload,
    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
)
with urllib.request.urlopen(request, timeout=180) as response:
    print(json.dumps(json.load(response), indent=2))
