// Redacting, size-rotated file logger (userData/logs/main.log). Callers log metadata only:
// event names, endpoints, HTTP status, durations. Message text and file contents are never logged.
import fs from "node:fs";
import path from "node:path";

const MAX_BYTES = 1024 * 1024; // rotate at 1 MB
const KEEP = 3;                // main.log + main.1.log + main.2.log
const SECRET_KEYS = "refresh_token|access_token|id_token|id_token_hint|password|parola|code_verifier|client_secret";
// Field names that would carry user content if a caller passed them by mistake.
const CONTENT_KEYS = new Set(["text", "messages", "message_text", "body", "data", "files", "content", "password", "identifier", "base64", "wav", "instructions", "input"]);

const RULES = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]"],
  [/\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g, "[JWT]"],
  // "key":"value" in JSON, then the same inside an already stringified JSON (\"key\":\"value\").
  [new RegExp(`("(?:${SECRET_KEYS})"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`, "gi"), '$1"[REDACTED]"'],
  [new RegExp(`(\\\\"(?:${SECRET_KEYS})\\\\"\\s*:\\s*\\\\")[^"]*?(\\\\")`, "gi"), "$1[REDACTED]$2"],
  // key=value in form bodies and query strings.
  [new RegExp(`\\b((?:${SECRET_KEYS})\\s*=\\s*)[^\\s&"',;}]+`, "gi"), "$1[REDACTED]"],
  [/\b((?:code|state)=)[^\s&"',;}]+/gi, "$1[REDACTED]"],
  [/\b(data:[\w.+-]+\/[\w.+-]+(?:;[\w=.+-]+)*;base64,)[A-Za-z0-9+/=_-]+/g, "$1[REDACTED]"],
  [/[A-Za-z0-9+/_-]{200,}={0,2}/g, "[BASE64]"],
];

export function redact(input) {
  let s = String(input == null ? "" : input);
  for (const [re, to] of RULES) s = s.replace(re, to);
  return s;
}

function clean(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (v === undefined) continue;
    if (CONTENT_KEYS.has(k.toLowerCase())) { out[k] = "[omitted]"; continue; }
    const s = typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" || v === null ? v : JSON.stringify(v);
    out[k] = typeof s === "string" && s.length > 400 ? s.slice(0, 400) + "…" : s;
  }
  return out;
}

export function createLog({ dir } = {}) {
  const file = dir ? path.join(dir, "main.log") : null;
  let size = -1; // unknown until the first write

  function rotate() {
    for (let i = KEEP - 1; i >= 1; i--) {
      const from = i === 1 ? file : path.join(dir, `main.${i - 1}.log`);
      try { fs.renameSync(from, path.join(dir, `main.${i}.log`)); } catch { /* nothing to rotate */ }
    }
    size = 0;
  }

  function write(level, event, fields) {
    if (!file) return;
    try {
      const line = redact(JSON.stringify({ ts: new Date().toISOString(), level, event: String(event), ...clean(fields) })) + "\n";
      if (size < 0) {
        fs.mkdirSync(dir, { recursive: true });
        try { size = fs.statSync(file).size; } catch { size = 0; }
      }
      const bytes = Buffer.byteLength(line);
      if (size + bytes > MAX_BYTES) rotate();
      fs.appendFileSync(file, line);
      size += bytes;
    } catch { /* logging must never break the app */ }
  }

  return {
    dir: dir || null,
    info: (event, fields) => write("info", event, fields),
    warn: (event, fields) => write("warn", event, fields),
    error: (event, fields) => write("error", event, fields),
  };
}
