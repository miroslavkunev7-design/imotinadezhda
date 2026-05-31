import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/components/site/luxury-real-estate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ИЛДЖ.ИА | Луксозни имоти в България" },
      {
        name: "description",
        content: "Луксозни имоти, квартали и подбрани предложения с премиум визуално изживяване.",
      },
      { property: "og:title", content: "ИЛДЖ.ИА | Луксозни имоти в България" },
      {
        property: "og:description",
        content: "Луксозни имоти, квартали и подбрани предложения с премиум визуално изживяване.",
      },
    ],
  }),
  component: HomePage,
});
