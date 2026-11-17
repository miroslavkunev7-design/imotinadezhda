// SPDX-License-Identifier: MIT
// Helpers for reading responses of the injected http.request without assuming more than the contract gives.

export function parseJson(text) {
  if (typeof text !== 'string' || !text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Response headers may be a Headers instance or a plain object.
export function header(res, name) {
  const h = res?.headers;
  if (!h) return null;
  if (typeof h.get === 'function') return h.get(name);
  const key = Object.keys(h).find((k) => k.toLowerCase() === name);
  return key ? String(h[key]) : null;
}

export const requestIdOf = (res) => header(res, 'x-request-id') || header(res, 'openai-request-id') || null;

// Yields decoded text from a web ReadableStream (or any async iterable of bytes/strings).
// Aborting `signal` cancels the reader, so a pending read ends even if the transport ignores the signal.
export async function* textChunks(body, signal) {
  const decoder = new TextDecoder();
  const decode = (value) => (typeof value === 'string' ? value : decoder.decode(value, { stream: true }));
  if (typeof body?.getReader === 'function') {
    const reader = body.getReader();
    const stop = () => reader.cancel().catch(() => {});
    if (signal?.aborted) stop();
    signal?.addEventListener('abort', stop, { once: true });
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decode(value);
      }
    } finally {
      signal?.removeEventListener('abort', stop);
      stop();
    }
  } else if (body && typeof body[Symbol.asyncIterator] === 'function') {
    for await (const value of body) yield decode(value);
  }
  const tail = decoder.decode();
  if (tail) yield tail;
}

// Body of a response as text, whatever `as` mode produced it. Capped: error bodies are small.
export async function readText(res, signal, limit = 256 * 1024) {
  if (typeof res?.text === 'string') return res.text;
  if (res?.json !== undefined && res.json !== null) return JSON.stringify(res.json);
  if (!res?.body) return '';
  let out = '';
  try {
    for await (const chunk of textChunks(res.body, signal)) {
      out += chunk;
      if (out.length >= limit) break;
    }
  } catch {
    // A broken error body still leaves the HTTP status to report.
  }
  return out;
}

// Releases an unread streaming body (for example before retrying after a 401).
export async function discard(res) {
  try {
    if (res?.body && typeof res.body.cancel === 'function' && !res.body.locked) await res.body.cancel();
  } catch {
    // nothing to release
  }
}
