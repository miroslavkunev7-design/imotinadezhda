/**
 * Каталог с форми за CRM блоковете (над 200 форми).
 *
 * Всяка форма е чист CSS — `borderRadius`, `clipPath` или `maskImage` —
 * така че се прилага върху всеки блок: таблица, карта, KPI поле, панел.
 * Формите се пазят в настройките на страницата (`blocks[key].shape`).
 */
import type { BlockOverride } from "@/lib/crm-page-settings/types";

export type ShapeCategory = "rect" | "round" | "clip" | "brush" | "custom";

export type CrmShape = {
  id: string;
  name: string;
  category: ShapeCategory;
  borderRadius?: string;
  clipPath?: string;
  maskImage?: string;
  /** Оригиналната снимка (когато формата е качена със „пази снимката“). */
  imageUrl?: string;
};

export const SHAPE_CATEGORY_LABELS: Record<ShapeCategory, string> = {
  rect: "Правоъгълни / квадратни",
  round: "Заоблени и капсули",
  clip: "Изрязани форми",
  brush: "Четкови от сайта",
  custom: "Мои форми (от снимка)",
};

/** Пропорции, които се комбинират с всяка форма. */
export const SHAPE_RATIOS = ["auto", "1/1", "4/3", "3/2", "16/9", "2/1", "3/4", "9/16"] as const;

const RADII = [0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64];

const CORNER_SETS: Array<{
  key: string;
  label: string;
  mask: [boolean, boolean, boolean, boolean];
}> = [
  { key: "all", label: "всички ъгли", mask: [true, true, true, true] },
  { key: "top", label: "горе", mask: [true, true, false, false] },
  { key: "bottom", label: "долу", mask: [false, false, true, true] },
  { key: "left", label: "вляво", mask: [true, false, false, true] },
  { key: "right", label: "вдясно", mask: [false, true, true, false] },
  { key: "diag1", label: "диагонал ↘", mask: [true, false, true, false] },
  { key: "diag2", label: "диагонал ↙", mask: [false, true, false, true] },
  { key: "tl", label: "горе вляво", mask: [true, false, false, false] },
  { key: "tr", label: "горе вдясно", mask: [false, true, false, false] },
  { key: "br", label: "долу вдясно", mask: [false, false, true, false] },
  { key: "bl", label: "долу вляво", mask: [false, false, false, true] },
];

function radiusShapes(): CrmShape[] {
  const out: CrmShape[] = [];
  for (const corner of CORNER_SETS) {
    for (const r of RADII) {
      const parts = corner.mask.map((on) => (on ? `${r}px` : "0px")).join(" ");
      out.push({
        id: `rect-${corner.key}-${r}`,
        name: r === 0 ? `Прав ъгъл (${corner.label})` : `Радиус ${r}px — ${corner.label}`,
        category: r === 0 || r >= 40 ? "round" : "rect",
        borderRadius: parts,
      });
    }
  }
  return out;
}

const ROUND_SHAPES: CrmShape[] = [
  { id: "round-pill", name: "Капсула (pill)", category: "round", borderRadius: "999px" },
  {
    id: "round-stadium-x",
    name: "Стадион по хоризонтала",
    category: "round",
    borderRadius: "50% / 22%",
  },
  {
    id: "round-stadium-y",
    name: "Стадион по вертикала",
    category: "round",
    borderRadius: "22% / 50%",
  },
  { id: "round-circle", name: "Кръг / овал", category: "round", borderRadius: "50%" },
  { id: "round-leaf", name: "Лист", category: "round", borderRadius: "60% 6px 60% 6px" },
  { id: "round-leaf-2", name: "Лист обърнат", category: "round", borderRadius: "6px 60% 6px 60%" },
  { id: "round-drop", name: "Капка", category: "round", borderRadius: "50% 50% 50% 6px" },
  {
    id: "round-drop-2",
    name: "Капка обърната",
    category: "round",
    borderRadius: "50% 50% 6px 50%",
  },
  {
    id: "round-egg",
    name: "Яйце",
    category: "round",
    borderRadius: "50% 50% 45% 45% / 60% 60% 40% 40%",
  },
  { id: "round-arch", name: "Арка", category: "round", borderRadius: "999px 999px 12px 12px" },
  {
    id: "round-arch-down",
    name: "Обърната арка",
    category: "round",
    borderRadius: "12px 12px 999px 999px",
  },
  {
    id: "round-blob-1",
    name: "Петно 1",
    category: "round",
    borderRadius: "62% 38% 46% 54% / 54% 46% 54% 46%",
  },
  {
    id: "round-blob-2",
    name: "Петно 2",
    category: "round",
    borderRadius: "38% 62% 63% 37% / 41% 44% 56% 59%",
  },
  {
    id: "round-blob-3",
    name: "Петно 3",
    category: "round",
    borderRadius: "58% 42% 33% 67% / 61% 39% 61% 39%",
  },
  {
    id: "round-blob-4",
    name: "Петно 4",
    category: "round",
    borderRadius: "70% 30% 30% 70% / 60% 40% 60% 40%",
  },
  {
    id: "round-blob-5",
    name: "Петно 5",
    category: "round",
    borderRadius: "44% 56% 68% 32% / 32% 63% 37% 68%",
  },
  { id: "round-squircle", name: "Squircle", category: "round", borderRadius: "30% / 30%" },
  {
    id: "round-ticket-soft",
    name: "Мек билет",
    category: "round",
    borderRadius: "24px 8px 24px 8px",
  },
];

const CLIP_SHAPES: CrmShape[] = [
  { id: "clip-square", name: "Точен квадрат", category: "clip", clipPath: "inset(0)" },
  {
    id: "clip-bevel-8",
    name: "Скосени ъгли 8px",
    category: "clip",
    clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
  },
  {
    id: "clip-bevel-16",
    name: "Скосени ъгли 16px",
    category: "clip",
    clipPath:
      "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)",
  },
  {
    id: "clip-bevel-all-12",
    name: "Скосени 4 ъгъла 12px",
    category: "clip",
    clipPath:
      "polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)",
  },
  {
    id: "clip-bevel-all-24",
    name: "Скосени 4 ъгъла 24px",
    category: "clip",
    clipPath:
      "polygon(24px 0, calc(100% - 24px) 0, 100% 24px, 100% calc(100% - 24px), calc(100% - 24px) 100%, 24px 100%, 0 calc(100% - 24px), 0 24px)",
  },
  {
    id: "clip-diamond",
    name: "Ромб",
    category: "clip",
    clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
  },
  {
    id: "clip-hexagon",
    name: "Шестоъгълник",
    category: "clip",
    clipPath: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)",
  },
  {
    id: "clip-hexagon-v",
    name: "Шестоъгълник вертикален",
    category: "clip",
    clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
  },
  {
    id: "clip-octagon",
    name: "Осмоъгълник",
    category: "clip",
    clipPath: "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)",
  },
  {
    id: "clip-chevron-right",
    name: "Шеврон надясно",
    category: "clip",
    clipPath: "polygon(0 0, 88% 0, 100% 50%, 88% 100%, 0 100%, 12% 50%)",
  },
  {
    id: "clip-chevron-left",
    name: "Шеврон наляво",
    category: "clip",
    clipPath: "polygon(12% 0, 100% 0, 88% 50%, 100% 100%, 12% 100%, 0 50%)",
  },
  {
    id: "clip-arrow-right",
    name: "Стрелка надясно",
    category: "clip",
    clipPath: "polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%)",
  },
  {
    id: "clip-arrow-left",
    name: "Стрелка наляво",
    category: "clip",
    clipPath: "polygon(18% 0, 100% 0, 100% 100%, 18% 100%, 0 50%)",
  },
  {
    id: "clip-tag",
    name: "Етикет",
    category: "clip",
    clipPath: "polygon(0 0, 92% 0, 100% 50%, 92% 100%, 0 100%)",
  },
  {
    id: "clip-ribbon",
    name: "Панделка",
    category: "clip",
    clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 86%, 0 100%)",
  },
  {
    id: "clip-shield",
    name: "Щит",
    category: "clip",
    clipPath: "polygon(0 0, 100% 0, 100% 68%, 50% 100%, 0 68%)",
  },
  {
    id: "clip-trapeze",
    name: "Трапец",
    category: "clip",
    clipPath: "polygon(8% 0, 92% 0, 100% 100%, 0 100%)",
  },
  {
    id: "clip-trapeze-down",
    name: "Обърнат трапец",
    category: "clip",
    clipPath: "polygon(0 0, 100% 0, 92% 100%, 8% 100%)",
  },
  {
    id: "clip-parallel",
    name: "Паралелограм",
    category: "clip",
    clipPath: "polygon(6% 0, 100% 0, 94% 100%, 0 100%)",
  },
  {
    id: "clip-parallel-rev",
    name: "Паралелограм обратен",
    category: "clip",
    clipPath: "polygon(0 0, 94% 0, 100% 100%, 6% 100%)",
  },
  {
    id: "clip-cut-tl",
    name: "Отрязан горе вляво",
    category: "clip",
    clipPath: "polygon(18% 0, 100% 0, 100% 100%, 0 100%, 0 12%)",
  },
  {
    id: "clip-cut-tr",
    name: "Отрязан горе вдясно",
    category: "clip",
    clipPath: "polygon(0 0, 82% 0, 100% 12%, 100% 100%, 0 100%)",
  },
  {
    id: "clip-cut-br",
    name: "Отрязан долу вдясно",
    category: "clip",
    clipPath: "polygon(0 0, 100% 0, 100% 88%, 82% 100%, 0 100%)",
  },
  {
    id: "clip-cut-bl",
    name: "Отрязан долу вляво",
    category: "clip",
    clipPath: "polygon(0 0, 100% 0, 100% 100%, 18% 100%, 0 88%)",
  },
  {
    id: "clip-ticket",
    name: "Билет с прорези",
    category: "clip",
    clipPath:
      "polygon(0 0, 100% 0, 100% 40%, 96% 50%, 100% 60%, 100% 100%, 0 100%, 0 60%, 4% 50%, 0 40%)",
  },
  {
    id: "clip-zigzag-bottom",
    name: "Зигзаг долу",
    category: "clip",
    clipPath:
      "polygon(0 0, 100% 0, 100% 92%, 90% 100%, 80% 92%, 70% 100%, 60% 92%, 50% 100%, 40% 92%, 30% 100%, 20% 92%, 10% 100%, 0 92%)",
  },
  {
    id: "clip-zigzag-top",
    name: "Зигзаг горе",
    category: "clip",
    clipPath:
      "polygon(0 8%, 10% 0, 20% 8%, 30% 0, 40% 8%, 50% 0, 60% 8%, 70% 0, 80% 8%, 90% 0, 100% 8%, 100% 100%, 0 100%)",
  },
  {
    id: "clip-torn-right",
    name: "Накъсан ръб вдясно",
    category: "clip",
    clipPath:
      "polygon(0 0, 96% 2%, 100% 10%, 95% 20%, 100% 32%, 96% 44%, 100% 56%, 95% 68%, 100% 80%, 96% 92%, 100% 100%, 0 100%)",
  },
  {
    id: "clip-torn-left",
    name: "Накъсан ръб вляво",
    category: "clip",
    clipPath:
      "polygon(4% 0, 100% 0, 100% 100%, 4% 100%, 0 92%, 5% 80%, 0 68%, 5% 56%, 0 44%, 5% 32%, 0 20%, 5% 10%)",
  },
  {
    id: "clip-star",
    name: "Звезда",
    category: "clip",
    clipPath:
      "polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  },
  {
    id: "clip-plus",
    name: "Кръст",
    category: "clip",
    clipPath:
      "polygon(35% 0, 65% 0, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0 65%, 0 35%, 35% 35%)",
  },
  {
    id: "clip-frame",
    name: "Рамка (изрязана среда)",
    category: "clip",
    clipPath: "inset(6% 6% 6% 6%)",
  },
  {
    id: "clip-speech",
    name: "Балонче за реплика",
    category: "clip",
    clipPath: "polygon(0 0, 100% 0, 100% 84%, 24% 84%, 14% 100%, 12% 84%, 0 84%)",
  },
  {
    id: "clip-fold-corner",
    name: "Подгънат ъгъл",
    category: "clip",
    clipPath: "polygon(0 0, 84% 0, 100% 16%, 100% 100%, 0 100%)",
  },
];

/** Четковите форми, които вече се ползват в живия сайт и CRM. */
const BRUSH_BLOT = "/__l5e/assets-v1/b5c88c7c-e9e6-4d97-8869-9f1a861dc1ed/brush-blot-1to1.png";

const BRUSH_SHAPES: CrmShape[] = [
  {
    id: "brush-blot",
    name: "Бордо петно от четка (от сайта)",
    category: "brush",
    maskImage: BRUSH_BLOT,
  },
  {
    id: "brush-blot-flip",
    name: "Петно от четка — обърнато",
    category: "brush",
    maskImage: BRUSH_BLOT,
  },
  {
    id: "brush-strip",
    name: "Четкова лента",
    category: "brush",
    clipPath:
      "polygon(0 12%, 6% 4%, 18% 10%, 32% 3%, 46% 11%, 60% 4%, 74% 12%, 88% 5%, 100% 13%, 100% 88%, 90% 96%, 76% 89%, 62% 97%, 48% 90%, 34% 97%, 20% 90%, 8% 96%, 0 88%)",
  },
  {
    id: "brush-card",
    name: "Четкова карта (градовете)",
    category: "brush",
    clipPath:
      "polygon(2% 6%, 14% 2%, 30% 7%, 48% 2%, 66% 8%, 82% 3%, 97% 8%, 100% 26%, 97% 48%, 100% 70%, 96% 92%, 80% 97%, 62% 92%, 44% 98%, 26% 93%, 10% 98%, 2% 84%, 0 60%, 3% 34%)",
  },
  {
    id: "brush-paper",
    name: "Тефтерен лист",
    category: "brush",
    clipPath: "polygon(0 1%, 99% 0, 100% 99%, 1% 100%)",
  },
  {
    id: "brush-note",
    name: "Забодено листче",
    category: "brush",
    clipPath: "polygon(0 4%, 96% 0, 100% 96%, 4% 100%)",
  },
  {
    id: "brush-torn-bottom",
    name: "Скъсано долу",
    category: "brush",
    clipPath:
      "polygon(0 0, 100% 0, 100% 90%, 88% 97%, 74% 90%, 58% 98%, 42% 91%, 26% 98%, 12% 91%, 0 97%)",
  },
];

export const CRM_SHAPES: CrmShape[] = [
  ...radiusShapes(),
  ...ROUND_SHAPES,
  ...CLIP_SHAPES,
  ...BRUSH_SHAPES,
];

export const SHAPES_BY_ID: Record<string, CrmShape> = Object.fromEntries(
  CRM_SHAPES.map((s) => [s.id, s]),
);

/**
 * Регистрира собствени форми (качени като снимка) в общия каталог,
 * за да работят навсякъде, където се ползва `shapeStyle` / `filterShapes`.
 */
export function registerCustomShapes(shapes: CrmShape[]) {
  for (const s of shapes) {
    if (!SHAPES_BY_ID[s.id]) CRM_SHAPES.push(s);
    else {
      const i = CRM_SHAPES.findIndex((x) => x.id === s.id);
      if (i >= 0) CRM_SHAPES[i] = s;
    }
    SHAPES_BY_ID[s.id] = s;
  }
}

/** Премахва собствена форма от каталога (след изтриване). */
export function unregisterCustomShape(id: string) {
  const i = CRM_SHAPES.findIndex((s) => s.id === id);
  if (i >= 0) CRM_SHAPES.splice(i, 1);
  delete SHAPES_BY_ID[id];
}

/** CSS за избраната форма + фина настройка на радиус и пропорция. */
export function shapeStyle(o?: BlockOverride): React.CSSProperties {
  if (!o) return {};
  const style: Record<string, string> = {};
  const shape = o.shape ? SHAPES_BY_ID[o.shape] : undefined;
  if (shape?.borderRadius) style.borderRadius = shape.borderRadius;
  if (shape?.clipPath) style.clipPath = shape.clipPath;
  if (shape?.maskImage) {
    style.WebkitMaskImage = `url(${shape.maskImage})`;
    style.maskImage = `url(${shape.maskImage})`;
    style.WebkitMaskSize = "100% 100%";
    style.maskSize = "100% 100%";
    style.WebkitMaskRepeat = "no-repeat";
    style.maskRepeat = "no-repeat";
    if (shape.id === "brush-blot-flip") style.transform = "scaleX(-1)";
  }
  if (typeof o.radius === "number" && !shape?.clipPath && !shape?.maskImage) {
    style.borderRadius = `${o.radius}px`;
  }
  if (o.ratio && o.ratio !== "auto") style.aspectRatio = o.ratio;
  return style as React.CSSProperties;
}

/** Списък от форми след търсене/филтър. */
export function filterShapes(query: string, category: ShapeCategory | "all"): CrmShape[] {
  const q = query.trim().toLowerCase();
  return CRM_SHAPES.filter(
    (s) =>
      (category === "all" || s.category === category) &&
      (q === "" || s.name.toLowerCase().includes(q) || s.id.includes(q)),
  );
}
