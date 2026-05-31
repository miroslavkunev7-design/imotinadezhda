import { createFileRoute } from "@tanstack/react-router";

import { CityPage } from "@/components/site/luxury-real-estate";

export const Route = createFileRoute("/cities/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug === "burgas" ? "Бургас" : "Град"} | ИЛДЖ.ИА` },
      {
        name: "description",
        content: "Разгледайте квартали, активни имоти и пазарна информация за избрания град.",
      },
      { property: "og:title", content: `${params.slug === "burgas" ? "Бургас" : "Град"} | ИЛДЖ.ИА` },
      {
        property: "og:description",
        content: "Разгледайте квартали, активни имоти и пазарна информация за избрания град.",
      },
    ],
  }),
  component: CityPage,
});
