import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  GripVertical,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  Monitor,
  Smartphone,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  getPageLayout,
  savePageLayout,
  resetPageLayout,
} from "@/lib/page-layouts.functions";
import {
  PAGE_LABELS,
  SECTION_REGISTRY,
  resolveSections,
  type PageKey,
  type SectionState,
} from "@/lib/page-sections";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/settings/page-editor/$page")({
  component: Page,
});

function isPageKey(value: string): value is PageKey {
  return value in PAGE_LABELS;
}

const PAGE_PATHS: Record<PageKey, string> = {
  home: "/",
  sale: "/search?status=sale",
  rent: "/search?status=rent",
  about: "/about",
  contacts: "/contacts",
};

function Page() {
  const { page } = Route.useParams();
  const pageKey = isPageKey(page) ? page : "home";
  return <PageEditor key={pageKey} pageKey={pageKey} />;
}

function PageEditor({ pageKey }: { pageKey: PageKey }) {
  const fetchLayout = useServerFn(getPageLayout);
  const saveLayout = useServerFn(savePageLayout);
  const resetLayout = useServerFn(resetPageLayout);

  const [sections, setSections] = useState<SectionState[]>(() =>
    resolveSections(pageKey, null),
  );
  const [initial, setInitial] = useState<SectionState[]>(sections);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLayout({ data: { page_key: pageKey } })
      .then((res) => {
        if (cancelled) return;
        const resolved = resolveSections(pageKey, res.sections);
        setSections(resolved);
        setInitial(resolved);
      })
      .catch((e) => toast.error(String(e?.message ?? e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [pageKey, fetchLayout]);

  const isDirty = JSON.stringify(sections) !== JSON.stringify(initial);

  function move(from: number, to: number) {
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setSections(next);
  }

  function toggle(idx: number) {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, visible: !s.visible } : s)));
  }

  async function onSave() {
    setSaving(true);
    try {
      await saveLayout({ data: { page_key: pageKey, sections } });
      setInitial(sections);
      setReloadKey((k) => k + 1);
      toast.success("Запазено. Презареди публичната страница, за да видиш промените.");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    if (!confirm("Възстановяване на оригиналната подредба?")) return;
    setSaving(true);
    try {
      await resetLayout({ data: { page_key: pageKey } });
      const resolved = resolveSections(pageKey, null);
      setSections(resolved);
      setInitial(resolved);
      setReloadKey((k) => k + 1);
      toast.success("Възстановено.");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  const registry = SECTION_REGISTRY[pageKey] ?? [];
  const labelById = new Map(registry.map((r) => [r.id, r]));

  // Drag & drop (native HTML5)
  const dragIdx = useRef<number | null>(null);
  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    move(dragIdx.current, idx);
    dragIdx.current = idx;
  }

  const iframeSrc = `${PAGE_PATHS[pageKey]}${PAGE_PATHS[pageKey].includes("?") ? "&" : "?"}__editor=1&_=${reloadKey}`;

  return (
    <AdminShell breadcrumb="Редактор на страници">
      <div className="mx-auto w-full max-w-[1600px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/settings/page-editor"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-100 hover:bg-amber-500/15"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Всички страници
            </Link>
            <div>
              <h1 className="font-display text-xl text-amber-100">Редактор на страници</h1>
              <p className="text-xs text-amber-100/60">
                Премести секции с мишката, скрий/покажи и запази. Промените важат за всички посетители.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(PAGE_LABELS) as PageKey[]).map((k) => (
              <Link
                key={k}
                to="/admin/settings/page-editor/$page"
                params={{ page: k }}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs transition",
                  k === pageKey
                    ? "border-amber-400 bg-amber-500/25 text-amber-100"
                    : "border-amber-500/25 bg-[rgba(20,4,8,0.55)] text-amber-100/70 hover:border-amber-400/50",
                )}
              >
                {PAGE_LABELS[k]}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
          {/* Sidebar */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.65)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                  Секции на {PAGE_LABELS[pageKey]}
                </div>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />}
              </div>
              <ul className="space-y-1.5">
                {sections.map((s, idx) => {
                  const def = labelById.get(s.id);
                  return (
                    <li
                      key={s.id}
                      draggable
                      onDragStart={() => onDragStart(idx)}
                      onDragOver={(e) => onDragOver(e, idx)}
                      className={cn(
                        "group flex items-start gap-2 rounded-lg border border-amber-500/20 bg-[rgba(40,10,18,0.6)] px-2.5 py-2 transition",
                        !s.visible && "opacity-50",
                      )}
                    >
                      <button
                        className="mt-0.5 cursor-grab text-amber-300/60 hover:text-amber-200 active:cursor-grabbing"
                        title="Премести"
                        aria-label="Премести"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-amber-100">
                          {def?.label ?? s.id}
                        </div>
                        {def?.description && (
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-amber-100/55">
                            {def.description}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => move(idx, idx - 1)}
                          disabled={idx === 0}
                          className="rounded p-0.5 text-amber-200/70 hover:bg-amber-500/15 disabled:opacity-30"
                          aria-label="Нагоре"
                          title="Нагоре"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => move(idx, idx + 1)}
                          disabled={idx === sections.length - 1}
                          className="rounded p-0.5 text-amber-200/70 hover:bg-amber-500/15 disabled:opacity-30"
                          aria-label="Надолу"
                          title="Надолу"
                        >
                          ▼
                        </button>
                      </div>
                      <button
                        onClick={() => toggle(idx)}
                        className="rounded p-1 text-amber-200/70 hover:bg-amber-500/15"
                        aria-label={s.visible ? "Скрий" : "Покажи"}
                        title={s.visible ? "Скрий от сайта" : "Покажи на сайта"}
                      >
                        {s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </li>
                  );
                })}
                {sections.length === 0 && !loading && (
                  <li className="rounded-lg border border-dashed border-amber-500/25 px-3 py-6 text-center text-xs text-amber-100/50">
                    Няма дефинирани секции за тази страница.
                  </li>
                )}
              </ul>

              <div className="mt-3 flex flex-col gap-2">
                <button
                  onClick={onSave}
                  disabled={!isDirty || saving || loading}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-2 text-sm font-semibold text-amber-950 shadow-md transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Запази
                </button>
                <button
                  onClick={onReset}
                  disabled={saving || loading}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/80 hover:bg-amber-500/15 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Възстанови оригинала
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/15 bg-[rgba(20,4,8,0.4)] p-3 text-[11px] leading-relaxed text-amber-100/55">
              <strong className="text-amber-200">Фаза 1</strong>: подредба и скриване/показване на цели секции. Скоро: inline редактор на текстове и снимки + AI помощ.
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.65)] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setDevice("desktop")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]",
                    device === "desktop"
                      ? "bg-amber-500/25 text-amber-100"
                      : "text-amber-100/60 hover:bg-amber-500/10",
                  )}
                >
                  <Monitor className="h-3.5 w-3.5" /> Desktop
                </button>
                <button
                  onClick={() => setDevice("mobile")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]",
                    device === "mobile"
                      ? "bg-amber-500/25 text-amber-100"
                      : "text-amber-100/60 hover:bg-amber-500/10",
                  )}
                >
                  <Smartphone className="h-3.5 w-3.5" /> Mobile
                </button>
              </div>
              <a
                href={PAGE_PATHS[pageKey]}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-100/80 hover:bg-amber-500/15"
              >
                <ExternalLink className="h-3 w-3" /> Отвори в нов таб
              </a>
            </div>
            <div className="flex justify-center overflow-auto rounded-xl border border-amber-500/15 bg-black/30 p-3">
              <iframe
                ref={iframeRef}
                key={`${pageKey}-${reloadKey}`}
                src={iframeSrc}
                title="Preview"
                className={cn(
                  "rounded-lg border border-amber-500/20 bg-white shadow-2xl",
                  device === "desktop"
                    ? "h-[820px] w-full max-w-[1440px]"
                    : "h-[760px] w-[400px]",
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
