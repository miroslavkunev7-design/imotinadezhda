import JSZip from "jszip";

type Row = any;

function sanitize(s: string | null | undefined, fallback = "imot") {
  return (s ?? fallback).trim().replace(/[\/\\:*?"<>|]+/g, "-").slice(0, 80) || fallback;
}

async function fetchImage(url: string): Promise<{ blob: Blob; ext: string } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const m = url.split("?")[0].match(/\.([a-zA-Z0-9]{2,5})$/);
    const ext = (m?.[1] ?? (blob.type.split("/")[1] || "jpg")).toLowerCase();
    return { blob, ext };
  } catch {
    return null;
  }
}

async function buildPropertyFolder(zip: JSZip, row: Row, basePath: string) {
  const folder = zip.folder(basePath)!;
  folder.file("property.json", JSON.stringify(row, null, 2));

  const lines = [
    `Заглавие: ${row.title ?? "—"}`,
    `Град: ${row.cities?.name ?? "—"}`,
    `Квартал: ${row.quarters?.name ?? "—"}`,
    `Цена: ${row.price ? `${row.price} ${row.currency ?? ""}` : "—"}`,
    `Площ: ${row.area_sqm ? `${row.area_sqm} m²` : "—"}`,
    `Стаи: ${row.rooms ?? "—"}`,
    `Тип: ${row.property_type ?? "—"}`,
    `Контакт: ${row.contact_name ?? "—"} ${row.phone ?? ""}`,
    `Източник: ${row.source ?? "—"}`,
    `URL: ${row.source_url ?? "—"}`,
    `Архивиран: ${row.archived_at ?? "—"}`,
    "",
    "Описание:",
    row.description ?? "—",
  ];
  folder.file("info.txt", lines.join("\n"));

  const images: string[] = Array.isArray(row.images) ? row.images : [];
  if (images.length) {
    const imgFolder = folder.folder("images")!;
    let i = 1;
    for (const url of images) {
      const fetched = await fetchImage(url);
      if (fetched) {
        imgFolder.file(`${String(i).padStart(2, "0")}.${fetched.ext}`, fetched.blob);
        i++;
      }
    }
  }
}

async function saveBlob(blob: Blob, suggestedName: string) {
  // File System Access API — позволява избор на път от компютъра
  const w = window as any;
  if (typeof w.showSaveFilePicker === "function") {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName,
        types: [{ description: "ZIP архив", accept: { "application/zip": [".zip"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      // fallback below
    }
  }
  // Fallback — браузърен download (отива в "Downloads")
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Download a single archived property as ZIP. */
export async function downloadPropertyZip(row: Row) {
  const zip = new JSZip();
  const base = sanitize(row.title, row.id?.slice(0, 8));
  await buildPropertyFolder(zip, row, base);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  await saveBlob(blob, `${base}.zip`);
}

/** Download multiple rows grouped as Year/City/Quarter/Title. */
export async function downloadBulkZip(rows: Row[], filename = "imoti-archive.zip") {
  const zip = new JSZip();
  for (const r of rows) {
    const path = [
      String(r.archived_year ?? new Date().getFullYear()),
      sanitize(r.cities?.name, "Без град"),
      sanitize(r.quarters?.name, "Без квартал"),
      sanitize(r.title, r.id?.slice(0, 8)),
    ].join("/");
    await buildPropertyFolder(zip, r, path);
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  await saveBlob(blob, filename);
}
