// Тед – допълнителни skills към съществуващия action registry (/api/tools).
// Домейни: documents (PDF: обединяване, разделяне, извличане на текст, превод, класификация, сглобяване на извлечения),
// communication (резолвиране на получател, преглед и изпращане на имейл), contracts (договор от CRM данни), reports (PDF от текст).
// Всичко минава през същия bearer token на служителя: Supabase RLS важи, нищо не се изпълнява без права.
"use strict";
const fs = require("fs"), path = require("path");
const PDFLib = require("./_vendor/pdf-lib.min.js");
const fontkit = require("./_vendor/fontkit.umd.min.js");
const WEB = require("./_web.js");
const GEM = require("./_gem.js");
const WM = require("./_wm.js");
let MAIL = null; try { MAIL = require("./email.js"); } catch (e) { MAIL = { configFor: async () => null, sendAs: async () => { throw new Error("email module missing"); }, friendly: (e) => String(e && e.message || e) }; }
// пощата на текущия служител (пази се само на сървъра: nd_secrets smtp:<userId>)
const mailbox = (ctx) => MAIL.configFor(ctx.userId || (ctx.user && ctx.user.id)).catch(() => null);

const BUCKET = "nd-files", SIGN_SECS = 7 * 86400, MAX_PDF_MB = 40, MAX_DOCS = 40;
const GEMINI = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
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
const T = { clients: "nd_clients", properties: "nd_properties", documents: "nd_documents", companies: "nd_companies", activities: "nd_activities", audit: "nd_audit", rentals: "nd_rentals", inquiries: "nd_inquiries", collected: "nd_collected", prefs: "nd_prefs", brokers: "nd_brokers", deals: "nd_deals" };
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
/* Supabase Storage приема само ASCII ключове („Invalid key“ при кирилица): името на файла в хранилището се транслитерира, а в списъка с документи остава на български. */
const TRL = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya" };
function asciiName(name) {
  const s = String(name || "file").toLowerCase().split("").map((c) => TRL[c] !== undefined ? TRL[c] : c).join("").replace(/[^a-z0-9._-]+/g, "-").replace(/-{2,}/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return (s || "file").slice(0, 80);
}
function artPath(client, name) { return (client ? "clients/" + client.id + "/ted/" : "ted/") + Date.now() + "-" + asciiName(name); }

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



/* ---------- имейл: получател, документи по групи, чернова, подател ---------- */
async function resolveContacts(ctx, query) {
  const q = String(query || "").toLocaleLowerCase("bg"), words = q.split(/[\s,]+/).filter((w) => w.length > 2 && !/^(от|на|в|и|при|към|за|the|at|компания|фирма|служител|служителя|служителката|банка)$/.test(w));
  const cos = await rows(ctx, "companies"), cl = await rows(ctx, "clients"), out = [];
  const norm = (t) => String(t || "").toLocaleLowerCase("bg").replace(/\s+/g, "");
  cos.forEach((co) => { (co.emps || co.employees || []).forEach((e) => { const hay = [e.name, e.role, co.name, norm(co.name)].join(" ").toLocaleLowerCase("bg"); const score = words.filter((w) => hay.includes(w) || norm(co.name).includes(w)).length; if (score) out.push({ kind: "company_contact", score, name: e.name, role: e.role || "", company: co.name, company_id: co.id, email: e.email || null, phone: e.phone || null }); }); if (co.email) { const score = words.filter((w) => norm(co.name).includes(w)).length; if (score) out.push({ kind: "company", score: score - 0.5, name: co.name, company: co.name, company_id: co.id, email: co.email, phone: co.phone || null }); } });
  cl.forEach((c) => { const hay = String(c.name || "").toLocaleLowerCase("bg"); const score = words.filter((w) => hay.includes(w)).length; if (score) out.push({ kind: "client", score, name: c.name, client_id: c.id, email: c.email || null, phone: c.phone || null }); });
  out.sort((a, b) => b.score - a.score);
  const best = out.filter((x) => x.score === (out[0] || {}).score);
  return { candidates: out.slice(0, 10), best, unambiguous: best.length === 1 ? best[0] : null };
}
/* имотът, свързан с клиента чрез сделка (капаро / депозит / предварителен договор / оферта), или имот с този клиент */
async function linkedProperty(ctx, client) {
  if (!client) return null;
  const props = await rows(ctx, "properties"), deals = await rows(ctx, "deals").catch(() => []);
  const mine = deals.filter((d) => d.client_id === client.id || String(d.client || "") === client.name).filter((d) => !/Отказана/.test(d.stage || ""));
  const score = (d) => (/капаро|депозит/i.test([d.title, d.note, d.stage].join(" ")) ? 4 : 0) + ({ "Нотариус": 3, "Предварителен договор": 3, "Оферта": 2, "Оглед": 1 }[d.stage] || 0) + (Number(d.paid) > 0 ? 2 : 0);
  mine.sort((a, b) => score(b) - score(a) || String(b.updated_at).localeCompare(String(a.updated_at)));
  const find = (ref) => { const r = String(ref || "").toLocaleLowerCase("bg").trim(); if (!r) return null; return props.find((p) => String(p.code || "").toLocaleLowerCase("bg") === r || p.id === ref) || props.find((p) => r.includes(String(p.code || "§").toLocaleLowerCase("bg"))) || props.find((p) => p.title && r.includes(String(p.title).toLocaleLowerCase("bg"))); };
  for (const d of mine) { const p = find(d.property || d.prop || d.property_code); if (p) return Object.assign({ _deal: { title: d.title, stage: d.stage } }, p); }
  return props.find((p) => String(p.client || "").toLocaleLowerCase("bg") === String(client.name || "").toLocaleLowerCase("bg")) || null;
}
/* група документи → един PDF (снимките стават страници); файловете, които не стават PDF, се прикачат поотделно */
async function groupToFiles(ctx, client, title, docs) {
  const files = [], out = await PDFLib.PDFDocument.create(); let merged = 0;
  for (const d of docs) {
    let info; try { info = await pagesOf(ctx, d); } catch (e) { continue; }
    if (info.kind === "other") { files.push({ name: d.name, path: d.path, size: info.size, mime: d.mime || "application/octet-stream", pages: null }); continue; }
    try { await appendDoc(out, info); merged++; } catch (e) { files.push({ name: d.name, path: d.path, size: info.size, mime: d.mime || "", pages: info.pages }); }
  }
  if (merged) { const buf = Buffer.from(await out.save()), name = safeName(title) + ".pdf", p0 = artPath(client, name); await upload(ctx, p0, buf, "application/pdf"); files.unshift({ name, path: p0, size: buf.length, mime: "application/pdf", pages: out.getPageCount(), parts: merged }); }
  return files;
}
const DRAFT = (ctx) => "maildraft:" + (ctx.userId || (ctx.user && ctx.user.id));
async function senderOf(ctx) {
  const own = await mailbox(ctx);
  if (own) return { cfg: own, kind: "own", from: own.email, reply_to: own.reply_to || undefined }; /* поща на домейна: отговорите – на личния имейл на брокера */
  const ag = await MAIL.configFor("agency").catch(() => null);
  if (ag) {
    let name = (ctx.user && ctx.user.user_metadata && (ctx.user.user_metadata.name || ctx.user.user_metadata.full_name)) || "";
    if (!name) { try { const me = (await rows(ctx, "brokers")).find((b) => String(b.email || "").toLowerCase() === String((ctx.user && ctx.user.email) || "").toLowerCase()); if (me) name = me.name; } catch (e) {} }
    return { cfg: Object.assign({}, ag, { name: (name ? name + " | " : "") + "Имоти Надежда" }), kind: "agency", from: ag.email, reply_to: ctx.user && ctx.user.email };
  }
  return { cfg: null, kind: "none", from: null };
}

/* ---------- снимки: сваляне от интернет и AI генериране/редакция ---------- */
const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|metadata\.)/i;
const IMG_EXT = (mime) => (/png/.test(mime) ? "png" : /webp/.test(mime) ? "webp" : /gif/.test(mime) ? "gif" : "jpg");
async function propByCode(ctx, code) {
  const q = String(code || "").replace(/^[#№\s]+|\s+$/g, "").toLocaleLowerCase("bg"); if (!q) return null;
  const all = await rows(ctx, "properties"), norm = (v) => String(v == null ? "" : v).toLocaleLowerCase("bg").replace(/^#/, "");
  let hit = all.filter((p) => [p.code, p.num, p.ref, p.id].some((v) => norm(v) === q));
  if (!hit.length) hit = all.filter((p) => [p.code, p.num, p.ref].some((v) => norm(v).endsWith(q)));
  if (!hit.length) throw new ToolError("Няма имот с код „" + code + "“", 404);
  if (hit.length > 1) throw new ToolError("Няколко имота съвпадат: " + hit.slice(0, 6).map((p) => p.code + " " + (p.title || "")).join("; ") + " – посочи точния код.");
  return hit[0];
}
async function fetchImage(u) {
  let url; try { url = new URL(u); } catch (e) { return null; }
  if (!/^https?:$/.test(url.protocol) || PRIVATE_HOST.test(url.hostname)) return null;
  const r = await fetch(url.href, { headers: { "User-Agent": WEB.UA, Accept: "image/*" }, signal: AbortSignal.timeout(12000) }).catch(() => null);
  if (!r || !r.ok) return null;
  const mime = String(r.headers.get("content-type") || "").split(";")[0];
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return null;
  const buf = Buffer.from(await r.arrayBuffer()); if (!buf.length || buf.length > 15 * 1048576) return null;
  return { buf, mime };
}
/* записва снимки: към имот (в снимките му), към клиент (в документите) или в папка „Тед“ */
async function saveImages(ctx, items, i, label) {
  const prop = i.property_code ? await propByCode(ctx, i.property_code) : null;
  const client = !prop && (i.client_id || i.client_name) ? await clientOf(ctx, i.client_id, i.client_name) : null;
  const out = [], paths = [];
  for (let [k, it] of items.entries()) {
    /* снимките на обявите винаги са с логото на агенцията в средата (като при „АИ Качване на имот“) */
    if (prop) { try { const st = WM.stamp(it.buf, it.mime); it = { buf: st.buf, mime: st.mime }; } catch (e) {} }
    const ext = IMG_EXT(it.mime), name = safeName((label || "Снимка") + " " + (k + 1)) + "." + ext;
    if (prop) { const p0 = "properties/" + String(prop.code || prop.id).replace(/[^\w\-]/g, "_") + "/photos/" + Date.now() + "-" + k + "." + ext; await upload(ctx, p0, it.buf, it.mime); paths.push(p0); out.push({ name, path: p0, download_url: await signed(ctx, p0) }); }
    else if (client) { const p0 = artPath(client, name); await upload(ctx, p0, it.buf, it.mime); out.push(await registerArtifact(ctx, client, name, p0, it.buf.length, it.mime, "Снимки", "Тед записа снимка: " + name)); }
    else { const p0 = "ted/images/" + new Date().toISOString().slice(0, 10) + "/" + Date.now() + "-" + k + "." + ext; await upload(ctx, p0, it.buf, it.mime); out.push({ name, path: p0, download_url: await signed(ctx, p0) }); }
  }
  if (prop && paths.length) { const upd = Object.assign({}, prop, { pics: (prop.pics || []).concat(paths) }); delete upd.id; delete upd.updated_at; await put(ctx, "properties", upd, prop.id); }
  return { saved_to: prop ? "имот " + (prop.code || prop.id) + " (снимки)" : client ? "клиент " + client.name + " (документи → Снимки)" : "папка „Тед“", images: out };
}

/* ---------- Gemini (documents): text, language, classification, translation ---------- */
async function gemini(parts, opts) {
  if (!GEMINI()) throw new ToolError("Липсва GEMINI_API_KEY на сървъра", 500);
  /* моделът се избира автоматично (_gem.js): най-новият жив Gemini Flash; при 404/лимит – следващият */
  try { const r = await GEM.generate({ parts, json: !!(opts && opts.json), temperature: 0.1, maxTokens: 60000, budgetMs: 50000 }); if (!r.text) throw new Error("празен отговор"); return r.text; }
  catch (e) { throw new ToolError("AI не отговори: " + String(e.message || e), e.quota ? 429 : 502); }
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
  /* ---------- Управление на наеми (crm-naemi.html, nd_rentals) ---------- */
  "rentals.list": {
    description: "Наеми под управление: заглавие, град/квартал, наем на месец, депозит, наемател/наемодател с телефони, падеж, статус (Отдаден / Чака плащане / Свободен / Изтекъл) и дали е платен текущият месец. Филтри: status (rented|due|free|end), text.",
    input: schema({ status: S("string", { enum: ["rented", "due", "free", "end"] }), text: S("string", { max: 120 }) }),
    run: async (ctx, i) => {
      const ym = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Sofia" }).slice(0, 7), today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Sofia" }), day = +today.slice(8, 10);
      const st = (r) => (r.end && r.end < today ? "end" : !r.tenant ? "free" : !(r.payments || []).some((p) => p.month === ym) && day >= (Number(r.payDay) || 1) ? "due" : "rented");
      const TXT = { rented: "Отдаден", due: "Чака плащане", free: "Свободен", end: "Изтекъл" };
      let all = await rows(ctx, "rentals");
      const q = (i.text || "").toLocaleLowerCase("bg");
      all = all.filter((r) => (!i.status || st(r) === i.status) && (!q || [r.title, r.city, r.hood, r.address, r.owner, r.tenant, r.ownerPhone, r.tenantPhone].join(" ").toLocaleLowerCase("bg").includes(q)));
      const list = all.map((r) => ({ id: r.id, title: r.title, city: r.city, hood: r.hood, rent: r.rent, deposit: r.deposit, pay_day: r.payDay, tenant: r.tenant || null, tenant_phone: r.tenantPhone || null, owner: r.owner || null, owner_phone: r.ownerPhone || null, start: r.start || null, end: r.end || null, status: TXT[st(r)], paid_this_month: (r.payments || []).some((p) => p.month === ym) }));
      return { count: list.length, month: ym, monthly_total: list.filter((r) => r.tenant).reduce((a, r) => a + (Number(r.rent) || 0), 0), rentals: list.slice(0, 50) };
    }
  },
  "rentals.create": {
    description: "Добавя наем в „Управление на наеми“: title (задължително), city (задължително), rent (месечен наем, задължително), deposit, payDay (ден от месеца), start/end (YYYY-MM-DD), owner, ownerPhone, tenant, tenantPhone, tenantMail, hood, address, type, rooms, area, notes.",
    input: schema({ title: S("string", { required: true, max: 160 }), city: S("string", { required: true, max: 60 }), rent: S("number", { required: true, min: 1 }), deposit: S("number", { min: 0 }), payDay: S("number", { min: 1, max: 31 }), start: S("string", { max: 10 }), end: S("string", { max: 10 }), owner: S("string", { max: 120 }), ownerPhone: S("string", { max: 40 }), tenant: S("string", { max: 120 }), tenantPhone: S("string", { max: 40 }), tenantMail: S("string", { max: 160 }), hood: S("string", { max: 80 }), address: S("string", { max: 200 }), type: S("string", { max: 60 }), rooms: S("string", { max: 10 }), area: S("string", { max: 10 }), notes: S("string", { max: 2000 }) }),
    run: async (ctx, i) => { const r = await put(ctx, "rentals", Object.assign({ payDay: 1, files: [], payments: [], receipts: [] }, i)); return { id: r.id, title: r.title, rent: r.rent, note: "Наемът е в „Управление на наеми“." }; }
  },
  "rentals.update": {
    description: "Променя наем по id (от rentals.list): всяко поле от rentals.create.",
    input: schema({ id: S("string", { required: true }), title: S("string", { max: 160 }), city: S("string", { max: 60 }), rent: S("number", { min: 1 }), deposit: S("number", { min: 0 }), payDay: S("number", { min: 1, max: 31 }), start: S("string", { max: 10 }), end: S("string", { max: 10 }), owner: S("string", { max: 120 }), ownerPhone: S("string", { max: 40 }), tenant: S("string", { max: 120 }), tenantPhone: S("string", { max: 40 }), tenantMail: S("string", { max: 160 }), notes: S("string", { max: 2000 }) }),
    run: async (ctx, i) => { const cur = await row(ctx, "rentals", i.id); const upd = Object.assign({}, cur, i); delete upd.id; const r = await put(ctx, "rentals", upd, i.id); return { id: r.id, title: r.title, updated: Object.keys(i).filter((k) => k !== "id") }; }
  },
  "rentals.mark_paid": {
    description: "Отбелязва платен наем за месец (month YYYY-MM, по подразбиране текущият) – като бутона „Платен наем – месец“.",
    input: schema({ id: S("string", { required: true }), month: S("string", { max: 7 }), amount: S("number", { min: 0 }) }),
    run: async (ctx, i) => {
      const cur = await row(ctx, "rentals", i.id), month = /^\d{4}-\d{2}$/.test(i.month || "") ? i.month : new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Sofia" }).slice(0, 7);
      const payments = (cur.payments || []).filter((p) => p.month !== month).concat([{ month, amount: i.amount != null ? i.amount : Number(cur.rent) || 0, at: new Date().toISOString() }]);
      const upd = Object.assign({}, cur, { payments }); delete upd.id; await put(ctx, "rentals", upd, i.id);
      return { id: i.id, title: cur.title, month, paid: true };
    }
  },
  /* ---------- Запитвания (nd_inquiries): ипотечни кандидатури, запитвания и огледи от сайта ---------- */
  "inquiries.list": {
    description: "Запитвания от сайта: кандидатури за ипотечен кредит, запитвания и огледи – име, телефон, имейл, обява, статус (Ново/Записан…), дата, приети/общо документи. Филтри: kind (mortgage|inquiry|viewing), status.",
    input: schema({ kind: S("string", { max: 20 }), status: S("string", { max: 30 }) }),
    run: async (ctx, i) => {
      const all = (await rows(ctx, "inquiries")).filter((x) => (!i.kind || x.kind === i.kind) && (!i.status || x.status === i.status));
      return { count: all.length, new: all.filter((x) => x.status === "Ново").length, inquiries: all.slice(0, 40).map((x) => ({ id: x.id, kind: x.kind, status: x.status, name: x.name, phone: x.phone, email: x.email, property: x.property && (x.property.code || x.property.title) || x.property || null, type: x.typeLabel || x.type || null, docs: x.docs ? (x.ok_docs || 0) + "/" + x.docs.length : null, message: x.message ? String(x.message).slice(0, 300) : undefined, at: x.at || x.updated_at })) };
    }
  },
  /* ---------- Събрани обяви (nd_collected) ---------- */
  "collected.list": {
    description: "Събрани обяви от собственици и хора, които търсят (от „Събиране на имоти и клиенти“ и find_owner_listings): заглавие, цена, място, телефон, източник, линк, дата. Филтри: kind (property|wanted|seller), text.",
    input: schema({ kind: S("string", { max: 20 }), text: S("string", { max: 120 }) }),
    run: async (ctx, i) => {
      const q = (i.text || "").toLocaleLowerCase("bg");
      const all = (await rows(ctx, "collected")).filter((x) => x.kind !== "settings" && (!i.kind || x.kind === i.kind) && (!q || [x.title, x.city, x.hood, x.phone, x.text, x.source].join(" ").toLocaleLowerCase("bg").includes(q)));
      return { count: all.length, items: all.slice(0, 40).map((x) => ({ id: x.id, kind: x.kind, title: x.title, price: x.price, city: x.city, hood: x.hood, phone: x.phone, name: x.name, source: x.source, link: x.link, at: x.collected_at, archived: !!x.archived })) };
    }
  },
  /* ---------- Компании и служители (nd_companies) ---------- */
  "companies.create": {
    description: "Добавя партньорска компания в „Компании“: name (задължително), cat (bank = банка, build = строител, interior = интериор, invest = инвеститор, service = услуги), phone, address, email, web, desc.",
    input: schema({ name: S("string", { required: true, max: 160 }), cat: S("string", { enum: ["bank", "build", "interior", "invest", "service"], default: "service" }), phone: S("string", { max: 40 }), address: S("string", { max: 200 }), email: S("string", { max: 160 }), web: S("string", { max: 160 }), desc: S("string", { max: 2000 }) }),
    run: async (ctx, i) => { const r = await put(ctx, "companies", Object.assign({ emps: [] }, i)); return { id: r.id, name: r.name, cat: r.cat }; }
  },
  "companies.add_employee": {
    description: "Добавя служител към компания (company_id от companies.search): name (задължително), role, phone, email.",
    input: schema({ company_id: S("string", { required: true }), name: S("string", { required: true, max: 120 }), role: S("string", { max: 120 }), phone: S("string", { max: 40 }), email: S("string", { max: 160 }) }),
    run: async (ctx, i) => {
      const co = await row(ctx, "companies", i.company_id); const emps = (co.emps || co.employees || []).slice();
      emps.push({ id: "e" + Date.now().toString(36), name: i.name, role: i.role || "", phone: i.phone || "", email: i.email || "" });
      const upd = Object.assign({}, co, { emps }); delete upd.id; delete upd.employees; await put(ctx, "companies", upd, i.company_id);
      return { company: co.name, employee: i.name, employees: emps.length };
    }
  },
  /* ---------- Снимки ---------- */
  "images.download": {
    description: "Сваля снимки от интернет и ги записва в CRM. Подай urls (линкове към снимки) или page_url (страница с обява – взимат се снимките от нея). Записва ги към имот (property_code → добавят се към снимките на имота), към клиент (client_id / client_name → в документите) или в папка „Тед“. Връща линкове за изтегляне.",
    input: schema({ urls: S("array", { max: 30, default: [] }), page_url: S("string", { max: 600 }), property_code: S("string", { max: 40 }), client_id: S("string"), client_name: S("string", { max: 120 }), max: S("number", { min: 1, max: 30, default: 15 }) }),
    run: async (ctx, i) => {
      let urls = (i.urls || []).map(String).filter((u) => /^https?:\/\//.test(u));
      if (!urls.length && i.page_url) { const pg = await WEB.readPage(i.page_url, 15000); if (pg.blocked) throw new ToolError(pg.reason || "Страницата не може да се прочете"); urls = (pg.images || []).filter((u) => /^https?:\/\//.test(u) && !/logo|icon|sprite|avatar|banner|\.svg/i.test(u)); }
      if (!urls.length) throw new ToolError("Няма снимки за сваляне – дай линкове към снимки или страница с обява.");
      const got = [];
      for (const u of [...new Set(urls)].slice(0, i.max || 15)) { const im = await fetchImage(u); if (im && im.buf.length > 15000) got.push(im); }
      if (!got.length) throw new ToolError("Не успях да сваля нито една снимка (сайтът ги пази или не са снимки).");
      return Object.assign({ downloaded: got.length, of: urls.length }, await saveImages(ctx, got, i, "Снимка от интернет"));
    }
  },
  "images.generate": {
    description: "Генерира нова снимка или редактира съществуваща с AI (Gemini): prompt = какво да се направи (напр. „виртуално обзаведен хол в светли тонове“, „махни логото на агенцията“, „направи снимката по-светла“, „празен парцел без къщата“). За редакция подай property_code + photo_index (1 = първата снимка на имота) или source_path. save_to_property=true добавя резултата към снимките на имота; иначе към клиента или в папка „Тед“. aspect: 1:1, 4:3, 3:4, 16:9, 9:16. Резултатът е AI визуализация.",
    input: schema({ prompt: S("string", { required: true, max: 2000 }), property_code: S("string", { max: 40 }), photo_index: S("number", { min: 1, max: 100, default: 1 }), source_path: S("string", { max: 400 }), save_to_property: S("boolean", { default: false }), client_id: S("string"), client_name: S("string", { max: 120 }), aspect: S("string", { enum: ["1:1", "4:3", "3:4", "16:9", "9:16"] }) }),
    run: async (ctx, i) => {
      if (!GEMINI()) throw new ToolError("Липсва GEMINI_API_KEY на сървъра", 500);
      let src = null, prop = null;
      if (i.source_path) src = { buf: await download(ctx, i.source_path), path: i.source_path };
      else if (i.property_code) { prop = await propByCode(ctx, i.property_code); const pth = (prop.pics || [])[(i.photo_index || 1) - 1]; if (pth) src = { buf: await download(ctx, pth), path: pth }; else if (!/нов|генерирай|създай/i.test(i.prompt)) throw new ToolError("Имот " + (prop.code || prop.id) + " няма снимка №" + (i.photo_index || 1)); }
      const parts = [{ text: (src ? "Редактирай прикачената снимка на имот: " : "Създай реалистична снимка за агенция за недвижими имоти: ") + i.prompt + (src ? " Запази всичко останало непроменено (кадър, перспектива, светлина, размери), освен ако не е поискано друго. Махни всички лога и водни знаци, включително бледото лого в средата – логото на агенцията се добавя отново автоматично." : "") + " Без надписи, лога и водни знаци." }];
      if (src) parts.push({ inline_data: { mime_type: /\.png$/i.test(src.path) ? "image/png" : /\.webp$/i.test(src.path) ? "image/webp" : "image/jpeg", data: src.buf.toString("base64") } });
      const ids = await GEM.models("image"); let last = "", img = null, used = null;
      for (const m of ids.slice(0, 4)) {
        let gc = Object.assign({ responseModalities: ["IMAGE", "TEXT"] }, i.aspect ? { imageConfig: { aspectRatio: i.aspect } } : {});
        for (let attempt = 0; attempt < 2 && !img; attempt++) {
          const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent?key=" + encodeURIComponent(GEMINI()), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: gc }), signal: AbortSignal.timeout(50000) }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: String(e.message || e) } }) }));
          const j = await r.json().catch(() => ({}));
          if (!r.ok) { const cl = GEM.classify(m, r.status, j); last = cl.kind === "quota" ? "безплатният лимит за снимки е изчерпан" + (cl.daily ? " за днес" : " – опитайте след минута") : cl.msg; if (cl.kind === "bad" && gc.imageConfig && /image_?config|aspect/i.test(cl.msg)) { gc = { responseModalities: ["IMAGE", "TEXT"] }; continue; } break; }
          const part = ((((j.candidates || [])[0] || {}).content || {}).parts || []).find((x) => (x.inlineData || x.inline_data) && (x.inlineData || x.inline_data).data);
          if (part) { const d = part.inlineData || part.inline_data; img = { buf: Buffer.from(d.data, "base64"), mime: d.mimeType || d.mime_type || "image/png" }; used = m; } else { last = "моделът не върна снимка"; break; }
        }
        if (img) break;
      }
      if (!img) throw new ToolError("Снимката не е генерирана: " + last, /лимит/.test(last) ? 429 : 502);
      const target = Object.assign({}, i, { property_code: i.save_to_property && (prop || i.property_code) ? (prop ? prop.code || prop.id : i.property_code) : undefined });
      return Object.assign({ model: used, edited: !!src, note: "AI визуализация – при публикуване я обозначете като такава." }, await saveImages(ctx, [img], target, src ? "AI редакция" : "AI снимка"));
    }
  },
  "contacts.resolve": {
    description: "Намира получател по описание („Калина от Инвестбанк“, „управителят на ДСК“, име на клиент): търси в Компании (служители) и в Клиенти. Връща кандидати с имейл; при повече от един – избор, не изпращай.",
    input: schema({ query: S("string", { required: true, max: 160 }) }),
    run: async (ctx, i) => { const r = await resolveContacts(ctx, i.query); return { candidates: r.candidates, unambiguous: r.unambiguous && r.unambiguous.email ? r.unambiguous : null, note: r.best.length > 1 ? "Няколко съвпадения – покажи ги и попитай кой." : (!r.candidates.length ? "Няма съвпадение в Компании и Клиенти." : (!r.best[0].email ? "Намерен е контакт, но без имейл – поискай имейл." : "")) }; }
  },
  "email.preview": {
    description: "Подготвя имейл и го показва в чата (нищо не се изпраща). Получател: to_email (точен адрес – abv.bg, gmail и всеки друг) или to_query (напр. „Калина ИнвестБанк“ – търси в Компании/служители и Клиенти). Документи: doc_ids и/или client_name/client_id + include_client_docs=true и/или property_code / include_property_docs=true (свързаният с клиента имот с капаро/депозит се намира сам). По подразбиране се прикачват самите файлове с истинските им имена; merge=true ги обединява в PDF „Документи на имота …“ / „Документи на клиента …“ само ако служителят го поиска. Преводите и другите файлове, направени от Тед, не се прикачват, освен при include_generated=true или doc_filter. Запазва черновата – след „да“ се праща с email.send {confirm:true}.",
    input: schema({ to_email: S("string", { max: 160 }), to_query: S("string", { max: 160 }), to_name: S("string", { max: 120 }), subject: S("string", { required: true, max: 200 }), body: S("string", { required: true, max: 8000 }), doc_ids: S("array", { max: 15, default: [] }), client_id: S("string"), client_name: S("string", { max: 120 }), property_code: S("string", { max: 40 }), include_client_docs: S("boolean", { default: false }), include_property_docs: S("boolean", { default: false }), doc_filter: S("string", { max: 80 }), merge: S("boolean", { default: false }), include_generated: S("boolean", { default: false }) }),
    run: async (ctx, i) => {
      /* 1) получател */
      let to = i.to_email ? { email: i.to_email.trim(), name: i.to_name || "" } : null;
      if (!to && i.to_query) {
        const r = await resolveContacts(ctx, i.to_query);
        if (!r.candidates.length) return { need_recipient: true, note: "Няма „" + i.to_query + "“ в Компании и Клиенти – попитай за точния имейл." };
        if (!r.unambiguous) return { need_choice: true, candidates: r.best.slice(0, 6), note: "Няколко съвпадения – покажи ги и попитай на кого." };
        if (!r.unambiguous.email) return { need_email: true, contact: r.unambiguous, note: "„" + r.unambiguous.name + "“ няма записан имейл – попитай за адреса (може и да го добави в Компании)." };
        to = { email: r.unambiguous.email, name: r.unambiguous.name + (r.unambiguous.company && r.unambiguous.kind === "company_contact" ? " (" + r.unambiguous.company + ")" : "") };
      }
      if (!to) throw new ToolError("Кажи на кого: име от Компании/Клиенти или точен имейл адрес.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.email)) throw new ToolError("Невалиден имейл: " + to.email);
      /* 2) документи: имот → клиент → други (в този ред) */
      const client = (i.client_id || i.client_name) ? await clientOf(ctx, i.client_id, i.client_name) : null;
      let prop = i.property_code ? await propByCode(ctx, i.property_code) : null;
      if (!prop && client && i.include_property_docs) prop = await linkedProperty(ctx, client);
      const flt = (d) => !i.doc_filter || String([d.name, d.folder, d.type].join(" ")).toLocaleLowerCase("bg").includes(i.doc_filter.toLocaleLowerCase("bg"));
      const groups = [];
      if (prop && (i.include_property_docs || i.property_code)) { const pd = (prop.docs || []).filter((d) => d && d.path).filter(flt); if (pd.length) groups.push({ title: "Документи на имота " + (prop.code || "") + (prop.title ? " – " + prop.title : ""), docs: pd }); }
      if (client && i.include_client_docs) { const cd = (await rows(ctx, "documents")).filter((d) => d.client_id === client.id && d.path && d.by !== "ted-mail" && (i.include_generated || i.doc_filter || d.by !== "ted")).filter(flt); /* оригиналите – без преводите/пакетите на Тед, освен ако са поискани */ if (cd.length) groups.push({ title: "Документи на клиента " + client.name, docs: cd }); }
      if (i.doc_ids.length) { const ex = []; for (const id of i.doc_ids) ex.push(await row(ctx, "documents", id)); groups.push({ title: "Документи" + (client ? " – " + client.name : ""), docs: ex }); }
      let atts = [];
      for (const g of groups) {
        if (i.merge) atts = atts.concat(await groupToFiles(ctx, client, g.title, g.docs));
        else for (const d of g.docs) { const info = await pagesOf(ctx, d).catch(() => null); atts.push({ name: d.name, path: d.path, size: info ? info.size : d.size || 0, mime: d.mime || "", pages: info ? info.pages : null }); }
      }
      const total = atts.reduce((a, x) => a + (x.size || 0), 0);
      if (total > 25 * 1048576) throw new ToolError("Документите са " + Math.round(total / 1048576) + " MB – над 25 MB. Ограничи ги (doc_filter) или изпрати на части.");
      /* 3) подател и чернова */
      const snd = await senderOf(ctx);
      const draft = { kind: "maildraft", to, subject: i.subject, body: i.body, attachments: atts, client_id: client ? client.id : null, client: client ? client.name : "", property: prop ? prop.code || prop.id : null, at: new Date().toISOString() };
      await put(ctx, "prefs", draft, DRAFT(ctx));
      const shown = [];
      for (const x of atts) shown.push({ name: x.name, pages: x.pages, size_kb: Math.round((x.size || 0) / 1024), download_url: await signed(ctx, x.path).catch(() => null) });
      return { draft_saved: true, to, subject: i.subject, body: i.body, attachments: shown, total_kb: Math.round(total / 1024), property: prop ? { code: prop.code, title: prop.title, deal: prop._deal || undefined } : null, from: snd.from, sender: snd.kind, reply_to: snd.reply_to || undefined, can_send: !!snd.cfg,
        ask: "Да го изпратя ли?", note: snd.cfg ? "Покажи прегледа и попитай „Да го изпратя ли?“. При „да“ → email.send {confirm:true} без други полета." : "Няма поща за изпращане – извикай open_panel {panel:\"mail\"} (еднократно: само паролата на пощата, или обща поща на агенцията)." };
    }
  },
  "email.send": {
    description: "Изпраща подготвения с email.preview имейл (черновата се пази) – само confirm=true след „да“ от служителя; други полета не са нужни. Праща от пощата на служителя, а ако няма – от общата поща на агенцията с отговор към служителя. Записва активност при клиента.",
    input: schema({ confirm: S("boolean", { default: false }), to_email: S("string", { max: 160 }), to_name: S("string", { max: 120 }), subject: S("string", { max: 200 }), body: S("string", { max: 8000 }), doc_ids: S("array", { max: 15, default: [] }), client_id: S("string") }),
    run: async (ctx, i) => {
      if (!i.confirm) throw new ToolError("Изпращането изисква потвърждение (confirm=true) след изрично „да“ от служителя", 412);
      let d = null;
      if (!i.to_email) {
        const { data } = await ctx.sb.from("nd_prefs").select("id,data,updated_at").eq("id", DRAFT(ctx)).maybeSingle();
        d = data && data.data && data.data.kind === "maildraft" && !data.data.sent ? data.data : null;
        if (!d) throw new ToolError("Няма подготвен имейл – първо email.preview.");
        if (Date.now() - Date.parse(d.at || 0) > 6 * 3600000) throw new ToolError("Черновата е по-стара от 6 часа – подготви я отново (email.preview).");
      } else {
        d = { to: { email: i.to_email, name: i.to_name || "" }, subject: i.subject || "", body: i.body || "", attachments: [], client_id: i.client_id || null };
        for (const id of i.doc_ids) { const doc = await row(ctx, "documents", id); d.attachments.push({ name: doc.name, path: doc.path, mime: doc.mime }); }
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.to.email)) throw new ToolError("Невалиден имейл");
      const atts = []; let total = 0;
      for (const a of d.attachments || []) { const buf = await download(ctx, a.path); total += buf.length; atts.push({ filename: a.name, content: buf }); }
      if (total > 25 * 1048576) throw new ToolError("Прикачените файлове са над 25 MB");
      const snd = await senderOf(ctx);
      if (!snd.cfg) {
        const links = []; for (const a of d.attachments || []) links.push({ name: a.name, url: await signed(ctx, a.path).catch(() => "") });
        const body = d.body + (links.length ? "\n\nДокументи (линкове, валидни 7 дни):\n" + links.map((l) => "• " + l.name + ": " + l.url).join("\n") : "");
        return { sent: false, need_setup: true, reason: "Няма поща за изпращане. Еднократно: въведете паролата на пощата си (или общата поща на агенцията) в панела „Моята поща“ тук в чата.", mailto: "mailto:" + encodeURIComponent(d.to.email) + "?subject=" + encodeURIComponent(d.subject) + "&body=" + encodeURIComponent(body).slice(0, 6000), links };
      }
      let j;
      try { j = await MAIL.sendAs(snd.cfg, { to: d.to.email, toName: d.to.name || "", subject: d.subject, text: d.body, attachments: atts, replyTo: snd.reply_to, cc: snd.kind === "agency" ? snd.reply_to : undefined }); }
      catch (e) { throw new ToolError("Имейлът не е изпратен от " + snd.from + ": " + MAIL.friendly(e), 502); }
      const client = d.client_id ? await row(ctx, "clients", d.client_id).catch(() => null) : null;
      if (client) await put(ctx, "activities", { client_id: client.id, client: client.name, icon: "mail", text: "Изпратен имейл от " + snd.from + " до " + d.to.email + ": " + d.subject + (atts.length ? " (" + atts.length + " файла: " + atts.map((a) => a.filename).join(", ") + ")" : ""), at: new Date().toISOString() }).catch(() => null);
      if (!i.to_email) await put(ctx, "prefs", Object.assign({}, d, { sent: true, sent_at: new Date().toISOString() }), DRAFT(ctx)).catch(() => null);
      return { sent: true, from: snd.from, via: snd.kind === "agency" ? "общата поща на агенцията (отговорите идват при вас, копие до " + snd.reply_to + ")" : "вашата поща", to: d.to.email, to_name: d.to.name, subject: d.subject, attachments: atts.map((a) => a.filename), message_id: j.message_id };
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
  "video.create": {
    description: "AI видео на имот: „разходка“ от реалните снимки на обявата (клипове по двойки с припокриване) или „строеж“ (от празен парцел до готовия имот). Подай code = референтният номер/# на обявата („#IM-123“, „обява 1042“, кода P-1001) или from_attachments=true, когато брокерът е прикачил снимки в чата. Инструментът само подготвя задачата – самото видео се прави в прозореца на Тед (умение „AI Видео на имот“) и се връща в чата с линк; логото на агенцията е по средата.",
    input: schema({ code: S("string", { max: 60 }), mode: S("string", { enum: ["walk", "build"], default: "walk" }), from_attachments: S("boolean", { default: false }) }),
    run: async (ctx, i) => {
      if (!i.code && !i.from_attachments) throw new ToolError("Кажи номера на обявата (#…) или прикачи снимки.");
      if (!i.code) return { start_video: { mode: i.mode || "walk", from_attachments: true }, note: "Видеото се подготвя от прикачените снимки в прозореца на Тед." };
      const q = String(i.code).replace(/^[#№\s]+|\s+$/g, "").toLocaleLowerCase("bg");
      const props = await rows(ctx, "properties");
      const norm = (v) => String(v == null ? "" : v).toLocaleLowerCase("bg").replace(/^#/, "");
      let hit = props.filter((p) => [p.code, p.num, p.ref, p.id].some((v) => norm(v) === q));
      if (!hit.length) hit = props.filter((p) => [p.code, p.num, p.ref].some((v) => norm(v).endsWith(q) || norm(v).replace(/^[a-zа-я]+-?/, "") === q));
      if (!hit.length) hit = props.filter((p) => norm(p.title).includes(q));
      if (!hit.length) throw new ToolError("Не намирам обява с номер „" + i.code + "“. Провери кода (напр. P-1001).", 404);
      if (hit.length > 1) return { candidates: hit.slice(0, 8).map((p) => ({ id: p.id, code: p.code, title: p.title, city: p.city, photos: (p.pics || []).length })), note: "Няколко обяви съвпадат – попитай коя." };
      const p = hit[0]; const n = (p.pics || []).length;
      if (!n) throw new ToolError("Обява " + (p.code || p.id) + " няма качени снимки – прикачи снимки в чата.");
      return { start_video: { mode: i.mode || "walk", property: { id: p.id, code: p.code, title: p.title, city: p.city, hood: p.hood, photos: n } }, note: "Задачата е подадена към умението „AI Видео на имот“ – клиповете се генерират един по един (около минута всеки), готовото видео се появява в чата." };
    }
  },
  "calendar.assign": {
    description: "Възлага събитие/задача от календара на конкретен брокер по име (напр. „Миро“, „Надежда“). Той получава известие на телефона веднага, после 2 ч и 1 ч преди часа; без потвърждение до 10 мин екипът се уведомява. Ползвай след calendar.create, когато задачата е за друг човек.",
    input: schema({ id: S("string", { required: true }), broker_name: S("string", { max: 80 }), user_id: S("string") }),
    run: async (ctx, i) => {
      const ev = await ctx.sb.from("nd_events").select("id,data").eq("id", i.id).maybeSingle(); if (ev.error || !ev.data) throw new ToolError("Няма събитие " + i.id, 404);
      let uid = i.user_id || null, name = "";
      if (!uid) {
        if (!i.broker_name) throw new ToolError("Посочете broker_name или user_id");
        const q = i.broker_name.toLocaleLowerCase("bg"), all = await ctx.sb.from("nd_brokers").select("id,data"); if (all.error) throw new ToolError(all.error.message);
        const hits = (all.data || []).filter((b) => b.data && b.data.user_id && String(b.data.name || "").toLocaleLowerCase("bg").split(/\s+/).some((w) => w.startsWith(q) || q.startsWith(w) && w.length > 2));
        if (!hits.length) throw new ToolError("Няма брокер с име „" + i.broker_name + "“ с акаунт в CRM. Налични: " + (all.data || []).filter((b) => b.data && b.data.user_id).map((b) => b.data.name).join(", "), 404);
        if (hits.length > 1) throw new ToolError("Няколко брокери отговарят: " + hits.map((b) => b.data.name).join(", ") + ". Уточнете.", 409);
        uid = hits[0].data.user_id; name = hits[0].data.name;
      }
      const data = Object.assign({}, ev.data.data, { assignee: uid, assignee_name: name });
      const up = await ctx.sb.from("nd_events").update({ data }).eq("id", i.id); if (up.error) throw new ToolError(up.error.message);
      return { id: i.id, assignee: uid, assignee_name: name, note: "Брокерът ще получи известие на телефона веднага, 2 ч и 1 ч преди часа; без потвърждение до 10 мин – известие до екипа." };
    }
  },
  /* ---------- памет и казуси ---------- */
  "memory.remember": {
    description: "Запомня траен факт в дългосрочната памет на Тед (за агенцията/брокера или за активния казус, ако е подаден case_id): предпочитания, правила, важни данни за клиент/имот/сделка. Ползвай при „запомни“, „имай предвид“, „отсега нататък“.",
    input: schema({ text: S("string", { required: true, max: 1500 }), case_id: S("string") }),
    run: async (ctx, i) => { const { error } = await ctx.sb.from("nd_ted_memory").insert({ user_id: ctx.userId, case_id: i.case_id || null, kind: "fact", role: "user", content: i.text }); if (error) throw new ToolError(error.message); return { remembered: true, text: i.text, scope: i.case_id ? "казус" : "дългосрочна памет" }; }
  },
  "memory.search": {
    description: "Търси в паметта на Тед (факти, резюмета и минали разговори) по ключови думи; по желание само в даден казус. Връща до 20 съвпадения с дата.",
    input: schema({ query: S("string", { required: true, max: 200 }), case_id: S("string"), limit: S("number", { min: 1, max: 20, default: 12 }) }),
    run: async (ctx, i) => {
      const words = i.query.toLocaleLowerCase("bg").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2).slice(0, 5); if (!words.length) throw new ToolError("Дайте поне една дума");
      let qb = ctx.sb.from("nd_ted_memory").select("id,case_id,kind,role,content,created_at").or(words.map((w) => "content.ilike.%" + w.replace(/[%,()]/g, "") + "%").join(",")).order("created_at", { ascending: false }).limit(i.limit);
      if (i.case_id) qb = qb.eq("case_id", i.case_id);
      const { data, error } = await qb; if (error) throw new ToolError(error.message);
      return { count: (data || []).length, items: (data || []).map((m) => ({ id: m.id, case_id: m.case_id, kind: m.kind, role: m.role, at: m.created_at, text: String(m.content).slice(0, 700) })) };
    }
  },
  "memory.forget": {
    description: "Изтрива запомнен факт по id (от memory.search) – само след изрично искане на служителя.",
    input: schema({ id: S("string", { required: true }) }),
    run: async (ctx, i) => { const { error } = await ctx.sb.from("nd_ted_memory").delete().eq("id", i.id).eq("kind", "fact"); if (error) throw new ToolError(error.message); return { deleted: true }; }
  },
  "cases.list": {
    description: "Списък на казусите (проектите) на агенцията: id, заглавие, клиент, статус, резюме, последна активност. Казусът е тема с безкрайна памет (напр. сделка, спор, клиент, безплатен правен казус).",
    input: schema({ status: S("string", { enum: ["open", "closed", "all"], default: "open" }), query: S("string", { max: 120 }) }),
    run: async (ctx, i) => {
      let qb = ctx.sb.from("nd_ted_cases").select("id,title,client,client_id,status,summary,updated_at,created_at,user_id").order("updated_at", { ascending: false }).limit(100);
      if (i.status !== "all") qb = qb.eq("status", i.status);
      const { data, error } = await qb; if (error) throw new ToolError(error.message);
      const qq = (i.query || "").toLocaleLowerCase("bg");
      return { cases: (data || []).filter((c) => !qq || [c.title, c.client, c.summary].join(" ").toLocaleLowerCase("bg").includes(qq)).map((c) => ({ id: c.id, title: c.title, client: c.client, status: c.status, updated_at: c.updated_at, summary: c.summary ? String(c.summary).slice(0, 400) : "" })) };
    }
  },
  "cases.create": {
    description: "Създава нов казус (проект) с безкрайна памет: заглавие, по желание клиент (име или id) и начално описание. Връща id – кажи на служителя да го избере от „Казус“ в чата или продължи в него.",
    input: schema({ title: S("string", { required: true, max: 160 }), client_id: S("string"), client_name: S("string", { max: 120 }), description: S("string", { max: 4000 }) }),
    run: async (ctx, i) => {
      const c = await clientOf(ctx, i.client_id, i.client_name).catch(() => null);
      const row = { user_id: ctx.userId, title: i.title, client: c ? c.name : (i.client_name || ""), client_id: c ? c.id : null, status: "open", summary: i.description || "" };
      const { data, error } = await ctx.sb.from("nd_ted_cases").insert(row).select("id,title").single(); if (error) throw new ToolError(error.message);
      if (i.description) await ctx.sb.from("nd_ted_memory").insert({ user_id: ctx.userId, case_id: data.id, kind: "fact", role: "user", content: i.description }).then(() => null, () => null);
      return { id: data.id, title: data.title, note: "Казусът е създаден. Всичко, казано в него, се помни без ограничение." };
    }
  },
  "cases.update": {
    description: "Обновява казус: заглавие, статус (open/closed), резюме (замества), клиент.",
    input: schema({ id: S("string", { required: true }), title: S("string", { max: 160 }), status: S("string", { enum: ["open", "closed"] }), summary: S("string", { max: 6000 }), client_name: S("string", { max: 120 }) }),
    run: async (ctx, i) => {
      const patch = { updated_at: new Date().toISOString() }; ["title", "status", "summary"].forEach((k) => { if (i[k] !== undefined) patch[k] = i[k]; }); if (i.client_name) patch.client = i.client_name;
      const { data, error } = await ctx.sb.from("nd_ted_cases").update(patch).eq("id", i.id).select("id,title,status").single(); if (error) throw new ToolError(error.message); return data;
    }
  },
  "cases.get": {
    description: "Пълна информация за казус: данни, резюме, факти и последните 40 съобщения.",
    input: schema({ id: S("string", { required: true }) }),
    run: async (ctx, i) => {
      const { data: c, error } = await ctx.sb.from("nd_ted_cases").select("*").eq("id", i.id).maybeSingle(); if (error) throw new ToolError(error.message); if (!c) throw new ToolError("Няма казус " + i.id, 404);
      const { data: m } = await ctx.sb.from("nd_ted_memory").select("kind,role,content,created_at").eq("case_id", i.id).order("created_at", { ascending: false }).limit(40);
      return { kase: c, facts: (m || []).filter((x) => x.kind === "fact").map((x) => x.content), messages: (m || []).filter((x) => x.kind === "message").reverse().map((x) => ({ role: x.role, at: x.created_at, text: String(x.content).slice(0, 1200) })) };
    }
  },
  "audit.recent": {
    description: "Последните действия на Тед (одит): кой, кога, какъв инструмент, успех.",
    input: schema({ limit: S("number", { min: 1, max: 100, default: 20 }) }),
    run: async (ctx, i) => { const { data, error } = await ctx.sb.from("nd_audit").select("at,user_email,tool,ok,ms,summary").order("at", { ascending: false }).limit(i.limit); if (error) throw new ToolError(error.message); return { events: data }; }
  },
  /* „Събиране на имоти и клиенти“ – същото като find_owner_listings / collect_page в чата на сайта, достъпно и за агента в n8n през /api/tools */
  "listings.find_owners": {
    description: "Намира в интернет обяви на имоти ОТ СОБСТВЕНИЦИ (без агенции) за село, град или област в България: заглавие, цена, площ, телефон (ако е в обявата), линк, източник. Записва ги в „Събрани“. Нужно е place или region.",
    input: schema({ place: S("string", { max: 120 }), region: S("string", { max: 120 }), type: S("string", { max: 60 }), deal: S("string", { enum: ["sale", "rent"] }), max_price: S("number", { min: 0 }) }),
    run: async (ctx, i) => {
      if (!ctx.token) throw new ToolError("Влезте в CRM.", 401);
      const OWNERS = require("./_owners.js");
      return OWNERS.findOwners({ token: ctx.token, staff: true }, Object.assign({ budget_ms: 45000 }, i));
    }
  },
  "listings.collect_page": {
    description: "Събиране от конкретен източник: чете публична страница с обяви (url) или поставен текст на пост от група (text) и пази само частните обяви без агенции (с телефон) и хората, които търсят/предлагат. Записва ги в „Събрани“ (без дубликати).",
    input: schema({ url: S("string", { max: 1000 }), text: S("string", { max: 20000 }), source: S("string", { max: 80 }), keywords: S("string", { max: 300 }) }),
    run: async (ctx, i) => {
      if (!ctx.token) throw new ToolError("Влезте в CRM.", 401);
      if (!i.url && !i.text) throw new ToolError("Дай линк (url) или текст на поста (text).");
      const r = await fetch("https://imotinadezhda.bg/api/collect", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + ctx.token }, body: JSON.stringify({ url: i.url || "", text: i.text || "", source: i.source || "", keywords: i.keywords || "без посредник, от собственик, без комисионна, лично", properties: true, clients: true }) });
      const j = await r.json().catch(() => ({ ok: false, error: "HTTP " + r.status }));
      if (!j || !j.ok) throw new ToolError((j && j.error) || "Страницата не се прочете", 502);
      const items = Array.isArray(j.items) ? j.items : [];
      let saved = 0;
      if (items.length) {
        const nk = (x) => String(x.phone || "").split(",")[0].trim() + "|" + String(x.text || x.title || "").toLowerCase().replace(/[^a-zа-я0-9]+/gi, " ").trim().slice(0, 120);
        const { data: ex } = await ctx.sb.from("nd_collected").select("data");
        const have = new Set((ex || []).map((r2) => nk(r2.data || {})));
        const rows = items.filter((x) => !have.has(nk(x))).map((x) => ({ name: x.title || x.name || "Обява", data: Object.assign({}, x, { source: i.source || x.source || "", found_by: "Тед" }) }));
        if (rows.length) { const { error } = await ctx.sb.from("nd_collected").insert(rows); if (!error) saved = rows.length; }
      }
      return { found: items.length, saved_to_collected: saved, skipped: j.skipped || {}, items: items.slice(0, 20).map((x) => ({ kind: x.kind, title: x.title, price: x.price, city: x.city, hood: x.hood, phone: x.phone, name: x.name, link: x.link, wants: x.wants || undefined })), note: "Записани са в „Събрани“; оттам „Запамети в архив“ ги прехвърля в Имоти/Клиенти." };
    }
  }
};

/* audit: every gateway call (success or failure) */
async function audit(sb, user, tool, ok, ms, summary) {
  try { await sb.from("nd_audit").insert({ user_id: user.id, user_email: user.email || "", tool, ok, ms, summary: String(summary || "").slice(0, 300) }); } catch (e) {}
}
const SPEC = Object.entries(tools).map(([n, t]) => "- " + n + ": " + t.description).join("\n");
module.exports = { tools, names: Object.keys(tools), SPEC, audit, ToolError, textPdf };
