// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { RgError, fail, mapApiError, messageFor, toFailure } from '../../electron/realgpt/errors.js';
import {
  ALLOWED_KEYS, CUSTOM_HEADING, DEFAULT_INSTRUCTIONS, FORBIDDEN_KEYS, RESPONSES_URL, assertRequest, buildInput, buildRequest,
  consumeStream, createSseParser, outputText, rejectsEffort, resultOf, withoutReasoning,
} from '../../electron/realgpt/responses.js';

const enc = new TextEncoder();
const sse = (obj) => `event: ${obj.type}\ndata: ${JSON.stringify(obj)}\n\n`;
const delta = (text) => sse({ type: 'response.output_text.delta', delta: text });
const completed = (extra = {}) => sse({ type: 'response.completed', response: { model: 'srv-model', status: 'completed', ...extra } });

// Web ReadableStream of byte chunks, one per read; `failWith` makes it error after the last chunk was read.
function streamOf(chunks, { failWith } = {}) {
  const queue = [...chunks];
  return new ReadableStream({
    pull(c) {
      if (queue.length) {
        const chunk = queue.shift();
        c.enqueue(typeof chunk === 'string' ? enc.encode(chunk) : chunk);
      } else if (failWith) c.error(failWith);
      else c.close();
    },
  });
}

const hello = [{ role: 'user', text: 'Здравей' }];

describe('request builder', () => {
  it('builds the documented body: instructions, input array, store:false, stream:true', () => {
    const body = buildRequest({ messages: hello, model: 'gpt-x' });
    expect(RESPONSES_URL).toBe('https://api.openai.com/v1/responses');
    expect(body).toEqual({
      model: 'gpt-x',
      instructions: DEFAULT_INSTRUCTIONS,
      input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Здравей' }] }],
      store: false,
      stream: true,
    });
  });

  it('never contains a key outside the allowlist or any forbidden field', () => {
    const variants = [
      { messages: hello, model: 'm' },
      { messages: hello, model: 'm', effort: 'high', instructions: 'Кратко.' },
      // Extra arguments (even forbidden API fields) are not copied into the request.
      {
        messages: hello, model: 'm', requestId: 'r1', temperature: 0.2, top_p: 1, max_output_tokens: 10, user: 'u',
        metadata: {}, previous_response_id: 'resp_1', service_tier: 'priority', truncation: 'auto', tools: [],
      },
    ];
    for (const args of variants) {
      const body = buildRequest(args);
      for (const key of Object.keys(body)) expect(ALLOWED_KEYS).toContain(key);
      for (const key of FORBIDDEN_KEYS) expect(body).not.toHaveProperty(key);
      expect(JSON.stringify(body)).not.toMatch(/"role":"(system|developer)"/);
      expect(body.store).toBe(false);
      expect(body.stream).toBe(true);
    }
    // CONTRACT §9.1: `tools` is allowed (agent requests only); tool_choice/parallel_tool_calls/include never.
    expect(ALLOWED_KEYS).toEqual(['model', 'instructions', 'input', 'store', 'stream', 'reasoning', 'tools']);
    for (const key of ['tool_choice', 'parallel_tool_calls', 'include']) expect(FORBIDDEN_KEYS).toContain(key);
    for (const key of [
      'temperature', 'top_p', 'max_output_tokens', 'max_tool_calls', 'metadata', 'background', 'conversation',
      'moderation', 'prompt', 'prompt_cache_retention', 'safety_identifier', 'top_logprobs', 'truncation', 'user',
      'service_tier', 'previous_response_id', 'multi_agent',
    ]) expect(FORBIDDEN_KEYS).toContain(key);
    expect(ALLOWED_KEYS.filter((k) => FORBIDDEN_KEYS.includes(k))).toEqual([]);
  });

  it('the guard itself rejects forbidden fields, system items and wrong store/stream', () => {
    const good = buildRequest({ messages: hello, model: 'm' });
    for (const key of FORBIDDEN_KEYS) expect(() => assertRequest({ ...good, [key]: 1 })).toThrow(/not allowed/);
    expect(() => assertRequest({ ...good, tools: [] })).toThrow(/not allowed/);
    expect(() => assertRequest({ ...good, store: true })).toThrow();
    expect(() => assertRequest({ ...good, stream: false })).toThrow();
    expect(() => assertRequest({ ...good, input: [{ type: 'message', role: 'system', content: [] }] })).toThrow();
    expect(() => assertRequest({ ...good, reasoning: { effort: 'low', summary: 'auto' } })).toThrow();
  });

  it('refuses a system or unknown role instead of sending it', () => {
    for (const role of ['system', 'developer', 'tool', undefined]) {
      expect(() => buildRequest({ messages: [{ role, text: 'x' }, ...hello], model: 'm' })).toThrow(RgError);
    }
  });

  it('maps history: user input_text + input_image data URLs, assistant output_text', () => {
    const input = buildInput([
      { role: 'user', text: 'Какво е това?', images: [{ mime: 'image/png', data: 'iVBORw0KGgo=' }] },
      { role: 'assistant', text: 'Снимка на сграда.' },
      { role: 'assistant', text: '   ' }, // an empty failed turn is not resent
      { role: 'user', text: '', images: [{ mime: 'image/jpeg', data: 'AAAA' }] },
    ]);
    expect(input).toEqual([
      {
        type: 'message', role: 'user',
        content: [{ type: 'input_text', text: 'Какво е това?' }, { type: 'input_image', image_url: 'data:image/png;base64,iVBORw0KGgo=' }],
      },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Снимка на сграда.' }] },
      { type: 'message', role: 'user', content: [{ type: 'input_image', image_url: 'data:image/jpeg;base64,AAAA' }] },
    ]);
  });

  it('validates messages, images, model, effort and instructions', () => {
    const bad = [
      { messages: [], model: 'm' },
      { messages: 'hi', model: 'm' },
      { messages: [{ role: 'user', text: 5 }], model: 'm' },
      { messages: [{ role: 'user', text: '' }], model: 'm' },
      { messages: [...hello, { role: 'assistant', text: 'край' }], model: 'm' }, // must end with the user's turn
      { messages: [{ role: 'user', text: 'x', images: [{ mime: 'application/pdf', data: 'AAAA' }] }], model: 'm' },
      { messages: [{ role: 'user', text: 'x', images: [{ mime: 'image/png', data: 'not base64!' }] }], model: 'm' },
      { messages: [{ role: 'user', text: 'x', images: 'AAAA' }], model: 'm' },
      { messages: hello },
      { messages: hello, model: 'bad model' },
      { messages: hello, model: 'm', effort: 'extreme' },
      { messages: hello, model: 'm', instructions: 42 },
    ];
    for (const args of bad) {
      const err = (() => { try { buildRequest(args); return null; } catch (e) { return e; } })();
      expect(err).toBeInstanceOf(RgError);
      expect(err.code).toBe('invalid');
    }
  });

  // CONTRACT §8.2 (CHANGES §2): the employee's text is appended under a heading after the rules, never instead of them.
  it('appends the caller instructions after the Bulgarian default, never replacing it', () => {
    expect(buildRequest({ messages: hello, model: 'm', instructions: '  Отговаряй с една дума.  ' }).instructions)
      .toBe(`${DEFAULT_INSTRUCTIONS}\n\n${CUSTOM_HEADING}\nОтговаряй с една дума.`);
    expect(buildRequest({ messages: hello, model: 'm', instructions: '   ' }).instructions).toBe(DEFAULT_INSTRUCTIONS);
    expect(DEFAULT_INSTRUCTIONS).toMatch(/Тед/);
    expect(DEFAULT_INSTRUCTIONS).toMatch(/български/);
    expect(DEFAULT_INSTRUCTIONS.length).toBeLessThan(700);
  });

  it('sends reasoning.effort only when the caller passes effort', () => {
    expect(buildRequest({ messages: hello, model: 'm' })).not.toHaveProperty('reasoning');
    expect(buildRequest({ messages: hello, model: 'm', effort: undefined })).not.toHaveProperty('reasoning');
    const body = buildRequest({ messages: hello, model: 'm', effort: 'low' });
    expect(body.reasoning).toEqual({ effort: 'low' });
    const corrected = withoutReasoning(body);
    expect(corrected).not.toHaveProperty('reasoning');
    expect(corrected).toEqual(buildRequest({ messages: hello, model: 'm' }));
    expect(body.reasoning).toEqual({ effort: 'low' }); // the original is not mutated
  });

  it('recognises only the unsupported-capability error that names reasoning', () => {
    const code = 'subscription_sharing_unsupported_capability';
    expect(rejectsEffort({ error: { code, param: 'reasoning.effort' } })).toBe(true);
    expect(rejectsEffort({ error: { code, param: 'reasoning' } })).toBe(true);
    expect(rejectsEffort({ error: { code, param: 'model' } })).toBe(false);
    expect(rejectsEffort({ error: { code } })).toBe(false);
    expect(rejectsEffort({ error: { code: 'invalid_request_error', param: 'reasoning.effort' } })).toBe(false);
    expect(rejectsEffort({ detail: 'nope' })).toBe(false);
    expect(rejectsEffort(null)).toBe(false);
  });
});

describe('attached PDFs (input_file, docs/CONTRACT.md §9.6)', () => {
  const pdf = Buffer.from('%PDF-1.4 тест').toString('base64');
  it('docs become input_file parts after the images; only PDF, base64, a name, ≤ 5 per message', () => {
    const input = buildInput([{ role: 'user', text: 'Прочети', images: [{ mime: 'image/png', data: 'AAAA' }], docs: [{ name: 'акт.pdf', mime: 'application/pdf', data: pdf }] }]);
    expect(input[0].content.map((c) => c.type)).toEqual(['input_text', 'input_image', 'input_file']);
    expect(input[0].content[2]).toEqual({ type: 'input_file', filename: 'акт.pdf', file_data: `data:application/pdf;base64,${pdf}` });
    for (const docs of [
      [{ name: 'a.docx', mime: 'application/msword', data: pdf }], [{ name: '', mime: 'application/pdf', data: pdf }],
      [{ name: 'a.pdf', mime: 'application/pdf', data: 'не е base64!' }], Array(6).fill({ name: 'a.pdf', mime: 'application/pdf', data: pdf }), 'x',
    ]) expect(() => buildInput([{ role: 'user', text: 'x', docs }])).toThrow(RgError);
    expect(() => buildInput([{ role: 'user', text: 'x', docs: [{ name: 'a.pdf', mime: 'application/pdf', data: 'A'.repeat(24 * 1024 * 1024 + 4) }] }])).toThrow(RgError);
  });
});

describe('SSE parser', () => {
  const collect = (chunks) => {
    const events = [];
    const parser = createSseParser((e) => events.push(e));
    for (const chunk of chunks) parser.push(chunk);
    parser.end();
    return events;
  };

  it('parses events, multi-line data, comments and CRLF', () => {
    expect(collect(['event: a\ndata: {"x":1}\n\n: keep-alive\n\ndata: line1\ndata: line2\n\n'])).toEqual([
      { event: 'a', data: '{"x":1}' },
      { event: '', data: 'line1\nline2' },
    ]);
    expect(collect(['event: a\r\ndata: 1\r\n\r\nevent: b\rdata:2\r\r'])).toEqual([
      { event: 'a', data: '1' },
      { event: 'b', data: '2' },
    ]);
  });

  it('gives the same events for every possible split position', () => {
    const text = 'event: response.output_text.delta\r\ndata: {"type":"response.output_text.delta","delta":"Здр"}\r\n\r\n' +
      ': ping\n\nevent: response.completed\ndata: {"type":"response.completed"}\n\n';
    const whole = collect([text]);
    expect(whole).toHaveLength(2);
    for (let i = 1; i < text.length; i += 1) {
      expect(collect([text.slice(0, i), text.slice(i)])).toEqual(whole);
    }
    expect(collect([...text])).toEqual(whole); // one character at a time
  });

  it('delivers a last event that lacks its blank line', () => {
    expect(collect(['data: {"type":"response.completed"}'])).toEqual([{ event: '', data: '{"type":"response.completed"}' }]);
    expect(collect(['event: x\n'])).toEqual([]);
  });
});

describe('stream consumption', () => {
  it('emits deltas with the accumulated text and succeeds on response.completed', async () => {
    const seen = [];
    const out = await consumeStream(
      streamOf([sse({ type: 'response.created', response: {} }), delta('Здра'), delta('вей'), delta('!'), completed()]),
      { onDelta: (d, text) => seen.push([d, text]) },
    );
    expect(seen).toEqual([['Здра', 'Здра'], ['вей', 'Здравей'], ['!', 'Здравей!']]);
    expect(out).toMatchObject({ kind: 'completed', text: 'Здравей!' });
    expect(resultOf(out, 'asked-model')).toEqual({ ok: true, text: 'Здравей!', model: 'srv-model' });
  });

  it('survives chunk boundaries inside a multi-byte character and inside an event', async () => {
    const bytes = enc.encode(delta('Имоти „Надежда“ – добре дошли') + delta(' 🙂') + completed());
    for (const size of [1, 2, 3, 5, 7, 64]) {
      const chunks = [];
      for (let i = 0; i < bytes.length; i += size) chunks.push(bytes.slice(i, i + size));
      const out = await consumeStream(streamOf(chunks));
      expect(out).toMatchObject({ kind: 'completed', text: 'Имоти „Надежда“ – добре дошли 🙂' });
    }
  });

  it('stops reading at the terminal event', async () => {
    const out = await consumeStream(streamOf([delta('а'), completed(), delta('след края')]));
    expect(out.text).toBe('а');
  });

  it('uses the final output text when no deltas were streamed, and the requested model when none is reported', async () => {
    const response = { output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: 'Готово.' }] }] };
    expect(outputText(response)).toBe('Готово.');
    const out = await consumeStream(streamOf([sse({ type: 'response.completed', response })]));
    expect(resultOf(out, 'asked-model')).toEqual({ ok: true, text: 'Готово.', model: 'asked-model' });
  });

  it('a completed response without any text is not reported as an answer', async () => {
    const out = await consumeStream(streamOf([completed({ output: [] })]));
    expect(resultOf(out, 'm')).toMatchObject({ ok: false, code: 'empty' });
  });

  it('response.failed maps the documented code and keeps the partial text', async () => {
    const failed = sse({ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'limit' } } });
    const out = await consumeStream(streamOf([delta('Част'), failed]));
    expect(out.kind).toBe('failed');
    const result = resultOf(out, 'm');
    expect(result).toMatchObject({ ok: false, code: 'usage_limit', text: 'Част' });
    expect(result.error).toContain('chatgpt.com/settings/usage');

    const unknown = await consumeStream(streamOf([sse({ type: 'response.failed', response: { error: { code: 'server_error' } } })]));
    const r2 = resultOf(unknown, 'm');
    expect(r2).toMatchObject({ ok: false, code: 'failed' });
    expect(r2).not.toHaveProperty('text');
    expect(r2.error).toContain('server_error');

    const noError = await consumeStream(streamOf([sse({ type: 'response.failed', response: {} })]));
    expect(resultOf(noError, 'm')).toMatchObject({ ok: false, code: 'failed' });
  });

  it('a stream-level error event is a failure', async () => {
    const out = await consumeStream(streamOf([sse({ type: 'error', code: 'subscription_sharing_usage_unavailable', message: 'x' })]));
    expect(resultOf(out, 'm')).toMatchObject({ ok: false, code: 'unavailable' });
  });

  it('response.incomplete is marked incomplete, never as a normal success', async () => {
    const incomplete = sse({ type: 'response.incomplete', response: { model: 'srv-model', incomplete_details: { reason: 'max_output_tokens' } } });
    const withText = await consumeStream(streamOf([delta('Половин отго'), incomplete]));
    expect(resultOf(withText, 'm')).toEqual({ ok: true, text: 'Половин отго', model: 'srv-model', incomplete: true });
    const withoutText = await consumeStream(streamOf([incomplete]));
    expect(resultOf(withoutText, 'm')).toMatchObject({ ok: false, code: 'incomplete' });
  });

  it('a stream that ends without response.completed is a failure with the partial text', async () => {
    const ended = await consumeStream(streamOf([delta('Започнах'), sse({ type: 'response.output_text.done', text: 'Започнах' })]));
    expect(ended.kind).toBe('interrupted');
    expect(resultOf(ended, 'm')).toMatchObject({ ok: false, code: 'stream_interrupted', text: 'Започнах' });
    const empty = await consumeStream(streamOf([]));
    const r = resultOf(empty, 'm');
    expect(r).toMatchObject({ ok: false, code: 'stream_interrupted' });
    expect(r).not.toHaveProperty('text');
  });

  it('a transport error mid-stream is an interruption, not a crash', async () => {
    const out = await consumeStream(streamOf([delta('Един')], { failWith: new Error('socket closed') }));
    expect(resultOf(out, 'm')).toMatchObject({ ok: false, code: 'stream_interrupted', text: 'Един' });
  });

  it('ignores malformed and unrelated events', async () => {
    const out = await consumeStream(streamOf(['data: {not json}\n\n', 'data: [DONE]\n\n', sse({ type: 'response.in_progress' }), delta('ок'), completed()]));
    expect(out).toMatchObject({ kind: 'completed', text: 'ок' });
  });

  it('an abort signal ends a stream that never finishes', async () => {
    let cancelled = false;
    const never = new ReadableStream({ start(c) { c.enqueue(enc.encode(delta('чака'))); }, cancel() { cancelled = true; } });
    const ctl = new AbortController();
    const pending = consumeStream(never, { signal: ctl.signal, onDelta: () => setTimeout(() => ctl.abort(), 5) });
    const out = await pending;
    expect(out).toMatchObject({ kind: 'interrupted', text: 'чака' });
    expect(cancelled).toBe(true);
  });
});

describe('error map', () => {
  const body = (code, param) => ({ error: { code, param, message: 'english text' } });

  it.each([
    [403, 'subscription_sharing_user_not_eligible', 'not_eligible', /не е достъпно/],
    [429, 'subscription_sharing_usage_limit_exceeded', 'usage_limit', /лимит/],
    [503, 'subscription_sharing_usage_unavailable', 'unavailable', /временно/],
    [503, 'subscription_sharing_user_unavailable', 'unavailable', /временно/],
    [400, 'subscription_sharing_unsupported_capability', 'unsupported', /не поддържа/],
    [403, 'subscription_sharing_route_not_supported', 'config', /настройките/],
    [401, 'subscription_sharing_invalid_user', 'auth', /не прие входа/],
    [403, 'chatpass_v2_scope_not_authorized', 'config', /настройките/],
    [403, 'chatpass_v2_invalid_authorization_context', 'config', /настройките/],
  ])('HTTP %i %s -> %s', (status, serverCode, code, text) => {
    const mapped = mapApiError(status, body(serverCode, 'reasoning.effort'));
    expect(mapped.code).toBe(code);
    expect(mapped.serverCode).toBe(serverCode);
    const result = fail(mapped.code, mapped.detail);
    expect(result).toMatchObject({ ok: false, code });
    expect(result.error).toMatch(text);
    expect(result.error).toMatch(/[А-Яа-я]/);
    expect(result.error).not.toContain('english text');
  });

  it('names the unsupported parameter and points usage limits to ChatGPT settings without a reset time', () => {
    const unsupported = mapApiError(400, body('subscription_sharing_unsupported_capability', 'tools[0]'));
    expect(fail(unsupported.code, unsupported.detail).error).toContain('(tools[0])');
    const limit = messageFor('usage_limit');
    expect(limit).toContain('ChatGPT → Settings → Usage');
    expect(limit).not.toMatch(/\d+\s*(час|мин)/);
  });

  it('falls back on the HTTP status when there is no documented code', () => {
    expect(mapApiError(401, { detail: 'Unauthorized' }).code).toBe('auth');
    expect(mapApiError(403, { detail: 'Region not supported' }).code).toBe('forbidden');
    expect(mapApiError(503, { detail: 'Direct routing unavailable' }).code).toBe('unavailable');
    expect(mapApiError(502, null).code).toBe('unavailable');
    expect(mapApiError(429, body('rate_limit_exceeded')).code).toBe('rate_limit');
    const other = mapApiError(400, body('model_not_found'));
    expect(other.code).toBe('http');
    expect(fail(other.code, other.detail).error).toBe('ChatGPT върна грешка (HTTP 400, model_not_found).');
    expect(mapApiError(400, { error: 'invalid_request' })).toMatchObject({ code: 'http', serverCode: 'invalid_request' });
  });

  it('never puts unsafe server text into the message', () => {
    const mapped = mapApiError(400, body('<script>alert(1)</script>'));
    expect(fail(mapped.code, mapped.detail).error).toBe('ChatGPT върна грешка (HTTP 400).');
  });

  it('maps transport errors of http and unknown errors to Bulgarian failures', () => {
    expect(toFailure({ code: 'network', message: 'fetch failed' })).toMatchObject({ ok: false, code: 'network', error: expect.stringMatching(/Няма връзка/) });
    expect(toFailure({ code: 'timeout', message: 'timed out' })).toMatchObject({ code: 'timeout', error: expect.stringMatching(/не отговори навреме/) });
    expect(toFailure({ code: 'aborted' })).toMatchObject({ code: 'aborted' });
    expect(toFailure({ code: 'host' })).toMatchObject({ code: 'host' });
    expect(toFailure(Object.assign(new Error('x'), { name: 'AbortError' }))).toMatchObject({ code: 'aborted' });
    const unknown = toFailure(new TypeError('secret internal detail'), { text: 'частично' });
    expect(unknown).toEqual({ ok: false, code: 'internal', error: 'Неочаквана грешка в Real GPT.', text: 'частично' });
    expect(toFailure(new RgError('plan_disabled'))).toMatchObject({ code: 'plan_disabled', error: expect.stringMatching(/плана не е разрешено/) });
    expect(new RgError('no_such_code').code).toBe('internal');
  });
});
