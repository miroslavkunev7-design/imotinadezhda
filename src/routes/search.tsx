import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { LuxuryHeader, ListingCard } from "@/components/site/luxury-real-estate";
import { searchProperties } from "@/lib/catalog.functions";

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
    return { results: rows ?? [] };
  },
  head: () => ({ meta: [{ title: "Търсене на имоти | Имоти Надежда" }] }),
  component: SearchRoute,
});

function SearchRoute() {
  const { results } = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <main className="luxury-page min-h-screen bg-background">
      <div className="px-3 pt-0 md:px-6">
        <LuxuryHeader active={search.status === "rent" ? "rent" : "sale"} />
      </div>
      <section className="mx-auto max-w-[1420px] px-4 pb-16 pt-6 md:px-6">
        <h1 className="mb-6 font-display text-3xl text-accent-foreground md:text-4xl">
          Намерени имоти: {results.length}
        </h1>
        {results.length === 0 ? (
          <div className="rounded-3xl border border-primary/15 bg-card p-10 text-center text-accent-foreground/80">
            Няма намерени имоти с тези критерии. <Link to="/" className="text-primary underline">Промени филтрите</Link>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {results.map((p: any) => (
              <ListingCard
                key={p.id}
                id={p.id}
                title={p.title}
                price={p.price}
                currency={p.currency}
                area={p.area_sqm}
                rooms={p.rooms ?? p.bedrooms}
                image={p.cover_image_url}
                city={p.cities?.name}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
