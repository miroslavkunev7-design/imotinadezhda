// Project folders (docs/CONTRACT.md §8.12, 0.1.5). A Проект is a case of Ted's server (the same as „казус“ on the site);
// its FOLDER is local: every file of the files store with that caseId (attachments, documents Ted made, photos, listing
// photos, saved answers). The folder can be
//   – downloaded as ONE ZIP made on this computer (fflate, MIT) and written where the employee picks in the native
//     „Запази като“ dialog, and
//   – saved on the site: every file uploaded to the CRM storage and attached with the existing server tools
//     (files.attach to the project's client or a property; photos into a property's gallery with images.download from
//     a short signed link of the uploaded copy). Never without the employee's approval: the window's card, then the
//     native Windows confirmation here (the agent path: the agent's approval card).
// No other AI runs anywhere here; the server tools used are the plain ones (CONTRACT §9.6).
import path from "node:path";
import { SB_KEY, SB_URL } from "./backend/config.js";
import { safeFileName } from "./files.js";

export const ZIP_MAX_BYTES = 500 * 1048576; // all files of one folder together (built in memory)
export const ZIP_MAX_FILES = 500;
export const CRM_MAX_FILES = 50;            // one „Запази в сайта“
// The site's gallery (api/_ted-skills.js images.download keeps photos over 15 000 bytes, 30 at most per call).
export const PHOTO_MIN_BYTES = 15_000;
export const PHOTO_MAX = 30;
// Already compressed formats are stored as they are (level 0): zipping them again costs time and gains nothing.
const STORED = /\.(jpe?g|png|webp|gif|mp4|webm|pdf|docx|xlsx|zip|7z|rar|gz)$/i;
const KIND_BG = { image: "снимка", pdf: "PDF", docx: "Word", xlsx: "Excel", csv: "CSV", text: "текст", video: "видео", other: "файл" };
const ORIGIN_BG = { user: "прикачен от служителя", ted: "направен на този компютър", web: "от интернет", crm: "от CRM" };

const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const day = (iso) => { try { return new Date(iso).toLocaleString("bg-BG", { timeZone: "Europe/Sofia" }); } catch { return String(iso || ""); } };

// Unique names inside one archive: „оферта.pdf“, „оферта (2).pdf“ …
export function uniqueNames(names) {
  const used = new Set();
  return names.map((raw) => {
    const name = safeFileName(raw, "файл");
    const m = /^(.*?)(\.[^.]{1,8})?$/.exec(name);
    let candidate = name;
    for (let k = 2; used.has(candidate.toLowerCase()); k++) candidate = `${m[1]} (${k})${m[2] || ""}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

// The text file at the root of every archive: what the folder holds, in Bulgarian.
export function indexText({ title, client, items, names, now = new Date() }) {
  const lines = [
    `Проект: ${title || "без име"}`,
    ...(client ? [`Клиент: ${client}`] : []),
    `Изтеглено: ${day(now.toISOString())} · Тед за Windows`,
    `Файлове: ${items.length}`,
    "",
  ];
  items.forEach((f, i) => {
    lines.push(`${i + 1}. ${names[i]} – ${KIND_BG[f.kind] || "файл"}, ${size(f.size || 0)}, ${day(f.createdAt)}, ${ORIGIN_BG[f.origin] || ""}${f.savedTo ? `, в CRM: ${f.savedTo}` : ""}${f.sourceUrl ? `, източник: ${f.sourceUrl}` : ""}`);
  });
  return `﻿${lines.join("\r\n")}\r\n`;
}

// entries: [{name, bytes, mtime?}] -> Buffer (ZIP, UTF-8 names). fflate is loaded only when a folder is zipped.
// The streaming Zip API: every name is a plain string of its entry, never an object key, so a file called „__proto__“
// or „constructor“ is archived under its own name (review F8: zipSync's object tree lost „__proto__“).
export async function buildZip(entries) {
  const { Zip, ZipDeflate, ZipPassThrough } = await import("fflate");
  const chunks = [];
  let failed = null;
  const zip = new Zip((err, data) => { if (err) failed = err; else chunks.push(data); });
  for (const e of entries) {
    const data = new Uint8Array(e.bytes.buffer, e.bytes.byteOffset, e.bytes.length);
    const f = STORED.test(e.name) ? new ZipPassThrough(e.name) : new ZipDeflate(e.name, { level: 6 });
    f.mtime = e.mtime || new Date();
    zip.add(f);
    f.push(data, true);
  }
  zip.end();
  if (failed) throw failed;
  return Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.length)));
}

export function createProjects({ files, uploads, tools, session, dialog, getWindow, confirm, documentsDir = () => "", log, now = () => new Date() }) {
  // The folder of a project, newest first (only files of the signed-in CRM user's store).
  const folder = (caseId) => (caseId ? files.list({ caseId, limit: ZIP_MAX_FILES }).items : []);

  // -> {ok:true, buffer, name, count, bytes} | {ok:false, error, code}
  async function zip({ caseId, title, client }) {
    const items = folder(caseId);
    if (!items.length) return { ok: false, code: "empty", error: "Папката на проекта е празна – няма какво да се изтегли." };
    const total = items.reduce((n, f) => n + (f.size || 0), 0);
    if (total > ZIP_MAX_BYTES) return { ok: false, code: "too_large", error: `Папката е ${size(total)} – над 500 MB не се събира в един ZIP. Изтеглете файловете поотделно.` };
    const names = uniqueNames(items.map((f) => f.name));
    const entries = [];
    const kept = [];
    const keptNames = [];
    items.forEach((f, i) => {
      const got = files.get(f.id);
      if (!got || !got.bytes) return;
      entries.push({ name: names[i], bytes: got.bytes, mtime: new Date(f.createdAt || Date.now()) });
      kept.push(f); keptNames.push(names[i]);
    });
    if (!entries.length) return { ok: false, code: "unreadable", error: "Файловете на папката не можаха да се прочетат." };
    const indexName = uniqueNames([...keptNames, "Съдържание на папката.txt"]).pop();
    entries.push({ name: indexName, bytes: Buffer.from(indexText({ title, client, items: kept, names: keptNames, now: now() }), "utf8") });
    const buffer = await buildZip(entries);
    return { ok: true, buffer, name: `${safeFileName(title || "Проект", "Проект").slice(0, 110)}.zip`, count: kept.length, bytes: total };
  }

  // „Изтегли папката“: the ZIP goes only where the employee picks in the native dialog. -> {ok, path, count, bytes}
  async function exportZip({ caseId, title, client }) {
    const z = await zip({ caseId, title, client });
    if (!z.ok) return z;
    const win = getWindow && getWindow();
    const options = { title: "Изтегли папката", buttonLabel: "Запази", defaultPath: path.join(documentsDir() || "", z.name), filters: [{ name: "ZIP архив", extensions: ["zip"] }] };
    const picked = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (picked.canceled || !picked.filePath) return { ok: false, canceled: true };
    const target = /\.zip$/i.test(picked.filePath) ? picked.filePath : `${picked.filePath}.zip`;
    try {
      const fs = await import("node:fs");
      await fs.promises.writeFile(target, z.buffer);
    } catch {
      return { ok: false, error: "ZIP файлът не можа да се запише на избраното място." };
    }
    if (log) log.info("projects.zip", { count: z.count, bytes: z.bytes });
    return { ok: true, path: target, count: z.count, bytes: z.bytes };
  }

  // An answer of Ted kept in the folder as a Markdown file (origin "ted").
  function saveAnswer({ caseId, caseTitle, chatId, title, text }) {
    const name = `${safeFileName(String(title || "Отговор на Тед").slice(0, 100), "Отговор на Тед")}.md`;
    return files.add({ name, mime: "text/markdown", data: Buffer.from(`﻿${String(text || "")}`, "utf8"), origin: "ted", chatId, caseId, caseTitle });
  }

  // Where „Запази в сайта“ puts the files: a property (code) or a client (id or name). -> {kind, label, input} | null
  function targetOf(t) {
    const o = t && typeof t === "object" ? t : {};
    const code = typeof o.propertyCode === "string" ? o.propertyCode.trim().slice(0, 40) : "";
    const clientId = typeof o.clientId === "string" ? o.clientId.trim().slice(0, 80) : "";
    const clientName = typeof o.clientName === "string" ? o.clientName.trim().slice(0, 120) : "";
    if (code) return { kind: "property", label: `имот ${code}`, input: { property_code: code } };
    // By id: the label always carries the id that is sent; a name only next to it (the window passes the CRM's own
    // name, the agent the name it read with clients.get – never a name the model wrote; review F3).
    if (clientId) return { kind: "client", label: clientName ? `клиент ${clientName} (id ${clientId})` : `клиент с id ${clientId}`, input: { client_id: clientId } };
    if (clientName) return { kind: "client", label: `клиент ${clientName}`, input: { client_name: clientName } };
    return null;
  }

  // Short signed links (15 min) of uploaded copies: images.download fetches them on the server and files them in the
  // property's gallery (the server's own watermark, no AI). -> Map(path -> https url)
  async function signed(paths) {
    const out = new Map();
    if (!paths.length) return out;
    const res = await session.authed({ url: `${SB_URL}/storage/v1/object/sign/nd-files`, method: "POST", headers: { apikey: SB_KEY }, json: { expiresIn: 900, paths }, timeoutMs: 30_000 });
    for (const row of Array.isArray(res.json) ? res.json : []) {
      const s = row && (row.signedURL || row.signedUrl);
      if (row && row.path && s) out.set(row.path, /^https:/.test(s) ? s : `${SB_URL}/storage/v1${s.startsWith("/") ? "" : "/"}${s}`);
    }
    return out;
  }

  // The work of „Запази в сайта“ after the approval (window card + native dialog, or the agent's card).
  // onStep(label) -> {done(ok, detail)}. -> {ok, results:[{id, name, ok, error?, savedTo?}], saved, failed, target}
  async function upload({ fileIds, target, folderName, onStep }) {
    const t = targetOf(target);
    if (!t) return { ok: false, code: "invalid", error: "Изберете клиент или имот, при който да се запишат файловете." };
    const refs = fileIds.map((id) => files.ref(id)).filter(Boolean);
    const results = [];
    const photos = t.kind === "property" ? refs.filter((r) => r.kind === "image" && /^image\/(jpeg|png|webp)$/.test(r.mime)) : [];
    const docs = refs.filter((r) => !photos.includes(r));
    for (const r of docs) {
      try {
        const up = await uploads.ensure(r.id, onStep);
        const res = await tools.call("files.attach", { path: up.path, name: r.name, mime: r.mime, ...t.input, folder: String(folderName || "Тед").slice(0, 80) });
        if (res.ok) {
          const where = res.result && (res.result.property ? `имот ${res.result.property.code || ""}`.trim() : res.result.client ? `клиент ${res.result.client.name || ""}`.trim() : t.label);
          files.update(r.id, { savedTo: `CRM: ${where}`.slice(0, 300) });
          results.push({ id: r.id, name: r.name, ok: true, savedTo: where });
        } else results.push({ id: r.id, name: r.name, ok: false, error: res.error, ...(res.maybeExecuted ? { maybeExecuted: true } : {}) });
      } catch (e) {
        results.push({ id: r.id, name: r.name, ok: false, error: String((e && e.message) || e).slice(0, 200) });
      }
    }
    // Photos into the gallery. The site skips photos of 15 000 bytes or less and takes 30 at most (api/_ted-skills.js
    // images.download): those are reported before sending, and the count the server returns is the truth – when it
    // stored fewer than were sent, nobody can tell WHICH, so those photos say „проверете в CRM“ (review F12).
    let partialSaved = 0;
    if (photos.length) {
      const small = photos.filter((r) => (r.size || 0) <= PHOTO_MIN_BYTES);
      const fit = photos.filter((r) => !small.includes(r));
      const sendNow = fit.slice(0, PHOTO_MAX);
      for (const r of small) results.push({ id: r.id, name: r.name, ok: false, error: "15 KB или по-малка – сайтът не приема толкова малки снимки в галерията" });
      for (const r of fit.slice(PHOTO_MAX)) results.push({ id: r.id, name: r.name, ok: false, error: `над ${PHOTO_MAX} снимки наведнъж – запишете останалите отделно` });
      if (sendNow.length) {
        try {
          const ups = [];
          for (const r of sendNow) ups.push({ r, up: await uploads.ensure(r.id, onStep) });
          const links = await signed(ups.map((x) => x.up.path));
          const urls = ups.map((x) => links.get(x.up.path)).filter(Boolean);
          if (!urls.length) throw new Error("Връзките към снимките не можаха да се подпишат.");
          const res = await tools.call("images.download", { urls, ...t.input, max: Math.min(PHOTO_MAX, urls.length) });
          const got = res.ok && res.result ? Number(res.result.downloaded) : NaN;
          const partial = res.ok && Number.isFinite(got) && got < ups.length;
          for (const { r } of ups) {
            if (res.ok && !partial) { files.update(r.id, { savedTo: `CRM: ${t.label} (снимки)` }); results.push({ id: r.id, name: r.name, ok: true, savedTo: `${t.label} (снимки)` }); }
            else if (partial) results.push({ id: r.id, name: r.name, ok: false, unsure: true, maybeExecuted: true, error: `сървърът записа ${got} от ${ups.length} снимки – не е ясно коя; проверете галерията в CRM` });
            else results.push({ id: r.id, name: r.name, ok: false, error: res.error, ...(res.maybeExecuted ? { maybeExecuted: true } : {}) });
          }
          if (partial) { partialSaved = Math.max(0, got); if (log) log.warn("projects.photos_partial", { got, of: ups.length }); }
        } catch (e) {
          for (const r of sendNow) results.push({ id: r.id, name: r.name, ok: false, error: String((e && e.message) || e).slice(0, 200) });
        }
      }
    }
    const saved = results.filter((x) => x.ok).length + partialSaved;
    return { ok: saved > 0 || !results.length, results, saved, failed: results.length - saved, target: t.label };
  }

  // „Запази в сайта“ from the window: the employee confirmed on the card; MAIN asks once more natively with the exact
  // files and target – the page alone can never upload anything.
  async function saveToCrm({ caseId, caseTitle, fileIds, target }) {
    const all = folder(caseId);
    const chosen = Array.isArray(fileIds) && fileIds.length ? all.filter((f) => fileIds.includes(f.id)) : all;
    if (!chosen.length) return { ok: false, code: "empty", error: "Папката на проекта е празна." };
    if (chosen.length > CRM_MAX_FILES) return { ok: false, code: "invalid", error: `Най-много ${CRM_MAX_FILES} файла наведнъж – изберете по-малко.` };
    const t = targetOf(target);
    if (!t) return { ok: false, code: "invalid", error: "Изберете клиент или имот, при който да се запишат файловете." };
    const list = chosen.slice(0, 15).map((f) => `• ${f.name} (${size(f.size || 0)})`).join("\n") + (chosen.length > 15 ? `\n… и още ${chosen.length - 15}` : "");
    const yes = await confirm(
      `Да запиша ли ${chosen.length} ${chosen.length === 1 ? "файл" : "файла"} в CRM при ${t.label}?`,
      `Проект: ${caseTitle || ""}\n\n${list}\n\nФайловете се качват в хранилището на CRM и се записват при ${t.label}${t.kind === "property" ? " (снимките – в галерията на имота, другите – в документите му)" : " (в документите, папка „Проект“)"}.`,
      { okLabel: "Запиши в CRM", cancelLabel: "Отказ" },
    );
    if (!yes) return { ok: false, canceled: true };
    return upload({ fileIds: chosen.map((f) => f.id), target, folderName: `Проект: ${caseTitle || ""}`.slice(0, 80) });
  }

  return { folder, zip, exportZip, saveAnswer, saveToCrm, upload, targetOf, signed };
}
