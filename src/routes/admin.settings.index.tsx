import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { Settings, Image as ImageIcon, ChevronRight, LayoutTemplate } from "lucide-react";

export const Route = createFileRoute("/admin/settings/")({ component: Page });

function Page() {
  return (
    <AdminShell breadcrumb="Настройки">
      <div className="mx-auto w-full max-w-4xl space-y-6 p-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-amber-100">Настройки</h1>
            <p className="text-sm text-amber-100/60">Конфигурация на агенцията и сайта.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            to="/admin/settings/images"
            className="group flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.55)] p-5 transition hover:border-amber-400/60 hover:bg-[rgba(20,4,8,0.7)]"
          >
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-300/20 text-amber-200">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 font-display text-base text-amber-100">
                Промяна на снимки
                <ChevronRight className="h-4 w-4 text-amber-300/70 transition group-hover:translate-x-0.5" />
              </div>
              <p className="mt-1 text-xs text-amber-100/60">
                Background на сайта (за всички), личен CRM фон, снимки на карти градове и квартали, добавяне на нови.
              </p>
            </div>
          </Link>

          <Link
            to="/admin/settings/page-editor"
            search={{ page: "home" }}
            className="group flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.55)] p-5 transition hover:border-amber-400/60 hover:bg-[rgba(20,4,8,0.7)]"
          >
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-300/20 text-amber-200">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 font-display text-base text-amber-100">
                Редактор на страници
                <ChevronRight className="h-4 w-4 text-amber-300/70 transition group-hover:translate-x-0.5" />
              </div>
              <p className="mt-1 text-xs text-amber-100/60">
                Отвори страница и размествай секциите с мишката (drag & drop), скривай/показвай ги.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </AdminShell>
  );
}
