// Shared helpers for the core-* unit tests. No Electron, no real backend: fakes and 127.0.0.1 only.
import http from "node:http";

// Unsigned JWT with the given claims (the app only decodes, it never verifies).
export function makeJwt(claims) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(claims)}.c2lnbmF0dXJl`;
}

// Reversible stand-in for Electron safeStorage (DPAPI).
export function fakeSafeStorage({ available = true } = {}) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (s) => Buffer.from("enc1:" + Buffer.from(String(s), "utf8").toString("hex")),
    decryptString: (buf) => {
      const raw = Buffer.from(buf).toString("utf8");
      if (!raw.startsWith("enc1:")) throw new Error("cannot decrypt");
      return Buffer.from(raw.slice(5), "hex").toString("utf8");
    },
  };
}

// In-memory secure store with the same interface as store/secure-file.js.
export function memoryStore({ available = true } = {}) {
  const data = new Map();
  return {
    data,
    available: () => available,
    read: (name) => (data.has(name) ? structuredClone(data.get(name)) : null),
    write: (name, value) => { if (!available) return false; data.set(name, structuredClone(value)); return true; },
    remove: (name) => { data.delete(name); },
  };
}

// Response in the shape createHttp().request() returns.
export function reply(status, json, extra = {}) {
  return { status, ok: status >= 200 && status < 300, headers: {}, json, text: json === undefined ? "" : JSON.stringify(json), ...extra };
}

// Fake http module: records every request and answers through `handler(opts, index)`.
export function fakeHttp(handler) {
  const calls = [];
  return {
    calls,
    to: (part) => calls.filter((c) => c.url.includes(part)),
    request: async (opts) => {
      calls.push(opts);
      return handler(opts, calls.length - 1);
    },
  };
}

export function httpError(code, sent = true) {
  const e = new Error(code);
  e.code = code;
  e.sent = sent;
  return e;
}

// Fake session: authed() records requests and answers through `handler`.
export function fakeSession(handler) {
  const calls = [];
  return {
    calls,
    to: (part) => calls.filter((c) => c.url.includes(part)),
    state: () => ({ status: "signedIn", user: { id: "u1", name: "", email: "", phoneMasked: "" } }),
    authed: async (opts) => {
      calls.push(opts);
      return handler(opts, calls.length - 1);
    },
  };
}

// Local HTTP server on 127.0.0.1 that records what really arrives over the wire.
export async function startServer(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const seen = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString("utf8") };
      requests.push(seen);
      handler(seen, res);
    });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    requests,
    base: `http://127.0.0.1:${server.address().port}`,
    port: server.address().port,
    close: () => new Promise((ok) => { server.closeAllConnections(); server.close(ok); }),
  };
}

export function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

export function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

// Real fetch whose destination is swapped for the local stand-in; anything else is refused, so a test
// can never reach a real server by mistake.
export function localFetch(base, hosts) {
  return (url, init) => {
    let target = String(url);
    for (const host of hosts) target = target.replace(host, base);
    if (!target.startsWith(base + "/")) throw new Error("test tried to leave 127.0.0.1: " + new URL(target).host);
    return fetch(target, init);
  };
}
