import { createFileRoute } from "@tanstack/react-router";

import homeHero from "@/assets/home-hero-living.jpeg";
import { HomePage } from "@/components/site/luxury-real-estate";
import { getCities, getFeaturedProperties } from "@/lib/catalog.functions";
import { getPublicPageLayout } from "@/lib/page-layouts.functions";

const SITE_URL = "https://imotinadezhda.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ИЛДЖ.ИА | Луксозни имоти в България" },
      { name: "description", content: "Луксозни имоти, квартали и подбрани предложения с премиум визуално изживяване." },
      { property: "og:title", content: "ИЛДЖ.ИА | Луксозни имоти в България" },
      { property: "og:description", content: "Луксозни имоти, квартали и подбрани предложения с премиум визуално изживяване." },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:image", content: `${SITE_URL}${homeHero}` },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/` },
      { rel: "preload", as: "image", href: homeHero, fetchpriority: "high" } as never,
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "ИЛДЖ.ИА",
          url: SITE_URL,
          description: "Луксозни недвижими имоти в България.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "ИЛДЖ.ИА",
          url: SITE_URL,
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}/search?city_slug={search_term}`,
            "query-input": "required name=search_term",
          },
        }),
      },
    ],
  }),
  loader: async () => {
    const [cities, featured, layout] = await Promise.all([
      getCities(),
      getFeaturedProperties(),
      getPublicPageLayout({ data: { page_key: "home" } }),
    ]);
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
      layout,
    };
  },
  component: HomeRoute,
});

function HomeRoute() {
  const { cities, featured, layout } = Route.useLoaderData();
  return <HomePage cities={cities} featured={featured} layout={layout} />;
}
