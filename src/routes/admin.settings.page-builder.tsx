import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Eye, Trash2, Plus, Upload, Undo2, Redo2, Loader2, ChevronUp, ChevronDown,
} from "lucide-react";
import {
  getDesign, saveDesign, publishDesign,
  scrapeReference, generateFromReference,
} from "@/lib/page-builder/page-builder.functions";
import { BLOCK_REGISTRY, CATEGORY_LABELS, getBlockDef } from "@/lib/page-builder/blocks";
import { renderBlock } from "@/lib/page-builder/render";
import { useBuilderStore } from "@/lib/page-builder/store";
import { cn } from "@/lib/utils";

const PAGES = [
  { slug: "home", label: "Начало" },
  { slug: "about", label: "За нас" },
  { slug: "cities", label: "Градове" },
  { slug: "properties", label: "Имоти" },
  { slug: "brokers", label: "Брокери" },
  { slug: "contact", label: "Контакти" },
] as const;

export const Route = createFileRoute("/admin/settings/page-builder")({
  validateSearch: (s: Record<string, unknown>) => ({
    page: (typeof s.page === "string" ? s.page : "home") as (typeof PAGES)[number]["slug"],
  }),
  component: Page,
});

function Page() {
  const { page } = Route.useSearch();
  return <Builder key={page} slug={page} />;
}

function Builder({ slug }: { slug: (typeof PAGES)[number]["slug"] }) {
  const load = useServerFn(getDesign);
  const save = useServerFn(saveDesign);
  const publish = useServerFn(publishDesign);
  const scrape = useServerFn(scrapeReference);
  const generate = useServerFn(generateFromReference);

  const store = useBuilderStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("navbar");

  useEffect(() => {
    setLoading(true);
    load({ data: { page_slug: slug } })
      .then((res) => {
        if (res) store.setDesign(res.id, slug, res.layout);
        else store.setDesign(null, slug, { blocks: [], theme: {} });
      })
      .catch((e) => toast.error(String(e?.message ?? e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function onSave(pub?: boolean) {
    setSaving(true);
    try {
      const res = await save({
        data: {
          id: store.designId ?? undefined,
          page_slug: slug,
          layout: { blocks: store.blocks, theme: {} },
          publish: pub,
        },
      });
      if (!store.designId) store.setDesign(res.id, slug, { blocks: store.blocks, theme: {} });
      toast.success(pub ? "Запазено и публикувано." : "Запазено.");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function onPublishToggle() {
    if (!store.designId) {
      await onSave(true);
      return;
    }
    await publish({ data: { id: store.designId, publish: true } });
    toast.success("Дизайнът е публикуван и заменя страницата.");
  }

  const categories = Array.from(new Set(BLOCK_REGISTRY.map((b) => b.category)));
  const selected = store.blocks.find((b) => b.id === store.selectedId);
  const selectedDef = selected ? getBlockDef(selected.type) : null;

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-3">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.65)] p-3">
          <div className="flex items-center gap-2">
            <Link to="/admin/settings" className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs text-amber-100 hover:bg-amber-500/15">
              <ArrowLeft className="h-3.5 w-3.5" /> Назад
            </Link>
            <div className="text-sm font-semibold text-amber-100">Дизайн на страница:</div>
            {PAGES.map((p) => (
              <Link key={p.slug} to="/admin/settings/page-builder" search={{ page: p.slug }} className={cn("rounded-md px-2.5 py-1 text-xs", p.slug === slug ? "bg-amber-500/25 text-amber-100" : "bg-amber-500/5 text-amber-100/70 hover:bg-amber-500/15")}>
                {p.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => store.undo()} disabled={store.history.length === 0} className="rounded-md border border-amber-500/30 p-1.5 text-amber-100 disabled:opacity-40 hover:bg-amber-500/15" title="Undo"><Undo2 className="h-4 w-4" /></button>
            <button onClick={() => store.redo()} disabled={store.future.length === 0} className="rounded-md border border-amber-500/30 p-1.5 text-amber-100 disabled:opacity-40 hover:bg-amber-500/15" title="Redo"><Redo2 className="h-4 w-4" /></button>
            <button onClick={() => setShowRef(true)} className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/15">
              <Upload className="h-3.5 w-3.5" /> Качи референция
            </button>
            <button onClick={() => onSave(false)} disabled={saving} className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/25 disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Запази
            </button>
            <button onClick={onPublishToggle} disabled={saving || store.blocks.length === 0} className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 disabled:opacity-50">
              <Eye className="h-3.5 w-3.5" /> Публикувай
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr_300px]">
          {/* Library */}
          <div className="rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.65)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-200">Библиотека</div>
            <div className="mb-2 flex flex-wrap gap-1">
              {categories.map((c) => (
                <button key={c} onClick={() => setActiveCat(c)} className={cn("rounded-md px-2 py-1 text-[11px]", activeCat === c ? "bg-amber-500/25 text-amber-100" : "bg-amber-500/5 text-amber-100/60 hover:bg-amber-500/15")}>
                  {CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS]}
                </button>
              ))}
            </div>
            <div className="max-h-[70vh] space-y-1.5 overflow-y-auto pr-1">
              {BLOCK_REGISTRY.filter((b) => b.category === activeCat).map((b) => (
                <button key={b.type} onClick={() => store.addBlock(b.type)} className="flex w-full items-center gap-2 rounded-md border border-amber-500/20 bg-[rgba(40,10,18,0.6)] px-2 py-2 text-left text-xs text-amber-100 hover:border-amber-400/60">
                  <span>{b.emoji}</span>
                  <span className="flex-1 truncate">{b.label}</span>
                  <Plus className="h-3 w-3 opacity-60" />
                </button>
              ))}
            </div>
          </div>

          {/* Canvas */}
          <div className="rounded-2xl border border-amber-500/25 bg-white p-2 min-h-[80vh] overflow-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-amber-700"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : store.blocks.length === 0 ? (
              <div className="flex h-full min-h-[60vh] items-center justify-center text-center text-sm text-gray-400">
                Изтегли блок от лявата лента или качи референция за автоматично генериране.
              </div>
            ) : (
              <div className="flex flex-col">
                {store.blocks.map((b, idx) => (
                  <div key={b.id} onClick={() => store.select(b.id)} className={cn("relative group cursor-pointer ring-inset", store.selectedId === b.id && "ring-2 ring-amber-500")}>
                    {renderBlock(b)}
                    <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                      <button onClick={(e) => { e.stopPropagation(); if (idx > 0) store.moveBlock(idx, idx - 1); }} className="rounded bg-black/70 p-1 text-white"><ChevronUp className="h-3 w-3" /></button>
                      <button onClick={(e) => { e.stopPropagation(); if (idx < store.blocks.length - 1) store.moveBlock(idx, idx + 1); }} className="rounded bg-black/70 p-1 text-white"><ChevronDown className="h-3 w-3" /></button>
                      <button onClick={(e) => { e.stopPropagation(); store.removeBlock(b.id); }} className="rounded bg-red-600 p-1 text-white"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Property panel */}
          <div className="rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.65)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-200">Свойства</div>
            {!selected || !selectedDef ? (
              <div className="text-xs text-amber-100/50">Избери блок от канваса за редакция.</div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-amber-100">{selectedDef.label}</div>
                {selectedDef.controls.map((c) => (
                  <div key={c.key} className="space-y-1">
                    <label className="text-[11px] uppercase tracking-wider text-amber-200/70">{c.label}</label>
                    {c.type === "textarea" ? (
                      <textarea value={selected.props[c.key] ?? ""} onChange={(e) => store.updateProps(selected.id, { [c.key]: e.target.value })} rows={3} className="w-full rounded-md border border-amber-500/30 bg-black/30 px-2 py-1 text-xs text-amber-50" />
                    ) : c.type === "color" ? (
                      <div className="flex items-center gap-2">
                        <input type="color" value={selected.props[c.key] ?? "#000000"} onChange={(e) => store.updateProps(selected.id, { [c.key]: e.target.value })} className="h-7 w-10 rounded border border-amber-500/30 bg-transparent" />
                        <input type="text" value={selected.props[c.key] ?? ""} onChange={(e) => store.updateProps(selected.id, { [c.key]: e.target.value })} className="flex-1 rounded-md border border-amber-500/30 bg-black/30 px-2 py-1 text-xs text-amber-50" />
                      </div>
                    ) : c.type === "number" ? (
                      <input type="number" min={c.min} max={c.max} value={selected.props[c.key] ?? 0} onChange={(e) => store.updateProps(selected.id, { [c.key]: Number(e.target.value) })} className="w-full rounded-md border border-amber-500/30 bg-black/30 px-2 py-1 text-xs text-amber-50" />
                    ) : c.type === "select" ? (
                      <select value={selected.props[c.key] ?? ""} onChange={(e) => store.updateProps(selected.id, { [c.key]: e.target.value })} className="w-full rounded-md border border-amber-500/30 bg-black/30 px-2 py-1 text-xs text-amber-50">
                        {c.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input type="text" value={selected.props[c.key] ?? ""} onChange={(e) => store.updateProps(selected.id, { [c.key]: e.target.value })} className="w-full rounded-md border border-amber-500/30 bg-black/30 px-2 py-1 text-xs text-amber-50" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      {showRef && (
        <RefModal
          onClose={() => setShowRef(false)}
          onGenerated={(blocks: any[]) => {
            store.setDesign(store.designId, slug, { blocks, theme: {} });
            setShowRef(false);
            toast.success("Дизайнът е генериран. Можеш да го коригираш и да публикуваш.");
          }}
          slug={slug}
          scrape={scrape}
          generate={generate}
        />
      )}
    </div>
  );
}

function RefModal({ onClose, onGenerated, slug, scrape, generate }: any) {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"similar" | "clone">("clone");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string>("");

  async function run() {
    if (!url) return;
    setBusy(true);
    try {
      setStep("Сваляне на референцията...");
      const scraped = await scrape({ data: { url, mode } });
      setStep("Генериране на дизайн с AI...");
      const { layout } = await generate({ data: { mode, page_slug: slug, scraped } });
      const blocks = layout.blocks.map((b: any) => ({
        id: Math.random().toString(36).slice(2, 10),
        type: b.type,
        props: b.props,
      }));
      onGenerated(blocks);
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[rgba(20,4,8,0.95)] p-5">
        <div className="text-lg font-semibold text-amber-100">Качи референция</div>
        <p className="mt-1 text-xs text-amber-100/60">Сложи URL на страница, която искаш да копираш или която да послужи за вдъхновение.</p>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="mt-3 w-full rounded-md border border-amber-500/30 bg-black/30 px-3 py-2 text-sm text-amber-50" />
        <div className="mt-3 flex gap-2">
          <button onClick={() => setMode("clone")} className={cn("flex-1 rounded-md border p-3 text-xs", mode === "clone" ? "border-amber-400 bg-amber-500/20 text-amber-100" : "border-amber-500/25 text-amber-100/70")}>
            <div className="font-semibold">1:1 копие</div>
            <div className="mt-1 opacity-70">Опит за близък клонинг</div>
          </button>
          <button onClick={() => setMode("similar")} className={cn("flex-1 rounded-md border p-3 text-xs", mode === "similar" ? "border-amber-400 bg-amber-500/20 text-amber-100" : "border-amber-500/25 text-amber-100/70")}>
            <div className="font-semibold">Подобен</div>
            <div className="mt-1 opacity-70">Вдъхновение от стила</div>
          </button>
        </div>
        {step && <div className="mt-3 text-xs text-amber-200">{step}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-md border border-amber-500/25 px-3 py-1.5 text-xs text-amber-100/70">Откажи</button>
          <button onClick={run} disabled={busy || !url} className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Генерирай
          </button>
        </div>
      </div>
    </div>
  );
}
