// Stitching of AI video parts into one clip in the renderer (docs/CONTRACT.md §12.6): a port of stitch() in
// mobile/crm/crm-video.js – the parts one after another on a canvas, the agency logo in the middle at 42 %
// opacity and the label „AI визуализация“ bottom-right, recorded with MediaRecorder (MP4 first, WebM fallback).
// The parts come from MAIN's file store as blobs (media-src blob: is allowed by the CSP); nothing goes online.
import { useSyncExternalStore } from "react";
import { ted } from "../bridge.js";
import { blobToBase64 } from "./files.js";

const LOGO_URL = new URL("../assets/logo.png", import.meta.url).href;
const MIMES = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
export const MAX_STITCHED = 20 * 1048576; // ted.files.add limit (docs/CONTRACT.md §8.1)
const LABEL = "AI визуализация";

export function pickMime() {
  if (typeof window === "undefined" || !window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) || "";
}

function loadImage(url) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null); // the clip is still made, only without the logo
    im.src = url;
  });
}

function loadVideo(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = "auto";
    const t = setTimeout(() => reject(new Error("частите не се заредиха навреме")), 30000);
    v.onloadedmetadata = () => { clearTimeout(t); resolve(v); };
    v.onerror = () => { clearTimeout(t); reject(new Error("част от видеото не се отвори")); };
    v.src = url;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// partBlobs: Blob[] in order -> {blob, ext}. onProgress(text) gets plain Bulgarian progress ("12 / 40 сек").
export async function stitch(partBlobs, { logoUrl = LOGO_URL, onProgress } = {}) {
  if (typeof window === "undefined" || !window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("тази версия на програмата не може да сглоби видео");
  }
  const blobs = (Array.isArray(partBlobs) ? partBlobs : []).filter((b) => b && b.size);
  if (!blobs.length) throw new Error("няма готови части");
  const say = (t) => { if (typeof onProgress === "function") { try { onProgress(t); } catch { /* display only */ } } };
  const urls = blobs.map((b) => URL.createObjectURL(b));
  let raf = 0;
  try {
    const logo = logoUrl ? await loadImage(logoUrl) : null;
    say("отварям частите");
    const vids = await Promise.all(urls.map(loadVideo));
    const dur = (v) => (Number.isFinite(v.duration) ? v.duration : 0);
    const total = vids.reduce((n, v) => n + dur(v), 0);
    let W = Math.min(1080, vids[0].videoWidth || 1280);
    let H = Math.round((W * (vids[0].videoHeight || 720)) / (vids[0].videoWidth || 1280));
    W -= W % 2; H -= H % 2;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const stream = cv.captureStream(30);
    const mime = pickMime();
    // A lower bitrate than the site (3–4 Mbps there): the result must fit the 20 MB of the local file store, so a long
    // walk gets a proportionally lower bitrate (≈ 18 MB of video in total, never below 0.6 Mbps).
    const fit = total > 0 ? Math.floor((18 * 1048576 * 8) / total) : Infinity;
    const bps = Math.max(600000, Math.min(H >= 1000 || W >= 1000 ? 3000000 : 2200000, fit));
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bps }) : new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const ext = /mp4/.test(rec.mimeType || mime) ? "mp4" : "webm";
    let cur = 0;
    let played = 0;
    let lastTick = 0;
    const draw = () => {
      const v = vids[cur];
      if (!v) return;
      ctx.drawImage(v, 0, 0, W, H);
      if (logo && logo.naturalWidth) {
        const lw = Math.round(Math.min(W, H) * 0.62);
        const lh = Math.round((lw * logo.naturalHeight) / logo.naturalWidth);
        ctx.save(); ctx.globalAlpha = 0.42; ctx.shadowColor = "rgba(255,248,235,.9)"; ctx.shadowBlur = Math.round(W * 0.02);
        ctx.drawImage(logo, Math.round((W - lw) / 2), Math.round((H - lh) / 2), lw, lh); ctx.restore();
      }
      const fs = Math.round(Math.min(W, H) * 0.034);
      ctx.font = "700 " + fs + "px TedText,'Roboto Condensed',Arial,sans-serif";
      const tw = ctx.measureText(LABEL).width;
      ctx.fillStyle = "rgba(60,10,20,.45)"; roundRect(ctx, W - tw - fs * 2.2, H - fs * 2.6, tw + fs * 1.4, fs * 1.7, fs * 0.85); ctx.fill();
      ctx.fillStyle = "rgba(255,243,220,.95)"; ctx.textBaseline = "middle"; ctx.fillText(LABEL, W - tw - fs * 1.5, H - fs * 1.75);
      const t = Date.now();
      if (t - lastTick > 1000) {
        lastTick = t;
        say(total ? Math.min(Math.round(played + (v.currentTime || 0)), Math.round(total)) + " / " + Math.round(total) + " сек" : "част " + (cur + 1) + " от " + vids.length);
      }
      raf = requestAnimationFrame(draw);
    };
    const blob = await new Promise((resolve, reject) => {
      const playNext = () => {
        const v = vids[cur];
        if (!v) { cancelAnimationFrame(raf); setTimeout(() => { try { rec.stop(); } catch { /* already stopped */ } }, 120); return; }
        v.onended = () => { played += dur(v); cur += 1; playNext(); };
        try { v.currentTime = 0; } catch { /* first frame */ }
        const p = v.play();
        if (p && p.catch) p.catch((err) => reject(new Error("възпроизвеждането спря" + (err && err.message ? ": " + err.message : ""))));
      };
      rec.onstop = () => resolve(new Blob(chunks, { type: (rec.mimeType || mime || "video/webm").split(";")[0] }));
      rec.onerror = () => reject(new Error("записът не успя"));
      rec.start(500); draw(); playNext();
    });
    return { blob, ext };
  } finally {
    cancelAnimationFrame(raf);
    urls.forEach((u) => URL.revokeObjectURL(u));
  }
}

/* ---------- One stitching run per video job (the chat card, the wizard and the background hook share it) ---------- */
const runs = new Map(); // jobId -> {status:"run"|"done"|"fail", info?, error?, file?}
const subs = new Set();
const put = (jobId, v) => { runs.set(jobId, { ...(runs.get(jobId) || {}), ...v }); subs.forEach((f) => f()); };
const fileName = (job, ext) => "AI видео" + (job.source && job.source.code ? " " + String(job.source.code).replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) : "") + "." + ext;

// Starts stitching when the job waits for it (status "stitch"); a second call for the same job does nothing.
export function ensureStitch(job) {
  if (!job || typeof job.id !== "string" || job.status !== "stitch" || runs.has(job.id)) return;
  if (!ted || !ted.files || !ted.video) return;
  const parts = (Array.isArray(job.parts) ? job.parts : []).filter((p) => p && p.status === "done" && p.fileId);
  put(job.id, { status: "run", info: "подготвям частите" });
  (async () => {
    try {
      if (!parts.length) throw new Error("няма готови части");
      const blobs = [];
      for (let k = 0; k < parts.length; k++) {
        put(job.id, { info: "чета част " + (k + 1) + " от " + parts.length });
        const r = await ted.files.read({ id: parts[k].fileId });
        if (!r || !r.ok || !r.data) throw new Error("част " + parts[k].n + " не се прочете" + (r && r.error ? " (" + r.error + ")" : ""));
        blobs.push(new Blob([r.data], { type: r.mime || "video/mp4" }));
      }
      const out = await stitch(blobs, { onProgress: (info) => put(job.id, { info }) });
      if (out.blob.size > MAX_STITCHED) throw new Error("сглобеното видео е над 20 MB – частите остават отделно");
      put(job.id, { info: "записвам видеото" });
      const data = await blobToBase64(out.blob);
      const a = await ted.files.add({ name: fileName(job, out.ext), mime: out.blob.type || "video/" + out.ext, data, ...(job.chatId ? { chatId: String(job.chatId).slice(0, 64) } : {}), ...(job.temporary ? { temporary: true } : {}) });
      if (!a || !a.ok || !a.file) throw new Error((a && a.error) || "видеото не се записа");
      const f = await ted.video.finish({ jobId: job.id, fileId: a.file.id });
      if (!f || !f.ok) throw new Error((f && f.error) || "видеото не се записа");
      put(job.id, { status: "done", info: "", file: f.file || a.file });
    } catch (e) {
      put(job.id, { status: "fail", info: "", error: String((e && e.message) || "грешка") });
    }
  })();
}

export function retryStitch(job) {
  if (!job) return;
  const r = runs.get(job.id);
  if (r && r.status === "run") return;
  runs.delete(job.id);
  ensureStitch(job);
}

export function useStitch(jobId) {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb); },
    () => (jobId ? runs.get(jobId) || null : null),
    () => null,
  );
}
