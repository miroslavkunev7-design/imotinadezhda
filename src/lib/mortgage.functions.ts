import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const fileSchema = z.object({
  category: z.string().max(80),
  month: z.string().max(20).optional().nullable(),
  path: z.string().max(500),
  file_name: z.string().max(300),
  size: z.number().nonnegative().optional(),
});

const applicationSchema = z.object({
  property_id: z.string().uuid().optional().nullable(),
  full_name: z.string().min(2).max(200),
  phone: z.string().min(4).max(40),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  employer: z.string().max(200).optional().nullable(),
  monthly_income: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  files: z.array(fileSchema).max(60),
});

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB hard cap
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const ALLOWED_EXT = new Set([
  "pdf", "jpg", "jpeg", "png", "webp", "heic", "heif", "doc", "docx", "xls", "xlsx",
]);
const EXT_TO_MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  heic: ["image/heic", "image/heif"],
  heif: ["image/heic", "image/heif"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (["heic", "heix", "heif", "mif1", "msf1"].includes(brand)) return "image/heic";
  }
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05) && (bytes[3] === 0x04 || bytes[3] === 0x06)) return "application/zip";
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return "application/x-ole-storage";
  return null;
}

const uploadSchema = z.object({
  category: z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/),
  month: z.string().max(20).regex(/^[a-zA-Z0-9_-]*$/).optional().nullable(),
  fileName: z.string().min(1).max(200).regex(/^[^/\\\x00-\x1f]+$/, "Невалидно име на файл"),
  contentType: z.string().max(120).optional().nullable(),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  base64: z.string().min(1).max(Math.ceil(MAX_FILE_BYTES * 4 / 3) + 256),
});

function safeFileName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^\.+/, "").slice(0, 120);
  return cleaned || "document";
}

function getExt(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export const uploadMortgageDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => uploadSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ext = getExt(data.fileName);
    if (!ALLOWED_EXT.has(ext)) {
      throw new Error("Неразрешен тип файл. Позволени: PDF, JPG, PNG, WEBP, HEIC, DOC(X), XLS(X).");
    }

    const declaredMime = (data.contentType || "").toLowerCase().split(";")[0].trim();
    if (declaredMime && !ALLOWED_MIME.has(declaredMime)) {
      throw new Error("Неразрешен MIME тип.");
    }

    let bytes: Uint8Array;
    try {
      const binary = atob(data.base64);
      bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    } catch {
      throw new Error("Невалидно съдържание на файла.");
    }

    if (bytes.byteLength === 0) throw new Error("Празен файл.");
    if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("Файлът надхвърля 15MB.");
    if (Math.abs(bytes.byteLength - data.size) > 1024) {
      throw new Error("Размерът на файла не съвпада.");
    }

    const sniffed = sniffMime(bytes);
    const expectedMimes = EXT_TO_MIME[ext] || [];
    if (sniffed) {
      const ok =
        expectedMimes.includes(sniffed) ||
        (sniffed === "application/zip" && ["docx", "xlsx"].includes(ext)) ||
        (sniffed === "application/x-ole-storage" && ["doc", "xls"].includes(ext));
      if (!ok) {
        throw new Error("Съдържанието на файла не съответства на разширението.");
      }
    } else if (["pdf", "jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)) {
      throw new Error("Невалидно съдържание на файла.");
    }

    const safeName = safeFileName(data.fileName);
    const monthPart = data.month ? `-${data.month.replace(/[^a-zA-Z0-9_-]+/g, "-")}` : "";
    const path = `${crypto.randomUUID()}/${data.category}${monthPart}-${Date.now()}-${safeName}`;

    const { error } = await supabaseAdmin.storage
      .from("mortgage-docs")
      .upload(path, bytes, {
        contentType: declaredMime || "application/octet-stream",
        upsert: false,
      });
    if (error) {
      console.error("[mortgage-docs-upload]", error);
      throw new Error("Грешка при качване на документа.");
    }
    return { category: data.category, month: data.month ?? undefined, path, file_name: safeName, size: bytes.byteLength };
  });

export const submitMortgageApplication = createServerFn({ method: "POST" })
  .inputValidator((d) => applicationSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      ...data,
      email: data.email === "" ? null : data.email,
    };
    const { data: row, error } = await supabaseAdmin
      .from("mortgage_applications")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      console.error("[mortgage-application-submit]", error);
      throw new Error("Грешка при изпращане на заявлението.");
    }
    return { id: row.id };
  });
