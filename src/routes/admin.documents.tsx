import { createFileRoute } from "@tanstack/react-router";
import { DocumentDesk } from "@/components/admin/document-desk";

export const Route = createFileRoute("/admin/documents")({
  validateSearch: (s: Record<string, unknown>) => ({
    client: typeof s.client === "string" ? s.client : undefined,
    property: typeof s.property === "string" ? s.property : undefined,
  }),
  component: Page,
});

function Page() {
  const search = Route.useSearch();
  return (
    <div className="p-4">
      <DocumentDesk initialClient={search.client} initialProperty={search.property} />
    </div>
  );
}
