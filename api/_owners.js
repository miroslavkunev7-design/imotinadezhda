// Тед: „Намери имоти от собственици“ за всяка област, град или село в България.
// 1) Google търсене (Gemini grounding) по сайтовете за обяви → линкове към страници с обяви;
// 2) всяка страница минава през колектора (/api/collect): само частни обяви, без агенции, с телефон, ако е публикуван в обявата;
// 3) за страници-списъци се отварят и отделните обяви (там обикновено е телефонът);
// 4) резултатите се записват в „Събрани“ (nd_collected) с източник и дата – за проследимост (GDPR) и „Запамети в архив“.
// Не се заобикалят защити: robots.txt се спазва, скрити зад бутон/вход телефони не се извличат – тогава се връща линкът.
"use strict";
const WEB = require("./_web.js");
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const SITES = ["imot.bg", "olx.bg", "alo.bg", "bazar.bg", "imoti.net", "homes.bg"];
const SKIP = /google\.|youtube\.|facebook\.|instagram\.|wikipedia\.|tiktok\./i;

async function resolve(u) {
  /* линковете от Google grounding са пренасочвания – взимаме истинския адрес */
  if (!/grounding-api-redirect|vertexaisearch/.test(u)) return u;
  try { const r = await fetch(u, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(6000) }); return r.headers.get("location") || null; } catch (e) { return null; }
}
async function search(q) {
  try { const r = await WEB.webSearch(q); return r.sources.map((x) => x.url); } catch (e) { return []; }
}
async function collect(origin, token, url, keywords) {
  try {
    const r = await fetch(origin + "/api/collect", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ url, keywords, properties: true, clients: false, model: "lite" }), signal: AbortSignal.timeout(28000) });
    return await r.json();
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
const norm = (s) => String(s || "").toLocaleLowerCase("bg").replace(/^(с\.|гр\.|село|град)\s*/, "").trim();
const dupKey = (x) => (String(x.phone || "").split(",")[0].replace(/\D/g, "") || "") + "|" + String(x.link || x.title || "").slice(0, 120);

async function findOwners(ctx, a) {
  const t0 = Date.now(), budget = 46000;
  const place = String(a.place || "").trim(), region = String(a.region || "").trim();
  if (!place && !region) return { ok: false, error: "Посочете място: село, град или област (напр. place:\"Ново село\", region:\"Велико Търново\")." };
  const type = String(a.type || "имот").trim(), deal = a.deal === "rent" ? "под наем" : "продава";
  const where = [place && (/^(с\.|гр\.)/.test(place) ? place : place), region && (/област/i.test(region) ? region : "област " + region)].filter(Boolean).join(" ");
  const qs = [
    `${type} ${deal} ${where} от собственик без посредник обява телефон цена`,
    `${type} ${where} частно лице ${deal} site:${SITES[0]} OR site:${SITES[1]} OR site:${SITES[2]} OR site:${SITES[3]}`,
    `обяви ${type} ${where} ${deal} собственик ${SITES.slice(4).join(" ")}`
  ];
  const raw = (await Promise.all(qs.map(search))).flat();
  const urls = [...new Set((await Promise.all([...new Set(raw)].slice(0, 16).map(resolve))).filter((u) => u && /^https?:/.test(u) && !SKIP.test(u)))].slice(0, 6);
  if (!urls.length) return { ok: true, count: 0, items: [], note: "Google не върна страници с обяви за „" + where + "“. Опитайте с по-голям град/областта или друг вид имот." };
  const kw = [norm(place), norm(region).replace(/област\s*/, ""), "собственик", "без посредник", "частно", "продава", "продавам", "наем", "къща", "апартамент", "парцел", "имот"].filter((k) => k && k.length > 2);
  const items = [], pages = [], detail = [];
  const take = (res, u) => { pages.push({ url: u, ok: !!res.ok, found: res.items ? res.items.length : 0, reason: res.blocked ? res.reason : res.error || "" }); if (res.ok) { (res.items || []).forEach((x) => items.push(x)); (res.detailLinks || []).forEach((d) => detail.push(d)); } };
  /* първа вълна: страниците от търсенето (по 3 едновременно, за да не се удари лимитът) */
  for (let i = 0; i < urls.length && Date.now() - t0 < budget - 15000; i += 3) {
    const batch = urls.slice(i, i + 3); (await Promise.all(batch.map((u) => collect(ctx.origin, ctx.token, u, kw)))).forEach((r, k) => take(r, batch[k]));
  }
  /* втора вълна: отделните обяви от страниците-списъци (там е телефонът) */
  const more = [...new Set(detail)].filter((d) => !pages.some((p) => p.url === d)).slice(0, Math.max(0, Number(a.max_details) || 6));
  for (let i = 0; i < more.length && Date.now() - t0 < budget - 12000; i += 3) {
    const batch = more.slice(i, i + 3); (await Promise.all(batch.map((u) => collect(ctx.origin, ctx.token, u, kw)))).forEach((r, k) => take(r, batch[k]));
  }
  /* филтър по място и цена, без дубликати */
  const p0 = norm(place).slice(0, 5), maxP = Number(a.max_price) || 0, seen = {};
  const out = items.filter((x) => {
    const k = dupKey(x); if (seen[k]) return false; seen[k] = 1;
    if (maxP && x.price && x.price > maxP) return false;
    if (p0 && ![x.city, x.hood, x.title, x.text].join(" ").toLocaleLowerCase("bg").includes(p0)) x.place_unsure = true;
    return true;
  });
  /* запис в „Събрани“ */
  let saved = 0;
  if (a.save !== false && out.length) {
    try {
      const ex = await fetch(SB_URL + "/rest/v1/nd_collected?select=data", { headers: { apikey: SB_KEY, Authorization: "Bearer " + ctx.token } }).then((r) => r.ok ? r.json() : []);
      const have = new Set((ex || []).map((r) => dupKey(r.data || {})));
      const rows = out.filter((x) => !have.has(dupKey(x))).map((x) => ({ name: x.title || "Обява", data: Object.assign({}, x, { found_by: "Тед", query: where }) }));
      if (rows.length) { const r = await fetch(SB_URL + "/rest/v1/nd_collected", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + ctx.token, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(rows) }); if (r.ok) saved = rows.length; }
    } catch (e) {}
  }
  return {
    ok: true, query: where, count: out.length, saved_to_collected: saved,
    items: out.slice(0, 25).map((x) => ({ title: x.title, type: x.type, city: x.city, hood: x.hood, price_eur: x.price, area: x.area, phone: x.phone, name: x.name, link: x.link, source: x.source, posted: x.posted, place_unsure: !!x.place_unsure })),
    pages_checked: pages.length, blocked: pages.filter((p) => !p.ok).map((p) => ({ url: p.url, reason: String(p.reason).slice(0, 120) })).slice(0, 6),
    note: "Телефоните са от самите обяви (публикувани от собствениците за контакт). Където сайтът крие телефона зад бутон или вход, има само линк. Всичко е записано в „Събрани“ с източник и дата."
  };
}
module.exports = { findOwners };
