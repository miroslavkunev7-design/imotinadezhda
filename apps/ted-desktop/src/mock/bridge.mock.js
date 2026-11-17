// Mock implementation of the whole window.ted contract (docs/CONTRACT.md §2) for the browser dev
// server and the Playwright tests ONLY (vite --mode mock / vite build --mode mock). Every value in
// this file is fictional test data. Production builds never contain it (see src/bridge.js).
//
// URL options: ?lat=<ms> chat latency · ?signedIn=1 · ?remembered=0 · ?rg=1 (Real GPT connected)
//              ?rgPlan=0 (plan not granted) · ?revoked=0 (sign-out revocation not confirmed)
//              ?rgFail=<code> (the first ordinary Real GPT sign-in fails with that code)
//              ?rgOutFail=1 (Real GPT sign-out cannot remove the saved tokens: code "storage")
// Test hooks:  window.__tedMock = {calls, setConfirm(bool), setEmailOutcome("sent"|"setup"|"unknown"), expire()}
// Magic phrases in a chat message: "квота" -> quota error · "имейл" -> e-mail preview card ·
//   "справка" -> all steps succeeded · "неуспех" -> all steps failed · "сървърна грешка" -> HTTP 502 ·
//   "дълъг" -> a long answer (TTS chunking). Real GPT: "лимит" -> usage_limit · "повторен вход" -> reauth.

const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
const num = (v, d) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
const OPT = {
  lat: num(params.get("lat"), 900),
  signedIn: params.get("signedIn") === "1",
  remembered: params.get("remembered") !== "0",
  rgConnected: params.get("rg") === "1",
  rgPlan: params.get("rgPlan") !== "0",
  revoked: params.get("revoked") !== "0",
  rgStep: num(params.get("rgStep"), 70),
  rgFail: params.get("rgFail") || "",
  rgOutFail: params.get("rgOutFail") === "1",
};

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const clone = (v) => JSON.parse(JSON.stringify(v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Fictional fixtures ----------
const USER = { id: "test-user-1", name: "Тест Служител", email: "sluzhitel@example.test", phoneMasked: "" };
const MODELS = [
  { id: "test-model-a", name: "Тестов модел А", note: "измислен модел за проверка", provider: "gemini", vision: true, pdf: true },
  { id: "test-model-b", name: "Тестов модел Б", note: "измислен · само текст", provider: "openai", vision: false, pdf: false },
];
const MODES = [
  { id: "lawyer", name: "Юрист" }, { id: "secretary", name: "Секретар" }, { id: "senior", name: "Старши брокер" },
  { id: "analyst", name: "Анализатор" }, { id: "sales", name: "Търговец" }, { id: "opener", name: "Започни разговор" }, { id: "inquiry", name: "Запитване" },
];
const CASES = [
  { id: "case-test-1", title: "Тестов казус · продажба", client: "Тестов Клиент А", status: "open", updated_at: iso(1), summary: "Измислен казус за проверка на интерфейса." },
  { id: "case-test-2", title: "Тестов казус · наем", client: "Тестов Клиент Б", status: "open", updated_at: iso(3), summary: "" },
];
const CASE_DETAIL = {
  "case-test-1": {
    facts: ["Тестов факт: клиентът търси двустаен с южно изложение."],
    messages: [
      { role: "user", at: iso(1), text: "Тестово съобщение от служител по казуса." },
      { role: "assistant", at: iso(1), text: "Тестов отговор на Тед по казуса (измислен)." },
    ],
  },
};
const PROPS = [
  { id: "prop-test-1", code: "ТЕСТ-101", title: "Измислен двустаен апартамент", city: "Тестоград", hood: "Център", price: 99000, area: 65, rooms: 2, deal: "sale", status: "активен" },
  { id: "prop-test-2", code: "ТЕСТ-102", title: "Измислена къща с двор", city: "Тестоград", hood: "Лозята", price: 185000, area: 140, rooms: 4, deal: "sale", status: "активен" },
  { id: "prop-test-3", code: "ТЕСТ-201", title: "Измислено студио под наем", city: "Примерово", hood: "Морска", price: 450, area: 38, rooms: 1, deal: "rent", status: "активен" },
];
const DOCS = [
  { id: "doc-test-1", name: "тестов-договор.pdf", client: "Тестов Клиент А", folder: "Договори", at: iso(2) },
  { id: "doc-test-2", name: "тестова-скица.pdf", client: "Тестов Клиент Б", folder: "Скици", at: iso(5) },
];
const MEMORY = [
  { id: "mem-test-1", kind: "fact", role: "user", at: iso(2), text: "Тестов факт: предпочитам кратки отговори." },
  { id: "mem-test-2", kind: "message", role: "assistant", at: iso(4), text: "Тестов запис от разговор за двустаен апартамент." },
];
const RG_MODELS = [{ slug: "test-gpt-a", displayName: "Тест GPT А" }, { slug: "test-gpt-b", displayName: "Тест GPT Б" }];
const READ_ONLY = new Set(["clients.search", "clients.get", "properties.search", "properties.match", "calendar.list", "deals.list", "companies.search",
  "brokers.list", "documents.list", "documents.find", "documents.download_link", "calc.mortgage", "calc.commission", "calc.yield",
  "rates.live", "reports.summary", "memory.search", "cases.list", "cases.get", "inquiries.list", "rentals.list", "collected.list"]);

const step = (tool, label, ok, mutating = false) => ({ raw: tool + (ok ? "" : " ✗"), kind: "tool", tool, label, ok, mutating });

// A tiny valid WAV (8 kHz, 8-bit mono silence).
function wav(ms = 80) {
  const rate = 8000; const n = Math.round((rate * ms) / 1000);
  const buf = new ArrayBuffer(44 + n); const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return buf;
}

// Same checks as MAIN (electron/backend/assistant.js buildBody) so the renderer cannot rely on looser rules here.
function chatInvalid(messages) {
  if (!Array.isArray(messages) || !messages.length) return "Няма съобщение.";
  if (messages.length > 16) return "Твърде много съобщения в историята (най-много 16).";
  if (messages[0].role !== "user") return "Първото съобщение трябва да е от служителя.";
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.text !== "string") return "Невалидно съобщение.";
    if (m.text.length > 8000) return "Съобщението е над 8000 знака.";
    if (m.files && (i !== messages.length - 1 || m.files.length > 3)) return "Файловете са само на последното съобщение (до 3).";
    for (const f of m.files || []) if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.mime)) return "Неподдържан тип файл.";
  }
  if (messages[messages.length - 1].role !== "user") return "Последното съобщение трябва да е от служителя.";
  return null;
}

const LONG = Array.from({ length: 14 }, (_, i) => `Изречение ${i + 1} от дългия тестов отговор, който проверява четенето на части и не съдържа реални данни.`).join(" ") +
  "\n\n" + Array.from({ length: 14 }, (_, i) => `Второ изречение ${i + 1}: още измислен текст за проверка на разделянето на гласа на части до деветстотин знака.`).join(" ");

export function createMockBridge() {
  let signedIn = OPT.signedIn;
  let settings = {};
  let chats = [];
  let rg = OPT.rgConnected ? { connected: true, email: "chatgpt.test@example.test", planEnabled: OPT.rgPlan } : { connected: false };
  let confirmAnswer = true;
  let emailOutcome = "sent";
  let caseSeq = 2;
  let memSeq = 2;
  const authSubs = new Set();
  const deltaSubs = new Set();
  const pending = new Map(); // requestId -> abort()
  const calls = { chat: [], confirmSend: 0, tts: [], transcribe: 0, openExternal: [], copy: [], saveFile: [], rgSend: [], rgSignIn: [], casesCreate: [], remember: [], forget: [], read: [] };

  const authState = () => (signedIn ? { status: "signedIn", user: { ...USER }, remembered: OPT.remembered } : { status: "signedOut" });
  const emitAuth = () => { const s = authState(); authSubs.forEach((cb) => cb(s)); };
  const sub = (set, cb) => { if (typeof cb !== "function") return () => {}; set.add(cb); return () => set.delete(cb); };

  // Resolves true when cancelled through api.cancel / realgpt.cancel / realgpt.cancelSignIn.
  function delay(ms, id) {
    return new Promise((resolve) => {
      const t = setTimeout(() => { if (id) pending.delete(id); resolve(false); }, ms);
      if (id) pending.set(id, () => { clearTimeout(t); pending.delete(id); resolve(true); });
    });
  }
  const abort = (id) => { const f = pending.get(id); if (f) f(); return { ok: true }; };

  const result = (text, extra = {}) => ({
    ok: true, text, transcript: null, actions: [], mode: null, model: null, modelName: null, fallback: null,
    email: null, listings: null, video: null, uiPanel: null, durationMs: 0, ...extra,
  });

  async function chat(args) {
    const a = args || {};
    const messages = Array.isArray(a.messages) ? a.messages : [];
    const last = messages.length ? String(messages[messages.length - 1].text || "") : "";
    calls.chat.push({ count: messages.length, model: a.model, mode: a.mode, caseId: a.caseId, last, maxLen: Math.max(0, ...messages.map((m) => String((m && m.text) || "").length)) });
    const bad = chatInvalid(messages);
    if (bad) return { ok: false, error: bad, code: "invalid", maybeExecuted: false };
    const t0 = Date.now();
    if (await delay(OPT.lat, a.requestId)) return { ok: false, error: "Изчакването на отговора е спряно.", code: "aborted", maybeExecuted: true };
    const model = MODELS.find((m) => m.id === a.model) || MODELS[0];
    const base = { mode: a.mode || "analyst", model: model.id, modelName: model.name, durationMs: Date.now() - t0 };
    const low = last.toLowerCase();
    const inCase = a.caseId ? `\n\n_(Казус ${a.caseId} – тестов отговор)_` : "";

    if (low.includes("квота")) return { ok: false, error: "Лимитът на тестовия модел е изчерпан за момента. Опитайте по-късно или изберете друг модел.", code: "quota", maybeExecuted: true };
    if (low.includes("сървърна грешка")) return { ok: false, error: "Сървърът върна грешка (HTTP 502).", code: "http", status: 502, maybeExecuted: true };
    if (low.includes("имейл")) {
      return result("Подготвих тестова чернова на имейл до клиента. Да я изпратя ли?" + inCase, {
        ...base,
        actions: [step("clients.search", "Търсене на клиент", true), step("email.preview", "Чернова на имейл", true)],
        email: {
          to: { name: "Тестов Клиент А", email: "klient-a@example.test" },
          subject: "Тестова оферта за ТЕСТ-101",
          body: "Здравейте,\n\nТова е измислен тестов имейл без реални данни.\n\nПоздрави,\nТест Служител",
          attachments: [{ name: "тестова-оферта.pdf", pages: 2, size_kb: 180 }],
          property: { code: "ТЕСТ-101", title: "Измислен двустаен апартамент" },
          can_send: true, from: "agent@example.test", sender: "agency", reply_to: "office@example.test",
        },
      });
    }
    if (low.includes("неуспех")) {
      return result("Не успях да намеря данните – и двете търсения върнаха грешка (тест)." + inCase, {
        ...base, actions: [step("properties.search", "Търсене на имот", false), step("clients.search", "Търсене на клиент", false)],
      });
    }
    if (low.includes("справка")) {
      return result("**Тестова справка** (измислени числа)\n\n- Активни имоти: 3\n- Огледи тази седмица: 2" + inCase, {
        ...base, actions: [step("reports.summary", "Справка", true), step("calc.mortgage", "Ипотечна сметка", true)],
      });
    }
    if (low.includes("дълъг")) return result(LONG + inCase, { ...base, actions: [] });
    return result(
      "**Тестов отговор** (измислени данни)\n\nНамерих 2 имота и записах оглед в календара. Документът не беше намерен.\n\n" +
      "| Код | Имот | Цена |\n|---|---|---|\n| ТЕСТ-101 | Измислен двустаен | 99 000 € |\n| ТЕСТ-102 | Измислена къща | 185 000 € |" + inCase,
      {
        ...base,
        actions: [
          step("properties.search", "Търсене на имот", true),
          step("calendar.create", "Ново събитие", true, true),
          step("documents.find", "Търсене на документ", false),
        ],
      },
    );
  }

  async function read(tool, input) {
    const i = input && typeof input === "object" ? input : {};
    calls.read.push(tool);
    if (!READ_ONLY.has(tool)) return { ok: false, error: "Този инструмент не е разрешен за четене от програмата.", code: "forbidden" };
    await sleep(120);
    if (tool === "cases.list") return { ok: true, result: { cases: clone(CASES.filter((c) => !i.status || c.status === i.status)) } };
    if (tool === "cases.get") {
      const kase = CASES.find((c) => c.id === i.id);
      if (!kase) return { ok: false, error: "Казусът не е намерен.", status: 404 };
      const d = CASE_DETAIL[kase.id] || { facts: [], messages: [] };
      return { ok: true, result: clone({ kase, facts: d.facts, messages: d.messages }) };
    }
    if (tool === "memory.search") {
      const words = String(i.query || "").toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      return { ok: true, result: { items: clone(MEMORY.filter((m) => words.some((w) => m.text.toLowerCase().includes(w)))) } };
    }
    if (tool === "properties.search") {
      const t = String(i.text || "").toLowerCase();
      const list = PROPS.filter((p) => (!t || (p.title + " " + p.code).toLowerCase().includes(t)) && (!i.city || p.city === i.city) && (!i.deal || p.deal === i.deal) && (!i.max_price || p.price <= i.max_price));
      return { ok: true, result: { properties: clone(list) } };
    }
    if (tool === "documents.list") return { ok: true, result: { documents: clone(DOCS) } };
    return { ok: true, result: {} };
  }

  async function rgSend(a) {
    const args = a || {};
    const messages = Array.isArray(args.messages) ? args.messages : [];
    const last = messages.length ? String(messages[messages.length - 1].text || "") : "";
    calls.rgSend.push({ count: messages.length, model: args.model, effort: args.effort, instructions: args.instructions, roles: messages.map((m) => m.role), last });
    if (!rg.connected) return { ok: false, error: "Real GPT не е свързан.", code: "not_connected" };
    if (rg.planEnabled === false) return { ok: false, error: "Използването на ChatGPT плана не е разрешено.", code: "plan_disabled" };
    if (/лимит/i.test(last)) {
      await delay(200, args.requestId);
      return { ok: false, error: "Достигнат е лимитът на вашия ChatGPT план. Опитайте по-късно.", code: "usage_limit" };
    }
    if (/повторен вход/i.test(last)) return { ok: false, error: "Входът с ChatGPT е изтекъл – влезте отново.", code: "reauth" };
    const full = "Това е тестов отговор от Real GPT, изпратен на части. В този режим няма достъп до CRM, казусите и паметта на Тед. Данните са измислени.";
    const parts = full.match(/\S+\s*/g) || [full];
    let text = "";
    for (let k = 0; k < parts.length; k += 3) {
      if (await delay(OPT.rgStep, args.requestId)) return { ok: false, error: "Спряно от вас.", code: "aborted", ...(text ? { text } : {}) };
      const delta = parts.slice(k, k + 3).join("");
      text += delta;
      deltaSubs.forEach((cb) => cb({ requestId: args.requestId, delta, text }));
    }
    return { ok: true, text, model: args.model };
  }

  const bridge = {
    app: {
      info: async () => ({ version: "0.1.0-mock", platform: "win32", packaged: false }),
      setCompact: async () => ({ ok: true }),
      getLaunchAtLogin: async () => ({ enabled: false }),
      setLaunchAtLogin: async (on) => ({ ok: true, enabled: !!on }),
      openLogs: async () => ({ ok: true }),
      openExternal: async (url) => {
        calls.openExternal.push(String(url));
        return /^(https:\/\/|mailto:)/i.test(String(url)) ? { ok: true } : { ok: false, error: "Адресът не е разрешен." };
      },
      copy: async (text) => { calls.copy.push(String(text)); return { ok: true }; },
      saveFile: async (args) => {
        const a = args || {};
        calls.saveFile.push(a.suggestedName);
        if (typeof a.text !== "string" && typeof a.base64 !== "string") return { ok: false, error: "Няма съдържание за запис.", code: "invalid" };
        return { ok: true, path: "C:\\Users\\Test\\Documents\\" + (a.suggestedName || "ted.txt") };
      },
    },
    auth: {
      state: async () => authState(),
      login: async (args) => {
        const a = args || {};
        await sleep(250);
        if (!String(a.identifier || "").trim() || !a.password) return { ok: false, error: "Въведете телефон или имейл и парола.", code: "invalid" };
        if (a.password !== "test") return { ok: false, error: "Грешен телефон/имейл или парола.", code: "auth", status: 401 };
        signedIn = true;
        emitAuth();
        return { ok: true, user: { ...USER } };
      },
      logout: async () => { signedIn = false; emitAuth(); return { ok: true }; },
      onChange: (cb) => sub(authSubs, cb),
    },
    api: {
      models: async () => { await sleep(80); return { ok: true, models: clone(MODELS), modes: clone(MODES) }; },
      chat,
      cancel: async (requestId) => abort(requestId),
    },
    crm: { read },
    cases: {
      create: async (args) => {
        const a = args || {};
        calls.casesCreate.push(a);
        if (!String(a.title || "").trim()) return { ok: false, error: "Въведете заглавие на казуса (до 160 знака)." };
        await sleep(150);
        const id = "case-test-" + ++caseSeq;
        CASES.unshift({ id, title: a.title.trim(), client: a.clientName || "", status: "open", updated_at: new Date().toISOString(), summary: "" });
        return { ok: true, result: { id, title: a.title.trim() } };
      },
    },
    memory: {
      remember: async (args) => {
        const a = args || {};
        calls.remember.push(a);
        const id = "mem-test-" + ++memSeq;
        MEMORY.unshift({ id, kind: "fact", role: "user", at: new Date().toISOString(), text: String(a.text || ""), ...(a.caseId ? { case_id: a.caseId } : {}) });
        return { ok: true, result: { id, saved: true } };
      },
      forget: async (args) => {
        const a = args || {};
        calls.forget.push(a);
        if (!confirmAnswer) return { ok: false, canceled: true };
        const k = MEMORY.findIndex((m) => m.id === a.id);
        if (k >= 0) MEMORY.splice(k, 1);
        return { ok: true };
      },
    },
    email: {
      // Stands in for the native confirmation dialog in MAIN plus the email.send tool call.
      confirmSend: async (args) => {
        const a = args || {};
        calls.confirmSend += 1;
        await sleep(150);
        if (!confirmAnswer) return { ok: false, canceled: true };
        const to = a.to && typeof a.to === "object" ? a.to : { email: String(a.to || "") };
        if (emailOutcome === "setup") return { ok: true, result: { sent: false, need_setup: true, reason: "Няма настроена поща за изпращане (тест).", mailto: "mailto:" + (to.email || "") } };
        if (emailOutcome === "unknown") return { ok: false, error: "Не е ясно дали имейлът е изпратен (тест). Проверете, преди да опитате отново.", maybeExecuted: true };
        return { ok: true, result: { sent: true, to: to.email, to_name: to.name || "", from: "agent@example.test", via: "тестова поща", subject: a.subject || "", attachments: a.attachments || [] } };
      },
    },
    voice: {
      tts: async (args) => {
        const text = String((args && args.text) || "");
        calls.tts.push(text.length);
        if (!text || text.length > 1200) return { ok: false, error: "Текстът за четене е празен или над 1200 знака.", code: "invalid" };
        await sleep(40);
        return { ok: true, wav: wav() };
      },
      transcribe: async () => { calls.transcribe += 1; await sleep(120); return { ok: true, text: "Тестова диктовка" }; },
    },
    store: {
      getSettings: async () => clone(settings),
      setSettings: async (patch) => { settings = { ...settings, ...(patch || {}) }; return clone(settings); },
      loadChats: async () => ({ chats: clone(chats) }),
      saveChats: async (list) => { chats = clone(list || []); return { ok: true }; },
      clearLocal: async () => { if (!confirmAnswer) return { ok: false, canceled: true }; chats = []; return { ok: true }; },
    },
    realgpt: {
      status: async () => ({ ...rg }),
      signIn: async (opts) => {
        const newAccount = !!(opts && opts.newAccount === true);
        calls.rgSignIn.push({ newAccount });
        if (await delay(600, "rg-signin")) return { ok: false, error: "Входът е отказан.", code: "cancelled" };
        // ?rgFail=<code>: the first ordinary sign-in fails with that code (e.g. account_mismatch).
        if (OPT.rgFail && !newAccount && calls.rgSignIn.length === 1) return { ok: false, error: "Входът с ChatGPT не беше завършен (тест).", code: OPT.rgFail };
        rg = { connected: true, email: newAccount ? "drug.akaunt@example.test" : "chatgpt.test@example.test", planEnabled: OPT.rgPlan };
        return { ok: true, status: { ...rg } };
      },
      cancelSignIn: async () => abort("rg-signin"),
      signOut: async () => {
        if (OPT.rgOutFail) return { ok: false, error: "Защитеното хранилище на Windows не е достъпно (тест)", code: "storage", revoked: false };
        rg = { connected: false }; return { ok: true, revoked: OPT.revoked };
      },
      models: async () => {
        if (!rg.connected) return { ok: false, error: "Real GPT не е свързан.", code: "not_connected" };
        if (rg.planEnabled === false) return { ok: false, error: "Използването на ChatGPT плана не е разрешено.", code: "plan_disabled" };
        return { ok: true, models: clone(RG_MODELS) };
      },
      send: rgSend,
      cancel: async (requestId) => abort(requestId),
      onDelta: (cb) => sub(deltaSubs, cb),
    },
  };

  window.__tedMock = {
    calls,
    setConfirm: (v) => { confirmAnswer = !!v; },
    setEmailOutcome: (v) => { emailOutcome = v; },
    expire: () => { signedIn = false; emitAuth(); },
  };
  return bridge;
}
