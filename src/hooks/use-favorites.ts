import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "in_favorites_v1";

function readAll(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeAll(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent("in_favorites_changed"));
  } catch {
    /* quota or private mode */
  }
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>(() => readAll());

  useEffect(() => {
    const sync = () => setIds(readAll());
    window.addEventListener("storage", sync);
    window.addEventListener("in_favorites_changed", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("in_favorites_changed", sync as EventListener);
    };
  }, []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  const toggle = useCallback((id: string) => {
    const current = readAll();
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    writeAll(next);
    setIds(next);
    return next.includes(id);
  }, []);

  return { ids, has, toggle };
}

export async function shareProperty(opts: { title: string; url: string; text?: string }): Promise<"shared" | "copied" | "failed"> {
  const data = { title: opts.title, text: opts.text ?? opts.title, url: opts.url };
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      // User cancelled or share rejected — fall back to clipboard
      if (err instanceof Error && err.name === "AbortError") return "failed";
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(opts.url);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
