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
  if (path.startsWith("/__l5e")) return `/media${path.slice("/__l5e".length)}`;
  return path;
}

/** Resolve hosted asset URLs. Legacy /__l5e paths map to /media/* on imotinadezhda.bg. */
export function resolveAssetUrl(asset: AssetMeta | string): string {
  const raw = typeof asset === "string" ? asset : (asset.url ?? "");
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
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
