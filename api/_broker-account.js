/* Authenticated broker password changes. Passwords never enter CRM records or logs. */
"use strict";
const SB = "https://hyvwfsmjbaynozceookv.supabase.co";
const PUB = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const attempts = new Map();
const uuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""));
const json = (r) => r.json().catch(() => null);
async function call(path, headers, method = "GET", body) {
  return fetch(SB + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
}
module.exports = async function (req, res) {
  function send(status, body) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(body));
  }
  if (req.method !== "POST") return send(405, { ok: false, error: "POST only" });
  const origin = req.headers.origin;
  if (origin && origin !== "https://imotinadezhda.bg" && origin !== "https://" + req.headers.host) return send(403, { ok: false, error: "Невалидна заявка." });
  const auth = String(req.headers.authorization || "");
  if (!/^Bearer \S+$/i.test(auth)) return send(401, { ok: false, error: "Влезте отново в CRM." });
  const b = req.body || {}, password = typeof b.password === "string" ? b.password : "";
  if (password.length < 8 || password.length > 128) return send(400, { ok: false, error: "Паролата трябва да е между 8 и 128 символа." });
  const brokerId = String(b.brokerId || "");
  if (brokerId.length > 120) return send(400, { ok: false, error: "Невалидна брокерска карта." });
  try {
    const H = { apikey: PUB, Authorization: auth, "Content-Type": "application/json" };
    const ur = await call("/auth/v1/user", H), user = ur.ok ? await json(ur) : null;
    if (!user || !uuid(user.id)) return send(401, { ok: false, error: "Сесията е изтекла. Влезте отново." });
    const now = Date.now(), old = attempts.get(user.id), rate = old && now - old.at < 900000 ? old : { at: now, count: 0 };
    attempts.set(user.id, rate); rate.count++;
    for (const [id, item] of attempts) if (now - item.at > 900000) attempts.delete(id);
    if (rate.count > 10) return send(429, { ok: false, error: "Твърде много опити. Опитайте след 15 минути." });
    const sr = await call("/rest/v1/rpc/nd_is_staff", H, "POST", {});
    if (!sr.ok || await json(sr) !== true) return send(403, { ok: false, error: "Нямате достъп до CRM." });
    const ar = await call("/rest/v1/rpc/nd_is_admin", H, "POST", {}), admin = ar.ok && await json(ar) === true;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return send(503, { ok: false, error: "Смяната на парола временно не е достъпна." });
    const A = { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" };
    let target = user.id;
    if (brokerId) {
      const br = await call("/rest/v1/nd_brokers?select=data&id=eq." + encodeURIComponent(brokerId) + "&limit=1", A);
      if (!br.ok) return send(502, { ok: false, error: "Картата не се зареди. Опитайте отново." });
      const rows = await json(br), card = Array.isArray(rows) && rows[0] && rows[0].data;
      if (!card) return send(404, { ok: false, error: "Брокерската карта не е намерена." });
      target = card.user_id;
      /* The original manager card predates user_id. Resolve only for a verified admin. */
      if (!uuid(target) && admin && card.email) {
        const lr = await call("/rest/v1/rpc/nd_admin_user_id", A, "POST", { p_email: card.email });
        if (lr.ok) target = await json(lr);
      }
      if (!uuid(target)) return send(409, { ok: false, error: "Тази карта няма свързан акаунт за вход. Първо завършете регистрацията на брокера." });
    }
    if (target !== user.id && !admin) return send(403, { ok: false, error: "Можете да сменяте само своята парола. За друг брокер е необходим администратор." });
    const tr = await call("/rest/v1/nd_staff?select=user_id&user_id=eq." + encodeURIComponent(target) + "&limit=1", A);
    const staff = tr.ok ? await json(tr) : null;
    if (!Array.isArray(staff) || !staff.length) return send(409, { ok: false, error: "Брокерът няма активен акаунт в CRM." });
    const update = admin ? await call("/auth/v1/admin/users/" + target, A, "PUT", { password }) : await call("/auth/v1/user", H, "PUT", { password });
    const result = await json(update), changed = result && (result.user || result);
    if (!update.ok) {
      const same = result && result.code === "same_password";
      return send(update.status === 429 ? 429 : 400, { ok: false, error: same ? "Въведете парола, различна от настоящата." : "Паролата не е сменена. Проверете изискванията за парола или влезте отново в CRM." });
    }
    if (!changed || changed.id !== target) return send(502, { ok: false, error: "Сървърът не потвърди смяната. Опитайте да влезете с новата парола." });
    return send(200, { ok: true, message: "Паролата е сменена. Използвайте новата парола при следващия вход." });
  } catch (e) {
    return send(502, { ok: false, error: "Няма връзка със сървъра. Проверете входа си, преди да повторите смяната." });
  }
};
