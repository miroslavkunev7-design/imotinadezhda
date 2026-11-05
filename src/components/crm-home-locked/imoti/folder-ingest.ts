import { strFromU8, unzipSync } from "fflate";

import { parseOpisText, type OpisParseResult } from "./opis-parse";

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi)$/i;
const DOC_EXT = /\.(docx?|txt|rtf)$/i;

export const MAX_PHOTOS = 100;
export const MAX_VIDEOS = 10;

export type FolderIngestResult = {
  folderName: string;
  officialPrice: number | null;
  currency: "EUR" | "BGN" | "USD";
  images: File[];
  videos: File[];
  opisFile: File | null;
  extraDocs: File[];
  messages: string[];
  opisText: string;
  parsed: OpisParseResult | null;
};

/** Parse price from folder name: 85000, 85 000 евро, 85000 €, 85к */
export function parsePriceFromFolderName(name: string): {
  price: number | null;
  currency: "EUR" | "BGN" | "USD";
} {
  const raw = name.trim();
  let currency: "EUR" | "BGN" | "USD" = "EUR";
  if (/лв|bgn|лева/i.test(raw)) currency = "BGN";
  else if (/\$|usd|долар/i.test(raw)) currency = "USD";
  else if (/€|eur|евро/i.test(raw)) currency = "EUR";

  const kMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*[кk]/i);
  if (kMatch?.[1]) {
    const n = Number(kMatch[1].replace(",", ".")) * 1000;
    return { price: Number.isFinite(n) ? Math.round(n) : null, currency };
  }

  const numMatch = raw.match(/(\d{1,3}(?:[\s\u00a0.]\d{3})+|\d{4,7})/);
  if (numMatch?.[1]) {
    const n = Number(numMatch[1].replace(/[\s\u00a0.]/g, ""));
    return { price: Number.isFinite(n) ? n : null, currency };
  }

  return { price: null, currency };
}

function baseName(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function folderNameFromFiles(files: File[]): string {
  const first = files[0] as File & { webkitRelativePath?: string };
  const rel = first?.webkitRelativePath || first?.name || "папка";
  const parts = rel.replace(/\\/g, "/").split("/");
  return parts.length > 1 ? parts[0] : parts[0].replace(/\.[^.]+$/, "");
}

async function readTextFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".rtf")) {
    return file.text();
  }
  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    // Minimal docx: try unzip XML text; fall back to binary strip for .doc
    try {
      const buf = await file.arrayBuffer();
      if (name.endsWith(".docx")) {
        const unzipped = unzipSync(new Uint8Array(buf));
        const xml = unzipped["word/document.xml"];
        if (xml) {
          const raw = strFromU8(xml);
          return raw
            .replace(/<w:p[^>]*>/g, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        }
      }
      // Rough fallback for legacy .doc / unreadable docx
      const asText = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      return asText
        .replace(/[^\x09\x0A\x0D\x20-\x7E\u0400-\u04FF]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    } catch {
      return file.text().catch(() => "");
    }
  }
  return file.text().catch(() => "");
}

function pickOpis(docs: File[]): { primary: File | null; extras: File[] } {
  if (!docs.length) return { primary: null, extras: [] };
  const byOpis = docs.filter((f) => /опис/i.test(baseName(f.name)));
  if (byOpis.length) {
    const primary = byOpis[0];
    return { primary, extras: docs.filter((f) => f !== primary) };
  }
  if (docs.length === 1) return { primary: docs[0], extras: [] };
  // Largest by size as proxy for most text; rest extras
  const sorted = [...docs].sort((a, b) => b.size - a.size);
  return { primary: sorted[0], extras: sorted.slice(1) };
}

export async function ingestFolderFiles(fileList: FileList | File[]): Promise<FolderIngestResult> {
  const files = Array.from(fileList);
  const messages: string[] = [];
  const folderName = folderNameFromFiles(files);
  const { price: officialPrice, currency } = parsePriceFromFolderName(folderName);

  const imagesAll = files.filter((f) => IMAGE_EXT.test(f.name) || f.type.startsWith("image/"));
  const videosAll = files.filter((f) => VIDEO_EXT.test(f.name) || f.type.startsWith("video/"));
  const docsAll = files.filter(
    (f) => DOC_EXT.test(f.name) || /text|word|officedocument/i.test(f.type),
  );

  let images = imagesAll;
  let videos = videosAll;
  if (imagesAll.length > MAX_PHOTOS) {
    messages.push(`Приети са ${MAX_PHOTOS} от ${imagesAll.length} снимки (лимит ${MAX_PHOTOS}).`);
    images = imagesAll.slice(0, MAX_PHOTOS);
  }
  if (videosAll.length > MAX_VIDEOS) {
    messages.push(`Приети са ${MAX_VIDEOS} от ${videosAll.length} видеа (лимит ${MAX_VIDEOS}).`);
    videos = videosAll.slice(0, MAX_VIDEOS);
  }

  const { primary: opisFile, extras: extraDocs } = pickOpis(docsAll);
  let opisText = "";
  let parsed: OpisParseResult | null = null;
  if (opisFile) {
    opisText = await readTextFile(opisFile);
    for (const extra of extraDocs) {
      const t = await readTextFile(extra);
      if (t.trim()) opisText += `\n\n---\n${baseName(extra.name)}\n${t.trim()}`;
    }
    parsed = parseOpisText(opisText);
  }

  return {
    folderName,
    officialPrice,
    currency,
    images,
    videos,
    opisFile,
    extraDocs,
    messages,
    opisText,
    parsed,
  };
}

export async function ingestOpisDocument(file: File): Promise<{
  opisText: string;
  parsed: OpisParseResult;
}> {
  const opisText = await readTextFile(file);
  return { opisText, parsed: parseOpisText(opisText) };
}

export function isImageFile(file: File): boolean {
  return IMAGE_EXT.test(file.name) || file.type.startsWith("image/");
}

export function isVideoFile(file: File): boolean {
  return VIDEO_EXT.test(file.name) || file.type.startsWith("video/");
}
