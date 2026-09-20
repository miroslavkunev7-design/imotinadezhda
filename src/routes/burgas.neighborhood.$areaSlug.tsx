import { createFileRoute, redirect } from "@tanstack/react-router";

/** MASTER адрес /burgas/neighborhood/<кв.> → реалната квартална страница. */
export const Route = createFileRoute("/burgas/neighborhood/$areaSlug")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/cities/$slug/districts/$district",
      params: { slug: "burgas", district: params.areaSlug },
      replace: true,
    });
  },
  component: () => null,
});
