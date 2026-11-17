// Pictures inside answers (docs/CONTRACT.md §16 „Images in answers“). The renderer has no network: the bytes of a web
// picture come from MAIN (ted.browse.image – the SSRF-guarded browse session, https only, ≤ 8 MB, image/* by magic
// bytes), a picture of the file store from ted.files.read. Shown as blob: URLs (CSP img-src allows blob:); one cache
// per window, at most 4 loads at a time, so a long answer with many photos does not slow the window down.
import { ted } from "../bridge.js";

const MAX_CACHE = 160;
const PARALLEL = 4;
const cache = new Map(); // key -> Promise<{ok, url?, error?}>
const waiting = [];
let running = 0;

function pump() {
  while (running < PARALLEL && waiting.length) {
    const job = waiting.shift();
    running++;
    job().finally(() => { running--; pump(); });
  }
}
const queued = (fn) => new Promise((resolve) => { waiting.push(() => fn().then(resolve, () => resolve({ ok: false, error: "Снимката не можа да се зареди." }))); pump(); });

function remember(key, make) {
  if (cache.has(key)) {
    const p = cache.get(key);
    cache.delete(key); cache.set(key, p); // newest last
    return p;
  }
  const p = queued(make).then((r) => {
    if (!r.ok) cache.delete(key); // a failed load may be tried again (a click on the chip)
    return r;
  });
  cache.set(key, p);
  while (cache.size > MAX_CACHE) {
    const [old, op] = cache.entries().next().value;
    cache.delete(old);
    op.then((r) => { if (r && r.ok && r.url) setTimeout(() => URL.revokeObjectURL(r.url), 60_000); });
  }
  return p;
}

const blobOf = (r, fallbackMime) => URL.createObjectURL(new Blob([r.data], { type: r.mime || fallbackMime || "image/jpeg" }));

// A picture from the internet, loaded by MAIN. clicked = the employee clicked its chip (MAIN loads any other address
// only when it handed it to the window itself as a tool result – review F13). -> {ok, url} | {ok:false, error}
export function loadWebImage(url, { clicked = false } = {}) {
  return remember("w:" + url, async () => {
    if (!ted || !ted.browse || typeof ted.browse.image !== "function") return { ok: false, error: "Снимките от интернет не се зареждат в тази версия." };
    const r = await ted.browse.image(clicked ? { url, clicked: true } : { url });
    if (!r || !r.ok || !r.data) return { ok: false, error: (r && r.error) || "Снимката не можа да се зареди." };
    if (!/^image\//.test(String(r.mime || ""))) return { ok: false, error: "Това не е снимка." };
    return { ok: true, url: blobOf(r) };
  });
}

// A picture of MAIN's file store (fetch_image results, CRM files of the same answer).
export function loadFileImage(id) {
  return remember("f:" + id, async () => {
    const r = await ted.files.read({ id, max: 25 * 1048576 });
    if (!r || !r.ok || !r.data) return { ok: false, error: (r && r.error) || "Снимката не можа да се прочете." };
    if (!/^image\//.test(String(r.mime || ""))) return { ok: false, error: "Файлът не е снимка." };
    return { ok: true, url: blobOf(r) };
  });
}
