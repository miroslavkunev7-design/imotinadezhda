import { createFileRoute, notFound } from "@tanstack/react-router";

import { CityPage } from "@/components/site/luxury-real-estate";
import { ShumenHomePage } from "@/components/site/shumen-home-page";
import { getCityBySlug } from "@/lib/catalog.functions";

const fallbackCities: Record<string, { name: string; description: string; region: string }> = {
  burgas: { name: "Бургас", description: "Морски град с отлични възможности за живот и инвестиции.", region: "Черноморие" },
  varna: { name: "Варна", description: "Морска столица с активен имотен пазар и силна градска инфраструктура.", region: "Черноморие" },
  shumen: { name: "Шумен", description: "Исторически град с удобна локация и стабилна жилищна среда.", region: "Североизточна България" },
  "novi-pazar": { name: "Нов пазар", description: "Спокоен град с практични жилищни възможности.", region: "Североизточна България" },
};

function CityFallbackRoute() {
  const { slug } = Route.useParams();
  const fallback = fallbackCities[slug] ?? { name: "Град", description: "Имоти и квартали от Имоти Надежда.", region: "България" };
  const cityData = { city: { slug, ...fallback, hero_image_url: null, hero_video_url: null }, quarters: [], properties: [] };
  if (slug === "shumen") {
    return (
      <>
        <div className="hidden md:block"><ShumenHomePage /></div>
        <div className="md:hidden"><CityPage data={cityData} /></div>
      </>
    );
  }
  return <CityPage data={cityData} />;
}

export const Route = createFileRoute("/cities/$slug/")({
  loader: async ({ params }) => {
    const data = await getCityBySlug({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const url = `https://imotinadezhda.lovable.app/cities/${params.slug}`;
    const title = `${loaderData?.city.name ?? "Град"} | ИЛДЖ.ИА`;
    const desc = loaderData?.city.description ?? "Квартали, активни имоти и пазарна информация.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        ...(loaderData?.city.hero_image_url ? [{ property: "og:image", content: loaderData.city.hero_image_url }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description: desc,
            url,
          }),
        },
      ],
    };
  },
  component: CityRoute,
  errorComponent: CityFallbackRoute,
  notFoundComponent: CityFallbackRoute,
});

function CityRoute() {
  const { slug } = Route.useParams();
  const data = Route.useLoaderData();
  if (slug === "shumen") return <ShumenHomePage />;
  return <CityPage data={data} />;
}
