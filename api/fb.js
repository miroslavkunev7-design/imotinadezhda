// /api/fb — Facebook page of the agency: connect (login), choose page, disconnect, post a property with its photos.
// Needs FB_APP_ID and FB_APP_SECRET (Meta app with pages_show_list, pages_manage_posts, pages_read_engagement).
// Page tokens are stored server-side only (nd_secrets, no client access) using the service role key.
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const G = "https://graph.facebook.com/v21.0";

function send(res, s, b) { res.statusCode = s; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(b)); }
async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = []; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function isStaff(token) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/nd_is_staff", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
async function secretGet(key) {
  const r = await fetch(SB_URL + "/rest/v1/nd_secrets?key=eq." + encodeURIComponent(key) + "&select=value", { headers: { apikey: SR(), Authorization: "Bearer " + SR() } });
  const j = await r.json().catch(() => []); return Array.isArray(j) && j[0] ? j[0].value : null;
}
async function secretSet(key, value) {
  await fetch(SB_URL + "/rest/v1/nd_secrets", { method: "POST", headers: { apikey: SR(), Authorization: "Bearer " + SR(), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }) });
}
async function secretDel(key) { await fetch(SB_URL + "/rest/v1/nd_secrets?key=eq." + encodeURIComponent(key), { method: "DELETE", headers: { apikey: SR(), Authorization: "Bearer " + SR() } }); }
async function gget(path, params) { const u = new URL(G + path); Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v)); const r = await fetch(u); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j; }
async function gpost(path, params) { const r = await fetch(G + path, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) }); const j = await r.json(); if (j.error) throw new Error(j.error.message); return j; }
const money = (n) => new Intl.NumberFormat("bg-BG").format(n);

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  const auth = String(req.headers["authorization"] || ""); const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !(await isStaff(token).catch(() => false))) return send(res, 401, { ok: false, error: "Влезте в CRM." });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  const appId = process.env.FB_APP_ID, secret = process.env.FB_APP_SECRET;
  try {
    /* Публикуване през n8n (System User ключ на страницата) – не изисква вход с Facebook от CRM.
       n8n сам проверява, че заявката е от влязъл служител (същия вход в CRM). Ползва се, докато няма собствено FB приложение тук. */
    const N8N = !(appId && secret);
    const N8H = { "Content-Type": "application/json", Authorization: "Bearer " + token };
    if (b.action === "chatsend") {
      /* CRM Чат: ръчен отговор от служител към клиент (WhatsApp / Messenger / Instagram) – праща n8n с ключовете на агенцията */
      const r = await fetch("https://imotinadezhda.app.n8n.cloud/webhook/chat-send", { method: "POST", headers: N8H, body: JSON.stringify({ chatId: String(b.chatId || ""), text: String(b.text || "").slice(0, 4000) }) });
      const j = await r.json().catch(() => ({})); const o = Array.isArray(j) ? j[0] || {} : j;
      return send(res, 200, r.ok && o.ok ? { ok: true } : { ok: false, error: String(o.error || o.message || ("Неуспешно изпращане (" + r.status + ")")).replace(/\s*\[line \d+\]$/, "") });
    }
    if (N8N && b.action === "sync") {
      /* архив/сваляне → скрий поста, публикуване → покажи, изтриване на имота → изтрий поста */
      const r = await fetch("https://imotinadezhda.app.n8n.cloud/webhook/fb-sync", { method: "POST", headers: N8H, body: JSON.stringify({ op: String(b.op || ""), postId: String(b.postId || "") }) });
      const j = await r.json().catch(() => ({})); const o = Array.isArray(j) ? j[0] || {} : j;
      return send(res, 200, r.ok && o.ok ? { ok: true } : { ok: false, error: "Facebook: " + String(o.message || "грешка " + r.status) });
    }
    if (N8N && (b.action === "config" || b.action === "post")) {
      const PAGE = { id: "1447196405137713", name: "Недвижими Имоти • Надежда •", link: "https://www.facebook.com/1447196405137713" };
      if (b.action === "config") return send(res, 200, { ok: true, appId: "n8n", ready: true, via: "n8n", page: PAGE });
      const r = await fetch("https://imotinadezhda.app.n8n.cloud/webhook/fb-publish-property", { method: "POST", headers: N8H, body: JSON.stringify({ id: String(b.id || ""), force: !!b.force }) });
      const j = await r.json().catch(() => ({}));
      const o = Array.isArray(j) ? j[0] || {} : j;
      if (!r.ok || !o.ok) return send(res, 200, { ok: false, error: "Facebook: " + String(o.message || o.error || ("грешка " + r.status)).replace(/\s*\[line \d+\]$/, "") });
      return send(res, 200, { ok: true, postId: o.postId, link: o.link, photos: o.photos || 0 });
    }
    if (b.action === "config") {
      const page = SR() ? await secretGet("fb_page") : null;
      return send(res, 200, { ok: true, appId: appId || null, ready: !!(appId && secret && SR()), page: page ? { id: page.id, name: page.name, link: "https://www.facebook.com/" + page.id } : null });
    }
    if (!appId || !secret) return send(res, 200, { ok: false, needApp: true, error: "Липсва Facebook приложение (FB_APP_ID и FB_APP_SECRET)." });
    if (!SR()) return send(res, 500, { ok: false, error: "Липсва ключ за сървъра." });
    if (b.action === "connect") {
      const ll = await gget("/oauth/access_token", { grant_type: "fb_exchange_token", client_id: appId, client_secret: secret, fb_exchange_token: String(b.userToken || "") });
      await secretSet("fb_user", { token: ll.access_token, at: Date.now() });
      const pages = await gget("/me/accounts", { access_token: ll.access_token, fields: "id,name,tasks" });
      return send(res, 200, { ok: true, pages: (pages.data || []).map((p) => ({ id: p.id, name: p.name, canPost: (p.tasks || []).some((t) => t === "CREATE_CONTENT" || t === "MANAGE") })) });
    }
    if (b.action === "select") {
      const u = await secretGet("fb_user"); if (!u) return send(res, 400, { ok: false, error: "Свържете се отново." });
      const pages = await gget("/me/accounts", { access_token: u.token, fields: "id,name,access_token" });
      const p = (pages.data || []).find((x) => x.id === String(b.pageId)); if (!p) return send(res, 404, { ok: false, error: "Страницата не е намерена." });
      await secretSet("fb_page", { id: p.id, name: p.name, token: p.access_token, at: Date.now() });
      return send(res, 200, { ok: true, page: { id: p.id, name: p.name, link: "https://www.facebook.com/" + p.id } });
    }
    if (b.action === "disconnect") { await secretDel("fb_page"); await secretDel("fb_user"); return send(res, 200, { ok: true }); }
    if (b.action === "post") {
      const page = await secretGet("fb_page"); if (!page) return send(res, 400, { ok: false, error: "Няма свързана Facebook страница." });
      const r = await fetch(SB_URL + "/rest/v1/nd_properties?id=eq." + encodeURIComponent(b.id) + "&select=id,data", { headers: { apikey: SR(), Authorization: "Bearer " + SR() } });
      const row = (await r.json())[0]; if (!row) return send(res, 404, { ok: false, error: "Имотът не е намерен." });
      const p = row.data || {};
      const place = [p.place && p.place !== p.city ? p.place : "", p.city, p.hood ? "кв. " + p.hood : ""].filter(Boolean).join(", ");
      const msg = (b.message || [
        "🏡 " + (p.title || p.type || "Имот") + (place ? " – " + place : ""),
        p.price ? "💶 " + money(p.price) + " €" + (p.deal === "rent" ? " / мес." : "") : "",
        [p.area ? p.area + " м²" : "", p.rooms ? p.rooms + " стаи" : "", p.floor ? "етаж " + p.floor : ""].filter(Boolean).join(" · "),
        "", String(p.desc || "").slice(0, 1500), "",
        "📞 0898 977 370 · Недвижими Имоти Надежда", "🔗 https://imotinadezhda.bg/mobile/ilj.html#/property/" + row.id + "/" + ({ "Шумен": "shumen", "Варна": "varna", "Бургас": "burgas" }[p.city] || "shumen")
      ].filter((x, i, a) => x !== "" || (a[i - 1] && a[i - 1] !== "")).join("\n")).slice(0, 5000);
      const pics = (p.pics || []).slice(0, 10);
      let urls = [];
      if (pics.length) {
        const s = await fetch(SB_URL + "/storage/v1/object/sign/nd-files", { method: "POST", headers: { apikey: SR(), Authorization: "Bearer " + SR(), "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 3600, paths: pics }) });
        urls = ((await s.json()) || []).map((x) => x.signedURL ? SB_URL + "/storage/v1" + x.signedURL : null).filter(Boolean);
      }
      const media = [];
      for (const u of urls) { try { const ph = await gpost("/" + page.id + "/photos", { url: u, published: "false", access_token: page.token }); media.push(ph.id); } catch (e) {} }
      const params = { message: msg, access_token: page.token };
      media.forEach((id, i) => { params["attached_media[" + i + "]"] = JSON.stringify({ media_fbid: id }); });
      const post = await gpost("/" + page.id + "/feed", params);
      return send(res, 200, { ok: true, postId: post.id, link: "https://www.facebook.com/" + post.id, photos: media.length });
    }
    return send(res, 400, { ok: false, error: "Непознато действие" });
  } catch (e) { return send(res, 502, { ok: false, error: "Facebook: " + String(e.message || e) }); }
};
