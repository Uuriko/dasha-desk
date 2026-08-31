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

test('the installer resets PATH before using privileged commands', () => {
  const setPath = source.indexOf('PATH=/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin:/var/root/.local/bin');
  const gateway = source.indexOf('GATEWAY=');
  assert.ok(setPath > 0 && setPath < gateway,
    'a caller-controlled PATH must not choose curl, sed, grep, install, sudo or launchctl');
  assert.match(source.slice(setPath, gateway), /export PATH/);
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
    'RUN_USER',
    'RUN_HOME',
    'UV',
  ]) {
    assert.match(source, new RegExp(`matches "\\$${variable}"`),
      `${variable} must be allowlisted before entering a privileged shell or wrapper`);
  }

  const validation = source.indexOf('matches "$GATEWAY"');
  const envWrite = source.indexOf('cat > /etc/ocm/agent.env');
  assert.ok(validation > 0 && validation < envWrite,
    'validation must happen before the provider environment file is written');
});

test('the inference daemon is explicitly forbidden from running as root', () => {
  assert.match(source, /RUN_USER="\$\{OCM_RUN_USER:-\$\{SUDO_USER:-\}\}"/);
  assert.match(source, /\[ "\$RUN_USER" != root \] \|\| die/,
    'root must be rejected as the provider runtime user');
  assert.match(source, /id "\$RUN_USER" >\/dev\/null/,
    'the selected provider account must exist locally');
  assert.match(source, /sudo -u "\$RUN_USER" env[\s\S]*"\$TMP_AGENT" --doctor/,
    'the downloaded code must be proved as the same unprivileged account that will run it');
  assert.match(source, /<key>UserName<\/key><string>\$RUN_USER<\/string>/,
    'launchd must drop privileges before executing the agent');
  assert.doesNotMatch(source, /export HOME=\/var\/root/,
    'the runtime wrapper must not inherit root as its home');
});

test('provider secrets and logs are owned only by the unprivileged runtime account', () => {
  const envWrite = source.indexOf('cat > /etc/ocm/agent.env');
  const launchd = source.indexOf('cat > /Library/LaunchDaemons/com.ocm.agent.plist');
  const section = source.slice(envWrite, launchd);
  assert.match(section, /chown "\$RUN_USER" \/etc\/ocm\/agent\.env/);
  assert.match(section, /chmod 600 \/etc\/ocm\/agent\.env/);
  assert.match(section, /touch \/var\/log\/ocm-agent\.log/);
  assert.match(section, /chown "\$RUN_USER" \/var\/log\/ocm-agent\.log/);
  assert.match(section, /chmod 600 \/var\/log\/ocm-agent\.log/);
});

test('the downloaded agent is proved before a working installation is replaced', () => {
  const download = source.indexOf('curl_https --fail "$SOURCE/agent.py"');
  const doctor = source.indexOf('"$UV" run --quiet --python 3.12 "$TMP_AGENT" --doctor');
  const install = source.indexOf('install -m 755 "$TMP_AGENT" "$PREFIX/agent/agent.py"');
  assert.ok(download > 0 && doctor > download && install > doctor,
    'download -> unprivileged doctor -> install must be the only allowed order');
  assert.match(source, /no installed files were changed/);
});

test('token rotation validates credential, gateway and runtime owner', () => {
  const rotation = source.slice(source.indexOf("cat > \"$PREFIX/bin/ocm-agent-token\""));
  assert.match(rotation, /expected an issued ocm_host_ provider token/);
  assert.match(rotation, /unsafe or missing gateway URL/);
  assert.match(rotation, /could not identify the provider account/);
  assert.match(rotation, /provider environment may not be owned by root/);
  assert.match(rotation, /nothing was changed/);
  assert.match(rotation, /chown "\$OWNER" \/etc\/ocm\/agent\.env/);
  assert.match(rotation, /mktemp "\$\{TMPDIR:-\/tmp\}\/ocm-token\.XXXXXX"/);
});
