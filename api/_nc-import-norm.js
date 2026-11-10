// ИМОТИ НАДЕЖДА · импорт (TASK-006) · нормализиране: заглавия на колони (BG/EN варианти), числа (десетична запетая,
// хиляди, „м²“, „€“), валута, етажи, кодове на обекти, изложение, етап. Чисти функции, без мрежа.
// ПРАВИЛО: нищо не се досеща. Двусмислено → null + бележка за човешки преглед. Статус НЕ се внася. Обща цена НЕ се смята тук.
"use strict";

const RULES_VERSION = "nc-import-norm/1";
const BGN_PER_EUR = 1.95583;   // фиксираният курс (официален); използва се само с изрично отбелязване като изведена стойност

/* ---------- заглавия ---------- */
function hnorm(s) {
  return String(s == null ? "" : s).toLocaleLowerCase("bg").replace(/ /g, " ")
    .replace(/м²|м2|кв\.?\s*м\.?|m²|m2|sq\.?\s*m|sqm/g, " м2 ").replace(/€|eur(o)?|евро/g, " eur ").replace(/лв\.?|лева|bgn/g, " bgn ")
    .replace(/[.:;,()\[\]{}"'*#№/\\|_+-]+/g, " ").replace(/\s+/g, " ").trim();
}
const FORBIDDEN_H = /^(инвеститор(и)?|строител(и)?|изпълнител(и)?|строителна фирма|investors?|builders?|developers?|contractors?|construction company)$/;
/* → { field, currency?, note? } ; field = code|building|floor|area_total|area_net|terrace_area|rooms|beds|baths|exposure|price_per_m2
   |price_total_src|status_src|type_src|currency|forbidden|ambiguous|ignored|null */
function headerField(raw) {
  const h = hnorm(raw); if (!h) return null;
  const toks = h.split(" "), hasM2 = toks.includes("м2");
  const core = toks.filter((t) => !["м2", "eur", "bgn", "usd", "бр", "%"].includes(t)).join(" ");
  const cur = toks.includes("eur") ? "EUR" : toks.includes("bgn") ? "BGN" : toks.includes("usd") || h.includes("$") ? "USD" : null;
  if (FORBIDDEN_H.test(core)) return { field: "forbidden" };
  if (/^(обект|апартамент|ап|код|номер|номер на обект|номер обект|обект номер|апартамент номер|ап номер|самостоятелен обект|со|ид|идентификатор|unit|unit code|unit id|unit no|apartment|apartment no|code|id)$/.test(core)) return { field: "code" };
  if (/^(сграда|блок|вход|секция|корпус|тяло|building|block|entrance|section)$/.test(core)) return { field: "building" };
  if (/^(етаж|ет|floor|level|ниво)$/.test(core)) return { field: "floor" };
  if (/цена|price/.test(core)) {
    if (hasM2 || /кв|(^|\s)(на|за) м$|per m|\/m/.test(core)) return { field: "price_per_m2", currency: cur };
    if (/ддс|vat/.test(core) && !/без/.test(core)) return { field: "price_total_src", currency: cur, note: "с ДДС" };
    return { field: "price_total_src", currency: cur };
  }
  if (hasM2 && !core && cur) return { field: "price_per_m2", currency: cur };                       // „€/м²“
  if (/тераса|тераси|балкон|terrace|balcony/.test(core)) return { field: "terrace_area" };
  if (/площ|area/.test(core) || /^(обща|чиста|нетна)$/.test(core)) {
    if (/обща|total|общо|gross/.test(core) && !/застроена/.test(core)) return { field: "area_total" };
    if (/чиста|нетна|\bnet\b|вътрешна|полезна/.test(core)) return { field: "area_net" };
    if (/застроена|зп|рзп|built/.test(core)) return { field: "ambiguous", note: "„Застроена площ“ не е нито обща, нито чиста площ – не се внася без потвърждение" };
    if (/идеални|общи части|ич/.test(core)) return { field: "ambiguous", note: "Идеалните части не се внасят като площ на обекта" };
    if (/двор|градин|паркомяст|гараж/.test(core)) return { field: "ignored", note: "Площ на двор/паркомясто не се внася" };
    return { field: "ambiguous", note: "Колона „" + String(raw).trim().slice(0, 40) + "“ е двусмислена (обща или чиста площ?) – не е внесена" };
  }
  if (/^(брой стаи|стаи|стая|rooms|room count)$/.test(core)) return { field: "rooms" };
  if (/^(брой спални|спални|спалня|bedrooms|beds)$/.test(core)) return { field: "beds" };
  if (/^(брой бани|бани|баня|bathrooms|baths)$/.test(core)) return { field: "baths" };
  if (/^(изложение|ориентация|exposure|orientation)$/.test(core)) return { field: "exposure" };
  if (/^(статус|състояние|наличност|status|availability)$/.test(core)) return { field: "status_src" };
  if (/^(тип|вид|тип обект|вид обект|type)$/.test(core)) return { field: "type_src" };
  if (/^(валута|currency)$/.test(core)) return { field: "currency" };
  return null;
}

/* ---------- числа ----------
   kind: area | money | int. Връща { value, issue?, currency?, rule? }. Двусмислен разделител (напр. „2,100“ или „2.100“) → null + issue. */
function parseNumber(raw, kind, cellType) {
  if (raw == null || raw === "") return { value: null };
  if (typeof raw === "boolean") return { value: null, issue: "очаква се число" };
  let currency = null;
  if (typeof raw === "number") {
    if (!isFinite(raw)) return { value: null, issue: "невалидно число" };
    return finish(raw, kind, null, cellType);
  }
  let s = String(raw).trim().toLocaleLowerCase("bg").replace(/ | /g, " ");
  if (/€|eur|евро/.test(s)) currency = "EUR"; else if (/лв|лева|bgn/.test(s)) currency = "BGN"; else if (/\$|usd|£|gbp|chf/.test(s)) currency = "OTHER";
  s = s.replace(/м²|м2|кв\.?\s*м\.?|m²|m2|sq\.?\s*m|sqm|€|eur(o)?|евро|лв\.?|лева|bgn|\$|usd|\/|бр\.?|стаи|ст\.?/g, " ").trim();
  if (/^[-–]?\s*$/.test(s)) return { value: null };
  if (/^(няма|-|—|n\/a|na|н\/д|по запитване|запитване)$/.test(s)) return { value: null, issue: "няма стойност („" + String(raw).trim().slice(0, 20) + "“)" };
  s = s.replace(/[–−]/g, "-").replace(/\s+/g, " ");
  if (!/^-?\s?[\d.,' ]+$/.test(s)) return { value: null, issue: "не е число („" + String(raw).trim().slice(0, 30) + "“)" };
  let neg = s.startsWith("-"); s = s.replace(/^-\s?/, "");
  const hasC = s.includes(","), hasD = s.includes(".");
  let n;
  const sp = s.replace(/[' ]/g, "");
  if (/ /.test(s.trim()) && !/^\d{1,3}( \d{3})+([.,]\d+)?$/.test(s.trim())) return { value: null, issue: "неясно число („" + String(raw).trim().slice(0, 30) + "“)" };
  if (hasC && hasD) {
    const lc = sp.lastIndexOf(","), ld = sp.lastIndexOf(".");
    const dec = lc > ld ? "," : ".", th = dec === "," ? "." : ",";
    const [ip, fp] = sp.split(dec);
    if (!new RegExp("^\\d{1,3}(\\" + th + "\\d{3})*$").test(ip) || fp === undefined || sp.split(dec).length > 2) return { value: null, issue: "неясно число („" + String(raw).trim().slice(0, 30) + "“)" };
    n = Number(ip.split(th).join("") + "." + fp);
  } else if (hasC || hasD) {
    const sep = hasC ? "," : ".", parts = sp.split(sep);
    if (parts.length > 2) { if (parts.slice(1).every((p) => p.length === 3) && parts[0].length <= 3) n = Number(parts.join("")); else return { value: null, issue: "неясно число („" + String(raw).trim().slice(0, 30) + "“)" }; }
    else if (parts[1].length === 3 && /^\d{1,3}$/.test(parts[0])) return { value: null, issue: "двусмислен разделител („" + String(raw).trim().slice(0, 20) + "“ – хиляди или десетична част?)" };
    else n = Number(parts[0] + "." + parts[1]);
  } else n = Number(sp);
  if (!isFinite(n)) return { value: null, issue: "невалидно число" };
  if (neg) n = -n;
  return finish(n, kind, currency, cellType);
}
function finish(n, kind, currency, cellType) {
  const out = { value: n };
  if (currency) out.currency = currency;
  if (kind === "int") { if (!Number.isInteger(n)) return { value: null, issue: "очаква се цяло число" }; if (n < 0 || n > 20) return { value: null, issue: "извън разумните граници (0–20)" }; return out; }
  if (n <= 0) return { value: null, issue: n === 0 ? "нулева стойност" : "отрицателна стойност" };
  const r2 = Math.round(n * 100) / 100;
  if (Math.abs(r2 - n) > 1e-9) {
    if (Math.abs(r2 - n) < 1e-6 && cellType === "n") out.value = r2;     // артефакт на плаваща запетая в XLSX
    else { out.value = r2; out.rule = "закръгляне до 0,01 (" + RULES_VERSION + ")"; }
  } else out.value = r2;
  if (kind === "area" && out.value >= 100000) return { value: null, issue: "нереална площ" };
  if (kind === "area" && out.value < 1) return { value: null, issue: "нереална площ (под 1 м²)" };
  if (kind === "money" && out.value >= 10000000) return { value: null, issue: "нереална цена на кв.м" };
  return out;
}
/* валута към EUR: EUR без промяна; BGN → EUR по фиксирания курс (изведена стойност с правило); друга → null */
function toEur(v, currency) {
  if (v == null) return { value: null };
  if (!currency || currency === "EUR") return { value: v };
  if (currency === "BGN") return { value: Math.round((v / BGN_PER_EUR) * 100) / 100, rule: "BGN→EUR по фиксирания курс " + BGN_PER_EUR + " (" + RULES_VERSION + ")", derived: true };
  return { value: null, issue: "неподдържана валута (" + currency + ") – цената не е внесена" };
}

/* ---------- етажи ---------- */
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20 };
function parseFloor(raw) {
  if (raw == null || raw === "") return { value: null };
  if (typeof raw === "number") return Number.isInteger(raw) && raw >= -5 && raw <= 200 ? { value: raw, label: null } : { value: null, issue: "невалиден етаж (" + raw + ")" };
  const src = String(raw).trim(), s = src.toLocaleLowerCase("bg").replace(/\s+/g, " ");
  if (/^(партер|п|приземен|приземен етаж|ground|ground floor|gf|0)$/.test(s)) return { value: 0, label: /^\d/.test(s) ? null : src };
  if (/^(сутерен|полуподземен|подземен|basement|-1|сут)$/.test(s)) return { value: -1, label: /^-?\d/.test(s) ? null : src };
  if (/мансард|тавански|покрив|мезонет|мезанин|антресол|гараж|паркинг|\d\s*[-–\/]\s*\d|и\s+\d/.test(s)) return { value: null, issue: "двусмислен етаж („" + src.slice(0, 30) + "“) – посочете номер" };
  let m = /^(?:ет(?:аж)?\.?\s*)?([+-]?\d{1,3})(?:\s*[-‑]?\s*(?:ви|ри|ти|ми|st|nd|rd|th))?(?:\s*ет(?:аж)?\.?)?$/.exec(s);
  if (m) { const n = parseInt(m[1], 10); return n >= -5 && n <= 200 ? { value: n, label: null } : { value: null, issue: "етаж извън границите" }; }
  m = /^(?:ет(?:аж)?\.?\s*)?([ivx]{1,5})(?:\s*ет(?:аж)?\.?)?$/.exec(s);
  if (m && ROMAN[m[1]]) return { value: ROMAN[m[1]], label: null, rule: "римска цифра → число (" + RULES_VERSION + ")" };
  m = /^(?:floor|level|ниво)\s*([+-]?\d{1,3})$/.exec(s);
  if (m) return { value: parseInt(m[1], 10), label: null };
  return { value: null, issue: "неразпознат етаж („" + src.slice(0, 30) + "“)" };
}

/* ---------- кодове ----------
   code = почистеният код за запис (същите знаци като в източника), key = ключ за сравнение (латиница/кирилица-двойници,
   без интервали/тирета/точки, главни букви) – „А-1“ и „A 1“ са един и същ ключ → откриват се като дубликат, не се сливат тихо. */
const LOOK = { "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X", "У": "Y" };
const CODE_RE = /^[A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9._ -]{0,19}$/u;
const RESERVED = /^(public|private|derived|plans|units|cad|imports|tours)$/i;
function codeKey(s) { return String(s || "").toLocaleUpperCase("bg").replace(/[\s._\-–—‑]+/g, "").replace(/[АВЕКМНОРСТХУ]/g, (c) => LOOK[c] || c); }
function parseCode(raw) {
  if (raw == null || raw === "") return { code: null };
  let s = typeof raw === "number" ? (Number.isInteger(raw) ? String(raw) : null) : String(raw);
  if (s == null) return { code: null, issue: "кодът е дробно число" };
  s = s.replace(/ /g, " ").replace(/[–—‑]/g, "-").replace(/\s+/g, " ").trim().replace(/^(№|no\.)\s*/i, "").trim();   // само знакът „№“ отпред; самият код не се променя
  if (!s) return { code: null };
  if (s.length > 20) return { code: null, issue: "кодът е по-дълъг от 20 знака" };
  if (!CODE_RE.test(s)) return { code: null, issue: "кодът съдържа непозволени знаци („" + s.slice(0, 20) + "“)" };
  if (RESERVED.test(s)) return { code: null, issue: "запазена дума не може да е код" };
  return { code: s, key: codeKey(s) };
}

/* ---------- изложение / етап / тип ---------- */
const EXPO = [[/^(ю|юг|s|south|южно)$/, "Юг"], [/^(с|север|n|north|северно)$/, "Север"], [/^(и|изток|e|east|източно)$/, "Изток"], [/^(з|запад|w|west|западно)$/, "Запад"],
  [/^(ю ?[-\/]? ?и|юи|югоизток|юг ?[-\/]? ?изток|se|south ?east)$/, "Юг-Изток"], [/^(ю ?[-\/]? ?з|юз|югозапад|юг ?[-\/]? ?запад|sw|south ?west)$/, "Юг-Запад"],
  [/^(с ?[-\/]? ?и|си|североизток|север ?[-\/]? ?изток|ne|north ?east)$/, "Север-Изток"], [/^(с ?[-\/]? ?з|сз|северозапад|север ?[-\/]? ?запад|nw|north ?west)$/, "Север-Запад"],
  [/^(и ?[-\/]? ?з|из|изток ?[-\/]? ?запад|e ?[-\/]? ?w)$/, "Изток-Запад"], [/^(с ?[-\/]? ?ю|сю|север ?[-\/]? ?юг|n ?[-\/]? ?s)$/, "Север-Юг"]];
function parseExposure(raw) {
  if (raw == null || raw === "") return { value: null };
  const src = String(raw).trim(), s = src.toLocaleLowerCase("bg").replace(/\s+/g, " ").replace(/\.$/, "");
  for (const [re, v] of EXPO) if (re.test(s)) return { value: v };
  return { value: src.slice(0, 40), note: "непознато изложение – внася се както е" };
}
function parseStage(raw) {
  const s = String(raw || "").toLocaleLowerCase("bg").replace(/\s+/g, " ").trim();
  if (!s) return { value: null };
  if (/акт\s*16|а16|въведен в експлоатация/.test(s)) return { value: "act16" };
  if (/акт\s*15|а15/.test(s)) return { value: "act15" };
  if (/акт\s*14|а14/.test(s)) return { value: "act14" };
  if (/груб/.test(s)) return { value: "rough" };
  if (/изкоп/.test(s)) return { value: "excavation" };
  if (/^(старт|начало|в проект|проект)$/.test(s)) return { value: "start" };
  if (["start", "excavation", "rough", "act14", "act15", "act16"].includes(s)) return { value: s };
  return { value: null, issue: "непознат етап („" + String(raw).slice(0, 30) + "“)" };
}
/* „двустаен“ → 2 стаи (стандартната българска номенклатура); само ако няма колона „Стаи“ – изведена стойност */
function roomsFromType(raw) {
  const s = String(raw || "").toLocaleLowerCase("bg");
  const m = /^(едно|дву|три|четири|пет)стаен/.exec(s.trim());
  return m ? { value: { едно: 1, дву: 2, три: 3, четири: 4, пет: 5 }[m[1]], rule: "тип „…стаен“ → брой стаи (" + RULES_VERSION + ")" } : { value: null };
}
const STATUS_SRC = (raw) => { const s = String(raw || "").toLocaleLowerCase("bg").trim(); return !s ? null : /прода|sold/.test(s) ? "sold" : /капар|резерв|reserved|deposit/.test(s) ? "reserved" : /своб|free|available|налич/.test(s) ? "free" : "unknown"; };

/* ---------- таблица → редове с обекти ----------
   table = { name, rows:[[{ref, v, t}]] }. Връща { kind:'units'|'project'|'none', header, rows, issues } */
const PROJECT_LABELS = [[/^(име на проекта|име|проект|наименование|заглавие|project|title|name)$/, "title"], [/^(град|населено място|city)$/, "city"], [/^(квартал|район|кв|hood|district)$/, "hood"],
  [/^(адрес|address)$/, "address"], [/^(описание|description)$/, "description"], [/^(етап|етап на строителство|stage)$/, "stage"],
  [/^(очаквано завършване|завършване|срок|акт 16 срок|completion|expected completion)$/, "expected_completion"], [/^(предимства|advantages)$/, "advantages"]];
function tableToUnits(table) {
  const issues = [], rows = table.rows || [];
  let best = null;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r] || [], map = {}, extra = { unknown: [], forbidden: [], ambiguous: [], ignored: [] };
    let score = 0;
    row.forEach((cell, c) => {
      if (!cell || typeof cell.v !== "string") return;
      const h = headerField(cell.v);
      if (!h) { if (cell.v.trim()) extra.unknown.push({ ref: cell.ref, header: cell.v.trim().slice(0, 40) }); return; }
      if (h.field === "forbidden") { extra.forbidden.push({ ref: cell.ref, header: cell.v.trim().slice(0, 40) }); return; }
      if (h.field === "ambiguous" || h.field === "ignored") { extra[h.field].push({ ref: cell.ref, header: cell.v.trim().slice(0, 40), note: h.note }); return; }
      if (Object.values(map).some((x) => x.field === h.field)) { extra.ambiguous.push({ ref: cell.ref, header: cell.v.trim().slice(0, 40), note: "втора колона за същото поле – не се внася" }); return; }
      map[c] = Object.assign({ header: cell.v.trim().slice(0, 60), ref: cell.ref }, h);
      score++;
    });
    const fields = Object.values(map).map((x) => x.field);
    if (fields.includes("code") && fields.some((f) => ["floor", "area_total", "area_net", "price_per_m2"].includes(f)) && (!best || score > best.score)) best = { r, map, score, extra };
  }
  if (!best) {
    // таблица „поле → стойност“ с данни за проекта (колона A = етикет, B = стойност)
    const proj = {};
    rows.slice(0, 60).forEach((row) => {
      const a = row && row[0], b = row && row[1];
      if (!a || typeof a.v !== "string" || !b || b.v == null || b.v === "") return;
      const k = hnorm(a.v); const hit = PROJECT_LABELS.find(([re]) => re.test(k));
      if (hit && !proj[hit[1]]) proj[hit[1]] = { value: String(b.v).trim(), ref: b.ref };
    });
    if (Object.keys(proj).length >= 2) return { kind: "project", project: proj, issues };
    return { kind: "none", issues };
  }
  const out = [];
  let blank = 0;
  const cols = Object.keys(best.map).map(Number);
  const curCol = cols.find((c) => best.map[c].field === "currency");
  for (let r = best.r + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const has = cols.some((c) => row[c] && row[c].v != null && row[c].v !== "");
    if (!has) { if (++blank >= 5) break; continue; }
    blank = 0;
    const rec = { row: r + 1, cells: {} };
    for (const c of cols) {
      const h = best.map[c], cell = row[c];
      if (!cell || cell.v == null || cell.v === "" || h.field === "currency") continue;
      rec.cells[h.field] = { raw: typeof cell.v === "string" ? cell.v.slice(0, 80) : cell.v, t: cell.t, ref: cell.ref, header_currency: h.currency || null, note: h.note || null };
    }
    if (curCol != null && row[curCol] && row[curCol].v) rec.currency = { raw: String(row[curCol].v).slice(0, 10), ref: row[curCol].ref };
    if (Object.keys(rec.cells).length) out.push(rec);
  }
  return { kind: "units", header: { row: best.r + 1, map: best.map, extra: best.extra, fields: best.score }, rows: out, issues };
}

module.exports = { headerField, hnorm, parseNumber, toEur, parseFloor, parseCode, codeKey, parseExposure, parseStage, roomsFromType, STATUS_SRC, tableToUnits, RULES_VERSION, BGN_PER_EUR };
