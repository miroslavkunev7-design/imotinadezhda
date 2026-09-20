import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";

import { LuxuryHeader, ListingCard } from "@/components/site/luxury-real-estate";
import { searchProperties, getPropertiesByIds } from "@/lib/catalog.functions";
import { siteUrl } from "@/lib/site-config";
import { useFavorites } from "@/hooks/use-favorites";

// URL параметрите могат да дойдат като числа (?favorites=1, ?price_min=80000),
// затова ги привеждаме към текст, вместо да чупим страницата.
const asText = z.coerce.string().optional();

const searchSchema = z.object({
  city_slug: asText,
  quarter_slug: asText,
  property_type: asText,
  status: z.enum(["sale", "rent"]).optional(),
  price_min: asText,
  price_max: asText,
  area_min: asText,
  area_max: asText,
  favorites: asText,
});

export const Route = createFileRoute("/search")({
  validateSearch: (s) => searchSchema.parse(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const rows = await searchProperties({ data: deps as any });
    return { results: rows ?? [] };
  },
  head: () => ({
    meta: [
      { title: "Търсене на имоти | Имоти Надежда" },
      {
        name: "description",
        content: "Търсене на луксозни имоти в България — филтри по град, квартал, цена и площ.",
      },
      { property: "og:title", content: "Търсене на имоти | Имоти Надежда" },
      { property: "og:description", content: "Търсене на луксозни имоти в България." },
      { property: "og:url", content: siteUrl("/search") },
    ],
    links: [{ rel: "canonical", href: siteUrl("/search") }],
  }),
  component: SearchRoute,
});

function SearchRoute() {
  const { results: allResults } = Route.useLoaderData();
  const search = Route.useSearch();
  const { ids: favoriteIds } = useFavorites();
  const onlyFavorites = search.favorites === "1";
  const favoritesQuery = useQuery({
    queryKey: ["favorite-properties", favoriteIds],
    queryFn: () => getPropertiesByIds({ data: { ids: favoriteIds } }),
    enabled: onlyFavorites,
  });
  const results = onlyFavorites ? (favoritesQuery.data ?? []) : allResults;
  return (
    <main className="luxury-page flex h-screen max-h-screen flex-col overflow-hidden bg-background">
      <LuxuryHeader active={search.status === "rent" ? "rent" : "sale"} />

      {/* Compact title bar — offset for fixed header */}
      <header className="flex-none border-b border-[#C9A84C]/30 bg-white/80 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[1420px] flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl text-[#2b1418] md:text-3xl">
            {onlyFavorites ? "Запазени имоти" : "Намерени имоти"}
          </h1>
          <span className="font-display text-sm uppercase tracking-[0.18em] text-[#8B1A2B]">
            {results.length} резултата
          </span>
        </div>
      </header>

      {/* Results — internal scroll keeps single-viewport feel */}
      <section className="mx-auto w-full max-w-[1420px] flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6">
        {results.length === 0 ? (
          <div className="rounded-3xl border border-[#C9A84C]/40 bg-[#fbf6ea] p-10 text-center text-[#2b1418]/80">
            {onlyFavorites ? "Още нямаш запазени имоти." : "Няма намерени имоти с тези критерии."}{" "}
            <Link to="/" className="text-[#8B1A2B] underline">
              Промени филтрите
            </Link>
          </div>
        ) : (
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((p: any) => (
              <ListingCard
                key={p.id}
                id={p.id}
                title={p.title ?? "Имот"}
                price={`${p.currency === "BGN" ? "лв." : "€"} ${new Intl.NumberFormat("bg-BG").format(Number(p.price ?? 0))}`}
                size={`${p.area_sqm ?? "—"} m²`}
                beds={Number(p.bedrooms ?? p.rooms ?? 0)}
                baths={Number(p.bathrooms ?? 0)}
                image={p.cover_image_url ?? ""}
                tag={p.status === "rent" ? "ПОД НАЕМ" : "ПРОДАЖБА"}
                location={p.cities?.name}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
