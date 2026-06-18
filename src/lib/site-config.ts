/** Canonical public site URL — used for SEO, sitemap, Open Graph, and JSON-LD. */
export const SITE_URL = "https://imotinadezhda.bg";

export const SITE_NAME = "Имоти Надежда";
export const SITE_NAME_FULL = "Недвижими имоти Имоти Надежда";

export const SITE_DESCRIPTION =
  "Имоти Надежда — агенция за недвижими имоти в Шумен, Варна, Бургас и Нов пазар. Купувайте и продавайте апартаменти, къщи, офиси и парцели.";

export const SEO_KEYWORDS =
  "имоти, имоти надежда, imoti nadezhda, imotinadezhda, недвижими имоти, имоти шумен, imoti shumen, имоти варна, imoti varna, имоти бургас, imoti burgas, агенция имоти, купи имот, продай имот, апартаменти шумен, апартаменти варна, апартаменти бургас";

export function siteUrl(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

const CITY_SEO: Record<string, { title: string; description: string }> = {
  shumen: {
    title: "Имоти в Шумен | Имоти Надежда — агенция недвижими имоти",
    description:
      "Имоти в град Шумен — апартаменти, къщи и парцели от агенция Имоти Надежда. Локални консултанти, проверени оферти и сигурни сделки.",
  },
  varna: {
    title: "Имоти във Варна | Имоти Надежда — агенция недвижими имоти",
    description:
      "Имоти във Варна — продажба и наем на апартаменти, къщи и търговски имоти. Агенция Имоти Надежда — професионален подход и богат избор.",
  },
  burgas: {
    title: "Имоти в Бургас | Имоти Надежда — агенция недвижими имоти",
    description:
      "Имоти в Бургас — апартаменти край морето, къщи и инвестиционни имоти. Имоти Надежда — вашият партньор за недвижими имоти на южното черноморие.",
  },
  "nov-pazar": {
    title: "Имоти в Нов пазар | Имоти Надежда — агенция недвижими имоти",
    description:
      "Имоти в Нов пазар и региона — апартаменти и къщи от агенция Имоти Надежда. Личен подход и актуални оферти.",
  },
};

export function citySeo(slug: string, cityName?: string) {
  const preset = CITY_SEO[slug];
  if (preset) return preset;
  const name = cityName ?? slug;
  return {
    title: `Имоти в ${name} | ${SITE_NAME} — агенция недвижими имоти`,
    description: `Имоти в ${name} — апартаменти, къщи и парцели от агенция ${SITE_NAME}. Търсене, продажба и наем на недвижими имоти.`,
  };
}
