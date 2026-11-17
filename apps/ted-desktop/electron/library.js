// Encrypted local library (docs/CONTRACT.md §11.1): every image, document and video Ted made or the user
// attached, kept per CRM user. File bytes: userData/library/<first 16 hex of sha256(CRM user id)>/<id>.bin,
// AES-256-GCM with a random 12-byte IV per file. The key ("library-key-<id>") and the index ("library-<id>",
// FileRef list) live in the secure store (Windows DPAPI). Without Windows encryption nothing is written to disk.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const MAX_ITEMS = 5000;
const ID = /^[a-z0-9_-]{8,64}$/;

export function encrypt(key, bytes) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([Buffer.from("TDL1"), iv, cipher.getAuthTag(), body]);
}

export function decrypt(key, blob) {
  if (!Buffer.isBuffer(blob) || blob.length < 32 || blob.toString("latin1", 0, 4) !== "TDL1") throw new Error("library: bad file");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, blob.subarray(4, 16));
  decipher.setAuthTag(blob.subarray(16, 32));
  return Buffer.concat([decipher.update(blob.subarray(32)), decipher.final()]);
}

export function createLibrary({ dir, secureStore, owner, log }) {
  let cache = null; // {uid, key, items}

  const uid = () => {
    const id = typeof owner === "function" ? owner() : null;
    return typeof id === "string" && id ? id : null;
  };
  const folder = (id) => path.join(dir, crypto.createHash("sha256").update(id).digest("hex").slice(0, 16));
  const available = () => !!uid() && !!secureStore && secureStore.available();

  function state() {
    const id = uid();
    if (!id || !available()) return null;
    if (cache && cache.uid === id) return cache;
    let keyRec = secureStore.read(`library-key-${id}`);
    if (!keyRec || typeof keyRec.key !== "string") {
      keyRec = { v: 1, key: crypto.randomBytes(32).toString("base64") };
      if (!secureStore.write(`library-key-${id}`, keyRec)) return null;
    }
    const index = secureStore.read(`library-${id}`);
    const items = index && Array.isArray(index.items) ? index.items.filter((r) => r && ID.test(r.id)) : [];
    cache = { uid: id, key: Buffer.from(keyRec.key, "base64"), items };
    return cache;
  }

  function saveIndex(st) {
    secureStore.write(`library-${st.uid}`, { v: 1, items: st.items });
  }

  // ref = FileRef without bytes. -> true when stored (false: no encryption / no user).
  function put(ref, bytes) {
    const st = state();
    if (!st || !ID.test(ref.id)) return false;
    const target = path.join(folder(st.uid), `${ref.id}.bin`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, encrypt(st.key, bytes), { mode: 0o600 });
    st.items = [{ ...ref }, ...st.items.filter((r) => r.id !== ref.id)];
    // The oldest entries leave when the index is full.
    while (st.items.length > MAX_ITEMS) {
      const old = st.items.pop();
      try { fs.unlinkSync(path.join(folder(st.uid), `${old.id}.bin`)); } catch { /* already gone */ }
    }
    saveIndex(st);
    return true;
  }

  function ref(id) {
    const st = state();
    return st ? st.items.find((r) => r.id === id) || null : null;
  }

  function get(id) {
    const st = state();
    const r = st && st.items.find((x) => x.id === id);
    if (!r) return null;
    try {
      return { ref: r, bytes: decrypt(st.key, fs.readFileSync(path.join(folder(st.uid), `${id}.bin`))) };
    } catch (e) {
      if (log) log.warn("library.read_failed", { message: String((e && e.message) || e) });
      return null;
    }
  }

  function update(id, patch) {
    const st = state();
    const i = st ? st.items.findIndex((r) => r.id === id) : -1;
    if (i < 0) return null;
    st.items[i] = { ...st.items[i], ...patch };
    saveIndex(st);
    return st.items[i];
  }

  function list() {
    const st = state();
    return st ? st.items.slice() : [];
  }

  function remove(id) {
    const st = state();
    if (!st) return false;
    st.items = st.items.filter((r) => r.id !== id);
    try { fs.unlinkSync(path.join(folder(st.uid), `${id}.bin`)); } catch { /* already gone */ }
    saveIndex(st);
    return true;
  }

  function clear() {
    const st = state();
    if (!st) return false;
    st.items = [];
    saveIndex(st);
    try { fs.rmSync(folder(st.uid), { recursive: true, force: true }); } catch { /* best effort */ }
    return true;
  }

  function stats() {
    const st = state();
    if (!st) return { bytes: 0, count: 0 };
    let bytes = 0;
    try {
      for (const f of fs.readdirSync(folder(st.uid))) bytes += fs.statSync(path.join(folder(st.uid), f)).size;
    } catch { /* empty */ }
    return { bytes, count: st.items.length };
  }

  // CRM sign-out or another user: the decrypted key and index leave memory.
  function detach() {
    cache = null;
  }

  return { available, put, get, ref, update, list, remove, clear, stats, detach };
}
