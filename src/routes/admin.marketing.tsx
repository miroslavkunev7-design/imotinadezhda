import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/admin/marketing")({ component: Page });

function Page() {
  return (
    <AdminShell breadcrumb="Маркетинг">
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 text-primary"><Megaphone className="h-10 w-10" /></div>
        <h1 className="font-display text-2xl text-primary">Маркетинг</h1>
        <p className="max-w-md text-sm text-primary/60">Email кампании, SMS и социални публикации към база клиенти.</p>
      </div>
    </AdminShell>
  );
}
