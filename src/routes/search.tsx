import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { LuxuryHeader, ListingCard } from "@/components/site/luxury-real-estate";
import { searchProperties } from "@/lib/catalog.functions";
import { searchCanonicalPath, searchPageSeo, siteUrl } from "@/lib/site-config";
import { cityBySlug } from "@/lib/seo-keywords";

const searchSchema = z.object({
  city_slug: z.string().optional(),
  quarter_slug: z.string().optional(),
  property_type: z.string().optional(),
  status: z.enum(["sale", "rent"]).optional(),
  price_min: z.string().optional(),
  price_max: z.string().optional(),
  area_min: z.string().optional(),
  area_max: z.string().optional(),
});

export const Route = createFileRoute("/search")({
  validateSearch: (s) => searchSchema.parse(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const rows = await searchProperties({ data: deps as any });
    return { results: rows ?? [], seo: searchPageSeo(deps) };
  },
  head: ({ loaderData, match }) => {
    const seo = loaderData?.seo ?? searchPageSeo(match.search);
    const canonical = siteUrl(searchCanonicalPath(match.search));
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:url", content: canonical },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: SearchRoute,
});

function SearchRoute() {
  const { results } = Route.useLoaderData();
  const search = Route.useSearch();
  const cityName = search.city_slug ? cityBySlug(search.city_slug)?.name : undefined;
  const heading =
    search.status === "rent" && cityName
      ? `Наеми в ${cityName}`
      : search.status === "rent"
        ? "Имоти под наем"
        : search.status === "sale" && cityName
          ? `Имоти за продажба в ${cityName}`
          : search.status === "sale"
            ? "Купи имот"
            : cityName
              ? `Имоти в ${cityName}`
              : "Намерени имоти";
  return (
    <main className="luxury-page flex h-screen max-h-screen flex-col overflow-hidden bg-background">
      <LuxuryHeader active={search.status === "rent" ? "rent" : "sale"} />


      {/* Compact title bar — offset for fixed header */}
      <header className="flex-none border-b border-[#C9A84C]/30 bg-white/80 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[1420px] flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl text-[#2b1418] md:text-3xl">
            {heading}
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
            Няма намерени имоти с тези критерии.{" "}
            <Link to="/" className="text-[#8B1A2B] underline">Промени филтрите</Link>
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
