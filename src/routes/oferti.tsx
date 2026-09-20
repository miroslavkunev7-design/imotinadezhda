import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * MASTER адрес за реда „Резултати / Оферти“.
 * Реалната страница е /search — тук само пренасочваме, за да работят и двата адреса.
 */
export const Route = createFileRoute("/oferti")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/search", search: search as never, replace: true });
  },
  component: () => null,
});
