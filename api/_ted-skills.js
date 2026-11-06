// Тед – допълнителни skills към съществуващия action registry (/api/tools).
// Домейни: documents (PDF: обединяване, разделяне, извличане на текст, превод, класификация, сглобяване на извлечения),
// communication (резолвиране на получател, преглед и изпращане на имейл), contracts (договор от CRM данни), reports (PDF от текст).
// Всичко минава през същия bearer token на служителя: Supabase RLS важи, нищо не се изпълнява без права.
"use strict";
const fs = require("fs"), path = require("path");
const PDFLib = require("./_vendor/pdf-lib.min.js");
const fontkit = require("./_vendor/fontkit.umd.min.js");
const WEB = require("./_web.js");
let MAIL = null; try { MAIL = require("./email.js"); } catch (e) { MAIL = { configFor: async () => null, sendAs: async () => { throw new Error("email module missing"); }, friendly: (e) => String(e && e.message || e) }; }
// пощата на текущия служител (пази се само на сървъра: nd_secrets smtp:<userId>)
const mailbox = (ctx) => MAIL.configFor(ctx.userId || (ctx.user && ctx.user.id)).catch(() => null);

const BUCKET = "nd-files", SIGN_SECS = 7 * 86400, MAX_PDF_MB = 40, MAX_DOCS = 40;
const GEMINI = () => process.env.GEMINI_API_KEY || "";
const FONT = { reg: path.join(__dirname, "_vendor", "DejaVuSans.ttf"), bold: path.join(__dirname, "_vendor", "DejaVuSans-Bold.ttf") };

class ToolError extends Error { constructor(m, status = 400) { super(m); this.status = status; } }

/* ---------- small input validator (same contract as the zod schemas: safeParse) ---------- */
function schema(spec) {
  return {
    safeParse(input) {
      const out = {}, issues = []; input = input && typeof input === "object" ? input : {};
      for (const k of Object.keys(spec)) {
        const s = spec[k], v = input[k];
        if (v === undefined || v === null || v === "") { if (s.required) issues.push({ path: [k], message: "required" }); else if (s.default !== undefined) out[k] = s.default; continue; }
        if (s.type === "string") { if (typeof v !== "string") { issues.push({ path: [k], message: "string" }); continue; } if (s.max && v.length > s.max) { issues.push({ path: [k], message: "max " + s.max }); continue; } if (s.enum && !s.enum.includes(v)) { issues.push({ path: [k], message: "one of " + s.enum.join("|") }); continue; } out[k] = v; }
        else if (s.type === "number") { const n = Number(v); if (!isFinite(n)) { issues.push({ path: [k], message: "number" }); continue; } if (s.min != null && n < s.min) { issues.push({ path: [k], message: "min " + s.min }); continue; } if (s.max != null && n > s.max) { issues.push({ path: [k], message: "max " + s.max }); continue; } out[k] = n; }
        else if (s.type === "boolean") { out[k] = v === true || v === "true" || v === 1; }
        else if (s.type === "array") { if (!Array.isArray(v)) { issues.push({ path: [k], message: "array" }); continue; } if (s.max && v.length > s.max) { issues.push({ path: [k], message: "max " + s.max }); continue; } out[k] = v; }
        else if (s.type === "object") { if (typeof v !== "object") { issues.push({ path: [k], message: "object" }); continue; } out[k] = v; }
      }
      return issues.length ? { success: false, error: { issues } } : { success: true, data: out };
    }
  };
}
const S = (type, o) => Object.assign({ type }, o || {});

/* ---------- storage / db helpers (user token, RLS) ---------- */
const T = { clients: "nd_clients", properties: "nd_properties", documents: "nd_documents", companies: "nd_companies", activities: "nd_activities", audit: "nd_audit" };
async function rows(ctx, kind, filter) {
  let q = ctx.sb.from(T[kind]).select("id,data,created_at,updated_at").order("updated_at", { ascending: false }).limit(2000);
  if (filter) q = filter(q);
  const { data, error } = await q; if (error) throw new ToolError(error.message);
  return data.map((r) => ({ id: r.id, ...r.data, updated_at: r.updated_at }));
}
async function row(ctx, kind, id) {
  const { data, error } = await ctx.sb.from(T[kind]).select("id,data").eq("id", id).maybeSingle();
  if (error) throw new ToolError(error.message); if (!data) throw new ToolError(kind + " " + id + " не е намерен", 404);
  return { id: data.id, ...data.data };
}
async function put(ctx, kind, data, id) {
  const r = { data }; if (id) r.id = id;
  const { data: d, error } = await ctx.sb.from(T[kind]).upsert(r).select("id,data").single();
  if (error) throw new ToolError(error.message); return { id: d.id, ...d.data };
}
async function download(ctx, p) {
  const { data, error } = await ctx.sb.storage.from(BUCKET).download(p);
  if (error) throw new ToolError("Файлът не е достъпен: " + p + " (" + error.message + ")", 404);
  const buf = Buffer.from(await data.arrayBuffer());
  if (buf.length > MAX_PDF_MB * 1048576) throw new ToolError("Файлът е над " + MAX_PDF_MB + " MB");
  return buf;
}
async function upload(ctx, p, buf, mime) {
  const { error } = await ctx.sb.storage.from(BUCKET).upload(p, buf, { contentType: mime, upsert: true });
  if (error) throw new ToolError("Качването не успя: " + error.message, 500);
}
async function signed(ctx, p, secs) {
  const { data, error } = await ctx.sb.storage.from(BUCKET).createSignedUrl(p, secs || SIGN_SECS);
  if (error) throw new ToolError(error.message); return data.signedUrl;
}
function safeName(s) { return String(s || "file").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 90); }
async function clientOf(ctx, id, name) {
  if (id) return row(ctx, "clients", id);
  if (!name) return null;
  const q = String(name).toLocaleLowerCase("bg"), all = await rows(ctx, "clients");
  const hits = all.filter((c) => String(c.name || "").toLocaleLowerCase("bg").includes(q));
  if (hits.length === 1) return hits[0];
  if (!hits.length) throw new ToolError("Няма клиент с име „" + name + "“", 404);
  throw new ToolError("Няколко клиенти отговарят на „" + name + "“: " + hits.map((c) => (c.num ? "К#" + c.num + " " : "") + c.name + " (id " + c.id + ")").join("; ") + ". Уточнете кой.", 409);
}
/* the artifact registry is the client's document list: folder "Тед" (or the user's folder) + an activity line */
async function registerArtifact(ctx, client, name, p, size, mime, folder, note) {
  const doc = await put(ctx, "documents", { client_id: client ? client.id : null, client: client ? client.name : "", name, folder: folder || "Тед", path: p, mime, size, at: new Date().toISOString(), by: "ted" });
  if (client) await put(ctx, "activities", { client_id: client.id, client: client.name, icon: "file-text", text: note || ("Тед изготви файл: " + name), at: new Date().toISOString() }).catch(() => null);
  const url = await signed(ctx, p);
  return { document_id: doc.id, name, size_bytes: size, mime, download_url: url, expires_in_days: 7, path: p };
}
function artPath(client, name) { return (client ? "clients/" + client.id + "/ted/" : "ted/") + Date.now() + "-" + name.replace(/[^\w.\-а-яА-Я ]+/g, "_"); }

/* ---------- PDF helpers ---------- */
let fontCache = null;
function fontBytes() { if (!fontCache) fontCache = { reg: fs.readFileSync(FONT.reg), bold: fs.readFileSync(FONT.bold) }; return fontCache; }
async function loadPdf(buf) { try { return await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true }); } catch (e) { throw new ToolError("Файлът не е валиден PDF: " + (e.message || e)); } }
async function pagesOf(ctx, doc) {
  const buf = await download(ctx, doc.path); const mime = doc.mime || "";
  if (/pdf/i.test(mime) || /\.pdf$/i.test(doc.name || "")) { const pdf = await loadPdf(buf); return { kind: "pdf", pages: pdf.getPageCount(), size: buf.length, buf }; }
  if (/^image\//.test(mime) || /\.(jpe?g|png)$/i.test(doc.name || "")) return { kind: "image", pages: 1, size: buf.length, buf, mime: mime || (/png$/i.test(doc.name) ? "image/png" : "image/jpeg") };
  return { kind: "other", pages: null, size: buf.length, buf, mime };
}
async function appendDoc(out, info) {
  if (info.kind === "pdf") { const src = await loadPdf(info.buf); const copied = await out.copyPages(src, src.getPageIndices()); copied.forEach((p) => out.addPage(p)); return copied.length; }
  if (info.kind === "image") {
    const img = /png/.test(info.mime) ? await out.embedPng(info.buf) : await out.embedJpg(info.buf);
    const A4 = [595.28, 841.89], page = out.addPage(A4), m = 28, k = Math.min((A4[0] - 2 * m) / img.width, (A4[1] - 2 * m) / img.height);
    page.drawImage(img, { x: (A4[0] - img.width * k) / 2, y: (A4[1] - img.height * k) / 2, width: img.width * k, height: img.height * k }); return 1;
  }
  throw new ToolError("Форматът не може да се добави в PDF: " + (info.mime || "неизвестен"));
}
/* plain text / light structure -> A4 PDF with Cyrillic font. blocks: {h1|h2|p|small|hr|table:{rows}} */
async function textPdf(blocks, opts) {
  opts = opts || {}; const F = fontBytes(), doc = await PDFLib.PDFDocument.create(); doc.registerFontkit(fontkit);
  const reg = await doc.embedFont(F.reg, { subset: true }), bold = await doc.embedFont(F.bold, { subset: true });
  const W = 595.28, H = 841.89, M = 48; let page = doc.addPage([W, H]), y = H - M, pageNo = 1;
  const footer = () => { if (opts.footer) page.drawText(opts.footer + "  ·  стр. " + pageNo, { x: M, y: 24, size: 8, font: reg, color: PDFLib.rgb(.4, .3, .3) }); };
  const newPage = () => { footer(); page = doc.addPage([W, H]); y = H - M; pageNo++; };
  const wrap = (txt, font, size, width) => {
    const words = String(txt).replace(/\r/g, "").split(/(\n)/), lines = [], push = (l) => lines.push(l);
    let cur = "";
    for (const w0 of words) {
      if (w0 === "\n") { push(cur); cur = ""; continue; }
      for (const w of w0.split(" ")) {
        const t = cur ? cur + " " + w : w;
        if (font.widthOfTextAtSize(t, size) <= width) cur = t;
        else { if (cur) push(cur); if (font.widthOfTextAtSize(w, size) > width) { let s = ""; for (const ch of w) { if (font.widthOfTextAtSize(s + ch, size) > width) { push(s); s = ch; } else s += ch; } cur = s; } else cur = w; }
      }
    }
    if (cur) push(cur); return lines;
  };
  const draw = (txt, font, size, color, indent, gap) => {
    for (const ln of wrap(txt, font, size, W - 2 * M - (indent || 0))) {
      if (y - size < M) newPage();
      page.drawText(ln, { x: M + (indent || 0), y: y - size, size, font, color: color || PDFLib.rgb(.07, .07, .07) }); y -= size * 1.42;
    }
    y -= gap == null ? size * .5 : gap;
  };
  for (const b of blocks) {
    if (b.h1 != null) { draw(b.h1, bold, 15, PDFLib.rgb(.42, .02, .1), 0, 8); }
    else if (b.h2 != null) { if (y < M + 60) newPage(); draw(b.h2, bold, 11.5, PDFLib.rgb(.42, .02, .1), 0, 3); }
    else if (b.p != null) draw(b.p, reg, 10.5);
    else if (b.small != null) draw(b.small, reg, 8.5, PDFLib.rgb(.35, .3, .3));
    else if (b.hr) { if (y < M + 20) newPage(); page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: .8, color: PDFLib.rgb(.73, .55, .25) }); y -= 14; }
    else if (b.table) {
      const cols = b.table.cols || Math.max(...b.table.rows.map((r) => r.length)), cw = (W - 2 * M) / cols, size = 9;
      for (let ri = 0; ri < b.table.rows.length; ri++) {
        const r = b.table.rows[ri], cells = r.map((c, i) => wrap(String(c == null ? "" : c), ri === 0 && b.table.header !== false ? bold : reg, size, cw - 8)), hgt = Math.max(...cells.map((c) => c.length)) * size * 1.35 + 8;
        if (y - hgt < M) newPage();
        if (ri === 0 && b.table.header !== false) page.drawRectangle({ x: M, y: y - hgt, width: W - 2 * M, height: hgt, color: PDFLib.rgb(.98, .93, .86) });
        page.drawLine({ start: { x: M, y: y - hgt }, end: { x: W - M, y: y - hgt }, thickness: .5, color: PDFLib.rgb(.8, .7, .6) });
        cells.forEach((lines, i) => lines.forEach((ln, li) => page.drawText(ln, { x: M + i * cw + 4, y: y - 4 - size - li * size * 1.35, size, font: ri === 0 && b.table.header !== false ? bold : reg })));
        y -= hgt;
      }
      y -= 10;
    }
    else if (b.space) y -= b.space;
  }
  footer();
  return Buffer.from(await doc.save());
}
function htmlToBlocks(html) {
  const s = String(html || "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<div class="hd">[\s\S]*?<\/div>/i, "");
  const blocks = [], sig = [], re = /<(h1|h2|p|div)[^>]*>([\s\S]*?)<\/\1>/gi; let m;
  /* signature block -> two columns with lines */
  const s2 = s.replace(/<div class="sg">([\s\S]*?)<\/div>\s*<\/div>/i, function (all, inner) { const labels = inner.split(/<div class="ln"><\/div>/).slice(1).map((x) => x.replace(/<[^>]+>/g, "").trim()); sig.push(labels); return ""; });
  const txt = (x) => x.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim();
  while ((m = re.exec(s2))) { const t = txt(m[2]); if (!t) continue; if (m[1] === "h1") blocks.push({ h1: t }); else if (m[1] === "h2") blocks.push({ h2: t }); else blocks.push({ p: t }); }
  if (!blocks.length) blocks.push({ p: txt(s2) });
  sig.forEach((labels) => { blocks.push({ space: 26 }); blocks.push({ table: { header: false, rows: [["______________________________", "______________________________"], labels.length === 2 ? labels : [labels[0] || "", ""]] } }); });
  return blocks;
}

/* ---------- Gemini (documents): text, language, classification, translation ---------- */
async function gemini(parts, opts) {
  if (!GEMINI()) throw new ToolError("Липсва GEMINI_API_KEY на сървъра", 500);
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"]; let last = "";
  for (const model of models) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(GEMINI()), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: Object.assign({ temperature: 0.1, maxOutputTokens: 60000 }, opts && opts.json ? { responseMimeType: "application/json" } : {}) })
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { const t = (((j.candidates || [])[0] || {}).content || {}).parts || []; const out = t.map((p) => p.text || "").join(""); if (out) return out; last = "празен отговор"; continue; }
    last = (j.error && j.error.message) || ("HTTP " + r.status);
  }
  throw new ToolError("AI не отговори: " + last, 502);
}
const docPart = (info) => ({ inline_data: { mime_type: info.kind === "pdf" ? "application/pdf" : info.mime, data: info.buf.toString("base64") } });
function parseJson(t) { try { return JSON.parse(t); } catch (e) { const m = String(t).match(/\{[\s\S]*\}|\[[\s\S]*\]/); if (m) { try { return JSON.parse(m[0]); } catch (e2) {} } throw new ToolError("AI върна невалиден JSON"); } }
async function classifyDoc(info, name) {
  const t = await gemini([docPart(info), { text: "Това е документ от досие на клиент на агенция за недвижими имоти. Име на файла: " + name + ". Върни САМО JSON: {\"type\": един от [\"банково извлечение\",\"фиш за заплата\",\"трудов договор\",\"лична карта\",\"нотариален акт\",\"скица\",\"данъчна оценка\",\"удостоверение\",\"декларация\",\"фактура\",\"договор\",\"превод\",\"друго\"], \"language\": ISO 639-1 код на основния език, \"is_translation\": true/false (дали е превод на български), \"period_from\": \"YYYY-MM\" или null, \"period_to\": \"YYYY-MM\" или null, \"issuer\": кратко име на институцията или null, \"person\": име на лицето или null, \"pages\": брой страници, \"confidence\": 0..1}. Без обяснения." }], { json: true });
  return parseJson(t);
}

/* ---------- the skills ---------- */
const tools = {
  "documents.find": {
    description: "Намира документи в CRM по клиент (id или име), текст в името, папка или вид. Връща id, име, папка, размер, дата и кратък линк. За клиенти с еднакви имена връща грешка с избор.",
    input: schema({ client_id: S("string"), client_name: S("string", { max: 120 }), query: S("string", { max: 120 }), folder: S("string", { max: 80 }), limit: S("number", { min: 1, max: 200, default: 60 }) }),
    run: async (ctx, i) => {
      const c = await clientOf(ctx, i.client_id, i.client_name);
      let list = await rows(ctx, "documents", c ? (q) => q.eq("client_id", c.id) : undefined);
      const q = (i.query || "").toLocaleLowerCase("bg"), f = (i.folder || "").toLocaleLowerCase("bg");
      list = list.filter((d) => (!q || [d.name, d.folder, d.client].join(" ").toLocaleLowerCase("bg").includes(q)) && (!f || String(d.folder || "").toLocaleLowerCase("bg").includes(f))).slice(0, i.limit);
      const out = [];
      for (const d of list) out.push({ id: d.id, name: d.name, folder: d.folder, client: d.client, client_id: d.client_id, mime: d.mime, size_bytes: d.size, at: d.at, download_url: await signed(ctx, d.path, 3600).catch(() => null) });
      return { client: c ? { id: c.id, name: c.name } : null, count: out.length, documents: out };
    }
  },
  "documents.inspect": {
    description: "Проверява реалните файлове: вид, брой страници, размер; по желание и съдържание (вид документ, език, период, институция) с AI. Ползвай преди обединяване/превод.",
    input: schema({ doc_ids: S("array", { required: true, max: MAX_DOCS }), classify: S("boolean", { default: false }) }),
    run: async (ctx, i) => {
      const out = [];
      for (const id of i.doc_ids) {
        const d = await row(ctx, "documents", id);
        try { const info = await pagesOf(ctx, d); const o = { id, name: d.name, kind: info.kind, pages: info.pages, size_bytes: info.size }; if (i.classify && info.kind !== "other") o.content = await classifyDoc(info, d.name); out.push(o); }
        catch (e) { out.push({ id, name: d.name, error: e.message }); }
      }
      return { documents: out };
    }
  },
  "documents.merge": {
    description: "Обединява PDF и снимки в един валиден PDF в подадения ред (doc_ids), записва го при клиента и връща реален линк за изтегляне с брой страници.",
    input: schema({ doc_ids: S("array", { required: true, max: MAX_DOCS }), title: S("string", { max: 120, default: "Обединен документ" }), client_id: S("string"), client_name: S("string", { max: 120 }) }),
    run: async (ctx, i) => {
      const client = await clientOf(ctx, i.client_id, i.client_name); const out = await PDFLib.PDFDocument.create(); const parts = [];
      for (const id of i.doc_ids) { const d = await row(ctx, "documents", id); const info = await pagesOf(ctx, d); const n = await appendDoc(out, info); parts.push({ id, name: d.name, pages: n }); }
      const buf = Buffer.from(await out.save()), name = safeName(i.title) + ".pdf", p = artPath(client || (parts.length ? { id: (await row(ctx, "documents", i.doc_ids[0])).client_id || "common" } : null), name);
      await upload(ctx, p, buf, "application/pdf");
      const art = await registerArtifact(ctx, client, name, p, buf.length, "application/pdf", "Тед", "Тед обедини " + parts.length + " документа в „" + name + "“ (" + out.getPageCount() + " стр.)");
      return Object.assign({ pages: out.getPageCount(), parts }, art);
    }
  },
  "documents.split": {
    description: "Разделя PDF: по диапазони страници (ranges: [{from,to,name}]) или всяка страница отделно (per_page=true). Връща отделните файлове с линкове.",
    input: schema({ doc_id: S("string", { required: true }), ranges: S("array", { max: 50 }), per_page: S("boolean", { default: false }), client_id: S("string") }),
    run: async (ctx, i) => {
      const d = await row(ctx, "documents", i.doc_id), info = await pagesOf(ctx, d); if (info.kind !== "pdf") throw new ToolError("Разделяне е възможно само за PDF");
      const src = await loadPdf(info.buf), n = src.getPageCount(), client = i.client_id ? await row(ctx, "clients", i.client_id) : (d.client_id ? await row(ctx, "clients", d.client_id).catch(() => null) : null);
      let ranges = i.per_page ? Array.from({ length: n }, (_, k) => ({ from: k + 1, to: k + 1, name: "стр. " + (k + 1) })) : (i.ranges || []);
      if (!ranges.length) throw new ToolError("Посочете ranges или per_page=true");
      const out = [];
      for (const r of ranges) {
        const from = Math.max(1, Number(r.from) || 1), to = Math.min(n, Number(r.to) || from); if (to < from) throw new ToolError("Невалиден диапазон " + r.from + "-" + r.to);
        const doc = await PDFLib.PDFDocument.create(); const idx = []; for (let k = from - 1; k < to; k++) idx.push(k);
        (await doc.copyPages(src, idx)).forEach((pg) => doc.addPage(pg));
        const buf = Buffer.from(await doc.save()), name = safeName((r.name || d.name.replace(/\.pdf$/i, "") + " (" + from + "-" + to + ")")) + ".pdf", p = artPath(client, name);
        await upload(ctx, p, buf, "application/pdf");
        out.push(Object.assign({ from, to, pages: to - from + 1 }, await registerArtifact(ctx, client, name, p, buf.length, "application/pdf", "Тед", "Тед отдели „" + name + "“ от " + d.name)));
      }
      return { source: { id: d.id, name: d.name, pages: n }, files: out };
    }
  },
  "documents.extract_text": {
    description: "Чете документ (PDF или снимка, включително сканиран – OCR) и връща текста и разпознатия език. Текстът е ограничен до ~20 000 знака.",
    input: schema({ doc_id: S("string", { required: true }), pages: S("string", { max: 40 }) }),
    run: async (ctx, i) => {
      const d = await row(ctx, "documents", i.doc_id), info = await pagesOf(ctx, d); if (info.kind === "other") throw new ToolError("Форматът не се чете: " + (d.mime || ""));
      const t = await gemini([docPart(info), { text: "Извлечи целия текст от документа" + (i.pages ? " (страници " + i.pages + ")" : "") + " точно както е, без да превеждаш и без коментари. На първия ред напиши LANG=<ISO код на основния език>, след това текста. Запази числата, датите, IBAN и таблиците (с | между колоните)." }]);
      const m = t.match(/^LANG=([a-z]{2})/i); return { id: d.id, name: d.name, language: m ? m[1].toLowerCase() : null, pages: info.pages, text: t.replace(/^LANG=[a-z]{2}\s*/i, "").slice(0, 20000) };
    }
  },
  "documents.translate": {
    description: "Превежда документ на български (или друг език) страница по страница с AI и го връща като нов PDF със заглавие „Превод от <език>“ и бележка, че е автоматичен превод за преглед. append_original=true добавя оригинала след превода.",
    input: schema({ doc_id: S("string", { required: true }), target: S("string", { max: 5, default: "bg" }), append_original: S("boolean", { default: false }), title: S("string", { max: 120 }) }),
    run: async (ctx, i) => {
      const d = await row(ctx, "documents", i.doc_id), info = await pagesOf(ctx, d); if (info.kind === "other") throw new ToolError("Форматът не се превежда: " + (d.mime || ""));
      const LANGS = { bg: "български", en: "английски", de: "немски", ru: "руски", uk: "украински", tr: "турски", ro: "румънски", el: "гръцки", it: "италиански", fr: "френски", es: "испански", nl: "нидерландски", pl: "полски" };
      const tgt = LANGS[i.target] || i.target;
      const t = await gemini([docPart(info), { text: "Преведи целия документ на " + tgt + ". Върни САМО JSON: {\"source_language\": ISO код, \"source_language_bg\": името на езика на български, \"pages\": [{\"n\": номер, \"text\": преведеният текст на страницата}]}. Запази имена, числа, валути, IBAN, дати, периоди и реда на таблиците (колони с |). Не съкращавай и не пропускай редове. Без обяснения." }], { json: true });
      const j = parseJson(t), pages = Array.isArray(j.pages) ? j.pages : [];
      if (!pages.length) throw new ToolError("Преводът не върна страници");
      const srcLang = j.source_language_bg || LANGS[j.source_language] || j.source_language || "чужд език";
      const blocks = [{ h1: "Превод от " + srcLang }, { small: "Автоматичен превод с AI – за преглед. Не е заверен превод. Оригинал: " + d.name + " · " + new Date().toLocaleDateString("bg-BG") }, { hr: true }];
      pages.forEach((pg) => { blocks.push({ h2: "Страница " + (pg.n || "") }); blocks.push({ p: String(pg.text || "") }); });
      const tr = await textPdf(blocks, { footer: "Превод от " + srcLang + " · " + d.name });
      let final = tr, total = (await loadPdf(tr)).getPageCount();
      if (i.append_original && info.kind !== "other") { const out = await loadPdf(tr); const n = await appendDoc(out, info); final = Buffer.from(await out.save()); total += n; }
      const client = d.client_id ? await row(ctx, "clients", d.client_id).catch(() => null) : null;
      const name = safeName(i.title || ("Превод – " + d.name.replace(/\.\w+$/, ""))) + ".pdf", p = artPath(client, name);
      await upload(ctx, p, final, "application/pdf");
      return Object.assign({ source_language: j.source_language, pages: total, translated_pages: pages.length, note: "Автоматичен превод – за преглед, не е заверен." }, await registerArtifact(ctx, client, name, p, final.length, "application/pdf", "Преводи", "Тед преведе „" + d.name + "“ от " + srcLang));
    }
  },
  "documents.bank_statements_pack": {
    description: "За клиент: намира банковите извлечения (предпочита преводите, ако prefer_translations), проверява периодите им, подрежда ги по месеци за последните N месеца и ги обединява в един PDF. Връща файла и липсващите месеци. Не измисля документи.",
    input: schema({ client_id: S("string"), client_name: S("string", { max: 120 }), months: S("number", { min: 1, max: 36, default: 12 }), prefer_translations: S("boolean", { default: true }), title: S("string", { max: 120 }) }),
    run: async (ctx, i) => {
      const c = await clientOf(ctx, i.client_id, i.client_name); if (!c) throw new ToolError("Посочете клиент");
      const docs = (await rows(ctx, "documents", (q) => q.eq("client_id", c.id))).filter((d) => /pdf|image/i.test(d.mime || "") || /\.(pdf|jpe?g|png)$/i.test(d.name || ""));
      if (!docs.length) throw new ToolError("Клиентът няма качени документи");
      const found = [];
      for (const d of docs.slice(0, MAX_DOCS)) { try { const info = await pagesOf(ctx, d); const cls = await classifyDoc(info, d.name); if (cls && (cls.type === "банково извлечение" || (cls.type === "превод" && /извлеч|statement|kontoauszug|auszug/i.test(d.name)))) found.push({ d, info, cls }); } catch (e) {} }
      if (!found.length) throw new ToolError("Не открих банкови извлечения сред " + docs.length + " документа на " + c.name);
      const now = new Date(), want = []; for (let k = i.months - 1; k >= 0; k--) { const dt = new Date(now.getFullYear(), now.getMonth() - k, 1); want.push(dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0")); }
      const byMonth = {};
      found.forEach((f) => { const a = f.cls.period_from || f.cls.period_to, b = f.cls.period_to || f.cls.period_from; if (!a) return; let cur = a; while (cur && cur <= b) { (byMonth[cur] = byMonth[cur] || []).push(f); const [y, m] = cur.split("-").map(Number); cur = (m === 12 ? (y + 1) + "-01" : y + "-" + String(m + 1).padStart(2, "0")); if (Object.keys(byMonth).length > 60) break; } });
      const out = await PDFLib.PDFDocument.create(), order = [], missing = [], used = new Set();
      for (const mth of want) {
        let list = byMonth[mth] || []; if (!list.length) { missing.push(mth); continue; }
        if (i.prefer_translations) { const tr = list.filter((f) => f.cls.is_translation || f.cls.language === "bg"); if (tr.length) list = tr; }
        for (const f of list) { if (used.has(f.d.id)) continue; used.add(f.d.id); const n = await appendDoc(out, f.info); order.push({ month: mth, id: f.d.id, name: f.d.name, pages: n, language: f.cls.language, translation: !!f.cls.is_translation }); }
      }
      if (!order.length) throw new ToolError("Има извлечения, но нито едно не е за последните " + i.months + " месеца. Намерени периоди: " + Object.keys(byMonth).sort().join(", "));
      const buf = Buffer.from(await out.save()), name = safeName(i.title || ("Банкови извлечения " + i.months + " м. – " + c.name)) + ".pdf", p = artPath(c, name);
      await upload(ctx, p, buf, "application/pdf");
      return Object.assign({ client: { id: c.id, name: c.name }, pages: out.getPageCount(), months_requested: want, months_missing: missing, included: order }, await registerArtifact(ctx, c, name, p, buf.length, "application/pdf", "Тед", "Тед сглоби извлечения за " + i.months + " м. (" + out.getPageCount() + " стр.)"));
    }
  },
  "documents.create_pdf": {
    description: "Създава PDF от текст, който ти съставяш (отчет, сравнение на имоти, справка). blocks: [{h1},{h2},{p},{small},{hr:true},{table:{rows:[[...]]}}]. Записва се при клиента, ако е посочен.",
    input: schema({ title: S("string", { required: true, max: 120 }), blocks: S("array", { required: true, max: 400 }), client_id: S("string"), client_name: S("string", { max: 120 }) }),
    run: async (ctx, i) => {
      const client = await clientOf(ctx, i.client_id, i.client_name);
      const buf = await textPdf([{ h1: i.title }, { small: "Недвижими Имоти Надежда · " + new Date().toLocaleDateString("bg-BG") }, { hr: true }].concat(i.blocks), { footer: "Недвижими Имоти Надежда · " + i.title });
      const name = safeName(i.title) + ".pdf", p = artPath(client, name); await upload(ctx, p, buf, "application/pdf");
      return Object.assign({ pages: (await loadPdf(buf)).getPageCount() }, await registerArtifact(ctx, client, name, p, buf.length, "application/pdf", "Тед"));
    }
  },
  "contacts.resolve": {
    description: "Намира получател по описание („Калина от Инвестбанк“, „управителят на ДСК“, име на клиент): търси в Компании (служители) и в Клиенти. Връща кандидати с имейл; при повече от един – избор, не изпращай.",
    input: schema({ query: S("string", { required: true, max: 160 }) }),
    run: async (ctx, i) => {
      const q = i.query.toLocaleLowerCase("bg"), words = q.split(/[\s,]+/).filter((w) => w.length > 2 && !/^(от|на|в|и|при|към|за|the|at)$/.test(w));
      const cos = await rows(ctx, "companies"), cl = await rows(ctx, "clients"), out = [];
      cos.forEach((co) => { (co.emps || co.employees || []).forEach((e) => { const hay = [e.name, e.role, co.name].join(" ").toLocaleLowerCase("bg"); const score = words.filter((w) => hay.includes(w)).length; if (score) out.push({ kind: "company_contact", score, name: e.name, role: e.role || "", company: co.name, company_id: co.id, email: e.email || null, phone: e.phone || null }); }); if (co.email) { const hay = String(co.name).toLocaleLowerCase("bg"); const score = words.filter((w) => hay.includes(w)).length; if (score) out.push({ kind: "company", score, name: co.name, company: co.name, company_id: co.id, email: co.email, phone: co.phone || null }); } });
      cl.forEach((c) => { const hay = String(c.name || "").toLocaleLowerCase("bg"); const score = words.filter((w) => hay.includes(w)).length; if (score) out.push({ kind: "client", score, name: c.name, client_id: c.id, email: c.email || null, phone: c.phone || null }); });
      out.sort((a, b) => b.score - a.score);
      const best = out.filter((x) => x.score === (out[0] || {}).score);
      return { candidates: out.slice(0, 10), unambiguous: best.length === 1 && !!best[0].email ? best[0] : null, note: best.length > 1 ? "Няколко съвпадения – покажи ги и попитай кой." : (!out.length ? "Няма съвпадение в Компании и Клиенти." : (!best[0].email ? "Намерен е контакт, но без имейл – поискай имейл." : "")) };
    }
  },
  "email.preview": {
    description: "Подготвя преглед на имейл с прикачени документи (по doc_ids): получател, тема, текст, файлове с брой страници и размер. Нищо не се изпраща.",
    input: schema({ to_email: S("string", { required: true, max: 160 }), to_name: S("string", { max: 120 }), subject: S("string", { required: true, max: 200 }), body: S("string", { required: true, max: 8000 }), doc_ids: S("array", { max: 15, default: [] }) }),
    run: async (ctx, i) => {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.to_email)) throw new ToolError("Невалиден имейл: " + i.to_email);
      const files = []; let total = 0;
      for (const id of i.doc_ids) { const d = await row(ctx, "documents", id); const info = await pagesOf(ctx, d); total += info.size; files.push({ id, name: d.name, pages: info.pages, size_bytes: info.size }); }
      const cfg = await mailbox(ctx);
      return { to: { email: i.to_email, name: i.to_name || "" }, subject: i.subject, body: i.body, attachments: files, total_bytes: total, from: cfg ? cfg.email : null, provider: cfg ? cfg.provider : "none", can_send: !!cfg, note: cfg ? "Ще се изпрати от вашата поща " + cfg.email + " само с confirm=true в email.send след изрично „да“." : "Служителят няма настроена поща за изпращане. Кажи му: CRM → Настройки → „Моята поща за изпращане“ (abv.bg, Gmail, Mail.bg, Outlook…). Дотогава мога да дам mailto линк и линкове към файловете." };
    }
  },
  "email.send": {
    description: "Изпраща имейла от email.preview (изисква confirm=true след изрично „да“ от служителя). Прикача документите (до 25 MB общо), записва активност и одит. Без доставчик връща mailto линк вместо изпращане.",
    input: schema({ to_email: S("string", { required: true, max: 160 }), to_name: S("string", { max: 120 }), subject: S("string", { required: true, max: 200 }), body: S("string", { required: true, max: 8000 }), doc_ids: S("array", { max: 15, default: [] }), client_id: S("string"), confirm: S("boolean", { default: false }) }),
    run: async (ctx, i) => {
      if (!i.confirm) throw new ToolError("Изпращането изисква потвърждение (confirm=true) след изрично „да“ от служителя", 412);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.to_email)) throw new ToolError("Невалиден имейл");
      const atts = [], links = []; let total = 0;
      for (const id of i.doc_ids) { const d = await row(ctx, "documents", id); const buf = await download(ctx, d.path); total += buf.length; atts.push({ filename: d.name, content: buf.toString("base64") }); links.push({ name: d.name, url: await signed(ctx, d.path) }); }
      if (total > 25 * 1048576) throw new ToolError("Прикачените файлове са над 25 MB – изпратете ги като линкове или на части");
      const client = i.client_id ? await row(ctx, "clients", i.client_id).catch(() => null) : null;
      const cfg = await mailbox(ctx);
      if (!cfg) {
        const body = i.body + (links.length ? "\n\nДокументи (линкове, валидни 7 дни):\n" + links.map((l) => "• " + l.name + ": " + l.url).join("\n") : "");
        return { sent: false, need_setup: true, reason: "Нямате настроена поща за изпращане. Настройте я от CRM → Настройки → „Моята поща за изпращане“ (abv.bg, Gmail, Mail.bg, Outlook…). Дотогава – отворете линка, за да изпратите от вашата поща.", mailto: "mailto:" + encodeURIComponent(i.to_email) + "?subject=" + encodeURIComponent(i.subject) + "&body=" + encodeURIComponent(body).slice(0, 6000), links };
      }
      let j;
      try { j = await MAIL.sendAs(cfg, { to: i.to_email, toName: i.to_name || "", subject: i.subject, text: i.body, attachments: atts.map((a) => ({ filename: a.filename, content: Buffer.from(a.content, "base64") })) }); }
      catch (e) { throw new ToolError("Имейлът не е изпратен от " + cfg.email + ": " + MAIL.friendly(e), 502); }
      if (client) await put(ctx, "activities", { client_id: client.id, client: client.name, icon: "mail", text: "Изпратен имейл от " + cfg.email + " до " + i.to_email + ": " + i.subject + (atts.length ? " (" + atts.length + " файла)" : ""), at: new Date().toISOString() }).catch(() => null);
      return { sent: true, from: cfg.email, message_id: j.message_id, to: i.to_email, attachments: atts.length };
    }
  },
  "contracts.generate": {
    description: "Изготвя договор от CRM данните (kind: pre = предварителен договор, broker-seller, broker-buyer, rent, deposit = разписка за капаро, viewing = протокол за оглед, power = пълномощно) и го връща като PDF при клиента. fields: {price, deposit, deadline(YYYY-MM-DD), handover, notary, payment, commission, term, extra …}. Не е заверен документ – за преглед.",
    input: schema({ kind: S("string", { required: true, enum: ["pre", "broker-seller", "broker-buyer", "rent", "deposit", "viewing", "power"] }), client_id: S("string"), client_name: S("string", { max: 120 }), property_id: S("string"), property_code: S("string", { max: 30 }), seller_client_id: S("string"), fields: S("object", { default: {} }) }),
    run: async (ctx, i) => {
      const CT = require("../mobile/crm/crm-contracts.js");
      const c = await clientOf(ctx, i.client_id, i.client_name); if (!c) throw new ToolError("Посочете клиент");
      let p = null;
      if (i.property_id) p = await row(ctx, "properties", i.property_id); else if (i.property_code) { const all = await rows(ctx, "properties"); p = all.filter((x) => String(x.code || "").toLowerCase() === i.property_code.toLowerCase())[0] || null; if (!p) throw new ToolError("Няма имот с код " + i.property_code, 404); }
      const s = i.seller_client_id ? await row(ctx, "clients", i.seller_client_id) : null;
      const f = Object.assign({ date: new Date().toISOString().slice(0, 10), place: "гр. Шумен", commission: 3, copies: 3 }, i.fields || {}); if (!f.price && p && p.price) f.price = p.price;
      const r = CT.render(i.kind, f, c, s, p);
      const blocks = htmlToBlocks(r.html);
      const buf = await textPdf(blocks, { footer: "Недвижими Имоти Надежда · " + r.title }), name = safeName(r.title) + ".pdf", path0 = artPath(c, name);
      await upload(ctx, path0, buf, "application/pdf");
      const missing = (r.html.match(/…{3,}/g) || []).length;
      return Object.assign({ kind: i.kind, title: r.title, pages: (await loadPdf(buf)).getPageCount(), blanks_to_fill: missing, note: "Образец за преглед от служител/адвокат, не е подписан документ." }, await registerArtifact(ctx, c, name, path0, buf.length, "application/pdf", "Договори", "Тед изготви: " + r.title));
    }
  },
  "audit.recent": {
    description: "Последните действия на Тед (одит): кой, кога, какъв инструмент, успех.",
    input: schema({ limit: S("number", { min: 1, max: 100, default: 20 }) }),
    run: async (ctx, i) => { const { data, error } = await ctx.sb.from("nd_audit").select("at,user_email,tool,ok,ms,summary").order("at", { ascending: false }).limit(i.limit); if (error) throw new ToolError(error.message); return { events: data }; }
  }
};

/* audit: every gateway call (success or failure) */
async function audit(sb, user, tool, ok, ms, summary) {
  try { await sb.from("nd_audit").insert({ user_id: user.id, user_email: user.email || "", tool, ok, ms, summary: String(summary || "").slice(0, 300) }); } catch (e) {}
}
const SPEC = Object.entries(tools).map(([n, t]) => "- " + n + ": " + t.description).join("\n");
module.exports = { tools, names: Object.keys(tools), SPEC, audit, ToolError, textPdf };
