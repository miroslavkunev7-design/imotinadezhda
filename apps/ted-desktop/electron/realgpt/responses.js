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
  'за клиенти, имоти или сделки. Ако не знаеш нещо или не можеш да го направиш оттук, кажи го направо. ' +
  'Подреждай отговора като в ChatGPT (Markdown): кратко изречение в началото, после номериран списък или таблица, ' +
  'накрая кратко резюме; линковете като [текст](https://адрес) с точния адрес, без HTML.';

// The only top-level fields this module ever sends. `tools` only on agent requests (consent "all", §9.1).
export const ALLOWED_KEYS = ['model', 'instructions', 'input', 'store', 'stream', 'reasoning', 'tools'];
// Rejected by the plan route (documented list plus the contract's additions); kept for the guard and the tests.
export const FORBIDDEN_KEYS = [
  'temperature', 'top_p', 'max_output_tokens', 'max_tool_calls', 'metadata', 'background', 'conversation',
  'moderation', 'multi_agent', 'prompt', 'prompt_cache_retention', 'safety_identifier', 'top_logprobs',
  'truncation', 'user', 'service_tier', 'previous_response_id',
  // Not documented for the plan route: never sent (the defaults are used: tool_choice auto, parallel calls allowed).
  'tool_choice', 'parallel_tool_calls', 'include',
];
// Input items an agent request may carry (CONTRACT §9.1): messages (never system), the model's own function calls
// and reasoning items echoed back, and our function results. Never item_reference.
export const INPUT_TYPES = new Set(['message', 'function_call', 'function_call_output', 'reasoning']);
// Heading under which the employee's own instructions follow MAIN's rules (they can add, never override).
export const CUSTOM_HEADING = 'Указания от служителя (допълват правилата по-горе, не ги отменят):';
export const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_MESSAGES = 200;
const MAX_IMAGES = 8; // per message
const MAX_IMAGE_BASE64 = 28 * 1024 * 1024; // all images of one request
// PDFs the agent attaches itself from the file store (input_file, CONTRACT §9.6): GPT reads them directly.
export const MAX_DOCS = 5; // per message
export const MAX_DOC_BASE64 = 24 * 1024 * 1024; // all PDFs of one request
const MAX_INSTRUCTIONS = 80_000;
const MAX_CUSTOM = 1500;

// MAIN's rules first, the employee's text (Настройки → Персонализиране, ≤ 1500 chars) appended under a heading.
export function composeInstructions(base, custom) {
  const extra = typeof custom === 'string' ? custom.trim().slice(0, MAX_CUSTOM) : '';
  return extra ? `${base}\n\n${CUSTOM_HEADING}\n${extra}` : base;
}

// messages: [{role:"user"|"assistant", text, images?:[{mime, data(base64)}], docs?:[{name, mime:"application/pdf",
// data(base64)}]}] -> Responses input items (docs only from MAIN's agent, never from the renderer).
// History is resent in full on every request (store:false, no previous_response_id). Never a system item.
export function buildInput(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) {
    throw new RgError('invalid', 'messages');
  }
  const input = [];
  let imageChars = 0;
  let docChars = 0;
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
    const docs = m.docs ?? [];
    if (!Array.isArray(docs) || docs.length > MAX_DOCS) throw new RgError('invalid', 'docs');
    for (const d of docs) {
      const ok = d && d.mime === 'application/pdf' && typeof d.data === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(d.data) &&
        typeof d.name === 'string' && d.name.length > 0 && d.name.length <= 180;
      if (!ok) throw new RgError('invalid', 'docs');
      docChars += d.data.length;
      content.push({ type: 'input_file', filename: d.name, file_data: `data:application/pdf;base64,${d.data}` });
    }
    if (!content.length) throw new RgError('invalid', 'messages');
    input.push({ type: 'message', role: 'user', content });
  }
  if (imageChars > MAX_IMAGE_BASE64) throw new RgError('invalid', 'images');
  if (docChars > MAX_DOC_BASE64) throw new RgError('invalid', 'docs');
  if (input.at(-1)?.role !== 'user') throw new RgError('invalid', 'messages');
  return input;
}

function inputItemOk(item) {
  if (!item || typeof item !== 'object') return false;
  const type = item.type ?? 'message';
  if (!INPUT_TYPES.has(type)) return false;
  if (type === 'message') return item.role === 'user' || item.role === 'assistant';
  if (item.role !== undefined) return false;
  if (type === 'function_call') return typeof item.call_id === 'string' && typeof item.name === 'string';
  if (type === 'function_call_output') return typeof item.call_id === 'string' && typeof item.output === 'string';
  return true; // reasoning
}

function toolOk(tool) {
  if (!tool || typeof tool !== 'object') return false;
  if (tool.type === 'function') return typeof tool.name === 'string' && !!tool.parameters;
  if (tool.type === 'namespace') {
    return typeof tool.name === 'string' && Array.isArray(tool.tools) && tool.tools.length > 0 &&
      tool.tools.every((t) => t && t.type === 'function' && typeof t.name === 'string') &&
      Object.keys(tool).every((k) => ['type', 'name', 'description', 'tools'].includes(k));
  }
  return false;
}

// Last line of defence before the network: only allowlisted keys, no system role, store:false + stream:true.
export function assertRequest(body) {
  const bad = Object.keys(body).filter((k) => !ALLOWED_KEYS.includes(k) || FORBIDDEN_KEYS.includes(k));
  if (bad.length) throw new Error(`Real GPT request has fields that are not allowed: ${bad.join(', ')}`);
  if (body.store !== false || body.stream !== true) throw new Error('Real GPT request must set store:false, stream:true');
  if (!Array.isArray(body.input) || !body.input.every(inputItemOk)) {
    throw new Error('Real GPT input may contain only user and assistant messages, function calls and their results');
  }
  if ('tools' in body && (!Array.isArray(body.tools) || !body.tools.length || !body.tools.every(toolOk))) {
    throw new Error('Real GPT tools are not allowed in this form (namespace or function tools only)');
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
    instructions: composeInstructions(DEFAULT_INSTRUCTIONS, instructions),
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
// -> {kind:"completed"|"failed"|"incomplete"|"interrupted", text, items, response?, error?, reason?}
// `items` are the finished output items in stream order (response.output_item.done), kept for responses whose
// terminal event carries no `output`.
export async function consumeStream(body, { signal, onDelta, onActivity } = {}) {
  let text = '';
  let outcome = null;
  const items = [];
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
    } else if (type === 'response.output_item.done') {
      if (ev.item && typeof ev.item === 'object') items.push(ev.item);
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
  return { ...(outcome ?? { kind: 'interrupted' }), text, items };
}

// Output items of a completed response: response.output when present, else the streamed items.
export function outputItems(outcome) {
  const out = outcome?.response?.output;
  return Array.isArray(out) && out.length ? out : Array.isArray(outcome?.items) ? outcome.items : [];
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
