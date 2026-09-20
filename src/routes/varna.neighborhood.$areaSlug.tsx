import { createFileRoute, redirect } from "@tanstack/react-router";

/** MASTER адрес /varna/neighborhood/<кв.> → реалната квартална страница. */
export const Route = createFileRoute("/varna/neighborhood/$areaSlug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/cities/$slug/districts/$district",
      params: { slug: "varna", district: params.areaSlug },
      replace: true,
    });
  },
  component: () => null,
});
