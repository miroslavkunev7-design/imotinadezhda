// Data-based provenance of web addresses and searches (docs/CONTRACT.md §9.3 rule 8, 0.1.5 owner: „Защо 15 пъти ми
// иска едно потвърждение…“). Instead of a blanket „the context is tainted“, the agent collects the SENSITIVE values
// GPT has seen – from CRM results, documents read, the selected Проект, the open Canvas, attached files and earlier
// answers – and a model-built address or search query needs the employee's card only when it carries one of them that
// the employee did not type himself and that did not come from a public web result. Pure and portable (no Node API):
// MAIN uses it and the mock build may import it.

const CYR = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu",
  я: "ya", ё: "e", ы: "y", э: "e", є: "e", і: "i", ї: "i", ґ: "g", ў: "u",
};

// One comparable form for Cyrillic, Latin transliterations and accents: lower case, no diacritics, Bulgarian
// transliteration, then a lossy skeleton (ts→c, j/y→i, w→v, doubled letters once) so „Цветан“, „Tsvetan“ and „Cvetan“
// meet. Applied to both sides of every comparison.
export function fold(s) {
  let t = String(s == null ? "" : s).toLowerCase().replace(/й/g, "\u0001").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\u0001/g, "й");
  let out = "";
  for (const ch of t) out += CYR[ch] !== undefined ? CYR[ch] : ch;
  return out.replace(/ts/g, "c").replace(/kh/g, "h").replace(/ph/g, "f").replace(/w/g, "v").replace(/q/g, "k").replace(/x/g, "ks")
    .replace(/[jy]/g, "i").replace(/([a-z])\1+/g, "$1");
}
// Word stem: one ending off (Петров / Петрова / Petrova meet), never shorter than 4 letters.
export function stem(folded) {
  for (const end of ["ite", "ata", "ia", "ta", "to", "a", "e", "i", "o", "u"]) {
    if (folded.endsWith(end) && folded.length - end.length >= 4) return folded.slice(0, -end.length);
  }
  return folded;
}
const WORD_RE = /[\p{L}\p{M}]+/gu;
const letters = (w) => (w.match(/\p{L}/gu) || []).length;
const keyOf = (w) => stem(fold(w).replace(/[^a-z]/g, ""));

// Common words, real-estate and address vocabulary, the agency's own name and Bulgarian towns: never „personal“ by
// themselves (a listing sweep for „тристаен Шумен“ must not ask). Compared as stems.
const COMMON_TEXT = `като които която което който това тези този тази онзи онази след преди само още много може могат трябва
няма имат беше бяха била било били щеше защото когато където докато обаче също вече тогава сега днес утре вчера винаги никога
всички всеки всяка всяко нещо някой някои друг друга друго други свой своя свое свои около между срещу през върху заради освен
както така дали нито една един едно четири шест седем осем девет десет първи първа втори втора трети трета нови нова ново стар
стара старо голям голяма голямо малък малка малко добър добра добро цялата целия чрез относно следва моля благодаря здравейте
искам иска искат търси търся търсим намери намерих покажи провери напиши направи изпрати отвори потърси прочети кажи нужно нужен
нужна информация данни справка оферта оферти договор договори документ документи файл файла файлове снимка снимки страница
страници сайт сайта сайтове интернет търсене резултат резултати линк линкове заглавие описание бележка бележки цена цени цената
площ квадрата квадратни метра метър евро лева левове имот имоти имота имотът апартамент апартаменти апартамента къща къщи къщата
парцел парцели земя земеделска земеделски офис офиси магазин магазини гараж гаражи склад складове сграда сгради вила вили студио
мезонет ателие етаж етажа етажи стая стаи спалня спални баня бани тераса тераси кухня двустаен двустайни двустайна тристаен
тристайни тристайна едностаен едностайни едностайна четиристаен четиристайни многостаен многостайни продажба продажби продава
продавам продаден продадена наем наеми наема наемател наематели купувач купувачи купува купуват тухла тухлен тухлена панел
панелен панелна обзаведен обзаведена обзаведено необзаведен строителство изложение южно северно източно западно център центъра
централен централна квартал квартала район района улица улицата булевард площад блок блока вход входа град града село селото
община общината област областта регион адрес адреса обява обяви обявата собственик собственици собственика агенция агенции брокер
брокери посредник посредници клиент клиенти клиента клиентът клиентка сделка сделки оглед огледи огледа среща срещи календар
телефон телефона телефони имейл имейла статус активен активна неактивен отдаден чернова проект проекти проекта казус казуси
надежда недвижими недвижим имоти недвижимости памет събитие събития задача задачи януари февруари март април юни юли август
септември октомври ноември декември понеделник вторник сряда четвъртък петък събота неделя година години месец месеца седмица
българия софия пловдив варна бургас русе стара загора плевен сливен добрич шумен перник хасково ямбол пазарджик благоевград велико
търново враца габрово асеновград видин казанлък кърджали кюстендил монтана търговище ловеч силистра разград смолян петрич сандански
самоков велинград несебър поморие созопол каварна балчик пазар преслав каспичан банско боровец пампорово свищов горна оряховица
карлово дупница ботевград троян севлиево загора димитровград попово омуртаг провадия девня айтос карнобат ихтиман пелин костинброд
своге радомир козлодуй оряхово берковица мездра тутракан исперих кубрат дулово тошево тервел котел твърдица елхово тополовград
харманли свиленград момчилград приморско царево обзор елените тракия
http https html www search query page sort price from with bulgaria imot olx bazar alo obiavi prodazhbi naemi grad oblast`;
const COMMON = new Set(COMMON_TEXT.split(/\s+/).filter((w) => letters(w) >= 4).map(keyOf));

// CRM result keys whose values are personal (names, contacts, addresses, notes): every word of 4+ letters counts.
const PERSONAL_KEY = /name|phone|mobile|gsm|^tel|_tel|mail|addr|street|note|comment|remark|contact|client|owner|person|egn|iban|eik|bulstat|vat_?(?:no|number)|passport|idcard|id_number|birth|bank|account|^to$|^to_/i;
// Keys of free text that may name people (summaries, facts, file paths, memory): capitalised words count.
const PROPER_KEY = /^(text|content|body|message|summary|facts?|path|paths|file|files|folder|saved_?to|subject)$/i;

// ---- structural detectors -------------------------------------------------------------------------------------
// Digit runs with up to two separators between digits („0888 123 456“, „0888-123-456“, „(02) 123 45 67“).
const DIGIT_RUN = /\d(?:[ \t\-.()_]{0,2}\d)+/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/g;
// The significant digits of a number: a Bulgarian phone without +359 / 00359 / 0, anything else unchanged.
export function sig(d) {
  if (/^(?:00359|359)\d{8,9}$/.test(d)) return d.replace(/^(?:00359|359)/, "");
  if (/^0\d{8,9}$/.test(d)) return d.slice(1);
  return d;
}
export const isPhone = (d) => /^(?:00359|359)[2-9]\d{7,8}$/.test(d) || /^0[2-9]\d{7,8}$/.test(d);
export function isEgn(d) {
  if (!/^\d{10}$/.test(d)) return false;
  let m = Number(d.slice(2, 4));
  const day = Number(d.slice(4, 6));
  if (m > 40) m -= 40; else if (m > 20) m -= 20;
  if (m < 1 || m > 12 || day < 1 || day > 31) return false;
  const w = [2, 4, 8, 5, 10, 9, 7, 3, 6];
  let s = 0;
  for (let i = 0; i < 9; i++) s += Number(d[i]) * w[i];
  return (s % 11) % 10 === Number(d[9]);
}
export function isIban(raw) {
  const s = String(raw).replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let r = 0;
  for (const ch of moved) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const c of v) r = (r * 10 + Number(c)) % 97;
  }
  return r === 1;
}
// Dates („2026-11-17“, „17.11.2026“) are never personal numbers.
const DATE_RE = /^(?:\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})$/;
function runsOf(text) {
  const out = [];
  for (const m of String(text).matchAll(DIGIT_RUN)) {
    const shown = m[0].trim();
    const d = shown.replace(/\D/g, "");
    if (d.length >= 7 && !DATE_RE.test(shown)) out.push({ d, shown });
  }
  return out;
}
// A link in a text: up to a space, quote, angle/square/round bracket or table bar (Markdown „[текст](адрес)“, tables).
const LINK_RE = /https?:\/\/[^\s"'<>\\^`{|}()[\]]+/gi;
const emailsOf = (text) => (String(text).match(EMAIL_RE) || []).map((e) => e.toLowerCase());
const ibansOf = (text) => (String(text).toUpperCase().match(IBAN_RE) || []).map((x) => x.replace(/\s+/g, "")).filter(isIban);

// ---- decoding of addresses and queries ------------------------------------------------------------------------
function safeDecode(s) {
  try { return decodeURIComponent(s); } catch {
    return s.replace(/(?:%[0-9a-f]{2})+/gi, (m) => { try { return decodeURIComponent(m); } catch { return m; } });
  }
}
const PRINTABLE = /^[\p{L}\p{N}\p{P}\p{Zs}\p{S}]+$/u;
function utf8(bytes) {
  try {
    const t = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return t && PRINTABLE.test(t) && /[\p{L}\p{N}]/u.test(t) ? t : null;
  } catch { return null; }
}
function b64(seg) {
  const s = seg.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  if (s.length < 8 || s.length % 4 === 1) return null;
  try {
    const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
    return utf8(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch { return null; }
}
function hex(seg) {
  if (seg.length % 2) return null;
  const bytes = new Uint8Array(seg.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(seg.slice(i * 2, i * 2 + 2), 16);
  return utf8(bytes);
}
// Every readable form of a text: as written, URL-decoded (up to 3 times, „+“ = space) and every base64- or
// hex-looking segment decoded (UTF-8, printable only).
export function variants(text) {
  const out = new Set([String(text || "")]);
  let cur = String(text || "");
  for (let i = 0; i < 3; i++) {
    const n = safeDecode(cur.replace(/\+/g, " "));
    if (n === cur) break;
    out.add(n); cur = n;
  }
  for (const v of [...out]) {
    for (const m of v.matchAll(/[A-Za-z0-9+/_-]{8,}={0,2}/g)) {
      const d = b64(m[0]);
      if (d) { out.add(d); const dd = safeDecode(d.replace(/\+/g, " ")); if (dd !== d) out.add(dd); }
    }
    for (const m of v.matchAll(/(?:[0-9a-fA-F]{2}){4,}/g)) { const d = hex(m[0]); if (d) out.add(d); }
    if (out.size > 200) break;
  }
  return [...out];
}
// The parts of an address that reach the other site: host labels (without www), path and query.
export function urlHaystack(raw) {
  try {
    const u = new URL(String(raw));
    return `${u.hostname.replace(/^www\./, "")} ${u.pathname} ${u.search}`;
  } catch { return String(raw || ""); }
}
export function hostOf(raw) {
  try { return new URL(String(raw)).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

// ---- what the employee typed / what is public -----------------------------------------------------------------
function emptyView() { return { words: new Set(), digits: new Set(), emails: new Set(), ibans: new Set() }; }
function addView(view, text, cap) {
  const s = String(text || "");
  for (const w of s.match(WORD_RE) || []) { if (view.words.size >= cap) break; if (letters(w) >= 3) view.words.add(keyOf(w)); }
  for (const m of s.matchAll(/\d(?:[ \t\-.()_]{0,2}\d)+/g)) { const d = m[0].replace(/\D/g, ""); if (d.length >= 4 && view.digits.size < cap) view.digits.add(sig(d)); }
  for (const e of emailsOf(s)) view.emails.add(e);
  for (const i of ibansOf(s)) view.ibans.add(i);
  return view;
}
// The employee's own words in this conversation (his messages, custom instructions, nick).
export function typedView(texts) {
  const v = emptyView();
  for (const t of Array.isArray(texts) ? texts : [texts]) addView(v, t, 50_000);
  return v;
}
const inDigits = (set, s) => { for (const t of set) if (t.includes(s)) return true; return false; };

// ---- the sensitive store (one per chat in MAIN) ---------------------------------------------------------------
export const CAPS = { words: 20_000, digits: 5_000, publicWords: 60_000, publicDigits: 20_000 };

export function createSensitive() {
  const priv = { words: new Map(), digits: new Map(), emails: new Map(), ibans: new Map() };
  const pub = emptyView();

  function addWord(w) {
    if (letters(w) < 4 || priv.words.size >= CAPS.words) return;
    const k = keyOf(w);
    if (k.length < 4 || COMMON.has(k) || priv.words.has(k)) return;
    priv.words.set(k, w.slice(0, 60));
  }
  function structural(s) {
    for (const r of runsOf(s)) { const k = sig(r.d); if (k.length >= 7 && !priv.digits.has(k) && priv.digits.size < CAPS.digits) priv.digits.set(k, r.shown.slice(0, 40)); }
    for (const e of emailsOf(s)) if (!priv.emails.has(e)) priv.emails.set(e, e);
    for (const i of ibansOf(s)) if (!priv.ibans.has(i)) priv.ibans.set(i, i);
  }
  // how: "free" = every word of 4+ letters (names, addresses, notes of CRM records); "proper" = capitalised words
  // (documents, summaries, Canvas); "names" = „Име Фамилия“ pairs (earlier answers); "none" = numbers, e-mails and
  // IBANs only. Numbers, e-mails and IBANs are collected in every mode – with links:false (earlier answers and the
  // Canvas) not inside links: the listing ids in the links of a listings answer (imot.bg „1b172345678901234“, alo.bg
  // „/10123456“) are no personal data (release gate C5); phones, ЕГН, e-mails and IBANs are found in any address anyway.
  function addPrivate(text, how = "none", { links = true } = {}) {
    let s = String(text == null ? "" : text).slice(0, 400_000);
    if (!s) return;
    if (!links) s = s.replace(LINK_RE, " ");
    structural(s);
    // Words of e-mail addresses and links (gmail, example, www …) are not names.
    if (how !== "none") s = s.replace(EMAIL_RE, " ").replace(/https?:\/\/\S+/gi, " ");
    if (how === "free") for (const w of s.match(WORD_RE) || []) addWord(w);
    else if (how === "proper") for (const w of s.match(/(?<![\p{L}\p{M}])(?:\p{Lu}[\p{Ll}\p{M}]{3,}|\p{Lu}{4,})(?![\p{L}\p{M}])/gu) || []) addWord(w);
    else if (how === "names") {
      for (const m of s.matchAll(/(?<![\p{L}\p{M}])(\p{Lu}\p{Ll}{2,})[  ]+(\p{Lu}\p{Ll}+(?:ов|ова|ев|ева|ски|ска|цки|цка|ин|ина|ян|ова))(?![\p{L}\p{M}])/gu)) {
        addWord(m[1]); addWord(m[2]);
      }
    }
  }
  // A CRM / project result: personal keys word by word, free-text keys by capitalised words, the rest by numbers,
  // e-mails and IBANs only.
  function addValue(value, key = "", depth = 0) {
    if (value == null || depth > 8) return;
    if (typeof value === "string") {
      const how = PERSONAL_KEY.test(key) && !/url$|^id$|_id$|^ids?$/i.test(key) ? "free" : PROPER_KEY.test(key) ? "proper" : "none";
      addPrivate(value, how);
      return;
    }
    if (typeof value === "number") { if (Number.isInteger(value)) addPrivate(String(value)); return; }
    if (Array.isArray(value)) { for (const x of value.slice(0, 500)) addValue(x, key, depth + 1); return; }
    if (typeof value === "object") for (const [k, v] of Object.entries(value)) addValue(v, k, depth + 1);
  }
  // Text of a public web result (search results, pages read): its words and numbers are public from now on – except
  // what the request itself sent (`sent` = the address or query): a site that echoes „Резултати за: <име>“ must not
  // turn a value GPT sent there into a public one for every other site.
  function addPublic(text, sent = "") {
    const s = String(text || "");
    const not = typedView(variants(String(sent || "")).join(" "));
    for (const w of s.match(WORD_RE) || []) {
      if (pub.words.size >= CAPS.publicWords) break;
      if (letters(w) < 3) continue;
      const k = keyOf(w);
      if (!not.words.has(k)) pub.words.add(k);
    }
    for (const r of runsOf(s)) { const k = sig(r.d); if (pub.digits.size < CAPS.publicDigits && !inDigits(not.digits, k) && ![...not.digits].some((n) => n.length >= 7 && k.includes(n))) pub.digits.add(k); }
    for (const e of emailsOf(s)) if (!not.emails.has(e)) pub.emails.add(e);
    for (const i of ibansOf(s)) if (!not.ibans.has(i)) pub.ibans.add(i);
  }

  // -> [{kind, shown}] sensitive values in `text` (an address haystack or a query) that the employee did not type
  // (typed = typedView(...)) and that no public result showed. Empty = may go out without a card.
  function find(text, typed = emptyView()) {
    const hits = new Map();
    const hit = (kind, shown) => { if (!hits.has(shown)) hits.set(shown, { kind, shown }); };
    const known = (set, s) => typed[set].has(s) || pub[set].has(s);
    for (const v of variants(text)) {
      for (const e of emailsOf(v)) if (!known("emails", e)) hit("email", e);
      for (const i of ibansOf(v)) if (!known("ibans", i)) hit("iban", i);
      for (const r of runsOf(v)) {
        const s = sig(r.d);
        let mine = null;
        for (const [p, shown] of priv.digits) if (s.includes(p) || p.includes(s)) { mine = shown; break; }
        if (!mine && !isPhone(r.d) && !isEgn(r.d)) continue;
        if (inDigits(typed.digits, s) || inDigits(pub.digits, s)) continue;
        hit(mine ? "private" : isEgn(r.d) ? "egn" : "phone", mine || r.shown);
      }
      if (!priv.words.size) continue;
      const stems = new Set();
      const joined = [];
      for (const seg of v.split(/[/?&=#;,|\s]+/)) {
        const ws = (seg.match(WORD_RE) || []).map((w) => fold(w).replace(/[^a-z]/g, "")).filter(Boolean);
        for (const w of ws) stems.add(stem(w));
        if (ws.length) joined.push(ws.join(""));
      }
      for (const [k, shown] of priv.words) {
        if (typed.words.has(k) || pub.words.has(k)) continue;
        if (stems.has(k) || (k.length >= 6 && joined.some((j) => j.includes(k)))) hit("private", shown);
      }
    }
    return [...hits.values()];
  }

  return { addPrivate, addValue, addPublic, find, size: () => ({ words: priv.words.size, digits: priv.digits.size, emails: priv.emails.size, publicWords: pub.words.size }) };
}
