import { AGENCY } from "@/lib/contact-config";
import {
  BRAND_ALTERNATE_NAMES,
  KNOWS_ABOUT,
  PROPERTY_TYPE_LABELS,
  SEO_CITIES,
  SEO_KEYWORDS as SEO_KEYWORDS_REGISTRY,
  cityBySlug,
  cityKeywords as cityKeywordsFromRegistry,
} from "@/lib/seo-keywords";

/** Canonical public site URL — used for SEO, sitemap, Open Graph, and JSON-LD. */
export const SITE_URL = "https://imotinadezhda.bg";

export const SITE_NAME = "Имоти Надежда";
export const SITE_NAME_FULL = "Недвижими имоти Имоти Надежда";

export { SEO_KEYWORDS_REGISTRY as SEO_KEYWORDS };

export const SITE_DESCRIPTION =
  "Имоти Надежда (Imoti Nadezhda) — агенция за недвижими имоти в Шумен, Варна, Бургас и Нови пазар. Апартаменти, къщи, офиси и парцели за продажба и под наем, включително ново строителство и имоти на морето.";

export const HOME_TITLE = "Имоти Надежда — имоти в Шумен, Варна, Бургас и Нови пазар";
export const HOME_DESCRIPTION =
  "Имоти Надежда (Imoti Nadezhda) — агенция за недвижими имоти. Купете или наемете апартамент, къща, офис или парцел в Шумен, Варна, Бургас и Нови пазар. Локални консултанти за продажба, наем и ново строителство.";

export function siteUrl(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

export const PAGE_SEO: Record<string, { title: string; description: string }> = {
  home: { title: HOME_TITLE, description: HOME_DESCRIPTION },
  about: {
    title: "За нас | Агенция недвижими имоти Имоти Надежда",
    description:
      "Имоти Надежда е агенция за недвижими имоти в Шумен, Варна, Бургас и Нови пазар. Покупка, продажба и наем на апартаменти, къщи, офиси и парцели — с личен консултант.",
  },
  contacts: {
    title: "Контакти | Имоти Надежда — офис Шумен",
    description:
      "Свържете се с Имоти Надежда — телефон, имейл и офис в Шумен. Консултации за имоти в Шумен, Варна, Бургас и Нови пазар.",
  },
  sell: {
    title: "Продай имот — безплатна оценка | Имоти Надежда",
    description:
      "Продайте апартамент, къща, офис или парцел чрез Имоти Надежда в Шумен, Варна, Бургас и Нови пазар. Безплатна оценка и професионална обява.",
  },
  buy: {
    title: "Купи имот — апартаменти и къщи за продажба | Имоти Надежда",
    description:
      "Купете имот от Имоти Надежда — апартаменти, къщи, парцели и офиси за продажба в Шумен, Варна, Бургас и Нови пазар, включително ново строителство.",
  },
  search: {
    title: "Търсене на имоти | Имоти Надежда",
    description:
      "Търсене на имоти в Шумен, Варна, Бургас и Нови пазар — филтри по град, квартал, тип, цена и площ. Продажба и под наем от Имоти Надежда.",
  },
};

type CitySeoEntry = {
  title: string;
  description: string;
  intro: string;
};

const CITY_SEO: Record<string, CitySeoEntry> = {
  shumen: {
    title: "Имоти в Шумен | Апартаменти, къщи и наеми | Имоти Надежда",
    description:
      "Имоти Надежда предлага имоти в Шумен — апартаменти, къщи, парцели и офиси за продажба и под наем. Двустаен и тристаен, ново строителство и актуални оферти от локални консултанти.",
    intro:
      "Агенция Имоти Надежда предлага апартаменти, къщи, парцели и офиси за продажба и под наем в Шумен.",
  },
  varna: {
    title: "Имоти във Варна | Апартаменти на морето и наеми | Имоти Надежда",
    description:
      "Имоти във Варна от Имоти Надежда — апартаменти, къщи и офиси за продажба и под наем, включително имоти на морето и ново строителство. Купете или наемете с локален консултант.",
    intro:
      "Агенция Имоти Надежда предлага апартаменти, къщи и имоти на морето за продажба и под наем във Варна.",
  },
  burgas: {
    title: "Имоти в Бургас | Апартаменти на морето | Имоти Надежда",
    description:
      "Имоти в Бургас от Имоти Надежда — апартаменти край морето, къщи, парцели и офиси за продажба и наем. Ново строителство и инвестиционни оферти на южното Черноморие.",
    intro:
      "Агенция Имоти Надежда предлага апартаменти, къщи и имоти на морето за продажба и под наем в Бургас.",
  },
  "novi-pazar": {
    title: "Имоти в Нови пазар | Апартаменти и къщи | Имоти Надежда",
    description:
      "Имоти в Нови пазар от Имоти Надежда — апартаменти, къщи и парцели за продажба и под наем близо до Шумен. Личен подход и актуални оферти.",
    intro:
      "Агенция Имоти Надежда предлага апартаменти, къщи и парцели за продажба и под наем в Нови пазар.",
  },
};

export function citySeo(slug: string, cityName?: string) {
  const preset = CITY_SEO[slug];
  if (preset) return preset;
  const city = cityBySlug(slug);
  const name = city?.name ?? cityName ?? slug;
  const prep = city?.prep ?? "в";
  return {
    title: `Имоти ${prep} ${name} | ${SITE_NAME} — агенция недвижими имоти`,
    description: `Имоти ${prep} ${name} от агенция ${SITE_NAME} — апартаменти, къщи, парцели и офиси за продажба и под наем.`,
    intro: `Агенция ${SITE_NAME} предлага апартаменти, къщи, парцели и офиси за продажба и под наем ${prep} ${name}.`,
  };
}

export function cityKeywords(slug: string, cityName?: string) {
  return cityKeywordsFromRegistry(slug, cityName);
}

export type SearchSeoInput = {
  status?: string;
  city_slug?: string;
  property_type?: string;
};

export function searchPageSeo(s: SearchSeoInput = {}) {
  const city = s.city_slug ? cityBySlug(s.city_slug) : undefined;
  const cityName = city?.name;
  const typeLabel = s.property_type ? PROPERTY_TYPE_LABELS[s.property_type] : undefined;
  const isRent = s.status === "rent";
  const isSale = s.status === "sale";

  if (isRent && cityName && typeLabel) {
    return {
      title: `${typeLabel} под наем в ${cityName} | ${SITE_NAME}`,
      description: `${typeLabel} под наем в ${cityName} от агенция ${SITE_NAME}. Актуални наеми — разгледайте офертите и се свържете с консултант.`,
    };
  }
  if (isRent && cityName) {
    return {
      title: `Наеми в ${cityName} — имоти под наем | ${SITE_NAME}`,
      description: `Апартаменти и къщи под наем в ${cityName} от ${SITE_NAME}. Наеми с актуални оферти и бърза връзка с брокер.`,
    };
  }
  if (isSale && cityName && typeLabel) {
    return {
      title: `${typeLabel} за продажба в ${cityName} | ${SITE_NAME}`,
      description: `${typeLabel} за продажба в ${cityName} от агенция ${SITE_NAME}. Купете имот с локален консултант.`,
    };
  }
  if (isSale && cityName) {
    return {
      title: `Имоти за продажба в ${cityName} | ${SITE_NAME}`,
      description: `Купете апартамент, къща, офис или парцел в ${cityName} от ${SITE_NAME}. Актуални оферти за продажба.`,
    };
  }
  if (cityName && typeLabel) {
    return {
      title: `${typeLabel} в ${cityName} | ${SITE_NAME}`,
      description: `${typeLabel} в ${cityName} за продажба и под наем от агенция ${SITE_NAME}.`,
    };
  }
  if (isRent) {
    return {
      title: `Имоти под наем — наеми в Шумен, Варна и Бургас | ${SITE_NAME}`,
      description: `Наеми от ${SITE_NAME} — апартаменти и къщи под наем в Шумен, Варна, Бургас и Нови пазар.`,
    };
  }
  if (isSale) {
    return PAGE_SEO.buy;
  }
  if (cityName) {
    return {
      title: `Имоти в ${cityName} | търсене | ${SITE_NAME}`,
      description: `Търсене на имоти в ${cityName} — продажба и под наем на апартаменти, къщи и парцели от ${SITE_NAME}.`,
    };
  }
  if (typeLabel) {
    return {
      title: `${typeLabel} за продажба и наем | ${SITE_NAME}`,
      description: `${typeLabel} в Шумен, Варна, Бургас и Нови пазар — продажба и под наем от ${SITE_NAME}.`,
    };
  }
  return PAGE_SEO.search;
}

export function searchCanonicalPath(s: SearchSeoInput = {}) {
  const params = new URLSearchParams();
  if (s.status === "sale" || s.status === "rent") params.set("status", s.status);
  if (s.city_slug) params.set("city_slug", s.city_slug);
  if (s.property_type) params.set("property_type", s.property_type);
  const q = params.toString();
  return q ? `/search?${q}` : "/search";
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": ["RealEstateAgent", "Organization"],
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    legalName: SITE_NAME_FULL,
    alternateName: [...BRAND_ALTERNATE_NAMES],
    url: SITE_URL,
    logo: siteUrl("/icon-512.png"),
    image: siteUrl("/icon-512.png"),
    description: SITE_DESCRIPTION,
    email: AGENCY.email,
    telephone: AGENCY.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: "ул. Съединение 5",
      addressLocality: "Шумен",
      addressCountry: "BG",
    },
    areaServed: SEO_CITIES.map((c) => ({ "@type": "City", name: c.name })),
    knowsAbout: [...KNOWS_ABOUT],
    priceRange: "€€",
    inLanguage: "bg-BG",
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: [...BRAND_ALTERNATE_NAMES],
    url: SITE_URL,
    inLanguage: "bg-BG",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?city_slug={search_term}`,
      "query-input": "required name=search_term",
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: siteUrl(item.path),
    })),
  };
}
