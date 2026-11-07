// /api/apply – кандидатстване за ипотечен кредит от публичната страница на имота (без вход).
// check  → проверява един документ с Gemini (вид, за кой месец е, на чие име) и го записва в nd-files (inquiries/<app>/…)
// submit → записва кандидатурата в nd_inquiries (CRM → „Запитвания“) и известие в nd_activities
// Ключовете са само във Vercel (GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY). Лимит: 60 заявки / 15 мин на IP.
"use strict";
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const GKEY = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const GEM = require("./_gem.js");
const MAX = 4.3 * 1048576;
const BG_M = ["януари", "февруари", "март", "април", "май", "юни", "юли", "август", "септември", "октомври", "ноември", "декември"];
const TYPES = { bank_statement: "банково извлечение", id_card: "лична карта", passport: "паспорт", employment_contract: "трудов договор", income_certificate: "служебна бележка / удостоверение за доход", payslip: "фиш за заплата", tax_return: "данъчна декларация", company_registration: "удостоверение за регистрация / актуално състояние", financial_statement: "финансов отчет (баланс / ОПР)", residence_permit: "разрешение за пребиваване", preliminary_contract: "предварителен договор / оферта", other: "друг документ" };
const EXPECT = { statement: ["bank_statement"], payslip: ["payslip", "income_certificate"], id_front: ["id_card", "passport"], id_back: ["id_card", "passport"], contract: ["employment_contract"], income: ["income_certificate", "employment_contract", "payslip"], tax: ["tax_return", "financial_statement"], company: ["company_registration"], fin: ["financial_statement", "tax_return"], permit: ["residence_permit", "id_card", "passport"], prelim: ["preliminary_contract", "other"], other: null };

function send(res, s, b) { res.statusCode = s; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(b)); }
async function readBody(req) { if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body; const ch = []; for await (const c of req) ch.push(c); return JSON.parse(Buffer.concat(ch).toString("utf8")); }
const H = (ct) => Object.assign({ apikey: SR(), Authorization: "Bearer " + SR() }, ct ? { "Content-Type": ct } : {});
const hits = new Map();
function limited(ip) { const a = hits.get(ip) || { n: 0, t: Date.now() }; if (Date.now() - a.t > 15 * 60000) { a.n = 0; a.t = Date.now(); } a.n++; hits.set(ip, a); return a.n > 60; }
const appId = (s) => String(s || "").replace(/[^a-z0-9]/gi, "").slice(0, 32) || null;
const mbg = (ym) => { const m = String(ym || "").match(/^(\d{4})-(\d{2})$/); return m ? BG_M[+m[2] - 1] + " " + m[1] : String(ym || ""); };
/* моделът се избира автоматично (_gem.js): най-новият жив Gemini Flash, при лимит/404 – следващият */
async function gem(parts) { return (await GEM.generate({ parts, json: true, temperature: 0, budgetMs: 45000 })).data; }
const PROMPT = "You check documents for a Bulgarian mortgage application. Look at the attached document (image or PDF) and return ONLY JSON: " +
  "{\"doc_type\": one of [" + Object.keys(TYPES).map((k) => '"' + k + '"').join(",") + "], \"months\": [\"YYYY-MM\", ...] (every calendar month the document covers or is issued for – for bank statements the statement period, for payslips the salary month; [] if not applicable), " +
  "\"period_from\":\"YYYY-MM-DD\" or null, \"period_to\":\"YYYY-MM-DD\" or null, \"person_name\": the account holder / employee / person named, or null, \"issuer\": bank or employer or authority, or null, \"confidence\": 0..1, \"summary\": one short sentence in Bulgarian}. " +
  "Be strict about months: read the dates printed on the document; do not guess.";

async function check(b) {
  const app = appId(b.app); if (!app) throw new Error("Невалидна кандидатура");
  const f = b.file || {}; if (!f.data || !/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.mime || "")) throw new Error("Качете снимка (JPG/PNG) или PDF");
  const buf = Buffer.from(String(f.data), "base64"); if (!buf.length || buf.length > MAX) throw new Error("Файлът е над 4 MB – снимайте с по-ниска резолюция");
  const slot = b.slot || {}; const key = String(slot.key || "doc").replace(/[^\w\-]/g, "").slice(0, 40), kind = String(slot.kind || "other"), month = /^\d{4}-\d{2}$/.test(slot.month || "") ? slot.month : null;
  if (!GKEY()) throw new Error("Проверката на документи не е настроена (GEMINI_API_KEY)");
  let r = null, err = null;
  try { r = await gem([{ text: PROMPT + (slot.label ? " The applicant says this is: \"" + String(slot.label).slice(0, 120) + "\"" + (month ? " for " + month + "." : ".") : "") }, { inline_data: { mime_type: f.mime, data: f.data } }]); } catch (e) { err = e; }
  if (!r) throw err || new Error("Проверката не успя");
  const type = TYPES[r.doc_type] ? r.doc_type : "other"; const months = Array.isArray(r.months) ? r.months.filter((x) => /^\d{4}-\d{2}$/.test(x)) : [];
  let match = true, why = "";
  if (month) {
    const inPeriod = r.period_from && r.period_to && String(r.period_from).slice(0, 7) <= month && String(r.period_to).slice(0, 7) >= month;
    if (!(type === "bank_statement" || type === "payslip" || type === "income_certificate")) { match = false; why = "Това изглежда като " + TYPES[type] + ", а тук се очаква " + (kind === "payslip" ? "фиш за заплата" : "банково извлечение") + " за " + mbg(month) + "."; }
    else if (!(months.includes(month) || inPeriod)) { match = false; why = "Грешен месец: документът е за " + (months.length ? months.map(mbg).join(", ") : (r.period_from ? r.period_from + " – " + r.period_to : "неясен период")) + ", а тук се очаква " + mbg(month) + "."; }
  } else if (EXPECT[kind] && !EXPECT[kind].includes(type)) { match = false; why = "Това изглежда като " + TYPES[type] + ", а тук се очаква " + (slot.label || kind) + "."; }
  const ext = f.mime === "application/pdf" ? "pdf" : f.mime === "image/png" ? "png" : f.mime === "image/webp" ? "webp" : "jpg";
  const path = "inquiries/" + app + "/" + key + "-" + Date.now() + "." + ext;
  if (!SR()) throw new Error("Липсва сървърен ключ");
  const up = await fetch(SB_URL + "/storage/v1/object/nd-files/" + path.split("/").map(encodeURIComponent).join("/"), { method: "POST", headers: Object.assign(H(f.mime), { "x-upsert": "true" }), body: buf });
  if (!up.ok) throw new Error("Файлът не се записа (" + up.status + ")");
  return { match, path, size: buf.length, mime: f.mime, doc_type: type, type_bg: TYPES[type], months, person: r.person_name || null, issuer: r.issuer || null, summary: String(r.summary || "").slice(0, 200), why };
}
async function submit(b, ip) {
  const app = appId(b.app); if (!app) throw new Error("Невалидна кандидатура");
  const name = String(b.name || "").trim().replace(/\s+/g, " ").slice(0, 120), phone = String(b.phone || "").trim().slice(0, 40), email = String(b.email || "").trim().slice(0, 160);
  if (name.split(" ").length < 2) throw new Error("Въведете име и фамилия");
  if (phone.replace(/\D/g, "").length < 6 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Въведете телефон или имейл");
  const docs = (Array.isArray(b.docs) ? b.docs : []).slice(0, 80).filter((d) => d && /^inquiries\//.test(String(d.path || ""))).map((d) => ({ key: String(d.key || "").slice(0, 40), label: String(d.label || "").slice(0, 120), month: /^\d{4}-\d{2}$/.test(d.month || "") ? d.month : null, path: String(d.path), name: String(d.name || "").slice(0, 120), size: +d.size || 0, mime: String(d.mime || "").slice(0, 60), status: d.status === "ok" ? "ok" : "bad", summary: String(d.summary || "").slice(0, 200) }));
  const row = { data: { kind: "mortgage", status: "Ново", app, name, phone, email, type: String(b.type || "").slice(0, 40), typeLabel: String(b.typeLabel || "").slice(0, 120), property: b.property && typeof b.property === "object" ? { code: String(b.property.code || "").slice(0, 40), title: String(b.property.title || "").slice(0, 200), city: String(b.property.city || "").slice(0, 60), hood: String(b.property.hood || "").slice(0, 80), price: +b.property.price || 0, id: String(b.property.id || "").slice(0, 60) } : null, months: Math.min(36, +b.months || 0), payment: b.payment && typeof b.payment === "object" ? { from: +b.payment.from || 0, to: +b.payment.to || 0, loan: +b.payment.loan || 0, years: +b.payment.years || 0, self: +b.payment.self || 0, rate: String(b.payment.rate || "").slice(0, 30) } : null, note: String(b.note || "").slice(0, 1000), docs, ok_docs: docs.filter((d) => d.status === "ok").length, at: new Date().toISOString(), ip: String(ip || "").slice(0, 60) } };
  const r = await fetch(SB_URL + "/rest/v1/nd_inquiries", { method: "POST", headers: Object.assign(H("application/json"), { Prefer: "return=representation" }), body: JSON.stringify(row) });
  const j = await r.json().catch(() => []); if (!r.ok) throw new Error("Кандидатурата не се записа (" + r.status + ")");
  const id = Array.isArray(j) && j[0] ? j[0].id : null;
  try { await fetch(SB_URL + "/rest/v1/nd_activities", { method: "POST", headers: H("application/json"), body: JSON.stringify({ data: { source: "site", icon: "landmark", inquiry_id: id, text: "Кандидатстване за ипотечен кредит: " + name + (row.data.property && row.data.property.code ? " – обява " + row.data.property.code : "") + " (" + docs.filter((d) => d.status === "ok").length + "/" + docs.length + " документа)", at: new Date().toISOString() } }) }); } catch (e) {}
  return { id };
}
module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (limited(ip)) return send(res, 429, { ok: false, error: "Твърде много заявки. Опитайте след малко." });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  try {
    if (b.action === "check") return send(res, 200, Object.assign({ ok: true }, await check(b)));
    if (b.action === "submit") return send(res, 200, Object.assign({ ok: true }, await submit(b, ip)));
    return send(res, 400, { ok: false, error: "Непознато действие" });
  } catch (e) { return send(res, 502, { ok: false, error: String(e.message || e).slice(0, 300) }); }
};
