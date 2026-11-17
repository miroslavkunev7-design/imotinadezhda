// Mock implementation of the whole window.ted contract (docs/CONTRACT.md §2 and §8) for the browser dev
// server and the Playwright tests ONLY (vite --mode mock / vite build --mode mock). Every value in
// this file is fictional test data. Production builds never contain it (see src/bridge.js). No network.
//
// URL options: ?lat=<ms> chat latency · ?signedIn=1 · ?remembered=0 · ?rg=1 (Real GPT connected)
//              ?rgPlan=0 (plan not granted) · ?revoked=0 (sign-out revocation not confirmed)
//              ?rgFail=<code> (the first ordinary Real GPT sign-in fails with that code)
//              ?rgOutFail=1 (Real GPT sign-out cannot remove the saved tokens: code "storage")
// 0.1.3 (§17): ?consent=all|text|none (default none = not asked yet) · ?agent=1 (scripted agent answers)
//              ?agentFail=tools_unsupported|limit · ?upd=disabled|none|available|downloading|ready|error
//              ?lib=1 (3 library items) · ?sched=1 (2 tasks, one missed) · ?video=ok|noengine|fail · ?browse=0
//              ?agentStep=<ms> (pause between agent steps, default 160) · ?chats=<n> (n saved chats „Чат номер 1…n“,
//              chat 1 the OLDEST by last activity but created last – checks the order of „Вижте всички…“)
// Test hooks:  window.__tedMock = {calls, setConfirm(bool), setEmailOutcome("sent"|"setup"|"unknown"), expire(),
//              setUpd(status), fireDue(id, missed), job(id), files()}
// Magic phrases in a chat message: "квота" -> quota error · "имейл" -> e-mail preview card ·
//   "справка" -> all steps succeeded · "неуспех" -> all steps failed · "сървърна грешка" -> HTTP 502 ·
//   "дълъг" -> a long answer (TTS chunking). Real GPT: "лимит" -> usage_limit · "повторен вход" -> reauth.
// Scripted agent (?agent=1, consent "all"): "видео"/"клип" or the video hint -> „Отвори в ChatGPT“ card (kind video) ·
//   "снимк"/"изображение" or the image hint -> „Отвори в ChatGPT“ card (kind image) – Real GPT makes no picture or
//   video itself (§9.6) · "обяв" -> internet listings (0.1.5, below) · "договор"/"canvas" -> Canvas
//   version with an SVG chart · "имейл" -> e-mail draft card · attached files -> read_document + reworked .docx ·
//   0.1.5: "обяв" -> a ChatGPT-style listings table with real links and inline photos (`images` events) ·
//   "изтегли" -> fetch_image FileCards + the same photos inline · "чужда" -> a picture NOT from a tool result (chip) ·
//   anything else -> web_search → read_page → CRM properties.search → create_document + approval calendar.create.

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
  consent: ["all", "text"].includes(params.get("consent")) ? params.get("consent") : null,
  agent: params.get("agent") === "1",
  agentFail: params.get("agentFail") || "",
  agentStep: num(params.get("agentStep"), 160),
  upd: ["disabled", "none", "available", "downloading", "ready", "error"].includes(params.get("upd")) ? params.get("upd") : "disabled",
  lib: params.get("lib") === "1",
  sched: params.get("sched") === "1",
  video: ["ok", "noengine", "fail"].includes(params.get("video")) ? params.get("video") : "ok",
  browse: params.get("browse") !== "0",
  chats: Math.max(0, Math.min(200, num(params.get("chats"), 0))),
  // 0.1.5 speed checks: two saved chats „Дълъг чат А/Б“ with <n> question/answer pairs each (Markdown answers).
  long: Math.max(0, Math.min(400, num(params.get("long"), 0))),
};

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const clone = (v) => JSON.parse(JSON.stringify(v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MB = 1048576;

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
const EMAIL_DRAFT = {
  to: { name: "Тестов Клиент А", email: "klient-a@example.test" },
  subject: "Тестова оферта за ТЕСТ-101",
  body: "Здравейте,\n\nТова е измислен тестов имейл без реални данни.\n\nПоздрави,\nТест Служител",
  attachments: [{ name: "тестова-оферта.pdf", pages: 2, size_kb: 180 }],
  property: { code: "ТЕСТ-101", title: "Измислен двустаен апартамент" },
  can_send: true, from: "agent@example.test", sender: "agency", reply_to: "office@example.test",
};
// Video engines as /api/video {action:"engines"} lists them (fictional prices for the mock only).
const VIDEO_ENGINES = [
  { id: "kling", name: "Kling (тест)", note: "тестов двигател, 3–15 сек", price: 0.17, frames: 2, durs: [5, 10] },
  { id: "veo", name: "Veo (тест)", note: "тестов двигател, 4/6/8 сек", price: 0.1, frames: 2, durs: [4, 6, 8] },
];
const NO_ENGINE = "На сървъра няма настроен ключ за AI видео (Vercel AI Gateway, Gemini или OpenAI). Видео не може да се направи, докато администраторът не добави ключ.";
const FEW_PHOTOS = "Видео само от текст не може да се направи: двигателите правят клип между реални снимки. Прикачете поне 2 снимки (или 1 снимка с описание) – или първо направете AI снимка, после клип от нея.";

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

// ---------- Fictional file bytes (made in the browser, never fetched) ----------
const enc = (s) => new TextEncoder().encode(s);
const b64ToBytes = (b64) => { const bin = atob(String(b64)); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const bytesToB64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
function drawTest(label, w, h) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const g = cv.getContext("2d");
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#850F2D"); gr.addColorStop(1, "#370714");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = "#D8B46A"; g.fillRect(16, h - 40, w - 32, 4);
  g.font = "700 " + Math.round(h / 9) + "px sans-serif"; g.fillStyle = "#fff0cf"; g.fillText(label, Math.round(w / 18), Math.round(h / 5));
  return cv;
}
const pngBytes = (label, w = 320, h = 200) => b64ToBytes(drawTest(label, w, h).toDataURL("image/png").split(",")[1]);
// MAIN makes a ≤ 24 KB JPEG thumbnail with nativeImage; the mock draws a small one the same way.
const thumbOf = (label) => drawTest(label, 128, 80).toDataURL("image/jpeg", 0.7);
const PDF_MIN = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
const zipLike = (marker) => enc("PK\u0003\u0004 тестов файл " + marker);
// A short real WebM clip (canvas + MediaRecorder) so the stitching code runs for real in the tests.
async function clipBytes(label, color, ms = 600) {
  try {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
    const cv = document.createElement("canvas"); cv.width = 320; cv.height = 180;
    const g = cv.getContext("2d");
    const mime = ["video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const rec = new MediaRecorder(cv.captureStream(20), mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: "video/webm" })); });
    const t0 = performance.now();
    const draw = () => { const t = (performance.now() - t0) / ms; g.fillStyle = color; g.fillRect(0, 0, 320, 180); g.fillStyle = "#ffe1a7"; g.fillRect(Math.min(290, t * 290), 90, 24, 24); g.font = "700 20px sans-serif"; g.fillText(label, 12, 30); };
    draw(); rec.start(100);
    const iv = setInterval(draw, 40);
    await sleep(ms);
    clearInterval(iv); rec.stop();
    const blob = await done;
    return new Uint8Array(await blob.arrayBuffer());
  } catch { return null; }
}

// Kind and mime from the bytes and the name (the same idea as electron/files.js sniffKind).
function sniff(name, mime, b) {
  const ext = (/\.([a-z0-9]{1,8})$/i.exec(String(name || "")) || [])[1];
  const e = ext ? ext.toLowerCase() : "";
  const s = (i, n) => String.fromCharCode.apply(null, Array.from(b.subarray(i, i + n)));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", mime: "image/jpeg" };
  if (b[0] === 0x89 && s(1, 3) === "PNG") return { kind: "image", mime: "image/png" };
  if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return { kind: "image", mime: "image/webp" };
  if (s(0, 3) === "GIF") return { kind: "image", mime: "image/gif" };
  if (s(0, 5) === "%PDF-") return { kind: "pdf", mime: "application/pdf" };
  if (s(4, 4) === "ftyp") return { kind: "video", mime: "video/mp4" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "video", mime: "video/webm" };
  if (s(0, 4) === "PK\u0003\u0004") {
    if (e === "docx") return { kind: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    if (e === "xlsx") return { kind: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    return { kind: "other", mime: "application/zip" };
  }
  if (e === "csv") return { kind: "csv", mime: "text/csv" };
  if (["txt", "md", "json", "html", "htm"].includes(e)) return { kind: "text", mime: e === "md" ? "text/markdown" : e === "json" ? "application/json" : e.startsWith("htm") ? "text/html" : "text/plain" };
  if (["doc", "xls"].includes(e)) return { kind: "other", mime: "application/msword", note: "стар формат – запазете като .docx/.xlsx" };
  return { kind: "other", mime: /^[\w.+-]+\/[\w.+-]+$/.test(String(mime || "")) ? String(mime) : "application/octet-stream" };
}
const RUNNABLE = /\.(exe|msi|msp|bat|cmd|com|scr|pif|cpl|msc|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|lnk|url|reg|inf|jar|dll|sys)$/i;

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

// 0.1.5: the realistic Real GPT listings answer of the mock (fictional data on example.test only).
const LISTINGS_ANSWER = "Намерих 2 тестови обяви за двустаен в Тестоград (измислени данни) и една, която не се отвори.\n\n" +
  "| № | Обява | Цена | Населено място | Разстояние | Телефон | Източник |\n" +
  "|---:|---|---:|---|---|---|:---:|\n" +
  "| 1 | [Тестов двустаен апартамент, Център](https://example.test/obiava-101) | 99 000 € | Тестоград, Център | неуточнено | +359 00 000 0001 | [example.test](https://example.test/obiava-101) |\n" +
  "| 2 | [Тестов двустаен с тераса](https://example.test/obiava-102?ref=test&id=102) | 87 500 € | Тестоград, Изток | 3 км | скрит | [example.test](https://example.test/obiava-102?ref=test&id=102) |\n\n" +
  "### Снимки\n\n**1. Тестов двустаен апартамент, Център**\n\n" +
  "![Обява 101 – снимка 1](https://example.test/img/obiava-101-1.png) ![Обява 101 – снимка 2](https://example.test/img/obiava-101-2.png) ![Обява 101 – снимка 3](https://example.test/img/obiava-101-3.png)\n\n" +
  "**2. Тестов двустаен с тераса**\n\n" +
  "![Обява 102 – снимка 1](https://example.test/img/obiava-102-1.png) ![Обява 102 – снимка 2](https://example.test/img/obiava-102-2.png)\n\n" +
  "### Недостъпни\n\n- Тестова обява 103 – страницата върна грешка 404.\n\n" +
  "**Следващи стъпки:**\n1. Мога да проверя кои обяви са от собственици.\n2. Мога да запиша избраните в CRM (с вашето разрешение).\n\n" +
  "Търсене: https://example.test/tarsene/dvustaen-testograd?sort=price&page=1&filter=nov-stroitelstvo-tuhla-etazh-2-5-nov-stroitelstvo-tuhla-etazh-2-5-nov-stroitelstvo-tuhla-etazh-2-5-nov-stroitelstvo-tuhla-etazh-2-5-nov-stroitelstvo-tuhla-etazh-2-5-nov-stroitelstvo-tuhla-etazh-2-5-end\n\n*Данните от интернет са непроверени.*";

const CANVAS_TEXT = "# Тестов договор за наем\n\n**Наемодател:** Тестов Клиент А  \n**Наемател:** Тестов Клиент Б\n\n" +
  "1. Предмет: измислен двустаен апартамент ТЕСТ-101, гр. Тестоград.\n2. Наем: 450 € месечно.\n3. Срок: 12 месеца.\n\n" +
  "```svg\n<svg viewBox=\"0 0 240 120\"><script>alert(1)</script><rect x=\"20\" y=\"40\" width=\"60\" height=\"60\" fill=\"#850F2D\" onclick=\"alert(2)\"/>" +
  "<rect x=\"100\" y=\"20\" width=\"60\" height=\"80\" fill=\"#D8B46A\"/><image href=\"https://example.test/x.png\" width=\"10\" height=\"10\"/>" +
  "<text x=\"20\" y=\"115\" font-size=\"12\">Тестова графика</text></svg>\n```\n\n*Тестова чернова – не е реален договор.*";

export function createMockBridge() {
  let signedIn = OPT.signedIn;
  // ?eng=rg: the settings saved by an earlier run chose Real GPT (start with that engine and its first model).
  let settings = { ...(OPT.browse ? {} : { browse: { enabled: false, robots: true, blocked: [] } }), ...(params.get("eng") === "rg" ? { engine: "realgpt", rgModel: RG_MODELS[0].slug } : {}) };
  // ?chats=n: fictional saved chats. Created newest-first (array order) while chat 1 is the least recently active.
  let chats = Array.from({ length: OPT.chats }, (_, k) => {
    const n = OPT.chats - k;
    return { id: "c_test" + String(n).padStart(4, "0"), title: "Чат номер " + n, caseId: null, updatedAt: Date.now() - (OPT.chats - n + 1) * 3600000 * (n <= 2 ? 100 : 1),
      archived: false, pinned: false, temporary: false, messages: [{ id: "m_t" + n, role: "user", text: "Тестов въпрос " + n, time: Date.now() - 86400000 }] };
  });
  // ?long=n: two long chats (the newest activity), every answer with a heading, a list and a table (speed checks).
  const longAnswer = (k) => "### Тестов отговор " + k + "\n\nИзмислени данни за проверка на скоростта на дълъг чат.\n\n" +
    "1. Първа точка с **удебелен** текст и [линк](https://example.test/obiava-" + k + ")\n2. Втора точка\n3. Трета точка\n\n" +
    "| Код | Имот | Цена |\n|---|---|---:|\n| ТЕСТ-" + k + " | Измислен двустаен | 99 000 € |\n| ТЕСТ-" + (k + 1) + " | Измислена къща | 185 000 € |";
  const longChat = (tag, base) => {
    const messages = [];
    for (let k = 1; k <= OPT.long; k++) {
      messages.push({ id: "m_l" + tag + "u" + k, role: "user", text: "Тестов въпрос " + k + " в дълъг чат " + tag, time: base + k * 2000 });
      messages.push({ id: "m_l" + tag + "a" + k, role: "assistant", engine: "server", text: longAnswer(k), time: base + k * 2000 + 1000, actions: [] });
    }
    return { id: "c_long" + tag, title: "Дълъг чат " + tag, caseId: null, updatedAt: base + OPT.long * 2000 + 2000, archived: false, pinned: false, temporary: false, messages };
  };
  if (OPT.long) chats = [longChat("А", Date.now() - 3600000), longChat("Б", Date.now() - 7200000), ...chats];
  let rg = OPT.rgConnected ? { connected: true, email: "chatgpt.test@example.test", planEnabled: OPT.rgPlan } : { connected: false };
  const consentOf = { "chatgpt.test@example.test": OPT.consent }; // per ChatGPT account, like MAIN's secure store
  let confirmAnswer = true;
  let emailOutcome = "sent";
  let caseSeq = 2;
  let memSeq = 2;
  let seq = 0;
  const nid = (p) => p + (++seq).toString(36).padStart(4, "0") + Math.random().toString(36).slice(2, 8);
  const authSubs = new Set();
  const deltaSubs = new Set();
  const eventSubs = new Set();
  const videoSubs = new Set();
  const libSubs = new Set();
  const dueSubs = new Set();
  const updSubs = new Set();
  const pending = new Map(); // requestId -> abort()
  const approvals = new Map(); // approvalId -> {requestId, resolve}
  const emittedImages = new Set(); // picture addresses the mock agent emitted as `images` (MAIN's provenance)
  const calls = {
    chat: [], confirmSend: 0, tts: [], transcribe: 0, openExternal: [], openInChatGpt: [], browseImageClicked: [], copy: [], saveFile: [], rgSend: [], rgSignIn: [], casesCreate: [], remember: [], forget: [], read: [],
    consent: [], approve: [], filesAdd: [], projAssign: [], projAnswer: [], projZip: [], projCrm: [], filesRead: [], filesOpen: [], filesSave: [], filesExtract: [], filesForget: [], browseTest: [], browseImage: [],
    videoPrepare: [], videoStart: [], videoCancel: [], videoFinish: [], libRemove: [], libClear: 0, schedSave: [], schedRemove: [],
    updCheck: 0, updAuto: [], updDownload: 0, updInstall: 0, storage: 0, clearTemp: 0, reportProblem: 0,
    // Every call that MAIN would turn into a request to imotinadezhda.bg or its Supabase host (speed/load checks).
    site: [],
  };
  const site = (fn) => { calls.site.push({ fn, at: Date.now() }); };

  const authState = () => (signedIn ? { status: "signedIn", user: { ...USER }, remembered: OPT.remembered } : { status: "signedOut" });
  const emitAuth = () => { const s = authState(); authSubs.forEach((cb) => cb(s)); };
  const sub = (set, cb) => { if (typeof cb !== "function") return () => {}; set.add(cb); return () => set.delete(cb); };
  const emit = (set, v) => set.forEach((cb) => { try { cb(clone(v)); } catch { /* a listener error is the listener's */ } });

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

  /* ======================= files + library (§8.1, §8.6, §11) ======================= */
  const files = new Map(); // id -> {ref, bytes, temporary}
  const libChanged = () => libSubs.forEach((cb) => { try { cb(); } catch { /* listener */ } });
  function storeFile({ name, mime, bytes, chatId, caseId, caseTitle, temporary = false, origin = "user", savedTo, sourceUrl, pages, sheets, crm, thumb, maxBytes = 20 * MB }) {
    const fileName = String(name || "файл").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 180) || "файл";
    if (!bytes || !bytes.length) return { ok: false, code: "invalid", error: "Файлът е празен." };
    if (bytes.length > maxBytes) return { ok: false, code: "too_large", error: `Файлът „${fileName}“ е по-голям от ${Math.round(maxBytes / MB)} MB.` };
    if (RUNNABLE.test(fileName)) return { ok: false, code: "runnable", error: `„${fileName}“ е програма или скрипт – такива файлове не се приемат.` };
    const sn = sniff(fileName, mime, bytes);
    const ref = { id: nid("f_test"), name: fileName, mime: sn.mime, size: bytes.length, kind: sn.kind, origin, createdAt: new Date().toISOString() };
    if (chatId) ref.chatId = String(chatId).slice(0, 64);
    if (caseId && !temporary) { ref.caseId = String(caseId).slice(0, 64); if (caseTitle) ref.caseTitle = String(caseTitle).slice(0, 160); }
    if (sn.kind === "image" && thumb) ref.thumb = thumb;
    else if (sn.kind === "image" && bytes.length <= 24 * 1024 && /jpeg|png/.test(sn.mime)) ref.thumb = "data:" + sn.mime + ";base64," + bytesToB64(bytes);
    if (sn.kind === "pdf") ref.pages = pages || 1;
    if (sn.kind === "xlsx" && sheets) ref.sheets = sheets;
    if (savedTo) ref.savedTo = savedTo;
    if (sourceUrl) ref.sourceUrl = sourceUrl;
    if (crm) ref.crm = crm;
    if (sn.note) ref.note = sn.note;
    files.set(ref.id, { ref, bytes, temporary: !!temporary });
    if (!temporary) libChanged();
    return { ok: true, file: { ...ref } };
  }
  const isId = (id) => typeof id === "string" && /^[a-z0-9_-]{8,64}$/.test(id);
  if (OPT.lib) {
    storeFile({ name: "Тестова снимка.png", bytes: pngBytes("Тестова снимка"), thumb: thumbOf("Тестова снимка"), origin: "ted", savedTo: "папка „Тед“" });
    storeFile({ name: "Тестов договор.pdf", bytes: enc(PDF_MIN), origin: "ted", pages: 2 });
    storeFile({ name: "Тестова оферта.docx", bytes: zipLike("word/document.xml"), origin: "user" });
  }
  const libraryItems = () => [...files.values()].filter((x) => !x.temporary).map((x) => x.ref).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  function extractDoc(id) {
    const f = files.get(id);
    if (!f) return { ok: false, code: "not_found", error: "Файлът не е намерен." };
    const r = f.ref;
    if (r.kind === "text" || r.kind === "csv") {
      const text = new TextDecoder().decode(f.bytes).slice(0, 60000);
      return { ok: true, doc: { name: r.name, kind: r.kind, text, truncated: f.bytes.length > 60000, ...(r.kind === "csv" ? { sheets: [{ name: r.name, rows: text.split(/\r?\n/).filter(Boolean).slice(0, 2000).map((l) => l.split(/[;,]/)) }] } : {}) } };
    }
    if (r.kind === "docx") return { ok: true, doc: { name: r.name, kind: "docx", text: "Тестово съдържание на „" + r.name + "“: чл. 1 Предмет – измислен имот ТЕСТ-101.", truncated: false } };
    if (r.kind === "xlsx") return { ok: true, doc: { name: r.name, kind: "xlsx", sheets: [{ name: "Лист1", rows: [["Код", "Цена"], ["ТЕСТ-101", 99000]] }], text: "Код\tЦена\nТЕСТ-101\t99000", truncated: false } };
    if (r.kind === "pdf") return { ok: true, doc: { name: r.name, kind: "pdf", pages: r.pages || 1, text: "Тестов текст от PDF „" + r.name + "“.", truncated: false } };
    return { ok: false, code: "unsupported", error: "Този вид файл не може да се прочете." };
  }

  /* ======================= video (§8.5, §12) ======================= */
  const jobs = new Map();
  const publicJob = (j) => {
    const { timers: _t, ...rest } = j;
    return clone(rest);
  };
  const videoChanged = (j) => emit(videoSubs, publicJob(j));
  const estimate = (n, eng, d) => ({ n, sec: n * d, cost: Math.round(n * d * eng.price * 100) / 100, min: Math.max(2, Math.ceil(n / 3) * 2) });
  function videoPrepare({ code, fileIds, prompt } = {}) {
    calls.videoPrepare.push({ code: code || null, fileIds: fileIds || [], prompt: prompt || null });
    let source;
    let photos;
    if (code) {
      const p = PROPS.find((x) => x.code === String(code).trim().toUpperCase() || x.id === code);
      if (!p) return { ok: false, code: "not_found", error: "Обявата не е намерена (тест)." };
      source = { code: p.code, title: p.title, photos: 4 };
      photos = ["Фасада", "Хол", "Кухня", "Спалня"];
    } else {
      const imgs = (Array.isArray(fileIds) ? fileIds : []).map((id) => files.get(id)).filter((f) => f && f.ref.kind === "image");
      if (imgs.length < 2 && !(imgs.length === 1 && String(prompt || "").trim())) return { ok: false, code: "few_photos", error: FEW_PHOTOS };
      source = { title: "прикачени снимки", photos: imgs.length };
      photos = imgs.map((_, i) => "Снимка " + (i + 1));
    }
    const parts = photos.length >= 2
      ? photos.slice(0, -1).map((a, i) => ({ n: i + 1, title: `Част ${i + 1}: ${a} → ${photos[i + 1]}`, status: "idle" }))
      : [{ n: 1, title: "Част 1: клип от снимката", status: "idle" }];
    const id = nid("v_test");
    const job = { id, status: OPT.video === "noengine" ? "need_engine" : "approval", source, parts, aspect: "16:9" };
    if (OPT.video === "noengine") {
      job.engines = []; job.error = NO_ENGINE;
      jobs.set(id, job); videoChanged(job);
      return { ok: false, code: "no_engine", error: NO_ENGINE, job: publicJob(job) };
    }
    job.engines = clone(VIDEO_ENGINES); job.gateway = { ok: true, balance: 12.5 };
    job.defaults = { engine: "kling", duration: 5 };
    job.est = estimate(parts.length, VIDEO_ENGINES[0], 5);
    jobs.set(id, job); videoChanged(job);
    return { ok: true, job: publicJob(job) };
  }
  async function runParts(job) {
    const colors = ["#850F2D", "#5c0d1c", "#7a1023", "#430c16"];
    const queue = job.parts.filter((p) => p.status !== "done");
    const worker = async () => {
      while (queue.length) {
        if (job.status !== "running") return;
        const p = queue.shift();
        p.status = "run"; p.error = undefined; videoChanged(job);
        await sleep(250 + p.n * 60);
        if (job.status !== "running") { p.status = "idle"; videoChanged(job); return; }
        if (OPT.video === "fail" && p.n === job.parts.length) { p.status = "err"; p.error = "Двигателят върна грешка (тест)."; videoChanged(job); continue; }
        const bytes = (await clipBytes("Тест · част " + p.n, colors[p.n % colors.length])) || enc("\u001aE\u00df\u00a3 тестово видео");
        const r = storeFile({ name: p.title.replace(/[:→]/g, " ").replace(/\s+/g, " ").trim() + ".webm", bytes, origin: "crm", crm: { path: "ted/video/test/part-" + p.n + ".webm" }, maxBytes: 300 * MB });
        p.fileId = r.ok ? r.file.id : undefined;
        p.status = r.ok ? "done" : "err";
        if (!r.ok) p.error = r.error;
        videoChanged(job);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (job.status !== "running") return;
    const ok = job.parts.filter((p) => p.status === "done").length;
    if (ok === job.parts.length) { job.status = job.parts.length === 1 ? "done" : "stitch"; if (job.parts.length === 1) job.fileId = job.parts[0].fileId; }
    else { job.status = "failed"; job.error = `Готови ${ok} от ${job.parts.length} части; останалите не успяха след 3 опита.`; }
    videoChanged(job);
  }
  function videoStart({ jobId, engine, duration } = {}) {
    calls.videoStart.push({ jobId, engine, duration });
    const job = jobs.get(jobId);
    if (!job) return { ok: false, code: "not_found", error: "Задачата за видео не е намерена." };
    if (!["approval", "failed"].includes(job.status)) return { ok: false, code: "invalid", error: "Видеото вече е започнато." };
    const eng = (job.engines || []).find((e) => e.id === engine);
    if (!eng) return { ok: false, code: "invalid", error: "Изберете двигател от списъка." };
    if (!eng.durs.includes(Number(duration))) return { ok: false, code: "invalid", error: "Изберете дължина от списъка." };
    Object.assign(job, { engine: eng.id, duration: Number(duration), est: estimate(job.parts.length, eng, Number(duration)), status: "running", error: undefined });
    videoChanged(job);
    runParts(job);
    return { ok: true };
  }
  function videoCancel({ jobId } = {}) {
    calls.videoCancel.push(jobId);
    const job = jobs.get(jobId);
    if (job && job.status !== "done") { job.status = "cancelled"; videoChanged(job); }
    return { ok: true };
  }

  /* ======================= scheduled (§8.7, §13) ======================= */
  const REPEATS = ["none", "daily", "weekdays", "weekly", "monthly"];
  const tasks = [];
  if (OPT.sched) {
    const t1 = new Date(Date.now() + 86400000); t1.setHours(9, 0, 0, 0);
    tasks.push({ id: "task-test-1", title: "Тестово напомняне", kind: "reminder", text: "Обади се на тестовия клиент", engine: "server", at: t1.toISOString(), repeat: "daily", enabled: true, nextRun: t1.toISOString() });
    const t2 = new Date(Date.now() - 2 * 3600000);
    tasks.push({ id: "task-test-2", title: "Тестова седмична справка", kind: "prompt", text: "Направи тестова справка за седмицата", engine: "server", at: t2.toISOString(), repeat: "weekly", enabled: true, nextRun: t2.toISOString() });
  }
  let missedSent = false;
  function validTask(t) {
    if (!t || typeof t !== "object") return "Невалидна задача.";
    if (typeof t.title !== "string" || !t.title.trim() || t.title.length > 120) return "Заглавието е задължително (до 120 знака).";
    if (!["reminder", "prompt"].includes(t.kind)) return "Невалиден вид задача.";
    if (t.text != null && (typeof t.text !== "string" || t.text.length > 4000)) return "Текстът е над 4000 знака.";
    if (t.kind === "prompt" && !String(t.text || "").trim()) return "Напишете какво да направи Тед.";
    if (t.engine != null && !["server", "realgpt"].includes(t.engine)) return "Невалиден двигател.";
    if (Number.isNaN(Date.parse(t.at))) return "Невалидна дата.";
    if (!REPEATS.includes(t.repeat || "none")) return "Невалидно повтаряне.";
    return null;
  }

  /* ======================= updates (§8.8, §14) ======================= */
  const UPD_FROM = (status) => ({
    supported: status !== "disabled", version: "0.1.0-mock", status, auto: true,
    ...(status !== "disabled" && status !== "idle" ? { lastCheck: iso(0) } : {}),
    ...(["available", "downloading", "ready"].includes(status) ? { available: { version: "0.1.4-test", releaseDate: iso(1) } } : {}),
    ...(status === "downloading" ? { progress: { percent: 42, transferred: 42 * MB, total: 100 * MB } } : {}),
    ...(status === "error" ? { error: "Няма връзка с GitHub (тест)." } : {}),
  });
  let upd = UPD_FROM(OPT.upd);
  const setUpd = (u) => { upd = u; emit(updSubs, upd); };
  const mockDownload = () => {
    setUpd({ ...upd, status: "downloading", progress: { percent: 42, transferred: 42 * MB, total: 100 * MB } });
    setTimeout(() => { const { progress: _p, ...rest } = upd; setUpd({ ...rest, status: "ready" }); }, 400);
  };

  /* ======================= server chat (§2) ======================= */
  async function chat(args) {
    const a = args || {};
    const messages = Array.isArray(a.messages) ? a.messages : [];
    const last = messages.length ? String(messages[messages.length - 1].text || "") : "";
    site("api.chat");
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
        email: clone(EMAIL_DRAFT),
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
    if (READ_ONLY.has(tool)) site("crm.read " + tool);
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

  /* ======================= Real GPT (§2, §8.2, §8.3) ======================= */
  const consentNow = () => (rg.connected && rg.email ? (consentOf[rg.email] === "all" || consentOf[rg.email] === "text" ? consentOf[rg.email] : null) : null);

  // wait(ms) -> true when cancelled; the scripted agent passes its own (one abort for steps, approvals and text).
  async function streamText(full, requestId, wait = (ms) => delay(ms, requestId)) {
    const parts = full.match(/\S+\s*/g) || [full];
    let text = "";
    for (let k = 0; k < parts.length; k += 3) {
      if (await wait(OPT.rgStep)) return { aborted: true, text };
      const delta = parts.slice(k, k + 3).join("");
      text += delta;
      deltaSubs.forEach((cb) => cb({ requestId, delta, text }));
    }
    return { aborted: false, text };
  }

  // The scripted agent of ?agent=1 – the same events MAIN's loop emits (electron/agent/loop.js), fictional data.
  async function agentRun(args, last) {
    const rid = args.requestId;
    const low = last.toLowerCase();
    const steps = new Map();
    const made = [];
    const ctl = { aborted: false, wake: new Set() };
    pending.set(rid, () => { ctl.aborted = true; ctl.wake.forEach((f) => f()); ctl.wake.clear(); pending.delete(rid); });
    const pause = (ms = OPT.agentStep) => new Promise((res) => {
      if (ctl.aborted) { res(true); return; }
      const w = () => { clearTimeout(t); res(true); };
      const t = setTimeout(() => { ctl.wake.delete(w); res(false); }, ms);
      ctl.wake.add(w);
    });
    const ev = (e) => emit(eventSubs, { requestId: rid, ...e });
    const mkStep = (kind, label, extra = {}) => {
      const s = { id: "s" + (steps.size + 1), kind, label, status: "run", startedAt: new Date().toISOString(), ...extra };
      steps.set(s.id, s);
      ev({ type: "step", step: s });
      const set = (status, detail) => { s.status = status; if (detail) s.detail = detail; if (status !== "wait") s.endedAt = new Date().toISOString(); ev({ type: "step", step: s }); };
      return { id: s.id, ok: (d) => set("ok", d), fail: (d) => set("fail", d), wait: () => set("wait"), run: () => set("run"), denied: () => set("denied", "отказано") };
    };
    const addFile = (spec, st) => {
      // As MAIN: files Ted makes are filed with the asking chat (never kept for a temporary chat).
      // As MAIN (0.1.5): in a chat of a Проект the file also goes into the project's folder.
      const proj = typeof args.caseId === "string" && args.caseId && !args.temporary ? { caseId: args.caseId, caseTitle: (CASES.find((c) => c.id === args.caseId) || {}).title || "" } : {};
      const r = storeFile({ ...spec, chatId: typeof args.chatId === "string" ? args.chatId : null, ...(args.temporary ? { temporary: true } : {}), ...proj });
      if (r.ok) { made.push(r.file); ev({ type: "file", file: r.file, stepId: st.id }); }
      return r;
    };
    const ask = (approval, st) => new Promise((resolve) => {
      const id = nid("ap_test");
      st.wait();
      let done = false;
      const finish = (d) => {
        if (done) return; done = true; clearTimeout(timer); approvals.delete(id); ctl.wake.delete(onAbort);
        if (!ctl.aborted) st.run();
        resolve(d);
      };
      const timer = setTimeout(() => finish({ decision: "deny", timeout: true }), 600000);
      const onAbort = () => finish({ decision: "deny", cancelled: true });
      ctl.wake.add(onAbort);
      approvals.set(id, { requestId: rid, finish });
      ev({ type: "approval", approval: { id, ...approval } });
    });
    const out = (text, extra = {}) => ({ ok: true, text, model: args.model, steps: [...steps.values()].map((s) => ({ ...s })), files: made.map((f) => ({ ...f })), ...extra });
    const stopped = (text) => ({ ok: false, error: "Спряно от вас.", code: "aborted", ...(text ? { text } : {}), steps: [...steps.values()].map((s) => ({ ...s })), files: made.map((f) => ({ ...f })) });
    const finishText = async (full) => {
      const s = await streamText(full, rid, pause);
      return s.aborted ? stopped(s.text) : out(s.text);
    };
    const browseOn = OPT.browse && !(settings.browse && settings.browse.enabled === false);
    const lastMsg = args.messages[args.messages.length - 1] || {};
    const attached = (Array.isArray(lastMsg.files) ? lastMsg.files : []).map((id) => files.get(id)).filter(Boolean);
    try {
      if (await pause()) return stopped();

      // ?agentFail=limit: the step cap stops a long search.
      if (OPT.agentFail === "limit") {
        for (let k = 1; k <= 3; k++) {
          const s = mkStep("web_search", "Търся в интернет: тестова обява " + k);
          if (await pause()) return stopped();
          s.ok("8 резултата (тест)");
        }
        ev({ type: "limit", rounds: 8, calls: 40 });
        const s2 = await streamText("Прегледах част от тестовите сайтове, но спрях на лимита на стъпките за един отговор.", rid, pause);
        if (s2.aborted) return stopped(s2.text);
        return out(s2.text, { limited: { rounds: 8, calls: 40 } });
      }

      // 0.1.5 property upload (CONTRACT §9.5): the data from the text and the photos GPT looked at itself → one card for
      // properties.create → the code → a card for images.download with the chat photos ("file:<id>") → the gallery.
      if (/кач\S*[^\n]{0,40}имот|нов имот|качване на имот/.test(low)) {
        if (!/\d/.test(last)) return finishText("За да кача имота, ми трябват още: **сделка** (продажба или наем), **вид**, **цена**, **площ** и **град**. Напишете ги и прикачете снимките (тест).");
        const photos = attached.filter((f) => f.ref.kind === "image");
        const fields = { title: "Тестов двустаен апартамент, Център", deal: "sale", type: "Апартамент", price: 99000, area: 65, rooms: 2, floor: "3 от 6", city: "Тестоград", hood: "Център",
          desc: "Тестово описание, написано от GPT: светъл двустаен апартамент в центъра на Тестоград с южно изложение и две тераси (измислени данни)." };
        const s1 = mkStep("crm", "CRM: имоти.създаване", { tool: "properties.create", mutating: true });
        const d1 = await ask({ kind: "crm_write", title: "ChatGPT иска да създаде: имоти", tool: "properties.create", allowAll: true,
          lines: [["Заглавие", fields.title], ["Сделка", "продажба"], ["Вид", fields.type], ["Цена", "99 000 €"], ["Площ (м²)", "65 м²"], ["Стаи", "2"], ["Етаж", fields.floor], ["Град", fields.city], ["Квартал", fields.hood], ["Описание", fields.desc]],
          json: JSON.stringify(fields, null, 2) }, s1);
        if (ctl.aborted) return stopped();
        if (d1.decision === "deny") { s1.denied(); return finishText("Имотът не е създаден – отказахте. Нищо не е записано в CRM (тест)."); }
        if (await pause()) return stopped();
        s1.ok("P-1042 (тест)");
        let photoLine = "Няма прикачени снимки – прикачете ги и кажете „добави снимките към P-1042“.";
        if (photos.length) {
          // As MAIN (review F4): photos of this computer always get their own card – „Разреши всички“ never covers them.
          const s2 = mkStep("image", "Добавям снимки в галерията", { tool: "images.download", mutating: true });
          const shown = photos.map((f) => "„" + f.ref.name + "“");
          const d2 = await ask({ kind: "crm_write", title: "ChatGPT иска да добави " + (photos.length === 1 ? "1 снимка" : photos.length + " снимки") + " в галерията на имот P-1042", tool: "images.download", allowAll: false,
            lines: [["Имот", "P-1042"], ["Снимки", shown.join(", ")], ["Най-много", String(photos.length)]], json: JSON.stringify({ urls: photos.map((f) => "file:" + f.ref.id), property_code: "P-1042", max: photos.length }, null, 2) }, s2);
          if (ctl.aborted) return stopped();
          if (d2.decision === "deny") { s2.denied(); photoLine = "Снимките не са записани – отказахте."; }
          else {
            for (const f of photos) { const u = mkStep("upload", "Качвам „" + f.ref.name + "“ в хранилището на CRM"); if (await pause()) return stopped(); u.ok(); }
            if (await pause()) return stopped();
            s2.ok(photos.length + " снимки в галерията на P-1042 (тест)");
            photoLine = "Снимките (" + photos.length + ") са в галерията на имота, с логото на агенцията (тест).";
          }
        }
        return finishText("Създадох имот **P-1042** (статус „Чернова“) с тези данни (тестови):\n\n| Поле | Стойност |\n|---|---|\n| Заглавие | " + fields.title + " |\n| Сделка | продажба |\n| Вид | Апартамент |\n| Цена | 99 000 € |\n| Площ | 65 м² |\n| Град | Тестоград, Център |\n\n" + photoLine);
      }

      // 0.1.5 project folders (§8.12): „събирай … в папка“ → a card for cases.create, then what Ted makes goes into the folder;
      // „zip“ → export_zip as a FileCard (only „Запази…“).
      if (/папка|папката/.test(low)) {
        const cid = typeof args.caseId === "string" && args.caseId ? args.caseId : null;
        if (/zip|архив|изтегли/.test(low)) {
          const kase = CASES.find((c) => c.id === cid) || CASES[0];
          const s = mkStep("folder", "Папка „" + kase.title + "“: правя ZIP");
          if (await pause()) return stopped();
          const n = libraryItems().filter((f) => f.caseId === kase.id).length;
          if (!n) { s.fail("папката е празна"); return finishText("Папката на „" + kase.title + "“ е празна – няма какво да архивирам (тест)."); }
          const r = addFile({ name: kase.title + ".zip", bytes: zipLike("zip " + n), origin: "ted" }, s);
          if (r.ok) s.ok(n + " файла"); else s.fail(r.error);
          return finishText("Направих ZIP на папката „" + kase.title + "“ (" + n + " файла). Запазете го от картата по-долу с „Запази…“ (тест).");
        }
        const s1 = mkStep("crm", "CRM: проекти.създаване", { tool: "cases.create", mutating: true });
        const d1 = await ask({ kind: "crm_write", title: "ChatGPT иска да създаде проект „Тестов клиент В · папка“", tool: "cases.create", allowAll: true,
          lines: [["Заглавие", "Тестов клиент В · папка"], ["Клиент", "Тестов Клиент В"]], json: JSON.stringify({ title: "Тестов клиент В · папка", client_name: "Тестов Клиент В" }, null, 2) }, s1);
        if (ctl.aborted) return stopped();
        if (d1.decision === "deny") { s1.denied(); return finishText("Проектът не е създаден – отказахте (тест)."); }
        const id = "case-test-" + ++caseSeq;
        CASES.unshift({ id, title: "Тестов клиент В · папка", client: "Тестов Клиент В", status: "open", updated_at: new Date().toISOString(), summary: "" });
        s1.ok();
        const s2 = mkStep("doc", "Правя документ: Тестово досие на клиента.docx");
        if (await pause()) return stopped();
        const r = storeFile({ name: "Тестово досие на клиента.docx", bytes: zipLike("word/document.xml"), origin: "ted", chatId: args.chatId, caseId: id, caseTitle: "Тестов клиент В · папка" });
        if (r.ok) { made.push(r.file); ev({ type: "file", file: r.file, stepId: s2.id }); s2.ok(); } else s2.fail(r.error);
        return finishText("Създадох проекта „Тестов клиент В · папка“ и сложих досието в папката му. Вижте Проекти → Папка (тест).");
      }

      // Attached files: read locally, then a reworked version.
      if (attached.length) {
        for (const f of attached) {
          const s = mkStep("read_doc", "Чета файла: " + f.ref.name);
          if (await pause()) return stopped();
          const d = extractDoc(f.ref.id);
          if (d.ok) s.ok(d.doc.pages ? d.doc.pages + " стр." : "текстът е прочетен"); else s.fail(d.error);
        }
        const title = "Преработен – " + attached[0].ref.name.replace(/\.[^.]+$/, "");
        const s = mkStep("doc", "Правя документ: " + title + ".docx");
        if (await pause()) return stopped();
        const r = addFile({ name: title + ".docx", bytes: zipLike("word/document.xml"), origin: "ted" }, s);
        if (r.ok) s.ok(); else s.fail(r.error);
        return finishText("Прочетох „" + attached[0].ref.name + "“ и направих преработена версия като Word файл (тестови данни). Прегледайте я, преди да я изпратите.");
      }

      // Pictures and video: Real GPT has no image/video engine of its own and uses no other AI (§9.6) – it shows a
      // card with the prompt for the employee's ChatGPT app; nothing is opened or created here.
      const hintsNow = Array.isArray(args.hints) ? args.hints : [];
      const wantsVideo = /видео|клип/.test(low) || hintsNow.includes("video");
      if ((wantsVideo || /снимк|изображение|картин/.test(low) || hintsNow.includes("image")) && !/изтегли|чужда/.test(low)) {
        const kind = wantsVideo ? "video" : "image";
        const s = mkStep("chatgpt", "Заявка за ChatGPT: " + (kind === "video" ? "видео" : "снимка"));
        if (await pause()) return stopped();
        const prompt = kind === "video"
          ? "Кратко видео (10 s, 16:9) – бавна разходка с камерата из тестов светъл двустаен апартамент, дневна с голям прозорец, реалистично, без надписи."
          : "Фотореалистична снимка (16:9) на тестова дневна в стил минимализъм: светли дървени подове, бял диван, голям прозорец, дневна светлина, без хора и надписи.";
        ev({ type: "chatgpt", handoff: { id: nid("cg_test"), kind, prompt } });
        s.ok("картата е показана – нищо не е отворено");
        return finishText("Оттук не мога да създам " + (kind === "video" ? "видео" : "снимка") + " – това става в приложението ChatGPT с вашия план. Подготвих заявката по-долу: прегледайте я и натиснете „Отвори в ChatGPT“ (тестови данни).");
      }

      // Internet listings like ChatGPT (0.1.5): a table with the REAL listing links, photos inline (their addresses came
      // from read_page – `images` events), unreachable pages listed apart, a short summary with a source chip.
      if (/обяв|собственици/.test(low)) {
        if (!browseOn) {
          const s = mkStep("listings", "Интернетът е изключен");
          s.fail("Настройки → Браузър");
          return finishText("Интернетът е изключен в Настройки → Браузър, затова не търсих обяви.");
        }
        const s1 = mkStep("web_search", "Търся в интернет: тестови обяви двустаен Тестоград");
        if (await pause()) return stopped();
        s1.ok("8 резултата (тест)");
        const pagesRead = [
          { path: "obiava-101", imgs: [1, 2, 3] },
          { path: "obiava-102", imgs: [1, 2] },
        ];
        for (const pg of pagesRead) {
          const s = mkStep("read_page", "Чета страница: example.test/" + pg.path);
          if (await pause()) return stopped();
          s.ok("1 телефон, " + pg.imgs.length + " снимки");
          { const urls = pg.imgs.map((k) => "https://example.test/img/" + pg.path + "-" + k + ".png"); urls.forEach((x) => emittedImages.add(x)); ev({ type: "images", urls }); }
        }
        const s3 = mkStep("read_page", "Чета страница: example.test/obiava-103");
        if (await pause()) return stopped();
        s3.fail("Страницата върна грешка 404.");
        return finishText(LISTINGS_ANSWER);
      }

      // Photos of a listing fetched into the store (fetch_image): FileCards, and the same addresses inline.
      if (/изтегли/.test(low)) {
        for (let k = 1; k <= 2; k++) {
          const s = mkStep("fetch_image", "Изтеглям снимка: example.test/img/obiava-101-" + k + ".png");
          if (await pause()) return stopped();
          const r = addFile({ name: "obiava-101-" + k + ".png", bytes: pngBytes("Обява 101 · снимка " + k), thumb: thumbOf("Обява 101 · " + k), origin: "web", sourceUrl: "https://example.test/img/obiava-101-" + k + ".png" }, s);
          if (r.ok) s.ok(); else s.fail(r.error);
        }
        return finishText("Изтеглих 2 тестови снимки от обявата (измислени данни):\n\n![Обява 101 – снимка 1](https://example.test/img/obiava-101-1.png) ![Обява 101 – снимка 2](https://example.test/img/obiava-101-2.png)\n\nФайловете са и в Библиотеката.");
      }

      // A picture whose address did NOT come from a tool result: only a chip that loads after a click.
      if (/чужда/.test(low)) {
        const s = mkStep("web_search", "Търся в интернет: тестова снимка");
        if (await pause()) return stopped();
        s.ok("1 резултат (тест)");
        return finishText("Ето тестова снимка от друг сайт:\n\n![Тестова снимка от друг сайт](https://foreign.example.test/photo-1.png)\n\nИзточник: https://foreign.example.test/galeriya/testova-snimka?ref=chat");
      }

      // A document written from scratch into Canvas (a NEW version), with an SVG chart.
      if (/договор|canvas/.test(low)) {
        const s = mkStep("canvas", "Canvas: първа чернова");
        if (await pause()) return stopped();
        ev({ type: "canvas", canvas: { title: "Тестов договор за наем", text: CANVAS_TEXT, label: "първа чернова" } });
        s.ok();
        return finishText("Написах тестова чернова на договор за наем в Canvas (версия „Тед: първа чернова“). Мога да я експортирам като Word или PDF.");
      }

      // E-mail: only a draft; sending is the card's button + the native confirmation.
      if (/имейл/.test(low)) {
        const s = mkStep("crm", "CRM: имейл.чернова", { tool: "email.preview" });
        if (await pause()) return stopped();
        ev({ type: "email", email: clone(EMAIL_DRAFT) });
        s.ok();
        return finishText("Подготвих тестова чернова на имейл. Изпраща се само с бутона в картата и потвърждение – нищо не е изпратено.");
      }

      // Default script (§17): web_search → read_page → CRM properties.search → create_document → approval.
      if (browseOn) {
        const s1 = mkStep("web_search", "Търся в интернет: " + (last.slice(0, 60) || "тестова заявка"));
        if (await pause()) return stopped();
        s1.ok("8 резултата (тест)");
        const s2 = mkStep("read_page", "Чета страница: example.test/pazar-test");
        if (await pause()) return stopped();
        s2.ok();
      }
      const s3 = mkStep("crm", "CRM: имоти.търсене", { tool: "properties.search" });
      if (await pause()) return stopped();
      s3.ok("2 имота");
      const s4 = mkStep("doc", "Правя документ: Тестова справка.docx");
      if (await pause()) return stopped();
      const r = addFile({ name: "Тестова справка.docx", bytes: zipLike("word/document.xml"), origin: "ted" }, s4);
      if (r.ok) s4.ok(); else s4.fail(r.error);
      const s5 = mkStep("crm", "CRM: календар.ново събитие", { tool: "calendar.create", mutating: true });
      const d = await ask({ kind: "crm_write", title: "Ново събитие в календара", tool: "calendar.create",
        lines: [["Клиент", "Тестов Клиент А"], ["Заглавие", "Тестов оглед на ТЕСТ-101"], ["Кога", "утре 10:00"]], allowAll: true,
        json: JSON.stringify({ client_name: "Тестов Клиент А", title: "Тестов оглед на ТЕСТ-101", start: "утре 10:00" }, null, 2) }, s5);
      if (ctl.aborted) return stopped();
      if (d.decision === "deny") s5.denied();
      else { if (await pause()) return stopped(); s5.ok("записано (тест)"); }
      return finishText("Намерих 2 тестови имота и направих справка като Word файл. " +
        (d.decision === "deny" ? "Огледът не е записан – отказахте." : "Записах тестовия оглед в календара."));
    } finally {
      if (!ctl.aborted && pending.has(rid)) pending.delete(rid);
    }
  }

  async function rgSend(a) {
    const args = a || {};
    const messages = Array.isArray(args.messages) ? args.messages : [];
    const last = messages.length ? String(messages[messages.length - 1].text || "") : "";
    const lastFiles = messages.length && Array.isArray(messages[messages.length - 1].files) ? messages[messages.length - 1].files : [];
    calls.rgSend.push({
      count: messages.length, model: args.model, effort: args.effort, instructions: args.instructions, roles: messages.map((m) => m.role), last,
      ...(args.textOnly ? { textOnly: true } : {}),
      mode: args.mode, hints: args.hints, caseId: args.caseId, role: args.role, files: lastFiles, consent: consentNow(),
      ...(args.canvas ? { canvas: { title: args.canvas.title, version: args.canvas.version, len: String(args.canvas.text || "").length } } : {}),
    });
    if (!rg.connected) return { ok: false, error: "Real GPT не е свързан.", code: "not_connected" };
    if (rg.planEnabled === false) return { ok: false, error: "Използването на ChatGPT плана не е разрешено.", code: "plan_disabled" };
    if (typeof args.requestId !== "string" || !args.requestId) return { ok: false, error: "Невалидна заявка.", code: "invalid" };
    if (args.hints != null && (!Array.isArray(args.hints) || args.hints.length > 6 || args.hints.some((h) => !["image", "search", "research", "thinking", "canvas", "video"].includes(h)))) return { ok: false, error: "Невалидни подсказки.", code: "invalid" };
    if (args.canvas && String(args.canvas.text || "").length > 200000) return { ok: false, error: "Текстът в Canvas е твърде дълъг.", code: "invalid" };
    if (/лимит/i.test(last)) {
      await delay(200, args.requestId);
      return { ok: false, error: "Достигнат е лимитът на вашия ChatGPT план. Опитайте по-късно.", code: "usage_limit" };
    }
    // As MAIN: a terminal refresh failure clears the saved tokens, so the status reads „не е свързан“ afterwards.
    if (/повторен вход/i.test(last)) { rg = { connected: false }; return { ok: false, error: "Входът с ChatGPT е изтекъл – влезте отново.", code: "reauth" }; }
    if (args.textOnly != null && typeof args.textOnly !== "boolean") return { ok: false, error: "Невалидна заявка.", code: "invalid" };
    // textOnly (the „Само текст“ retry) only takes the tools away for this answer, as MAIN.
    const tools = consentNow() === "all" && args.textOnly !== true;
    if (tools && OPT.agentFail === "tools_unsupported") {
      if (await delay(250, args.requestId)) return { ok: false, error: "Спряно от вас.", code: "aborted" };
      return {
        ok: false, error: "ChatGPT планът не прие инструментите на Тед за този модел (тест).", code: "tools_unsupported",
        refused: { status: 400, code: "subscription_sharing_unsupported_capability", param: "tools[0]", message: "Function tools are not supported for this test model." },
      };
    }
    if (tools && (OPT.agent || OPT.agentFail === "limit")) return agentRun(args, last);
    const full = tools
      ? "Това е тестов отговор от Real GPT с разрешени инструменти. За този въпрос не бяха нужни. Данните са измислени."
      : "Това е тестов отговор от Real GPT, изпратен на части. В този режим няма достъп до CRM, казусите и паметта на Тед. Данните са измислени.";
    const s = await streamText(full, args.requestId);
    if (s.aborted) return { ok: false, error: "Спряно от вас.", code: "aborted", ...(s.text ? { text: s.text } : {}) };
    return { ok: true, text: s.text, model: args.model, ...(tools ? {} : { toolsOff: true }) };
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
      storage: async () => {
        calls.storage += 1;
        const lib = libraryItems();
        return { ok: true, chatsBytes: new TextEncoder().encode(JSON.stringify(chats)).length, libraryBytes: lib.reduce((n, f) => n + f.size, 0), libraryCount: lib.length, tempBytes: calls.filesOpen.length * 2048 };
      },
      clearTemp: async () => { calls.clearTemp += 1; return { ok: true }; },
      reportProblem: async () => { calls.reportProblem += 1; return { ok: true }; },
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
      models: async () => { site("api.models"); await sleep(80); return { ok: true, models: clone(MODELS), modes: clone(MODES) }; },
      chat,
      cancel: async (requestId) => abort(requestId),
    },
    crm: { read },
    cases: {
      create: async (args) => {
        const a = args || {};
        calls.casesCreate.push(a); site("cases.create");
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
        calls.remember.push(a); site("memory.remember");
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
        calls.confirmSend += 1; site("email.send");
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
        calls.tts.push(text.length); site("voice.tts");
        if (!text || text.length > 1200) return { ok: false, error: "Текстът за четене е празен или над 1200 знака.", code: "invalid" };
        await sleep(40);
        return { ok: true, wav: wav() };
      },
      transcribe: async () => { calls.transcribe += 1; site("voice.transcribe"); await sleep(120); return { ok: true, text: "Тестова диктовка" }; },
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
      cancel: async (requestId) => {
        for (const [, ap] of approvals) if (ap.requestId === requestId) ap.finish({ decision: "deny", cancelled: true });
        return abort(requestId);
      },
      onDelta: (cb) => sub(deltaSubs, cb),
      consent: async () => ({ ok: true, consent: consentNow(), ...(rg.connected && rg.email ? { account: rg.email } : {}) }),
      setConsent: async (choice) => {
        calls.consent.push(choice);
        if (choice !== "all" && choice !== "text" && choice !== null) return { ok: false, code: "invalid", error: "Невалиден избор." };
        if (!rg.connected) return { ok: false, code: "not_connected", error: "Real GPT не е свързан." };
        consentOf[rg.email] = choice;
        return { ok: true, consent: choice };
      },
      approve: async (args) => {
        const a = args || {};
        calls.approve.push({ approvalId: a.approvalId, decision: a.decision, ...(a.options ? { options: clone(a.options) } : {}) });
        if (!["allow", "deny", "allow_all"].includes(a.decision)) return { ok: false, code: "invalid", error: "Невалидно решение." };
        const ap = approvals.get(a.approvalId);
        if (!ap || ap.requestId !== a.requestId) return { ok: false, error: "Няма такова чакащо потвърждение." };
        if (a.options != null) {
          const o = a.options;
          if (typeof o !== "object" || typeof o.engine !== "string" || !Number.isFinite(o.duration)) return { ok: false, code: "invalid", error: "Невалиден избор за видео." };
        }
        await sleep(60);
        ap.finish({ decision: a.decision, options: a.options });
        return { ok: true };
      },
      onEvent: (cb) => sub(eventSubs, cb),
      // As MAIN (ipc.js + agent/chatgpt-link.js): only https://chatgpt.com/?q=<prompt>, ≤ 4000 chars and a link ≤ 8000; recorded, never opened.
      // {bare:true} opens https://chatgpt.com/ itself; a prompt whose LINK is over 8000 chars → code "too_long" (as MAIN).
      openInChatGpt: async (args) => {
        if (args && args.bare === true) { calls.openInChatGpt.push({ prompt: "", url: "https://chatgpt.com/" }); return { ok: true }; }
        const raw = args && typeof args.prompt === "string" ? args.prompt : "";
        const prompt = raw.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();
        if (!prompt || prompt.length > 4000) return { ok: false, code: "invalid", error: "Заявката е празна или твърде дълга." };
        const url = "https://chatgpt.com/?q=" + encodeURIComponent(prompt);
        if (url.length > 8000) return { ok: false, code: "too_long", error: "Заявката е твърде дълга за линк (кирилицата заема повече място) – копирайте я и я поставете в ChatGPT." };
        calls.openInChatGpt.push({ prompt, url });
        return { ok: true };
      },
    },
    files: {
      add: async (args) => {
        const a = args || {};
        calls.filesAdd.push({ name: a.name, mime: a.mime, chatId: a.chatId || null, temporary: !!a.temporary, caseId: a.caseId || null });
        if (typeof a.name !== "string" || !a.name || a.name.length > 180 || typeof a.data !== "string" || a.data.length > 28 * MB || (a.mime != null && String(a.mime).length > 120)) {
          return { ok: false, code: "invalid", error: "Невалиден файл." };
        }
        let bytes;
        try { bytes = b64ToBytes(a.data); } catch { return { ok: false, code: "invalid", error: "Файлът не можа да се прочете." }; }
        return storeFile({ name: a.name, mime: a.mime || "", bytes, chatId: a.chatId, temporary: !!a.temporary, origin: "user", caseId: a.caseId, caseTitle: a.caseTitle });
      },
      read: async (args) => {
        const a = args || {};
        calls.filesRead.push(a.id);
        const f = isId(a.id) ? files.get(a.id) : null;
        if (!f) return { ok: false, code: "not_found", error: "Файлът не е намерен." };
        const max = Number.isFinite(a.max) ? a.max : 150 * MB;
        if (f.bytes.length > max) return { ok: false, code: "too_large", error: "Файлът е твърде голям за преглед." };
        await sleep(30);
        return { ok: true, name: f.ref.name, mime: f.ref.mime, size: f.bytes.length, data: f.bytes.slice().buffer };
      },
      extract: async (args) => {
        const a = args || {};
        calls.filesExtract.push(a.id);
        if (!isId(a.id)) return { ok: false, code: "invalid", error: "Невалиден файл." };
        await sleep(40);
        return extractDoc(a.id);
      },
      open: async (id) => {
        calls.filesOpen.push(id);
        if (!isId(id) || !files.has(id)) return { ok: false, error: "Файлът не е намерен." };
        // The same allowlist as MAIN (electron/files.js OPENABLE).
        const ref = files.get(id).ref;
        if (!/\.(pdf|docx|xlsx|csv|txt|md|json|jpe?g|png|webp|gif|mp4|webm)$/i.test(ref.name) && !(ref.origin === "ted" && /\.html?$/i.test(ref.name))) {
          return { ok: false, code: "not_openable", error: "Този вид файл не се отваря от програмата – ползвайте „Запази…“." };
        }
        return { ok: true };
      },
      save: async (id) => {
        calls.filesSave.push(id);
        const f = isId(id) ? files.get(id) : null;
        if (!f) return { ok: false, error: "Файлът не е намерен." };
        if (!confirmAnswer) return { ok: false, canceled: true };
        return { ok: true, path: "C:\\Users\\Test\\Documents\\" + f.ref.name };
      },
      forget: async (id) => {
        calls.filesForget.push(id);
        const f = files.get(id);
        if (f && f.temporary) files.delete(id);
        return { ok: true };
      },
    },
    browse: {
      // As MAIN (ipc.js browse.image): one https picture, ≤ 8 MB, image/* – the mock draws a test picture, no network.
      image: async (args) => {
        const a = args || {};
        calls.browseImage.push(a.url);
        if (a.clicked === true) calls.browseImageClicked.push(a.url);
        let u;
        try { u = new URL(String(a.url || "")); } catch { return { ok: false, code: "invalid", error: "Невалиден адрес на снимка." }; }
        if (u.protocol !== "https:" || String(a.url).length > 2048) return { ok: false, code: "invalid", error: "Снимките се зареждат само по https." };
        if (settings.browse && settings.browse.enabled === false) return { ok: false, code: "off", error: "Интернетът е изключен в Настройки → Браузър." };
        // As MAIN (browse/provenance.js): without a click only addresses the agent emitted as `images`.
        if (a.clicked !== true && !emittedImages.has(String(a.url))) return { ok: false, code: "not_allowed", error: "Снимката не е от резултат на инструмент – заредете я с клик." };
        await sleep(60);
        if (/missing/.test(u.pathname)) return { ok: false, code: "http", error: "Адресът върна грешка 404." };
        const label = decodeURIComponent(u.pathname.split("/").pop() || u.hostname).replace(/\.[a-z]+$/i, "");
        const bytes = pngBytes("Тест · " + label, 480, 360);
        return { ok: true, mime: "image/png", size: bytes.length, data: bytes.slice().buffer };
      },
      test: async (args) => {
        const a = args || {};
        calls.browseTest.push(a.url);
        let u;
        try { u = new URL(String(a.url || "")); } catch { return { ok: false, code: "invalid", error: "Невалиден адрес." }; }
        if (!/^https?:$/.test(u.protocol) || String(a.url).length > 2000) return { ok: false, code: "invalid", error: "Само адреси с http:// или https://." };
        await sleep(150);
        const h = u.hostname.toLowerCase();
        if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.)|\.local$/.test(h) || !h.includes(".")) return { ok: false, code: "blocked", error: "Адресът е в локалната мрежа или не е публичен – не се отваря." };
        if (/(^|\.)(facebook\.com|fb\.com|instagram\.com)$/.test(h)) return { ok: false, code: "blocked", error: "Facebook и Instagram изискват вход в профил и не се четат (тест)." };
        const blocked = (settings.browse && Array.isArray(settings.browse.blocked)) ? settings.browse.blocked : [];
        if (blocked.some((b) => h === b || h.endsWith("." + b))) return { ok: false, code: "blocked", error: "Сайтът е в списъка с блокирани." };
        return { ok: true, status: 200, title: "Тестова страница (" + h + ")" };
      },
    },
    video: {
      prepare: async (args) => {
        const a = args || {};
        if (a.code != null && (typeof a.code !== "string" || a.code.length > 60)) return { ok: false, code: "invalid", error: "Невалиден код." };
        await sleep(200);
        return videoPrepare({ code: a.code, fileIds: a.fileIds, prompt: a.prompt });
      },
      start: async (args) => { await sleep(80); return videoStart(args || {}); },
      cancel: async (args) => videoCancel(args || {}),
      finish: async (args) => {
        const a = args || {};
        calls.videoFinish.push({ jobId: a.jobId, fileId: a.fileId });
        const job = jobs.get(a.jobId);
        if (!job) return { ok: false, error: "Задачата за видео не е намерена." };
        const f = files.get(a.fileId);
        if (!f || f.ref.kind !== "video") return { ok: false, error: "Сглобеното видео не е намерено." };
        f.ref = { ...f.ref, origin: "ted" }; // like MAIN: the stitched clip is Ted's work
        job.fileId = f.ref.id; job.status = "done";
        videoChanged(job);
        return { ok: true, file: { ...f.ref } };
      },
      onEvent: (cb) => sub(videoSubs, cb),
    },
    library: {
      list: async (args) => {
        const a = args || {};
        await sleep(60);
        const q = String(a.q || "").toLowerCase().slice(0, 200);
        const all = libraryItems();
        const items = all.filter((f) => (!a.kind || f.kind === a.kind) && (!q || f.name.toLowerCase().includes(q)) && (!a.caseId || f.caseId === a.caseId)).slice(0, Math.min(500, Number(a.limit) || 500));
        return { ok: true, items: clone(items), totalBytes: all.reduce((n, f) => n + f.size, 0), count: all.length };
      },
      remove: async (id) => {
        calls.libRemove.push(id);
        if (!confirmAnswer) return { ok: false, canceled: true };
        files.delete(id); libChanged();
        return { ok: true };
      },
      clear: async () => {
        calls.libClear += 1;
        if (!confirmAnswer) return { ok: false, canceled: true };
        for (const [id, f] of files) if (!f.temporary) files.delete(id);
        libChanged();
        return { ok: true };
      },
      onChange: (cb) => sub(libSubs, cb),
    },
    // Project folders (§8.12): the same checks as MAIN; ZIP and „Запази в сайта“ are recorded, nothing leaves the page.
    projects: {
      assign: async (args) => {
        const a = args || {};
        calls.projAssign.push({ caseId: a.caseId === undefined ? undefined : a.caseId, fileIds: a.fileIds });
        if (!Array.isArray(a.fileIds) || !a.fileIds.length || a.fileIds.length > 50 || !a.fileIds.every(isId)) return { ok: false, code: "invalid", error: "Невалидни данни." };
        const out = [];
        for (const id of a.fileIds) {
          const f = files.get(id);
          if (!f) continue;
          const { caseId: _c, caseTitle: _t, ...rest } = f.ref;
          f.ref = a.caseId ? { ...rest, caseId: a.caseId, ...(a.caseTitle ? { caseTitle: a.caseTitle } : {}) } : rest;
          out.push({ ...f.ref });
        }
        if (out.length) libChanged();
        return out.length ? { ok: true, files: out } : { ok: false, code: "not_found", error: "Файловете не са намерени." };
      },
      saveAnswer: async (args) => {
        const a = args || {};
        calls.projAnswer.push({ caseId: a.caseId, title: a.title });
        if (typeof a.caseId !== "string" || !a.caseId || typeof a.text !== "string" || !a.text) return { ok: false, code: "invalid", error: "Невалидни данни." };
        return storeFile({ name: String(a.title || "Отговор на Тед").slice(0, 100) + ".md", mime: "text/markdown", bytes: enc(a.text), origin: "ted", chatId: a.chatId, caseId: a.caseId, caseTitle: a.caseTitle });
      },
      exportZip: async (args) => {
        const a = args || {};
        const items = libraryItems().filter((f) => f.caseId === a.caseId);
        calls.projZip.push({ caseId: a.caseId, title: a.title, names: items.map((f) => f.name) });
        if (!items.length) return { ok: false, code: "empty", error: "Папката на проекта е празна – няма какво да се изтегли." };
        if (!confirmAnswer) return { ok: false, canceled: true };
        await sleep(80);
        return { ok: true, path: "C:\\Users\\Test\\Documents\\" + String(a.title || "Проект") + ".zip", count: items.length, bytes: items.reduce((n, f) => n + f.size, 0) };
      },
      saveToCrm: async (args) => {
        const a = args || {};
        const t = a.target || {};
        calls.projCrm.push({ caseId: a.caseId, fileIds: a.fileIds, target: clone(t) });
        const items = libraryItems().filter((f) => f.caseId === a.caseId && (!Array.isArray(a.fileIds) || !a.fileIds.length || a.fileIds.includes(f.id)));
        if (!items.length) return { ok: false, code: "empty", error: "Папката на проекта е празна." };
        if (!t.propertyCode && !t.clientName && !t.clientId) return { ok: false, code: "invalid", error: "Изберете клиент или имот, при който да се запишат файловете." };
        if (!confirmAnswer) return { ok: false, canceled: true }; // the native Windows confirmation of MAIN
        site("files.attach ×" + items.length);
        await sleep(120);
        const label = t.propertyCode ? "имот " + t.propertyCode : "клиент " + (t.clientName || t.clientId);
        const results = items.map((f) => {
          const where = t.propertyCode && f.kind === "image" ? label + " (снимки)" : label;
          const x = files.get(f.id); if (x) x.ref = { ...x.ref, savedTo: "CRM: " + where };
          return { id: f.id, name: f.name, ok: true, savedTo: where };
        });
        libChanged();
        return { ok: true, results, saved: results.length, failed: 0, target: label };
      },
    },
    scheduled: {
      list: async () => { await sleep(60); return { ok: true, items: clone(tasks) }; },
      save: async (task) => {
        calls.schedSave.push(task && task.title);
        const bad = validTask(task);
        if (bad) return { ok: false, code: "invalid", error: bad };
        const t = { title: task.title.trim(), kind: task.kind, text: String(task.text || ""), engine: task.engine || "server", at: new Date(task.at).toISOString(), repeat: task.repeat || "none", enabled: task.enabled !== false };
        let item;
        const k = task.id ? tasks.findIndex((x) => x.id === task.id) : -1;
        if (k >= 0) { item = { ...tasks[k], ...t, nextRun: t.at }; tasks[k] = item; }
        else { if (tasks.length >= 200) return { ok: false, code: "invalid", error: "Най-много 200 задачи." }; item = { id: nid("task_test"), ...t, nextRun: t.at }; tasks.push(item); }
        return { ok: true, item: clone(item) };
      },
      remove: async (id) => { calls.schedRemove.push(id); const k = tasks.findIndex((x) => x.id === id); if (k >= 0) tasks.splice(k, 1); return { ok: true }; },
      onDue: (cb) => {
        const un = sub(dueSubs, cb);
        // Missed runs are reported once, after the first subscriber (MAIN does it at start).
        if (!missedSent && OPT.sched) { missedSent = true; setTimeout(() => { const t = tasks.find((x) => x.id === "task-test-2"); if (t) emit(dueSubs, { task: t, missed: true }); }, 400); }
        return un;
      },
    },
    updates: {
      state: async () => clone(upd),
      check: async () => {
        calls.updCheck += 1;
        if (!upd.supported) return clone(upd);
        const target = upd.status === "checking" ? "none" : upd.status === "idle" ? "none" : upd.status;
        setUpd({ ...upd, status: "checking" });
        setTimeout(() => setUpd({ ...UPD_FROM(target), auto: upd.auto, lastCheck: new Date().toISOString() }), 300);
        return clone(upd);
      },
      setAuto: async (on) => {
        calls.updAuto.push(!!on);
        if (upd.supported) setUpd({ ...upd, auto: !!on });
        if (on && upd.status === "available") mockDownload(); // as MAIN: switching auto on starts the download
        return clone(upd);
      },
      download: async () => {
        calls.updDownload += 1;
        if (upd.status !== "available") return { ok: false, error: "Няма налично обновление за изтегляне." };
        mockDownload();
        return { ok: true };
      },
      install: async () => {
        calls.updInstall += 1;
        if (upd.status !== "ready") return { ok: false, error: "Няма изтеглена нова версия." };
        return { ok: true };
      },
      onChange: (cb) => sub(updSubs, cb),
    },
  };

  window.__tedMock = {
    calls,
    setConfirm: (v) => { confirmAnswer = !!v; },
    setEmailOutcome: (v) => { emailOutcome = v; },
    expire: () => { signedIn = false; emitAuth(); },
    setUpd: (status) => setUpd(UPD_FROM(status)),
    fireDue: (id, missed = false) => { const t = tasks.find((x) => x.id === id); if (t) emit(dueSubs, { task: t, missed: !!missed }); },
    job: (id) => (jobs.has(id) ? publicJob(jobs.get(id)) : null),
    files: () => [...files.values()].map((f) => ({ ...f.ref, temporary: f.temporary })),
  };
  return bridge;
}
