// Тед: „Намери имоти от собственици“ за всяко село, град или област в България.
// Източник: imot.bg (robots.txt позволява; телефонът е публикуван в самата обява). Без AI – директно четене, бързо и без лимити.
// Списък → отделните обяви → цена, площ, място, продавач (частно лице/агенция), телефон „За контакт“ → само частни лица.
// Резултатите се записват в „Събрани“ (nd_collected) с източник и дата (проследимост, GDPR).
// Bazar.bg и OLX крият телефона зад бутон (OLX го забранява и в robots.txt) – за тях се дават само линкове за търсене.
"use strict";
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const UA = "Mozilla/5.0 (compatible; ImotiNadezhdaBot/1.0; +https://imotinadezhda.bg)";
const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya" };
const slug = (s) => String(s || "").toLocaleLowerCase("bg").replace(/^(с\.|гр\.|село|град|област|обл\.)\s*/g, "").replace(/\s*област$/, "").trim().split("").map((c) => TR[c] !== undefined ? TR[c] : c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const BIG = new Set(["sofiya", "plovdiv", "varna", "burgas", "ruse", "stara-zagora", "pleven", "sliven", "dobrich", "shumen", "pernik", "haskovo", "yambol", "pazardzhik", "blagoevgrad", "veliko-tarnovo", "vratsa", "gabrovo", "vidin", "montana", "kardzhali", "kyustendil", "lovech", "razgrad", "silistra", "smolyan", "targovishte"]);
const TYPES = [[/едностаен/, "ednostaen"], [/двустаен/, "dvustaen"], [/тристаен/, "tristaen"], [/четиристаен/, "chetiristaen"], [/многостаен/, "mnogostaen"], [/мезонет/, "mezonet"], [/етаж/, "etazh-ot-kashta"], [/вила/, "vila"], [/къщ/, "kashta"], [/парцел|упи|място/, "partsel"], [/земя|нива|ливада/, "zemedelska-zemya"], [/гараж|паркомяст/, "garazh-parkomyasto"], [/офис/, "ofis"], [/магазин/, "magazin"], [/апартамент/, ""]];
const PHONE = /(?:\+359|00359|0)[\s\-\/.]?(?:8[789]|[2-9]\d)[\d\s\-\/.]{6,9}\d/g;
const normPhone = (p) => { let d = String(p || "").replace(/\D/g, ""); if (d.startsWith("00359")) d = d.slice(5); else if (d.startsWith("359")) d = d.slice(3); if (!d.startsWith("0")) d = "0" + d; return d; };

async function get(url, ms) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "bg" }, redirect: "follow", signal: AbortSignal.timeout(ms || 12000) });
  if (!r.ok) return { status: r.status, html: "" };
  const buf = Buffer.from(await r.arrayBuffer());
  let html = buf.toString("utf8");
  if (/charset=windows-1251/i.test(r.headers.get("content-type") || "") || /charset=["']?windows-1251/i.test(html.slice(0, 4000)) || (html.match(/�/g) || []).length > 20) html = new TextDecoder("windows-1251").decode(buf);
  return { status: r.status, html, url: r.url };
}
const text = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/[ \t\r]+/g, " ").replace(/\n\s*\n+/g, "\n");

function listUrls(a) {
  const deal = a.deal === "rent" ? "naemi" : "prodazhbi";
  const t = String(a.type || "").toLocaleLowerCase("bg"), typ = (TYPES.find(([re]) => re.test(t)) || [null, ""])[1];
  const types = typ ? [typ] : /апартамент/.test(t) ? ["dvustaen", "tristaen"] : [""];
  const reg = slug(a.region), pl = slug(a.place), base = "https://www.imot.bg/obiavi/" + deal + "/";
  const tails = (pre) => types.map((x) => base + pre + (x ? "/" + x : ""));
  const out = [];
  if (pl && BIG.has(pl) && !/^с\.|село/i.test(String(a.place))) out.push(...tails("grad-" + pl));
  if (reg && pl && pl !== reg) { out.push(...tails("oblast-" + reg + "/s-" + pl)); out.push(...tails("oblast-" + reg + "/gr-" + pl)); }
  if (reg) out.push(...tails("oblast-" + reg));
  if (!reg && pl && !BIG.has(pl)) out.push(...tails("oblast-" + pl));
  return [...new Set(out)];
}
function parseAd(url, html) {
  const title = ((/<title>([^<]*)<\/title>/i.exec(html) || [])[1] || "").replace(/\s+/g, " ").trim();
  const desc = ((/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i.exec(html) || [])[1] || "");
  const m = /^(.+?)\s+в\s+(.+?)\s+-\s+([\d\s.,]+)\s*кв\.м\s*\/\s*([\d\s.,]+)\s*(€|EUR|лв\.?)?,?\s*(.*?)\s*::\s*imot\.bg/i.exec(title) || [];
  const t = text(html);
  const ci = t.search(/За контакт/i), contact = ci >= 0 ? t.slice(ci, ci + 400) : "";
  const phones = [...new Set((contact.match(PHONE) || []).map(normPhone).filter((p) => p.length >= 9 && p.length <= 10))];
  const who = (m[6] || "").trim();
  const agency = /Агенция/i.test(desc) || /Брокер:/i.test(contact) || /ЕООД|ООД|ЕАД|АД\b|ЕТ\b|естейт|estate|имоти\s/i.test(who);
  const privateSeller = /частно лице/i.test(desc + " " + who + " " + contact) || (!agency && !!who);
  let price = Number(String(m[4] || "").replace(/[\s,]/g, "").replace(/\.00$/, "")) || null;
  if (price && /лв/i.test(m[5] || "")) price = Math.round(price / 1.95583);
  const loc = (m[2] || "").split(",").map((x) => x.trim());
  const name = ((/(?:Собственик|Частно лице|Лице за контакт)[:\s]*([А-Я][а-я]+(?:\s[А-Я][а-я]+)?)/.exec(contact) || [])[1]) || "";
  return { title: (m[1] || title).trim(), type: (m[1] || "").replace(/^(Продава|Дава под наем)\s+/i, ""), region: loc[0] || "", city: loc[1] || loc[0] || "", area: Number(String(m[3] || "").replace(/\s/g, "")) || null, price, phone: phones.join(", "), seller: privateSeller && !agency ? "private" : "agency", seller_name: who, name, link: url, source: "imot.bg" };
}

async function findOwners(ctx, a) {
  const t0 = Date.now(), budget = Number(a.budget_ms) || 40000, left = () => budget - (Date.now() - t0);
  if (!a.place && !a.region) return { ok: false, error: "Посочете място: село, град или област (напр. place:\"Ново село\", region:\"Велико Търново\")." };
  const lists = listUrls(a), plKey = String(a.place || "").toLocaleLowerCase("bg").replace(/^(с\.|гр\.|село|град)\s*/, "").trim();
  /* 1) страници със списъци (по 2 страници на адрес) */
  const adLinks = [], usedLists = [];
  for (const L of lists) {
    if (left() < 15000 || adLinks.length >= 60) break;
    for (const page of [L, L + "/p-2"]) {
      const r = await get(page, 10000).catch(() => ({ status: 0, html: "" }));
      if (r.status !== 200) break;
      const links = [...new Set((r.html.match(/\/\/www\.imot\.bg\/obiava-[a-z0-9]+-[^"'\s<>]*/gi) || []).map((x) => "https:" + x))];
      if (!links.length) break;
      usedLists.push(page); links.forEach((x) => { if (!adLinks.includes(x)) adLinks.push(x); });
      if (links.length < 15) break;
    }
    /* точното село/град е намерено – не слизаме до цялата област */
    if (adLinks.length && /\/(s|gr|grad)-/.test(L)) break;
  }
  /* 2) отделните обяви (по 6 едновременно), само докато има време */
  const max = Math.min(adLinks.length, Number(a.max) || 40), ads = [];
  for (let i = 0; i < max && left() > 4000; i += 6) {
    const batch = adLinks.slice(i, i + 6);
    const rs = await Promise.all(batch.map((u) => get(u, Math.min(9000, left() - 1000)).then((r) => r.status === 200 ? parseAd(u, r.html) : null).catch(() => null)));
    rs.forEach((x) => x && ads.push(x));
  }
  const maxP = Number(a.max_price) || 0;
  const owners = ads.filter((x) => x.seller === "private" && x.phone && (!maxP || !x.price || x.price <= maxP));
  owners.forEach((x) => { if (plKey && !String(x.city + " " + x.title).toLocaleLowerCase("bg").includes(plKey)) x.place_unsure = true; });
  /* 3) запис в „Събрани“ (без дубликати) */
  let saved = 0;
  if (a.save !== false && owners.length && ctx.token) {
    try {
      const ex = await fetch(SB_URL + "/rest/v1/nd_collected?select=data", { headers: { apikey: SB_KEY, Authorization: "Bearer " + ctx.token } }).then((r) => r.ok ? r.json() : []);
      const have = new Set((ex || []).map((r) => (r.data || {}).link).filter(Boolean));
      const now = new Date().toISOString();
      const rows = owners.filter((x) => !have.has(x.link)).map((x) => ({ name: x.title, data: { kind: "property", deal: a.deal === "rent" ? "rent" : "sale", title: x.title, type: x.type, city: x.city, hood: "", area: x.area, price: x.price, phone: x.phone, name: x.name, text: x.title + " · " + x.city + (x.region ? ", " + x.region : ""), photos: [], link: x.link, source: "imot.bg", collected_at: now, found_by: "Тед" } }));
      if (rows.length) { const r = await fetch(SB_URL + "/rest/v1/nd_collected", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + ctx.token, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(rows) }); if (r.ok) saved = rows.length; }
    } catch (e) {}
  }
  const q = encodeURIComponent([a.type || "имот", a.place, a.region].filter(Boolean).join(" "));
  return {
    ok: true, place: a.place || "", region: a.region || "", checked_ads: ads.length, agencies_skipped: ads.filter((x) => x.seller !== "private").length,
    count: owners.length, saved_to_collected: saved,
    items: owners.slice(0, 30).map((x) => ({ title: x.title, place: x.city, region: x.region, area_m2: x.area, price_eur: x.price, phone: x.phone, name: x.name || undefined, link: x.link, place_unsure: x.place_unsure || undefined })),
    searched: usedLists.slice(0, 4),
    also_check: { "Bazar.bg (телефонът е зад бутон)": "https://bazar.bg/obiavi/imoti?q=" + q, "OLX (частни, телефонът е зад бутон)": "https://www.olx.bg/nedvizhimi-imoti/q-" + q.replace(/%20/g, "-") + "/?search%5Bprivate_business%5D=private" },
    note: owners.length ? "Само частни лица; телефоните са публикувани от собствениците в обявите. Записани в „Събрани“." : (ads.length ? "Намерени " + ads.length + " обяви, но всички са от агенции." : "imot.bg няма обяви за това място и вид имот – вижте линковете за Bazar.bg и OLX.")
  };
}
module.exports = { findOwners, listUrls, parseAd };
