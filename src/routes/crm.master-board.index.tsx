import { createFileRoute, redirect } from "@tanstack/react-router";

// Псевдоним: /crm/master-board → /admin/master-board
export const Route = createFileRoute("/crm/master-board/")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/master-board" });
  },
});
