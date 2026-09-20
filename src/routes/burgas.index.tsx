import { createFileRoute, redirect } from "@tanstack/react-router";

/** MASTER адрес /burgas → реалната градска страница /cities/burgas. */
export const Route = createFileRoute("/burgas/")({
  beforeLoad: () => {
    throw redirect({ to: "/cities/$slug", params: { slug: "burgas" }, replace: true });
  },
  component: () => null,
});
