import type { CmsComponent } from "./api";

/** Real site inventory mapped from desktop-home.html / bank / mobile + data-cms-* hooks. */
export type CatalogComponent = Omit<CmsComponent, "id" | "page_id"> & {
  id: string;
  page_id: string;
  label: string;
  hint?: string;
  /** Sidebar group for ruled / sectioned tree */
  section: string;
  /** Exploded parts shown in „Разглоби“ mode */
  parts?: PartDef[];
};

export type PartDef = {
  id: string;
  label: string;
  kind: "font" | "color" | "effect" | "size" | "image" | "shape" | "text" | "generic";
  propPath: string;
  defaults?: Record<string, unknown>;
};

const wine = "#710019";
const gold = "#bb7b16";
const cream = "#fff9f2";
const ink = "#6a001b";

function fontParts(prefix: string, selector: string): PartDef[] {
  return [
    { id: `${prefix}.font.family`, label: "Шрифт (family)", kind: "font", propPath: "font.family", defaults: { family: "Georgia, 'PT Serif', serif", selector } },
    { id: `${prefix}.font.size`, label: "Размер", kind: "size", propPath: "font.size", defaults: { size: "28px", selector } },
    { id: `${prefix}.font.weight`, label: "Тегло", kind: "font", propPath: "font.weight", defaults: { weight: "700", selector } },
    { id: `${prefix}.font.color`, label: "Цвят на текста", kind: "color", propPath: "font.color", defaults: { color: cream, selector } }
  ];
}

function headPanelParts(prefix: string, selector: string): PartDef[] {
  return [
    { id: `${prefix}.panel.color`, label: "Цвят на панела (head)", kind: "color", propPath: "panel.color", defaults: { color: wine, selector } },
    { id: `${prefix}.panel.effect`, label: "Ефект на панела", kind: "effect", propPath: "panel.effect", defaults: { effect: "drop-shadow", glow: "0 0 18px rgba(255,214,120,.35)", selector } },
    { id: `${prefix}.panel.height`, label: "Височина", kind: "size", propPath: "panel.height", defaults: { height: "198px", selector } }
  ];
}

function row(
  pageSlug: string,
  key: string,
  type: string,
  props: Record<string, unknown>,
  sort_order: number,
  label: string,
  section: string,
  hint?: string,
  parts?: PartDef[]
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
    hint,
    section,
    parts
  };
}

/** Desktop home — selectors from desktop-home.html (#stage / .hdr / .nav / .search / .card / .fd melt). */
const HOME: CatalogComponent[] = [
  row("/", "theme.wine", "color", { cssVar: "--wine", value: wine, label: "Brand wine" }, 0, "Brand wine (--wine)", "Тема / цветове", "Root CSS --wine from desktop-home.html"),
  row("/", "theme.gold", "color", { cssVar: "--gold", value: gold, label: "Accent gold" }, 1, "Accent gold (--gold)", "Тема / цветове"),
  row("/", "theme.gold-l", "color", { cssVar: "--gold-l", value: "#ffe17a", label: "Gold light" }, 2, "Gold light (--gold-l)", "Тема / цветове"),
  row("/", "theme.cream", "color", { cssVar: "--cream", value: cream, label: "Cream" }, 3, "Cream surface", "Тема / цветове"),
  row("/", "theme.ink", "color", { cssVar: "--ink", value: ink, label: "Ink" }, 4, "Ink / body", "Тема / цветове"),

  row(
    "/",
    "nav.header",
    "panel",
    {
      selector: ".hdr, header.abs.hdr",
      panel: { color: wine, effect: "drop-shadow", glow: "0 18px 40px rgba(40,0,10,.45)", height: "198px" },
      font: { family: "Georgia, 'PT Serif', serif", size: "28px", weight: "600", color: "#fff3e2" },
      label: "Header panel"
    },
    10,
    "Header / head panel (.hdr)",
    "Навигация",
    "Real header SVG panel + logo strip",
    [...headPanelParts("nav.header", ".hdr"), ...fontParts("nav.header", ".nav a, .nav button")]
  ),
  row(
    "/",
    "nav.logo",
    "image",
    { selector: ".logo img, a.logo img", url: "/mobile/crm/assets/logo.png", melt: false, fit: "contain", graphics: "logo" },
    11,
    "Logo (.logo img)",
    "Навигация",
    "desktop-home logo slot"
  ),
  row(
    "/",
    "nav.links",
    "shape",
    { shape: "pill", radius: "999px", selector: ".nav a, .nav button", label: "Nav links", font: { family: "Georgia, serif", size: "28px", weight: "600", color: "#fff3e2" } },
    12,
    "Nav links (.nav a)",
    "Навигация",
    "За продажба / Под наем / За нас",
    fontParts("nav.links", ".nav a, .nav button")
  ),
  row(
    "/",
    "nav.staff",
    "shape",
    { shape: "circle", radius: "999px", selector: ".nav .acc", label: "Staff login icon" },
    13,
    "Staff access (.nav .acc)",
    "Навигация"
  ),

  row(
    "/",
    "hero.stage",
    "section_height",
    { selector: "#stage, #cv", height: "900px", label: "Stage canvas" },
    20,
    "Stage (#stage)",
    "Hero / сцена",
    "Full desktop stage canvas"
  ),
  row(
    "/",
    "hero.bg",
    "image",
    { selector: "#stage .bg, .bg", url: "", melt: false, fit: "cover", graphics: "photo", label: "Panorama background" },
    21,
    "Background panorama (.bg)",
    "Hero / сцена"
  ),
  row(
    "/",
    "search.panel",
    "panel",
    {
      selector: ".search, form#sf",
      panel: { color: wine, effect: "soft-glow", glow: "0 0 22px rgba(255,214,130,.55)", height: "170px" },
      font: { family: "Georgia, serif", size: "22px", weight: "600", color: "#fff4e3" },
      label: "Search panel"
    },
    22,
    "Search panel (#sf)",
    "Търсене",
    "Real search SVG panel with city/hood/price/area",
    [...headPanelParts("search.panel", ".search"), ...fontParts("search.panel", ".search .t, .filt")]
  ),
  row(
    "/",
    "search.filters",
    "size",
    { selector: ".filt, #filt", width: "auto", height: "48px", scale: 1, padding: "0 8px" },
    23,
    "Filters button (#filt)",
    "Търсене"
  ),
  row(
    "/",
    "search.go",
    "shape",
    { shape: "rounded", radius: "16px", selector: ".go, button.go", label: "Търси CTA" },
    24,
    "Search CTA (.go)",
    "Търсене"
  ),

  row(
    "/",
    "city.cards",
    "shape",
    { shape: "soft", radius: "24px", selector: "a.card, .card", label: "City cards" },
    30,
    "City cards (.card)",
    "Градски карти",
    "Shumen / Varna / Burgas absolute cards",
    fontParts("city.cards", ".card h3, .card span")
  ),
  row(
    "/",
    "city.card.photo",
    "image",
    { selector: ".card .ph", url: "", melt: false, fit: "cover", graphics: "photo" },
    31,
    "City card photo (.card .ph)",
    "Градски карти"
  ),
  row(
    "/",
    "city.card.melt",
    "melt",
    { selector: ".card .fd", url: "", melt: true, intensity: 0.72, mode: "gradient", blend: "multiply" },
    32,
    "City card melt (.card .fd)",
    "Градски карти / melt",
    "Real fade melt overlay on city cards"
  ),
  row(
    "/",
    "city.card.pin",
    "graphics",
    { selector: ".card .pin", preset: "outline-gold", size: "38px", color: gold },
    33,
    "City pin icon (.card .pin)",
    "Градски карти"
  ),
  row(
    "/",
    "city.card.title",
    "text",
    {
      selector: ".card h3",
      font: { family: "Georgia, serif", size: "30px", weight: "700", color: ink },
      label: "City title"
    },
    34,
    "City title (.card h3)",
    "Градски карти",
    undefined,
    fontParts("city.card.title", ".card h3")
  ),

  row(
    "/",
    "about.modal",
    "panel",
    {
      selector: ".ab, #abX",
      panel: { color: wine, effect: "blur-glass", glow: "0 24px 60px rgba(30,0,8,.55)", height: "auto" },
      font: { family: "Georgia, serif", size: "22px", weight: "700", color: cream }
    },
    40,
    "About modal (.ab)",
    "За нас"
  ),
  row(
    "/",
    "menu.deals",
    "dropdown",
    {
      selector: ".nav",
      items: [
        { label: "За продажба", target: "deal.sale" },
        { label: "Под наем", target: "deal.rent" },
        { label: "За нас", target: "about" }
      ]
    },
    41,
    "Deal menu builder",
    "Навигация"
  )
];

const BANK: CatalogComponent[] = [
  row("/bank/", "bank.theme.wine", "color", { cssVar: "--wine", value: wine }, 0, "Bank wine", "Тема"),
  row("/bank/", "bank.theme.accent", "color", { cssVar: "--bank-accent", value: "#e30613" }, 1, "Active bank hex", "Тема"),
  row(
    "/bank/",
    "bank.hero",
    "panel",
    {
      selector: ".hero, .lux, .storefront, [data-cms-slug='/bank/'] main",
      panel: { color: "#0e1a2b", effect: "night-glow", glow: "0 0 40px rgba(227,6,19,.35)", height: "420px" },
      font: { family: "Georgia, serif", size: "32px", weight: "700", color: cream }
    },
    10,
    "Storefront / hero panel",
    "Hero / storefront",
    "Luxury night storefront header",
    [...headPanelParts("bank.hero", ".hero, .lux"), ...fontParts("bank.hero", ".hero h1, .lux h1")]
  ),
  row("/bank/", "bank.card.shape", "shape", { shape: "soft", radius: "28px", selector: ".bank-card, .lux-card, .card" }, 20, "Bank cards", "Банкови карти"),
  row("/bank/", "bank.dsk.image", "image", { selector: "[data-bank='dsk'] img, .bank-dsk, img[alt*='ДСК'], img[alt*='DSK']", url: "/bank/assets/image-1.png", melt: false, fit: "cover" }, 21, "ДСК luxury image", "Банкови карти"),
  row("/bank/", "bank.ubb.image", "image", { selector: "[data-bank='ubb'] img, .bank-ubb, img[alt*='ОББ'], img[alt*='UBB']", url: "/bank/assets/image-2.jpg", melt: false, fit: "cover" }, 22, "ОББ luxury image", "Банкови карти"),
  row("/bank/", "bank.melt", "melt", { selector: ".lux-melt, .bank-melt, .card .fd", url: "", melt: true, intensity: 0.65, mode: "vignette", blend: "soft-light" }, 23, "Bank melt overlay", "Melt"),
  row("/bank/", "bank.rate.panel", "size", { selector: ".rates, .rate-panel, [data-rates]", width: "100%", height: "220px", scale: 1, padding: "16px" }, 30, "Rates panel", "Лихви")
];

const MOBILE: CatalogComponent[] = [
  row("/mobile/", "mobile.theme.wine", "color", { cssVar: "--wine", value: wine }, 0, "Mobile wine", "Тема"),
  row(
    "/mobile/",
    "mobile.header",
    "panel",
    {
      selector: "header, .top, .nd-top",
      panel: { color: wine, effect: "drop-shadow", glow: "0 8px 24px rgba(40,0,10,.4)", height: "72px" },
      font: { family: "'Roboto Condensed', system-ui", size: "18px", weight: "700", color: cream }
    },
    10,
    "Mobile header",
    "Навигация",
    undefined,
    [...headPanelParts("mobile.header", "header, .top"), ...fontParts("mobile.header", "header, .top")]
  ),
  row("/mobile/", "mobile.cards", "shape", { shape: "rounded", radius: "18px", selector: ".card, .listing, .nd-card" }, 20, "Listing cards", "Карти"),
  row("/mobile/", "mobile.hero.melt", "melt", { selector: ".hero, .melt, .fd", url: "", melt: true, intensity: 0.55, mode: "gradient", blend: "multiply" }, 21, "Mobile melt", "Melt"),
  row("/mobile/", "mobile.nav", "dropdown", { selector: "nav, .nav", items: [{ label: "Начало", target: "home" }, { label: "Каталог", target: "catalog" }, { label: "Банка", target: "bank" }] }, 30, "Mobile nav builder", "Навигация")
];

function city(slug: string, name: string, label: string): CatalogComponent[] {
  return [
    row(slug, `${name}.theme`, "color", { cssVar: "--wine", value: wine }, 0, `${label} brand`, "Тема"),
    row(
      slug,
      `${name}.hero`,
      "panel",
      {
        selector: ".city-hero, .hero, .panel, .terrace-hero, [data-city]",
        panel: { color: wine, effect: "photo-bleed", glow: "0 0 28px rgba(201,146,46,.4)", height: "360px" },
        font: { family: "Georgia, serif", size: "34px", weight: "700", color: cream }
      },
      10,
      `${label} hero / head`,
      "Hero",
      `City hash ${slug}`,
      [...headPanelParts(`${name}.hero`, ".city-hero, .hero"), ...fontParts(`${name}.hero`, ".city-hero h1, .hero h1")]
    ),
    row(slug, `${name}.quarters`, "shape", { shape: "soft", radius: "22px", selector: ".quarter, .q-card, .card, .hood-card" }, 20, "Quarter cards", "Квартали"),
    row(slug, `${name}.photo`, "image", { selector: ".quarter .ph, .q-card .ph, .card .ph, .hood-card img", url: "", melt: false, fit: "cover", graphics: "photo" }, 21, "Quarter photos", "Квартали"),
    row(slug, `${name}.melt`, "melt", { selector: ".quarter .fd, .melt, .card .fd", url: "", melt: true, intensity: 0.7, mode: "gradient", blend: "multiply" }, 22, "Quarter melt", "Melt"),
    row(slug, `${name}.map`, "graphics", { selector: ".map, .city-map, svg.map, .small-map", preset: "outline-gold", size: "100%", color: gold }, 30, "City map graphic", "Карта"),
    row(slug, `${name}.menu`, "dropdown", { items: [{ label: "Квартали", target: "quarters" }, { label: "Карта", target: "map" }] }, 40, "City menu", "Навигация")
  ];
}

export const CATALOG_BY_SLUG: Record<string, CatalogComponent[]> = {
  "/": HOME,
  "/bank/": BANK,
  "/mobile/": MOBILE,
  "#/city/burgas": city("#/city/burgas", "burgas", "Бургас"),
  "#/city/varna": city("#/city/varna", "varna", "Варна"),
  "#/city/shumen": city("#/city/shumen", "shumen", "Шумен")
};

export const SECTION_ORDER = [
  "Тема / цветове",
  "Тема",
  "Навигация",
  "Hero / сцена",
  "Hero",
  "Hero / storefront",
  "Търсене",
  "Градски карти",
  "Градски карти / melt",
  "Квартали",
  "Банкови карти",
  "Карти",
  "Melt",
  "Лихви",
  "Карта",
  "За нас"
];

export function catalogForSlug(slug: string): CatalogComponent[] {
  return (
    CATALOG_BY_SLUG[slug] ||
    HOME.map((c) => ({
      ...c,
      id: `catalog:${slug}:${c.component_key}`,
      page_id: `catalog:${slug}`
    }))
  );
}

export function groupComponents(list: CmsComponent[]): { section: string; items: CmsComponent[] }[] {
  const buckets = new Map<string, CmsComponent[]>();
  for (const c of list) {
    const section =
      (typeof c.props?._section === "string" && c.props._section) ||
      "Компоненти";
    if (!buckets.has(section)) buckets.set(section, []);
    buckets.get(section)!.push(c);
  }
  const ordered: { section: string; items: CmsComponent[] }[] = [];
  const seen = new Set<string>();
  for (const s of SECTION_ORDER) {
    if (buckets.has(s)) {
      ordered.push({ section: s, items: buckets.get(s)! });
      seen.add(s);
    }
  }
  for (const [s, items] of buckets) {
    if (!seen.has(s)) ordered.push({ section: s, items });
  }
  return ordered;
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
      props: {
        ...c.props,
        _label: c.label,
        _hint: c.hint,
        _section: c.section,
        _parts: c.parts || []
      }
    });
  }
  for (const c of fromDb) {
    const prev = map.get(c.component_key);
    map.set(c.component_key, {
      ...c,
      props: {
        ...(prev?.props || {}),
        ...c.props,
        _section: c.props?._section || prev?.props?._section,
        _parts: c.props?._parts || prev?.props?._parts,
        _label: c.props?._label || prev?.props?._label
      },
      sort_order: c.sort_order ?? prev?.sort_order ?? 0
    });
  }
  return Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);
}
