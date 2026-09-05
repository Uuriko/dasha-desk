import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import test from "node:test";
import {
  UNSUPPORTED_V1,
  matchUnsupportedV1,
  openaiErrorBody,
  unsupportedV1Decision,
} from "../coordinator/unsupported-v1.mjs";

const NAMES = Object.keys(UNSUPPORTED_V1);
const PREFIXES = ["/v1", "/compute/api/v1"];

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("coordinator did not start");
}

async function coordinator(context) {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["coordinator/server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), DASHA_API_KEY: "consumer-test", DASHA_PROVIDER_KEY: "provider-test", JOB_TIMEOUT_MS: "5000" },
    stdio: "ignore",
  });
  context.after(() => child.kill("SIGTERM"));
  await waitFor(`${base}/healthz`);
  return base;
}

test("matchUnsupportedV1 covers live bare and trailing-slash paths only", () => {
  for (const name of NAMES) {
    for (const prefix of PREFIXES) {
      assert.equal(matchUnsupportedV1(`${prefix}/${name}`), name);
      assert.equal(matchUnsupportedV1(`${prefix}/${name}/`), name);
    }
  }
  assert.equal(matchUnsupportedV1("/v1/chat/completions"), null);
  assert.equal(matchUnsupportedV1("/v1/embeddings/extra"), null);
  assert.equal(matchUnsupportedV1("/v1/models"), null);
  assert.equal(matchUnsupportedV1("/nope"), null);
});

test("unauthenticated GET/HEAD are OpenAI 401, never 404 not-found", () => {
  for (const name of NAMES) {
    for (const prefix of PREFIXES) {
      for (const path of [`${prefix}/${name}`, `${prefix}/${name}/`]) {
        for (const method of ["GET", "HEAD"]) {
          const decision = unsupportedV1Decision({ pathname: path, method, authenticated: false });
          assert.ok(decision, `${method} ${path} should be recognized`);
          assert.equal(decision.status, 401);
          assert.deepEqual(decision.body, openaiErrorBody("invalid API key", "authentication_error"));
          assert.equal(decision.emptyBody, method === "HEAD");
          assert.notEqual(decision.body.error, "not found");
        }
      }
    }
  }
});

test("authenticated non-POST is OpenAI 405; POST stays 400 not-supported", () => {
  for (const name of NAMES) {
    const path = `/compute/api/v1/${name}`;
    const get = unsupportedV1Decision({ pathname: path, method: "GET", authenticated: true });
    assert.equal(get.status, 405);
    assert.equal(get.body.error.message, `Only POST is supported. Use POST /v1/${name}`);
    const post = unsupportedV1Decision({ pathname: path, method: "POST", authenticated: true });
    assert.equal(post.status, 400);
    assert.equal(post.body.error.message, UNSUPPORTED_V1[name]);
    const unauthPost = unsupportedV1Decision({ pathname: path, method: "POST", authenticated: false });
    assert.equal(unauthPost.status, 401);
    assert.equal(unauthPost.body.error.message, "invalid API key");
  }
});

test("coordinator GET+HEAD bare+slash return OpenAI 401, not JSON not-found", async (context) => {
  const base = await coordinator(context);
  for (const name of NAMES) {
    for (const prefix of PREFIXES) {
      for (const slash of ["", "/"]) {
        for (const method of ["GET", "HEAD"]) {
          const url = `${base}${prefix}/${name}${slash}`;
          const response = await fetch(url, { method });
          const text = await response.text();
          assert.notEqual(response.status, 404, `${method} ${url} must not 404`);
          assert.equal(response.status, 401, `${method} ${url}`);
          if (method === "HEAD") {
            assert.equal(text, "");
          } else {
            const body = JSON.parse(text);
            assert.notDeepEqual(body, { error: "not found" });
            assert.equal(body.error.message, "invalid API key");
            assert.equal(body.error.type, "authentication_error");
          }
        }
      }
    }
  }
});

test("coordinator POST unauth stays 401; authed stays 400 not-supported", async (context) => {
  const base = await coordinator(context);
  const headers = { "Content-Type": "application/json" };
  for (const name of NAMES) {
    const url = `${base}/compute/api/v1/${name}`;
    const unauth = await fetch(url, { method: "POST", headers, body: "{}" });
    assert.equal(unauth.status, 401);
    assert.equal((await unauth.json()).error.message, "invalid API key");
    const authed = await fetch(url, {
      method: "POST",
      headers: { ...headers, Authorization: "Bearer consumer-test" },
      body: "{}",
    });
    assert.equal(authed.status, 400);
    assert.equal((await authed.json()).error.message, UNSUPPORTED_V1[name]);
    const authedGet = await fetch(url, { headers: { Authorization: "Bearer consumer-test" } });
    assert.equal(authedGet.status, 405);
    assert.equal((await authedGet.json()).error.message, `Only POST is supported. Use POST /v1/${name}`);
    const authedHead = await fetch(url, { method: "HEAD", headers: { Authorization: "Bearer consumer-test" } });
    assert.equal(authedHead.status, 405);
    assert.equal(await authedHead.text(), "");
  }
  const unknown = await fetch(`${base}/compute/api/v1/widgets`);
  assert.equal(unknown.status, 404);
  const network = await fetch(`${base}/v1/network`);
  assert.equal(network.status, 200);
  const body = await network.json();
  assert.equal(body.providers_online, 0);
});
