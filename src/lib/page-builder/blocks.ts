/**
 * Block registry — describes every drag/drop component available in the page builder.
 * Each block has: type id, label, category, default props, list of editable props (with control type),
 * and a React renderer.
 */
export type ControlType =
  | "text"
  | "textarea"
  | "color"
  | "number"
  | "select"
  | "url";

export interface PropControl {
  key: string;
  label: string;
  type: ControlType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

export interface BlockDef {
  type: string;
  label: string;
  category:
    | "navbar"
    | "hero"
    | "button"
    | "section"
    | "footer"
    | "cards"
    | "form"
    | "gallery"
    | "cta";
  defaults: Record<string, any>;
  controls: PropControl[];
  /** Optional emoji/icon shown in the library list */
  emoji?: string;
}

const colorControl = (key: string, label: string): PropControl => ({
  key,
  label,
  type: "color",
});
const textControl = (key: string, label: string): PropControl => ({
  key,
  label,
  type: "text",
});

export const BLOCK_REGISTRY: BlockDef[] = [
  // ----------------- NAVBARS -----------------
  {
    type: "navbar.simple",
    label: "Навбар — Прост",
    category: "navbar",
    emoji: "🧭",
    defaults: {
      brand: "Имоти Надежда",
      links: "Начало | Имоти | За нас | Контакти",
      bg: "#ffffff",
      fg: "#2b1418",
      accent: "#8B1A2B",
      sticky: true,
    },
    controls: [
      textControl("brand", "Име"),
      { key: "links", label: "Линкове (разделени с |)", type: "text" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },
  {
    type: "navbar.centered",
    label: "Навбар — Центриран",
    category: "navbar",
    emoji: "🎯",
    defaults: {
      brand: "Имоти Надежда",
      links: "Имоти | За нас | Брокери | Контакти",
      bg: "#8B1A2B",
      fg: "#ffffff",
      accent: "#C9A84C",
    },
    controls: [
      textControl("brand", "Име"),
      { key: "links", label: "Линкове", type: "text" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },
  {
    type: "navbar.split",
    label: "Навбар — Разделен (лого вляво, бутон вдясно)",
    category: "navbar",
    emoji: "↔️",
    defaults: {
      brand: "Имоти Надежда",
      links: "Имоти | За нас | Контакти",
      ctaLabel: "Свържи се",
      bg: "#ffffff",
      fg: "#2b1418",
      accent: "#8B1A2B",
    },
    controls: [
      textControl("brand", "Име"),
      { key: "links", label: "Линкове", type: "text" },
      textControl("ctaLabel", "Бутон текст"),
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },
  {
    type: "navbar.transparent",
    label: "Навбар — Прозрачен",
    category: "navbar",
    emoji: "👻",
    defaults: {
      brand: "Имоти Надежда",
      links: "Имоти | За нас | Контакти",
      fg: "#ffffff",
      accent: "#C9A84C",
    },
    controls: [
      textControl("brand", "Име"),
      { key: "links", label: "Линкове", type: "text" },
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },
  {
    type: "navbar.dark",
    label: "Навбар — Тъмен",
    category: "navbar",
    emoji: "🌑",
    defaults: {
      brand: "Имоти Надежда",
      links: "Имоти | За нас | Контакти",
      bg: "#1a0a0e",
      fg: "#f5e8d0",
      accent: "#C9A84C",
    },
    controls: [
      textControl("brand", "Име"),
      { key: "links", label: "Линкове", type: "text" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },

  // ----------------- HEROES -----------------
  {
    type: "hero.center",
    label: "Hero — Централно заглавие",
    category: "hero",
    emoji: "🏛️",
    defaults: {
      eyebrow: "ИМОТИ НАДЕЖДА",
      title: "Намери дома на твоите мечти",
      subtitle: "Над 1000 актуални оферти в София и страната.",
      ctaLabel: "Разгледай имотите",
      ctaHref: "/search",
      bg: "#8B1A2B",
      fg: "#ffffff",
      accent: "#C9A84C",
      bgImage: "",
      height: 600,
    },
    controls: [
      textControl("eyebrow", "Малък надпис"),
      textControl("title", "Заглавие"),
      { key: "subtitle", label: "Подзаглавие", type: "textarea" },
      textControl("ctaLabel", "Бутон"),
      { key: "ctaHref", label: "Линк на бутона", type: "url" },
      { key: "bgImage", label: "Снимка URL", type: "url" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
      { key: "height", label: "Височина (px)", type: "number", min: 200, max: 1200 },
    ],
  },
  {
    type: "hero.split",
    label: "Hero — Разделен (текст / снимка)",
    category: "hero",
    emoji: "🪟",
    defaults: {
      title: "Луксозни имоти в София",
      subtitle: "Внимателно подбрани предложения за взискателни клиенти.",
      ctaLabel: "Виж имотите",
      ctaHref: "/search",
      imageUrl: "",
      bg: "#fbf6ea",
      fg: "#2b1418",
      accent: "#8B1A2B",
    },
    controls: [
      textControl("title", "Заглавие"),
      { key: "subtitle", label: "Подзаглавие", type: "textarea" },
      textControl("ctaLabel", "Бутон"),
      { key: "ctaHref", label: "Линк", type: "url" },
      { key: "imageUrl", label: "Снимка URL", type: "url" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },
  {
    type: "hero.minimal",
    label: "Hero — Минимален",
    category: "hero",
    emoji: "▫️",
    defaults: {
      title: "Имоти Надежда",
      subtitle: "Доверие. Опит. Резултати.",
      bg: "#ffffff",
      fg: "#2b1418",
    },
    controls: [
      textControl("title", "Заглавие"),
      textControl("subtitle", "Подзаглавие"),
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
    ],
  },
  {
    type: "hero.video",
    label: "Hero — С видео фон (placeholder)",
    category: "hero",
    emoji: "🎬",
    defaults: {
      title: "Открий своя нов дом",
      subtitle: "Безплатна консултация с професионален брокер.",
      ctaLabel: "Започни",
      ctaHref: "/contact",
      bg: "#1a0a0e",
      fg: "#ffffff",
      accent: "#C9A84C",
    },
    controls: [
      textControl("title", "Заглавие"),
      textControl("subtitle", "Подзаглавие"),
      textControl("ctaLabel", "Бутон"),
      { key: "ctaHref", label: "Линк", type: "url" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },

  // ----------------- BUTTONS -----------------
  ...[
    { type: "button.solid", label: "Бутон — Solid", emoji: "🔴" },
    { type: "button.outline", label: "Бутон — Outline", emoji: "⭕" },
    { type: "button.ghost", label: "Бутон — Ghost", emoji: "👁️" },
    { type: "button.gradient", label: "Бутон — Градиент", emoji: "🌈" },
    { type: "button.pill", label: "Бутон — Pill", emoji: "💊" },
    { type: "button.square", label: "Бутон — Square", emoji: "⬛" },
    { type: "button.icon", label: "Бутон — С иконка", emoji: "✨" },
    { type: "button.large", label: "Бутон — Голям", emoji: "🔵" },
  ].map(
    (b): BlockDef => ({
      type: b.type,
      label: b.label,
      category: "button",
      emoji: b.emoji,
      defaults: {
        label: "Натисни",
        href: "/contact",
        bg: "#8B1A2B",
        fg: "#ffffff",
        radius: b.type === "button.pill" ? 999 : b.type === "button.square" ? 0 : 8,
        size: b.type === "button.large" ? 18 : 14,
      },
      controls: [
        textControl("label", "Текст"),
        { key: "href", label: "Линк", type: "url" },
        colorControl("bg", "Фон"),
        colorControl("fg", "Текст"),
        { key: "radius", label: "Заобляне (px)", type: "number", min: 0, max: 999 },
        { key: "size", label: "Размер шрифт", type: "number", min: 10, max: 32 },
      ],
    }),
  ),

  // ----------------- SECTIONS -----------------
  {
    type: "section.text",
    label: "Секция — Текстов блок",
    category: "section",
    emoji: "📝",
    defaults: {
      title: "За нас",
      body: "Имоти Надежда е водеща агенция за недвижими имоти в България.",
      bg: "#ffffff",
      fg: "#2b1418",
      align: "left",
    },
    controls: [
      textControl("title", "Заглавие"),
      { key: "body", label: "Текст", type: "textarea" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      {
        key: "align",
        label: "Подравняване",
        type: "select",
        options: [
          { value: "left", label: "Ляво" },
          { value: "center", label: "Център" },
          { value: "right", label: "Дясно" },
        ],
      },
    ],
  },
  {
    type: "section.features",
    label: "Секция — 3 предимства",
    category: "section",
    emoji: "✨",
    defaults: {
      title: "Защо да изберете нас",
      f1: "Опит | Над 15 години на пазара",
      f2: "Доверие | 1000+ доволни клиенти",
      f3: "Резултат | Бързи и сигурни сделки",
      bg: "#fbf6ea",
      fg: "#2b1418",
      accent: "#8B1A2B",
    },
    controls: [
      textControl("title", "Заглавие"),
      { key: "f1", label: "Предимство 1 (заглавие | описание)", type: "text" },
      { key: "f2", label: "Предимство 2", type: "text" },
      { key: "f3", label: "Предимство 3", type: "text" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },
  {
    type: "section.stats",
    label: "Секция — Статистики",
    category: "section",
    emoji: "📊",
    defaults: {
      stats: "1000+ | Имоти || 15 | Години опит || 50+ | Брокери || 5000+ | Клиенти",
      bg: "#8B1A2B",
      fg: "#ffffff",
      accent: "#C9A84C",
    },
    controls: [
      { key: "stats", label: "Статистики (X | Label || ...)", type: "textarea" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },
  {
    type: "section.cta",
    label: "Секция — CTA банер",
    category: "cta",
    emoji: "📣",
    defaults: {
      title: "Готов ли си да намериш дома си?",
      subtitle: "Свържи се с нас днес — безплатна консултация.",
      ctaLabel: "Свържи се",
      ctaHref: "/contact",
      bg: "#C9A84C",
      fg: "#2b1418",
      accent: "#8B1A2B",
    },
    controls: [
      textControl("title", "Заглавие"),
      { key: "subtitle", label: "Подзаглавие", type: "textarea" },
      textControl("ctaLabel", "Бутон"),
      { key: "ctaHref", label: "Линк", type: "url" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },

  // ----------------- CARDS -----------------
  {
    type: "cards.three",
    label: "Карти — 3 в ред",
    category: "cards",
    emoji: "🃏",
    defaults: {
      title: "Топ оферти",
      c1: "София | 2-стаен, центъра | €120 000",
      c2: "Пловдив | 3-стаен, нов | €95 000",
      c3: "Варна | Къща с двор | €240 000",
      bg: "#ffffff",
      fg: "#2b1418",
      accent: "#8B1A2B",
    },
    controls: [
      textControl("title", "Заглавие"),
      { key: "c1", label: "Карта 1 (град | описание | цена)", type: "text" },
      { key: "c2", label: "Карта 2", type: "text" },
      { key: "c3", label: "Карта 3", type: "text" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },

  // ----------------- FORMS -----------------
  {
    type: "form.contact",
    label: "Форма — Контакти",
    category: "form",
    emoji: "📧",
    defaults: {
      title: "Свържи се с нас",
      ctaLabel: "Изпрати",
      bg: "#fbf6ea",
      fg: "#2b1418",
      accent: "#8B1A2B",
    },
    controls: [
      textControl("title", "Заглавие"),
      textControl("ctaLabel", "Бутон"),
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },

  // ----------------- GALLERY -----------------
  {
    type: "gallery.grid",
    label: "Галерия — Grid (6 снимки)",
    category: "gallery",
    emoji: "🖼️",
    defaults: {
      title: "Нашите имоти",
      images:
        "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600 || https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600 || https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600 || https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600 || https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600 || https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600",
      bg: "#ffffff",
      fg: "#2b1418",
    },
    controls: [
      textControl("title", "Заглавие"),
      { key: "images", label: "URL-и (разделени с ||)", type: "textarea" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
    ],
  },

  // ----------------- FOOTERS -----------------
  {
    type: "footer.simple",
    label: "Footer — Прост",
    category: "footer",
    emoji: "⬇️",
    defaults: {
      brand: "Имоти Надежда",
      tagline: "© 2026 Всички права запазени.",
      bg: "#1a0a0e",
      fg: "#f5e8d0",
    },
    controls: [
      textControl("brand", "Име"),
      textControl("tagline", "Текст"),
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
    ],
  },
  {
    type: "footer.columns",
    label: "Footer — 3 колони",
    category: "footer",
    emoji: "⬇️",
    defaults: {
      brand: "Имоти Надежда",
      col1: "Меню | Начало, Имоти, За нас, Контакти",
      col2: "Контакти | гр. Шумен; 0899 620 262",
      col3: "Социални | Facebook, Instagram, YouTube",
      bg: "#8B1A2B",
      fg: "#ffffff",
      accent: "#C9A84C",
    },
    controls: [
      textControl("brand", "Име"),
      { key: "col1", label: "Колона 1 (заглавие | елементи)", type: "text" },
      { key: "col2", label: "Колона 2", type: "text" },
      { key: "col3", label: "Колона 3", type: "text" },
      colorControl("bg", "Фон"),
      colorControl("fg", "Текст"),
      colorControl("accent", "Акцент"),
    ],
  },
];

export const BLOCKS_BY_TYPE = new Map(BLOCK_REGISTRY.map((b) => [b.type, b]));

export function getBlockDef(type: string): BlockDef | undefined {
  return BLOCKS_BY_TYPE.get(type);
}

export interface BlockInstance {
  id: string;
  type: string;
  props: Record<string, any>;
}

export interface PageLayout {
  blocks: BlockInstance[];
  theme?: Record<string, string>;
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createBlockInstance(type: string): BlockInstance {
  const def = getBlockDef(type);
  return {
    id: makeId(),
    type,
    props: def ? { ...def.defaults } : {},
  };
}

export const CATEGORY_LABELS: Record<BlockDef["category"], string> = {
  navbar: "Навбари",
  hero: "Hero секции",
  button: "Бутони",
  section: "Секции",
  cta: "Призиви",
  cards: "Карти",
  form: "Форми",
  gallery: "Галерии",
  footer: "Footer",
};
