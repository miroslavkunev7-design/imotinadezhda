// /api/email – изпращане от собствената поща на служителя (abv.bg, Gmail, Mail.bg, Outlook, Yahoo или друг SMTP).
// Настройките (адрес + парола за приложения) се пазят само на сървъра в nd_secrets (service role); клиентът никога не ги чете обратно.
// actions: providers · get (host/адрес, без парола) · set · test · delete · send (to, subject, text, attachments [{path}] от nd-files)
"use strict";
const nodemailer = require("./_vendor/nodemailer/lib/nodemailer.js");
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROVIDERS = {
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
const key = (user) => "smtp:" + user.id;
async function secretGet(k) { const r = await fetch(SB_URL + "/rest/v1/nd_secrets?key=eq." + encodeURIComponent(k) + "&select=value", { headers: { apikey: SR(), Authorization: "Bearer " + SR() } }); const j = await r.json().catch(() => []); return Array.isArray(j) && j[0] ? j[0].value : null; }
async function secretSet(k, v) { const r = await fetch(SB_URL + "/rest/v1/nd_secrets", { method: "POST", headers: { apikey: SR(), Authorization: "Bearer " + SR(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key: k, value: v, updated_at: new Date().toISOString() }) }); if (!r.ok) throw new Error("Настройките не се записаха (" + r.status + ")"); }
async function secretDel(k) { await fetch(SB_URL + "/rest/v1/nd_secrets?key=eq." + encodeURIComponent(k), { method: "DELETE", headers: { apikey: SR(), Authorization: "Bearer " + SR() } }); }
/* ABV / Mail.bg: ако порт 465 (SSL) е недостъпен от сървъра, опитваме 587 (STARTTLS) – мрежова грешка, не грешна парола */
const NETERR = /ECONNREFUSED|ETIMEDOUT|ESOCKET|ECONNRESET|EHOSTUNREACH|ENETUNREACH|timeout|Greeting never received|Connection closed/i;
function variants(cfg) { const v = [cfg]; if (Number(cfg.port) === 465 && /^(abv|mailbg|custom)$/.test(cfg.provider || "")) v.push(Object.assign({}, cfg, { port: 587, secure: false })); return v; }
async function verifyAny(cfg) { let err; for (const c of variants(cfg)) { try { await transport(c).verify(); return c; } catch (e) { err = e; if (!NETERR.test(String(e && (e.code || "") + " " + e.message))) break; } } throw err; }
async function sendAny(cfg, mail) { let err; for (const c of variants(cfg)) { try { return await transport(c).sendMail(mail); } catch (e) { err = e; if (!NETERR.test(String(e && (e.code || "") + " " + e.message))) break; } } throw err; }
function transport(cfg) { return nodemailer.createTransport({ host: cfg.host, port: Number(cfg.port) || 465, secure: cfg.secure !== false && Number(cfg.port) !== 587, auth: { user: cfg.user, pass: cfg.pass }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000, tls: { minVersion: "TLSv1.2" } }); }
const pub = (cfg) => cfg ? { provider: cfg.provider, email: cfg.email, user: cfg.user, host: cfg.host, port: cfg.port, name: cfg.name || "", at: cfg.at } : null;
function friendly(e) { const m = String((e && e.message) || e); if (/535|auth|credentials|Invalid login|Username and Password/i.test(m)) return "Пощата отказа входа – проверете адреса и паролата (за ABV: паролата на пощата или парола за приложения при двустепенна защита; за Gmail/Outlook/Yahoo трябва парола за приложение)."; if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|timeout|Greeting/i.test(m)) return "Няма връзка със SMTP сървъра – проверете host/port."; if (/550|553|554|5\.7\.|spam|rejected/i.test(m)) return "Пощенският сървър отказа писмото: " + m.slice(0, 160); return m.slice(0, 200); }

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  const auth = String(req.headers["authorization"] || ""), token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const user = token ? await staff(token).catch(() => null) : null;
  if (!user) return send(res, 401, { ok: false, error: "Влезте в CRM." });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  if (b.action === "providers") return send(res, 200, { ok: true, providers: Object.keys(PROVIDERS).map((k) => Object.assign({ id: k }, PROVIDERS[k])) });
  if (!SR()) return send(res, 500, { ok: false, error: "Липсва сървърен ключ за настройките (SUPABASE_SERVICE_ROLE_KEY)." });
  try {
    if (b.action === "get") return send(res, 200, { ok: true, settings: pub(await secretGet(key(user))), account_email: user.email || "" });
    if (b.action === "delete") { await secretDel(key(user)); return send(res, 200, { ok: true }); }
    if (b.action === "set" || b.action === "test") {
      const p = PROVIDERS[b.provider] || PROVIDERS.custom, email = String(b.email || "").trim(), pass = String(b.password || "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { ok: false, error: "Невалиден имейл адрес" });
      let cfg = { provider: b.provider || "custom", email, name: String(b.name || "").slice(0, 80), user: String(b.user || email).trim(), host: b.provider === "custom" ? String(b.host || "").trim() : p.host, port: b.provider === "custom" ? Number(b.port) || 465 : p.port, secure: b.provider === "custom" ? b.secure !== false : p.secure, pass, at: new Date().toISOString() };
      if (!pass) { const old = await secretGet(key(user)); if (old && old.email === email) cfg.pass = old.pass; else return send(res, 400, { ok: false, error: "Въведете паролата (за приложения) на пощата" }); }
      if (!cfg.host) return send(res, 400, { ok: false, error: "Липсва SMTP сървър" });
      try { cfg = await verifyAny(cfg); } catch (e) { return send(res, 200, { ok: false, error: friendly(e) }); }
      if (b.action === "set") await secretSet(key(user), cfg);
      return send(res, 200, { ok: true, settings: pub(cfg), verified: true });
    }
    if (b.action === "send") {
      const cfg = await secretGet(key(user));
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
      const info = await sendAny(cfg, { from: cfg.name ? '"' + cfg.name.replace(/"/g, "") + '" <' + cfg.email + ">" : cfg.email, to: b.toName ? '"' + String(b.toName).replace(/"/g, "") + '" <' + to + ">" : to, cc: b.cc || undefined, replyTo: cfg.email, subject: String(b.subject || "").slice(0, 200), text: String(b.text || "").slice(0, 20000), html: b.html ? String(b.html).slice(0, 60000) : undefined, attachments: atts });
      return send(res, 200, { ok: true, sent: true, message_id: info.messageId || null, from: cfg.email, to, attachments: atts.length, accepted: info.accepted || [], rejected: info.rejected || [] });
    }
    return send(res, 400, { ok: false, error: "Непознато действие" });
  } catch (e) { return send(res, 502, { ok: false, error: friendly(e) }); }
};
// За Тед (api/_ted-skills.js): директно изпращане от пощата на дадения служител, без HTTP.
module.exports.configFor = (userId) => (SR() ? secretGet("smtp:" + userId) : Promise.resolve(null));
module.exports.publicConfig = pub;
module.exports.friendly = friendly;
module.exports.sendAs = async (cfg, m) => {
  const info = await sendAny(cfg, { from: cfg.name ? '"' + cfg.name.replace(/"/g, "") + '" <' + cfg.email + ">" : cfg.email, to: m.toName ? '"' + String(m.toName).replace(/"/g, "") + '" <' + m.to + ">" : m.to, replyTo: cfg.email, subject: m.subject, text: m.text, html: m.html, attachments: m.attachments || [] });
  return { message_id: info.messageId || null, accepted: info.accepted || [], rejected: info.rejected || [] };
};
module.exports.PROVIDERS = PROVIDERS;
