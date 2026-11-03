import { SHUMEN_BANKS } from "@/lib/shumen-banks";

export type DayBankRate = {
  bankId: string;
  rate: number;
  live: boolean;
  product: string | null;
  note: string;
  /** Оферта за доходи от чужбина / граждани на ЕС — днешна сверка. */
  abroadRate?: number | null;
  abroadLive?: boolean;
  abroadProduct?: string | null;
  abroadNote?: string | null;
  /** Ограничена отговорност — публикувана до договорената лихва. */
  limitedRate?: number | null;
  limitedNote?: string | null;
  updatedOn?: string | null;
};

export type DayBankRatesResult = {
  date: string;
  asOf: string;
  rates: Record<string, DayBankRate>;
};

type BankRateSource = {
  listingUrl?: string;
  seedUrls: string[];
};

const MP = "https://www.moitepari.bg";

/** Канонични страници — жилищен кредит за покупка (плаваща, EUR, където има). */
const SOURCES: Record<string, BankRateSource> = {
  dsk: {
    listingUrl: `${MP}/ipotechni_krediti/banka-dsk-ead~812d0dfe-8998-4f25-a592-c247a1d82406`,
    seedUrls: [
      `${MP}/ipotechen-kredit/banka-dsk-jilishten-kredit-za-pokupka-s-plavashta-lihva-za-celiya-period-s-izpulnenie-na-programa-uut-plus-s-paket-plan-premium-eur~9221bca6-0e67-4a7d-9499-8812a0dad02e`,
    ],
  },
  ubb: {
    listingUrl: `${MP}/ipotechni_krediti/obb~5b83fe0c-3b26-42dd-8c5b-36dab6df53c8`,
    seedUrls: [
      `${MP}/ipotechen-kredit/obb-ipotechen-kredit-za-pokupka-na-jilishten-imot-zastrahovki-jivot-i-imot-paket-a-eur~8f3348ed-aa36-4c73-8122-31176d959a81`,
    ],
  },
  unicredit: {
    listingUrl: `${MP}/ipotechni_krediti/unikredit-bulbank~e7ff9a75-6351-4b95-85f4-3e680cc0bf2d`,
    seedUrls: [
      `${MP}/ipotechen-kredit/unikredit-bulbank-kredit-moyat-nov-dom-s-prevod-na-zaplata-paket-kreditna-protekciya-eur~7a8693ef-27cf-483d-a33a-2602cdc13bc3`,
    ],
  },
  fibank: {
    listingUrl: `${MP}/ipotechni_krediti/fibank~17f57d55-ef65-470e-9169-1ce7755643b7`,
    seedUrls: [
      `${MP}/ipotechen-kredit/fibank-jilishten-ipotechen-kredit-pravo-na-izbor-za-pokupka-stroitelstvo-remont-i-potrebitelski-nujdi-polzvane-na-kreditna-karta-s-prevod-na-dohod-polzvane-na-kreditna-karta-i-bankov-paket-eur~6d8c18f9-5972-459f-acce-943e9652cf6a`,
    ],
  },
  postbank: {
    listingUrl: `${MP}/ipotechni_krediti/poshtenska-banka~04ef5dd4-1640-4888-a6f9-9a3f0d3fdb6f`,
    seedUrls: [
      `${MP}/ipotechen-kredit/poshtenska-banka-jilishten-kredit-s-prevod-na-rabotna-zaplata-moeto-semejstvo-i-paket-jivot-eur~875874d3-e61a-4f86-b544-85cc76421f77`,
    ],
  },
  allianz: {
    listingUrl: `${MP}/ipotechni_krediti/alianc-bank-bulgariya~341dda25-8fed-4c2d-b59e-3f3e6ccb9d56`,
    seedUrls: [
      `${MP}/ipotechen-kredit/alianc-bank-bulgariya-kredit-jilishte-s-polzvane-na-paket-alianc-start-allianz-best-customer-zastrahovka-jivot-s-prevod-na-rz-eur~4accead3-68da-4031-89b3-56c741937c34`,
    ],
  },
  ccb: {
    listingUrl: `${MP}/ipotechni_krediti/ckb~39c06437-2270-4807-b3ef-94358e6f9fbb`,
    seedUrls: [
      `${MP}/ipotechen-kredit/ckb-dom-za-teb-s-prevod-na-rabotna-zaplata-s-predplatena-za-purvite-3-g-premiya-po-zj-eur~c59edf99-038c-4bc8-9f29-7aad8f2495e5`,
    ],
  },
  tbi: {
    listingUrl: `${MP}/ipotechni_krediti/tbi-bank`,
    seedUrls: [],
  },
  investbank: {
    listingUrl: `${MP}/ipotechni_krediti/investbank~3dec1e14-1c31-42dc-887d-cf0ae8c5e64f`,
    seedUrls: [
      `${MP}/ipotechen-kredit/investbank-ipotechen-kredit-za-pridobivane-na-nedvijim-imot-ot-fizicheski-lica-grajdani-na-durjavi-ot-es-bgn~751b3628-69c1-41b0-879e-b0e443995b41`,
    ],
  },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let cache: { key: string; value: DayBankRatesResult; at: number } | null = null;
const CACHE_MS = 6 * 60 * 60 * 1000;

export function sofiaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;|&minus;/gi, "-")
    .replace(/&#8211;|&#8722;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBgPct(raw: string): number | null {
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 1.2 || n > 12) return null;
  return Math.round(n * 100) / 100;
}

function extractProductTitle(html: string): string | null {
  const headings = [...html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)]
    .map((m) => htmlToText(m[1]))
    .filter((t) =>
      t.length > 16 &&
      /(кредит|жилищ|ипотеч|дом за теб|право на избор)/i.test(t) &&
      !/резултати от търсенето|каталог/i.test(t),
    );
  return headings[0]?.slice(0, 110) ?? null;
}

/** Взема най-ниската договорена лихва от блока „Лихвени условия“. */
export function parseInterestSection(html: string): { rate: number; product: string | null } | null {
  const text = htmlToText(html);
  const title = extractProductTitle(html);

  const start = text.search(/лихвени условия/i);
  const from = start >= 0 ? start : 0;
  const after = text.slice(from);
  const end = after.search(/ограничения на кредита|допълнителни банкови условия|кредитоспособност/i);
  const section = (end > 40 ? after.slice(0, end) : after.slice(0, 1800)).replace(/\s+/g, " ");

  const found: number[] = [];
  const re = /(\d{1,2}[,.]\d{1,4})\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section))) {
    const n = parseBgPct(m[1]);
    if (n != null) found.push(n);
  }
  if (!found.length) return null;

  const low = found.filter((n) => n < 6);
  const pickFrom = low.length ? low : found;
  const rate = Math.min(...pickFrom);
  return { rate, product: title };
}

function matchPctNear(text: string, re: RegExp): number | null {
  const m = text.match(re);
  return m ? parseBgPct(m[1]) : null;
}

export function parseLabeledMortgageRates(html: string): {
  full: number | null;
  limited: number | null;
  abroad: number | null;
  product: string | null;
  updatedOn: string | null;
} {
  const text = htmlToText(html);
  const updated = text.match(/последна промяна:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
  return {
    full: matchPctNear(text, /при пълна отговорност[^\d]{0,48}(\d{1,2}[,.]\d{1,4})\s*%/i),
    limited: matchPctNear(text, /при ограничена отговорност[^\d]{0,48}(\d{1,2}[,.]\d{1,4})\s*%/i),
    abroad: matchPctNear(text, /доходи от чужбина[^\d]{0,96}(\d{1,2}[,.]\d{1,4})\s*%/i),
    product: extractProductTitle(html),
    updatedOn: updated?.[1] ?? null,
  };
}

function isAbroadProduct(slugOrTitle: string) {
  const s = slugOrTitle.toLowerCase();
  return /(grajdani|durjavi-ot-es|-es-|chuzhd|chujbin|evropejsk|чужден|чужбин|граждани на)/i.test(s);
}

function scoreProductSlug(slug: string) {
  const s = slug.toLowerCase();
  let n = 0;
  if (s.includes("-eur") || s.endsWith("eur")) n += 8;
  if (/(pokupka|jilishten|jilishte|dom-za-teb|moyat-nov-dom|pridobivane|pravo-na-izbor|uut-plus)/.test(s)) n += 7;
  if (s.includes("plavashta")) n += 4;
  if (s.includes("fiksirana")) n -= 10;
  if (/(tekushti|potrebitelski|refinans)/.test(s)) n -= 6;
  if (s.includes("-bgn")) n -= 1;
  if (isAbroadProduct(s)) n += 12;
  return n;
}

function productLinks(html: string): string[] {
  const out = new Set<string>();
  const re = /href="(\/ipotechen-kredit\/[a-z0-9-]+~[a-f0-9-]{36})"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.add(`${MP}${m[1]}`);
  return [...out];
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        "accept-language": "bg-BG,bg;q=0.9,en;q=0.5",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(14_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function rateFromUrls(urls: string[]): Promise<{ rate: number; product: string | null } | null> {
  const unique = [...new Set(urls)].slice(0, 3);
  const parsed: { rate: number; product: string | null }[] = [];
  for (const url of unique) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const hit = parseInterestSection(html);
    if (hit) parsed.push(hit);
  }
  if (!parsed.length) return null;
  parsed.sort((a, b) => a.rate - b.rate);
  return parsed[0];
}

function isExpiredPromo(title: string | null) {
  return /30\.11\.2023|преференциални условия до/i.test(title ?? "");
}

async function fetchBankRate(bankId: string): Promise<DayBankRate> {
  const bank = SHUMEN_BANKS.find((b) => b.id === bankId);
  const fallback: DayBankRate = {
    bankId,
    rate: bank?.rateToday ?? 0,
    live: false,
    product: null,
    note: "няма нова публикация днес — показан е последният стикер",
    abroadRate: bank?.rateAbroadToday ?? null,
    abroadLive: false,
    abroadNote: bank?.rateAbroadNote ?? null,
    limitedRate: bank?.rateLimitedToday ?? null,
    limitedNote: bank?.rateLimitedToday != null
      ? "стикер при ограничена отговорност"
      : null,
  };
  const src = SOURCES[bankId];
  if (!src) return fallback;

  const urls = [...src.seedUrls];
  if (src.listingUrl) {
    const listing = await fetchHtml(src.listingUrl);
    if (listing) {
      urls.push(
        ...productLinks(listing)
          .map((url) => ({ url, score: scoreProductSlug(url) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
          .map((x) => x.url),
      );
    }
  }

  const unique = [...new Set(urls)].slice(0, 6);
  let bestStandard: { rate: number; product: string | null; updatedOn: string | null } | null = null;
  let bestAbroad: { rate: number; product: string | null; updatedOn: string | null } | null = null;
  let limited: { rate: number; product: string | null } | null = null;

  for (const url of unique) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const labeled = parseLabeledMortgageRates(html);
    const generic = parseInterestSection(html);
    const title = labeled.product ?? generic?.product ?? null;
    if (isExpiredPromo(title) || /30-11-2023/.test(url)) continue;
    const full = labeled.full ?? generic?.rate ?? null;
    if (full == null) continue;

    const abroadish = isAbroadProduct(url) || isAbroadProduct(title ?? "") || labeled.abroad != null;
    const row = { rate: labeled.abroad ?? full, product: title, updatedOn: labeled.updatedOn };
    if (abroadish) {
      if (!bestAbroad || row.rate < bestAbroad.rate) bestAbroad = row;
    } else if (!bestStandard || full < bestStandard.rate) {
      bestStandard = { rate: full, product: title, updatedOn: labeled.updatedOn };
    }
    if (labeled.limited != null && (!limited || labeled.limited > limited.rate)) {
      limited = { rate: labeled.limited, product: title };
    }
  }

  if (!bestStandard && !bestAbroad) return fallback;

  const main = bestStandard ?? bestAbroad!;
  const abroad = bestAbroad ?? (labeledAbroadFromMain(bestStandard, bankId) ? bestStandard : null);

  return {
    bankId,
    rate: main.rate,
    live: true,
    product: main.product,
    note: liveNote(main.product, main.updatedOn),
    updatedOn: main.updatedOn,
    abroadRate: abroad?.rate ?? bank?.rateAbroadToday ?? null,
    abroadLive: Boolean(abroad),
    abroadProduct: abroad?.product ?? null,
    abroadNote: abroad
      ? liveNote(abroad.product, abroad.updatedOn, "доходи от чужбина / граждани на ЕС")
      : (bank?.rateAbroadNote ?? null),
    limitedRate: limited?.rate ?? bank?.rateLimitedToday ?? null,
    limitedNote: limited
      ? `ограничена отговорност · ${limited.product?.replace(/\s+/g, " ").slice(0, 70) ?? "публична оферта"}`
      : (bank?.rateLimitedToday != null ? "стикер при ограничена отговорност" : null),
  };
}

function labeledAbroadFromMain(
  main: { product: string | null } | null,
  bankId: string,
) {
  if (bankId !== "investbank") return false;
  return isAbroadProduct(main?.product ?? "");
}

function liveNote(product: string | null, updatedOn: string | null, kind?: string) {
  const head = kind ? `взета автоматично днес · ${kind}` : "взета автоматично днес";
  const prod = product ? ` · ${product.replace(/\s+/g, " ").slice(0, 80)}` : " от публичната оферта";
  const when = updatedOn ? ` · обновена ${updatedOn}` : "";
  return `${head}${prod}${when}`;
}

export async function fetchAllDayBankRates(): Promise<DayBankRatesResult> {
  const date = sofiaToday();
  const cacheKey = `${date}:v2`;
  if (cache && cache.key === cacheKey && Date.now() - cache.at < CACHE_MS) return cache.value;

  const settled = await Promise.allSettled(SHUMEN_BANKS.map((b) => fetchBankRate(b.id)));
  const rates: Record<string, DayBankRate> = {};
  SHUMEN_BANKS.forEach((b, i) => {
    const row = settled[i];
    rates[b.id] =
      row.status === "fulfilled"
        ? row.value
        : {
            bankId: b.id,
            rate: b.rateToday,
            live: false,
            product: null,
            note: "няма нова публикация днес — показан е последният стикер",
            abroadRate: b.rateAbroadToday ?? null,
            abroadLive: false,
            abroadNote: b.rateAbroadNote ?? null,
            limitedRate: b.rateLimitedToday ?? null,
            limitedNote: b.rateLimitedToday != null ? "стикер при ограничена отговорност" : null,
          };
  });

  const value: DayBankRatesResult = {
    date,
    asOf: new Date().toISOString(),
    rates,
  };
  cache = { key: cacheKey, value, at: Date.now() };
  return value;
}
