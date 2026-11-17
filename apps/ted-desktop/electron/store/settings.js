// Plain JSON preferences (nothing sensitive). Atomic writes; a corrupt file reads as {}.
import fs from "node:fs";
import path from "node:path";

export function createSettings({ file }) {
  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      const value = JSON.parse(fs.readFileSync(file, "utf8"));
      cache = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch { cache = {}; }
    return cache;
  }

  const get = () => structuredClone(load());

  // Shallow merge; a key set to undefined is removed.
  function set(patch) {
    const next = { ...load(), ...(patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {}) };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    const tmp = `${file}.${process.pid}.tmp`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
    fs.renameSync(tmp, file);
    cache = next;
    return get();
  }

  return { get, set };
}
