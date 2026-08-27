#!/usr/bin/env node
import http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";

const port = Number(process.env.PORT || 8787);
const consumerKey = process.env.DASHA_API_KEY || "dasha-local-consumer";
const providerKey = process.env.DASHA_PROVIDER_KEY || "dasha-local-provider";
const corsOrigin = process.env.DASHA_CORS_ORIGIN || "";
const jobTimeoutMs = Math.max(5_000, Number(process.env.JOB_TIMEOUT_MS || 120_000));
const maxBodyBytes = 256 * 1024;
const providerFreshnessMs = 30_000;
const models = [
  { id: "qwen3-8b", object: "model", owned_by: "community", size_gb: 5.2, min_memory_gb: 8, status: "alpha" },
  { id: "gemma3-12b", object: "model", owned_by: "community", size_gb: 8.1, min_memory_gb: 16, status: "alpha" },
  { id: "gpt-oss-20b", object: "model", owned_by: "community", size_gb: 14, min_memory_gb: 16, status: "alpha" },
  { id: "qwen3-30b-a3b", object: "model", owned_by: "community", size_gb: 19, min_memory_gb: 24, status: "alpha" },
  { id: "gemma3-27b", object: "model", owned_by: "community", size_gb: 17, min_memory_gb: 24, status: "alpha" },
  { id: "gpt-oss-120b", object: "model", owned_by: "community", size_gb: 65, min_memory_gb: 96, status: "alpha" },
];
const jobs = new Map();
const providers = new Map();
let jobsCompleted = 0;
let tokensCompleted = 0;

function baseHeaders(extra = {}) {
  return { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", ...(corsOrigin ? { "Access-Control-Allow-Origin": corsOrigin, Vary: "Origin" } : {}), ...extra };
}
function send(response, status, payload, headers = {}) {
  if (response.headersSent) return;
  response.writeHead(status, baseHeaders(headers));
  response.end(JSON.stringify(payload));
}
function bearer(request) {
  const value = request.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}
function secretMatches(actual, expected) {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw Object.assign(new Error("request body too large"), { status: 413 });
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error("invalid JSON"), { status: 400 }); }
}
function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return false;
  return value.every((item) => item && ["system", "user", "assistant", "tool"].includes(item.role) && typeof item.content === "string" && item.content.length <= 64_000);
}
function publicJob(job) {
  return { id: job.id, model: job.model, messages: job.messages, temperature: job.temperature, max_tokens: job.maxTokens, stream: job.stream };
}
function cleanupLeases() {
  const now = Date.now();
  for (const job of jobs.values()) {
    if (job.status === "leased" && job.leaseExpiresAt < now) {
      job.status = "queued";
      job.providerId = null;
    }
  }
}
function sse(response, payload) {
  if (!response.destroyed && !response.writableEnded) response.write(`data: ${typeof payload === "string" ? payload : JSON.stringify(payload)}\n\n`);
}
function streamChunk(job, delta, finishReason = null, usage) {
  sse(job.response, { id: `chatcmpl_${job.id.slice(4)}`, object: "chat.completion.chunk", created: job.created, model: job.model, choices: [{ index: 0, delta, finish_reason: finishReason }], ...(usage ? { usage } : {}) });
}
function finishJob(job, result) {
  if (job.settled) return;
  job.settled = true;
  clearTimeout(job.timer);
  if (!result.error) {
    jobsCompleted += 1;
    tokensCompleted += Number(result.usage?.total_tokens || 0);
  }
  job.settle(result);
}

async function handleChat(request, response) {
  if (!secretMatches(bearer(request), consumerKey)) return send(response, 401, { error: { message: "invalid API key", type: "authentication_error" } });
  const body = await readJson(request);
  if (!models.some((model) => model.id === body.model)) return send(response, 400, { error: { message: "unknown model", type: "invalid_request_error" } });
  if (!validateMessages(body.messages)) return send(response, 400, { error: { message: "messages must be a non-empty OpenAI-style array", type: "invalid_request_error" } });

  const id = `job_${randomUUID().replaceAll("-", "")}`;
  let settle;
  const resultPromise = new Promise((resolve) => { settle = resolve; });
  const job = {
    id, model: body.model, messages: body.messages,
    temperature: Number.isFinite(body.temperature) ? Math.max(0, Math.min(2, body.temperature)) : 0.7,
    maxTokens: Number.isFinite(body.max_tokens) ? Math.max(1, Math.min(8192, body.max_tokens)) : 1024,
    stream: body.stream === true, status: "queued", created: Math.floor(Date.now() / 1000),
    providerId: null, leaseExpiresAt: 0, response: body.stream === true ? response : null,
    settle, settled: false, timer: null,
  };
  jobs.set(id, job);
  if (job.stream) {
    response.writeHead(200, baseHeaders({ "Content-Type": "text/event-stream; charset=utf-8", Connection: "keep-alive", "X-Accel-Buffering": "no", "X-Dasha-Privacy": "tls-relay-alpha" }));
    streamChunk(job, { role: "assistant", content: "" });
    response.on("close", () => { if (!job.settled) finishJob(job, { error: "consumer disconnected", disconnected: true }); });
  }
  job.timer = setTimeout(() => finishJob(job, { timeout: true }), jobTimeoutMs);
  const result = await resultPromise;
  jobs.delete(id);

  if (job.stream) {
    if (result.timeout) {
      sse(response, { error: { message: "no provider completed the request before timeout", type: "provider_unavailable" } });
      sse(response, "[DONE]");
      response.end();
    } else if (result.error && !result.disconnected) {
      sse(response, { error: { message: result.error, type: "provider_error" } });
      sse(response, "[DONE]");
      response.end();
    }
    return;
  }
  if (result.timeout) return send(response, 503, { error: { message: "no provider completed the request before timeout", type: "provider_unavailable" } }, { "Retry-After": "5" });
  if (result.error) return send(response, 502, { error: { message: result.error, type: "provider_error" } });
  return send(response, 200, {
    id: `chatcmpl_${id.slice(4)}`, object: "chat.completion", created: job.created, model: body.model,
    choices: [{ index: 0, message: { role: "assistant", content: String(result.content || "") }, finish_reason: result.finish_reason || "stop" }],
    usage: result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  }, { "X-Dasha-Provider": String(result.providerId || "community"), "X-Dasha-Privacy": "tls-relay-alpha" });
}

async function handleProviderPoll(request, response) {
  if (!secretMatches(bearer(request), providerKey)) return send(response, 401, { error: "invalid provider key" });
  const body = await readJson(request);
  const id = String(body.provider_id || "").trim().slice(0, 96);
  if (!id) return send(response, 400, { error: "provider_id is required" });
  const supported = Array.isArray(body.models) ? body.models.filter((item) => typeof item === "string") : [];
  providers.set(id, { id, name: String(body.name || id).slice(0, 96), models: supported, hardware: body.hardware || {}, lastSeenAt: Date.now() });
  cleanupLeases();
  const job = [...jobs.values()].find((candidate) => candidate.status === "queued" && supported.includes(candidate.model));
  if (!job) { response.writeHead(204, { "Cache-Control": "no-store" }); return response.end(); }
  job.status = "leased";
  job.providerId = id;
  job.leaseExpiresAt = Date.now() + 90_000;
  return send(response, 200, { job: publicJob(job), lease_seconds: 90 });
}
function authorizedJob(response, request, body, jobId) {
  if (!secretMatches(bearer(request), providerKey)) { send(response, 401, { error: "invalid provider key" }); return null; }
  const job = jobs.get(jobId);
  if (!job || job.status !== "leased") { send(response, 404, { error: "job is unavailable or lease expired" }); return null; }
  if (String(body.provider_id || "") !== job.providerId) { send(response, 409, { error: "job belongs to another provider" }); return null; }
  return job;
}
async function handleProviderResult(request, response, jobId) {
  const body = await readJson(request);
  const job = authorizedJob(response, request, body, jobId);
  if (!job) return;
  if (job.stream) return send(response, 409, { error: "stream jobs must use the chunk endpoint" });
  job.status = body.error ? "failed" : "complete";
  finishJob(job, { providerId: job.providerId, content: body.content, finish_reason: body.finish_reason, usage: body.usage, error: body.error });
  return send(response, 202, { accepted: true });
}
async function handleProviderChunk(request, response, jobId) {
  const body = await readJson(request);
  const job = authorizedJob(response, request, body, jobId);
  if (!job) return;
  if (!job.stream) return send(response, 409, { error: "non-stream jobs must use the result endpoint" });
  if (body.error) {
    job.status = "failed";
    finishJob(job, { providerId: job.providerId, error: String(body.error) });
    return send(response, 202, { accepted: true });
  }
  if (typeof body.delta === "string" && body.delta) streamChunk(job, { content: body.delta });
  if (body.done === true) {
    job.status = "complete";
    streamChunk(job, {}, body.finish_reason || "stop", body.usage);
    sse(job.response, "[DONE]");
    job.response.end();
    finishJob(job, { providerId: job.providerId, usage: body.usage });
  }
  return send(response, 202, { accepted: true });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (request.method === "OPTIONS") {
      response.writeHead(204, { ...(corsOrigin ? { "Access-Control-Allow-Origin": corsOrigin } : {}), "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" });
      return response.end();
    }
    if (request.method === "GET" && url.pathname === "/healthz") return send(response, 200, { ok: true, service: "dasha-compute", version: "0.3.0" });
    if (request.method === "GET" && url.pathname === "/v1/models") return send(response, 200, { object: "list", data: models });
    if (request.method === "GET" && url.pathname === "/v1/network") {
      const now = Date.now();
      const online = [...providers.values()].filter((provider) => now - provider.lastSeenAt < providerFreshnessMs);
      return send(response, 200, { version: "0.3.0", providers_online: online.length, models_available: [...new Set(online.flatMap((provider) => provider.models))], jobs_queued: [...jobs.values()].filter((job) => job.status === "queued").length, jobs_completed: jobsCompleted, tokens_completed: tokensCompleted, streaming: true });
    }
    if (request.method === "POST" && url.pathname === "/v1/chat/completions") return await handleChat(request, response);
    if (request.method === "POST" && url.pathname === "/v1/providers/poll") return await handleProviderPoll(request, response);
    const resultMatch = request.method === "POST" && url.pathname.match(/^\/v1\/providers\/jobs\/([^/]+)\/result$/);
    if (resultMatch) return await handleProviderResult(request, response, resultMatch[1]);
    const chunkMatch = request.method === "POST" && url.pathname.match(/^\/v1\/providers\/jobs\/([^/]+)\/chunk$/);
    if (chunkMatch) return await handleProviderChunk(request, response, chunkMatch[1]);
    return send(response, 404, { error: { message: "route not implemented", type: "not_found" } });
  } catch (error) {
    return send(response, Number(error.status || 500), { error: { message: error.status ? error.message : "internal error", type: error.status ? "invalid_request_error" : "server_error" } });
  }
});
server.listen(port, "127.0.0.1", () => process.stdout.write(`dasha-compute coordinator listening on http://127.0.0.1:${port}\n`));
function shutdown() { server.close(() => process.exit(0)); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
