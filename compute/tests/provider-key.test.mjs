import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const helper = fileURLToPath(new URL("../provider/save-provider-key.py", import.meta.url));
const fixtureToken = "fixture-provider-token_123";

async function directory(context) {
  const path = await mkdtemp(join(tmpdir(), "dasha-key-prompt-"));
  context.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

function terminalPrompt(cwd, input, keyFile) {
  // Exercise real getpass/termios with a pseudoterminal. No provider is enrolled
  // and the synthetic test token never leaves this local process tree.
  const harness = `
import json, os, pty, select, subprocess, sys, time
master, slave = pty.openpty()
command = [sys.executable, sys.argv[1]]
os.umask(0)
child = subprocess.Popen(command, stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
os.close(slave)
transcript = b""
sent = False
deadline = time.monotonic() + 5
try:
    while time.monotonic() < deadline:
        if not select.select([master], [], [], 0.1)[0]:
            continue
        try:
            chunk = os.read(master, 4096)
        except OSError:
            break
        if not chunk:
            break
        transcript += chunk
        if b"(input hidden): " in transcript and not sent:
            os.write(master, sys.argv[2].encode() + b"\\n")
            sent = True
    code = child.wait(timeout=1)
    print(json.dumps({"code": code, "sent": sent, "transcript": transcript.decode(), "command": command}))
finally:
    os.close(master)
    if child.poll() is None:
        child.kill()
        child.wait()
`;
  const result = spawnSync("python3", ["-c", harness, helper, input], {
    cwd, encoding: "utf8", timeout: 10000,
    env: { ...process.env, DASHA_PROVIDER_KEY_FILE: keyFile || join(cwd, ".dasha-provider-key") },
  });
  assert.equal(result.status, 0, result.stderr || String(result.error || ""));
  return JSON.parse(result.stdout);
}

test("token prompt hides input and creates a private file even with a permissive umask", async (context) => {
  const cwd = await directory(context);
  const path = join(cwd, "custom-provider.key");
  const result = terminalPrompt(cwd, fixtureToken, path);
  assert.equal(result.code, 0);
  assert.equal(result.sent, true);
  assert.ok(!result.transcript.includes(fixtureToken), "Terminal output must not echo the token");
  assert.ok(!result.command.join(" ").includes(fixtureToken), "The prompt command has no token argument");
  assert.equal(await readFile(path, "utf8"), fixtureToken + "\n");
  assert.equal((await stat(path)).mode & 0o777, 0o600);
});

test("invalid token input removes the incomplete file without echoing its value", async (context) => {
  const cwd = await directory(context);
  const result = terminalPrompt(cwd, "a token with spaces");
  assert.equal(result.code, 1);
  assert.ok(!result.transcript.includes("a token with spaces"));
  await assert.rejects(readFile(join(cwd, ".dasha-provider-key")), { code: "ENOENT" });
});

test("an existing token file is preserved without prompting or overwriting", async (context) => {
  const cwd = await directory(context);
  const path = join(cwd, ".dasha-provider-key");
  await writeFile(path, "existing-test-token\n", { mode: 0o600 });
  const result = spawnSync("python3", [helper], {
    cwd, encoding: "utf8", timeout: 3000, detached: true,
    env: { ...process.env, DASHA_PROVIDER_KEY_FILE: path },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /already exists/);
  assert.equal(await readFile(path, "utf8"), "existing-test-token\n");
});

test("without a terminal, the prompt refuses echoed stdin and removes its empty file", async (context) => {
  const cwd = await directory(context);
  const path = join(cwd, ".dasha-provider-key");
  const result = spawnSync("python3", [helper], {
    cwd, encoding: "utf8", timeout: 3000, detached: true, input: fixtureToken + "\n",
    env: { ...process.env, DASHA_PROVIDER_KEY_FILE: path },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Hidden input requires a terminal/);
  assert.ok(!(result.stdout + result.stderr).includes(fixtureToken));
  await assert.rejects(readFile(path), { code: "ENOENT" });
});
