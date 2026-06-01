import { createFileRoute, notFound } from "@tanstack/react-router";

import { CityPage } from "@/components/site/luxury-real-estate";
import { getCityBySlug } from "@/lib/catalog.functions";

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
});

function CityRoute() {
  const data = Route.useLoaderData();
  return <CityPage data={data} />;
}
