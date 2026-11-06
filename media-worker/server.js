"use strict";
const http = require("http");
const crypto = require("crypto");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.MEDIA_WORKER_SECRET || "";
const API = process.env.SITE_API_BASE || "https://imotinadezhda.bg";

function hmacHex(buf) {
  return crypto.createHmac("sha256", SECRET).update(buf).digest("hex");
}

function verify(req, raw) {
  if (!SECRET) return process.env.ALLOW_INSECURE_MEDIA_WORKER === "1";
  const sig = String(req.headers["x-video-hmac"] || "").replace(/^sha256=/i, "");
  const a = Buffer.from(hmacHex(raw));
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function run(cmd, args) {
  return new Promise((ok, bad) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    p.on("close", (code) => (code === 0 ? ok({ out, err }) : bad(new Error(err || out || (cmd + " exit " + code)))));
  });
}

async function heicToJpg(src, dest) {
  try {
    await run("heif-convert", [src, dest]);
    return dest;
  } catch (e) {
    await run("ffmpeg", ["-y", "-i", src, dest]);
    return dest;
  }
}

async function qaMp4(file) {
  const { out } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height", "-of", "json", file]);
  const j = JSON.parse(out || "{}");
  const dur = Number(j.format && j.format.duration) || 0;
  if (dur < 1) throw new Error("QA: duration too short");
  return { duration_sec: Math.round(dur * 10) / 10, probe: j };
}

async function renderConcat(jobId, clipPaths, outFile) {
  const list = path.join(path.dirname(outFile), "concat.txt");
  fs.writeFileSync(list, clipPaths.map((p) => "file '" + p.replace(/'/g, "'\\''") + "'").join("\n"));
  await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", outFile]);
  return qaMp4(outFile);
}

async function postEvent(payload) {
  const body = Buffer.from(JSON.stringify(payload));
  const headers = { "Content-Type": "application/json", "Content-Length": body.length };
  if (SECRET) headers["x-video-hmac"] = hmacHex(body);
  await fetch(API + "/api/video?action=events", { method: "POST", headers, body });
}

async function handleRender(job) {
  const jobId = job.job_id;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "imoti-vid-"));
  try {
    await postEvent({ job_id: jobId, kind: "media.assembling", status: "assembling", progress: { stage: "assembling", label: "Сглобяване", pct: 80, message: "FFmpeg" } });
    // Clips may be provided as local paths (dev) or worker downloads them in a fuller deploy.
    const clips = Array.isArray(job.clip_paths) ? job.clip_paths : [];
    if (!clips.length) {
      // Placeholder silent slate so contract path is testable without fal.
      const slate = path.join(work, "slate.mp4");
      await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=0x2a0a12:s=1280x720:d=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", slate]);
      clips.push(slate);
    }
    const out = path.join(work, "final.mp4");
    const qa = await renderConcat(jobId, clips, out);
    await postEvent({
      job_id: jobId,
      kind: "media.ready",
      status: "qa",
      progress: { stage: "qa", label: "Проверка", pct: 92, message: "QA OK " + qa.duration_sec + "s" },
      result: { local_path: out, duration_sec: qa.duration_sec, note: "Upload to nd-files/video/<job>/final.mp4 via service role in full deploy" }
    });
    return { ok: true, qa, out };
  } catch (e) {
    await postEvent({ job_id: jobId, kind: "media.failed", status: "failed", error: String(e.message || e), progress: { stage: "failed", label: "Неуспех", pct: 100, message: String(e.message || e) } });
    throw e;
  } finally {
    /* keep tmp for debug if MEDIA_KEEP_TMP=1 */
    if (process.env.MEDIA_KEEP_TMP !== "1") {
      try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) {}
    }
  }
}

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    const b = Buffer.from(JSON.stringify(obj));
    res.writeHead(code, { "Content-Type": "application/json", "Content-Length": b.length });
    res.end(b);
  };
  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true, ffmpeg: true });
  if (req.method === "POST" && (req.url === "/render" || req.url === "/heic")) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    if (!verify(req, raw)) return send(401, { ok: false, error: "HMAC" });
    let body = {};
    try { body = JSON.parse(raw.toString("utf8") || "{}"); } catch (e) { return send(400, { ok: false, error: "JSON" }); }
    try {
      if (req.url === "/heic") {
        const dest = body.dest || body.src.replace(/\.(heic|heif)$/i, ".jpg");
        await heicToJpg(body.src, dest);
        return send(200, { ok: true, dest });
      }
      const r = await handleRender(body);
      return send(200, r);
    } catch (e) {
      return send(500, { ok: false, error: String(e.message || e) });
    }
  }
  send(404, { ok: false, error: "not found" });
});

server.listen(PORT, () => console.log("media-worker on :" + PORT));
