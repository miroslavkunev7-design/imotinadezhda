import type { CmsComponent } from "./api";

/** Rich default inventory so every page has expressive editors even before CMS rows exist. */
export type CatalogComponent = Omit<CmsComponent, "id" | "page_id"> & {
  id: string;
  page_id: string;
  label: string;
  hint?: string;
};

const wine = "#710019";
const gold = "#bb7b16";
const cream = "#fff9f2";

function row(
  pageSlug: string,
  key: string,
  type: string,
  props: Record<string, unknown>,
  sort_order: number,
  label: string,
  hint?: string
): CatalogComponent {
  return {
    id: `catalog:${pageSlug}:${key}`,
    page_id: `catalog:${pageSlug}`,
    component_key: key,
    type,
    sort_order,
    rect: {},
    props,
    label,
    hint
  };
}

const HOME: CatalogComponent[] = [
  row("/", "theme.wine", "color", { cssVar: "--wine", value: wine, label: "Brand wine" }, 0, "Brand wine", "Root --wine"),
  row("/", "theme.gold", "color", { cssVar: "--gold", value: gold, label: "Accent gold" }, 1, "Accent gold"),
  row("/", "theme.cream", "color", { cssVar: "--cream", value: cream, label: "Cream surface" }, 2, "Cream surface"),
  row("/", "theme.ink", "color", { cssVar: "--ink", value: "#6a001b", label: "Ink / body" }, 3, "Ink color"),
  row("/", "nav.links", "shape", { shape: "pill", radius: "999px", selector: ".nav a", label: "Nav pills" }, 4, "Nav link shape"),
  row("/", "hero.section", "section_height", { selector: ".hero, .stage, main > section:first-of-type", height: "520px" }, 5, "Hero height"),
  row("/", "city.cards", "shape", { shape: "soft", radius: "24px", selector: ".card", label: "City cards" }, 6, "City card shape"),
  row("/", "city.card.photo", "image", { selector: ".card .ph", url: "", melt: false, fit: "cover", graphics: "none" }, 7, "City card photo"),
  row("/", "city.card.melt", "melt", { selector: ".card .fd", url: "", melt: true, intensity: 0.72, mode: "gradient", blend: "multiply" }, 8, "City card melt"),
  row("/", "logo.mark", "image", { selector: ".logo img, header img, .brand img", url: "", melt: false, fit: "contain", graphics: "logo" }, 9, "Header logo"),
  row("/", "feature.icons", "graphics", { selector: ".f svg.i, .feat svg", preset: "gold-satin", size: "44px", color: gold }, 10, "Feature icons"),
  row("/", "cta.buttons", "shape", { shape: "rounded", radius: "16px", selector: ".cta, .btn, button.primary", label: "CTA buttons" }, 11, "CTA shape"),
  row("/", "menu.deals", "dropdown", { items: [{ label: "За продажба", target: "deal.sale" }, { label: "Под наем", target: "deal.rent" }] }, 12, "Deal menu builder"),
  row("/", "section.filters", "size", { selector: ".filters, .toolbar", width: "100%", height: "64px", scale: 1, padding: "12px" }, 13, "Filters size")
];

const BANK: CatalogComponent[] = [
  row("/bank/", "bank.theme.wine", "color", { cssVar: "--wine", value: wine, label: "Bank wine" }, 0, "Bank brand wine"),
  row("/bank/", "bank.hero", "section_height", { selector: ".hero, .lux, .storefront", height: "420px" }, 1, "Storefront height"),
  row("/bank/", "bank.card.shape", "shape", { shape: "soft", radius: "28px", selector: ".bank-card, .lux-card, .card", label: "Bank cards" }, 2, "Bank card shape"),
  row("/bank/", "bank.dsk.image", "image", { selector: "[data-bank='dsk'] img, .bank-dsk", url: "/bank/assets/image-1.png", melt: false, fit: "cover" }, 3, "ДСК luxury image"),
  row("/bank/", "bank.ubb.image", "image", { selector: "[data-bank='ubb'] img, .bank-ubb", url: "/bank/assets/image-2.jpg", melt: false, fit: "cover" }, 4, "ОББ luxury image"),
  row("/bank/", "bank.melt", "melt", { selector: ".lux-melt, .bank-melt", url: "", melt: true, intensity: 0.65, mode: "vignette", blend: "soft-light" }, 5, "Bank melt overlay"),
  row("/bank/", "bank.brand.hex", "color", { cssVar: "--bank-accent", value: "#e30613", label: "Active bank hex" }, 6, "Active bank accent"),
  row("/bank/", "bank.rate.panel", "size", { selector: ".rates, .rate-panel", width: "100%", height: "220px", scale: 1, padding: "16px" }, 7, "Rates panel size")
];

const MOBILE: CatalogComponent[] = [
  row("/mobile/", "mobile.theme.wine", "color", { cssVar: "--wine", value: wine, label: "Mobile wine" }, 0, "Mobile wine"),
  row("/mobile/", "mobile.header", "section_height", { selector: "header, .top", height: "72px" }, 1, "Mobile header"),
  row("/mobile/", "mobile.cards", "shape", { shape: "rounded", radius: "18px", selector: ".card, .listing", label: "Listing cards" }, 2, "Listing shape"),
  row("/mobile/", "mobile.hero.melt", "melt", { selector: ".hero, .melt", url: "", melt: true, intensity: 0.55, mode: "gradient", blend: "multiply" }, 3, "Mobile melt"),
  row("/mobile/", "mobile.nav", "dropdown", { items: [{ label: "Начало", target: "home" }, { label: "Каталог", target: "catalog" }, { label: "Банка", target: "bank" }] }, 4, "Mobile nav builder")
];

function city(slug: string, name: string): CatalogComponent[] {
  return [
    row(slug, `${name}.theme`, "color", { cssVar: "--wine", value: wine, label: `${name} wine` }, 0, `${name} brand`),
    row(slug, `${name}.hero`, "section_height", { selector: ".city-hero, .hero, .panel", height: "360px" }, 1, `${name} hero height`),
    row(slug, `${name}.quarters`, "shape", { shape: "soft", radius: "22px", selector: ".quarter, .q-card, .card", label: "Quarter cards" }, 2, "Quarter card shape"),
    row(slug, `${name}.photo`, "image", { selector: ".quarter .ph, .q-card .ph, .card .ph", url: "", melt: false, fit: "cover", graphics: "photo" }, 3, "Quarter photos"),
    row(slug, `${name}.melt`, "melt", { selector: ".quarter .fd, .melt", url: "", melt: true, intensity: 0.7, mode: "gradient", blend: "multiply" }, 4, "Quarter melt"),
    row(slug, `${name}.map`, "graphics", { selector: ".map, .city-map, svg.map", preset: "outline-gold", size: "100%", color: gold }, 5, "City map graphic"),
    row(slug, `${name}.menu`, "dropdown", { items: [{ label: "Квартали", target: "quarters" }, { label: "Карта", target: "map" }] }, 6, "City menu")
  ];
}

export const CATALOG_BY_SLUG: Record<string, CatalogComponent[]> = {
  "/": HOME,
  "/bank/": BANK,
  "/mobile/": MOBILE,
  "#/city/burgas": city("#/city/burgas", "burgas"),
  "#/city/varna": city("#/city/varna", "varna"),
  "#/city/shumen": city("#/city/shumen", "shumen")
};

export function catalogForSlug(slug: string): CatalogComponent[] {
  return CATALOG_BY_SLUG[slug] || HOME.map((c) => ({ ...c, id: `catalog:${slug}:${c.component_key}`, page_id: `catalog:${slug}` }));
}

/** Merge DB rows over catalog defaults (DB wins on same component_key). */
export function mergeCatalog(slug: string, fromDb: CmsComponent[]): CmsComponent[] {
  const base = catalogForSlug(slug);
  const map = new Map<string, CmsComponent>();
  for (const c of base) {
    map.set(c.component_key, {
      id: c.id,
      page_id: c.page_id,
      component_key: c.component_key,
      type: c.type,
      sort_order: c.sort_order,
      rect: c.rect,
      props: { ...c.props, _label: c.label, _hint: c.hint }
    });
  }
  for (const c of fromDb) {
    const prev = map.get(c.component_key);
    map.set(c.component_key, {
      ...c,
      props: { ...(prev?.props || {}), ...c.props },
      sort_order: c.sort_order ?? prev?.sort_order ?? 0
    });
  }
  return Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);
}
