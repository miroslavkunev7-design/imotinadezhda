import { createFileRoute, notFound } from "@tanstack/react-router";

import { DistrictPage } from "@/components/site/luxury-real-estate";
import { getQuarterBySlug } from "@/lib/catalog.functions";

export const Route = createFileRoute("/cities/$slug/districts/$district")({
  loader: async ({ params }) => {
    const data = await getQuarterBySlug({ data: { citySlug: params.slug, quarterSlug: params.district } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => ({
    meta: [
      { title: `${loaderData?.quarter.name ?? params.district} | ${loaderData?.city.name ?? params.slug} | ИЛДЖ.ИА` },
      { name: "description", content: loaderData?.quarter.description ?? "Имоти, филтри и информация за квартала." },
    ],
  }),
  component: DistrictRoute,
  errorComponent: ({ error }) => <div role="alert" className="p-10">Грешка: {error.message}</div>,
  notFoundComponent: () => <div className="p-10">Кварталът не е намерен.</div>,
});

function DistrictRoute() {
  const data = Route.useLoaderData();
  return <DistrictPage data={data as any} />;
}
