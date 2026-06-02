import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/admin/chat")({ component: Page });

function Page() {
  return (
    <AdminShell breadcrumb="Чат">
      <Placeholder icon={<MessageCircle className="h-10 w-10" />} title="Вътрешен чат" desc="Чат между брокери и с клиенти — в подготовка. Модулът е активен и достъпен." />
    </AdminShell>
  );
}

function Placeholder({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 text-primary">{icon}</div>
      <h1 className="font-display text-2xl text-primary">{title}</h1>
      <p className="max-w-md text-sm text-primary/60">{desc}</p>
    </div>
  );
}
