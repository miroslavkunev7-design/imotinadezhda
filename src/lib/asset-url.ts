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
  if (raw.startsWith("/__l5e")) return toMediaProxyPath(raw);
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    const base = readAssetBaseUrl();
    return base ? `${base}${raw}` : raw;
  }
  return raw;
}

/** Prefer a bundled static import; fall back to resolved hosted URL. */
export function pickAssetUrl(localUrl: string | undefined, hosted: AssetMeta | string): string {
  if (localUrl) return localUrl;
  return resolveAssetUrl(hosted);
}
