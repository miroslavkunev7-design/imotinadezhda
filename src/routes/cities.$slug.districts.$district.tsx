import { createFileRoute, notFound } from "@tanstack/react-router";

import { DistrictPage } from "@/components/site/luxury-real-estate";
import { getQuarterBySlug } from "@/lib/catalog.functions";
import { siteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/cities/$slug/districts/$district")({
  loader: async ({ params }) => {
    const data = await getQuarterBySlug({
      data: { citySlug: params.slug, quarterSlug: params.district },
    });
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
        ...(loaderData?.quarter.image_url
          ? [{ property: "og:image", content: loaderData.quarter.image_url }]
          : []),
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
  pendingComponent: () => <DistrictState title="Зареждаме квартала…" />,
  errorComponent: ({ error }) => (
    <DistrictState title="Кварталът не може да се зареди" detail={error.message} />
  ),
  notFoundComponent: () => (
    <DistrictState title="Кварталът не е намерен" detail="Проверете адреса или изберете друг квартал." />
  ),
});

function DistrictState({ title, detail }: { title: string; detail?: string }) {
  return (
    <main className="nadezhda-marble-bg flex min-h-screen items-center justify-center px-4">
      <div role="status" className="max-w-lg text-center text-[#600f1c]">
        <h1 className="font-serif-nadezhda text-3xl font-bold">{title}</h1>
        {detail ? <p className="mt-3 text-[#600f1c]/75">{detail}</p> : null}
      </div>
    </main>
  );
}

function DistrictRoute() {
  const data = Route.useLoaderData();
  return <DistrictPage data={data as any} />;
}
