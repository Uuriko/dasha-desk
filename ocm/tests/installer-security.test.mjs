import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../agent/install.sh', import.meta.url), 'utf8');

test('the root installer never pipes downloaded code into a shell', () => {
  assert.doesNotMatch(source, /astral\.sh\/uv\/install\.sh/,
    'uv must be installed and reviewed independently');
  assert.doesNotMatch(source, /curl[^\n]*\|\s*(?:ba)?sh\b/,
    'network responses must never execute directly as root');
  assert.match(source, /uv is required before running this root installer/);
});

test('the executable source is derived from the authenticated gateway', () => {
  assert.match(source,
    /SOURCE=\$\(printf '%s\\n' "\$GATEWAY" \| sed 's\|\^wss:\/\/\|https:\/\/\|'\)/,
    'a separate arbitrary code-download origin must not drift from the gateway');
  assert.doesNotMatch(source, /OCM_SOURCE_URL/);
  assert.match(source, /--proto '=https' --proto-redir '=https' --tlsv1\.2/,
    'downloads and token checks must refuse plaintext redirects');
});

test('every shell-sourced provider value is constrained before agent.env is written', () => {
  for (const variable of [
    'GATEWAY',
    'SOURCE',
    'OCM_HOST_TOKEN',
    'AGENT_ID',
    'MLX_MODEL',
    'MODEL_MAP',
    'UV',
  ]) {
    assert.match(source, new RegExp(`matches "\\$${variable}"`),
      `${variable} must be allowlisted before entering a root shell or wrapper`);
  }

  const validation = source.indexOf('matches "$GATEWAY"');
  const envWrite = source.indexOf('cat > /etc/ocm/agent.env');
  assert.ok(validation > 0 && validation < envWrite,
    'validation must happen before the root environment file is written');
});

test('the downloaded agent is proved before a working installation is replaced', () => {
  const download = source.indexOf('curl_https --fail "$SOURCE/agent.py"');
  const doctor = source.indexOf('"$UV" run --quiet --python 3.12 "$TMP_AGENT" --doctor');
  const install = source.indexOf('install -m 755 "$TMP_AGENT" "$PREFIX/agent/agent.py"');
  assert.ok(download > 0 && doctor > download && install > doctor,
    'download -> doctor -> install must be the only allowed order');
  assert.match(source, /no installed files were changed/);
});

test('token rotation validates both the new credential and the stored gateway', () => {
  const rotation = source.slice(source.indexOf("cat > \"$PREFIX/bin/ocm-agent-token\""));
  assert.match(rotation, /expected an issued ocm_host_ provider token/);
  assert.match(rotation, /unsafe or missing gateway URL/);
  assert.match(rotation, /nothing was changed/);
  assert.match(rotation, /mktemp "\$\{TMPDIR:-\/tmp\}\/ocm-token\.XXXXXX"/);
});
