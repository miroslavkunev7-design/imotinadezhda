import { describe, it, expect } from "vitest";
import { buildBody, normalize, createAssistant, LIMITS } from "../../electron/backend/assistant.js";
import { SITE, PAGE } from "../../electron/backend/config.js";
import { fakeSession, reply, httpError, deferred } from "./core-helpers.js";

const B64 = "AAAA";
const img = (over = {}) => ({ name: "a.jpg", mime: "image/jpeg", data: B64, ...over });
const user = (text, files) => (files ? { role: "user", text, files } : { role: "user", text });
const bot = (text) => ({ role: "assistant", text });
const invalid = (args) => {
  try { buildBody(args); } catch (e) { return e; }
  return null;
};

describe("buildBody", () => {
  it("general chat: sends the history plus the current message and the fixed page name", () => {
    const body = buildBody({ messages: [user("здравей"), bot("Здравейте!"), user("какво имам утре?")] });
    expect(body).toEqual({
      messages: [{ role: "user", text: "здравей" }, { role: "assistant", text: "Здравейте!" }, { role: "user", text: "какво имам утре?" }],
      page: "Тед за Windows",
    });
    expect(PAGE).toBe("Тед за Windows");
    expect(Object.keys(body)).toEqual(["messages", "page"]); // model, mode and case_id are omitted when not chosen
  });

  it("adds model, mode and case_id only when given", () => {
    const body = buildBody({ messages: [user("x")], model: "gemini-pro", mode: "lawyer", caseId: "case-1" });
    expect(body).toMatchObject({ model: "gemini-pro", mode: "lawyer", case_id: "case-1" });
    expect(body.caseId).toBeUndefined();
    for (const empty of [undefined, null, ""]) {
      expect(Object.keys(buildBody({ messages: [user("x")], model: empty, mode: empty, caseId: empty }))).toEqual(["messages", "page"]);
    }
  });

  it("case mode: sends ONLY the current message (the server rebuilds the history)", () => {
    const history = [user("първо"), bot("отговор"), user("второ"), bot("отговор 2"), user("текущо", [img()])];
    const body = buildBody({ messages: history, caseId: "c-42" });
    expect(body.messages).toEqual([{ role: "user", text: "текущо", files: [img()] }]);
    expect(body.case_id).toBe("c-42");
    // Even a history longer than the general limit is fine inside a case.
    const long = Array.from({ length: 40 }, (_, i) => (i % 2 ? bot("b") : user("a"))).concat([user("текущо")]);
    expect(buildBody({ messages: long, caseId: "c-42" }).messages).toHaveLength(1);
  });

  it("accepts up to 16 messages and rejects more", () => {
    expect(LIMITS.messages).toBe(16);
    // user, assistant, user, ... ending with the current user message
    const turns = (n) => Array.from({ length: n - 1 }, (_, i) => (i % 2 ? bot("b") : user("a"))).concat([user("последно")]);
    expect(buildBody({ messages: turns(15) }).messages).toHaveLength(15);
    expect(buildBody({ messages: [...turns(15).slice(0, 14), bot("b"), user("последно")] }).messages).toHaveLength(16);
    expect(invalid({ messages: turns(17) })).toMatchObject({ code: "invalid" });
  });

  it("requires the first and the last message to be from the user", () => {
    expect(invalid({ messages: [bot("здравейте"), user("x")] })).toMatchObject({ code: "invalid" });
    expect(invalid({ messages: [user("x"), bot("y")] })).toMatchObject({ code: "invalid" });
    expect(invalid({ messages: [{ role: "system", text: "x" }] })).toMatchObject({ code: "invalid" });
    expect(invalid({ messages: [bot("само отговор")], caseId: "c1" })).toMatchObject({ code: "invalid" });
  });

  it("rejects empty, missing or malformed messages", () => {
    for (const messages of [undefined, null, [], "x", [null], [{ role: "user" }], [{ role: "user", text: 5 }], [user("   ")], [user("")]]) {
      expect(invalid({ messages })).toMatchObject({ code: "invalid" });
    }
    expect(invalid(undefined)).toMatchObject({ code: "invalid" });
  });

  it("limits the text to 8000 characters per message", () => {
    expect(LIMITS.textChars).toBe(8000);
    expect(buildBody({ messages: [user("я".repeat(8000))] }).messages[0].text).toHaveLength(8000);
    expect(invalid({ messages: [user("я".repeat(8001))] })).toMatchObject({ code: "invalid" });
    expect(invalid({ messages: [user("a"), bot("я".repeat(8001)), user("b")] })).toMatchObject({ code: "invalid" });
  });

  it("allows files only on the last message", () => {
    expect(invalid({ messages: [user("снимка", [img()]), bot("виждам"), user("а сега?")] })).toMatchObject({ code: "invalid" });
    const body = buildBody({ messages: [user("по-рано", []), bot("да"), user("виж", [img()])] });
    expect(body.messages[0]).toEqual({ role: "user", text: "по-рано" });
    expect(body.messages[2].files).toEqual([img()]);
    // A message with files may have an empty text.
    expect(buildBody({ messages: [user("", [img()])] }).messages[0].files).toHaveLength(1);
  });

  it("accepts only jpeg, png, webp and pdf", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
      expect(buildBody({ messages: [user("x", [img({ mime })])] }).messages[0].files[0].mime).toBe(mime);
    }
    for (const mime of ["image/gif", "image/svg+xml", "text/html", "application/zip", "application/msword", "video/mp4", "", undefined]) {
      expect(invalid({ messages: [user("x", [img({ mime })])] })).toMatchObject({ code: "invalid" });
    }
  });

  it("limits the count to 3 files, plus at most one voice note", () => {
    expect(LIMITS.files).toBe(3);
    expect(buildBody({ messages: [user("x", [img(), img(), img()])] }).messages[0].files).toHaveLength(3);
    expect(invalid({ messages: [user("x", [img(), img(), img(), img()])] })).toMatchObject({ code: "invalid" });
    const voice = { mime: "audio/webm;codecs=opus", data: B64 };
    const body = buildBody({ messages: [user("(гласово съобщение)", [img(), img(), img(), voice])] });
    expect(body.messages[0].files).toHaveLength(4);
    expect(body.messages[0].files[3]).toEqual({ name: "", mime: "audio/webm", data: B64 }); // codec parameter removed for the server
    expect(invalid({ messages: [user("x", [voice, voice])] })).toMatchObject({ code: "invalid" });
    expect(invalid({ messages: [user("x", [{ mime: "audio/midi", data: B64 }])] })).toMatchObject({ code: "invalid" });
  });

  it("limits the total base64 size to 3.8 MB", () => {
    expect(LIMITS.base64Chars).toBe(Math.floor(3.8 * 1024 * 1024));
    const half = "A".repeat(LIMITS.base64Chars / 2 - 2);
    expect(buildBody({ messages: [user("x", [img({ data: half }), img({ data: half })])] }).messages[0].files).toHaveLength(2);
    expect(invalid({ messages: [user("x", [img({ data: half }), img({ data: half }), img({ data: "AAAAAAAA" })])] })).toMatchObject({ code: "invalid" });
  });

  it("rejects missing or non-base64 file data and malformed file lists", () => {
    for (const data of ["", undefined, 5, "not base64!", "data:image/png;base64,AAAA"]) {
      expect(invalid({ messages: [user("x", [img({ data })])] })).toMatchObject({ code: "invalid" });
    }
    expect(invalid({ messages: [user("x", "file")] })).toMatchObject({ code: "invalid" });
    expect(invalid({ messages: [user("x", [null])] })).toMatchObject({ code: "invalid" });
  });

  it("rejects over-long or non-string model, mode and case ids", () => {
    expect(invalid({ messages: [user("x")], caseId: "c".repeat(65) })).toMatchObject({ code: "invalid" });
    expect(invalid({ messages: [user("x")], mode: "m".repeat(33) })).toMatchObject({ code: "invalid" });
    expect(invalid({ messages: [user("x")], model: 7 })).toMatchObject({ code: "invalid" });
  });

  it("does not forward unknown fields of a message", () => {
    const body = buildBody({ messages: [{ role: "user", text: "x", id: "m1", html: "<b>x</b>", files: [{ ...img(), path: "C:/secret" }] }] });
    expect(body.messages[0]).toEqual({ role: "user", text: "x", files: [img()] });
  });
});

describe("normalize", () => {
  const full = {
    ok: true, text: "Готово.\n\nИзточници:\n• Сайт – https://example.com", transcript: "какво имам утре",
    actions: ["calendar.list", "clients.create", "email.send ✗", "интернет: цени на имоти в шумен", "отворено: Моята поща"],
    staff: true, listings: [{ id: 1, code: "X-1", title: "Апартамент" }], video: { mode: "walk" }, ui: { panel: "mail" },
    email: { draft_saved: true, to: { email: "a@b.bg", name: "А" }, subject: "Тема", can_send: true },
    mode: "secretary", model: "gemini-2.5-flash", model_name: "Gemini Flash", fallback: "Лимитът на X е изчерпан – отговори Y",
  };

  it("maps every field of a full reply", () => {
    const r = normalize(full, 1234);
    expect(r).toMatchObject({
      ok: true, text: full.text, transcript: "какво имам утре", mode: "secretary", model: "gemini-2.5-flash",
      modelName: "Gemini Flash", fallback: full.fallback, email: full.email, listings: full.listings, video: { mode: "walk" },
      uiPanel: "mail", durationMs: 1234,
    });
    expect(Object.keys(r).sort()).toEqual(["actions", "durationMs", "email", "fallback", "listings", "mode", "model", "modelName", "ok", "text", "transcript", "uiPanel", "video"]);
    expect(r.staff).toBeUndefined();
  });

  it("parses actions: tools vs info, the ✗ failure mark and the mutating rule", () => {
    expect(normalize(full, 1).actions).toEqual([
      { raw: "calendar.list", kind: "tool", tool: "calendar.list", label: "Преглед на календара", ok: true, mutating: false },
      { raw: "clients.create", kind: "tool", tool: "clients.create", label: "Нов клиент", ok: true, mutating: true },
      { raw: "email.send ✗", kind: "tool", tool: "email.send", label: "Изпращане на имейл", ok: false, mutating: true },
      { raw: "интернет: цени на имоти в шумен", kind: "info", label: "интернет: цени на имоти в шумен", ok: true, mutating: false },
      { raw: "отворено: Моята поща", kind: "info", label: "отворено: Моята поща", ok: true, mutating: false },
    ]);
  });

  it("treats a dotted string that is not in the manifest as info", () => {
    const [a, b, c] = normalize({ actions: ["страница: imoti.bg/obiava-1", "unknown.tool", "send_inquiry"] }, 1).actions;
    expect(a).toMatchObject({ kind: "info", ok: true, mutating: false });
    expect(a.tool).toBeUndefined();
    expect(b).toMatchObject({ kind: "info", label: "unknown.tool" });
    expect(c).toMatchObject({ kind: "info" });
  });

  it("uses the live manifest names when given (array or Set)", () => {
    const names = ["brand.new_tool", "clients.search"];
    for (const manifest of [names, new Set(names)]) {
      const [a, b] = normalize({ actions: ["brand.new_tool", "calendar.list"] }, 1, manifest).actions;
      expect(a).toEqual({ raw: "brand.new_tool", kind: "tool", tool: "brand.new_tool", label: "brand.new_tool", ok: true, mutating: true });
      expect(b.kind).toBe("info"); // not in this manifest
    }
  });

  it("marks the server steps that save collected listings as mutating", () => {
    const acts = normalize({ actions: ["събиране: olx.bg/ad", "обяви от собственици: Шумен", "listings.find_owners", "listings.collect_page"] }, 1).actions;
    expect(acts.map((a) => a.mutating)).toEqual([true, true, true, true]);
    expect(acts.map((a) => a.kind)).toEqual(["info", "info", "tool", "tool"]);
  });

  it("follows the read-name rule for the mutating flag", () => {
    const flag = (name) => normalize({ actions: [name] }, 1).actions[0].mutating;
    for (const read of ["clients.search", "clients.get", "calendar.list", "calc.mortgage", "documents.find", "documents.inspect", "properties.match", "rates.live", "reports.summary", "audit.recent", "email.preview", "documents.download_link", "units.list", "tour.get_authorized_asset"]) {
      expect(flag(read), read).toBe(false);
    }
    for (const write of ["clients.update", "clients.delete", "clients.add_note", "properties.set_status", "calendar.create", "deals.update", "documents.merge", "email.send", "memory.remember", "memory.forget", "cases.create", "rentals.mark_paid", "contracts.generate", "video.create", "units.set_status", "projects.publish"]) {
      expect(flag(write), write).toBe(true);
    }
  });

  it("fills safe defaults for a minimal or malformed reply", () => {
    for (const json of [{ ok: true, text: "Здравейте" }, { ok: true, text: "Здравейте", transcript: null, actions: null, ui: null, email: null, listings: null, video: null }]) {
      expect(normalize(json, 5)).toEqual({
        ok: true, text: "Здравейте", transcript: null, actions: [], mode: null, model: null, modelName: null, fallback: null,
        email: null, listings: null, video: null, uiPanel: null, durationMs: 5,
      });
    }
    const odd = normalize({ text: 5, transcript: "", actions: "x", ui: { panel: "evil" }, email: "x", listings: {}, video: "x", mode: 3 }, undefined);
    expect(odd).toMatchObject({ text: "", transcript: "", actions: [], uiPanel: null, email: null, listings: null, video: null, mode: null, durationMs: 0 });
    expect(normalize(null, 1).text).toBe("");
  });

  it("keeps an empty transcript (voice message that was not understood) distinct from no transcript", () => {
    expect(normalize({ text: "Не успях да чуя", transcript: "" }, 1).transcript).toBe("");
    expect(normalize({ text: "x" }, 1).transcript).toBeNull();
  });

  it.each(["upload", "collect", "mail", "video"])("passes the ui panel %s", (panel) => {
    expect(normalize({ ui: { panel } }, 1).uiPanel).toBe(panel);
  });
});

describe("chat", () => {
  const ok = { ok: true, text: "Утре имате 2 огледа.", actions: ["calendar.list"], mode: "secretary", model: "m1", model_name: "Модел 1" };
  // Routes the lazy manifest GET separately from the chat POST.
  const session = (onChat, manifest = () => reply(200, { tools: [{ name: "calendar.list" }, { name: "fresh.tool" }] })) =>
    fakeSession((opts) => (opts.method === "POST" ? onChat(opts) : manifest(opts)));
  const chats = (s) => s.calls.filter((c) => c.method === "POST");
  const args = (over = {}) => ({ requestId: "r1", messages: [user("какво имам утре?")], ...over });

  it("POSTs the validated body with Bearer handled by the session and a 115 s timeout", async () => {
    const s = session(() => reply(200, ok));
    const out = await createAssistant({ session: s }).chat(args({ model: "m1", mode: "secretary" }));
    expect(out).toMatchObject({ ok: true, text: ok.text, mode: "secretary", model: "m1", modelName: "Модел 1" });
    expect(out.durationMs).toBeGreaterThanOrEqual(0);
    expect(chats(s)).toHaveLength(1);
    expect(chats(s)[0]).toMatchObject({
      url: SITE + "/api/assistant", method: "POST", timeoutMs: 115000,
      json: { messages: [{ role: "user", text: "какво имам утре?" }], page: "Тед за Windows", model: "m1", mode: "secretary" },
    });
    expect(chats(s)[0].signal).toBeInstanceOf(AbortSignal);
  });

  it("invalid input -> code invalid, maybeExecuted false, zero network calls", async () => {
    const s = session(() => reply(200, ok));
    const a = createAssistant({ session: s });
    for (const bad of [undefined, {}, args({ requestId: "" }), args({ requestId: 5 }), args({ messages: [] }), args({ messages: [bot("x")] }),
      args({ messages: [user("x", [img({ mime: "image/gif" })])] }), args({ messages: [user("я".repeat(8001))] })]) {
      const out = await a.chat(bad);
      expect(out).toMatchObject({ ok: false, code: "invalid", maybeExecuted: false });
      expect(typeof out.error).toBe("string");
    }
    expect(s.calls).toHaveLength(0);
  });

  it("quota -> code quota with the server text, no retry, outcome flagged as unknown", async () => {
    const text = "Безплатният лимит на Gemini за момента е изчерпан – презарежда се автоматично. Опитайте отново след минута.";
    const s = session(() => reply(200, { ok: false, quota: true, error: text }));
    const out = await createAssistant({ session: s }).chat(args());
    expect(out).toEqual({ ok: false, error: text, code: "quota", status: 200, maybeExecuted: true });
    expect(chats(s)).toHaveLength(1);
  });

  it.each([500, 502, 504])("HTTP %i -> code http, maybeExecuted true, exactly one request", async (status) => {
    const s = session(() => reply(status, status === 504 ? null : { ok: false, error: "AI асистентът не отговори: x" }));
    const out = await createAssistant({ session: s }).chat(args());
    expect(out).toMatchObject({ ok: false, code: "http", status, maybeExecuted: true });
    expect(out.error).toBe(status === 504 ? "Сървърът върна грешка (HTTP 504)." : "AI асистентът не отговори: x");
    expect(chats(s)).toHaveLength(1);
  });

  it("timeout -> code timeout, maybeExecuted true, never retried", async () => {
    const s = session(() => { throw httpError("timeout", true); });
    const out = await createAssistant({ session: s }).chat(args());
    expect(out).toMatchObject({ ok: false, code: "timeout", maybeExecuted: true });
    expect(out.error).toMatch(/CRM/);
    expect(chats(s)).toHaveLength(1);
  });

  it("network error after sending -> maybeExecuted true; before sending -> false; never retried", async () => {
    const after = session(() => { throw httpError("network", true); });
    expect(await createAssistant({ session: after }).chat(args())).toMatchObject({ ok: false, code: "network", maybeExecuted: true });
    expect(chats(after)).toHaveLength(1);
    const before = session(() => { throw httpError("network", false); });
    expect(await createAssistant({ session: before }).chat(args())).toMatchObject({ ok: false, code: "network", maybeExecuted: false });
    expect(chats(before)).toHaveLength(1);
  });

  it("4xx replies were rejected before execution: maybeExecuted false", async () => {
    const s = session(() => reply(400, { ok: false, error: "Празно съобщение" }));
    expect(await createAssistant({ session: s }).chat(args())).toEqual({ ok: false, error: "Празно съобщение", code: "http", status: 400, maybeExecuted: false });
    const big = session(() => reply(413, null));
    expect(await createAssistant({ session: big }).chat(args())).toMatchObject({ code: "http", status: 413, maybeExecuted: false });
  });

  it("401 after the session's own refresh-retry -> code auth", async () => {
    const s = session(() => reply(401, { ok: false, error: "Тед Асистент работи само в CRM – влезте в профила си." }));
    expect(await createAssistant({ session: s }).chat(args())).toEqual({ ok: false, error: "Сесията е изтекла – влезте отново.", code: "auth", status: 401, maybeExecuted: false });
    const out = session(() => { throw httpError("auth", false); });
    expect(await createAssistant({ session: out }).chat(args())).toMatchObject({ ok: false, code: "auth", maybeExecuted: false });
  });

  it("a 200 without ok:true is an error, never a fake success", async () => {
    const s = session(() => reply(200, { ok: false, error: "нещо се обърка" }));
    expect(await createAssistant({ session: s }).chat(args())).toMatchObject({ ok: false, code: "http", error: "нещо се обърка", maybeExecuted: true });
    const html = session(() => reply(200, null));
    expect(await createAssistant({ session: html }).chat(args())).toMatchObject({ ok: false, code: "http", maybeExecuted: true });
  });

  it("cancel aborts the waiting request: code aborted, maybeExecuted true, no retry", async () => {
    const s = session((opts) => new Promise((_, reject) => {
      opts.signal.addEventListener("abort", () => reject(httpError("aborted", true)));
    }));
    const a = createAssistant({ session: s });
    const pending = a.chat(args({ requestId: "stop-me" }));
    await new Promise((r) => setTimeout(r, 10));
    expect(a.cancel("other")).toEqual({ ok: true }); // unknown ids are harmless
    expect(a.cancel("stop-me")).toEqual({ ok: true });
    const out = await pending;
    expect(out).toMatchObject({ ok: false, code: "aborted", maybeExecuted: true });
    expect(out.error).toMatch(/CRM/);
    expect(chats(s)).toHaveLength(1);
    expect(a.cancel("stop-me")).toEqual({ ok: true }); // already finished
  });

  it("refuses a second request with an id that is still running", async () => {
    const gate = deferred();
    const s = session(async () => { await gate.promise; return reply(200, ok); });
    const a = createAssistant({ session: s });
    const first = a.chat(args({ requestId: "same" }));
    await new Promise((r) => setTimeout(r, 5));
    expect(await a.chat(args({ requestId: "same" }))).toMatchObject({ ok: false, code: "invalid", maybeExecuted: false });
    gate.resolve();
    expect((await first).ok).toBe(true);
    expect(chats(s)).toHaveLength(1);
    // The id is free again afterwards.
    expect((await a.chat(args({ requestId: "same" }))).ok).toBe(true);
  });

  it("uses the live manifest for action kinds once loaded and falls back to the built-in names", async () => {
    const live = session(() => reply(200, { ok: true, text: "x", actions: ["fresh.tool", "calendar.list"] }));
    const a = createAssistant({ session: live });
    await a.chat(args({ requestId: "warm-up" })); // the manifest GET resolves alongside the first chat
    await new Promise((r) => setTimeout(r, 5));
    const out = await a.chat(args({ requestId: "second" }));
    expect(out.actions.map((x) => x.kind)).toEqual(["tool", "tool"]);
    expect(live.calls.filter((c) => c.method !== "POST")).toHaveLength(1); // loaded once

    const offline = session(() => reply(200, { ok: true, text: "x", actions: ["fresh.tool", "calendar.list"] }), () => { throw httpError("network", false); });
    const b = createAssistant({ session: offline });
    expect((await b.chat(args())).actions.map((x) => x.kind)).toEqual(["info", "tool"]);
  });
});

describe("models", () => {
  it("returns the sanitized catalog", async () => {
    const s = fakeSession(() => reply(200, {
      ok: true, n8n: "https://n8n.example/webhook",
      models: [{ id: "g1", name: "Gemini", note: "бърз", provider: "gemini", vision: true, pdf: 1, secret: "x" }, { name: "без id" }, null],
      modes: [{ id: "lawyer", name: "Юрист", prompt: "…" }],
    }));
    const out = await createAssistant({ session: s }).models();
    expect(out).toEqual({
      ok: true,
      models: [{ id: "g1", name: "Gemini", note: "бърз", provider: "gemini", vision: true, pdf: true }],
      modes: [{ id: "lawyer", name: "Юрист" }],
    });
    expect(s.calls[0]).toMatchObject({ url: SITE + "/api/assistant", method: "POST", json: { action: "models" } });
  });

  it("maps failures to {ok:false, error, code}", async () => {
    const a = (handler) => createAssistant({ session: fakeSession(handler) }).models();
    expect(await a(() => reply(401, { ok: false, error: "влезте" }))).toEqual({ ok: false, error: "Сесията е изтекла – влезте отново.", code: "auth" });
    expect(await a(() => reply(500, { ok: false, error: "Няма настроен ключ за AI" }))).toEqual({ ok: false, error: "Няма настроен ключ за AI", code: "http" });
    expect(await a(() => { throw httpError("network", false); })).toEqual({ ok: false, error: "Няма връзка със сървъра.", code: "network" });
    expect(await a(() => { throw httpError("timeout"); })).toEqual({ ok: false, error: "Сървърът не отговори навреме.", code: "timeout" });
    expect(await a(() => reply(200, { ok: true }))).toMatchObject({ ok: false, code: "http" });
  });
});
