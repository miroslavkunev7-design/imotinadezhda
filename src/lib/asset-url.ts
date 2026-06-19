type AssetMeta = {
  url?: string;
  original_filename?: string;
};

function readAssetBaseUrl(): string {
  const fromMeta =
    typeof import.meta !== "undefined"
      ? (import.meta.env.VITE_ASSET_BASE_URL as string | undefined) ??
        (import.meta.env.VITE_LOVABLE_ASSET_BASE as string | undefined)
      : undefined;
  return (
    fromMeta ??
    process.env.VITE_ASSET_BASE_URL ??
    process.env.VITE_LOVABLE_ASSET_BASE ??
    ""
  ).replace(/\/$/, "");
}

/** Resolve CDN/static asset URLs (supports legacy /__l5e paths via VITE_ASSET_BASE_URL). */
export function resolveAssetUrl(asset: AssetMeta | string): string {
  const raw = typeof asset === "string" ? asset : (asset.url ?? "");
  if (!raw) return "";
  if (raw.startsWith("/__l5e")) {
    const base = readAssetBaseUrl();
    return base ? `${base}${raw}` : "";
  }
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
