import { createFileRoute, redirect } from "@tanstack/react-router";

/** MASTER адрес /shumen → реалната градска страница /cities/shumen. */
export const Route = createFileRoute("/shumen/")({
  beforeLoad: () => {
    throw redirect({ to: "/cities/$slug", params: { slug: "shumen" }, replace: true });
  },
  component: () => null,
});
