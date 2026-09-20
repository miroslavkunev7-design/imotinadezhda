import { createFileRoute, redirect } from "@tanstack/react-router";

/** MASTER адрес /varna → реалната градска страница /cities/varna. */
export const Route = createFileRoute("/varna/")({
  beforeLoad: () => {
    throw redirect({ to: "/cities/$slug", params: { slug: "varna" }, replace: true });
  },
  component: () => null,
});
