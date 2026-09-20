// Типове за настройките „на страница“ в CRM (зъбното колело долу вдясно).
// Пазят се в public.crm_page_customizations.settings (jsonb).

export type CustomBlockType = "text" | "heading" | "note" | "image" | "button" | "card" | "shape";

/** Вложено съдържание в поставена форма (компонент в компонента). */
export type BlockChild = {
  id: string;
  type: "heading" | "text" | "button" | "image";
  text?: string;
  url?: string;
  href?: string;
  color?: string;
};

export type CustomBlock = {
  id: string;
  type: CustomBlockType;
  text?: string;
  url?: string;
  href?: string;
  width?: BlockWidth;
  /** Форма от каталога (`src/lib/crm-shapes.ts`), когато type === "shape". */
  shapeId?: string;
  /** Свободно позициониране (в % от страницата) и размер (в % от ширината). */
  x?: number;
  y?: number;
  w?: number;
  /** Височина в px. */
  h?: number;
  rotate?: number;
  z?: number;
  /** Пази качената снимка вътре във формата (иначе е плътна маска). */
  keepImage?: boolean;
  /** Цвят на маската, когато снимката не се пази. */
  fill?: string;
  children?: BlockChild[];
};

export type BlockWidth = "third" | "half" | "full";

export type BlockOverride = {
  order?: number;
  width?: BlockWidth;
  height?: number | null;
  hidden?: boolean;
  scale?: number;
  /** Избрана форма от каталога (`src/lib/crm-shapes.ts`). */
  shape?: string;
  /** Фина настройка на радиуса (px) върху избраната форма. */
  radius?: number;
  /** Пропорция, напр. „1/1“, „16/9“. */
  ratio?: string;
};

export type PageSettings = {
  colors: {
    panel: string;
    text: string;
    heading: string;
    border: string;
    accent: string;
    accentText: string;
    optionText: string;
  };
  fonts: {
    heading: string;
    body: string;
    sizeBase: number;
    radius: number;
  };
  bg: {
    url: string | null;
    blur: number;
    dim: number;
    position: "center" | "top" | "bottom";
    repeat: boolean;
    /** Увеличение на видимата част в проценти (100 = „cover“). */
    zoom: number;
    /** Хоризонтална позиция 0–100%. */
    posX: number;
    /** Вертикална позиция 0–100%. */
    posY: number;
    fit: "cover" | "contain" | "repeat";
  };
  /** Грубост на четковите ръбове в CRM (0 = без, 3 = силно). */
  brush: { intensity: BrushIntensity };
  blocks: Record<string, BlockOverride>;
  custom: CustomBlock[];
};

export type BrushIntensity = 0 | 1 | 2 | 3;

export const BRUSH_KEYS: Record<BrushIntensity, string> = {
  0: "none",
  1: "light",
  2: "medium",
  3: "strong",
};

export const BRUSH_LABELS: Record<BrushIntensity, string> = {
  0: "Без",
  1: "Леко",
  2: "Средно",
  3: "Силно",
};

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  colors: {
    panel: "#fffbf3",
    text: "#2a0a10",
    heading: "#8B1A2B",
    border: "#e8d9b8",
    accent: "#8B1A2B",
    accentText: "#fdf7ee",
    optionText: "#3a1218",
  },
  fonts: {
    heading: "Playfair Display",
    body: "Open Sans",
    sizeBase: 16,
    radius: 16,
  },
  bg: {
    url: null,
    blur: 0,
    dim: 0,
    position: "center",
    repeat: false,
    zoom: 100,
    posX: 50,
    posY: 50,
    fit: "cover",
  },
  brush: { intensity: 2 },
  blocks: {},
  custom: [],
};

export const FONT_CHOICES = [
  "Playfair Display",
  "Cormorant Garamond",
  "Open Sans",
  "Manrope",
  "Inter",
  "Montserrat",
  "Roboto",
  "Poppins",
] as const;

/** Дълбоко сливане на записаните настройки върху подразбиращите се. */
export function mergeSettings(raw: unknown): PageSettings {
  const src = (raw ?? {}) as Partial<PageSettings>;
  return {
    colors: { ...DEFAULT_PAGE_SETTINGS.colors, ...(src.colors ?? {}) },
    fonts: { ...DEFAULT_PAGE_SETTINGS.fonts, ...(src.fonts ?? {}) },
    bg: { ...DEFAULT_PAGE_SETTINGS.bg, ...(src.bg ?? {}) },
    brush: { ...DEFAULT_PAGE_SETTINGS.brush, ...(src.brush ?? {}) },
    blocks: { ...(src.blocks ?? {}) },
    custom: Array.isArray(src.custom) ? src.custom : [],
  };
}

/** Ключ на страница: `/admin/clients` → `admin/clients` */
export function pageKeyFromPath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\/+$/, "") || "admin";
}

export const WIDTH_LABEL: Record<BlockWidth, string> = {
  third: "1/3",
  half: "1/2",
  full: "Цяла",
};

export const WIDTH_CSS: Record<BlockWidth, string> = {
  third: "33.333%",
  half: "50%",
  full: "100%",
};
