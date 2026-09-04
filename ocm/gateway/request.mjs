/**
 * Deliberately small OpenAI chat-completions request subset.
 *
 * OCM currently routes text chat to simple MLX/Ollama adapters. Silently accepting
 * tools, multimodal content or sampling controls and then ignoring them would be
 * less compatible than returning a precise 400. This module also establishes the
 * maximum completion budget the gateway reserves before dispatch.
 */
import { normalizeModelId } from './provider.mjs';

export const MAX_OUTPUT_TOKENS = 512;
const MAX_MESSAGES = 128;
const MAX_MESSAGE_CHARS = 256 * 1024;
const ALLOWED_ROLES = new Set(['system', 'developer', 'user', 'assistant', 'tool']);
const UNSUPPORTED = [
  'audio',
  'function_call',
  'functions',
  'logit_bias',
  'logprobs',
  'modalities',
  'n',
  'parallel_tool_calls',
  'prediction',
  'presence_penalty',
  'reasoning_effort',
  'response_format',
  'seed',
  'service_tier',
  'stop',
  'store',
  'stream_options',
  'temperature',
  'tool_choice',
  'tools',
  'top_logprobs',
  'top_p',
  'user',
  'verbosity',
  'web_search_options',
];

function requestedMaxTokens(body) {
  const oldValue = body.max_tokens;
  const newValue = body.max_completion_tokens;
  if (oldValue !== undefined && newValue !== undefined && oldValue !== newValue) {
    throw new TypeError('max_tokens and max_completion_tokens conflict');
  }
  const value = newValue ?? oldValue ?? MAX_OUTPUT_TOKENS;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_OUTPUT_TOKENS) {
    throw new TypeError(`max completion tokens must be an integer from 1 to ${MAX_OUTPUT_TOKENS}`);
  }
  return value;
}

export function normalizeChatRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TypeError('body must be a JSON object');
  }
  const unsupported = UNSUPPORTED.filter((key) => body[key] !== undefined);
  if (unsupported.length) {
    throw new TypeError(`unsupported parameter(s): ${unsupported.join(', ')}`);
  }

  const model = normalizeModelId(body.model, 'model');
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > MAX_MESSAGES) {
    throw new TypeError(`messages must contain 1-${MAX_MESSAGES} text messages`);
  }

  const messages = body.messages.map((message, index) => {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new TypeError(`messages[${index}] must be an object`);
    }
    if (typeof message.role !== 'string' || !ALLOWED_ROLES.has(message.role)) {
      throw new TypeError(`messages[${index}].role is not supported`);
    }
    if (typeof message.content !== 'string') {
      throw new TypeError(`messages[${index}].content must be text`);
    }
    if (message.content.length > MAX_MESSAGE_CHARS) {
      throw new TypeError(`messages[${index}].content is too long`);
    }
    if (message.name !== undefined
        && (typeof message.name !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(message.name))) {
      throw new TypeError(`messages[${index}].name is invalid`);
    }
    // Drop unknown message properties instead of forwarding caller-supplied objects
    // that the runtime adapters do not implement.
    return {
      role: message.role,
      content: message.content,
      ...(message.name ? { name: message.name } : {}),
    };
  });

  if (body.stream !== undefined && typeof body.stream !== 'boolean') {
    throw new TypeError('stream must be a boolean');
  }

  return {
    model,
    messages,
    stream: body.stream === true,
    maxTokens: requestedMaxTokens(body),
  };
}
