// /api/register – регистрация на брокер с кодово изречение (без потвърждение по имейл).
// Кодът (ND_REG_CODE във Vercel, по подразбиране „Nadka22godini“) е потвърждението: създава се потвърден акаунт,
// запис в nd_staff (роля broker) и брокерска карта в nd_brokers. Паролата не се връща и не се логва.
"use strict";
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CODE = () => process.env.ND_REG_CODE || "Nadka22godini";
function send(res, s, b) { res.statusCode = s; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(b)); }
async function readBody(req) { if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body; const ch = []; for await (const c of req) ch.push(c); return JSON.parse(Buffer.concat(ch).toString("utf8")); }
const H = () => ({ apikey: SR(), Authorization: "Bearer " + SR(), "Content-Type": "application/json" });
function slug(name) {
  const map = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya" };
  return String(name || "").toLowerCase().split("").map((c) => map[c] !== undefined ? map[c] : c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "broker";
}
const attempts = new Map(); /* груба защита от налучкване на кода (в рамките на една инстанция) */
module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  const a = attempts.get(ip) || { n: 0, t: Date.now() }; if (Date.now() - a.t > 15 * 60000) { a.n = 0; a.t = Date.now(); }
  if (a.n >= 8) return send(res, 429, { ok: false, error: "Твърде много опити. Опитайте след 15 минути." });
  if (b.action === "check") {
    if (String(b.code || "").trim() !== CODE()) { a.n++; attempts.set(ip, a); return send(res, 200, { ok: false, error: "Невярно кодово изречение. Опитайте отново." }); }
    return send(res, 200, { ok: true });
  }
  if (String(b.code || "").trim() !== CODE()) { a.n++; attempts.set(ip, a); return send(res, 403, { ok: false, error: "Невярно кодово изречение." }); }
  if (!SR()) return send(res, 500, { ok: false, error: "Липсва сървърен ключ (SUPABASE_SERVICE_ROLE_KEY)." });
  const email = String(b.email || "").trim().toLowerCase(), pass = String(b.password || ""), name = String(b.name || "").trim().replace(/\s+/g, " ").slice(0, 80), phone = String(b.phone || "").trim().slice(0, 30), title = String(b.title || "Брокер").trim().slice(0, 60) || "Брокер";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { ok: false, error: "Въведете валиден имейл." });
  if (pass.length < 8) return send(res, 400, { ok: false, error: "Паролата трябва да е поне 8 символа." });
  if (name.split(" ").length < 2) return send(res, 400, { ok: false, error: "Въведете име и фамилия." });
  try {
    /* 1) акаунт – потвърден веднага (кодовото изречение е потвърждението) */
    let r = await fetch(SB_URL + "/auth/v1/admin/users", { method: "POST", headers: H(), body: JSON.stringify({ email, password: pass, email_confirm: true, user_metadata: { full_name: name, phone } }) });
    let j = await r.json().catch(() => ({}));
    let userId = j.id;
    if (!r.ok) {
      const msg = String(j.msg || j.message || j.error_description || j.error || "");
      if (/already|exists|registered/i.test(msg)) {
        /* съществуващ акаунт: ако вече е служител – казваме да влезе; ако не е – с кода го активираме като брокер и сменяме паролата */
        const q = await fetch(SB_URL + "/rest/v1/rpc/nd_admin_user_id", { method: "POST", headers: H(), body: JSON.stringify({ p_email: email }) }).catch(() => null);
        const uid = q && q.ok ? await q.json().catch(() => null) : null;
        if (!uid) return send(res, 409, { ok: false, error: "Този имейл вече е регистриран. Използвайте „Вход“ или „Забравена парола“." });
        const st = await fetch(SB_URL + "/rest/v1/nd_staff?user_id=eq." + uid + "&select=user_id", { headers: H() }); const sj = await st.json().catch(() => []);
        if (Array.isArray(sj) && sj.length) return send(res, 409, { ok: false, error: "Този имейл вече има достъп до CRM. Използвайте „Вход“ или „Забравена парола“." });
        const up = await fetch(SB_URL + "/auth/v1/admin/users/" + uid, { method: "PUT", headers: H(), body: JSON.stringify({ password: pass, email_confirm: true, user_metadata: { full_name: name, phone } }) });
        if (!up.ok) return send(res, 502, { ok: false, error: "Акаунтът съществува, но не можа да се активира." });
        userId = uid;
      } else if (/password/i.test(msg)) return send(res, 400, { ok: false, error: "Паролата е твърде слаба. Изберете по-дълга и по-различна." });
      else return send(res, 502, { ok: false, error: "Регистрацията не успя: " + (msg || "HTTP " + r.status) });
    }
    /* 2) достъп до CRM */
    r = await fetch(SB_URL + "/rest/v1/nd_staff", { method: "POST", headers: Object.assign(H(), { Prefer: "resolution=merge-duplicates" }), body: JSON.stringify({ user_id: userId, role: "broker" }) });
    if (!r.ok) return send(res, 502, { ok: false, error: "Акаунтът е създаден, но достъпът до CRM не се записа (" + r.status + ")." });
    /* 3) брокерска карта */
    let id = slug(name); const ex = await fetch(SB_URL + "/rest/v1/nd_brokers?select=id,data&data->>email=eq." + encodeURIComponent(email), { headers: H() }); const exj = await ex.json().catch(() => []);
    if (Array.isArray(exj) && exj[0]) id = exj[0].id; else { const dup = await fetch(SB_URL + "/rest/v1/nd_brokers?select=id&id=eq." + encodeURIComponent(id), { headers: H() }); const dj = await dup.json().catch(() => []); if (Array.isArray(dj) && dj.length) id = id + "-" + Date.now().toString(36).slice(-4); }
    /* същата структура като картата, която страница „Брокери“ създава (sales/rent са флагове, perms/restr/clients – списъци) */
    const card = { name, title, role: "Брокер", phone, email, photo: "avatar.jpg", thumb: "avatar.jpg", active: true, office: "Шумен", pos: title, perms: ["Огледи", "Клиенти", "Публикации", "Документи"], restr: [], deals: 0, sales: true, rent: true, listings: 0, clients: [], rating: 5, reviews: 0, user_id: userId, created: new Date().toISOString() };
    if (Array.isArray(exj) && exj[0]) Object.assign(card, exj[0].data || {}, { name, phone, email, user_id: userId, active: true });
    r = await fetch(SB_URL + "/rest/v1/nd_brokers", { method: "POST", headers: Object.assign(H(), { Prefer: "resolution=merge-duplicates" }), body: JSON.stringify({ id, data: card }) });
    if (!r.ok) return send(res, 200, { ok: true, user_id: userId, broker_id: null, warn: "Профилът е създаден, но брокерската карта не се записа – добавете я от Брокери." });
    try { await fetch(SB_URL + "/rest/v1/nd_activities", { method: "POST", headers: H(), body: JSON.stringify({ id: "act-" + Date.now().toString(36), data: { icon: "user-round", text: "Нов брокер: " + name + " (" + email + ")", at: new Date().toISOString() } }) }); } catch (e) {}
    return send(res, 200, { ok: true, user_id: userId, broker_id: id });
  } catch (e) { return send(res, 502, { ok: false, error: String(e.message || e).slice(0, 200) }); }
};
