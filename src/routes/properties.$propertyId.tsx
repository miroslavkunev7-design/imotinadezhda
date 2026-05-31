import { createFileRoute } from "@tanstack/react-router";

import { PropertyPage } from "@/components/site/luxury-real-estate";

export const Route = createFileRoute("/properties/$propertyId")({
  head: () => ({
    meta: [
      { title: "Тристаен апартамент с панорамна гледка | ИЛДЖ.ИА" },
      {
        name: "description",
        content: "Детайли за имота, галерия, консултант и карта на локацията.",
      },
      { property: "og:title", content: "Тристаен апартамент с панорамна гледка | ИЛДЖ.ИА" },
      {
        property: "og:description",
        content: "Детайли за имота, галерия, консултант и карта на локацията.",
      },
    ],
  }),
  component: PropertyPage,
});
