// One file store for everything the user attaches and everything Ted makes (docs/CONTRACT.md §8.1, §11).
// Bytes never cross IPC except through files.read (preview) and are never written outside the encrypted library,
// the program's own temporary folder (files.open) or the place the user picks in the native "save as" dialog.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MAX_FILE = 20 * 1048576; // attachments and fetched files
export const MAX_MADE = 300 * 1048576; // videos downloaded from the server
export const ID_RE = /^[a-z0-9_-]{8,64}$/;
// File types that Windows would run (the same list as ipc.js saveFile).
export const RUNNABLE = /\.(exe|com|bat|cmd|scr|pif|cpl|msi|msp|dll|lnk|url|hta|js|jse|vbs|vbe|wsf|wsh|ps1|psm1|reg|jar|appref-ms|msc|gadget|application|inf|sys|drv|ocx|vb|psc1|chm|iso|img|vhd|vhdx|appx|msix|xll|xlam|docm|xlsm|pptm|sct|wsc|settingcontent-ms)$/i;
const TEMP_DIR = "TedImotiNadezhda";
// „Отвори“ hands a copy to the default Windows program ONLY for these types (an allowlist: no macro, script, shortcut,
// web-archive or settings formats). HTML only when Ted made it locally (create_document renders it from escaped
// blocks with a CSP). Everything else gets only „Запази…“.
export const OPENABLE = /\.(pdf|docx|xlsx|csv|txt|md|json|jpe?g|png|webp|gif|mp4|webm)$/i;
export const OPENABLE_TED = /\.html?$/i;
export const canOpen = (ref) => !!ref && (OPENABLE.test(String(ref.name || "")) || (ref.origin === "ted" && OPENABLE_TED.test(String(ref.name || ""))));
// Mark-of-the-Web for copies of files that came from outside this PC (attachments, web, CRM): Office Protected View,
// „block macros from the internet“ and SmartScreen then treat the copy as downloaded.
export const MOTW = "[ZoneTransfer]\r\nZoneId=3\r\n";

const MIMES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const TEXT_EXT = { txt: "text/plain", md: "text/markdown", json: "application/json", html: "text/html", htm: "text/html", csv: "text/csv" };

export function safeFileName(value, fallback = "файл") {
  const name = String(value == null ? "" : value).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/^[.\s]+|[.\s]+$/g, "").slice(0, 180);
  return name || fallback;
}

const isUtf8Text = (buf) => {
  if (buf.includes(0)) return false;
  try { new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, Math.min(buf.length, 65536))); return true; } catch { return false; }
};

// Kind and mime from the bytes and the name (docs/CONTRACT.md §8.1). -> {kind, mime, note?}
export function sniffKind(name, mime, buf) {
  const ext = (/\.([a-z0-9]{1,8})$/i.exec(String(name || "")) || [])[1]?.toLowerCase() || "";
  const head = buf.subarray(0, 16);
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { kind: "image", mime: "image/jpeg" };
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return { kind: "image", mime: "image/png" };
  if (head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP") return { kind: "image", mime: "image/webp" };
  if (/^GIF8[79]a$/.test(head.toString("latin1", 0, 6))) return { kind: "image", mime: "image/gif" };
  if (head.toString("latin1", 0, 5) === "%PDF-") return { kind: "pdf", mime: "application/pdf" };
  if (head.toString("latin1", 4, 8) === "ftyp" && !/^(heic|heix|mif1|avif)/.test(head.toString("latin1", 8, 12))) return { kind: "video", mime: "video/mp4" };
  if (buf.length > 4 && buf.readUInt32BE(0) === 0x1a45dfa3) return { kind: "video", mime: "video/webm" };
  if (head.toString("latin1", 0, 4) === "PK\x03\x04") {
    const sample = buf.subarray(0, Math.min(buf.length, 2 * 1048576)).toString("latin1");
    if (ext === "docx" || /word\/document\.xml/.test(sample)) return { kind: "docx", mime: MIMES.docx };
    if (ext === "xlsx" || /xl\/workbook\.xml/.test(sample)) return { kind: "xlsx", mime: MIMES.xlsx };
    return { kind: "other", mime: "application/zip" };
  }
  if (buf.length > 8 && buf.readUInt32BE(0) === 0xd0cf11e0) {
    return { kind: "other", mime: ext === "xls" ? "application/vnd.ms-excel" : "application/msword", note: "стар формат – запазете като .docx/.xlsx" };
  }
  if (TEXT_EXT[ext] && isUtf8Text(buf)) return { kind: ext === "csv" ? "csv" : "text", mime: TEXT_EXT[ext] };
  if (!ext && /^text\/plain\b/.test(String(mime)) && isUtf8Text(buf)) return { kind: "text", mime: "text/plain" };
  const m = /^[\w.+-]+\/[\w.+-]+$/.test(String(mime || "")) && String(mime).length <= 120 ? String(mime) : "application/octet-stream";
  return { kind: "other", mime: m };
}

// makeThumb(buffer, mime) -> data:image/jpeg;base64,… ≤ 24 KB | null  (main.js: nativeImage; PNG/JPEG only)
export function createFiles({
  library, tempRoot, shell, dialog, getWindow, confirm, makeThumb = () => null, log, onChange = () => {},
  now = () => new Date(), newId = () => crypto.randomBytes(12).toString("base64url").toLowerCase().replace(/[^a-z0-9_-]/g, "x"),
  documentsDir = () => tempRoot, readDoc, platform = process.platform,
}) {
  const memory = new Map(); // id -> {ref, bytes, temporary}
  const session = crypto.randomBytes(6).toString("hex");
  const sessionDir = path.join(tempRoot, TEMP_DIR, session);

  const changed = () => { try { onChange(); } catch { /* window gone */ } };

  // -> {ok:true, file:FileRef} | {ok:false, error, code}
  function add({ name, mime, data, chatId, temporary = false, origin = "user", sourceUrl, savedTo, crm, pages, sheets, maxBytes = MAX_FILE }) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
    const fileName = safeFileName(name);
    if (!bytes.length) return { ok: false, code: "invalid", error: "Файлът е празен." };
    if (bytes.length > maxBytes) return { ok: false, code: "too_large", error: `Файлът „${fileName}“ е по-голям от ${Math.round(maxBytes / 1048576)} MB.` };
    if (RUNNABLE.test(fileName)) return { ok: false, code: "runnable", error: `„${fileName}“ е програма или скрипт – такива файлове не се приемат.` };
    const sniff = sniffKind(fileName, mime, bytes);
    const id = newId();
    const ref = {
      id, name: fileName, mime: sniff.mime, size: bytes.length, kind: sniff.kind,
      origin: ["user", "ted", "web", "crm"].includes(origin) ? origin : "user", createdAt: now().toISOString(),
      ...(chatId ? { chatId: String(chatId).slice(0, 64) } : {}),
      ...(Number.isFinite(pages) && pages > 0 ? { pages } : {}),
      ...(Number.isFinite(sheets) && sheets > 0 ? { sheets } : {}),
      ...(sourceUrl ? { sourceUrl: String(sourceUrl).slice(0, 2000) } : {}),
      ...(savedTo ? { savedTo: String(savedTo).slice(0, 300) } : {}),
      ...(crm && typeof crm === "object" ? { crm: { ...(crm.documentId ? { documentId: String(crm.documentId).slice(0, 80) } : {}), ...(crm.path ? { path: String(crm.path).slice(0, 400) } : {}) } } : {}),
      ...(sniff.note ? { note: sniff.note } : {}),
    };
    if (sniff.kind === "image" && /^image\/(jpeg|png)$/.test(sniff.mime)) {
      try {
        const t = makeThumb(bytes, sniff.mime);
        if (typeof t === "string" && t.startsWith("data:image/") && t.length <= 24 * 1024 * 1.37) ref.thumb = t;
      } catch { /* no preview */ }
    }
    // Library first (encrypted on disk); without Windows encryption or in a temporary chat: memory only.
    const stored = !temporary && library && library.available() && library.put(ref, bytes);
    memory.set(id, { ref, bytes: stored && bytes.length > 4 * 1048576 ? null : bytes, temporary: !!temporary, persisted: !!stored });
    if (!temporary) changed();
    return { ok: true, file: { ...ref } };
  }

  function get(id) {
    if (!ID_RE.test(String(id || ""))) return null;
    const m = memory.get(id);
    if (m && m.bytes) return { ref: m.ref, bytes: m.bytes };
    const fromLib = library && library.get(id);
    if (fromLib) return fromLib;
    return null;
  }
  const ref = (id) => (memory.get(id) ? { ...memory.get(id).ref } : (library && library.ref(id)) || null);

  // Merges fields a later step learned (crm path after an upload, savedTo from a server result).
  function update(id, patch) {
    const m = memory.get(id);
    if (m) m.ref = { ...m.ref, ...patch };
    const r = library && library.ref(id) ? library.update(id, patch) : null;
    return m ? { ...m.ref } : r;
  }

  function read({ id, max = 150 * 1048576 } = {}) {
    const f = get(id);
    if (!f) return { ok: false, code: "not_found", error: "Файлът не е намерен." };
    if (f.bytes.length > max) return { ok: false, code: "too_large", error: "Файлът е твърде голям за преглед." };
    const ab = f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.length);
    return { ok: true, name: f.ref.name, mime: f.ref.mime, size: f.ref.size, data: ab };
  }

  async function extract(id) {
    const f = get(id);
    if (!f) return { ok: false, code: "not_found", error: "Файлът не е намерен." };
    if (!["docx", "xlsx", "pdf", "csv", "text"].includes(f.ref.kind)) {
      return { ok: false, code: "unsupported", error: f.ref.note ? `„${f.ref.name}“: ${f.ref.note}.` : `„${f.ref.name}“ не може да се прочете като текст.` };
    }
    try {
      return { ok: true, doc: await readDoc({ buffer: f.bytes, kind: f.ref.kind, name: f.ref.name, mime: f.ref.mime }) };
    } catch (e) {
      if (log) log.warn("files.extract_failed", { kind: f.ref.kind, code: e && e.code });
      return { ok: false, code: (e && e.code) || "unreadable", error: `Файлът „${f.ref.name}“ не може да бъде прочетен${e && e.code === "unsupported" ? "" : " (повреден или защитен с парола)"}.` };
    }
  }

  // A decrypted copy in the program's own temporary folder, opened with the default Windows program.
  async function open(id) {
    const f = get(id);
    if (!f) return { ok: false, error: "Файлът не е намерен." };
    const name = safeFileName(f.ref.name);
    if (RUNNABLE.test(name)) return { ok: false, error: "Програмата не отваря изпълними файлове." };
    if (!canOpen({ ...f.ref, name })) return { ok: false, code: "not_openable", error: "Този вид файл не се отваря от програмата – ползвайте „Запази…“." };
    const target = path.join(sessionDir, id, name);
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, f.bytes, { mode: 0o600 });
      // NTFS alternate data stream; without it the copy would lose the Mark-of-the-Web the original may have had.
      if (platform === "win32" && f.ref.origin !== "ted") fs.writeFileSync(`${target}:Zone.Identifier`, MOTW);
    } catch {
      return { ok: false, error: "Временното копие не можа да се запише." };
    }
    const err = await shell.openPath(target);
    return err ? { ok: false, error: "Няма програма за този вид файл или файлът не можа да се отвори." } : { ok: true };
  }

  async function save(id) {
    const f = get(id);
    if (!f) return { ok: false, error: "Файлът не е намерен." };
    const win = getWindow && getWindow();
    const options = { title: "Запази като", buttonLabel: "Запази", defaultPath: path.join(documentsDir(), safeFileName(f.ref.name)) };
    const picked = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (picked.canceled || !picked.filePath) return { ok: false, canceled: true };
    if (RUNNABLE.test(picked.filePath)) return { ok: false, error: "Програмата не записва изпълними файлове. Изберете друго име." };
    try {
      await fs.promises.writeFile(picked.filePath, f.bytes);
      return { ok: true, path: picked.filePath };
    } catch {
      return { ok: false, error: "Файлът не можа да се запише на избраното място." };
    }
  }

  // Drops a temporary (not library) file.
  function forget(id) {
    const m = memory.get(id);
    if (m && !m.persisted) memory.delete(id);
    return { ok: true };
  }

  function list({ kind, q, limit = 100 } = {}) {
    const lib = library ? library.list() : [];
    const mem = [...memory.values()].filter((m) => !m.temporary && !m.persisted).map((m) => m.ref);
    let items = [...mem, ...lib].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (kind) {
      const kinds = kind === "document" ? ["pdf", "docx", "xlsx", "csv", "text", "other"] : [kind];
      items = items.filter((r) => kinds.includes(r.kind));
    }
    if (q) {
      const needle = String(q).toLowerCase();
      items = items.filter((r) => String(r.name).toLowerCase().includes(needle) || String(r.savedTo || "").toLowerCase().includes(needle));
    }
    const totalBytes = items.reduce((s, r) => s + (r.size || 0), 0);
    return { ok: true, items: items.slice(0, Math.max(1, Math.min(500, Number(limit) || 100))).map((r) => ({ ...r })), totalBytes, count: items.length, ...(library && library.available() ? {} : { memoryOnly: true }) };
  }

  async function remove(id) {
    const r = ref(id);
    if (!r) return { ok: true };
    const yes = await confirm("Да изтрия ли файла от библиотеката?", `„${r.name}“ ще бъде изтрит от този компютър. Копията в CRM (ако има) не се променят.`, { okLabel: "Изтрий", cancelLabel: "Отказ" });
    if (!yes) return { ok: false, canceled: true };
    memory.delete(id);
    if (library) library.remove(id);
    changed();
    return { ok: true };
  }

  async function clear() {
    const yes = await confirm("Да изчистя ли библиотеката?", "Всички снимки, документи и видеа в библиотеката на Тед на този компютър ще бъдат изтрити. Файловете в CRM не се променят. Действието не може да бъде отменено.", { okLabel: "Изчисти", cancelLabel: "Отказ" });
    if (!yes) return { ok: false, canceled: true };
    for (const [id, m] of memory) if (!m.temporary) memory.delete(id);
    if (library) library.clear();
    changed();
    return { ok: true };
  }

  function dirSize(dir) {
    let total = 0;
    try {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        total += e.isDirectory() ? dirSize(p) : fs.statSync(p).size;
      }
    } catch { /* missing */ }
    return total;
  }

  function storage() {
    const s = library ? library.stats() : { bytes: 0, count: 0 };
    const memBytes = [...memory.values()].filter((m) => !m.persisted && !m.temporary).reduce((a, m) => a + m.ref.size, 0);
    const memCount = [...memory.values()].filter((m) => !m.persisted && !m.temporary).length;
    return { libraryBytes: s.bytes + memBytes, libraryCount: s.count + memCount, tempBytes: dirSize(path.join(tempRoot, TEMP_DIR)) };
  }

  function clearTemp() {
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch { /* still open in another program */ }
    return { ok: true };
  }

  // At start: copies older than 24 h from earlier runs are removed.
  function cleanStaleTemp(maxAgeMs = 24 * 3600 * 1000) {
    const root = path.join(tempRoot, TEMP_DIR);
    try {
      for (const name of fs.readdirSync(root)) {
        const p = path.join(root, name);
        try { if (Date.now() - fs.statSync(p).mtimeMs > maxAgeMs) fs.rmSync(p, { recursive: true, force: true }); } catch { /* locked */ }
      }
    } catch { /* nothing yet */ }
  }

  // CRM sign-out / another user: files of the previous user leave memory, the library key too.
  function detach() {
    memory.clear();
    if (library) library.detach();
    changed();
  }

  return { add, get, ref, update, read, extract, open, save, forget, list, remove, clear, storage, clearTemp, cleanStaleTemp, detach, sessionDir };
}
