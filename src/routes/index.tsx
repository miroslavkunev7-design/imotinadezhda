import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/components/site/luxury-real-estate";
import { getCities, getFeaturedProperties } from "@/lib/catalog.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ИЛДЖ.ИА | Луксозни имоти в България" },
      { name: "description", content: "Луксозни имоти, квартали и подбрани предложения с премиум визуално изживяване." },
      { property: "og:title", content: "ИЛДЖ.ИА | Луксозни имоти в България" },
      { property: "og:description", content: "Луксозни имоти, квартали и подбрани предложения с премиум визуално изживяване." },
    ],
  }),
  loader: async () => {
    const [cities, featured] = await Promise.all([getCities(), getFeaturedProperties()]);
    return {
      cities: cities.map((c) => ({ name: c.name, image: c.hero_image_url, slug: c.slug })),
      featured: featured.map((f: any) => ({
        id: f.id,
        title: f.title,
        price: f.price,
        currency: f.currency,
        area_sqm: f.area_sqm,
        bedrooms: f.bedrooms,
        bathrooms: f.bathrooms,
        cover_image_url: f.cover_image_url,
        city_name: f.cities?.name ?? null,
        city_slug: f.cities?.slug ?? null,
      })),
    };
  },
  component: HomeRoute,
});

function HomeRoute() {
  const { cities, featured } = Route.useLoaderData();
  return <HomePage cities={cities} featured={featured} />;
}
