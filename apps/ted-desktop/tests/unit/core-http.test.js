import { describe, it, expect, afterEach } from "vitest";
import { createHttp, checkUrl, HttpError } from "../../electron/backend/http.js";
import { ALLOWED_HOSTS, SITE, SB_URL } from "../../electron/backend/config.js";
import { startServer, sendJson } from "./core-helpers.js";

let server = null;
afterEach(async () => {
  if (server) await server.close();
  server = null;
});

describe("host allowlist", () => {
  it("accepts exactly the contract hosts over https", () => {
    expect(ALLOWED_HOSTS).toEqual(["imotinadezhda.bg", "hyvwfsmjbaynozceookv.supabase.co", "auth.openai.com", "api.openai.com"]);
    for (const url of [SITE + "/api/assistant", SB_URL + "/auth/v1/user", "https://auth.openai.com/api/accounts/oauth/token", "https://api.openai.com/v1/models"]) {
      expect(checkUrl(url).href).toBe(url);
    }
  });

  it.each([
    "https://www.imotinadezhda.bg/api/assistant",          // subdomain
    "https://evil.imotinadezhda.bg/",
    "https://imotinadezhda.bg.evil.com/",                  // suffix trick
    "https://imotinadezhda.bg@evil.com/",                  // userinfo trick
    "https://user:pw@imotinadezhda.bg/",
    "https://imotinadezhda.bg:8443/",                      // other port
    "https://imotinadezhda.bg./",                          // trailing dot
    "http://imotinadezhda.bg/api/assistant",               // plain http
    "https://supabase.co/",
    "https://other.supabase.co/",
    "https://openai.com/",
    "https://example.com/",
    "http://127.0.0.1:8080/",                              // loopback is not on the production list
    "http://localhost/",
    "file:///C:/Windows/system.ini",
    "javascript:alert(1)",
    "not a url",
    "",
  ])("refuses %s without calling fetch", async (url) => {
    let called = 0;
    const http = createHttp({ fetchImpl: async () => { called++; return new Response("{}"); } });
    await expect(http.request({ url })).rejects.toMatchObject({ code: "host", sent: false });
    expect(called).toBe(0);
  });

  it("allows plain http only for an allow-listed 127.0.0.1 (tests)", () => {
    expect(() => checkUrl("http://127.0.0.1:5000/x", ["127.0.0.1"])).not.toThrow();
    expect(() => checkUrl("http://example.com/x", ["example.com"])).toThrow(HttpError);
  });
});

describe("request over a real socket", () => {
  it("POSTs JSON without Origin or Referer, even if the caller passes them", async () => {
    server = await startServer((req, res) => sendJson(res, 200, { ok: true }));
    const http = createHttp({ allowedHosts: ["127.0.0.1"], userAgent: "TedDesktop/test" });
    const res = await http.request({
      url: server.base + "/api/register", method: "POST", json: { a: 1 },
      headers: { Origin: "https://evil.example", referer: "https://evil.example/x", "X-Test": "1" },
    });
    expect(res).toMatchObject({ status: 200, ok: true, json: { ok: true } });
    const seen = server.requests[0];
    expect(seen.method).toBe("POST");
    expect(seen.headers.origin).toBeUndefined();
    expect(seen.headers.referer).toBeUndefined();
    expect(seen.headers["content-type"]).toBe("application/json");
    expect(seen.headers["x-test"]).toBe("1");
    expect(seen.headers["user-agent"]).toBe("TedDesktop/test");
    expect(JSON.parse(seen.body)).toEqual({ a: 1 });
  });

  it("encodes form bodies and exposes response headers both ways", async () => {
    server = await startServer((req, res) => sendJson(res, 200, { got: req.body }, { "X-Thing": "v" }));
    const http = createHttp({ allowedHosts: ["127.0.0.1"] });
    const res = await http.request({ url: server.base + "/token", method: "POST", form: { grant_type: "refresh_token", a: "b c" } });
    expect(server.requests[0].headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(res.json.got).toBe("grant_type=refresh_token&a=b+c");
    expect(res.headers["x-thing"]).toBe("v");
    expect(res.headers.get("X-Thing")).toBe("v");
  });

  it("returns text, arrayBuffer and stream bodies; error bodies are always parsed", async () => {
    server = await startServer((req, res) => {
      if (req.url === "/wav") { res.writeHead(200, { "Content-Type": "audio/wav" }); return res.end(Buffer.from([82, 73, 70, 70])); }
      if (req.url === "/fail") return sendJson(res, 502, { ok: false, error: "x" });
      if (req.url === "/html") { res.writeHead(504, { "Content-Type": "text/html" }); return res.end("<html>gateway</html>"); }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("hello");
    });
    const http = createHttp({ allowedHosts: ["127.0.0.1"] });
    expect((await http.request({ url: server.base + "/t", as: "text" })).text).toBe("hello");
    const wav = await http.request({ url: server.base + "/wav", as: "arrayBuffer" });
    expect(wav.buffer).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(wav.buffer)]).toEqual([82, 73, 70, 70]);
    const failed = await http.request({ url: server.base + "/fail", as: "arrayBuffer" });
    expect(failed).toMatchObject({ status: 502, ok: false, json: { ok: false, error: "x" } });
    expect(failed.buffer).toBeUndefined();
    const html = await http.request({ url: server.base + "/html" });
    expect(html).toMatchObject({ status: 504, ok: false, json: null });
    const stream = await http.request({ url: server.base + "/s", as: "stream" });
    expect(await new Response(stream.body).text()).toBe("hello");
  });

  it("does not follow redirects", async () => {
    server = await startServer((req, res) => {
      if (req.url === "/go") { res.writeHead(302, { Location: "/target" }); return res.end(); }
      sendJson(res, 200, { reached: true });
    });
    const http = createHttp({ allowedHosts: ["127.0.0.1"] });
    const res = await http.request({ url: server.base + "/go" });
    expect(res.status).toBe(302);
    expect(res.ok).toBe(false);
    expect(server.requests.map((r) => r.url)).toEqual(["/go"]);
  });

  it("maps a timeout to code timeout (outcome unknown) and never retries", async () => {
    server = await startServer(() => { /* never answers */ });
    const http = createHttp({ allowedHosts: ["127.0.0.1"] });
    await expect(http.request({ url: server.base + "/slow", method: "POST", json: {}, timeoutMs: 80 })).rejects.toMatchObject({ code: "timeout", sent: true });
    expect(server.requests.length).toBe(1);
  });

  it("maps a caller abort to code aborted", async () => {
    server = await startServer(() => { /* never answers */ });
    const http = createHttp({ allowedHosts: ["127.0.0.1"] });
    const ctrl = new AbortController();
    const p = http.request({ url: server.base + "/slow", method: "POST", json: {}, signal: ctrl.signal, timeoutMs: 5000 });
    setTimeout(() => ctrl.abort(), 50);
    await expect(p).rejects.toMatchObject({ code: "aborted", sent: true });
    // Already aborted before the call: nothing is sent.
    await expect(http.request({ url: server.base + "/slow", signal: ctrl.signal })).rejects.toMatchObject({ code: "aborted", sent: false });
    expect(server.requests.length).toBe(1);
  });

  it("maps a refused connection to code network with sent=false", async () => {
    server = await startServer((req, res) => sendJson(res, 200, {}));
    const dead = server.base;
    await server.close();
    server = null;
    const http = createHttp({ allowedHosts: ["127.0.0.1"] });
    await expect(http.request({ url: dead + "/x", method: "POST", json: {} })).rejects.toMatchObject({ code: "network", sent: false });
  });

  it("reports a connection that dies after the request was sent as possibly executed", async () => {
    server = await startServer((req, res) => res.socket.destroy());
    const http = createHttp({ allowedHosts: ["127.0.0.1"] });
    await expect(http.request({ url: server.base + "/x", method: "POST", json: {} })).rejects.toMatchObject({ code: "network", sent: true });
  });
});

describe("failures before anything is sent", () => {
  it("a malformed request (rejected by fetch itself) is reported as not sent", async () => {
    let listening = 0;
    server = await startServer((req, res) => { listening++; sendJson(res, 200, {}); });
    const http = createHttp({ allowedHosts: ["127.0.0.1"] });
    await expect(http.request({ url: server.base + "/x", method: "POST", headers: { "X-Bad": "line1\nline2" }, json: {} })).rejects.toMatchObject({ code: "network", sent: false });
    expect(listening).toBe(0);
  });
});

describe("logging", () => {
  it("logs method, host, path and status - never the query, headers or body", async () => {
    const lines = [];
    const log = { info: (event, fields) => lines.push({ event, ...fields }), warn: (event, fields) => lines.push({ event, ...fields }) };
    const http = createHttp({ log, fetchImpl: async () => new Response('{"ok":true}', { status: 200 }) });
    await http.request({ url: SITE + "/api/voice?fn=tts&code=abc", method: "POST", headers: { Authorization: "Bearer secret-token" }, json: { text: "поверително" } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ event: "http", method: "POST", host: "imotinadezhda.bg", path: "/api/voice", status: 200 });
    const dump = JSON.stringify(lines);
    expect(dump).not.toContain("secret-token");
    expect(dump).not.toContain("поверително");
    expect(dump).not.toContain("code=abc");
  });
});
