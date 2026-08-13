type AssetMeta = {
  url?: string;
  original_filename?: string;
};

function readAssetBaseUrl(): string {
  const fromMeta =
    typeof import.meta !== "undefined"
      ? (import.meta.env.VITE_ASSET_BASE_URL as string | undefined)
      : undefined;
  return (fromMeta ?? process.env.VITE_ASSET_BASE_URL ?? "").replace(/\/$/, "");
}

/**
 * ZIP/Lovable 2026 uploads 404 on the live CDN. Map them to the clips that
 * still play on imotinadezhda.bg. Empty string = drop a dead webm source.
 */
const DEAD_ASSET_REMAP: Record<string, string> = {
  "04c82c0a-8275-4626-9f70-7fbbb5090fc1":
    "/__l5e/assets-v1/068b26b3-7934-475b-8748-c9b6ecd75694/burgas-hero.mp4",
  "c7f7bedb-2837-47c9-8e12-b8532f11c8fe": "",
  "57b33e0f-f4c1-4b23-bb6c-d59968a2a57f":
    "/__l5e/assets-v1/297ee429-0020-4355-8097-81c58a132732/home-hero-4k.mp4",
  "96218967-bd21-4dd7-b8e1-9c46bb79e907": "",
  "d2e02b63-4f4e-488a-8672-fa09aa8a358b":
    "/__l5e/assets-v1/7ce07196-c19d-48e1-bb40-d19f1f5c24a0/shumen-hero.mp4",
  "9297d518-fda1-4f56-ab09-2e8c6d164373": "",
  "f14f6d81-b8a5-4ee2-8a8c-a5b8270418bf":
    "/__l5e/assets-v1/b9b5fd44-8a3c-4346-a7d6-5c82c25bc946/varna-hero-4k.mp4",
  "12a55a13-6236-42b5-8879-0a3d7a945c7d": "",
  "7bb54391-fbc6-447c-a3a8-9ffdfcd059db":
    "/__l5e/assets-v1/2f5942d3-9ee6-44b6-b224-81464059b8bc/login-hero.mp4",
  "c3145703-c67f-474d-91aa-ab99c44cc81d": "",
  "d67e281b-a873-42c9-9fb6-f44017c3d48a":
    "/__l5e/assets-v1/4a562779-7070-43f8-898b-0aae62acf96b/navbar-desktop.png",
  "21633ae2-2713-4e13-9f76-6b5dee572953":
    "/__l5e/assets-v1/4a562779-7070-43f8-898b-0aae62acf96b/navbar-desktop.png",
};

function remapDeadAssetPath(path: string): string {
  const match = path.match(/\/assets-v1\/([0-9a-f-]{36})\//i);
  if (!match) return path;
  const mapped = DEAD_ASSET_REMAP[match[1]];
  return mapped === undefined ? path : mapped;
}

/** Same-origin media proxy (see vercel.json /media rewrite). No runtime Lovable dependency. */
function toMediaProxyPath(path: string): string {
  if (path.startsWith("/__l5e")) {
    // /__l5e is served natively on Lovable (preview + published .lovable.app).
    // On the custom domain imotinadezhda.bg, Vercel rewrites both /__l5e/* and
    // /media/* to the Lovable CDN (see vercel.json), so returning the raw path
    // works in every environment — including SSR, where `window` is undefined.
    return path;
  }
  return path;
}

/** Storage hosts from the previous Supabase project — rewrite to the active one. */
const LEGACY_SUPABASE_HOSTS = ["zcrzxgzyptqibsajoece.supabase.co"];

function activeSupabaseHost(): string {
  const raw =
    (typeof import.meta !== "undefined"
      ? (import.meta.env.VITE_SUPABASE_URL as string | undefined)
      : undefined) ?? process.env.VITE_SUPABASE_URL;
  if (!raw) return "";
  try {
    return new URL(raw).host;
  } catch {
    return "";
  }
}

/** Migrate storage URLs that still point at the old Supabase project host. */
export function fixLegacyStorageUrl(url: string): string {
  if (!url) return "";
  const host = activeSupabaseHost();
  if (!host) return url;
  for (const legacy of LEGACY_SUPABASE_HOSTS) {
    if (url.includes(legacy)) return url.split(legacy).join(host);
  }
  return url;
}

/** Resolve hosted asset URLs. Legacy /__l5e paths map to /media/* on imotinadezhda.bg. */
export function resolveAssetUrl(asset: AssetMeta | string): string {
  const raw = typeof asset === "string" ? asset : (asset.url ?? "");
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return fixLegacyStorageUrl(raw);
  if (raw.startsWith("/__l5e")) {
    const remapped = remapDeadAssetPath(raw);
    if (!remapped) return "";
    return toMediaProxyPath(remapped);
  }
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    const base = readAssetBaseUrl();
    return base ? `${base}${raw}` : raw;
  }
  return raw;
}

/** Prefer a bundled static import; fall back to resolved hosted URL. */
export function pickAssetUrl(localUrl: string | undefined, hosted: AssetMeta | string): string {
  if (localUrl) {
    const resolved = resolveAssetUrl(localUrl);
    if (resolved) return resolved;
  }
  return resolveAssetUrl(hosted);
}
