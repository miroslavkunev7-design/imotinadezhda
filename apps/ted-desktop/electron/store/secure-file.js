// Encrypted JSON files (Electron safeStorage = Windows DPAPI, bound to the Windows user).
// Writes are atomic (tmp + rename). A missing or unreadable file reads as null.
// Synchronous on purpose: files are small and callers stay simple.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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
    try {
      const value = JSON.parse(safeStorage.decryptString(raw));
      return value && typeof value === "object" ? value : null;
    } catch {
      // Corrupt or encrypted for another Windows user: keep one copy aside and start clean.
      try { fs.renameSync(file, file + ".corrupt"); } catch { /* ignore */ }
      return null;
    }
  }

  // Returns false (and writes nothing) when encryption is unavailable: never store plaintext.
  function write(name, value) {
    if (!available()) return false;
    const file = fileOf(name);
    const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    const data = safeStorage.encryptString(JSON.stringify(value));
    fs.mkdirSync(dir, { recursive: true });
    try {
      fs.writeFileSync(tmp, data, { mode: 0o600 });
      fs.renameSync(tmp, file);
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      throw e;
    }
    return true;
  }

  function remove(name) {
    try { fs.unlinkSync(fileOf(name)); } catch { /* already gone */ }
  }

  return { available, read, write, remove };
}
