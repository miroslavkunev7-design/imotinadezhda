import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, LayoutTemplate } from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
import { PAGE_LABELS, type PageKey } from "@/lib/page-sections";

export const Route = createFileRoute("/admin/settings/page-editor")({ component: Page });

const PAGE_PATHS: Record<PageKey, string> = {
  home: "/",
  sale: "/search?status=sale",
  rent: "/search?status=rent",
  about: "/about",
  contacts: "/contacts",
};

function Page() {
  return (
    <AdminShell breadcrumb="Редактор на страници">
      <div className="mx-auto w-full max-w-6xl space-y-5 p-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-amber-100">Редактор на страници</h1>
            <p className="mt-1 text-sm text-amber-100/60">Избери страница от миниатюрите и редактирай секциите ѝ.</p>
          </div>
          <Link
            to="/admin/settings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/15"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Настройки
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(PAGE_LABELS) as PageKey[]).map((page) => (
            <Link
              key={page}
              to="/admin/settings/page-editor/$page"
              params={{ page }}
              className="group overflow-hidden rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.62)] shadow-[0_18px_45px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 hover:border-amber-400/70"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[#120508]">
                <iframe
                  src={`${PAGE_PATHS[page]}${PAGE_PATHS[page].includes("?") ? "&" : "?"}__editorThumb=1`}
                  title={PAGE_LABELS[page]}
                  className="pointer-events-none h-[220%] w-[220%] origin-top-left scale-[0.455] bg-white"
                  tabIndex={-1}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#140408]/90 via-transparent to-transparent" />
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-display text-lg text-amber-100">{PAGE_LABELS[page]}</div>
                  <div className="text-xs text-amber-100/50">Отвори визуалния редактор</div>
                </div>
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-200">
                  <LayoutTemplate className="h-5 w-5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}