import { createFileRoute } from "@tanstack/react-router";
import { AssistantAnalytics } from "@/components/admin/assistant-analytics";

export const Route = createFileRoute("/admin/assistant")({
  component: AdminAssistantPage,
});

function AdminAssistantPage() {
  return <AssistantAnalytics />;
}
