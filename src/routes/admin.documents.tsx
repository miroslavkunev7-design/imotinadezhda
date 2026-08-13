import { createFileRoute } from "@tanstack/react-router";
import { DocScanner } from "@/components/admin/doc-scanner";

export const Route = createFileRoute("/admin/documents")({ component: Page });

function Page() {
  return (
    <div className="p-4">
      <DocScanner />
    </div>
  );
}
