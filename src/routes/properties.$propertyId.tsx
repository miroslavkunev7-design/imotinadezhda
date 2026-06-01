import { createFileRoute, notFound } from "@tanstack/react-router";

import { PropertyPage } from "@/components/site/luxury-real-estate";
import { getPropertyById } from "@/lib/catalog.functions";

export const Route = createFileRoute("/properties/$propertyId")({
  loader: async ({ params }) => {
    const data = await getPropertyById({ data: { id: params.propertyId } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const url = `https://imotinadezhda.lovable.app/properties/${params.propertyId}`;
    const p: any = loaderData?.property;
    const title = `${p?.title ?? "Имот"} | ИЛДЖ.ИА`;
    const desc = (p?.description ?? "Детайли за имот, галерия и запитване.").slice(0, 160);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "product" },
        ...(p?.cover_image_url ? [{ property: "og:image", content: p.cover_image_url }, { name: "twitter:image", content: p.cover_image_url }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: p
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Product",
                name: p.title,
                description: p.description ?? undefined,
                image: p.cover_image_url ?? undefined,
                url,
                offers: p.price
                  ? {
                      "@type": "Offer",
                      price: String(p.price),
                      priceCurrency: p.currency ?? "EUR",
                      availability: "https://schema.org/InStock",
                      url,
                    }
                  : undefined,
              }),
            },
          ]
        : [],
    };
  },
  component: PropertyRoute,
  errorComponent: ({ error }) => <div role="alert" className="p-10">Грешка: {error.message}</div>,
  notFoundComponent: () => <div className="p-10">Имотът не е намерен.</div>,
});

function PropertyRoute() {
  const data = Route.useLoaderData();
  return <PropertyPage data={data as any} />;
}
