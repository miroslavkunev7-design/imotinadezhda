import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { DocScanner } from "@/components/admin/doc-scanner";

export const Route = createFileRoute("/admin/documents")({ component: Page });

function Page() {
  return (
    <AdminShell breadcrumb="Документи">
      <div className="p-4">
        <DocScanner />
      </div>
    </AdminShell>
  );
}
