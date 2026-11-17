// Encrypted JSON files (Electron safeStorage = Windows DPAPI, bound to the Windows user).
// Writes are atomic (tmp + rename). A missing or unreadable file reads as null.
// Synchronous on purpose: files are small and callers stay simple.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Short synchronous pause (the store API is synchronous by design).
function pause(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) { /* spin */ }
  }
}

// tmp + rename, so a crash never leaves a half-written file. On Windows an antivirus or the search
// indexer may hold the target for a moment: the rename is retried briefly before giving up.
export function writeAtomic(file, data, options) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(tmp, data, options);
    for (let attempt = 0; ; attempt++) {
      try {
        fs.renameSync(tmp, file);
        break;
      } catch (e) {
        if (attempt >= 4 || !["EPERM", "EACCES", "EBUSY"].includes(e.code)) throw e;
        pause(40);
      }
    }
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw e;
  }
}

// Keeps any name inside `dir`: unsafe characters are escaped, so distinct names never collide.
function fileName(name) {
  const safe = String(name).replace(/[^A-Za-z0-9_-]/g, (c) => "~" + c.codePointAt(0).toString(16));
  if (!safe) throw new Error("secure store: empty name");
  return safe + ".bin";
}

export function createSecureStore({ dir, safeStorage }) {
  const fileOf = (name) => path.join(dir, fileName(name));

  function available() {
    try { return !!safeStorage && safeStorage.isEncryptionAvailable(); } catch { return false; }
  }

  function read(name) {
    const file = fileOf(name);
    let raw;
    try { raw = fs.readFileSync(file); } catch { return null; }
    if (!available()) return null; // cannot decrypt right now: leave the file untouched
    try {
      const value = JSON.parse(safeStorage.decryptString(raw));
      if (value && typeof value === "object") return value;
    } catch { /* handled below */ }
    // Corrupt or encrypted for another Windows user: keep one copy aside and start clean.
    try { fs.renameSync(file, file + ".corrupt"); } catch { /* ignore */ }
    return null;
  }

  // Returns false (and writes nothing) when encryption is unavailable: never store plaintext.
  function write(name, value) {
    if (!available()) return false;
    writeAtomic(fileOf(name), safeStorage.encryptString(JSON.stringify(value)), { mode: 0o600 });
    return true;
  }

  function remove(name) {
    try { fs.unlinkSync(fileOf(name)); } catch { /* already gone */ }
  }

  return { available, read, write, remove };
}
