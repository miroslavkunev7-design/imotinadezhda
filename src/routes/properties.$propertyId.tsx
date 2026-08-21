import { createFileRoute, notFound } from "@tanstack/react-router";

import { PropertyPage } from "@/components/site/luxury-real-estate";
import { getPropertyById } from "@/lib/catalog.functions";
import { breadcrumbJsonLd, siteUrl, SITE_NAME } from "@/lib/site-config";

export const Route = createFileRoute("/properties/$propertyId")({
  loader: async ({ params }) => {
    const data = await getPropertyById({ data: { id: params.propertyId } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const url = siteUrl(`/properties/${params.propertyId}`);
    const p: any = loaderData?.property;
    const cityName = p?.cities?.name as string | undefined;
    const title = cityName
      ? `${p?.title ?? "Имот"} — ${cityName} | ${SITE_NAME}`
      : `${p?.title ?? "Имот"} | ${SITE_NAME}`;
    const desc = (p?.description ?? `${p?.title ?? "Имот"} от ${SITE_NAME}${cityName ? ` в ${cityName}` : ""}.`).slice(0, 160);
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
                "@type": ["Product", "RealEstateListing"],
                name: p.title,
                description: p.description ?? undefined,
                image: p.cover_image_url ?? undefined,
                url,
                brand: { "@id": "https://imotinadezhda.bg/#organization", name: SITE_NAME },
                offers: p.price
                  ? {
                      "@type": "Offer",
                      price: String(p.price),
                      priceCurrency: p.currency ?? "EUR",
                      availability: "https://schema.org/InStock",
                      businessFunction: p.status === "rent"
                        ? "https://purl.org/goodrelations/v1#LeaseOut"
                        : "https://purl.org/goodrelations/v1#Sell",
                      url,
                    }
                  : undefined,
                ...(cityName
                  ? { areaServed: { "@type": "City", name: cityName } }
                  : {}),
              }),
            },
            {
              type: "application/ld+json",
              children: JSON.stringify(
                breadcrumbJsonLd([
                  { name: "Начало", path: "/" },
                  ...(p?.cities?.slug
                    ? [{ name: `Имоти в ${cityName}`, path: `/cities/${p.cities.slug}` }]
                    : []),
                  { name: p.title ?? "Имот", path: `/properties/${params.propertyId}` },
                ]),
              ),
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
