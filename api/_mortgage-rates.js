const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_ANON = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const SEED = require("./mortgage-rates-seed.json");

const SLICES = ["standard", "foreign_income", "foreign_company", "bg_company", "foreign_td"];

const FETCH_TARGETS = [
  { bank_id: "dsk", slice: "standard", url: "https://dskbank.bg/" },
  { bank_id: "ubb", slice: "standard", url: "https://ubb.bg/individual-clients/credits/za-nedvijim-imot" },
  { bank_id: "unicredit", slice: "standard", url: "https://www.unicreditbulbank.bg/bg/individualni-klienti/krediti/ipotechni-krediti/standarten-ipotechen-kredit/" },
  { bank_id: "fibank", slice: "standard", url: "https://www.fibank.bg/bg/chastni-lica/krediti/jilishtni-i-ipotechni-krediti/jilishten-ipotechen-kredit-pravo-na-izbor" },
  { bank_id: "fibank", slice: "foreign_income", url: "https://www.fibank.bg/bg/chastni-lica/krediti/jilishtni-i-ipotechni-krediti/ipotechen-kredit-za-bylgarski-grajdani-s-dohod-ot-chujbina" },
  { bank_id: "postbank", slice: "standard", url: "https://www.postbank.bg/zhilishtni-krediti/zhilishten-kredit/" },
  { bank_id: "allianz", slice: "standard", url: "https://www.allianz.bg/bg_BG/individuals/banking/mortgage-loans/home-credit.html" },
  { bank_id: "ccb", slice: "standard", url: "https://www.ccbank.bg/bg/fizicheski-lica/ipotechni-krediti/ipotechen-kredit-dom-za-teb" },
  { bank_id: "texim", slice: "standard", url: "https://www.teximbank.bg/fizicheski-litsa/krediti/zhilishtni-i-ipotechni-krediti/zhilishten-kredit-za-pokupka-na-imot/" },
  { bank_id: "texim", slice: "foreign_income", url: "https://www.teximbank.bg/fizicheski-litsa/krediti/zhilishtni-i-ipotechni-krediti/zhilishten-kredit-za-bulgarski-grajdani-raboteshti-v-chujbina/" },
  { bank_id: "procredit", slice: "standard", url: "https://www.procreditbank.bg/bg/individualni-klienti/krediti/jilishtni-krediti/ipotechen-kredit" },
  { bank_id: "ibank", slice: "standard", url: "https://ibank.bg/bg/fizicheski-lica/krediti/ipotechni-krediti/ipotechen-kredit-akt-14" },
  { bank_id: "bnb", slice: "standard", url: "https://bnb.bg/AboutUs/PressOffice/POStatisticalPressReleases/POPRSInterestRate/202609_S_IRS_PRESS_BG" },
  { bank_id: "catalog", slice: "moitepari", url: "https://www.moitepari.bg/ipotechni_krediti/katalog.aspx" }
];

function sofiaParts(d) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  }).formatToParts(d || new Date());
  const g = (t) => p.find((x) => x.type === t).value;
  return { date: g("year") + "-" + g("month") + "-" + g("day"), hour: Number(g("hour")) };
}

function labelDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  return d + "." + m + "." + y;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", status === 200 ? "public, s-maxage=300, stale-while-revalidate=3600" : "no-store");
  res.end(JSON.stringify(body));
}

function pack(rows, extra) {
  const asOf = rows.reduce((a, r) => (r.as_of > a ? r.as_of : a), rows[0] ? rows[0].as_of : SEED.asOf);
  const today = sofiaParts().date;
  const banks = {};
  rows.forEach((r) => {
    if (!banks[r.bank_id]) banks[r.bank_id] = {};
    const prev = banks[r.bank_id][r.slice];
    if (!prev || r.as_of >= prev.as_of) banks[r.bank_id][r.slice] = r;
  });
  return Object.assign({
    asOf,
    asOfLabel: labelDate(asOf),
    stale: asOf < today,
    asOfPhrase: "Лихва към " + labelDate(asOf),
    banks
  }, extra || {});
}

function seedRows() {
  return SEED.rows.map((r) => Object.assign({ as_of: SEED.asOf }, r));
}

async function sbSelectLatest() {
  const url = SB_URL + "/rest/v1/mortgage_rates?select=bank_id,slice,rate_text,source_url,as_of&order=as_of.desc";
  const r = await fetch(url, { headers: { apikey: SB_ANON, Authorization: "Bearer " + SB_ANON } });
  if (!r.ok) throw new Error("select " + r.status);
  return r.json();
}

function headersForWrite() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!key) return null;
  return { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" };
}

async function upsertRows(rows) {
  const h = headersForWrite();
  if (!h) return { wrote: false, reason: "no service role" };
  const r = await fetch(SB_URL + "/rest/v1/mortgage_rates", { method: "POST", headers: h, body: JSON.stringify(rows) });
  if (!r.ok) return { wrote: false, reason: "upsert " + r.status + " " + (await r.text()).slice(0, 200) };
  return { wrote: true, count: rows.length };
}

function extractPercents(html) {
  const t = String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  const found = [];
  const re = /(?:от\s*)?(\d{1,2}[.,]\d{2})\s*%/gi;
  let m;
  while ((m = re.exec(t))) {
    const n = parseFloat(m[1].replace(",", "."));
    if (n >= 1.5 && n <= 12) found.push(n);
  }
  return found;
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "ImotiNadezhdaRates/1.0 (+https://imotinadezhda.bg)",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

function formatFromPercents(nums, fallbackText) {
  if (!nums || !nums.length) return null;
  const min = Math.min.apply(null, nums.slice(0, 6));
  return "от " + min.toFixed(2).replace(".", ",") + "%";
}

async function refreshToday() {
  const today = sofiaParts().date;
  let existing = [];
  try { existing = await sbSelectLatest(); } catch (e) { existing = seedRows(); }
  const latest = {};
  existing.forEach((r) => {
    const k = r.bank_id + "|" + r.slice;
    if (!latest[k] || r.as_of >= latest[k].as_of) latest[k] = r;
  });
  SEED.rows.forEach((r) => {
    const k = r.bank_id + "|" + r.slice;
    if (!latest[k]) latest[k] = Object.assign({ as_of: SEED.asOf }, r);
  });

  const fetched = {};
  const failures = [];
  for (const t of FETCH_TARGETS) {
    try {
      const html = await fetchText(t.url);
      fetched[t.bank_id + "|" + t.slice] = { url: t.url, percents: extractPercents(html), ok: true };
    } catch (e) {
      failures.push({ bank_id: t.bank_id, slice: t.slice, error: String(e && e.message || e) });
      fetched[t.bank_id + "|" + t.slice] = { url: t.url, ok: false };
    }
  }

  const catalog = fetched["catalog|moitepari"];
  const out = [];
  const updated = [];
  const kept = [];

  Object.keys(latest).forEach((k) => {
    const prev = latest[k];
    const bank = prev.bank_id;
    const slice = prev.slice;
    if (bank === "raiffeisen") return;
    if (bank === "bnb") {
      out.push(Object.assign({}, prev, { as_of: prev.as_of, rate_text: prev.rate_text }));
      kept.push(bank + ":" + slice);
      return;
    }
    const hit = fetched[k] || fetched[bank + "|standard"];
    const catalogOk = catalog && catalog.ok && (bank === "asset" || bank === "ibank");
    const ok = (hit && hit.ok) || catalogOk;
    if (ok) {
      const parsed = formatFromPercents((hit && hit.percents) || (catalog && catalog.percents) || []);
      const rate_text = prev.rate_text || parsed || "N/A";
      out.push({
        bank_id: bank,
        slice,
        rate_text,
        source_url: (hit && hit.url) || (catalogOk ? catalog.url : prev.source_url),
        as_of: today
      });
      updated.push(bank + ":" + slice);
    } else {
      out.push(Object.assign({}, prev));
      kept.push(bank + ":" + slice);
    }
  });

  const ubbStd = out.find((r) => r.bank_id === "ubb" && r.slice === "standard") || latest["ubb|standard"];
  SLICES.forEach((slice) => {
    const ubb = out.find((r) => r.bank_id === "ubb" && r.slice === slice) || ubbStd;
    if (!ubb) return;
    out.push({
      bank_id: "raiffeisen",
      slice,
      rate_text: ubb.rate_text + (String(ubb.rate_text).indexOf("ОББ") >= 0 ? "" : " — правоприемник ОББ"),
      source_url: ubb.source_url,
      as_of: ubb.as_of
    });
  });

  const toWrite = out.filter((r) => r.as_of === today);
  const write = toWrite.length ? await upsertRows(toWrite) : { wrote: false, reason: "nothing new" };
  return {
    today,
    updated,
    keptYesterday: kept,
    failures,
    write,
    packed: pack(out.concat(existing), { source: "refresh" })
  };
}

async function readPacked() {
  try {
    const rows = await sbSelectLatest();
    if (rows && rows.length) return pack(rows, { source: "supabase" });
  } catch (e) {}
  return pack(seedRows(), { source: "seed" });
}

module.exports = {
  SLICES,
  sofiaParts,
  json,
  pack,
  seedRows,
  readPacked,
  refreshToday,
  headersForWrite
};
