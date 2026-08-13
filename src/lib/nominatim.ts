const cache = new Map<string, { lat: number; lng: number } | null>();

export async function geocodeNominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=bg&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ImotiNadezhda/1.0 (contact: agenciq_nadejdi@abv.bg)" },
    });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = arr[0];
    const out = first ? { lat: Number(first.lat), lng: Number(first.lon) } : null;
    const valid = out && Number.isFinite(out.lat) && Number.isFinite(out.lng) ? out : null;
    cache.set(key, valid);
    return valid;
  } catch {
    cache.set(key, null);
    return null;
  }
}

export const CITY_MAP_CENTER: Record<string, { lat: number; lng: number }> = {
  shumen: { lat: 43.2712, lng: 26.9361 },
  varna: { lat: 43.2141, lng: 27.9147 },
  burgas: { lat: 42.5048, lng: 27.4626 },
  "novi-pazar": { lat: 43.3469, lng: 27.1981 },
};

export async function geocodePropertyLocation(opts: {
  address?: string | null;
  quarterName?: string | null;
  cityName?: string | null;
}): Promise<{ lat: number; lng: number } | null> {
  const city = opts.cityName?.trim();
  const quarter = opts.quarterName?.trim();
  const address = opts.address?.trim();
  const tries: string[] = [];
  if (address && city) tries.push(`${address}, ${city}, България`);
  if (address && quarter && city) tries.push(`${address}, ${quarter}, ${city}, България`);
  if (quarter && city) tries.push(`${quarter}, ${city}, България`);
  if (city) tries.push(`${city}, България`);
  for (const query of tries) {
    const hit = await geocodeNominatim(query);
    if (hit) return hit;
  }
  return null;
}
