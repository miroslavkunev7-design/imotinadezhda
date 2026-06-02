import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/admin/finance")({ component: Page });

function Page() {
  return (
    <AdminShell breadcrumb="Финанси">
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 text-primary"><Wallet className="h-10 w-10" /></div>
        <h1 className="font-display text-2xl text-primary">Финанси</h1>
        <p className="max-w-md text-sm text-primary/60">Комисионни, разходи и приходи по сделки. Свържи се с банков отчет за автоматично разпределение.</p>
      </div>
    </AdminShell>
  );
}
