// Internet module of the agent (docs/CONTRACT.md §10.1): SSRF rules, the ted-browse session guard, redirects,
// DNS rebinding, size caps, the DuckDuckGo parser, read_page (windows-1251, phones, e-mails, prices), robots.txt
// and fetch_image. Everything runs against fakes and fixtures: no network.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowseError, checkTarget, checkUrl, createBrowser, createSessionGuard, hostBlocked, isPrivateIp } from "../../electron/browse/net.js";
import { isChallenge, parseResults, resultUrl, webSearch } from "../../electron/browse/search.js";
import { createPages, robotsAllows, sniffMedia } from "../../electron/browse/page.js";
import { extractPhones, extractPrices, extractEmails, extractPage, htmlToText, decodeBody } from "../../electron/browse/extract.js";

const fixture = (name) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", name));
const PUBLIC = "93.184.215.14";
const lookupTable = (table) => async (host) => {
  if (!Object.hasOwn(table, host)) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
  return [].concat(table[host]).map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
};

// Fake fetch: routes by URL; a handler returns {status, headers, body(string|Buffer), url?}.
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const h = routes[url];
    if (!h) throw new Error("net::ERR_NAME_NOT_RESOLVED");
    const r = typeof h === "function" ? h(url, init) : h;
    const body = Buffer.isBuffer(r.body) ? r.body : Buffer.from(r.body || "", "utf8");
    const headers = new Headers(r.headers || {});
    return {
      status: r.status || 200, url: r.url || url, headers,
      body: new ReadableStream({ start(c) { if (body.length) c.enqueue(new Uint8Array(body)); c.close(); } }),
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length),
    };
  };
  fn.calls = calls;
  return fn;
}

describe("SSRF rules", () => {
  it("classifies private, loopback, link-local, CGNAT, reserved and mapped addresses", () => {
    const priv = ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0",
      "198.18.0.5", "224.0.0.1", "240.0.0.1", "255.255.255.255", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1",
      "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1", "2002:c0a8:0101::1", "2001:db8::1", "not-an-ip"];
    for (const ip of priv) expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of [PUBLIC, "8.8.8.8", "172.32.0.1", "100.128.0.1", "2a00:1450:4017:80b::200e", "::ffff:8.8.8.8"]) expect(isPrivateIp(ip), ip).toBe(false);
  });

  it("refuses bad schemes, credentials, ports, single-label and internal names, blocked hosts", () => {
    const bad = [
      ["file:///C:/Windows/win.ini", "invalid_url"], ["ftp://x.example.com/", "invalid_url"], ["javascript:alert(1)", "invalid_url"],
      ["https://user:pw@x.example.com/", "invalid_url"], ["https://x.example.com:22/", "blocked"], ["http://localhost/", "private"],
      ["http://intranet/", "private"], ["http://nas.local/", "private"], ["http://router.lan/", "private"], ["http://127.0.0.1/", "private"],
      ["http://[::1]/", "private"], ["http://169.254.169.254/latest/meta-data", "private"], ["http://10.0.0.1:8080/", "private"],
    ];
    for (const [url, code] of bad) expect(() => checkUrl(url), url).toThrow(expect.objectContaining({ code }));
    expect(() => checkUrl("https://sub.spam.example.com/x", { blocked: ["spam.example.com"] })).toThrow(expect.objectContaining({ code: "blocked" }));
    expect(checkUrl("https://www.imoti.example.com:8443/a?b=1").hostname).toBe("www.imoti.example.com");
    expect(hostBlocked("spam.example.com", ["*.spam.example.com"])).toBe(true);
    expect(hostBlocked("notspam.example.com", ["spam.example.com"])).toBe(false);
  });

  it("resolves first and refuses a name that points anywhere private", async () => {
    const lookup = lookupTable({ "ok.example.com": PUBLIC, "evil.example.com": [PUBLIC, "10.0.0.5"], "v6.example.com": "::ffff:192.168.0.1" });
    await expect(checkTarget("https://ok.example.com/", { lookup })).resolves.toBeInstanceOf(URL);
    await expect(checkTarget("https://evil.example.com/", { lookup })).rejects.toMatchObject({ code: "private" });
    await expect(checkTarget("https://v6.example.com/", { lookup })).rejects.toMatchObject({ code: "private" });
    await expect(checkTarget("https://missing.example.com/", { lookup })).rejects.toMatchObject({ code: "dns" });
  });
});

describe("ted-browse session guard", () => {
  it("cancels private targets and the 6th redirect, strips credentials and remembers connected IPs", async () => {
    const lookup = lookupTable({ "a.example.com": PUBLIC, "inner.example.com": "192.168.1.1" });
    const guard = createSessionGuard({ getSettings: () => ({ browse: { blocked: ["blocked.example.com"] } }), lookup });
    expect(await guard.beforeRequest({ id: 1, url: "https://a.example.com/" })).toEqual({});
    expect(await guard.beforeRequest({ id: 2, url: "https://inner.example.com/" })).toEqual({ cancel: true });
    expect(await guard.beforeRequest({ id: 3, url: "https://blocked.example.com/" })).toEqual({ cancel: true });
    for (let i = 0; i < 6; i++) guard.beforeRedirect({ id: 4 });
    expect(await guard.beforeRequest({ id: 4, url: "https://a.example.com/" })).toEqual({ cancel: true });
    const h = guard.beforeSendHeaders({ requestHeaders: { Authorization: "Bearer x", Cookie: "a=1", Origin: "app://ted", Referer: "x", "User-Agent": "u", Accept: "*/*" } });
    expect(h.requestHeaders).toEqual({ "User-Agent": "u", Accept: "*/*" });
    guard.responseStarted({ url: "https://a.example.com/", ip: PUBLIC });
    expect(guard.ipOf("https://a.example.com/")).toBe(PUBLIC);
    const wr = {};
    for (const k of ["onBeforeRequest", "onBeforeSendHeaders", "onBeforeRedirect", "onResponseStarted", "onCompleted", "onErrorOccurred"]) wr[k] = (fn) => { wr[k].fn = fn; };
    guard.install(wr);
    const got = await new Promise((resolve) => wr.onBeforeRequest.fn({ id: 9, url: "http://127.0.0.1/" }, resolve));
    expect(got).toEqual({ cancel: true });
  });
});

describe("browser.get", () => {
  const lookup = lookupTable({ "a.example.com": PUBLIC, "b.example.com": PUBLIC, "inner.example.com": "10.0.0.7" });

  it("follows redirects with the same checks and stops at a private hop", async () => {
    const fetchImpl = fakeFetch({
      "https://a.example.com/start": { status: 302, headers: { location: "https://b.example.com/next" } },
      "https://b.example.com/next": { status: 301, headers: { location: "http://inner.example.com/admin" } },
    });
    const b = createBrowser({ fetchImpl, lookup });
    await expect(b.get("https://a.example.com/start")).rejects.toMatchObject({ code: "private" });
    expect(fetchImpl.calls.map((c) => c.url)).toEqual(["https://a.example.com/start", "https://b.example.com/next"]);
    expect(fetchImpl.calls[0].init.headers).not.toHaveProperty("Authorization");
    expect(fetchImpl.calls[0].init.credentials).toBe("omit");
  });

  it("refuses too many redirects, a redirect to localhost, and a final URL that left the rules", async () => {
    const loop = fakeFetch({ "https://a.example.com/loop": { status: 302, headers: { location: "/loop" } } });
    await expect(createBrowser({ fetchImpl: loop, lookup }).get("https://a.example.com/loop")).rejects.toMatchObject({ code: "redirects" });
    expect(loop.calls).toHaveLength(6);
    const toLocal = fakeFetch({ "https://a.example.com/x": { status: 307, headers: { location: "http://127.0.0.1:8080/" } } });
    await expect(createBrowser({ fetchImpl: toLocal, lookup }).get("https://a.example.com/x")).rejects.toMatchObject({ code: "private" });
    const followed = fakeFetch({ "https://a.example.com/f": { body: "x", url: "http://inner.example.com/" } });
    await expect(createBrowser({ fetchImpl: followed, lookup }).get("https://a.example.com/f")).rejects.toMatchObject({ code: "private" });
  });

  it("discards an answer whose connected IP turned private (DNS rebinding), but not behind a proxy", async () => {
    const fetchImpl = fakeFetch({ "https://a.example.com/": { body: "<p>secret</p>" } });
    const direct = createBrowser({ fetchImpl, lookup, ipOf: () => "127.0.0.1", resolveProxy: async () => "DIRECT" });
    await expect(direct.get("https://a.example.com/")).rejects.toMatchObject({ code: "private" });
    const proxied = createBrowser({ fetchImpl, lookup, ipOf: () => "10.0.0.1", resolveProxy: async () => "PROXY proxy.corp:8080" });
    expect((await proxied.get("https://a.example.com/")).buffer.toString()).toBe("<p>secret</p>");
  });

  it("Chromium-followed redirects: the guard reports the final URL and connected IP (session.fetch has no res.url)", async () => {
    const guard = createSessionGuard({ lookup });
    // What Electron 45 emits for one session.fetch with redirect "follow": the same request id for every hop.
    const fetchImpl = async (url) => {
      await guard.beforeRequest({ id: 7, url });
      guard.beforeRedirect({ id: 7, redirectURL: "https://b.example.com/final", ip: PUBLIC });
      await guard.beforeRequest({ id: 7, url: "https://b.example.com/final" });
      guard.responseStarted({ id: 7, url: "https://b.example.com/final", ip: "10.0.0.9" });
      const body = Buffer.from("<title>x</title>");
      return { status: 200, url: "", headers: new Headers({ "content-type": "text/html" }), arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length) };
    };
    const b = createBrowser({ fetchImpl, lookup, resolved: guard.resolved, ipOf: guard.ipOf });
    await expect(b.get("https://a.example.com/start")).rejects.toMatchObject({ code: "private" });
    expect(guard.resolved("https://a.example.com/start")).toEqual({ url: "https://b.example.com/final", ip: "10.0.0.9" });
    const blocked = createBrowser({ fetchImpl: async () => { throw new Error("net::ERR_BLOCKED_BY_CLIENT"); }, lookup });
    await expect(blocked.get("https://a.example.com/")).rejects.toMatchObject({ code: "blocked" });
  });

  it("rebinding guard: a private connected IP aborts the fetch before the body is read; a private redirect hop cancels the next hop", async () => {
    const guard = createSessionGuard({ lookup });
    let bodyRead = false;
    // The answer started from 127.0.0.1 (hostile DNS): the guard learns the IP at onResponseStarted.
    const fetchImpl = async (url, init) => {
      await guard.beforeRequest({ id: 21, url });
      guard.responseStarted({ id: 21, url, ip: "127.0.0.1" });
      expect(init.signal.aborted).toBe(true); // aborted synchronously, before the caller got the response
      return { status: 200, url, headers: new Headers({ "content-type": "text/html" }), body: { getReader: () => ({ read: async () => { bodyRead = true; return { done: true }; }, cancel: async () => {} }) } };
    };
    const b = createBrowser({ fetchImpl, lookup, resolved: guard.resolved, ipOf: guard.ipOf, watch: guard.watch });
    await expect(b.get("https://a.example.com/r")).rejects.toMatchObject({ code: "private" });
    expect(bodyRead).toBe(false);

    // An intermediate hop served from a private address: the next hop of the same request id is cancelled.
    const guard2 = createSessionGuard({ lookup });
    const seen = [];
    const fetch2 = async (url) => {
      seen.push(await guard2.beforeRequest({ id: 22, url }));
      guard2.beforeRedirect({ id: 22, url, redirectURL: "https://b.example.com/next", ip: "192.168.1.1" });
      seen.push(await guard2.beforeRequest({ id: 22, url: "https://b.example.com/next" }));
      throw new Error("net::ERR_BLOCKED_BY_CLIENT");
    };
    const b2 = createBrowser({ fetchImpl: fetch2, lookup, resolved: guard2.resolved, ipOf: guard2.ipOf, watch: guard2.watch });
    await expect(b2.get("https://a.example.com/hop")).rejects.toMatchObject({ code: "private" });
    expect(seen).toEqual([{}, { cancel: true }]);

    // Behind a proxy the connected address is the proxy's (10.x): not treated as rebinding.
    const guard3 = createSessionGuard({ lookup });
    const fetch3 = async (url) => {
      await guard3.beforeRequest({ id: 23, url });
      guard3.responseStarted({ id: 23, url, ip: "10.1.2.3" });
      const body = Buffer.from("ok");
      return { status: 200, url, headers: new Headers({ "content-type": "text/plain" }), arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length) };
    };
    const b3 = createBrowser({ fetchImpl: fetch3, lookup, resolveProxy: async () => "PROXY proxy.corp:8080", resolved: guard3.resolved, ipOf: guard3.ipOf, watch: guard3.watch });
    expect((await b3.get("https://a.example.com/p")).buffer.toString()).toBe("ok");
  });

  it("caps the body size and times out", async () => {
    const big = fakeFetch({ "https://a.example.com/big": { body: Buffer.alloc(2048) } });
    await expect(createBrowser({ fetchImpl: big, lookup }).get("https://a.example.com/big", { maxBytes: 1024 })).rejects.toMatchObject({ code: "too_large" });
    const declared = fakeFetch({ "https://a.example.com/d": { body: "x", headers: { "content-length": "999999999" } } });
    await expect(createBrowser({ fetchImpl: declared, lookup }).get("https://a.example.com/d")).rejects.toMatchObject({ code: "too_large" });
    const slow = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
    await expect(createBrowser({ fetchImpl: slow, lookup }).get("https://a.example.com/", { timeoutMs: 30 })).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("web_search (DuckDuckGo HTML)", () => {
  it("parses results, decodes uddg links, skips ads, duplicates and non-http links", () => {
    const results = parseResults(fixture("ddg-results.html").toString("utf8"));
    expect(results).toEqual([
      { title: "Тристаен апартамент в Шумен – 120 000 €", url: "https://www.imoti.example.com/obiava/123?a=1&b=2", snippet: "Продава тристаен апартамент в кв. Тракия, 85 кв.м, тел. 0888 123 456 & още." },
      { title: "Обяви за имоти в Шумен", url: "https://www.obiavi.example.com/shumen", snippet: "Всички обяви за Шумен." },
    ]);
    expect(resultUrl("https://duckduckgo.com/y.js?ad_domain=x")).toBeNull();
  });

  it("reports the challenge page as rate_limited and sends no credentials", async () => {
    const lookup = lookupTable({ "html.duckduckgo.com": PUBLIC });
    const challenge = fakeFetch({ "https://html.duckduckgo.com/html/?q=%D0%B0%D0%BF%D0%B0%D1%80%D1%82%D0%B0%D0%BC%D0%B5%D0%BD%D1%82&kl=bg-bg": { status: 202, body: fixture("ddg-challenge.html") } });
    const r = await webSearch(createBrowser({ fetchImpl: challenge, lookup }), { query: "апартамент" });
    expect(r).toEqual({ ok: false, code: "rate_limited", error: "Търсачката временно ограничи заявките – опитайте след малко." });
    expect(isChallenge(200, fixture("ddg-challenge.html").toString())).toBe(true);
    const ok = fakeFetch({ "https://html.duckduckgo.com/html/?q=x%20y&kl=bg-bg": { body: fixture("ddg-results.html"), headers: { "content-type": "text/html; charset=utf-8" } } });
    const res = await webSearch(createBrowser({ fetchImpl: ok, lookup }), { query: "  x   y ", n: 1 });
    expect(res).toMatchObject({ ok: true, query: "x y", engine: "DuckDuckGo", results: [{ url: "https://www.imoti.example.com/obiava/123?a=1&b=2" }] });
    expect(ok.calls[0].url.startsWith("https://html.duckduckgo.com/")).toBe(true);
    expect(await webSearch(createBrowser({ fetchImpl: ok, lookup }), { query: "" })).toMatchObject({ ok: false, code: "invalid" });
  });
});

// windows-1251 bytes for Cyrillic А..я and ASCII.
function cp1251(s) {
  return Buffer.from([...s].map((ch) => {
    const c = ch.charCodeAt(0);
    if (c < 128) return c;
    if (c >= 0x410 && c <= 0x44f) return c - 0x410 + 0xc0;
    return 0x3f;
  }));
}

describe("read_page", () => {
  const lookup = lookupTable({ "imoti.example.com": PUBLIC, "fb.example.com": PUBLIC });
  const page = `<html><head><meta charset="windows-1251"><title>Тристаен апартамент Шумен</title><meta property="og:image" content="/img/main.jpg"></head>
<body><script>var x = "не трябва";</script><h1>Продава тристаен</h1><p>Цена: 120 000 EUR. Телефон: 0888 123 456 или +359 54 830 123.
Пишете на test@example.com. GSM 887654321. Дата 05.11.2026 г.</p><img src="/img/logo.png"><img data-src="photos/1.jpg">
<a href="/obiava/2">Следваща обява</a><a href="javascript:alert(1)">x</a></body></html>`;

  it("decodes windows-1251, extracts text, phones, e-mails, prices, images and links", async () => {
    const fetchImpl = fakeFetch({
      "https://imoti.example.com/robots.txt": { status: 404, body: "" },
      "https://imoti.example.com/obiava/1": { body: cp1251(page), headers: { "content-type": "text/html" } },
    });
    const pages = createPages({ browser: createBrowser({ fetchImpl, lookup }) });
    const r = await pages.readPage({ url: "https://imoti.example.com/obiava/1" });
    expect(r.ok).toBe(true);
    expect(r.title).toBe("Тристаен апартамент Шумен");
    expect(r.text).toContain("Продава тристаен");
    expect(r.text).not.toContain("не трябва");
    expect(r.phones).toEqual(["+359888123456", "+35954830123", "+359887654321"]);
    expect(r.emails).toEqual(["test@example.com"]);
    expect(r.prices).toContain("120 000 EUR");
    expect(r.images).toEqual(["https://imoti.example.com/img/main.jpg", "https://imoti.example.com/obiava/photos/1.jpg"]);
    expect(r.links).toEqual([{ url: "https://imoti.example.com/obiava/2", text: "Следваща обява" }]);
  });

  it("honours robots.txt, refuses Facebook/Instagram, returns PDFs as files", async () => {
    const fetchImpl = fakeFetch({
      "https://imoti.example.com/robots.txt": { body: "User-agent: *\nDisallow: /private\nAllow: /private/ok\n" },
      "https://imoti.example.com/private/ok": { body: "%PDF-1.7 test pdf", headers: { "content-type": "application/pdf" } },
    });
    const pages = createPages({ browser: createBrowser({ fetchImpl, lookup }) });
    expect(await pages.readPage({ url: "https://imoti.example.com/private/x" })).toMatchObject({ ok: false, code: "robots" });
    const pdf = await pages.readPage({ url: "https://imoti.example.com/private/ok" });
    expect(pdf.file).toMatchObject({ mime: "application/pdf", name: "ok.pdf", sourceUrl: "https://imoti.example.com/private/ok" });
    expect(await pages.readPage({ url: "https://www.facebook.com/groups/1" })).toMatchObject({ ok: false, code: "social" });
    expect(fetchImpl.calls.some((c) => c.url.includes("facebook"))).toBe(false);
    const off = createPages({ browser: createBrowser({ fetchImpl, lookup }), getSettings: () => ({ browse: { robots: false } }) });
    expect(await off.readPage({ url: "https://imoti.example.com/private/x" })).toMatchObject({ ok: false, code: "network" });
  });

  it("robots groups and Allow precedence", () => {
    const txt = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /search\nAllow: /search/public\n";
    expect(robotsAllows(txt, "/obiava/1")).toBe(true);
    expect(robotsAllows(txt, "/search?q=1")).toBe(false);
    expect(robotsAllows(txt, "/search/public/1")).toBe(true);
    expect(robotsAllows("", "/x")).toBe(true);
  });
});

describe("fetch_image", () => {
  const lookup = lookupTable({ "img.example.com": PUBLIC });
  it("accepts JPEG/PNG/WEBP/GIF/PDF by magic bytes, ≤ 8 MB, refuses HTML", async () => {
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
    const fetchImpl = fakeFetch({
      "https://img.example.com/a/%D1%81%D0%BD%D0%B8%D0%BC%D0%BA%D0%B0.jpg?x=1": { body: jpg, headers: { "content-type": "image/jpeg" } },
      "https://img.example.com/page": { body: "<html></html>", headers: { "content-type": "image/jpeg" } },
      "https://img.example.com/huge.png": { body: Buffer.alloc(9 * 1048576) },
    });
    const pages = createPages({ browser: createBrowser({ fetchImpl, lookup }) });
    const r = await pages.fetchImage({ url: "https://img.example.com/a/снимка.jpg?x=1" });
    expect(r.ok).toBe(true);
    expect(r.file.mime).toBe("image/jpeg");
    expect(r.file.name).toBe("снимка.jpg");
    expect(await pages.fetchImage({ url: "https://img.example.com/page" })).toMatchObject({ ok: false, code: "not_image" });
    expect(await pages.fetchImage({ url: "https://img.example.com/huge.png" })).toMatchObject({ ok: false, code: "too_large" });
    expect(await pages.fetchImage({ url: "http://10.0.0.1/a.jpg" })).toMatchObject({ ok: false, code: "private" });
    expect(sniffMedia(Buffer.from("RIFF0000WEBPVP8 "))).toBe("image/webp");
  });
});

describe("extraction helpers", () => {
  it("phones: Bulgarian formats, no dates or prices", () => {
    expect(extractPhones("0888123456, 088 812 3456, +359 (2) 123 4567, 00359 54 800 900, 02 987 6543")).toEqual(["+359888123456", "+35921234567", "+35954800900", "+35929876543"]);
    expect(extractPhones("Цена 120 000 €, дата 05.11.2026, площ 85.50")).toEqual([]);
    expect(extractPhones("тел.: 878 111 222")).toEqual(["+359878111222"]);
  });
  it("prices, e-mails, text", () => {
    expect(extractPrices("Цена: 85 000 € или 166 245 лв. ($ 92 000)")).toEqual(["85 000 €", "166 245 лв.", "92 000 $"]);
    expect(extractEmails("a@b.bg logo@2x.png Test.User@Example.COM")).toEqual(["a@b.bg", "test.user@example.com"]);
    expect(htmlToText("<p>а&nbsp;б &amp; &#1074;</p><style>x{}</style><td>1</td><td>2</td>")).toBe("а б & в\n1\t2");
    expect(decodeBody(Buffer.from("<meta charset=utf-8>я"), "")).toContain("я");
    const p = extractPage("<title>T</title><p>" + "а".repeat(50) + "</p>", "https://x.example.com/", 10);
    expect(p.text).toHaveLength(10);
    expect(p.truncated).toBe(true);
  });
});

it("BrowseError carries a code", () => {
  expect(new BrowseError("x", "y")).toMatchObject({ code: "x", message: "y" });
});

// Security review: every extractor pass is linear – a hostile page cannot block MAIN's event loop.
describe("extractor is linear on hostile pages", () => {
  it("5 MB of unclosed comments, scripts, links, tags or price-like numbers each take well under 3 s", async () => {
    const { extractPage, htmlToText } = await import("../../electron/browse/extract.js");
    const MB = 5 * 1048576;
    const hostile = {
      comment: "<!--".repeat(MB / 4), script: "<script>".repeat(MB / 8), anchors: "<a href=x>".repeat(MB / 10),
      price: "1" + ",111".repeat(MB / 4), tags: "<p".repeat(MB / 2), meta: "<meta ".repeat(MB / 6), title: "<title>".repeat(MB / 7),
      ordinary: "<p>Апартамент 85 000 € тел. 0888 123 456 <a href='/x'>обява</a></p>".repeat(65536),
    };
    for (const [name, html] of Object.entries(hostile)) {
      const t0 = Date.now();
      extractPage(html, "https://x.example/");
      expect(Date.now() - t0, name).toBeLessThan(3000);
    }
    const t0 = Date.now();
    htmlToText("<!--".repeat(2_500_000), 10_000_000); // read_document of a hostile .html attachment
    expect(Date.now() - t0).toBeLessThan(3000);
    // Behaviour kept: hidden parts removed, <header> is not <head>, an unclosed <head> does not hide the page.
    expect(htmlToText("<head><title>t</title></head><header>Заглавие</header><script>x()</script><p>текст<!-- скрито --></p>")).toBe("Заглавие\nтекст");
    expect(htmlToText("<html><head><meta charset=utf-8><body><p>видимо</p>")).toBe("видимо");
    expect(extractPage("<title>Обява &amp; снимки</title><a href='/a'>едно</a><a href='/b'>две", "https://x.example/").links).toEqual([{ url: "https://x.example/a", text: "едно" }, { url: "https://x.example/b" }]);
  }, 60_000);
});
