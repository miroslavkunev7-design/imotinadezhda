import { AGENCY_PUBLIC_PHONE } from "./imoti-types";

/** Quarter → primary city heuristic (Spec §3.3). Multi-city quarters leave city empty. */
const QUARTER_CITY: Record<string, string | "ambiguous"> = {
  "боян българанов": "Шумен",
  "тракия": "Пловдив",
  "младост": "ambiguous",
  "лилин": "София",
  "люлин": "София",
  "дружба": "ambiguous",
  "център": "ambiguous",
  "изгрев": "ambiguous",
  "възраждане": "ambiguous",
  "лазур": "Бургас",
  "сарафово": "Бургас",
  "брисбен": "ambiguous",
};

const BG_PHONE_RE = /(?:\+359|0)[\s-]?(?:8[7-9]|2|32|42|52|56|58|62|64|66|82|92)[\s-]?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2,4}/g;

const OWNER_PRICE_RE =
  /(?:собственик(?:ът|а)?\s*иска|за\s*него\s*чисто|на\s*ръка|нето|лична\s*цена)[^\d]{0,40}(\d{1,3}(?:[\s\u00a0.]?\d{3})+|\d{4,7})/i;

const AREA_RE =
  /(?:(?:квадратура|площ)[^\d]{0,20}(\d{2,4}(?:[.,]\d+)?)|(\d{2,4}(?:[.,]\d+)?)\s*(?:кв\.?\s*м|м²|m2))/i;
const FLOOR_RE = /(?:ет\.?|етаж)[^\d]{0,12}(\d{1,2})\s*(?:\/|от|от\s*)?\s*(\d{1,2})?/i;
const ROOMS_RE =
  /(гарсониера|едностаен|двустаен|тристаен|четиристаен|многостаен|мезонет|студио|1\s*\+\s*1)/i;
const CONSTRUCTION_RE = /(тухла|панел|епк|гредоред|монолит)/i;
const HEATING_RE = /(ТЕЦ|газ|климатик|ток|печка|локално|централно)/i;
const CONDITION_RE = /(отлично|ново|за\s*ремонт|добр[оа]|обзаведен|необзаведен)/i;
const CITY_RE = /(?:град|гр\.?)\s*([А-Яа-яA-Za-z\-]+)/i;
const QUARTER_RE = /(?:кв\.?|квартал)\s*[„"]?([А-Яа-яA-Za-z0-9\s\-]+?)[“"]?(?=[,.;\n]|$)/i;

export type OpisParseResult = {
  personalDescription: string;
  ownerPrice: number | null;
  phones: string[];
  areaSqm: number | null;
  floor: string | null;
  totalFloors: number | null;
  roomsLabel: string | null;
  construction: string | null;
  heating: string | null;
  condition: string | null;
  city: string | null;
  quarter: string | null;
};

export function extractPhones(text: string): string[] {
  const found = text.match(BG_PHONE_RE) ?? [];
  const normalized = found.map((p) => p.replace(/[\s-]/g, ""));
  return [...new Set(normalized)];
}

export function replacePhonesForPublic(text: string, agencyPhone = AGENCY_PUBLIC_PHONE): string {
  return text.replace(BG_PHONE_RE, agencyPhone);
}

/** Strip street/block/entrance style address fragments from public copy. */
export function scrubExactAddress(text: string): string {
  return text
    .replace(
      /(?:ул\.?|улица|бул\.?|булевард|бл\.?|блок|вх\.?|вход|№|номер)\s*[А-Яа-яA-Za-z0-9\s.\-\/№]{1,40}/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function resolveCityFromQuarter(quarter: string | null | undefined, cityHint?: string | null): string {
  if (cityHint?.trim()) return cityHint.trim();
  if (!quarter?.trim()) return "";
  const key = quarter.trim().toLowerCase();
  const mapped = QUARTER_CITY[key];
  if (!mapped || mapped === "ambiguous") return "";
  return mapped;
}

export function parseOpisText(raw: string): OpisParseResult {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const phones = extractPhones(text);

  let ownerPrice: number | null = null;
  const ownerMatch = text.match(OWNER_PRICE_RE);
  if (ownerMatch?.[1]) {
    ownerPrice = Number(ownerMatch[1].replace(/[\s\u00a0.]/g, ""));
    if (!Number.isFinite(ownerPrice)) ownerPrice = null;
  }

  const areaMatch = text.match(AREA_RE);
  const areaRaw = areaMatch?.[1] ?? areaMatch?.[2];
  const areaSqm = areaRaw ? Number(areaRaw.replace(",", ".")) : null;

  const floorMatch = text.match(FLOOR_RE);
  let floor: string | null = null;
  let totalFloors: number | null = null;
  if (floorMatch?.[1]) {
    const f = floorMatch[1];
    const t = floorMatch[2];
    floor = t ? `${f}/${t}` : f;
    totalFloors = t ? Number(t) : null;
  }

  const roomsMatch = text.match(ROOMS_RE);
  const roomsLabel = roomsMatch?.[1]?.toLowerCase().replace(/\s+/g, "") ?? null;

  const constructionMatch = text.match(CONSTRUCTION_RE);
  const construction = constructionMatch?.[1]
    ? constructionMatch[1].toLowerCase() === "епк"
      ? "ЕПК"
      : constructionMatch[1].toLowerCase()
    : null;

  const heatingMatch = text.match(HEATING_RE);
  const heating = heatingMatch?.[1] ?? null;

  const conditionMatch = text.match(CONDITION_RE);
  const condition = conditionMatch?.[1] ?? null;

  const cityMatch = text.match(CITY_RE);
  const quarterMatch = text.match(QUARTER_RE);
  const quarter = quarterMatch?.[1]?.trim() ?? null;
  const cityFromText = cityMatch?.[1]?.trim() ?? null;
  const city = cityFromText || resolveCityFromQuarter(quarter) || null;

  return {
    personalDescription: text,
    ownerPrice,
    phones,
    areaSqm: areaSqm != null && Number.isFinite(areaSqm) ? areaSqm : null,
    floor,
    totalFloors: totalFloors != null && Number.isFinite(totalFloors) ? totalFloors : null,
    roomsLabel,
    construction,
    heating,
    condition,
    city,
    quarter,
  };
}

export function buildLocalOfficialDescription(input: {
  typeLabel?: string;
  areaSqm?: number | null;
  floor?: string | null;
  city?: string | null;
  quarter?: string | null;
  personalDescription?: string;
}): string {
  const parts: string[] = [];
  const type = input.typeLabel?.trim();
  const area = input.areaSqm;
  const floor = input.floor?.trim();
  const quarter = input.quarter?.trim();
  const city = input.city?.trim();

  if (type) parts.push(`Предлагаме ${type}`);
  else parts.push("Предлагаме имот");
  if (area) parts.push(`с площ ${area} кв.м`);
  if (floor) parts.push(`на ${floor} етаж`);
  if (quarter && city) parts.push(`в квартал ${quarter}, ${city}`);
  else if (quarter) parts.push(`в квартал ${quarter}`);
  else if (city) parts.push(`в ${city}`);

  let body = `${parts.join(" ")}.`;
  const personal = input.personalDescription?.trim();
  if (personal) {
    const scrubbed = scrubExactAddress(replacePhonesForPublic(personal));
    const snippet = scrubbed.slice(0, 420).trim();
    if (snippet) body += ` ${snippet}`;
  }
  return scrubExactAddress(replacePhonesForPublic(body));
}
