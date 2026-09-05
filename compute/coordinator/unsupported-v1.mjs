/** Auth-first OpenAI table for known-but-unsupported /v1 paths.
 *
 * Matches live dasha-lobby `dasha-compute-network.mjs`: embeddings, completions,
 * and responses are recognized routes. They must not fall through to JSON 404
 * `{"error":"not found"}`. Chat/completions already uses this auth-first style.
 *
 * POST does not invent those products — authed callers get 400 not-supported.
 */
export const UNSUPPORTED_V1 = Object.freeze({
  embeddings: "embeddings are not supported; use POST /v1/chat/completions",
  completions: "legacy completions are not supported; use POST /v1/chat/completions",
  responses: "responses are not supported; use POST /v1/chat/completions",
});

export function openaiErrorBody(message, type = "invalid_request_error") {
  return { error: { message, type, code: null } };
}

export function matchUnsupportedV1(pathname) {
  const normalized = String(pathname || "").replace(/\/+$/, "") || "/";
  for (const name of Object.keys(UNSUPPORTED_V1)) {
    if (normalized === `/v1/${name}` || normalized === `/compute/api/v1/${name}`) return name;
  }
  return null;
}

export function unsupportedV1Decision({ pathname, method, authenticated }) {
  const name = matchUnsupportedV1(pathname);
  if (!name) return null;
  const verb = String(method || "GET").toUpperCase();
  if (verb === "OPTIONS") return null;
  if (verb !== "POST") {
    if (!authenticated) {
      return {
        status: 401,
        body: openaiErrorBody("invalid API key", "authentication_error"),
        emptyBody: verb === "HEAD",
      };
    }
    return {
      status: 405,
      body: openaiErrorBody(`Only POST is supported. Use POST /v1/${name}`, "invalid_request_error"),
      emptyBody: verb === "HEAD",
    };
  }
  if (!authenticated) {
    return { status: 401, body: openaiErrorBody("invalid API key", "authentication_error"), emptyBody: false };
  }
  return { status: 400, body: openaiErrorBody(UNSUPPORTED_V1[name], "invalid_request_error"), emptyBody: false };
}
