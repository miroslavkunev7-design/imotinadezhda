import { createFileRoute, notFound } from "@tanstack/react-router";

import { PropertyPage } from "@/components/site/luxury-real-estate";
import { getPropertyById } from "@/lib/catalog.functions";

export const Route = createFileRoute("/properties/$propertyId")({
  loader: async ({ params }) => {
    const data = await getPropertyById({ data: { id: params.propertyId } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.property.title ?? "Имот"} | ИЛДЖ.ИА` },
      { name: "description", content: loaderData?.property.description?.slice(0, 160) ?? "Детайли за имот, галерия и запитване." },
      { property: "og:title", content: loaderData?.property.title ?? "Имот" },
      { property: "og:image", content: loaderData?.property.cover_image_url ?? "" },
    ],
  }),
  component: PropertyRoute,
  errorComponent: ({ error }) => <div role="alert" className="p-10">Грешка: {error.message}</div>,
  notFoundComponent: () => <div className="p-10">Имотът не е намерен.</div>,
});

function PropertyRoute() {
  const data = Route.useLoaderData();
  return <PropertyPage data={data as any} />;
}
