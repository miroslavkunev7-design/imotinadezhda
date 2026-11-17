import { describe, it, expect, afterEach } from "vitest";
import { createSession, decodeJwt, jwtExp, mapUser, maskPhone } from "../../electron/backend/session.js";
import { createHttp } from "../../electron/backend/http.js";
import { SITE, SB_URL, SB_KEY } from "../../electron/backend/config.js";
import { makeJwt, memoryStore, fakeHttp, reply, httpError, startServer, sendJson, deferred, localFetch } from "./core-helpers.js";

const NOW = 1_800_000_000_000; // fixed clock (ms)
const nowS = NOW / 1000;
const token = (n, extra = {}) => makeJwt({ sub: "user-1", iat: nowS, exp: nowS + 3600, n, ...extra });
const PROFILE = { id: "user-1", email: "broker@example.com", user_metadata: { full_name: "Тест Брокер" } };

// Standard backend: login ok, staff true, profile, refresh rotates tokens.
function backend(overrides = {}) {
  let refreshes = 0;
  return fakeHttp(async (opts) => {
    for (const [part, fn] of Object.entries(overrides)) if (opts.url.includes(part)) return fn(opts);
    if (opts.url === SITE + "/api/register") return reply(200, { ok: true, access_token: token("a1"), refresh_token: "r1" });
    if (opts.url.endsWith("/rpc/nd_is_staff")) return reply(200, true);
    if (opts.url.endsWith("/auth/v1/user")) return reply(200, PROFILE);
    if (opts.url.includes("grant_type=refresh_token")) { refreshes++; return reply(200, { access_token: token("a" + (refreshes + 1)), refresh_token: "r" + (refreshes + 1), expires_in: 3600 }); }
    if (opts.url.includes("/auth/v1/logout")) return reply(204, undefined);
    return reply(200, { ok: true });
  });
}

function setup({ http = backend(), store = memoryStore(), now = () => NOW } = {}) {
  const changes = [];
  const session = createSession({ http, secureStore: store, log: null, onChange: (s) => changes.push(s), now });
  return { session, http, store, changes };
}

// A saved session whose access token expires `left` seconds from NOW.
function saved(left, n = "old") {
  return { access_token: token(n), refresh_token: "r-old", exp: nowS + left, user: { id: "user-1", name: "Тест Брокер", email: "broker@example.com", phoneMasked: "" } };
}

let server = null;
afterEach(async () => {
  if (server) await server.close();
  server = null;
});

describe("jwt and profile helpers", () => {
  it("decodes exp without verifying", () => {
    const t = makeJwt({ sub: "x", exp: 1900000000 });
    expect(jwtExp(t)).toBe(1900000000);
    expect(decodeJwt(t).sub).toBe("x");
    expect(jwtExp("garbage")).toBeNull();
    expect(jwtExp("a.b.c")).toBeNull();
    expect(jwtExp(makeJwt({ sub: "x" }))).toBeNull();
  });

  it("maps a normal e-mail account", () => {
    expect(mapUser(PROFILE)).toEqual({ id: "user-1", name: "Тест Брокер", email: "broker@example.com", phoneMasked: "" });
  });

  it("hides the synthetic e-mail of a phone login and masks the phone", () => {
    const u = mapUser({ id: "u2", email: "p359888123456@tel.imotinadezhda.bg", user_metadata: { full_name: "Тест Телефон", phone: "0888123456" } });
    expect(u).toEqual({ id: "u2", name: "Тест Телефон", email: "", phoneMasked: "+359 •••••• 456" });
    expect(JSON.stringify(u)).not.toContain("888123");
  });

  it("masks local and international phone formats the same way", () => {
    expect(maskPhone("0888 123 456")).toBe("+359 •••••• 456");
    expect(maskPhone("+359 888 123 456")).toBe("+359 •••••• 456");
    expect(maskPhone("00359888123456")).toBe("+359 •••••• 456");
    expect(maskPhone("123")).toBe("");
    expect(maskPhone(null)).toBe("");
  });
});

describe("login", () => {
  it("sends exactly the auth-login request, without Origin, over a real socket", async () => {
    server = await startServer((req, res) => {
      if (req.url === "/api/register") return sendJson(res, 200, { ok: true, access_token: token("a1"), refresh_token: "r1" });
      if (req.url === "/rest/v1/rpc/nd_is_staff") return sendJson(res, 200, true);
      if (req.url === "/auth/v1/user") return sendJson(res, 200, PROFILE);
      sendJson(res, 404, {});
    });
    // Real fetch through createHttp; only the destination is redirected to the local server.
    const http = createHttp({ fetchImpl: localFetch(server.base, [SITE, SB_URL]) });
    const { session, store } = setup({ http });
    const out = await session.login({ identifier: "  0888123456 ", password: "p@ss word" });

    expect(out).toEqual({ ok: true, user: { id: "user-1", name: "Тест Брокер", email: "broker@example.com", phoneMasked: "" } });
    const [login, staff, profile] = server.requests;
    expect(login.method).toBe("POST");
    expect(login.url).toBe("/api/register");
    expect(JSON.parse(login.body)).toEqual({ action: "auth-login", identifier: "0888123456", password: "p@ss word" });
    expect(login.headers["content-type"]).toBe("application/json");
    expect(login.headers.origin).toBeUndefined();
    expect(login.headers.referer).toBeUndefined();
    expect(login.headers.authorization).toBeUndefined();

    expect(staff.method).toBe("POST");
    expect(staff.headers.apikey).toBe(SB_KEY);
    expect(staff.headers.authorization).toBe("Bearer " + token("a1"));
    expect(staff.body).toBe("{}");
    expect(staff.headers.origin).toBeUndefined();
    expect(profile.method).toBe("GET");
    expect(profile.headers.authorization).toBe("Bearer " + token("a1"));
    expect(server.requests).toHaveLength(3);

    expect(session.state()).toEqual({ status: "signedIn", user: out.user, remembered: true });
    expect(store.read("session")).toMatchObject({ access_token: token("a1"), refresh_token: "r1", exp: nowS + 3600, user: out.user });
  });

  it("never returns tokens or the password to the caller", async () => {
    const { session, changes } = setup();
    const out = await session.login({ identifier: "broker@example.com", password: "hunter2-secret" });
    const visible = JSON.stringify([out, session.state(), changes]);
    for (const secret of [token("a1"), "r1", "hunter2-secret", "eyJ"]) expect(visible).not.toContain(secret);
    expect(changes).toEqual([{ status: "signedIn", user: out.user, remembered: true }]);
  });

  it("staff gate false -> signed out, nothing stored, the fresh tokens are revoked", async () => {
    const http = backend({ "/rpc/nd_is_staff": () => reply(200, false) });
    const { session, store, changes } = setup({ http });
    const out = await session.login({ identifier: "client@example.com", password: "pw" });
    expect(out).toEqual({ ok: false, error: "Този профил няма достъп до CRM.", code: "not_staff" });
    expect(session.state()).toEqual({ status: "signedOut" });
    expect(await session.getAccessToken()).toBeNull();
    expect(store.read("session")).toBeNull();
    expect(changes).toEqual([]);
    const revoke = http.to("/auth/v1/logout");
    expect(revoke).toHaveLength(1);
    expect(revoke[0].url).toBe(SB_URL + "/auth/v1/logout?scope=local");
    expect(http.to("/auth/v1/user")).toHaveLength(0);
  });

  it.each([
    [401, { error: "Грешен телефон/имейл или парола." }, "credentials", "Грешен телефон/имейл или парола."],
    [429, { error: "Твърде много опити. Опитайте след 15 минути." }, "rate", "Твърде много опити. Опитайте след 15 минути."],
    [403, { error: "Невалидна заявка." }, "http", "Сървърът отказа входа от тази програма (HTTP 403)."],
    [503, { error: "Входът временно не е достъпен." }, "http", "Входът временно не е достъпен."],
    [502, undefined, "http", "Входът временно не е достъпен (HTTP 502)."],
  ])("maps HTTP %i to a Bulgarian error", async (status, body, code, error) => {
    const http = backend({ "/api/register": () => reply(status, body) });
    const { session } = setup({ http });
    const out = await session.login({ identifier: "x@example.com", password: "pw" });
    expect(out).toMatchObject({ ok: false, code, error });
    expect(http.calls).toHaveLength(1); // no retry, no further calls
    expect(session.state().status).toBe("signedOut");
  });

  it("maps network and timeout failures; never retries the login", async () => {
    for (const [code, error] of [["network", "Няма връзка със сървъра."], ["timeout", "Сървърът не отговори навреме. Опитайте отново."]]) {
      const http = backend({ "/api/register": () => { throw httpError(code); } });
      const { session } = setup({ http });
      expect(await session.login({ identifier: "x@example.com", password: "pw" })).toEqual({ ok: false, code, error });
      expect(http.calls).toHaveLength(1);
    }
  });

  it("rejects empty input without any network call", async () => {
    const { session, http } = setup();
    for (const args of [undefined, {}, { identifier: "", password: "x" }, { identifier: "a@b.bg", password: "" }, { identifier: 5, password: "x" }, { identifier: "a".repeat(255), password: "x" }]) {
      expect(await session.login(args)).toMatchObject({ ok: false, code: "invalid" });
    }
    expect(http.calls).toHaveLength(0);
  });

  it("falls back to the token claims when the profile request fails", async () => {
    const http = backend({
      "/api/register": () => reply(200, { ok: true, access_token: token("a1", { email: "p359888123456@tel.imotinadezhda.bg", user_metadata: { full_name: "Тест Телефон" } }), refresh_token: "r1" }),
      "/auth/v1/user": () => { throw httpError("network"); },
    });
    const { session } = setup({ http });
    const out = await session.login({ identifier: "0888123456", password: "pw" });
    expect(out).toEqual({ ok: true, user: { id: "user-1", name: "Тест Телефон", email: "", phoneMasked: "+359 •••••• 456" } });
  });

  it("keeps the session in memory only when encryption is unavailable", async () => {
    const { session, store } = setup({ store: memoryStore({ available: false }) });
    await session.login({ identifier: "broker@example.com", password: "pw" });
    expect(session.state()).toMatchObject({ status: "signedIn", remembered: false });
    expect(store.data.size).toBe(0);
    expect(await session.getAccessToken()).toBe(token("a1"));
  });
});

describe("restore and refresh", () => {
  it("init restores a saved session without touching the network", async () => {
    const store = memoryStore();
    store.write("session", saved(3600));
    const { session, http } = setup({ store });
    expect(session.init()).toEqual({ status: "signedIn", user: saved(3600).user, remembered: true });
    expect(await session.getAccessToken()).toBe(token("old"));
    expect(http.calls).toHaveLength(0);
  });

  it("init ignores a missing or malformed saved session", () => {
    for (const value of [null, {}, { access_token: "x" }, { access_token: "x", refresh_token: "y", user: {} }]) {
      const store = memoryStore();
      if (value) store.write("session", value);
      expect(setup({ store }).session.init()).toEqual({ status: "signedOut" });
    }
  });

  it("refreshes about 5 minutes before expiry - single flight: 5 concurrent callers, 1 refresh call", async () => {
    const gate = deferred();
    const store = memoryStore();
    store.write("session", saved(200)); // inside the 5-minute margin
    const http = backend({
      "grant_type=refresh_token": async () => { await gate.promise; return reply(200, { access_token: token("new"), refresh_token: "r-new", expires_in: 3600 }); },
    });
    const { session, changes } = setup({ http, store });
    session.init();

    const waiting = Array.from({ length: 5 }, () => session.getAccessToken());
    await new Promise((r) => setTimeout(r, 20));
    gate.resolve();
    expect(await Promise.all(waiting)).toEqual(Array(5).fill(token("new")));

    const refreshes = http.to("grant_type=refresh_token");
    expect(refreshes).toHaveLength(1);
    expect(refreshes[0]).toMatchObject({ url: SB_URL + "/auth/v1/token?grant_type=refresh_token", method: "POST", headers: { apikey: SB_KEY }, json: { refresh_token: "r-old" } });
    expect(refreshes[0].headers.Authorization).toBeUndefined();
    // Both tokens are replaced together, in memory and on disk; the UI is not disturbed.
    expect(store.read("session")).toMatchObject({ access_token: token("new"), refresh_token: "r-new", exp: nowS + 3600 });
    expect(changes).toEqual([]);
  });

  it("does not refresh while the token is comfortably valid", async () => {
    const store = memoryStore();
    store.write("session", saved(301));
    const { session, http } = setup({ store });
    session.init();
    expect(await session.getAccessToken()).toBe(token("old"));
    expect(http.calls).toHaveLength(0);
  });

  it("terminal refresh error -> signedOut, stored session wiped, UI notified", async () => {
    for (const status of [400, 401, 403]) {
      const store = memoryStore();
      store.write("session", saved(10));
      const http = backend({ "grant_type=refresh_token": () => reply(status, { error: "invalid_grant", error_description: "Invalid Refresh Token: Already Used" }) });
      const { session, changes } = setup({ http, store });
      session.init();
      expect(await session.getAccessToken()).toBeNull();
      expect(session.state()).toEqual({ status: "signedOut" });
      expect(store.read("session")).toBeNull();
      expect(changes).toEqual([{ status: "signedOut" }]);
      expect(http.to("grant_type=refresh_token")).toHaveLength(1);
    }
  });

  it("a network or 5xx failure of the refresh keeps the session", async () => {
    for (const failure of [() => { throw httpError("network"); }, () => reply(503, undefined), () => reply(429, { msg: "rate limit" })]) {
      const store = memoryStore();
      store.write("session", saved(120)); // still valid for two minutes
      const http = backend({ "grant_type=refresh_token": failure });
      const { session, changes } = setup({ http, store });
      session.init();
      expect(await session.getAccessToken()).toBe(token("old"));
      expect(session.state().status).toBe("signedIn");
      expect(store.read("session").refresh_token).toBe("r-old");
      expect(changes).toEqual([]);
      // The next calls use the still-valid token without waiting for another refresh attempt.
      expect(await session.getAccessToken()).toBe(token("old"));
      expect(http.to("grant_type=refresh_token")).toHaveLength(1);
    }
  });

  it("tries the refresh again once the pause after a failure has passed", async () => {
    let t = NOW;
    let fail = true;
    const store = memoryStore();
    store.write("session", saved(200));
    const http = backend({ "grant_type=refresh_token": () => (fail ? reply(503, undefined) : reply(200, { access_token: token("new"), refresh_token: "r-new" })) });
    const { session } = setup({ http, store, now: () => t });
    session.init();
    expect(await session.getAccessToken()).toBe(token("old"));
    fail = false;
    t += 31000;
    expect(await session.getAccessToken()).toBe(token("new"));
    expect(http.to("grant_type=refresh_token")).toHaveLength(2);
  });

  it("an expired token that cannot be refreshed (offline) fails without sending the request", async () => {
    const store = memoryStore();
    store.write("session", saved(-60));
    const http = backend({ "grant_type=refresh_token": () => { throw httpError("network"); } });
    const { session } = setup({ http, store });
    session.init();
    await expect(session.authed({ url: SITE + "/api/assistant", method: "POST", json: {} })).rejects.toMatchObject({ code: "network", sent: false });
    expect(http.to("/api/assistant")).toHaveLength(0);
    expect(session.state().status).toBe("signedIn");
  });

  it("uses the token lifetime, not the PC clock, to plan the next refresh", async () => {
    // The PC clock is an hour ahead of the server: by absolute time the fresh token would look expired.
    const skewed = makeJwt({ sub: "user-1", iat: nowS - 3600, exp: nowS });
    const http = backend({ "/api/register": () => reply(200, { ok: true, access_token: skewed, refresh_token: "r1" }) });
    const { session, store } = setup({ http });
    await session.login({ identifier: "broker@example.com", password: "pw" });
    expect(store.read("session").exp).toBe(nowS + 3600);
    expect(await session.getAccessToken()).toBe(skewed);
    expect(http.to("grant_type=refresh_token")).toHaveLength(0);
  });
});

describe("authed()", () => {
  it("adds the Bearer token and passes the request through", async () => {
    const { session, http } = setup();
    await session.login({ identifier: "broker@example.com", password: "pw" });
    const res = await session.authed({ url: SITE + "/api/tools", method: "POST", json: { tool: "cases.list", input: {} }, headers: { "X-A": "1" }, timeoutMs: 5 });
    expect(res.status).toBe(200);
    expect(http.to("/api/tools")[0]).toMatchObject({ method: "POST", json: { tool: "cases.list", input: {} }, timeoutMs: 5, headers: { "X-A": "1", Authorization: "Bearer " + token("a1") } });
  });

  it("401 -> one refresh -> exactly one retry of the same request with the new token", async () => {
    let n = 0;
    const http = backend({ "/api/assistant": () => (++n === 1 ? reply(401, { ok: false, error: "влезте" }) : reply(200, { ok: true, text: "ok" })) });
    const { session } = setup({ http });
    await session.login({ identifier: "broker@example.com", password: "pw" });
    const body = { messages: [{ role: "user", text: "здравей" }] };
    const res = await session.authed({ url: SITE + "/api/assistant", method: "POST", json: body });

    expect(res.json).toEqual({ ok: true, text: "ok" });
    const sent = http.to("/api/assistant");
    expect(sent).toHaveLength(2);
    expect(sent[0].headers.Authorization).toBe("Bearer " + token("a1"));
    expect(sent[1].headers.Authorization).toBe("Bearer " + token("a2"));
    expect(sent[1].json).toBe(body);
    expect(http.to("grant_type=refresh_token")).toHaveLength(1);
  });

  it("a second 401 is returned as is (no third attempt) and ends the session", async () => {
    const http = backend({ "/api/assistant": () => reply(401, { ok: false, error: "влезте" }) });
    const { session, store, changes } = setup({ http });
    await session.login({ identifier: "broker@example.com", password: "pw" });
    const res = await session.authed({ url: SITE + "/api/assistant", method: "POST", json: {} });
    expect(res.status).toBe(401);
    expect(http.to("/api/assistant")).toHaveLength(2);
    expect(http.to("grant_type=refresh_token")).toHaveLength(1);
    expect(session.state()).toEqual({ status: "signedOut" });
    expect(store.read("session")).toBeNull();
    expect(changes.at(-1)).toEqual({ status: "signedOut" });
  });

  it("401 + terminal refresh -> auth error, signed out, no retry", async () => {
    const http = backend({
      "/api/tools": () => reply(401, { ok: false }),
      "grant_type=refresh_token": () => reply(400, { error: "invalid_grant" }),
    });
    const { session } = setup({ http });
    await session.login({ identifier: "broker@example.com", password: "pw" });
    await expect(session.authed({ url: SITE + "/api/tools", method: "POST", json: {} })).rejects.toMatchObject({ code: "auth", sent: false });
    expect(http.to("/api/tools")).toHaveLength(1);
    expect(session.state()).toEqual({ status: "signedOut" });
  });

  it("concurrent 401s share one refresh and each request is retried once", async () => {
    const http = backend({ "/api/tools": (opts) => (opts.headers.Authorization.endsWith(token("a1")) ? reply(401, {}) : reply(200, { ok: true, result: 1 })) });
    const { session } = setup({ http });
    await session.login({ identifier: "broker@example.com", password: "pw" });
    const results = await Promise.all([1, 2, 3].map(() => session.authed({ url: SITE + "/api/tools", method: "POST", json: {} })));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(http.to("grant_type=refresh_token")).toHaveLength(1);
    expect(http.to("/api/tools")).toHaveLength(6);
  });

  it("5xx and network errors are never retried", async () => {
    const http = backend({ "/api/assistant": () => reply(502, { ok: false, error: "x" }), "/api/voice": () => { throw httpError("network"); } });
    const { session } = setup({ http });
    await session.login({ identifier: "broker@example.com", password: "pw" });
    expect((await session.authed({ url: SITE + "/api/assistant", method: "POST", json: {} })).status).toBe(502);
    await expect(session.authed({ url: SITE + "/api/voice?fn=tts", method: "POST", json: {} })).rejects.toMatchObject({ code: "network" });
    expect(http.to("/api/assistant")).toHaveLength(1);
    expect(http.to("/api/voice")).toHaveLength(1);
    expect(http.to("grant_type=refresh_token")).toHaveLength(0);
  });

  it("signed out -> auth error without any network call", async () => {
    const { session, http } = setup();
    await expect(session.authed({ url: SITE + "/api/tools", method: "POST", json: {} })).rejects.toMatchObject({ code: "auth", sent: false });
    expect(http.calls).toHaveLength(0);
  });
});

describe("logout", () => {
  it("revokes only this device (scope=local), wipes the store and notifies the UI", async () => {
    const { session, http, store, changes } = setup();
    await session.login({ identifier: "broker@example.com", password: "pw" });
    expect(await session.logout()).toEqual({ ok: true });
    const out = http.to("/auth/v1/logout");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ url: SB_URL + "/auth/v1/logout?scope=local", method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token("a1") } });
    expect(session.state()).toEqual({ status: "signedOut" });
    expect(store.read("session")).toBeNull();
    expect(changes.at(-1)).toEqual({ status: "signedOut" });
    expect(await session.getAccessToken()).toBeNull();
  });

  it("works offline and when already signed out", async () => {
    const http = backend({ "/auth/v1/logout": () => { throw httpError("network"); } });
    const { session } = setup({ http });
    await session.login({ identifier: "broker@example.com", password: "pw" });
    expect(await session.logout()).toEqual({ ok: true });
    expect(session.state()).toEqual({ status: "signedOut" });
    expect(await session.logout()).toEqual({ ok: true });
    expect(http.to("/auth/v1/logout")).toHaveLength(1);
  });

  it("a refresh that finishes after logout cannot bring the session back", async () => {
    const gate = deferred();
    const store = memoryStore();
    store.write("session", saved(100));
    const http = backend({ "grant_type=refresh_token": async () => { await gate.promise; return reply(200, { access_token: token("late"), refresh_token: "r-late" }); } });
    const { session } = setup({ http, store });
    session.init();
    const pending = session.getAccessToken();
    await new Promise((r) => setTimeout(r, 10));
    await session.logout();
    gate.resolve();
    expect(await pending).toBeNull();
    expect(session.state()).toEqual({ status: "signedOut" });
    expect(store.read("session")).toBeNull();
  });
});
