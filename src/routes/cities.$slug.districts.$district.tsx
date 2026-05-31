import { createFileRoute } from "@tanstack/react-router";

import { DistrictPage } from "@/components/site/luxury-real-estate";

export const Route = createFileRoute("/cities/$slug/districts/$district")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.district} | ${params.slug} | ИЛДЖ.ИА` },
      {
        name: "description",
        content: "Вижте листинги, карта и филтри за квартала.",
      },
      { property: "og:title", content: `${params.district} | ${params.slug} | ИЛДЖ.ИА` },
      { property: "og:description", content: "Вижте листинги, карта и филтри за квартала." },
    ],
  }),
  component: DistrictPage,
});
