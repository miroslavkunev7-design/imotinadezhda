import { createFileRoute, redirect } from "@tanstack/react-router";

// Псевдоним: /crm/bank-rates → /admin/bank-rates
export const Route = createFileRoute("/crm/bank-rates")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/bank-rates" });
  },
});
