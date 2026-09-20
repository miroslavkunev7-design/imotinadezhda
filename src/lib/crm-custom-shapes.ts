/**
 * Собствени форми в CRM: качваш снимка на формата (PNG/JPG/SVG),
 * тя се превръща в маска (alpha) и се пази ЗА ПОСТОЯННО в базата
 * (`public.crm_custom_shapes`), за да е налична на всяка страница.
 */
import { supabase } from "@/integrations/supabase/client";
import { registerCustomShapes, unregisterCustomShape, type CrmShape } from "@/lib/crm-shapes";

export type CustomShapeRow = {
  id: string;
  name: string;
  mask_url: string;
  kind: string;
  created_at: string;
  image_url?: string | null;
  keep_image?: boolean | null;
};

const ROW_COLS = "id, name, mask_url, kind, created_at, image_url, keep_image";

const MAX_SIDE = 512;

/** Превръща качен файл в компактен PNG data URL (маска). */
export async function fileToMaskDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Файлът не може да бъде прочетен"));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Невалидна снимка"));
    el.src = raw;
  });

  const scale = Math.min(1, MAX_SIDE / Math.max(img.width || 1, img.height || 1));
  const w = Math.max(1, Math.round((img.width || MAX_SIDE) * scale));
  const h = Math.max(1, Math.round((img.height || MAX_SIDE) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, w, h);

  // Ако снимката е без прозрачност (бял фон), правим белите пиксели прозрачни,
  // за да остане само формата на петното/фигурата.
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  let hasAlpha = false;
  for (let i = 3; i < px.length; i += 4) {
    if (px[i]! < 250) {
      hasAlpha = true;
      break;
    }
  }
  if (!hasAlpha) {
    for (let i = 0; i < px.length; i += 4) {
      const lum = (px[i]! + px[i + 1]! + px[i + 2]!) / 3;
      px[i + 3] = lum > 235 ? 0 : 255;
    }
    ctx.putImageData(data, 0, 0);
  }
  return canvas.toDataURL("image/png");
}

function toShape(row: CustomShapeRow): CrmShape {
  return {
    id: `custom-${row.id}`,
    name: row.name,
    category: "custom",
    maskImage: row.mask_url,
    imageUrl: row.image_url ?? undefined,
  };
}

/** Смалява качената снимка без промяна на съдържанието (за „пази снимката“). */
async function fileToImageDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Файлът не може да бъде прочетен"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Невалидна снимка"));
    el.src = raw;
  });
  const scale = Math.min(1, 1024 / Math.max(img.width || 1, img.height || 1));
  if (scale === 1) return raw;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((img.width || 1024) * scale);
  canvas.height = Math.round((img.height || 1024) * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/** Зарежда всички собствени форми и ги регистрира в каталога. */
export async function loadCustomShapes(): Promise<CustomShapeRow[]> {
  const { data, error } = await supabase
    .from("crm_custom_shapes")
    .select(ROW_COLS)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[CRM shapes] load failed", error);
    return [];
  }
  const rows = (data ?? []) as CustomShapeRow[];
  registerCustomShapes(rows.map(toShape));
  return rows;
}

/** Записва нова форма от качена снимка. Връща id-то на формата в каталога. */
export async function createCustomShapeFromFile(
  file: File,
  name: string,
  opts: { keepImage?: boolean } = {},
): Promise<{ row: CustomShapeRow; shapeId: string }> {
  const maskUrl = await fileToMaskDataUrl(file);
  const imageUrl = opts.keepImage ? await fileToImageDataUrl(file) : null;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Няма влязъл потребител");

  const { data, error } = await supabase
    .from("crm_custom_shapes")
    .insert({
      name: name.trim() || file.name,
      mask_url: maskUrl,
      kind: "mask",
      created_by: userId,
      image_url: imageUrl,
      keep_image: !!opts.keepImage,
    } as never)
    .select(ROW_COLS)
    .single();
  if (error) throw new Error(error.message);
  const row = data as CustomShapeRow;
  registerCustomShapes([toShape(row)]);
  return { row, shapeId: `custom-${row.id}` };
}

export async function deleteCustomShape(row: CustomShapeRow): Promise<void> {
  const { error } = await supabase.from("crm_custom_shapes").delete().eq("id", row.id);
  if (error) throw new Error(error.message);
  unregisterCustomShape(`custom-${row.id}`);
}

/** Записва форма от готова маска (напр. при импорт на пресет). */
export async function createCustomShapeFromMask(
  name: string,
  maskUrl: string,
): Promise<{ row: CustomShapeRow; shapeId: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Няма влязъл потребител");
  const { data, error } = await supabase
    .from("crm_custom_shapes")
    .insert({
      name: name.trim() || "Импортирана форма",
      mask_url: maskUrl,
      kind: "mask",
      created_by: userId,
    })
    .select(ROW_COLS)
    .single();
  if (error) throw new Error(error.message);
  const row = data as CustomShapeRow;
  registerCustomShapes([toShape(row)]);
  return { row, shapeId: `custom-${row.id}` };
}
