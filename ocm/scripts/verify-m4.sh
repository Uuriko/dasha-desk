#!/usr/bin/env bash
set -euo pipefail

# Reproduce the final Apple Silicon proof from the exact reviewed commit.
#
# Required (already exported, or via a secret file). Do not put provider or
# developer credentials on the command line: they land in shell history and
# the process list.
#   export OCM_GATEWAY_URL
#   export OPENAI_BASE_URL
#   read -rsp "Provider token: " OCM_HOST_TOKEN; printf '\n'; export OCM_HOST_TOKEN
#   read -rsp "Developer key: " OPENAI_API_KEY; printf '\n'; export OPENAI_API_KEY
# Automation:
#   export OCM_HOST_TOKEN_FILE=/path/to/token
#   export OPENAI_API_KEY_FILE=/path/to/developer-key
#
# Optional:
#   OCM_VERIFY_MODEL=ocm-coder
#   OCM_BENCH_TOKENS=32
#   OCM_MLX_MODEL=mlx-community/Qwen2.5-Coder-7B-Instruct-4bit
#
# The script never prints either credential. It performs no deployment, payment,
# grant, key issuance or provider registration beyond the normal agent doctor check.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OCM="$ROOT/ocm"
MODEL="${OCM_VERIFY_MODEL:-ocm-coder}"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

need_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || fail "$name is required"
}

read_secret_file() {
  local dest="$1" path="$2"
  [[ "$path" == /* ]] || fail "${dest}_FILE must be an absolute path"
  [[ -f "$path" && -r "$path" ]] || fail "${dest}_FILE is missing or unreadable"
  IFS= read -r "$dest" < "$path" || true
}

if [[ -z "${OCM_HOST_TOKEN:-}" && -n "${OCM_HOST_TOKEN_FILE:-}" ]]; then
  read_secret_file OCM_HOST_TOKEN "$OCM_HOST_TOKEN_FILE"
  export OCM_HOST_TOKEN
fi
if [[ -z "${OPENAI_API_KEY:-}" && -n "${OPENAI_API_KEY_FILE:-}" ]]; then
  read_secret_file OPENAI_API_KEY "$OPENAI_API_KEY_FILE"
  export OPENAI_API_KEY
fi

[[ "$(uname -s)" == "Darwin" ]] || fail "this verification must run on macOS"
[[ "$(uname -m)" == "arm64" ]] || fail "Apple Silicon arm64 is required"
command -v uv >/dev/null 2>&1 || fail "uv is required"
command -v git >/dev/null 2>&1 || fail "git is required"

need_env OCM_GATEWAY_URL
need_env OCM_HOST_TOKEN
need_env OPENAI_BASE_URL
need_env OPENAI_API_KEY

case "$OCM_GATEWAY_URL" in
  *\?token=*|*\&token=*) fail "OCM_GATEWAY_URL must not contain a credential query parameter" ;;
esac

case "$OPENAI_BASE_URL" in
  https://*/v1|http://127.0.0.1:*/v1|http://localhost:*/v1) ;;
  *) fail "OPENAI_BASE_URL must be HTTPS, except for explicit localhost verification" ;;
esac

cd "$ROOT"
COMMIT="$(git rev-parse HEAD)"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] \
  || fail "tracked files are dirty; verify an exact commit"

printf 'OCM M4 verification\n'
printf 'commit: %s\n' "$COMMIT"
printf 'utc: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'machine: %s / %s\n' "$(sysctl -n machdep.cpu.brand_string 2>/dev/null || true)" "$(uname -m)"
printf 'model: %s\n' "$MODEL"
printf '\n[1/5] Python syntax\n'
python3 -m py_compile "$OCM/agent/agent.py"

printf '\n[2/5] Repository OCM tests\n'
(
  cd "$OCM"
  node --test tests/*.test.mjs
)

printf '\n[3/5] Provider token and local runtime doctor\n'
OCM_RUNTIME=mlx uv run "$OCM/agent/agent.py" --doctor

printf '\n[4/5] Local MLX benchmark\n'
OCM_RUNTIME=mlx \
OCM_BENCH_MODEL="$MODEL" \
OCM_BENCH_TOKENS="${OCM_BENCH_TOKENS:-32}" \
uv run "$OCM/agent/agent.py" --benchmark

printf '\n[5/5] Unmodified OpenAI Python SDK request through the gateway\n'
OCM_VERIFY_MODEL="$MODEL" uv run --with 'openai>=1,<3' python3 - <<'PY'
import hashlib
import json
import os
import time
from openai import OpenAI

model = os.environ["OCM_VERIFY_MODEL"]
client = OpenAI(
    base_url=os.environ["OPENAI_BASE_URL"],
    api_key=os.environ["OPENAI_API_KEY"],
    timeout=180.0,
    max_retries=0,
)
started = time.perf_counter()
response = client.chat.completions.create(
    model=model,
    messages=[{"role": "user", "content": "Reply with exactly: ocm-ok"}],
    max_tokens=16,
    temperature=0,
)
elapsed_ms = round((time.perf_counter() - started) * 1000)
text = (response.choices[0].message.content or "").strip()
if not text:
    raise SystemExit("SDK request returned an empty completion")

# Print enough evidence to reproduce the run without publishing a user prompt,
# credential or potentially sensitive completion.
print(json.dumps({
    "ok": True,
    "model": response.model or model,
    "elapsed_ms": elapsed_ms,
    "completion_sha256": hashlib.sha256(text.encode()).hexdigest(),
    "usage": {
        "prompt_tokens": getattr(response.usage, "prompt_tokens", None),
        "completion_tokens": getattr(response.usage, "completion_tokens", None),
        "total_tokens": getattr(response.usage, "total_tokens", None),
    },
}, sort_keys=True))
PY

printf '\nPASS: final M4 verification completed without printing credentials.\n'
