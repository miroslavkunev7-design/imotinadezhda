import { geocodePropertyLocation } from "@/lib/nominatim";

type GeoDb = {
  from: (table: string) => any;
};

export async function fillPropertyCoordinates(
  db: GeoDb,
  propertyId: string,
): Promise<{ lat: number; lng: number } | null> {
  const { data: row } = await db
    .from("properties")
    .select("id, address, lat, lng, cities:city_id(name), quarters:quarter_id(name)")
    .eq("id", propertyId)
    .maybeSingle();
  if (!row) return null;
  const existingLat = Number((row as any).lat);
  const existingLng = Number((row as any).lng);
  if (Number.isFinite(existingLat) && Number.isFinite(existingLng)) {
    return { lat: existingLat, lng: existingLng };
  }
  const coords = await geocodePropertyLocation({
    address: (row as any).address,
    quarterName: (row as any).quarters?.name,
    cityName: (row as any).cities?.name,
  });
  if (!coords) return null;
  const { error } = await db
    .from("properties")
    .update({ lat: coords.lat, lng: coords.lng } as never)
    .eq("id", propertyId);
  if (error) return coords;
  return coords;
}
