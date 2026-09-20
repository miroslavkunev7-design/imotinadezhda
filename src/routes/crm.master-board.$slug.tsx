import { createFileRoute, redirect } from "@tanstack/react-router";

// Псевдоним: /crm/master-board/:slug → /admin/master-board/:slug
export const Route = createFileRoute("/crm/master-board/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/admin/master-board/$slug", params: { slug: params.slug } });
  },
});
