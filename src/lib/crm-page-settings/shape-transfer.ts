/**
 * Експорт / импорт на настройките за форми (`blocks[*].shape/radius/ratio`),
 * за да могат да се прехвърлят между различни страници и админ-табла.
 */
import { SHAPES_BY_ID, type CrmShape } from "@/lib/crm-shapes";
import type { BlockOverride, PageSettings } from "@/lib/crm-page-settings/types";

export type ShapePresetBlock = Pick<
  BlockOverride,
  "shape" | "radius" | "ratio" | "width" | "height"
>;

export type ShapePreset = {
  kind: "imoti-nadezhda-crm-shape-preset";
  version: 1;
  pageKey: string;
  exportedAt: string;
  blocks: Record<string, ShapePresetBlock>;
  /** Собствените форми (маски), за да работят и на друго табло. */
  customShapes: Array<{ id: string; name: string; maskImage: string }>;
};

const KIND: ShapePreset["kind"] = "imoti-nadezhda-crm-shape-preset";

export function buildShapePreset(pageKey: string, settings: PageSettings): ShapePreset {
  const blocks: Record<string, ShapePresetBlock> = {};
  const usedCustom = new Set<string>();

  for (const [key, o] of Object.entries(settings.blocks ?? {})) {
    if (!o) continue;
    const entry: ShapePresetBlock = {};
    if (o.shape) entry.shape = o.shape;
    if (typeof o.radius === "number") entry.radius = o.radius;
    if (o.ratio) entry.ratio = o.ratio;
    if (o.width) entry.width = o.width;
    if (typeof o.height === "number") entry.height = o.height;
    if (Object.keys(entry).length === 0) continue;
    blocks[key] = entry;
    if (o.shape?.startsWith("custom-")) usedCustom.add(o.shape);
  }

  const customShapes = [...usedCustom]
    .map((id) => SHAPES_BY_ID[id])
    .filter((s): s is CrmShape => Boolean(s?.maskImage))
    .map((s) => ({ id: s.id, name: s.name, maskImage: s.maskImage! }));

  return {
    kind: KIND,
    version: 1,
    pageKey,
    exportedAt: new Date().toISOString(),
    blocks,
    customShapes,
  };
}

export function parseShapePreset(raw: string): ShapePreset {
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("Файлът не е валиден JSON");
  }
  if (!json || json.kind !== KIND) throw new Error("Това не е файл с форми от CRM");
  if (!json.blocks || typeof json.blocks !== "object") throw new Error("Липсват форми във файла");
  return {
    kind: KIND,
    version: 1,
    pageKey: String(json.pageKey ?? ""),
    exportedAt: String(json.exportedAt ?? ""),
    blocks: json.blocks as Record<string, ShapePresetBlock>,
    customShapes: Array.isArray(json.customShapes) ? json.customShapes : [],
  };
}

/** Слива формите от пресета върху текущите настройки (пази подредбата). */
export function applyShapePreset(
  settings: PageSettings,
  preset: ShapePreset,
  remap: Record<string, string> = {},
): PageSettings {
  const blocks: Record<string, BlockOverride> = { ...(settings.blocks ?? {}) };
  for (const [key, entry] of Object.entries(preset.blocks)) {
    const shape = entry.shape ? (remap[entry.shape] ?? entry.shape) : undefined;
    blocks[key] = { ...(blocks[key] ?? {}), ...entry, ...(shape ? { shape } : {}) };
  }
  return { ...settings, blocks };
}

export function downloadShapePreset(preset: ShapePreset) {
  const blob = new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `crm-formi-${(preset.pageKey || "stranica").replace(/\W+/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Файлът не може да бъде прочетен"));
    fr.readAsText(file);
  });
}
