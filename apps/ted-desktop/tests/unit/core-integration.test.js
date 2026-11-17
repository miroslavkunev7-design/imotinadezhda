// Whole MAIN backend chain (http -> session -> assistant/tools/email/voice) over a real socket against
// a local stand-in for the production endpoints on 127.0.0.1. Nothing leaves this machine.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHttp } from "../../electron/backend/http.js";
import { createSession } from "../../electron/backend/session.js";
import { createAssistant } from "../../electron/backend/assistant.js";
import { createTools } from "../../electron/backend/tools.js";
import { createEmail } from "../../electron/backend/email.js";
import { createVoice } from "../../electron/backend/voice.js";
import { SITE, SB_URL, SB_KEY } from "../../electron/backend/config.js";
import { makeJwt, memoryStore, startServer, sendJson, localFetch } from "./core-helpers.js";

const nowS = Math.floor(Date.now() / 1000);
const access = (n) => makeJwt({ sub: "user-1", iat: nowS, exp: nowS + 3600, n });
const WAV = Buffer.from("RIFF0000WAVEfmt ", "latin1");

let server;
let valid = access(1);      // the only access token the stand-in accepts
let refreshCalls = 0;
const bearer = (req) => String(req.headers.authorization || "").replace(/^Bearer /, "");

beforeAll(async () => {
  server = await startServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const body = req.body ? JSON.parse(req.body) : null;
    if (url.pathname === "/api/register") return sendJson(res, 200, { ok: true, access_token: access(1), refresh_token: "refresh-1" });
    if (url.pathname === "/auth/v1/token") { refreshCalls++; valid = access(2); return sendJson(res, 200, { access_token: valid, refresh_token: "refresh-2", expires_in: 3600 }); }
    if (url.pathname === "/auth/v1/logout") { res.writeHead(204); return res.end(); }
    if (url.pathname === "/api/tools" && req.method === "GET") return sendJson(res, 200, { tools: [{ name: "calendar.list" }, { name: "cases.list" }, { name: "email.send" }] });
    if (bearer(req) !== valid) return sendJson(res, 401, { ok: false, error: "Invalid or expired token" });
    if (url.pathname === "/rest/v1/rpc/nd_is_staff") return sendJson(res, 200, true);
    if (url.pathname === "/auth/v1/user") return sendJson(res, 200, { id: "user-1", email: "p359888000111@tel.imotinadezhda.bg", user_metadata: { full_name: "Тест Брокер" } });
    if (url.pathname === "/api/assistant" && body.action === "models") return sendJson(res, 200, { ok: true, models: [{ id: "m1", name: "Модел", note: "", provider: "gemini", vision: true, pdf: true }], modes: [{ id: "lawyer", name: "Юрист" }], n8n: null });
    if (url.pathname === "/api/assistant") return sendJson(res, 200, { ok: true, text: "Утре имате един оглед.", transcript: null, actions: ["calendar.list", "интернет: време шумен"], staff: true, mode: "secretary", model: "m1", model_name: "Модел", fallback: null, ui: null, email: null });
    if (url.pathname === "/api/tools") return sendJson(res, 200, { ok: true, result: body.tool === "email.send" ? { sent: true, to: "a@example.com" } : { cases: [] } });
    if (url.pathname === "/api/voice" && url.searchParams.get("fn") === "tts") { res.writeHead(200, { "Content-Type": "audio/wav" }); return res.end(WAV); }
    if (url.pathname === "/api/voice") return sendJson(res, 200, { ok: true, text: "диктуван текст" });
    sendJson(res, 404, { ok: false });
  });
});
afterAll(() => server.close());

describe("backend chain over a real socket", () => {
  it("login -> models -> chat -> tools -> email -> voice -> expired token -> logout", async () => {
    // Real fetch; only the destination host is swapped for the local stand-in.
    const http = createHttp({ fetchImpl: localFetch(server.base, [SITE, SB_URL]) });
    const changes = [];
    const store = memoryStore();
    const session = createSession({ http, secureStore: store, onChange: (s) => changes.push(s.status) });
    const assistant = createAssistant({ session });
    const tools = createTools({ session });
    const voice = createVoice({ session });
    const email = createEmail({ tools, confirm: async () => true });

    const login = await session.login({ identifier: "0888000111", password: "парола-1" });
    expect(login).toEqual({ ok: true, user: { id: "user-1", name: "Тест Брокер", email: "", phoneMasked: "+359 •••••• 111" } });

    expect(await assistant.models()).toEqual({ ok: true, models: [{ id: "m1", name: "Модел", note: "", provider: "gemini", vision: true, pdf: true }], modes: [{ id: "lawyer", name: "Юрист" }] });

    const chat = await assistant.chat({ requestId: "r1", messages: [{ role: "user", text: "какво имам утре?", files: [{ name: "a.png", mime: "image/png", data: "AAAA" }] }], mode: "secretary" });
    expect(chat).toMatchObject({ ok: true, text: "Утре имате един оглед.", transcript: null, mode: "secretary", model: "m1", modelName: "Модел", fallback: null, email: null, listings: null, video: null, uiPanel: null });
    expect(chat.actions).toEqual([
      { raw: "calendar.list", kind: "tool", tool: "calendar.list", label: "Преглед на календара", ok: true, mutating: false },
      { raw: "интернет: време шумен", kind: "info", label: "интернет: време шумен", ok: true, mutating: false },
    ]);

    expect(await tools.read("cases.list", { status: "open" })).toEqual({ ok: true, result: { cases: [] } });
    expect(await tools.read("clients.delete", { id: "1", confirm: true })).toMatchObject({ ok: false, code: "forbidden" });
    expect(await email.confirmSend({ to: { email: "a@example.com" }, subject: "Тема", attachments: [] })).toEqual({ ok: true, result: { sent: true, to: "a@example.com" } });

    const tts = await voice.tts({ text: "Здравейте", voice: "Puck", style: "brief" });
    expect(Buffer.from(tts.wav).equals(WAV)).toBe(true);
    expect(await voice.transcribe({ mime: "audio/webm;codecs=opus", data: "AAAA" })).toEqual({ ok: true, text: "диктуван текст" });

    // The server stops accepting the token: one refresh, one retry, and the call succeeds.
    valid = "revoked-on-server";
    expect(await tools.read("cases.list", {})).toEqual({ ok: true, result: { cases: [] } });
    expect(refreshCalls).toBe(1);
    expect(store.read("session")).toMatchObject({ access_token: access(2), refresh_token: "refresh-2" });

    expect(await session.logout()).toEqual({ ok: true });
    expect(changes).toEqual(["signedIn", "signedOut"]);

    // What really went over the wire.
    const seen = server.requests;
    for (const r of seen) {
      expect(r.headers.origin, r.url).toBeUndefined();
      expect(r.headers.referer, r.url).toBeUndefined();
      expect(r.headers.cookie, r.url).toBeUndefined();
    }
    const of = (path, method = "POST") => seen.filter((r) => r.url.startsWith(path) && r.method === method);
    expect(of("/api/register")).toHaveLength(1);
    expect(of("/api/register")[0].headers.authorization).toBeUndefined();
    for (const r of seen.filter((x) => x.url.startsWith("/api/") && !x.url.startsWith("/api/register"))) {
      expect(r.headers.authorization, r.url).toMatch(/^Bearer eyJ/);
      expect(r.headers.apikey, r.url).toBeUndefined(); // the Supabase key goes only to Supabase
    }
    for (const r of seen.filter((x) => x.url.startsWith("/auth/") || x.url.startsWith("/rest/"))) expect(r.headers.apikey, r.url).toBe(SB_KEY);

    const chatReq = of("/api/assistant").map((r) => JSON.parse(r.body)).find((b) => b.messages);
    expect(chatReq).toEqual({ messages: [{ role: "user", text: "какво имам утре?", files: [{ name: "a.png", mime: "image/png", data: "AAAA" }] }], page: "Тед за Windows", mode: "secretary" });
    expect(of("/api/assistant")).toHaveLength(2); // models + one chat: nothing was sent twice
    expect(of("/api/tools", "GET")).toHaveLength(1);
    const toolCalls = of("/api/tools").map((r) => JSON.parse(r.body));
    expect(toolCalls).toEqual([
      { tool: "cases.list", input: { status: "open" } },
      { tool: "email.send", input: { confirm: true } },
      { tool: "cases.list", input: {} }, // rejected with 401 (old token)
      { tool: "cases.list", input: {} }, // the single retry with the refreshed token
    ]);
    expect(JSON.parse(of("/api/voice?fn=tts")[0].body)).toEqual({ text: "Здравейте", voice: "Puck", style: "brief" });
    expect(JSON.parse(of("/api/voice?fn=transcribe")[0].body)).toEqual({ mime: "audio/webm", data: "AAAA" });
    expect(JSON.parse(of("/auth/v1/token?grant_type=refresh_token")[0].body)).toEqual({ refresh_token: "refresh-1" });
    expect(of("/auth/v1/logout?scope=local")).toHaveLength(1);
    expect(of("/auth/v1/logout?scope=local")[0].headers.authorization).toBe("Bearer " + access(2));
  });
});
