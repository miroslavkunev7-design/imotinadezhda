/** Keyword registry for on-site SEO (Cyrillic + Latin). Used in meta, JSON-LD, and natural copy — not as hidden walls. */

export const SEO_CITIES = [
  { slug: "shumen", name: "Шумен", latin: "Shumen", prep: "в" },
  { slug: "varna", name: "Варна", latin: "Varna", prep: "във" },
  { slug: "burgas", name: "Бургас", latin: "Burgas", prep: "в" },
  { slug: "novi-pazar", name: "Нови пазар", latin: "Novi pazar", prep: "в" },
] as const;

export type SeoCitySlug = (typeof SEO_CITIES)[number]["slug"];

export const BRAND_ALTERNATE_NAMES = [
  "Imoti Nadezhda",
  "imoti nadezhda",
  "imotinadezhda",
  "imoti-nadezhda",
  "ИМОТИ НАДЕЖДА",
] as const;

const BRAND_CYR = ["имоти надежда", "Имоти Надежда"] as const;

const GENERIC_BG = [
  "имоти",
  "недвижими имоти",
  "агенция недвижими имоти",
  "агенция имоти",
  "купи имот",
  "продай имот",
  "продава",
  "под наем",
  "наеми",
  "апартаменти",
  "къщи",
  "парцели",
  "офиси",
  "двустаен",
  "тристаен",
  "имоти на морето",
  "ново строителство",
  "на зелено",
] as const;

const GENERIC_LATIN = [
  "imoti",
  "real estate bulgaria",
  "apartments shumen",
  "rent shumen",
  "imoti shumen",
  "imoti varna",
  "imoti burgas",
  "imoti novi pazar",
] as const;

function cityPhrases(city: (typeof SEO_CITIES)[number]): string[] {
  const n = city.name.toLowerCase();
  const l = city.latin.toLowerCase();
  return [
    `имоти ${n}`,
    `апартаменти ${n}`,
    `къщи ${n}`,
    `парцели ${n}`,
    `офиси ${n}`,
    `наеми ${n}`,
    `имоти под наем ${n}`,
    `купи имот ${n}`,
    `imoti ${l}`,
  ];
}

/** Curated meta keywords string (brand + cities + intent, both scripts). */
export const SEO_KEYWORDS = [
  ...BRAND_CYR,
  ...BRAND_ALTERNATE_NAMES.slice(0, 4),
  ...GENERIC_BG,
  ...SEO_CITIES.flatMap(cityPhrases),
  ...GENERIC_LATIN,
].join(", ");

export const KNOWS_ABOUT = [
  "недвижими имоти",
  "имоти Шумен",
  "имоти Варна",
  "имоти Бургас",
  "имоти Нови пазар",
  "апартаменти",
  "къщи",
  "парцели",
  "офиси",
  "наеми",
  "имоти под наем",
  "имоти на морето",
  "ново строителство",
  "продажба на имоти",
  "real estate Bulgaria",
];

export function cityBySlug(slug: string) {
  return SEO_CITIES.find((c) => c.slug === slug);
}

export function cityKeywords(slug: string, cityName?: string): string {
  const city = cityBySlug(slug);
  const name = city?.name ?? cityName ?? slug;
  const latin = city?.latin;
  const phrases = [
    `имоти ${name}`,
    `недвижими имоти ${name}`,
    `апартаменти ${name}`,
    `къщи ${name}`,
    `парцели ${name}`,
    `офиси ${name}`,
    `наеми ${name}`,
    `имоти под наем ${name}`,
    `двустаен ${name}`,
    `тристаен ${name}`,
    "Имоти Надежда",
    "imoti nadezhda",
  ];
  if (latin) phrases.push(`imoti ${latin.toLowerCase()}`, `apartments ${latin.toLowerCase()}`);
  if (slug === "varna" || slug === "burgas") {
    phrases.push("имоти на морето", "ново строителство");
  }
  return phrases.join(", ");
}

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: "Апартаменти",
  house: "Къщи",
  land: "Парцели",
  office: "Офиси",
  commercial: "Търговски имоти",
};
