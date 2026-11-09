// /api/push – известия на телефона (Web Push) за брокерите, дори на заключен екран.
// actions (POST, Bearer на служителя): vapid · subscribe · unsubscribe · status · test · ack {reminder_id|event_id} · tick
// GET ?action=ack&t=<подписан токен>  – потвърждение от бутона в самото известие (без вход)
// POST ?action=tick с x-cron-key      – от планировчика (pg_cron в Supabase, на 5 минути)
// Правила: ново писмо в пощата → известие до всички служители на заключения екран; 2 ч и 1 ч преди събитие/задача → известие до отговорния брокер; нова задача, възложена от друг → веднага;
// ако 1-часовото известие не е потвърдено до 10 минути → известие до останалите от екипа (ескалация) + запис в дейностите.
"use strict";
const crypto = require("crypto");
const webpush = require("./_vendor/web-push.min.js");
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SITE = "https://imotinadezhda.bg";
const PUB = () => process.env.VAPID_PUBLIC_KEY || "", PRIV = () => process.env.VAPID_PRIVATE_KEY || "", SUBJ = () => process.env.VAPID_SUBJECT || SITE;
const SECRET = () => process.env.PUSH_SECRET || process.env.CRON_SECRET || PRIV();
const ESCALATE_MIN = 10, TZ = "Europe/Sofia";
const TYPE_BG = { meeting: "Среща", viewing: "Оглед", bank: "Банка", documents: "Документи", deal: "Сделка", team: "Екипна среща", task: "Задача", call: "Разговор", video: "Онлайн среща", other: "Събитие" };

function send(res, s, b) { res.statusCode = s; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(b)); }
async function readBody(req) { if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body; const ch = []; for await (const c of req) ch.push(c); const s = Buffer.concat(ch).toString("utf8"); return s ? JSON.parse(s) : {}; }
async function staff(token) {
  const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } }); if (!u.ok) return null;
  const user = await u.json();
  const r = await fetch(SB_URL + "/rest/v1/rpc/nd_is_staff", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true ? user : null;
}
const H = (extra) => Object.assign({ apikey: SR(), Authorization: "Bearer " + SR(), "Content-Type": "application/json" }, extra || {});
async function q(path, init) { const r = await fetch(SB_URL + "/rest/v1/" + path, Object.assign({ headers: H(init && init.headers) }, init || {})); const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && (j.message || j.error)) || "HTTP " + r.status); return j; }
const id = () => crypto.randomBytes(12).toString("hex");
const b64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sign = (rid) => b64u(crypto.createHmac("sha256", SECRET()).update(rid).digest()).slice(0, 32);
const ackToken = (rid) => rid + "." + sign(rid);

/* локално време (Europe/Sofia) → UTC */
function partsIn(d) { const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d); const o = {}; f.forEach((p) => { o[p.type] = p.value; }); return o; }
function toUtc(date, hhmm) {
  const [y, m, d] = String(date).split("-").map(Number), [h, mi] = String(hhmm || "09:00").split(":").map(Number);
  if (!y || !m || !d) return null;
  let guess = Date.UTC(y, m - 1, d, (h || 0) - 2, mi || 0);
  for (let i = 0; i < 2; i++) { const p = partsIn(new Date(guess)); const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute); guess += Date.UTC(y, m - 1, d, h || 0, mi || 0) - local; }
  return new Date(guess);
}
function todayIn(offsetDays) { const p = partsIn(new Date(Date.now() + (offsetDays || 0) * 86400000)); return p.year + "-" + p.month + "-" + p.day; }
const fmtTime = (d) => { const p = partsIn(d); return p.hour + ":" + p.minute; };

/* ---------- изпращане ---------- */
function vapid() { if (!PUB() || !PRIV()) throw new Error("Липсват VAPID ключове (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)"); webpush.setVapidDetails(SUBJ(), PUB(), PRIV()); }
async function subsOf(userIds) {
  if (!userIds.length) return [];
  return q("nd_push_subs?select=id,user_id,endpoint,keys&user_id=in.(" + userIds.map((u) => '"' + u + '"').join(",") + ")");
}
async function pushTo(userIds, payload) {
  vapid();
  const subs = await subsOf(userIds); let ok = 0, gone = 0;
  const body = JSON.stringify(payload);
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 3600, urgency: "high" }); ok++; await q("nd_push_subs?id=eq." + s.id, { method: "PATCH", body: JSON.stringify({ last_ok: new Date().toISOString(), fails: 0 }) }).catch(() => null); }
    catch (e) {
      const code = e && e.statusCode;
      if (code === 404 || code === 410) { gone++; await q("nd_push_subs?id=eq." + s.id, { method: "DELETE" }).catch(() => null); }
      else await q("nd_push_subs?id=eq." + s.id, { method: "PATCH", body: JSON.stringify({ fails: 1 }) }).catch(() => null);
    }
  }));
  return { devices: subs.length, ok, gone };
}
async function staffIds() { const rows = await q("nd_staff?select=user_id"); return rows.map((r) => r.user_id); }
async function notifyMail(mailId, data) {
  if (!PUB() || !PRIV() || !SR()) return { devices: 0, ok: 0, skipped: "vapid" };
  const from = String((data && (data.from_name || data.from)) || "Ново писмо").replace(/\s+/g, " ").slice(0, 80);
  const subj = String((data && data.subject) || "(без тема)").replace(/\s+/g, " ").slice(0, 120);
  const who = await staffIds();
  if (!who.length) return { devices: 0, ok: 0 };
  return pushTo(who, {
    title: "Ново писмо",
    body: from + " · " + subj,
    url: "/mobile/crm/crm-poshta.html#" + encodeURIComponent(mailId),
    tag: "mail-" + mailId,
    actions: [{ action: "open", title: "Отвори пощата" }]
  });
}
async function tickMail(out) {
  const rows = await q("nd_mail?select=id,data&limit=40").catch(() => []);
  const now = Date.now();
  out.mail = 0;
  for (const row of rows) {
    const d = row.data || {};
    if (d.folder !== "in" || d.read || d.notified) continue;
    const at = Date.parse(d.at || "") || 0;
    if (at && now - at > 36 * 3600000) continue;
    const r = await notifyMail(row.id, d).catch((e) => ({ ok: 0, error: e.message }));
    if (!(r && r.ok)) continue;
    d.notified = true;
    await q("nd_mail?id=eq." + encodeURIComponent(row.id), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ data: d }) }).catch(() => null);
    out.mail++;
  }
}
async function brokerNames() { const rows = await q("nd_brokers?select=id,data"); const m = {}; rows.forEach((r) => { if (r.data && r.data.user_id) m[r.data.user_id] = r.data.name || ""; }); return m; }
function eventText(ev) { const d = ev.data || {}; const kind = TYPE_BG[d.type] || "Събитие"; return { kind, title: d.title || kind, where: [d.client, d.prop, d.extra].filter(Boolean).join(" · ") }; }

/* ---------- напомняния ---------- */
async function tick() {
  if (!SR()) throw new Error("Липсва SUPABASE_SERVICE_ROLE_KEY");
  const now = Date.now(), out = { sent: [], escalated: [], checked: 0 };
  const days = [todayIn(0), todayIn(1)];
  const events = await q("nd_events?select=id,data,created_by,created_at&or=(data->>date.eq." + days[0] + ",data->>date.eq." + days[1] + ")");
  const names = await brokerNames();
  const existing = await q("nd_reminders?select=id,event_id,user_id,kind,sent_at,acked_at&event_id=in.(" + (events.map((e) => '"' + e.id + '"').join(",") || '""') + ")");
  const has = (eid, uid, kind) => existing.find((r) => r.event_id === eid && r.user_id === uid && r.kind === kind);
  for (const ev of events) {
    const d = ev.data || {}; if (!d.date || !d.from) continue;
    const start = toUtc(d.date, d.from); if (!start) continue;
    const who = d.assignee || ev.created_by; if (!who) continue;
    const diff = start.getTime() - now; out.checked++;
    const t = eventText(ev), when = fmtTime(start) + (d.date !== days[0] ? " утре" : "");
    const url = "/mobile/crm/crm-kalendar.html#" + encodeURIComponent(ev.id);
    /* нова задача, възложена от друг – веднага */
    if (d.assignee && d.assignee !== ev.created_by && !has(ev.id, who, "new") && now - new Date(ev.created_at).getTime() < 6 * 3600000 && diff > -600000) {
      await remind(ev, who, "new", { title: "Нова задача от " + (names[ev.created_by] || "екипа") + ": " + t.kind, body: t.title + " · " + when + (t.where ? " · " + t.where : ""), url }, existing, out);
    }
    if (diff <= 2 * 3600000 && diff > 60 * 60000 && !has(ev.id, who, "2h")) await remind(ev, who, "2h", { title: "След 2 часа: " + t.kind + " в " + fmtTime(start), body: t.title + (t.where ? " · " + t.where : ""), url }, existing, out);
    if (diff <= 60 * 60000 && diff > -15 * 60000 && !has(ev.id, who, "1h")) await remind(ev, who, "1h", { title: "След 1 час: " + t.kind + " в " + fmtTime(start), body: t.title + (t.where ? " · " + t.where : "") + " – натиснете „Потвърждавам“", url }, existing, out);
    /* ескалация: 1-часовото не е потвърдено 10 минути */
    const r1 = has(ev.id, who, "1h");
    if (r1 && r1.sent_at && !r1.acked_at && !has(ev.id, who, "esc") && now - new Date(r1.sent_at).getTime() >= ESCALATE_MIN * 60000 && diff > -30 * 60000) {
      const others = (await staffIds()).filter((u) => u !== who);
      const nm = names[who] || "Брокерът";
      const payload = { title: "⚠️ " + nm + " не потвърди: " + t.kind + " в " + fmtTime(start), body: t.title + (t.where ? " · " + t.where : "") + ". Моля, свържете се с него или поемете задачата.", url, tag: "esc-" + ev.id };
      const rid = id(); await q("nd_reminders", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: rid, event_id: ev.id, user_id: who, kind: "esc", due_at: start.toISOString(), sent_at: new Date().toISOString(), payload }) });
      const r = others.length ? await pushTo(others, Object.assign({ rid, ack: ackToken(rid) }, payload)) : { devices: 0, ok: 0 };
      await q("nd_activities", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: id(), data: { icon: "bell", text: "Без потвърждение: " + nm + " – " + t.kind + " в " + fmtTime(start) + " (" + t.title + "). Екипът е уведомен.", client: d.client || "", at: new Date().toISOString() } }) }).catch(() => null);
      out.escalated.push({ event: ev.id, to: others.length, delivered: r.ok });
    }
  }
  await tickMail(out).catch(() => null);
  return out;
}
async function remind(ev, who, kind, payload, existing, out) {
  const start = toUtc(ev.data.date, ev.data.from), rid = id();
  const row = { id: rid, event_id: ev.id, user_id: who, kind, due_at: start.toISOString(), sent_at: new Date().toISOString(), payload };
  await q("nd_reminders", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
  existing.push(row);
  const r = await pushTo([who], Object.assign({ rid, ack: ackToken(rid), tag: "ev-" + ev.id, actions: [{ action: "ack", title: "Потвърждавам" }, { action: "open", title: "Отвори" }] }, payload)).catch((e) => ({ devices: 0, ok: 0, error: e.message }));
  out.sent.push({ event: ev.id, kind, to: who, delivered: r.ok, devices: r.devices });
}
async function ack(rid, by) {
  const rows = await q("nd_reminders?select=id,event_id,user_id,acked_at&id=eq." + encodeURIComponent(rid)); const r = rows[0]; if (!r) throw new Error("Няма такова напомняне");
  const at = new Date().toISOString();
  /* потвърждението важи за всички напомняния на същото събитие за същия брокер */
  await q("nd_reminders?event_id=eq." + encodeURIComponent(r.event_id) + "&user_id=eq." + r.user_id + "&acked_at=is.null", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ acked_at: at, acked_by: by || r.user_id }) });
  return { event_id: r.event_id, acked_at: at };
}

module.exports = async (req, res) => {
  const url = new URL(req.url, SITE); const action = url.searchParams.get("action") || "";
  try {
    /* потвърждение от бутона в известието: GET без вход, с подписан токен */
    if (req.method === "GET" && action === "ack") {
      const t = String(url.searchParams.get("t") || ""), [rid, sig] = t.split(".");
      if (!rid || sig !== sign(rid)) return send(res, 403, { ok: false, error: "Невалиден токен" });
      const r = await ack(rid, null);
      res.statusCode = 200; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.setHeader("Cache-Control", "no-store");
      return res.end('<!doctype html><html lang="bg"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Потвърдено</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;font:600 20px Georgia,serif;color:#fff3dc;background:radial-gradient(120% 80% at 50% 0%,#8d1530,#430c16 60%,#2e0610)"><div style="padding:28px 32px;border-radius:26px;background:rgba(255,250,245,.12);border:1.5px solid #e3b25e;box-shadow:0 0 0 1px rgba(255,236,190,.4),0 0 24px rgba(255,214,150,.45);text-align:center">✅ Потвърдено.<br><small style="font:400 15px Arial">Екипът няма да бъде известяван.</small><br><a href="/mobile/crm/crm-kalendar.html#' + encodeURIComponent(r.event_id) + '" style="display:inline-block;margin-top:18px;padding:10px 18px;border-radius:16px;background:linear-gradient(180deg,#b42446,#4f0716);color:#fff3dc;text-decoration:none;font:700 15px Arial;border:1.5px solid #e3b25e">Отвори календара</a></div></body></html>');
    }
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
    let b = {}; try { b = await readBody(req); } catch (e) { b = {}; }
    const act = b.action || action;
    /* планировчик */
    if (act === "tick" && req.headers["x-cron-key"] && process.env.CRON_SECRET && req.headers["x-cron-key"] === process.env.CRON_SECRET) return send(res, 200, Object.assign({ ok: true, by: "cron" }, await tick()));
    const auth = String(req.headers["authorization"] || ""), token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const user = token ? await staff(token).catch(() => null) : null;
    if (!user) return send(res, 401, { ok: false, error: "Влезте в CRM." });
    if (act === "vapid") return send(res, 200, { ok: true, key: PUB(), configured: !!(PUB() && PRIV() && SR()) });
    if (!SR()) return send(res, 500, { ok: false, error: "Липсва сървърен ключ (SUPABASE_SERVICE_ROLE_KEY)." });
    if (act === "subscribe") {
      const s = b.subscription || {}; if (!s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth) return send(res, 400, { ok: false, error: "Невалиден абонамент" });
      await q("nd_push_subs?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE" }).catch(() => null);
      await q("nd_push_subs", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ id: id(), user_id: user.id, endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, ua: String(b.ua || req.headers["user-agent"] || "").slice(0, 200) }) });
      const n = await q("nd_push_subs?select=id&user_id=eq." + user.id);
      return send(res, 200, { ok: true, devices: n.length });
    }
    if (act === "unsubscribe") { if (b.endpoint) await q("nd_push_subs?endpoint=eq." + encodeURIComponent(b.endpoint) + "&user_id=eq." + user.id, { method: "DELETE" }); else await q("nd_push_subs?user_id=eq." + user.id, { method: "DELETE" }); return send(res, 200, { ok: true }); }
    if (act === "status") { const n = await q("nd_push_subs?select=id,ua,created_at,last_ok&user_id=eq." + user.id); return send(res, 200, { ok: true, devices: n, configured: !!(PUB() && PRIV()) }); }
    if (act === "test") { const r = await pushTo([user.id], { title: "Поща: известията работят ✅", body: "Нови писма ще излизат на заключения екран, когато CRM е на началния екран.", url: "/mobile/crm/crm-poshta.html", tag: "test-mail" }); return send(res, 200, Object.assign({ ok: r.ok > 0 }, r, r.ok ? {} : { error: r.devices ? "Известието не стигна до устройството – включете известията отново." : "Няма регистрирано устройство – натиснете „Включи известията“." })); }
    if (act === "ack") {
      if (b.reminder_id) return send(res, 200, Object.assign({ ok: true }, await ack(String(b.reminder_id), user.id)));
      if (b.event_id) { const at = new Date().toISOString(); await q("nd_reminders?event_id=eq." + encodeURIComponent(String(b.event_id)) + "&acked_at=is.null", { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ acked_at: at, acked_by: user.id }) }); return send(res, 200, { ok: true, acked_at: at }); }
      return send(res, 400, { ok: false, error: "reminder_id или event_id" });
    }
    if (act === "tick") return send(res, 200, Object.assign({ ok: true, by: "page" }, await tick()));
    return send(res, 400, { ok: false, error: "Непознато действие" });
  } catch (e) { return send(res, 500, { ok: false, error: String((e && e.message) || e).slice(0, 300) }); }
};
module.exports.tick = tick;
module.exports.notifyMail = notifyMail;
module.exports.pushTo = pushTo;
