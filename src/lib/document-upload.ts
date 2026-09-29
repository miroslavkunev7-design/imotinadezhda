export const DEFAULT_DOCUMENT_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "heic",
  "doc",
  "docx",
] as const;

const MIME_EXTENSIONS: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/heic": ["heic"],
  "image/heif": ["heic"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
};

export function parseAcceptedExtensions(value?: string | null): string[] {
  const parsed = (value ?? "")
    .split(",")
    .map((extension) => extension.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean);
  return parsed.length ? Array.from(new Set(parsed)) : [...DEFAULT_DOCUMENT_EXTENSIONS];
}

export function documentAccept(value?: string | null): string {
  return parseAcceptedExtensions(value).map((extension) => `.${extension}`).join(",");
}

export function safeDocumentFileName(name: string): string {
  const trimmed = name.trim();
  const dot = trimmed.lastIndexOf(".");
  const extension = dot > 0 ? trimmed.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = (dot > 0 ? trimmed.slice(0, dot) : trimmed)
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\-.]+|[_\-.]+$/g, "")
    .slice(0, 80);
  const safeBase = base || "document";
  return extension ? `${safeBase}.${extension}` : safeBase;
}

export function validateDocumentUpload(
  file: Pick<File, "name" | "size" | "type">,
  maxFileMb: number,
  acceptedTypes?: string | null,
): string | null {
  if (!Number.isFinite(maxFileMb) || maxFileMb <= 0) {
    return "Настройките за максимален размер още не са заредени.";
  }
  if (file.size <= 0) return "Файлът е празен.";
  if (file.size > maxFileMb * 1024 * 1024) {
    return `Файлът е по-голям от разрешените ${maxFileMb} MB.`;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = parseAcceptedExtensions(acceptedTypes);
  if (!allowed.includes(extension)) {
    return `Неподдържан формат. Разрешени: ${allowed.join(", ")}.`;
  }

  const mimeExtensions = file.type ? MIME_EXTENSIONS[file.type.toLowerCase()] : undefined;
  if (mimeExtensions && !mimeExtensions.includes(extension)) {
    return "Разширението на файла не съответства на неговия тип.";
  }
  if (file.type && !mimeExtensions) {
    return "Неподдържан тип файл.";
  }
  return null;
}
