// SPDX-License-Identifier: MIT
// Responses API on the user's ChatGPT plan: request builder with a strict key allowlist, SSE parser and the
// mapping of a finished stream to an RgResult. Success means `response.completed` was received, nothing less.

import { RgError, apiFailure, fail, serverError } from './errors.js';
import { parseJson, textChunks } from './wire.js';

export const RESPONSES_URL = 'https://api.openai.com/v1/responses';

// Used when the caller passes no instructions. In this mode the model has no tools, so it must not pretend otherwise.
export const DEFAULT_INSTRUCTIONS =
  'Ти си Тед – AI асистент на агенция за недвижими имоти „Имоти Надежда“. Отговаряй на български, кратко, ясно ' +
  'и по същество. В този режим работиш през ChatGPT плана на служителя и нямаш достъп до CRM системата, ' +
  'календара, документите и имейла на агенцията. Не твърди, че си извършил действие в тях, и не измисляй данни ' +
  'за клиенти, имоти или сделки. Ако не знаеш нещо или не можеш да го направиш оттук, кажи го направо.';

// The only top-level fields this module ever sends.
export const ALLOWED_KEYS = ['model', 'instructions', 'input', 'store', 'stream', 'reasoning'];
// Rejected by the plan route (documented list plus the contract's additions); kept for the guard and the tests.
export const FORBIDDEN_KEYS = [
  'temperature', 'top_p', 'max_output_tokens', 'max_tool_calls', 'metadata', 'background', 'conversation',
  'moderation', 'multi_agent', 'prompt', 'prompt_cache_retention', 'safety_identifier', 'top_logprobs',
  'truncation', 'user', 'service_tier', 'previous_response_id',
];
export const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_MESSAGES = 200;
const MAX_IMAGES = 8; // per message
const MAX_IMAGE_BASE64 = 28 * 1024 * 1024; // all images of one request
const MAX_INSTRUCTIONS = 20_000;

// messages: [{role:"user"|"assistant", text, images?:[{mime, data(base64)}]}] -> Responses input items.
// History is resent in full on every request (store:false, no previous_response_id). Never a system item.
export function buildInput(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) {
    throw new RgError('invalid', 'messages');
  }
  const input = [];
  let imageChars = 0;
  for (const m of messages) {
    const text = m?.text ?? '';
    if (!m || typeof m !== 'object' || typeof text !== 'string') throw new RgError('invalid', 'messages');
    if (m.role === 'assistant') {
      // An empty assistant turn (for example a failed answer) carries nothing to resend.
      if (text.trim()) input.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] });
      continue;
    }
    if (m.role !== 'user') throw new RgError('invalid', 'role');
    const images = m.images ?? [];
    if (!Array.isArray(images) || images.length > MAX_IMAGES) throw new RgError('invalid', 'images');
    const content = text.trim() ? [{ type: 'input_text', text }] : [];
    for (const img of images) {
      const ok =
        img && IMAGE_MIMES.has(img.mime) && typeof img.data === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(img.data);
      if (!ok) throw new RgError('invalid', 'images');
      imageChars += img.data.length;
      content.push({ type: 'input_image', image_url: `data:${img.mime};base64,${img.data}` });
    }
    if (!content.length) throw new RgError('invalid', 'messages');
    input.push({ type: 'message', role: 'user', content });
  }
  if (imageChars > MAX_IMAGE_BASE64) throw new RgError('invalid', 'images');
  if (input.at(-1)?.role !== 'user') throw new RgError('invalid', 'messages');
  return input;
}

// Last line of defence before the network: only allowlisted keys, no system role, store:false + stream:true.
export function assertRequest(body) {
  const bad = Object.keys(body).filter((k) => !ALLOWED_KEYS.includes(k) || FORBIDDEN_KEYS.includes(k));
  if (bad.length) throw new Error(`Real GPT request has fields that are not allowed: ${bad.join(', ')}`);
  if (body.store !== false || body.stream !== true) throw new Error('Real GPT request must set store:false, stream:true');
  if (!Array.isArray(body.input) || body.input.some((item) => item.role !== 'user' && item.role !== 'assistant')) {
    throw new Error('Real GPT input may contain only user and assistant messages');
  }
  if (body.reasoning && Object.keys(body.reasoning).join() !== 'effort') {
    throw new Error('Real GPT reasoning may contain only effort');
  }
  return body;
}

// -> request body. `reasoning.effort` is present only when the caller passes `effort`. Throws RgError("invalid").
export function buildRequest({ messages, model, effort, instructions } = {}) {
  if (typeof model !== 'string' || !/^[\w.:-]{1,100}$/.test(model)) throw new RgError('invalid', 'model');
  if (instructions != null && (typeof instructions !== 'string' || instructions.length > MAX_INSTRUCTIONS)) {
    throw new RgError('invalid', 'instructions');
  }
  if (effort != null && !EFFORTS.includes(effort)) throw new RgError('invalid', 'effort');
  const body = {
    model,
    instructions: instructions?.trim() || DEFAULT_INSTRUCTIONS,
    input: buildInput(messages),
    store: false,
    stream: true,
  };
  if (effort != null) body.reasoning = { effort };
  return assertRequest(body);
}

// Corrected body for the single retry after the route rejected reasoning.effort.
export function withoutReasoning(body) {
  const { reasoning: _dropped, ...rest } = body;
  return assertRequest(rest);
}

// True when a 400 body is subscription_sharing_unsupported_capability naming the reasoning parameter.
export function rejectsEffort(errorBody) {
  const { code, param } = serverError(errorBody);
  return code === 'subscription_sharing_unsupported_capability' && typeof param === 'string' && param.startsWith('reasoning');
}

// Incremental Server-Sent Events parser. Accepts text split at any position (also between CR and LF).
export function createSseParser(onEvent) {
  let buffer = '';
  let event = '';
  let data = [];

  function line(text) {
    if (text === '') {
      if (data.length) onEvent({ event, data: data.join('\n') });
      event = '';
      data = [];
      return;
    }
    if (text[0] === ':') return; // comment / keep-alive
    const colon = text.indexOf(':');
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? '' : text.slice(colon + 1);
    if (value[0] === ' ') value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }

  return {
    push(chunk) {
      buffer += chunk;
      // A trailing CR may be the first half of a CRLF that continues in the next chunk.
      const heldCr = buffer.endsWith('\r');
      const lines = (heldCr ? buffer.slice(0, -1) : buffer).split(/\r\n|\n|\r/);
      buffer = lines.pop() + (heldCr ? '\r' : '');
      for (const l of lines) line(l);
    },
    // Stream end: a last event without its blank line is still delivered (truncated JSON is ignored by the caller).
    end() {
      const rest = buffer.replace(/\r$/, '');
      buffer = '';
      if (rest) line(rest);
      line('');
    },
  };
}

// Text of a final response object (used when no deltas were seen).
export function outputText(response) {
  const parts = [];
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const c of item.content) {
      if (c?.type === 'output_text' && typeof c.text === 'string') parts.push(c.text);
      else if (c?.type === 'refusal' && typeof c.refusal === 'string') parts.push(c.refusal);
    }
  }
  return parts.join('');
}

// Reads the SSE body through its terminal event.
// -> {kind:"completed"|"failed"|"incomplete"|"interrupted", text, response?, error?, reason?}
export async function consumeStream(body, { signal, onDelta, onActivity } = {}) {
  let text = '';
  let outcome = null;
  const parser = createSseParser(({ event, data }) => {
    if (outcome) return;
    const ev = parseJson(data);
    if (!ev || typeof ev !== 'object') return;
    const type = typeof ev.type === 'string' ? ev.type : event;
    if (type === 'response.output_text.delta' || type === 'response.refusal.delta') {
      if (typeof ev.delta === 'string' && ev.delta) {
        text += ev.delta;
        onDelta?.(ev.delta, text);
      }
    } else if (type === 'response.completed') {
      outcome = { kind: 'completed', response: ev.response };
    } else if (type === 'response.failed') {
      outcome = { kind: 'failed', error: ev.response?.error ?? null };
    } else if (type === 'response.incomplete') {
      outcome = { kind: 'incomplete', response: ev.response, reason: ev.response?.incomplete_details?.reason ?? null };
    } else if (type === 'error') {
      outcome = { kind: 'failed', error: ev.error ?? { code: ev.code, param: ev.param } };
    }
  });
  try {
    for await (const chunk of textChunks(body, signal)) {
      onActivity?.();
      parser.push(chunk);
      if (outcome) break;
    }
    if (!outcome) parser.end();
  } catch {
    // The transport broke mid-stream; without a terminal event this is an interruption.
  }
  return { ...(outcome ?? { kind: 'interrupted' }), text };
}

// Stream outcome -> RgResult. No retry and no other model is tried here.
export function resultOf(outcome, requestedModel) {
  const partial = outcome.text ? { text: outcome.text } : undefined;
  const model = typeof outcome.response?.model === 'string' ? outcome.response.model : requestedModel;
  if (outcome.kind === 'completed') {
    const text = outcome.text || outputText(outcome.response);
    return text ? { ok: true, text, model } : fail('empty');
  }
  if (outcome.kind === 'incomplete') {
    return outcome.text ? { ok: true, text: outcome.text, model, incomplete: true } : fail('incomplete', outcome.reason);
  }
  if (outcome.kind === 'failed') return apiFailure(0, { error: outcome.error }, partial, 'failed');
  return fail('stream_interrupted', null, partial);
}
