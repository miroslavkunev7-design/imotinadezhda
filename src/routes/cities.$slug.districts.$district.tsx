import { createFileRoute, notFound } from "@tanstack/react-router";

import { DistrictPage } from "@/components/site/luxury-real-estate";
import { getQuarterBySlug } from "@/lib/catalog.functions";
import { siteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/cities/$slug/districts/$district")({
  loader: async ({ params }) => {
    const data = await getQuarterBySlug({ data: { citySlug: params.slug, quarterSlug: params.district } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const url = siteUrl(`/cities/${params.slug}/districts/${params.district}`);
    const title = `${loaderData?.quarter.name ?? params.district} | ${loaderData?.city.name ?? params.slug} | Имоти Надежда`;
    const desc = loaderData?.quarter.description ?? "Имоти, филтри и информация за квартала.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        ...(loaderData?.quarter.image_url ? [{ property: "og:image", content: loaderData.quarter.image_url }] : []),
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
  component: DistrictRoute,
  errorComponent: ({ error }) => <div role="alert" className="p-10">Грешка: {error.message}</div>,
  notFoundComponent: () => <div className="p-10">Кварталът не е намерен.</div>,
});

function DistrictRoute() {
  const data = Route.useLoaderData();
  return <DistrictPage data={data as any} />;
}
