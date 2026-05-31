import { createFileRoute, notFound } from "@tanstack/react-router";

import { CityPage } from "@/components/site/luxury-real-estate";
import { getCityBySlug } from "@/lib/catalog.functions";

export const Route = createFileRoute("/cities/$slug")({
  loader: async ({ params }) => {
    const data = await getCityBySlug({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.city.name ?? "Град"} | ИЛДЖ.ИА` },
      { name: "description", content: loaderData?.city.description ?? "Квартали, активни имоти и пазарна информация." },
    ],
  }),
  component: CityRoute,
});

function CityRoute() {
  const data = Route.useLoaderData();
  return <CityPage data={data} />;
}
