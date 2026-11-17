// /api/email – изпращане от собствената поща на служителя (abv.bg, Gmail, Mail.bg, Outlook, Yahoo или друг SMTP)
// или от пощата на домейна (…@imotinadezhda.bg) през Resend (HTTPS API, безплатно до 100 имейла/ден) – стига до всички пощи: ABV, Gmail, Outlook, Yahoo…
// Настройките (адрес + парола за приложения) се пазят само на сървъра в nd_secrets (service role); клиентът никога не ги чете обратно.
// actions: providers · get (host/адрес, без парола) · set · test · delete · send (to, subject, text, attachments [{path}] от nd-files)
"use strict";
const nodemailer = require("./_vendor/nodemailer/lib/nodemailer.js");
const pushApi = require("./push");
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROVIDERS = {
  domain: { name: "Поща на домейна (@imotinadezhda.bg)", host: "api.resend.com", port: 443, secure: true, api: "resend", hint: "Изпраща от адрес на домейна (напр. office@imotinadezhda.bg) до всички пощи. Нужен е API ключ от resend.com (безплатен) и потвърден домейн там." },
  abv: { name: "ABV.bg", host: "smtp.abv.bg", port: 465, secure: true, hint: "Паролата на пощата. Ако имате двустепенна защита – парола за приложения от настройките на ABV." },
  gmail: { name: "Gmail", host: "smtp.gmail.com", port: 465, secure: true, hint: "Нужна е „Парола за приложение“ (Google акаунт → Сигурност → Потвърждаване в 2 стъпки → Пароли за приложения). Обикновената парола не работи." },
  mailbg: { name: "Mail.bg", host: "smtp.mail.bg", port: 465, secure: true, hint: "Паролата на пощата в Mail.bg." },
  outlook: { name: "Outlook / Hotmail", host: "smtp.office365.com", port: 587, secure: false, hint: "Парола за приложение от Microsoft акаунта (Сигурност → Разширени опции). Microsoft може да изисква и „Authenticated SMTP“." },
  yahoo: { name: "Yahoo", host: "smtp.mail.yahoo.com", port: 465, secure: true, hint: "Парола за приложение от Yahoo (Account Security → App passwords)." },
  icloud: { name: "iCloud", host: "smtp.mail.me.com", port: 587, secure: false, hint: "App-specific password от appleid.apple.com." },
  custom: { name: "Друг (ръчно)", host: "", port: 465, secure: true, hint: "Данните за SMTP от вашия доставчик." }
};
function send(res, s, b) { res.statusCode = s; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(b)); }
async function readBody(req) { if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body; const ch = []; for await (const c of req) ch.push(c); return JSON.parse(Buffer.concat(ch).toString("utf8")); }
async function staff(token) {
  const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } }); if (!u.ok) return null;
  const user = await u.json();
  const r = await fetch(SB_URL + "/rest/v1/rpc/nd_is_staff", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true ? user : null;
}
const key = (user, scope) => (scope === "agency" ? "smtp:agency" : "smtp:" + user.id);
/* общата поща на агенцията (за брокерите без собствена) се настройва само от администратор */
async function isAdmin(token) { const r = await fetch(SB_URL + "/rest/v1/rpc/nd_is_admin", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" }).catch(() => null); return !!(r && r.ok && (await r.json().catch(() => false)) === true); }
async function secretGet(k) { const r = await fetch(SB_URL + "/rest/v1/nd_secrets?key=eq." + encodeURIComponent(k) + "&select=value", { headers: { apikey: SR(), Authorization: "Bearer " + SR() } }); const j = await r.json().catch(() => []); return Array.isArray(j) && j[0] ? j[0].value : null; }
async function secretSet(k, v) { const r = await fetch(SB_URL + "/rest/v1/nd_secrets", { method: "POST", headers: { apikey: SR(), Authorization: "Bearer " + SR(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key: k, value: v, updated_at: new Date().toISOString() }) }); if (!r.ok) throw new Error("Настройките не се записаха (" + r.status + ")"); }
async function secretDel(k) { await fetch(SB_URL + "/rest/v1/nd_secrets?key=eq." + encodeURIComponent(k), { method: "DELETE", headers: { apikey: SR(), Authorization: "Bearer " + SR() } }); }
/* ABV / Mail.bg: ако порт 465 (SSL) е недостъпен от сървъра, опитваме 587 (STARTTLS) – мрежова грешка, не грешна парола */
/* мрежова грешка или отказ още при поздрава (ABV: „554 5.7.1 Sorry, not allowed“ към сървъри в облака) → пробваме другите портове */
const NETERR = /ECONNREFUSED|ETIMEDOUT|ESOCKET|ECONNRESET|EHOSTUNREACH|ENETUNREACH|timeout|Greeting never received|Connection closed|Invalid greeting|EPROTOCOL|554/i;
function variants(cfg) { const v = [cfg]; if (Number(cfg.port) === 465 && /^(abv|mailbg|custom)$/.test(cfg.provider || "")) { v.push(Object.assign({}, cfg, { port: 587, secure: false })); v.push(Object.assign({}, cfg, { port: 25, secure: false })); } return v; }
const BLOCKED = /Invalid greeting|Sorry, not allowed|554 5\.7\.1/i;
/* ако някой порт е отказал с „not allowed“, показваме тази причина (по-ясна от „няма връзка“ на следващия порт) */
const pick = (errs) => errs.find((e) => BLOCKED.test(String(e && e.message))) || errs[errs.length - 1];
async function verifyAny(cfg) { if (isDomain(cfg)) { await domainCheck(cfg); return cfg; } const errs = []; for (const c of variants(cfg)) { try { await transport(c).verify(); return c; } catch (e) { errs.push(e); logErr("verify-" + c.port, c, e); if (!NETERR.test(String(e && (e.code || "") + " " + e.message))) break; } } throw pick(errs); }
async function sendAny(cfg, mail) { if (isDomain(cfg)) return domainSend(cfg, mail); const errs = []; for (const c of variants(cfg)) { try { return await transport(c).sendMail(mail); } catch (e) { errs.push(e); logErr("send-" + c.port, c, e); if (!NETERR.test(String(e && (e.code || "") + " " + e.message))) break; } } throw pick(errs); }
/* грешки при изпращане в логовете на Vercel (без пароли) – за бърза диагностика */
function logErr(stage, cfg, e) { try { console.error("[email]", stage, JSON.stringify({ host: cfg && cfg.host, port: cfg && cfg.port, provider: cfg && cfg.provider, code: e && e.code, command: e && e.command, responseCode: e && e.responseCode, response: e && String(e.response || "").slice(0, 200), message: String((e && e.message) || e).slice(0, 200) })); } catch (x) {} }
function transport(cfg) { const p = Number(cfg.port) || 465; return nodemailer.createTransport({ host: cfg.host, port: p, secure: cfg.secure !== false && p === 465, auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: p === 25 ? 7000 : 12000, greetingTimeout: 12000, socketTimeout: 30000, tls: { minVersion: "TLSv1.2" } }); }
/* ---------- Поща на домейна през Resend (HTTPS, порт 443 – не зависи от SMTP блокировки) ---------- */
const RESEND = "https://api.resend.com";
const isDomain = (cfg) => !!(cfg && cfg.provider === "domain");
async function rs(keyStr, path, body) {
  const r = await fetch(RESEND + path, { method: body ? "POST" : "GET", headers: { Authorization: "Bearer " + keyStr, "Content-Type": "application/json", "User-Agent": "imotinadezhda-crm/1.0" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error("Resend " + r.status + ": " + String(j.message || j.error || r.statusText || "").slice(0, 300)); e.code = "resend:" + (j.name || r.status); e.responseCode = r.status; throw e; }
  return j;
}
const addrName = (n) => String(n || "").replace(/["<>,;:\\\r\n]/g, " ").replace(/\s+/g, " ").trim();
/* nodemailer адрес („"Име" <a@b>“ или „a@b“) → Resend формат „Име <a@b>“ */
function rsAddr(v) { if (!v) return undefined; const one = (x) => { const m = String(x).match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/); if (!m) return String(x).trim(); const n = addrName(m[1]); return n ? n + " <" + m[2].trim() + ">" : m[2].trim(); }; return Array.isArray(v) ? v.map(one) : String(v).split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(one).filter(Boolean); }
async function domainSend(cfg, mail) {
  const atts = (mail.attachments || []).map((a) => ({ filename: a.filename, content: Buffer.isBuffer(a.content) ? a.content.toString("base64") : Buffer.from(a.content || "").toString("base64") }));
  const body = { from: rsAddr(mail.from)[0], to: rsAddr(mail.to), subject: mail.subject || "(без тема)", text: mail.text || undefined, html: mail.html || undefined };
  if (mail.cc) body.cc = rsAddr(mail.cc); if (mail.replyTo) body.reply_to = rsAddr(mail.replyTo); if (atts.length) body.attachments = atts;
  let j;
  try { j = await rs(cfg.pass, "/emails", body); }
  catch (e) { if (!/validation/i.test(String(e.code)) || !/from/i.test(e.message)) throw e; body.from = cfg.email; j = await rs(cfg.pass, "/emails", body); } /* името на подателя не мина валидацията → само адреса */
  return { messageId: j.id || null, accepted: [].concat(body.to, body.cc || []), rejected: [] };
}
/* проверка на ключа и домейна: ключ с пълен достъп вижда статуса на домейна; ключ „само изпращане“ – проверката става с тестовото писмо */
async function domainCheck(cfg) {
  const dom = String(cfg.email.split("@")[1] || "").toLowerCase();
  try {
    const j = await rs(cfg.pass, "/domains"), d = (j.data || []).find((x) => String(x.name || "").toLowerCase() === dom);
    if (!d) return { warn: "Домейнът " + dom + " още не е добавен в Resend (Domains → Add domain)." };
    if (d.status !== "verified") return { warn: "Домейнът " + dom + " е добавен в Resend, но още не е потвърден (статус: " + d.status + "). Добавете DNS записите от Resend при доставчика на домейна (SuperHosting) и натиснете Verify – обикновено минути до час." };
    return { verified: true };
  } catch (e) { if (/restricted_api_key|401/.test(String(e.code) + e.message) && !/invalid|missing/i.test(e.message)) return {}; throw e; }
}
/* обща поща на агенцията: записаната от администратор или (ако има) RESEND_API_KEY във Vercel → office@imotinadezhda.bg */
async function agencyCfg() {
  const ag = SR() ? await secretGet("smtp:agency").catch(() => null) : null; if (ag) return ag;
  const k = process.env.RESEND_API_KEY; if (!k) return null;
  return { provider: "domain", email: process.env.MAIL_FROM || "office@imotinadezhda.bg", user: process.env.MAIL_FROM || "office@imotinadezhda.bg", host: "api.resend.com", port: 443, secure: true, pass: k, name: "Имоти Надежда", env: true };
}
const pub = (cfg) => cfg ? { provider: cfg.provider, email: cfg.email, user: cfg.user, host: cfg.host, port: cfg.port, name: cfg.name || "", at: cfg.at, reply_to: cfg.reply_to || undefined, env: cfg.env || undefined } : null;
function friendly(e) { const m = String((e && e.message) || e);
  if (/^Resend /.test(m) || /^resend:/.test(String(e && e.code))) {
    if (/not verified|verify your domain|domain is not|own email address/i.test(m)) return "Домейнът още не е потвърден в Resend – добавете DNS записите от resend.com → Domains при доставчика на домейна (SuperHosting) и натиснете Verify. След потвърждаване писмата тръгват до всички пощи.";
    if (/api key is invalid|invalid_api_key|missing_api_key|Resend 401|Resend 403: API key/i.test(m)) return "API ключът на Resend е невалиден – създайте нов от resend.com → API Keys и го поставете отново.";
    if (/quota|rate_limit|Resend 429/i.test(m)) return "Достигнат е безплатният дневен лимит за изпращане (100 имейла на ден) – изпращането се подновява автоматично.";
    return "Пощата на домейна отказа писмото: " + m.replace(/^Resend \d+: /, "").slice(0, 180);
  }
  if (/Invalid greeting|Sorry, not allowed|554 5\.7\.1/i.test(m)) return "ABV не позволява изпращане от сървъри (отказва връзката още преди паролата). Изберете за изпращане Gmail поща с „парола за приложение“ – писмата стигат нормално и до ABV адреси. Получателите може да са в ABV."; if (/535|auth|credentials|Invalid login|Username and Password/i.test(m)) return "Пощата отказа входа – проверете адреса и паролата (за ABV: паролата на пощата или парола за приложения при двустепенна защита; за Gmail/Outlook/Yahoo трябва парола за приложение)."; if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|timeout|Greeting/i.test(m)) return "Няма връзка със SMTP сървъра – проверете host/port."; if (/550|553|554|5\.7\.|spam|rejected/i.test(m)) return "Пощенският сървър отказа писмото: " + m.slice(0, 160); return m.slice(0, 200); }

/* ---------- Поща (входяща кутия на office@imotinadezhda.bg) ----------
   Resend получава писмата (MX на домейна) → webhook „email.received“ към /api/email?hook=resend → писмото се взима от Resend API
   по id (така webhook-ът не може да бъде подправен) → nd_mail + прикачените в nd-files/mail/<id>/. Страницата „Поща“ чете nd_mail. */
const MAILBOX = () => process.env.MAIL_FROM || "office@imotinadezhda.bg";
const MAIL_T = SB_URL + "/rest/v1/nd_mail";
const srH = () => ({ apikey: SR(), Authorization: "Bearer " + SR(), "Content-Type": "application/json" });
async function mailRow(id) { const r = await fetch(MAIL_T + "?id=eq." + encodeURIComponent(id) + "&select=id,data", { headers: srH() }); const j = await r.json().catch(() => []); return Array.isArray(j) && j[0] ? j[0] : null; }
async function mailPut(id, data) { const r = await fetch(MAIL_T, { method: "POST", headers: Object.assign(srH(), { Prefer: "resolution=merge-duplicates" }), body: JSON.stringify({ id, data }) }); if (!r.ok) throw new Error("Пощата не се записа (" + r.status + "): " + (await r.text()).slice(0, 160)); }
async function storePut(path, buf, mime) { const r = await fetch(SB_URL + "/storage/v1/object/nd-files/" + path.split("/").map(encodeURIComponent).join("/"), { method: "POST", headers: { apikey: SR(), Authorization: "Bearer " + SR(), "Content-Type": mime || "application/octet-stream", "x-upsert": "true" }, body: buf }); if (!r.ok) throw new Error("Файлът не се качи (" + r.status + ")"); return path; }
const safeFile = (n) => String(n || "file").replace(/[\\/:*?"<>|#%\r\n]+/g, "_").slice(0, 120) || "file";
const addrOf = (v) => { const m = String(v || "").match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/); return m ? { name: m[1].trim(), email: m[2].trim() } : { name: "", email: String(v || "").trim() }; };
/* изтегля едно получено писмо от Resend и го записва (идемпотентно – вече записано не се тегли отново) */
async function syncReceived(cfg, rid) {
  const id = "rs_" + String(rid).replace(/[^A-Za-z0-9-]/g, "");
  const old = await mailRow(id); if (old) return { id, fresh: false };
  const e = await rs(cfg.pass, "/emails/receiving/" + encodeURIComponent(rid));
  const fromH = addrOf((e.headers && e.headers.from) || e.from);
  const atts = [];
  if (Array.isArray(e.attachments) && e.attachments.length) {
    const list = await rs(cfg.pass, "/emails/receiving/" + encodeURIComponent(rid) + "/attachments?limit=100").catch(() => ({ data: [] }));
    for (const a of (list.data || []).slice(0, 30)) {
      if (!a.download_url) continue;
      try {
        const r = await fetch(a.download_url); if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 20 * 1048576) continue;
        const path = await storePut("mail/" + id + "/" + safeFile(a.filename), buf, a.content_type);
        atts.push({ name: a.filename || "file", path, size: buf.length, mime: a.content_type || "", inline: a.content_disposition === "inline", cid: a.content_id || null });
      } catch (x) { logErr("mail-att", cfg, x); }
    }
  }
  const data = { folder: "in", read: false, resend_id: rid, message_id: e.message_id || null, from: fromH.email || e.from, from_name: fromH.name || "", to: e.to || [], cc: e.cc || [], reply_to: e.reply_to || [], subject: e.subject || "(без тема)",
    text: String(e.text || "").slice(0, 200000), html: String(e.html || "").slice(0, 600000), at: e.created_at || new Date().toISOString(), attachments: atts, auth: e.authentication || null };
  await mailPut(id, data);
  try {
    const r = await pushApi.notifyMail(id, data);
    if (r && r.ok > 0) {
      data.notified = true;
      await mailPut(id, data).catch(() => null);
    }
  } catch (e) { logErr("mail-push", cfg, e); }
  return { id, fresh: true };
}
async function syncInbox(cfg) {
  const l = await rs(cfg.pass, "/emails/receiving?limit=50"); let n = 0;
  for (const e of (l.data || [])) { try { if ((await syncReceived(cfg, e.id)).fresh) n++; } catch (x) { logErr("mail-sync", cfg, x); } }
  return n;
}
const RESTRICTED = (e) => /restricted|only send|401/i.test(String(e && (e.code + " " + e.message)));

module.exports = async (req, res) => {
  /* webhook от Resend (без вход): само сигнал „дойде писмо X“ – съдържанието се взима от Resend с нашия ключ */
  if (req.method === "POST" && /[?&]hook=resend\b/.test(req.url || "")) {
    let ev = {}; try { ev = await readBody(req); } catch (e) {}
    try { const cfg = await agencyCfg(); const rid = ev && ev.data && (ev.data.email_id || ev.data.id); if (ev.type === "email.received" && rid && isDomain(cfg)) await syncReceived(cfg, rid); }
    catch (e) { logErr("mail-hook", null, e); }
    return send(res, 200, { ok: true });
  }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  const auth = String(req.headers["authorization"] || ""), token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const user = token ? await staff(token).catch(() => null) : null;
  if (!user) return send(res, 401, { ok: false, error: "Влезте в CRM." });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  if (b.action === "providers") return send(res, 200, { ok: true, providers: Object.keys(PROVIDERS).map((k) => Object.assign({ id: k }, PROVIDERS[k])) });
  if (!SR()) return send(res, 500, { ok: false, error: "Липсва сървърен ключ за настройките (SUPABASE_SERVICE_ROLE_KEY)." });
  try {
    if (b.action === "get") return send(res, 200, { ok: true, settings: pub(await secretGet(key(user))), agency: pub(await agencyCfg()), admin: await isAdmin(token), account_email: user.email || "" });
    if (b.scope === "agency" && (b.action === "set" || b.action === "delete") && !(await isAdmin(token))) return send(res, 403, { ok: false, error: "Общата поща на агенцията се настройва от администратор." });
    if (b.action === "delete") { await secretDel(key(user, b.scope)); return send(res, 200, { ok: true }); }
    if (b.action === "set" || b.action === "test") {
      const p = PROVIDERS[b.provider] || PROVIDERS.custom, email = String(b.email || "").trim(), pass = String(b.password || "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { ok: false, error: "Невалиден имейл адрес" });
      let cfg = { provider: b.provider || "custom", email, name: String(b.name || "").slice(0, 80), user: String(b.user || email).trim(), host: b.provider === "custom" ? String(b.host || "").trim() : p.host, port: b.provider === "custom" ? Number(b.port) || 465 : p.port, secure: b.provider === "custom" ? b.secure !== false : p.secure, pass, at: new Date().toISOString() };
      if (!pass) { const old = await secretGet(key(user, b.scope)); if (old && old.email === email) cfg.pass = old.pass; else return send(res, 400, { ok: false, error: "Въведете паролата (за приложения) на пощата" }); }
      if (!cfg.host) return send(res, 400, { ok: false, error: "Липсва SMTP сървър" });
      let warn = null;
      if (isDomain(cfg)) {
        cfg.pass = cfg.pass.trim(); if (!/^re_[A-Za-z0-9_]{8,}$/.test(cfg.pass)) return send(res, 400, { ok: false, error: "Поставете API ключа от Resend (започва с re_…)." });
        if (b.scope !== "agency" && user.email && user.email.toLowerCase() !== email.toLowerCase()) cfg.reply_to = user.email; /* отговорите идват на личния имейл на брокера */
        try { warn = (await domainCheck(cfg)).warn || null; } catch (e) { return send(res, 200, { ok: false, error: friendly(e) }); }
      } else try { cfg = await verifyAny(cfg); } catch (e) { return send(res, 200, { ok: false, error: friendly(e), blocked: BLOCKED.test(String(e && e.message)) }); }
      if (b.action === "set") await secretSet(key(user, b.scope), cfg);
      /* „Тест“ праща истински тестов имейл (до самата поща или до посочен адрес) – така се вижда, че изпращането работи докрай */
      let sentTo = null;
      if (b.action === "test") {
        const to = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.test_to || "")) ? String(b.test_to).trim() : cfg.email;
        try { await sendAny(cfg, { from: cfg.name ? '"' + cfg.name.replace(/"/g, "") + '" <' + cfg.email + ">" : cfg.email, to, replyTo: cfg.reply_to || undefined, subject: "Тест от Тед – Имоти Надежда", text: "Здравейте!\n\nТова е тестов имейл от CRM на Имоти Надежда. Изпращането от " + cfg.email + " работи – Тед вече може да праща имейли с документи с едно „Да“ в чата.\n\nИмоти Надежда · 0898977370" }); sentTo = to; }
        catch (e) { logErr("test-send", cfg, e); return send(res, 200, { ok: false, error: "Връзката е успешна, но писмото не тръгна: " + friendly(e) }); }
      }
      return send(res, 200, { ok: true, settings: pub(cfg), verified: !warn || !!sentTo, warning: sentTo ? null : warn, sent_to: sentTo });
    }
    if (b.action === "mail_sync") {
      const cfg = await agencyCfg();
      if (!isDomain(cfg)) return send(res, 200, { ok: false, needSetup: true, error: "Пощата на домейна не е настроена (Моята поща → Поща на домейна)." });
      try { const n = await syncInbox(cfg); return send(res, 200, { ok: true, fresh: n, mailbox: cfg.email }); }
      catch (e) { if (RESTRICTED(e)) return send(res, 200, { ok: false, restricted: true, error: "Ключът на Resend е само за изпращане. За входящата поща трябва ключ с „Full access“ – създайте го в resend.com → API Keys и го поставете веднъж в Моята поща → Поща на домейна." }); return send(res, 200, { ok: false, error: friendly(e) }); }
    }
    if (b.action === "mail_send") {
      const cfg = await agencyCfg();
      if (!isDomain(cfg)) return send(res, 200, { ok: false, needSetup: true, error: "Пощата на домейна не е настроена." });
      const tos = String(b.to || "").split(/[,;]\s*/).map((x) => x.trim()).filter(Boolean);
      if (!tos.length || tos.some((t) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t))) return send(res, 400, { ok: false, error: "Невалиден получател" });
      const atts = []; let total = 0;
      for (const a of (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 15)) {
        if (!a || !a.path) continue;
        const r = await fetch(SB_URL + "/storage/v1/object/nd-files/" + a.path.split("/").map(encodeURIComponent).join("/"), { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } });
        if (!r.ok) return send(res, 404, { ok: false, error: "Файлът не е достъпен: " + (a.name || a.path) });
        const buf = Buffer.from(await r.arrayBuffer()); total += buf.length; if (total > 25 * 1048576) return send(res, 413, { ok: false, error: "Прикачените файлове са над 25 MB" });
        atts.push({ filename: a.name || a.path.split("/").pop(), content: buf, path: a.path, mime: a.mime || "" });
      }
      let orig = null; if (b.reply_to_id) orig = await mailRow(String(b.reply_to_id));
      const who = String(b.from_name || (user.user_metadata && (user.user_metadata.name || user.user_metadata.full_name)) || "").replace(/["<>]/g, "").trim();
      const from = (who ? who + " | " : "") + "Имоти Надежда <" + cfg.email + ">";
      const subject = String(b.subject || (orig ? "Re: " + String(orig.data.subject || "").replace(/^(re|отг):\s*/i, "") : "")).slice(0, 200) || "(без тема)";
      const mail = { from, to: tos.join(", "), cc: b.cc || undefined, replyTo: cfg.email, subject, text: String(b.text || "").slice(0, 50000), attachments: atts };
      const body = { from: rsAddr(mail.from)[0], to: rsAddr(mail.to), subject, text: mail.text, reply_to: [cfg.email] };
      if (mail.cc) body.cc = rsAddr(mail.cc);
      if (atts.length) body.attachments = atts.map((a) => ({ filename: a.filename, content: a.content.toString("base64") }));
      if (orig && orig.data.message_id) body.headers = { "In-Reply-To": orig.data.message_id, References: orig.data.message_id };
      let j; try { j = await rs(cfg.pass, "/emails", body); } catch (e) { return send(res, 200, { ok: false, error: friendly(e) }); }
      const id = "sent_" + String(j.id || Date.now()).replace(/[^A-Za-z0-9-]/g, "");
      await mailPut(id, { folder: "sent", read: true, resend_id: j.id || null, from: cfg.email, from_name: who, by: user.email || "", to: tos, cc: body.cc || [], subject, text: mail.text, html: "", at: new Date().toISOString(), attachments: atts.map((a) => ({ name: a.filename, path: a.path, size: a.content.length, mime: a.mime })), in_reply_to: orig ? orig.id : null }).catch(() => null);
      if (orig) await mailPut(orig.id, Object.assign({}, orig.data, { read: true, answered: true, answered_at: new Date().toISOString() })).catch(() => null);
      return send(res, 200, { ok: true, sent: true, id, to: tos, from: cfg.email });
    }
    if (b.action === "send") {
      const own = await secretGet(key(user)), cfg = own || (await agencyCfg());
      if (!cfg) return send(res, 200, { ok: false, needSetup: true, error: "Няма настроена поща за изпращане. Настройки → Моята поща за изпращане." });
      const to = String(b.to || "").trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return send(res, 400, { ok: false, error: "Невалиден получател" });
      const atts = []; let total = 0;
      for (const a of (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 15)) {
        if (!a || !a.path) continue;
        const r = await fetch(SB_URL + "/storage/v1/object/nd-files/" + a.path.split("/").map(encodeURIComponent).join("/"), { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } });
        if (!r.ok) return send(res, 404, { ok: false, error: "Файлът не е достъпен: " + (a.name || a.path) });
        const buf = Buffer.from(await r.arrayBuffer()); total += buf.length; if (total > 25 * 1048576) return send(res, 413, { ok: false, error: "Прикачените файлове са над 25 MB" });
        atts.push({ filename: a.name || a.path.split("/").pop(), content: buf });
      }
      const info = await sendAny(cfg, { from: cfg.name ? '"' + cfg.name.replace(/"/g, "") + '" <' + cfg.email + ">" : cfg.email, to: b.toName ? '"' + String(b.toName).replace(/"/g, "") + '" <' + to + ">" : to, cc: b.cc || undefined, replyTo: own ? cfg.reply_to || cfg.email : user.email || cfg.email, subject: String(b.subject || "").slice(0, 200), text: String(b.text || "").slice(0, 20000), html: b.html ? String(b.html).slice(0, 60000) : undefined, attachments: atts });
      return send(res, 200, { ok: true, sent: true, message_id: info.messageId || null, from: cfg.email, to, attachments: atts.length, accepted: info.accepted || [], rejected: info.rejected || [] });
    }
    return send(res, 400, { ok: false, error: "Непознато действие" });
  } catch (e) { return send(res, 502, { ok: false, error: friendly(e) }); }
};
// За Тед (api/_ted-skills.js): директно изпращане от пощата на дадения служител, без HTTP.
module.exports.configFor = (userId) => (userId === "agency" ? agencyCfg() : SR() ? secretGet("smtp:" + userId) : Promise.resolve(null));
module.exports.publicConfig = pub;
module.exports.friendly = friendly;
module.exports.sendAs = async (cfg, m) => {
  const info = await sendAny(cfg, { from: cfg.name ? '"' + cfg.name.replace(/"/g, "") + '" <' + cfg.email + ">" : cfg.email, to: m.toName ? '"' + String(m.toName).replace(/"/g, "") + '" <' + m.to + ">" : m.to, replyTo: m.replyTo || cfg.reply_to || cfg.email, cc: m.cc || undefined, subject: m.subject, text: m.text, html: m.html, attachments: m.attachments || [] });
  return { message_id: info.messageId || null, accepted: info.accepted || [], rejected: info.rejected || [] };
};
module.exports.PROVIDERS = PROVIDERS;
