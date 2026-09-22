export const ANY = "any";

export type SearchFilters = {
  city: string;
  type: string;
  price: string;
  area: string;
  status: string;
};

function splitRange(value: string): { min?: string; max?: string } {
  if (!value || value === ANY) return {};
  const [min, max] = value.split("-");
  return { ...(min ? { min } : {}), ...(max ? { max } : {}) };
}

export function buildSearchQuery(filters: SearchFilters): Record<string, string> {
  const search: Record<string, string> = {};
  if (filters.city !== ANY) search.city_slug = filters.city;
  if (filters.type !== ANY) search.property_type = filters.type;
  if (filters.status !== ANY) search.status = filters.status;
  const price = splitRange(filters.price);
  if (price.min) search.price_min = price.min;
  if (price.max) search.price_max = price.max;
  const area = splitRange(filters.area);
  if (area.min) search.area_min = area.min;
  if (area.max) search.area_max = area.max;
  return search;
}
