// /api/register – регистрация на брокер: кодово изречение → две имена, телефон, парола → SMS код → активен профил.
// (Старият вариант с имейл остава за съвместимост.)
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
/* телефон → +359XXXXXXXXX; вход без имейл: служебен адрес от номера (не се ползва за поща) */
function normPhone(v) {
  let d = String(v || "").replace(/[^\d+]/g, ""); if (d.startsWith("+")) d = d.slice(1); else if (d.startsWith("00")) d = d.slice(2); else if (/^0[89]\d{8}$/.test(d)) d = "359" + d.slice(1); else if (/^[89]\d{8}$/.test(d)) d = "359" + d;
  return /^\d{10,15}$/.test(d) ? "+" + d : "";
}
const phoneLogin = (p) => "p" + String(p).replace(/\D/g, "") + "@tel.imotinadezhda.bg";
const mask = (p) => String(p).replace(/^(\+\d{3})(\d{2})(\d+)(\d{2})$/, (m, a, b, c, d) => a + " " + b + " " + "*".repeat(c.length) + " " + d);
const pretty = (p) => String(p).replace(/^\+359(\d{3})(\d{3})(\d{3})$/, "0$1 $2 $3");
/* новият код се издава в базата (пази се само хеш) и се праща по SMS през n8n */
async function sendCode(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Няма активна заявка." };
  const r = await fetch("https://imotinadezhda.app.n8n.cloud/webhook/reg-sms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {}; const o = Array.isArray(j) ? j[0] || {} : j;
  if (!r || !r.ok || !o.ok) return { ok: false, error: o.error || "Кодът не можа да се изпрати. Опитайте отново след минута." };
  return { ok: true, via: o.via || "sms" };
}
async function verify(id, otp) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Няма активна заявка." };
  const r = await fetch(SB_URL + "/rest/v1/rpc/nd_reg_check", { method: "POST", headers: H(), body: JSON.stringify({ p_id: id, p_code: otp }) });
  const c = await r.json().catch(() => ({}));
  if (!c || !c.ok) return { ok: false, error: (c && c.error) || "Грешен код." };
  const userId = c.user_id, name = c.name, phone = c.phone, title = c.title || "Брокер";
  /* 1) достъп до CRM */
  let s = await fetch(SB_URL + "/rest/v1/nd_staff", { method: "POST", headers: Object.assign(H(), { Prefer: "resolution=merge-duplicates" }), body: JSON.stringify({ user_id: userId, role: "broker" }) });
  if (!s.ok) return { ok: false, error: "Кодът е верен, но достъпът до CRM не се записа (" + s.status + "). Опитайте пак." };
  /* 2) брокерска карта – видима веднага в „Брокери“ */
  let id2 = slug(name);
  const ex = await fetch(SB_URL + "/rest/v1/nd_brokers?select=id,data&data->>user_id=eq." + userId, { headers: H() }); const exj = await ex.json().catch(() => []);
  if (Array.isArray(exj) && exj[0]) id2 = exj[0].id; else { const dup = await fetch(SB_URL + "/rest/v1/nd_brokers?select=id&id=eq." + encodeURIComponent(id2), { headers: H() }); const dj = await dup.json().catch(() => []); if (Array.isArray(dj) && dj.length) id2 = id2 + "-" + Date.now().toString(36).slice(-4); }
  const card = { name, title, role: "Брокер", phone: pretty(phone), email: "", photo: "avatar.jpg", thumb: "avatar.jpg", active: true, office: "Шумен", pos: title, perms: ["Огледи", "Клиенти", "Публикации", "Документи"], restr: [], deals: 0, sales: true, rent: true, listings: 0, clients: [], rating: 5, reviews: 0, user_id: userId, phone_verified: true, created: new Date().toISOString() };
  if (Array.isArray(exj) && exj[0]) Object.assign(card, exj[0].data || {}, { name, phone: pretty(phone), user_id: userId, active: true, phone_verified: true });
  const w = await fetch(SB_URL + "/rest/v1/nd_brokers", { method: "POST", headers: Object.assign(H(), { Prefer: "resolution=merge-duplicates" }), body: JSON.stringify({ id: id2, data: card }) });
  if (!c.again) { try { await fetch(SB_URL + "/rest/v1/nd_activities", { method: "POST", headers: H(), body: JSON.stringify({ id: "act-" + Date.now().toString(36), data: { icon: "user-round", text: "Нов брокер: " + name + " (" + pretty(phone) + ") – потвърден по SMS", at: new Date().toISOString() } }) }); } catch (e) {} }
  const au=await fetch(SB_URL+"/auth/v1/admin/users/"+userId,{headers:H()});
  const aj=au.ok?await au.json():{};
  return { ok: true, login: aj.email || phoneLogin(phone), broker_id: w.ok ? id2 : null };
}
module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  if (b.action === "broker-password") { req.body = b; return require("./_broker-account.js")(req, res); }
  if (b.action === "auth-login" || b.action === "auth-reset") { req.body = Object.assign({}, b, { action: b.action.slice(5) }); return require("./_broker-auth.js")(req, res); }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  const a = attempts.get(ip) || { n: 0, t: Date.now() }; if (Date.now() - a.t > 15 * 60000) { a.n = 0; a.t = Date.now(); }
  if (a.n >= 8) return send(res, 429, { ok: false, error: "Твърде много опити. Опитайте след 15 минути." });
  if (b.action === "check") {
    if (String(b.code || "").trim() !== CODE()) { a.n++; attempts.set(ip, a); return send(res, 200, { ok: false, error: "Невярно кодово изречение. Опитайте отново." }); }
    return send(res, 200, { ok: true });
  }
  /* ---------- регистрация с телефон + SMS код (без имейл – агенцията ползва общ имейл) ---------- */
  if (b.action === "start" || b.action === "resend" || b.action === "verify") {
    if (!SR()) return send(res, 500, { ok: false, error: "Липсва сървърен ключ (SUPABASE_SERVICE_ROLE_KEY)." });
    try {
      if (b.action === "resend") return send(res, 200, await sendCode(String(b.id || "")));
      if (b.action === "verify") return send(res, 200, await verify(String(b.id || ""), String(b.otp || "")));
      if (String(b.code || "").trim() !== CODE()) { a.n++; attempts.set(ip, a); return send(res, 403, { ok: false, error: "Невярно кодово изречение." }); }
      const name = String(b.name || "").trim().replace(/\s+/g, " ").slice(0, 80), pass = String(b.password || ""), title = String(b.title || "Брокер").trim().slice(0, 60) || "Брокер";
      const phone = normPhone(b.phone);
      if (name.split(" ").length < 2) return send(res, 400, { ok: false, error: "Въведете двете си имена." });
      if (!phone) return send(res, 400, { ok: false, error: "Въведете валиден телефонен номер (напр. 0888 123 456)." });
      if (pass.length < 8) return send(res, 400, { ok: false, error: "Паролата трябва да е поне 8 символа." });
      const suppliedEmail=String(b.email||"").trim().toLowerCase();
      if(suppliedEmail&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(suppliedEmail))return send(res,400,{ok:false,error:"Въведете валиден имейл."});
      const existing=await fetch(SB_URL+"/rest/v1/nd_brokers?select=data",{headers:H()});
      if(!existing.ok)return send(res,502,{ok:false,error:"Проверката на профила не успя. Опитайте отново."});
      const brokers=await existing.json();
      if(brokers.some(x=>x.data&&normPhone(x.data.phone)===phone&&x.data.user_id))return send(res,409,{ok:false,error:"С този телефон вече има профил. Използвайте вход или възстановяване."});
      const login = suppliedEmail || phoneLogin(phone);
      /* акаунт за вход с телефона; достъп до CRM се дава едва след верния SMS код */
      let userId = null;
      const q = await fetch(SB_URL + "/rest/v1/rpc/nd_admin_user_id", { method: "POST", headers: H(), body: JSON.stringify({ p_email: login }) }).catch(() => null);
      const uid = q && q.ok ? await q.json().catch(() => null) : null;
      if (uid) {
        const st = await fetch(SB_URL + "/rest/v1/nd_staff?user_id=eq." + uid + "&select=user_id", { headers: H() }); const sj = await st.json().catch(() => []);
        if (Array.isArray(sj) && sj.length) return send(res, 409, { ok: false, error: "С този телефон вече има профил. Влезте с телефона и паролата си." });
        const up = await fetch(SB_URL + "/auth/v1/admin/users/" + uid, { method: "PUT", headers: H(), body: JSON.stringify({ password: pass, email_confirm: true, user_metadata: { full_name: name, phone, phone_login: true } }) });
        if (!up.ok) return send(res, 502, { ok: false, error: "Профилът не можа да се подготви. Опитайте отново." });
        userId = uid;
      } else {
        const r = await fetch(SB_URL + "/auth/v1/admin/users", { method: "POST", headers: H(), body: JSON.stringify({ email: login, password: pass, email_confirm: true, user_metadata: { full_name: name, phone, phone_login: true } }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { const msg = String(j.msg || j.message || j.error_description || j.error || ""); return send(res, /password/i.test(msg) ? 400 : 502, { ok: false, error: /password/i.test(msg) ? "Паролата е твърде слаба. Изберете по-дълга и по-различна." : "Регистрацията не успя: " + (msg || "HTTP " + r.status) }); }
        userId = j.id;
      }
      const pr = await fetch(SB_URL + "/rest/v1/nd_reg_pending", { method: "POST", headers: Object.assign(H(), { Prefer: "return=representation" }), body: JSON.stringify({ phone, name, title, user_id: userId }) });
      const pj = await pr.json().catch(() => []); const id = Array.isArray(pj) && pj[0] ? pj[0].id : null;
      if (!id) return send(res, 502, { ok: false, error: "Заявката не се записа. Опитайте отново." });
      const sent = await sendCode(id);
      return send(res, 200, Object.assign({ id, phone: mask(phone) }, sent, { ok: !!sent.ok, id }));
    } catch (e) { return send(res, 502, { ok: false, error: String(e.message || e).slice(0, 200) }); }
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
