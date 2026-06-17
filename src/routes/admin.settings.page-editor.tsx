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
  Plus,
  Trash2,
  Pencil,
  History,
  Undo2,
  
} from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/admin-shell";
import {
  getPageLayout,
  savePageLayout,
  resetPageLayout,
  listPageLayoutRevisions,
  restorePageLayoutRevision,
} from "@/lib/page-layouts.functions";
import {
  PAGE_LABELS,
  SECTION_REGISTRY,
  resolveSections,
  type PageKey,
  type SectionState,
} from "@/lib/page-sections";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/settings/page-editor")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: (typeof search.page === "string" ? search.page : "home") as PageKey,
  }),
  component: Page,
});

const PAGE_PATHS: Record<PageKey, string> = {
  home: "/",
  sale: "/search?status=sale",
  rent: "/search?status=rent",
  about: "/about",
  contacts: "/contacts",
};

type Revision = {
  id: string;
  sections: unknown;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

function Page() {
  const { page } = Route.useSearch();
  return <PageEditor key={page} pageKey={page} />;
}

function PageEditor({ pageKey }: { pageKey: PageKey }) {
  const fetchLayout = useServerFn(getPageLayout);
  const saveLayout = useServerFn(savePageLayout);
  const resetLayout = useServerFn(resetPageLayout);
  const fetchRevisions = useServerFn(listPageLayoutRevisions);
  const restoreRevision = useServerFn(restorePageLayoutRevision);

  const [sections, setSections] = useState<SectionState[]>(() =>
    resolveSections(pageKey, null),
  );
  const [initial, setInitial] = useState<SectionState[]>(sections);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [revsLoading, setRevsLoading] = useState(false);
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

  async function loadRevisions() {
    setRevsLoading(true);
    try {
      const res = await fetchRevisions({ data: { page_key: pageKey } });
      setRevisions(res.revisions as Revision[]);
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setRevsLoading(false);
    }
  }

  useEffect(() => {
    if (historyOpen) loadRevisions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyOpen, pageKey]);

  // Слушай за reorder от iframe-а (двоен клик → местене → клик за пускане)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "page-editor:reorder" || !Array.isArray(data.order)) return;
      setSections((prev) => {
        const byId = new Map(prev.map((s) => [s.id, s]));
        const next: SectionState[] = [];
        for (const id of data.order as string[]) {
          const s = byId.get(id);
          if (s) {
            next.push(s);
            byId.delete(id);
          }
        }
        // Запази секции, които не са в iframe-а (напр. скрити или нерендирани)
        for (const s of byId.values()) next.push(s);
        return next;
      });
      toast.success('Преместено. Натисни „Запази" за да приложиш.');
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function onCancel() {
    setSections(initial);
    setReloadKey((k) => k + 1);
    toast.info("Отказани промени.");
  }

  const isDirty = JSON.stringify(sections) !== JSON.stringify(initial);

  function move(from: number, to: number) {
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setSections(next);
  }

  function toggle(idx: number) {
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, visible: !s.visible } : s)),
    );
  }

  function remove(idx: number) {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }

  function addSection(id: string) {
    if (sections.some((s) => s.id === id)) {
      toast.info("Тази секция вече е в подредбата.");
      return;
    }
    setSections((prev) => [...prev, { id, visible: true }]);
  }

  function updateOverride(
    idx: number,
    patch: Partial<Pick<SectionState, "title" | "subtitle" | "props">>,
  ) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        const next: SectionState = { ...s, ...patch };
        // Чисти празни overrides
        if (next.title === "") delete next.title;
        if (next.subtitle === "") delete next.subtitle;
        if (next.props && Object.keys(next.props).length === 0) delete next.props;
        return next;
      }),
    );
  }

  async function onSave() {
    setSaving(true);
    try {
      await saveLayout({ data: { page_key: pageKey, sections } });
      setInitial(sections);
      setReloadKey((k) => k + 1);
      toast.success("Запазено. Презареди публичната страница, за да видиш промените.");
      if (historyOpen) loadRevisions();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    if (!confirm("Възстановяване на оригиналната подредба? Сегашната ще се запази в историята.")) return;
    setSaving(true);
    try {
      await resetLayout({ data: { page_key: pageKey } });
      const resolved = resolveSections(pageKey, null);
      setSections(resolved);
      setInitial(resolved);
      setReloadKey((k) => k + 1);
      toast.success("Възстановено.");
      if (historyOpen) loadRevisions();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function onRestoreRevision(rev: Revision) {
    if (!confirm("Възстановяване на тази версия? Сегашната ще се запази в историята.")) return;
    setSaving(true);
    try {
      const res = await restoreRevision({
        data: { page_key: pageKey, revision_id: rev.id },
      });
      const resolved = resolveSections(pageKey, res.sections as SectionState[]);
      setSections(resolved);
      setInitial(resolved);
      setReloadKey((k) => k + 1);
      toast.success("Версията е възстановена.");
      loadRevisions();
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  const registry = SECTION_REGISTRY[pageKey] ?? [];
  const labelById = new Map(registry.map((r) => [r.id, r]));
  const usedIds = new Set(sections.map((s) => s.id));
  const availableToAdd = registry.filter((r) => !usedIds.has(r.id));

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
      {/* Sticky Save/Cancel банер при неприложени промени */}
      {isDirty && (
        <div className="sticky top-0 z-40 -mx-4 mb-3 flex items-center justify-between gap-3 border-b border-amber-400/60 bg-gradient-to-r from-[#4f0314] to-[#260108] px-4 py-2.5 shadow-lg">
          <div className="text-sm font-semibold text-amber-100">
            Имаш непотвърдени промени по подредбата
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-amber-300/40 bg-transparent px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/15 disabled:opacity-50"
            >
              Откажи
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-1.5 text-sm font-semibold text-amber-950 shadow-md disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Запази
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto w-full max-w-[1600px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-100 hover:bg-amber-500/15"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Настройки
            </Link>
            <div>
              <h1 className="font-display text-xl text-amber-100">Редактор на страници</h1>
              <p className="text-xs text-amber-100/60">
                Премести, скрий, добави или редактирай секции. Промените се запазват с история.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition",
                historyOpen
                  ? "border-amber-400 bg-amber-500/25 text-amber-100"
                  : "border-amber-500/30 bg-amber-500/5 text-amber-100/80 hover:bg-amber-500/15",
              )}
            >
              <History className="h-3.5 w-3.5" /> История
            </button>
            {(Object.keys(PAGE_LABELS) as PageKey[]).map((k) => (
              <Link
                key={k}
                to="/admin/settings/page-editor"
                search={{ page: k }}
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
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
                  const expanded = expandedId === s.id;
                  return (
                    <li
                      key={s.id}
                      draggable
                      onDragStart={() => onDragStart(idx)}
                      onDragOver={(e) => onDragOver(e, idx)}
                      className={cn(
                        "rounded-lg border border-amber-500/20 bg-[rgba(40,10,18,0.6)] transition",
                        !s.visible && "opacity-60",
                      )}
                    >
                      <div className="flex items-start gap-2 px-2.5 py-2">
                        <button
                          className="mt-0.5 cursor-grab text-amber-300/60 hover:text-amber-200 active:cursor-grabbing"
                          title="Премести"
                          aria-label="Премести"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-amber-100">
                            {s.title || def?.label || s.id}
                          </div>
                          {def?.description && (
                            <div className="mt-0.5 line-clamp-2 text-[11px] text-amber-100/55">
                              {def.description}
                            </div>
                          )}
                          {(s.title || s.subtitle || s.props) && (
                            <div className="mt-1 text-[10px] uppercase tracking-wide text-amber-300/70">
                              · персонализирано
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
                        <button
                          onClick={() => setExpandedId(expanded ? null : s.id)}
                          className={cn(
                            "rounded p-1 text-amber-200/70 hover:bg-amber-500/15",
                            expanded && "bg-amber-500/20 text-amber-100",
                          )}
                          aria-label="Редактирай"
                          title="Редактирай заглавие и props"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Премахни секцията от подредбата?")) remove(idx);
                          }}
                          className="rounded p-1 text-rose-300/70 hover:bg-rose-500/15"
                          aria-label="Изтрий"
                          title="Премахни от подредбата"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {expanded && (
                        <SectionEditor
                          section={s}
                          onChange={(patch) => updateOverride(idx, patch)}
                        />
                      )}
                    </li>
                  );
                })}
                {sections.length === 0 && !loading && (
                  <li className="rounded-lg border border-dashed border-amber-500/25 px-3 py-6 text-center text-xs text-amber-100/50">
                    Няма дефинирани секции за тази страница.
                  </li>
                )}
              </ul>

              {/* Add section */}
              {availableToAdd.length > 0 && (
                <div className="mt-3 rounded-lg border border-dashed border-amber-500/30 bg-[rgba(20,4,8,0.4)] p-2">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
                    <Plus className="h-3 w-3" /> Добави секция
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableToAdd.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => addSection(r.id)}
                        className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-500/20"
                        title={r.description}
                      >
                        + {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

            {historyOpen && (
              <div className="rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.65)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200">
                    <History className="h-3.5 w-3.5" /> История на промените
                  </div>
                  {revsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />}
                </div>
                <ul className="space-y-1.5">
                  {revisions.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-amber-500/15 bg-[rgba(40,10,18,0.55)] px-2.5 py-2 text-[12px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-amber-100">
                          {new Date(r.created_at).toLocaleString("bg-BG")}
                        </div>
                        {r.note && (
                          <div className="mt-0.5 text-[11px] text-amber-100/55">{r.note}</div>
                        )}
                        <div className="mt-0.5 text-[10px] text-amber-300/70">
                          {Array.isArray(r.sections) ? `${(r.sections as unknown[]).length} секции` : "—"}
                        </div>
                      </div>
                      <button
                        onClick={() => onRestoreRevision(r)}
                        disabled={saving}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-[11px] text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
                        title="Възстанови тази версия"
                      >
                        <Undo2 className="h-3 w-3" /> Възстанови
                      </button>
                    </li>
                  ))}
                  {!revsLoading && revisions.length === 0 && (
                    <li className="rounded-lg border border-dashed border-amber-500/25 px-3 py-4 text-center text-[11px] text-amber-100/50">
                      Все още няма запазени версии.
                    </li>
                  )}
                </ul>
              </div>
            )}
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

/** Inline editor за override на title/subtitle/props на секция. */
function SectionEditor({
  section,
  onChange,
}: {
  section: SectionState;
  onChange: (patch: Partial<Pick<SectionState, "title" | "subtitle" | "props">>) => void;
}) {
  const [propsText, setPropsText] = useState<string>(() =>
    section.props ? JSON.stringify(section.props, null, 2) : "",
  );
  const [propsError, setPropsError] = useState<string | null>(null);

  function commitProps(text: string) {
    setPropsText(text);
    if (!text.trim()) {
      setPropsError(null);
      onChange({ props: undefined });
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setPropsError("Очаквам JSON обект {ключ: стойност}.");
        return;
      }
      for (const [k, v] of Object.entries(parsed)) {
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(k)) {
          setPropsError(`Невалиден ключ: ${k}`);
          return;
        }
        if (v !== null && !["string", "number", "boolean"].includes(typeof v)) {
          setPropsError(`Стойността на "${k}" трябва да е текст, число, true/false или null.`);
          return;
        }
      }
      setPropsError(null);
      onChange({ props: parsed });
    } catch {
      setPropsError("Невалиден JSON.");
    }
  }

  return (
    <div className="space-y-2 border-t border-amber-500/15 bg-[rgba(20,4,8,0.45)] px-3 py-2.5">
      <label className="block">
        <span className="text-[11px] uppercase tracking-wide text-amber-200/80">Заглавие (override)</span>
        <input
          type="text"
          value={section.title ?? ""}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Остави празно за default"
          maxLength={200}
          className="mt-1 w-full rounded-md border border-amber-500/25 bg-[rgba(40,10,18,0.6)] px-2 py-1.5 text-sm text-amber-100 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="text-[11px] uppercase tracking-wide text-amber-200/80">Подзаглавие (override)</span>
        <textarea
          value={section.subtitle ?? ""}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Остави празно за default"
          maxLength={500}
          rows={2}
          className="mt-1 w-full resize-y rounded-md border border-amber-500/25 bg-[rgba(40,10,18,0.6)] px-2 py-1.5 text-sm text-amber-100 placeholder:text-amber-100/30 focus:border-amber-400 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="flex items-center justify-between text-[11px] uppercase tracking-wide text-amber-200/80">
          Props (JSON обект)
          {propsError && <span className="text-rose-300 normal-case">{propsError}</span>}
        </span>
        <textarea
          value={propsText}
          onChange={(e) => commitProps(e.target.value)}
          placeholder={'{ "ctaLabel": "Виж имотите" }'}
          rows={4}
          className={cn(
            "mt-1 w-full resize-y rounded-md border bg-[rgba(40,10,18,0.6)] px-2 py-1.5 font-mono text-[12px] text-amber-100 placeholder:text-amber-100/30 focus:outline-none",
            propsError ? "border-rose-400/60" : "border-amber-500/25 focus:border-amber-400",
          )}
        />
        <span className="mt-1 block text-[10px] text-amber-100/45">
          Стойностите трябва да са текст, число, true/false или null. Public страниците ги четат когато компонентът ги поддържа.
        </span>
      </label>
    </div>
  );
}
