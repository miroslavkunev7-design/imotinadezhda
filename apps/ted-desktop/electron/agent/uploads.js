// Upload of local files for server tools (docs/CONTRACT.md §11.2), exactly as the site's mobile/ash.js upFile:
// POST {SB_URL}/storage/v1/object/nd-files/ted-chat/<YYYY-MM>/<uuid>.<ext> with apikey + Bearer (CRM token, via
// session.authed: Supabase host allowlisted, 401 -> refresh once), Content-Type, x-upsert:true, body = the bytes.
// Only when a server tool input references "file:<id>"; once per file (the path is kept in FileRef.crm.path).
import crypto from "node:crypto";
import { SB_KEY, SB_URL } from "../backend/config.js";

export const FILE_REF = /^file:([a-z0-9_-]{8,64})$/;
const EXT = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf",
  "audio/webm": "webm", "audio/mp4": "m4a", "audio/aac": "aac", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav",
};
export const MAX_UPLOAD = 20 * 1048576;

export class UploadError extends Error {
  constructor(message, code = "upload") {
    super(message);
    this.code = code;
  }
}

export function storagePath(ref, now = new Date()) {
  const ext = EXT[ref.mime] || ((/\.([a-z0-9]{1,6})$/i.exec(ref.name || "") || [])[1] || "bin").toLowerCase();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `ted-chat/${month}/${crypto.randomUUID()}.${ext}`;
}

// onStep(label) -> {done(ok, detail)} : the "Качвам „<name>“ в хранилището на CRM" step of the answer.
export function createUploads({ session, files, log, now = () => new Date() }) {
  const inflight = new Map();

  async function upload(id, onStep) {
    const f = files.get(id);
    if (!f) throw new UploadError("Файлът не е намерен в програмата.", "not_found");
    if (f.ref.crm && f.ref.crm.path) return { path: f.ref.crm.path, name: f.ref.name, mime: f.ref.mime };
    if (f.bytes.length > MAX_UPLOAD) throw new UploadError(`„${f.ref.name}“ е над 20 MB и не може да се качи в CRM.`, "too_large");
    const path = storagePath(f.ref, now());
    const step = onStep ? onStep(`Качвам „${f.ref.name}“ в хранилището на CRM`) : null;
    let res;
    try {
      res = await session.authed({
        url: `${SB_URL}/storage/v1/object/nd-files/${path}`, method: "POST", timeoutMs: 120000, as: "text",
        headers: { apikey: SB_KEY, "Content-Type": f.ref.mime || "application/octet-stream", "x-upsert": "true" },
        body: f.bytes,
      });
    } catch (e) {
      step?.done(false, "няма връзка");
      throw new UploadError(`„${f.ref.name}“ не се качи (${e.code === "auth" ? "сесията е изтекла – влезте отново" : "няма връзка със сървъра"}).`, e.code || "network");
    }
    if (!res.ok) {
      step?.done(false, `HTTP ${res.status}`);
      if (log) log.warn("upload.failed", { status: res.status });
      throw new UploadError(res.status === 403 || res.status === 401
        ? `„${f.ref.name}“ не се качи – нямате права за качване (влезте отново в CRM).`
        : `„${f.ref.name}“ не се качи (HTTP ${res.status}).`, "http");
    }
    files.update(id, { crm: { ...(f.ref.crm || {}), path } });
    step?.done(true);
    return { path, name: f.ref.name, mime: f.ref.mime };
  }

  // One upload per file even when two tool calls ask at once.
  function ensure(id, onStep) {
    if (!inflight.has(id)) inflight.set(id, upload(id, onStep).finally(() => inflight.delete(id)));
    return inflight.get(id);
  }

  // Replaces every "file:<id>" in a tool input: elements of `files` become {path, name, mime}; every other place
  // gets the storage path (an object with `path` also gets name/mime when it has none).
  async function resolve(input, onStep, depth = 0) {
    if (depth > 6) return input;
    if (typeof input === "string") {
      const m = FILE_REF.exec(input);
      return m ? (await ensure(m[1], onStep)).path : input;
    }
    if (Array.isArray(input)) return Promise.all(input.map((v) => resolve(v, onStep, depth + 1)));
    if (!input || typeof input !== "object") return input;
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      if (k === "files" && Array.isArray(v)) {
        out[k] = await Promise.all(v.map(async (x) => {
          const m = typeof x === "string" ? FILE_REF.exec(x) : null;
          if (m) return ensure(m[1], onStep);
          if (x && typeof x === "object" && typeof x.path === "string" && FILE_REF.test(x.path)) {
            const up = await ensure(FILE_REF.exec(x.path)[1], onStep);
            return { ...x, path: up.path, name: x.name || up.name, mime: x.mime || up.mime };
          }
          return resolve(x, onStep, depth + 1);
        }));
      } else if (k === "path" && typeof v === "string" && FILE_REF.test(v)) {
        const up = await ensure(FILE_REF.exec(v)[1], onStep);
        out.path = up.path;
        if (!input.name) out.name = up.name;
        if (!input.mime) out.mime = up.mime;
      } else {
        out[k] = await resolve(v, onStep, depth + 1);
      }
    }
    return out;
  }

  const hasRefs = (input) => /"file:[a-z0-9_-]{8,64}"/.test(JSON.stringify(input ?? null));
  return { ensure, resolve, hasRefs };
}
