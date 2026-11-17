// AI video of a property (docs/CONTRACT.md §12): the same engines, prompts, prices and polling as the site's
// mobile/crm/crm-video.js + api/video.js. MAIN prepares, asks (the start is a paid action), runs the parts on the
// server (3 at a time) and downloads them; the renderer stitches them (canvas + MediaRecorder) and hands the
// result back with video.finish. Nothing here invents progress: statuses come from /api/video.
import crypto from "node:crypto";
import { SB_KEY, SB_URL, SITE } from "../backend/config.js";
import { CONC, FATAL, move, roomBg, WALK_BASE } from "./prompts.js";

export const NO_ENGINE = "На сървъра няма настроен ключ за AI видео (Vercel AI Gateway, Gemini или OpenAI). Видео не може да се направи, докато администраторът не добави ключ.";
export const FEW_PHOTOS = "Видео само от текст не може да се направи: двигателите правят клип между реални снимки. Прикачете поне 2 снимки (или 1 снимка с описание) – или първо направете AI снимка, после клип от нея.";
const PART_TIMEOUT_MS = 15 * 60_000;

export class VideoError extends Error {
  constructor(message, { retry = false, status } = {}) {
    super(message);
    this.retry = retry;
    this.status = status;
  }
}

export function durFor(engine, wanted = 5) {
  const durs = engine && Array.isArray(engine.durs) && engine.durs.length ? engine.durs : [wanted];
  return durs.reduce((a, x) => (Math.abs(x - wanted) < Math.abs(a - wanted) ? x : a), durs[0]);
}

export function estimate(parts, engine, duration) {
  const d = duration || durFor(engine);
  const price = Number(engine && engine.price) || 0.1;
  return { n: parts, sec: parts * d, cost: Math.round(parts * d * price * 100) / 100, min: Math.max(2, Math.ceil(parts / CONC) * 2) };
}

// photos: [{path|url, room}] in route order -> parts of consecutive pairs.
export function walkParts(photos) {
  const out = [];
  for (let i = 0; i < photos.length - 1; i++) {
    const a = photos[i];
    const b = photos[i + 1];
    out.push({ n: i + 1, title: `Част ${i + 1}: ${roomBg(a.room)} → ${roomBg(b.room)}`, prompt: `${WALK_BASE} ${move(a.room, b.room)}`, first: a.ref, last: b.ref, status: "idle" });
  }
  return out;
}

const refOf = (p) => (/^https?:\/\//.test(p) ? { url: p } : { path: p });
const publicJob = (j) => ({
  id: j.id, status: j.status,
  source: { ...(j.source.code ? { code: j.source.code } : {}), ...(j.source.title ? { title: j.source.title } : {}), photos: j.source.photos },
  parts: j.parts.map((p) => ({ n: p.n, title: p.title, status: p.status, ...(p.error ? { error: p.error } : {}), ...(p.fileId ? { fileId: p.fileId } : {}) })),
  aspect: j.aspect,
  ...(j.engines ? { engines: j.engines } : {}), ...(j.gateway ? { gateway: j.gateway } : {}), ...(j.defaults ? { defaults: j.defaults } : {}),
  ...(j.est ? { est: j.est } : {}), ...(j.engine ? { engine: j.engine } : {}), ...(j.duration ? { duration: j.duration } : {}),
  ...(j.fileId ? { fileId: j.fileId } : {}), ...(j.error ? { error: j.error } : {}),
  // Where the stitched clip belongs (the renderer adds it to the store with the same chat / temporary flag).
  ...(j.chatId ? { chatId: j.chatId } : {}), ...(j.temporary ? { temporary: true } : {}),
});

// thumb(buffer, mime) -> {data(base64 JPEG ≤ 512 px), width, height} | null   (main.js: nativeImage)
export function createVideo({
  session, http, tools, files, uploads, thumb = () => null, emit = () => {}, log,
  sleep = (ms, signal) => new Promise((resolve) => { const t = setTimeout(resolve, ms); signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true }); }),
  now = Date.now, pollMs = 6000, retryPollMs = 9000, partTimeoutMs = PART_TIMEOUT_MS,
}) {
  const jobs = new Map();
  const changed = (j) => { try { emit(publicJob(j)); } catch { /* window gone */ } };

  async function vapi(body, signal) {
    let res;
    try {
      res = await session.authed({ url: `${SITE}/api/video`, method: "POST", json: body, timeoutMs: 120_000, signal });
    } catch (e) {
      throw new VideoError(e.code === "auth" ? "Сесията е изтекла – влезте отново." : "Няма връзка със сървъра.", { retry: e.code !== "auth" });
    }
    const j = res.json;
    if (j && j.ok) return j;
    if (j && typeof j.error === "string") throw new VideoError(j.error.slice(0, 300), { status: res.status });
    throw new VideoError(`HTTP ${res.status}`, { retry: res.status >= 500, status: res.status });
  }

  async function propertyPics(id) {
    const res = await session.authed({ url: `${SB_URL}/rest/v1/nd_properties?id=eq.${encodeURIComponent(id)}&select=data`, method: "GET", headers: { apikey: SB_KEY }, timeoutMs: 30_000 });
    const rows = res.ok && Array.isArray(res.json) ? res.json : [];
    const pics = rows[0] && rows[0].data && Array.isArray(rows[0].data.pics) ? rows[0].data.pics : [];
    return pics.map((p) => (typeof p === "string" ? p : p && (p.path || p.url))).filter((p) => typeof p === "string" && p).slice(0, 30);
  }

  // Signed links (10 min) for storage paths; downloads without any Authorization header.
  async function photoBytes(paths) {
    const storage = paths.filter((p) => !/^https?:/.test(p));
    const urls = new Map(paths.filter((p) => /^https:/.test(p)).map((p) => [p, p]));
    if (storage.length) {
      const res = await session.authed({ url: `${SB_URL}/storage/v1/object/sign/nd-files`, method: "POST", headers: { apikey: SB_KEY }, json: { expiresIn: 600, paths: storage }, timeoutMs: 30_000 });
      for (const row of Array.isArray(res.json) ? res.json : []) {
        const s = row && (row.signedURL || row.signedUrl);
        if (row && row.path && s) urls.set(row.path, /^https?:/.test(s) ? s : `${SB_URL}/storage/v1${s.startsWith("/") ? "" : "/"}${s}`);
      }
    }
    const out = new Map();
    for (const p of paths) {
      const u = urls.get(p);
      if (!u) continue;
      try {
        const r = await http.request({ url: u, method: "GET", as: "arrayBuffer", timeoutMs: 60_000 });
        if (r.ok && r.buffer) out.set(p, Buffer.from(r.buffer));
      } catch { /* that photo keeps its place */ }
    }
    return out;
  }

  // AI route order + aspect; any failure keeps the listing's order (first outside, last the final view).
  async function route(photos, bytesOf) {
    const sent = [];
    let land = 0;
    let sized = 0;
    for (let i = 0; i < photos.length; i++) {
      const b = bytesOf(photos[i]);
      const t = b ? thumb(b.buffer, b.mime) : null;
      if (t && t.data) {
        sent.push({ i, data: t.data });
        if (t.width && t.height) { sized++; if (t.width > t.height) land++; }
      }
    }
    let aspect = sized ? (land * 2 >= sized ? "16:9" : "9:16") : "16:9";
    if (sent.length < 2) return { photos, aspect };
    try {
      const j = await vapi({ action: "route", photos: sent.map((x) => ({ data: x.data, mime: "image/jpeg" })) });
      const out = [];
      for (const o of Array.isArray(j.order) ? j.order : []) {
        const src = sent[o && o.i];
        if (src && photos[src.i] && !out.includes(photos[src.i])) { photos[src.i].room = String(o.room || "other"); out.push(photos[src.i]); }
      }
      for (const p of photos) if (!out.includes(p)) out.push(p);
      if (j.aspect === "16:9" || j.aspect === "9:16") aspect = j.aspect;
      return { photos: out, aspect };
    } catch (e) {
      if (log) log.warn("video.route_failed", { message: String(e.message).slice(0, 100) });
      return { photos, aspect };
    }
  }

  // -> {ok:true, job} | {ok:false, code, error, candidates?, job?}
  async function prepare({ code, fileIds = [], prompt, chatId, temporary } = {}) {
    const id = `v_${crypto.randomBytes(6).toString("hex")}`;
    let source;
    let photos = [];
    let localBytes = new Map();
    try {
      if (code) {
        const r = await tools.call("video.create", { code: String(code).slice(0, 60), mode: "walk" });
        if (!r.ok) return { ok: false, code: r.status === 404 ? "not_found" : "invalid", error: r.error };
        const res = r.result || {};
        if (Array.isArray(res.candidates)) return { ok: false, code: "candidates", error: "Няколко обяви съвпадат – коя от тях?", candidates: res.candidates.slice(0, 8) };
        const prop = res.start_video && res.start_video.property;
        if (!prop || !prop.id) return { ok: false, code: "not_found", error: "Обявата не е намерена." };
        const pics = await propertyPics(prop.id);
        source = { code: prop.code || String(code), title: prop.title || "", photos: pics.length, propertyId: prop.id };
        photos = pics.map((p, i) => ({ ref: refOf(p), key: p, room: i === 0 ? "out" : i === pics.length - 1 ? "final" : "other" }));
      } else {
        const refs = (Array.isArray(fileIds) ? fileIds : []).map((f) => files.ref(f)).filter((r) => r && r.kind === "image");
        if (!refs.length || (refs.length < 2 && !(prompt && String(prompt).trim()))) return { ok: false, code: "few_photos", error: FEW_PHOTOS };
        source = { title: "прикачени снимки", photos: refs.length };
        for (const ref of refs) {
          const up = await uploads.ensure(ref.id);
          const f = files.get(ref.id);
          localBytes.set(up.path, f ? { buffer: f.bytes, mime: ref.mime } : null);
          photos.push({ ref: { path: up.path }, key: up.path, room: "other" });
        }
        if (photos.length) photos[0].room = "out";
        if (photos.length > 1) photos[photos.length - 1].room = "final";
      }
    } catch (e) {
      return { ok: false, code: "invalid", error: e.message || "Снимките не могат да бъдат подготвени." };
    }
    if (photos.length < 2 && !(photos.length === 1 && prompt && String(prompt).trim())) return { ok: false, code: "few_photos", error: photos.length ? FEW_PHOTOS : "Обявата няма снимки." };

    let engines;
    let gateway;
    try {
      const e = await vapi({ action: "engines" });
      engines = (Array.isArray(e.engines) ? e.engines : []).map((x) => ({ id: String(x.id), name: String(x.name || x.id), note: String(x.note || ""), price: Number(x.price) || 0, frames: Number(x.frames) || 1, durs: (Array.isArray(x.durs) ? x.durs : []).map(Number).filter((n) => n > 0) }));
      gateway = e.gateway && typeof e.gateway === "object" ? { ok: !!e.gateway.ok, ...(e.gateway.balance != null ? { balance: e.gateway.balance } : {}) } : undefined;
    } catch (e) {
      return { ok: false, code: "invalid", error: `Двигателите за видео не могат да бъдат прочетени: ${e.message}` };
    }

    let aspect = "16:9";
    if (photos.length >= 2) {
      if (!localBytes.size) localBytes = await photoBytes(photos.map((p) => p.key)).then((m) => new Map([...m].map(([k, v]) => [k, { buffer: v, mime: "image/jpeg" }]))).catch(() => new Map());
      const r = await route(photos, (p) => localBytes.get(p.key));
      photos = r.photos;
      aspect = r.aspect;
    }
    const parts = photos.length >= 2
      ? walkParts(photos)
      : [{ n: 1, title: "Част 1: клип от снимката", prompt: `${String(prompt).trim().slice(0, 2000)}`, first: photos[0].ref, last: null, status: "idle" }];
    const job = {
      id, status: engines.length ? "approval" : "need_engine", source, parts, aspect, engines, gateway, chatId, temporary: !!temporary,
      ctl: null,
    };
    if (engines.length) {
      const def = engines[0];
      job.defaults = { engine: def.id, duration: durFor(def) };
      job.est = estimate(parts.length, def, job.defaults.duration);
    } else {
      job.error = NO_ENGINE;
    }
    jobs.set(id, job);
    changed(job);
    if (!engines.length) return { ok: false, code: "no_engine", error: NO_ENGINE, job: publicJob(job) };
    return { ok: true, job: publicJob(job) };
  }

  const savePath = (job, n) => `ted/video/${String(job.source.code || "misc").replace(/[^\w\-а-яА-Я]+/g, "_")}/part-${n}-${now()}.mp4`;

  async function poll(job, remote, path) {
    const t0 = now();
    for (;;) {
      if (job.ctl.signal.aborted) throw new VideoError("Спряно.");
      try {
        const j = await vapi({ action: "status", job: remote, save: path }, job.ctl.signal);
        if (j.done) return j;
        if (now() - t0 > partTimeoutMs) throw new VideoError("Частта отне повече от 15 минути.");
        await sleep(pollMs, job.ctl.signal);
      } catch (e) {
        if (job.ctl.signal.aborted) throw new VideoError("Спряно.");
        if (e.retry && now() - t0 < partTimeoutMs) { await sleep(retryPollMs, job.ctl.signal); continue; }
        throw e;
      }
    }
  }

  async function runPart(job, p, engine) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (job.ctl.signal.aborted) return false;
      p.status = "run";
      p.error = undefined;
      changed(job);
      try {
        const st = await vapi({
          action: "start", engine: engine.id, prompt: p.prompt.slice(0, 2400), first: p.first,
          ...(p.last && engine.frames > 1 ? { last: p.last } : {}), aspect: job.aspect, duration: job.duration, resolution: "720p",
        }, job.ctl.signal);
        const done = await poll(job, st.job, savePath(job, p.n));
        const got = await http.request({ url: done.url, method: "GET", as: "arrayBuffer", timeoutMs: 600_000 });
        if (!got.ok || !got.buffer) throw new VideoError(`Частта е готова, но не се изтегли (HTTP ${got.status}).`);
        const r = files.add({ name: `${p.title.replace(/[:→]/g, " ").replace(/\s+/g, " ").trim()}.mp4`, mime: done.mime || "video/mp4", data: Buffer.from(got.buffer), origin: "crm", crm: { path: done.path }, chatId: job.chatId, temporary: job.temporary, maxBytes: 300 * 1048576 });
        if (!r.ok) throw new VideoError(r.error);
        p.fileId = r.file.id;
        p.status = "done";
        changed(job);
        return true;
      } catch (e) {
        p.error = e.message;
        if (job.ctl.signal.aborted) { p.status = "idle"; changed(job); return false; }
        if (FATAL.test(e.message)) { job.fatal = e.message; job.ctl.abort(); p.status = "err"; changed(job); return false; }
        if (attempt < 3) { await sleep(5000 * attempt, job.ctl.signal); continue; }
        p.status = "err";
        changed(job);
        return false;
      }
    }
    return false;
  }

  async function runAll(job, engine) {
    const queue = job.parts.filter((p) => p.status !== "done");
    const worker = async () => {
      while (queue.length && !job.ctl.signal.aborted) await runPart(job, queue.shift(), engine);
    };
    await Promise.all(Array.from({ length: Math.min(CONC, queue.length || 1) }, worker));
    const ok = job.parts.filter((p) => p.status === "done").length;
    if (job.status === "cancelled") return;
    if (job.fatal) { job.status = "failed"; job.error = `Спрях: ${job.fatal}`; }
    else if (ok === job.parts.length) { job.status = job.parts.length === 1 ? "done" : "stitch"; if (job.parts.length === 1) job.fileId = job.parts[0].fileId; }
    else { job.status = "failed"; job.error = `Готови ${ok} от ${job.parts.length} части; останалите не успяха след 3 опита.`; }
    changed(job);
    if (log) log.info("video.finished", { status: job.status, parts: job.parts.length, ok });
  }

  // The employee's click on „Започни (платено)“ (or the agent's approval card) = the approval.
  async function start({ jobId, engine, duration } = {}) {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, code: "not_found", error: "Задачата за видео не е намерена." };
    if (!["approval", "failed"].includes(job.status)) return { ok: false, code: "invalid", error: "Видеото вече е започнато." };
    const eng = (job.engines || []).find((e) => e.id === engine);
    if (!eng) return { ok: false, code: "invalid", error: "Изберете двигател от списъка." };
    const d = Number(duration);
    if (!eng.durs.includes(d)) return { ok: false, code: "invalid", error: "Изберете дължина от списъка." };
    job.engine = eng.id;
    job.duration = d;
    job.est = estimate(job.parts.length, eng, d);
    job.status = "running";
    job.error = undefined;
    job.fatal = undefined;
    job.ctl = new AbortController();
    changed(job);
    if (log) log.info("video.start", { parts: job.parts.length, engine: eng.id, duration: d });
    runAll(job, eng).catch((e) => { job.status = "failed"; job.error = String(e.message || e); changed(job); });
    return { ok: true };
  }

  function cancel({ jobId } = {}) {
    const job = jobs.get(jobId);
    if (!job) return { ok: true };
    if (job.ctl) job.ctl.abort();
    if (!["done"].includes(job.status)) { job.status = "cancelled"; changed(job); }
    return { ok: true };
  }

  function finish({ jobId, fileId } = {}) {
    const job = jobs.get(jobId);
    if (!job) return { ok: false, error: "Задачата за видео не е намерена." };
    const ref = files.ref(fileId);
    if (!ref || ref.kind !== "video") return { ok: false, error: "Сглобеното видео не е намерено." };
    // The renderer stored the clip through files.add (origin "user" there); it is Ted's work and belongs to the job's chat.
    const made = files.update(ref.id, { origin: "ted", ...(job.chatId && !ref.chatId ? { chatId: job.chatId } : {}) }) || ref;
    job.fileId = ref.id;
    job.status = "done";
    changed(job);
    return { ok: true, file: { ...made } };
  }

  const get = (jobId) => (jobs.has(jobId) ? publicJob(jobs.get(jobId)) : null);
  function detach() {
    for (const job of jobs.values()) if (job.ctl) job.ctl.abort();
    jobs.clear();
  }
  return { prepare, start, cancel, finish, get, detach };
}
