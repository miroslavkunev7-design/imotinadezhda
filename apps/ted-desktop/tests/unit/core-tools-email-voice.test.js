import { describe, it, expect } from "vitest";
import { createTools, READ_ONLY, isMutating } from "../../electron/backend/tools.js";
import { createEmail } from "../../electron/backend/email.js";
import { createVoice } from "../../electron/backend/voice.js";
import { KNOWN_TOOLS, TOOL_LABELS, toolLabel } from "../../electron/backend/labels.js";
import { SITE } from "../../electron/backend/config.js";
import { fakeSession, reply, httpError } from "./core-helpers.js";

describe("tools allowlist", () => {
  it("READ_ONLY is exactly the contract list and every entry is a known, non-mutating tool", () => {
    expect(READ_ONLY).toEqual([
      "clients.search", "clients.get", "properties.search", "properties.match", "calendar.list", "deals.list", "companies.search",
      "brokers.list", "documents.list", "documents.find", "documents.download_link", "calc.mortgage", "calc.commission", "calc.yield",
      "rates.live", "reports.summary", "memory.search", "cases.list", "cases.get", "inquiries.list", "rentals.list", "collected.list",
    ]);
    for (const name of READ_ONLY) {
      expect(KNOWN_TOOLS, name).toContain(name);
      expect(isMutating(name), name).toBe(false);
    }
  });

  it("read() rejects every tool outside READ_ONLY before any network call", async () => {
    const s = fakeSession(() => reply(200, { ok: true, result: {} }));
    const tools = createTools({ session: s });
    const others = KNOWN_TOOLS.filter((n) => !READ_ONLY.includes(n));
    expect(KNOWN_TOOLS).toHaveLength(115);
    expect(others).toHaveLength(115 - READ_ONLY.length);
    for (const name of [...others, "email.send", "clients.delete", "memory.forget", "cases.create", "", "CLIENTS.SEARCH", "clients.search ", "constructor", "__proto__", null, undefined, 5, {}]) {
      const out = await tools.read(name, { confirm: true });
      expect(out, String(name)).toMatchObject({ ok: false, code: "forbidden" });
    }
    expect(s.calls).toHaveLength(0);
  });

  it("read() of an allowed tool posts exactly {tool, input}", async () => {
    const s = fakeSession(() => reply(200, { ok: true, result: { cases: [{ id: "c1", title: "Казус" }] } }));
    const out = await createTools({ session: s }).read("cases.list", { status: "open" });
    expect(out).toEqual({ ok: true, result: { cases: [{ id: "c1", title: "Казус" }] } });
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0]).toMatchObject({ url: SITE + "/api/tools", method: "POST", json: { tool: "cases.list", input: { status: "open" } } });
    expect(Object.keys(s.calls[0].json)).toEqual(["tool", "input"]);
  });

  it("call() defaults the input to {} and rejects malformed requests locally", async () => {
    const s = fakeSession(() => reply(200, { ok: true, result: 1 }));
    const tools = createTools({ session: s });
    await tools.call("brokers.list");
    expect(s.calls[0].json).toEqual({ tool: "brokers.list", input: {} });
    for (const [tool, input] of [["bad tool", {}], ["a/b", {}], ["x".repeat(65), {}], [5, {}], ["cases.list", []], ["cases.list", "x"], ["cases.list", { big: "я".repeat(300000) }]]) {
      expect(await tools.call(tool, input)).toMatchObject({ ok: false, code: "invalid", maybeExecuted: false });
    }
    expect(s.calls).toHaveLength(1);
  });

  it("maps server errors and never retries", async () => {
    const run = async (handler) => {
      const s = fakeSession(handler);
      const out = await createTools({ session: s }).call("cases.get", { id: "x" });
      expect(s.calls).toHaveLength(1);
      return out;
    };
    expect(await run(() => reply(404, { ok: false, error: "Няма казус x" }))).toEqual({ ok: false, error: "Няма казус x", status: 404, code: "http", maybeExecuted: false });
    expect(await run(() => reply(412, { ok: false, error: "Изпращането изисква потвърждение (confirm=true) след изрично „да“ от служителя" }))).toMatchObject({ status: 412, maybeExecuted: false });
    expect(await run(() => reply(403, { ok: false, error: "This account has no CRM access" }))).toMatchObject({ error: "Този профил няма достъп до CRM.", status: 403 });
    expect(await run(() => reply(404, { ok: false, error: "Unknown tool: x.y" }))).toMatchObject({ error: "Сървърът не познава този инструмент." });
    expect(await run(() => reply(400, { ok: false, error: "Invalid input" }))).toMatchObject({ error: "Невалидни данни за заявката. (Invalid input)" });
    // CONTRACT §2: any 5xx leaves the outcome unknown, even with the tool's own JSON error.
    expect(await run(() => reply(500, { ok: false, error: "duplicate key value" }))).toMatchObject({ error: "Грешка от сървъра (HTTP 500): duplicate key value", maybeExecuted: true });
    expect(await run(() => reply(502, { ok: false, error: "Имейлът не е изпратен от a@b.bg: Няма връзка със SMTP сървъра" }))).toMatchObject({ status: 502, code: "http", maybeExecuted: true });
    expect(await run(() => reply(401, { ok: false, error: "Invalid or expired token" }))).toEqual({ ok: false, error: "Сесията е изтекла – влезте отново.", status: 401, code: "auth", maybeExecuted: false });
    // No JSON verdict from the tool (gateway timeout page): the outcome is unknown.
    expect(await run(() => reply(504, null))).toMatchObject({ ok: false, status: 504, code: "http", maybeExecuted: true });
    expect(await run(() => { throw httpError("timeout", true); })).toMatchObject({ ok: false, code: "timeout", maybeExecuted: true });
    expect(await run(() => { throw httpError("network", false); })).toMatchObject({ ok: false, code: "network", maybeExecuted: false });
    expect(await run(() => { throw httpError("auth", false); })).toMatchObject({ ok: false, code: "auth", maybeExecuted: false });
  });
});

describe("labels", () => {
  it("has a Bulgarian label for every known tool and falls back to the raw name", () => {
    for (const [name, label] of Object.entries(TOOL_LABELS)) {
      expect(label, name).toMatch(/[А-Яа-я]/);
      expect(name).toMatch(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)?$/);
    }
    expect(toolLabel("clients.search")).toBe("Търсене на клиенти");
    expect(toolLabel("email.preview")).toBe("Чернова на имейл");
    expect(toolLabel("calendar.create")).toBe("Ново събитие");
    expect(toolLabel("brand.new")).toBe("brand.new");
    expect(toolLabel("constructor")).toBe("constructor");
  });
});

describe("email.confirmSend", () => {
  const card = { to: { email: "kalina@example.com", name: "Калина" }, subject: "Документи за имота", attachments: [{ name: "Скица.pdf", pages: 2 }, { name: "Нотариален акт.pdf" }] };
  const sent = { sent: true, from: "broker@example.com", to: "kalina@example.com", to_name: "Калина", subject: "Документи за имота", attachments: ["Скица.pdf"], via: "вашата поща" };
  const setup = ({ answer = true, handler = () => reply(200, { ok: true, result: sent }) } = {}) => {
    const s = fakeSession(handler);
    const dialogs = [];
    const confirm = async (message, detail, opts) => { dialogs.push({ message, detail, opts }); return answer; };
    return { s, dialogs, email: createEmail({ tools: createTools({ session: s }), confirm }) };
  };

  it("cancel in the native dialog -> {canceled:true} and zero network calls", async () => {
    const { s, dialogs, email } = setup({ answer: false });
    expect(await email.confirmSend(card)).toEqual({ ok: false, canceled: true });
    expect(dialogs).toHaveLength(1);
    expect(s.calls).toHaveLength(0);
  });

  it("OK -> exactly one POST {tool:'email.send', input:{confirm:true}}", async () => {
    const { s, dialogs, email } = setup();
    expect(await email.confirmSend(card)).toEqual({ ok: true, result: sent });
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].url).toBe(SITE + "/api/tools");
    expect(s.calls[0].method).toBe("POST");
    expect(s.calls[0].json).toEqual({ tool: "email.send", input: { confirm: true } });
    // The dialog shows who gets what, in Bulgarian, with explicit buttons.
    expect(dialogs[0].message).toBe("Изпращане на имейл");
    expect(dialogs[0].detail).toContain("Калина <kalina@example.com>");
    expect(dialogs[0].detail).toContain("„Документи за имота“");
    expect(dialogs[0].detail).toContain("Прикачени файлове (2): Скица.pdf, Нотариален акт.pdf");
    expect(dialogs[0].detail).toContain("последната подготвена чернова");
    expect(dialogs[0].opts).toEqual({ okLabel: "Изпрати", cancelLabel: "Отказ" });
  });

  it("nothing the renderer passes can change what is sent", async () => {
    const { s, email } = setup();
    await email.confirmSend({ ...card, to_email: "evil@example.com", body: "x", confirm: false, input: { to_email: "evil@example.com" }, tool: "clients.delete" });
    expect(s.calls[0].json).toEqual({ tool: "email.send", input: { confirm: true } });
  });

  it("passes a need_setup result through as a real (not sent) result", async () => {
    const result = { sent: false, need_setup: true, reason: "Няма поща за изпращане.", mailto: "mailto:kalina%40example.com?subject=x" };
    const { email } = setup({ handler: () => reply(200, { ok: true, result }) });
    expect(await email.confirmSend(card)).toEqual({ ok: true, result });
  });

  it("reports a server refusal honestly, without retrying", async () => {
    const { s, email } = setup({ handler: () => reply(400, { ok: false, error: "Няма подготвен имейл – първо email.preview." }) });
    expect(await email.confirmSend(card)).toEqual({ ok: false, error: "Имейлът не е изпратен: Няма подготвен имейл – първо email.preview.", code: "http", maybeExecuted: false });
    expect(s.calls).toHaveLength(1);
  });

  it("treats a 5xx JSON error (e.g. SMTP timeout after DATA) as an unknown outcome, showing the server text", async () => {
    const smtp = setup({ handler: () => reply(502, { ok: false, error: "Имейлът не е изпратен от broker@example.com: Няма връзка със SMTP сървъра" }) });
    const out = await smtp.email.confirmSend(card);
    expect(out).toMatchObject({ ok: false, code: "http", maybeExecuted: true });
    expect(out.error).toMatch(/^Не е ясно дали имейлът е изпратен: сървърът върна грешка \(HTTP 502\)/);
    expect(out.error).toContain("Няма връзка със SMTP сървъра");
    expect(smtp.s.calls).toHaveLength(1);
  });

  it("says the outcome is unknown when the connection drops after sending", async () => {
    const { s, email } = setup({ handler: () => { throw httpError("timeout", true); } });
    const out = await email.confirmSend(card);
    expect(out).toMatchObject({ ok: false, code: "timeout", maybeExecuted: true });
    expect(out.error).toMatch(/Не е ясно дали имейлът е изпратен/);
    expect(s.calls).toHaveLength(1);
  });

  it("blocks a double click while a send is in progress and needs a recipient", async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const s = fakeSession(() => reply(200, { ok: true, result: sent }));
    const email = createEmail({ tools: createTools({ session: s }), confirm: async () => { await gate; return true; } });
    const first = email.confirmSend(card);
    expect(await email.confirmSend(card)).toMatchObject({ ok: false });
    release();
    expect((await first).ok).toBe(true);
    expect(s.calls).toHaveLength(1);
    expect(await email.confirmSend({ subject: "x" })).toMatchObject({ ok: false });
    expect(await email.confirmSend(undefined)).toMatchObject({ ok: false });
    expect(s.calls).toHaveLength(1);
  });
});

describe("voice", () => {
  const wavBytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]).buffer;
  const audio = () => reply(200, undefined, { headers: { "content-type": "audio/wav" }, buffer: wavBytes });

  it("tts posts {text, voice, style} and returns the wav as an ArrayBuffer", async () => {
    const s = fakeSession(audio);
    const out = await createVoice({ session: s }).tts({ text: "  Здравейте,\n аз съм Тед.  ", voice: "Charon", style: "calm" });
    expect(out.ok).toBe(true);
    expect(out.wav).toBeInstanceOf(ArrayBuffer);
    expect(out.wav.byteLength).toBe(8);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0]).toMatchObject({
      url: SITE + "/api/voice?fn=tts", method: "POST", as: "arrayBuffer",
      json: { text: "Здравейте, аз съм Тед.", voice: "Charon", style: "calm" },
    });
  });

  it("tts validates locally: empty, over 1200 characters, unknown voice or style", async () => {
    const s = fakeSession(audio);
    const voice = createVoice({ session: s });
    for (const args of [undefined, {}, { text: "   " }, { text: 5 }, { text: "я".repeat(1201) }, { text: "x", voice: "Robot" }, { text: "x", style: "angry" }]) {
      expect(await voice.tts(args)).toMatchObject({ ok: false, code: "invalid" });
    }
    expect(s.calls).toHaveLength(0);
    expect((await voice.tts({ text: "я".repeat(1200) })).ok).toBe(true);
  });

  it("tts maps server errors and a non-audio reply", async () => {
    const tts = (handler) => createVoice({ session: fakeSession(handler) }).tts({ text: "x" });
    expect(await tts(() => reply(502, { ok: false, error: "Гласът не е наличен: лимит" }))).toEqual({ ok: false, error: "Гласът не е наличен: лимит", code: "http", status: 502 });
    // api/_tts.js reports an exhausted Gemini TTS quota as HTTP 502 "…: лимитът е изчерпан…" (never 429): same code as transcribe.
    expect(await tts(() => reply(502, { ok: false, error: "Гласът не е наличен: gemini-tts: лимитът е изчерпан за днес | gemini-tts-2: лимитът е изчерпан" })))
      .toMatchObject({ ok: false, code: "quota", status: 502, error: /^Гласът не е наличен: gemini-tts: лимитът е изчерпан за днес/ });
    expect(await tts(() => reply(502, { ok: false, error: "Гласът не е наличен: gemini-tts: HTTP 500" }))).toMatchObject({ ok: false, code: "http", status: 502 });
    expect(await tts(() => reply(429, { ok: false, error: "Твърде много заявки." }))).toMatchObject({ ok: false, code: "quota", status: 429 });
    expect(await tts(() => reply(401, { ok: false, error: "Само за CRM" }))).toMatchObject({ ok: false, code: "auth" });
    expect(await tts(() => reply(200, { ok: true }, { headers: { "content-type": "application/json" } }))).toMatchObject({ ok: false, code: "http" });
    expect(await tts(() => { throw httpError("timeout"); })).toEqual({ ok: false, error: "Сървърът не отговори навреме.", code: "timeout" });
    expect(await tts(() => { throw httpError("network", false); })).toEqual({ ok: false, error: "Няма връзка със сървъра.", code: "network" });
  });

  it("transcribe posts {mime, data} and returns the text", async () => {
    const s = fakeSession(() => reply(200, { ok: true, text: "Обади се на клиента утре в 10." }));
    const out = await createVoice({ session: s }).transcribe({ mime: "audio/webm;codecs=opus", data: "AAAA" });
    expect(out).toEqual({ ok: true, text: "Обади се на клиента утре в 10." });
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0]).toMatchObject({ url: SITE + "/api/voice?fn=transcribe", method: "POST", json: { mime: "audio/webm", data: "AAAA" } });
    expect(Object.keys(s.calls[0].json)).toEqual(["mime", "data"]);
  });

  it("transcribe validates locally and maps the quota error", async () => {
    const s = fakeSession(() => reply(429, { ok: false, error: "Лимитът на Gemini за разпознаване е изчерпан – опитайте след минута." }));
    const voice = createVoice({ session: s });
    for (const args of [undefined, {}, { mime: "video/webm", data: "AAAA" }, { mime: "audio/webm", data: "" }, { mime: "audio/webm", data: "не е base64" }, { mime: "audio/webm" }]) {
      expect(await voice.transcribe(args)).toMatchObject({ ok: false, code: "invalid" });
    }
    expect(s.calls).toHaveLength(0);
    expect(await voice.transcribe({ mime: "audio/webm", data: "AAAA" })).toEqual({
      ok: false, error: "Лимитът на Gemini за разпознаване е изчерпан – опитайте след минута.", code: "quota", status: 429,
    });
    expect(s.calls).toHaveLength(1);
  });
});
