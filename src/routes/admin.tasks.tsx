import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { CheckSquare } from "lucide-react";

export const Route = createFileRoute("/admin/tasks")({ component: Page });

function Page() {
  return (
    <AdminShell breadcrumb="Задачи">
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 text-primary"><CheckSquare className="h-10 w-10" /></div>
        <h1 className="font-display text-2xl text-primary">Задачи на брокерите</h1>
        <p className="max-w-md text-sm text-primary/60">Възлагане, проследяване и автоматично напомняне по сделки.</p>
      </div>
    </AdminShell>
  );
}
