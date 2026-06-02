import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listExtracted, runScrape, updateExtracted, publishExtracted, deleteExtracted } from "@/lib/scraper.functions";
import { archiveExtracted } from "@/lib/archive.functions";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2, Eye, Trash2, Send, CheckCircle2, XCircle, Phone, Euro, Square, MapPin, Archive, Pencil, Calendar, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/extracted")({
  component: ExtractedPage,
});

type Row = any;

const SOURCE_LABEL: Record<string, string> = {
  realistimo: "Realistimo",
  imoti_bg: "Imoti.bg",
  olx: "OLX.bg",
  bazar_bg: "Bazar.bg",
  home_bg: "Home.bg",
  alo_bg: "Alo.bg",
  facebook: "Facebook",
  other: "Друго",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Чакащ преглед",
  approved: "Одобрен",
  rejected: "Отхвърлен",
  published: "Публикуван",
};

// Group together listings that look like the same property across sites
function dedupKey(r: Row): string {
  const phone = (r.phone ?? "").replace(/\D/g, "");
  if (phone.length >= 7) return `p:${phone}`;
  const price = r.price ? Math.round(Number(r.price) / 500) * 500 : "";
  const area = r.area_sqm ? Math.round(Number(r.area_sqm)) : "";
  const city = r.city_id ?? "";
  if (price && area) return `pa:${price}-${area}-${city}`;
  // fall back to normalized title
  const t = String(r.title ?? "").toLowerCase().replace(/[^а-яa-z0-9 ]/gi, "").slice(0, 60);
  return `t:${t}`;
}

function isToday(iso?: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function ExtractedPage() {
  const list = useServerFn(listExtracted);
  const run = useServerFn(runScrape);
  const update = useServerFn(updateExtracted);
  const publish = useServerFn(publishExtracted);
  const remove = useServerFn(deleteExtracted);
  const archive = useServerFn(archiveExtracted);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [status, setStatus] = useState<string>("pending");
  const [onlyToday, setOnlyToday] = useState<boolean>(true);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [previewRow, setPreviewRow] = useState<Row | null>(null);
  const [quarters, setQuarters] = useState<Array<{ id: string; name: string; city_id: string }>>([]);
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await list({ data: { status } });
      setRows(data);
    } catch (e: any) {
      toast.error(e.message ?? "Грешка при зареждане");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    supabase.from("cities").select("id, name").then(({ data }) => setCities(data ?? []));
    supabase.from("quarters").select("id, name, city_id").then(({ data }) => setQuarters(data ?? []));
  }, []);

  // Filter (today) + group duplicates
  const groups = useMemo(() => {
    const visible = onlyToday ? rows.filter((r) => isToday(r.scraped_at ?? r.created_at)) : rows;
    const map = new Map<string, Row[]>();
    for (const r of visible) {
      const k = dedupKey(r);
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    // primary = the richest item (most images / has price)
    return Array.from(map.values()).map((arr) => {
      const sorted = [...arr].sort((a, b) => {
        const ai = Array.isArray(a.images) ? a.images.length : 0;
        const bi = Array.isArray(b.images) ? b.images.length : 0;
        if (ai !== bi) return bi - ai;
        return (b.price ? 1 : 0) - (a.price ? 1 : 0);
      });
      return { primary: sorted[0], duplicates: sorted.slice(1) };
    });
  }, [rows, onlyToday]);

  const onScrape = async () => {
    setScraping(true);
    try {
      const res = await run({ data: {} });
      toast.success(`Готово: ${res.inserted} нови, ${res.skipped} пропуснати (вече ги има).`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Грешка при извличане");
    }
    setScraping(false);
  };

  const onPatch = async (id: string, patch: any) => {
    try {
      await update({ data: { id, patch } });
      toast.success("Запазено");
      // optimistic update on the open dialog
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      setEditRow((er: Row | null) => (er && er.id === id ? { ...er, ...patch } : er));
    } catch (e: any) {
      toast.error(e.message ?? "Грешка");
    }
  };

  const onPublish = async (id: string) => {
    if (!confirm("Сигурни ли сте, че искате да публикувате тази обява на сайта?")) return;
    try {
      await publish({ data: { id } });
      toast.success("Публикувано на сайта");
      setEditRow(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Грешка");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Изтриване?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Изтрито");
      if (editRow?.id === id) setEditRow(null);
      if (previewRow?.id === id) setPreviewRow(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Грешка");
    }
  };

  const onArchive = async (id: string) => {
    try {
      const res = await archive({ data: { id } });
      toast.success(`Запазено в архива → ${res.drive_folder_path}`);
    } catch (e: any) {
      toast.error(e.message ?? "Грешка при архивиране");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-amber-100">Извлечени имоти</h1>
          <p className="mt-1 max-w-2xl text-sm text-amber-100/70">
            Извличане от Realistimo, Imoti.bg, OLX, Bazar.bg, Home.bg и Alo.bg — <strong className="text-amber-200">само нови обяви от днес</strong>. Дубликати се групират автоматично.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <button
          onClick={onScrape}
          disabled={scraping}
          className="group relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-primary via-primary to-[#5e0f1d] p-5 text-left text-primary-foreground shadow-[0_18px_45px_rgba(139, 26, 43,0.45)] transition hover:scale-[1.01] disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            {scraping ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            <span className="font-bold uppercase tracking-wider">{scraping ? "Извличане..." : "Извлечи днешни"}</span>
          </div>
          <p className="mt-2 text-xs text-primary-foreground/70">Само нови за днес · пропуска вече извлечените</p>
        </button>

        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.92)] p-5 shadow-lg">
          <label className="text-xs uppercase tracking-wider text-primary/70">Статус</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-2 w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-primary"
          >
            <option value="all">Всички</option>
            <option value="pending">Чакащи преглед</option>
            <option value="approved">Одобрени</option>
            <option value="published">Публикувани</option>
            <option value="rejected">Отхвърлени</option>
          </select>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.92)] p-5 shadow-lg">
          <label className="text-xs uppercase tracking-wider text-primary/70 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Период
          </label>
          <button
            onClick={() => setOnlyToday((v) => !v)}
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm font-semibold transition ${onlyToday ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-800" : "border-primary/20 bg-white text-primary"}`}
          >
            {onlyToday ? "✓ Само от днес" : "Всички дати"}
          </button>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.92)] p-5 shadow-lg">
          <div className="text-xs uppercase tracking-wider text-primary/70">Уникални имоти</div>
          <div className="mt-1 font-display text-3xl text-primary">{loading ? "..." : groups.length}</div>
          <div className="text-xs text-primary/60">
            {loading ? "Зареждане..." : `${rows.length} общо, ${rows.length - groups.length} дубликата скрити`}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.95)] p-3 shadow-lg">
        {loading ? (
          <div className="p-10 text-center text-primary/60">Зареждане...</div>
        ) : groups.length === 0 ? (
          <div className="p-10 text-center text-primary/60">
            Няма {onlyToday ? "обяви от днес" : "обяви в този статус"}. Кликнете „Извлечи днешни" горе.
          </div>
        ) : (
          <div className="divide-y divide-primary/10">
            {groups.map(({ primary: r, duplicates }) => (
              <div key={r.id} className="flex items-start gap-3 p-3 transition hover:bg-primary/5">
                <button
                  onClick={() => setPreviewRow(r)}
                  className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-xs text-primary/60 hover:ring-2 hover:ring-primary/40"
                >
                  {Array.isArray(r.images) && r.images[0] ? (
                    <img src={r.images[0]} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    "няма"
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                      {SOURCE_LABEL[r.source] ?? r.source}
                    </span>
                    <span className="rounded-md bg-amber-200/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      {r.seller_type === "private" ? "частен" : r.seller_type === "agency" ? "агенция" : "—"}
                    </span>
                    <span className="rounded-md bg-primary/5 px-1.5 py-0.5 text-[10px] uppercase text-primary/70">
                      {STATUS_LABEL[r.status]}
                    </span>
                    {Array.isArray(r.images) && r.images.length > 0 ? (
                      <span className="text-[10px] text-primary/50">{r.images.length} снимки</span>
                    ) : null}
                    {duplicates.length > 0 && (
                      <span
                        title={duplicates.map((d) => SOURCE_LABEL[d.source] ?? d.source).join(", ")}
                        className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-700"
                      >
                        <Layers className="h-3 w-3" /> +{duplicates.length} дубл.
                      </span>
                    )}
                  </div>
                  <div className="mt-1 line-clamp-1 text-sm font-semibold text-primary">{r.title ?? "Без заглавие"}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-primary/60">
                    {r.price ? <span className="inline-flex items-center gap-1"><Euro className="h-3 w-3" />{Number(r.price).toLocaleString()} {r.currency}</span> : null}
                    {r.area_sqm ? <span className="inline-flex items-center gap-1"><Square className="h-3 w-3" />{r.area_sqm} m²</span> : null}
                    {r.cities?.name ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.cities.name}</span> : null}
                    {r.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => setPreviewRow(r)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-sm hover:bg-primary/5"
                    >
                      <Eye className="h-3.5 w-3.5" /> Прегледай
                    </button>
                    <button
                      onClick={() => setEditRow(r)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-sm hover:bg-primary/5"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Редакция
                    </button>
                    {r.status !== "published" ? (
                      <button
                        onClick={() => onPublish(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90"
                      >
                        <Send className="h-3.5 w-3.5" /> Публикуване
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Публикувано
                      </span>
                    )}
                    <a
                      href={r.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 px-3 py-1.5 text-xs text-primary/80 hover:bg-primary/5"
                    >
                      Оригинал
                    </a>
                    <button
                      onClick={() => onArchive(r.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-500/20"
                      title="Запази в наши имоти (архив, само админ)"
                    >
                      <Archive className="h-3.5 w-3.5" /> В архив
                    </button>
                    <button
                      onClick={() => onDelete(r.id)}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-700 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewRow} onOpenChange={(o) => !o && setPreviewRow(null)}>
        <DialogContent className="max-w-2xl border-amber-500/30 bg-[rgba(255,251,243,0.98)] text-primary">
          {previewRow && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">{previewRow.title ?? "Имот"}</DialogTitle>
                <DialogDescription className="text-primary/60">
                  {SOURCE_LABEL[previewRow.source]} · {previewRow.cities?.name ?? "—"}
                </DialogDescription>
              </DialogHeader>
              {Array.isArray(previewRow.images) && previewRow.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
                  {previewRow.images.slice(0, 12).map((url: string, i: number) => (
                    <img key={i} src={url} alt="" className="h-44 w-full rounded-lg object-cover" loading="lazy" decoding="async" />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg bg-primary/5 p-8 text-center text-sm text-primary/60">Няма снимки</div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {previewRow.price && (
                  <Stat label="Цена" value={`${Number(previewRow.price).toLocaleString()} ${previewRow.currency}`} />
                )}
                {previewRow.area_sqm && <Stat label="Площ" value={`${previewRow.area_sqm} m²`} />}
                {previewRow.bedrooms && <Stat label="Спални" value={String(previewRow.bedrooms)} />}
                {previewRow.phone && <Stat label="Телефон" value={previewRow.phone} />}
              </div>
              {previewRow.description && (
                <p className="max-h-32 overflow-y-auto rounded-lg bg-primary/5 p-3 text-sm leading-relaxed text-primary/80">
                  {previewRow.description}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => {
                    const r = previewRow;
                    setPreviewRow(null);
                    setEditRow(r);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
                >
                  <Pencil className="h-4 w-4" /> Редактирай
                </button>
                <a
                  href={previewRow.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 px-4 py-2 text-sm text-primary/80 hover:bg-primary/5"
                >
                  Виж оригинала
                </a>
                {previewRow.status !== "published" && (
                  <button
                    onClick={() => onPublish(previewRow.id)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4" /> Публикувай
                  </button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-2xl border-amber-500/30 bg-[rgba(255,251,243,0.98)] text-primary">
          {editRow && (
            <EditForm
              key={editRow.id}
              row={editRow}
              cities={cities}
              quarters={quarters}
              onPatch={(patch) => onPatch(editRow.id, patch)}
              onPublish={() => onPublish(editRow.id)}
              onDelete={() => onDelete(editRow.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-primary/15 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-primary/60">{label}</div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}

function EditForm({
  row,
  cities,
  quarters,
  onPatch,
  onPublish,
  onDelete,
}: {
  row: Row;
  cities: Array<{ id: string; name: string }>;
  quarters: Array<{ id: string; name: string; city_id: string }>;
  onPatch: (patch: any) => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  const [cityId, setCityId] = useState<string>(row.city_id ?? "");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">CRM редактор — чернова</DialogTitle>
        <DialogDescription className="text-primary/60">
          {SOURCE_LABEL[row.source]} · {STATUS_LABEL[row.status]}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <a href={row.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline">
          <Eye className="h-3 w-3" /> Виж оригинала
        </a>

        <Field label="Заглавие">
          <input
            defaultValue={row.title ?? ""}
            onBlur={(e) => e.target.value !== row.title && onPatch({ title: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Цена">
            <input
              type="number"
              defaultValue={row.price ?? ""}
              onBlur={(e) => onPatch({ price: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Валута">
            <select
              defaultValue={row.currency ?? "EUR"}
              onBlur={(e) => onPatch({ currency: e.target.value })}
              className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
            >
              <option>EUR</option>
              <option>BGN</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Площ (m²)">
            <input
              type="number"
              defaultValue={row.area_sqm ?? ""}
              onBlur={(e) => onPatch({ area_sqm: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Спални">
            <input
              type="number"
              defaultValue={row.bedrooms ?? ""}
              onBlur={(e) => onPatch({ bedrooms: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="Телефон">
          <input
            defaultValue={row.phone ?? ""}
            onBlur={(e) => e.target.value !== row.phone && onPatch({ phone: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Град">
          <select
            value={cityId}
            onChange={(e) => {
              setCityId(e.target.value);
              onPatch({ city_id: e.target.value || null, quarter_id: null });
            }}
            className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
          >
            <option value="">— Изберете —</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Квартал">
          <select
            defaultValue={row.quarter_id ?? ""}
            onChange={(e) => onPatch({ quarter_id: e.target.value || null })}
            className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
            disabled={!cityId}
          >
            <option value="">— По избор —</option>
            {quarters.filter((q) => q.city_id === cityId).map((q) => (
              <option key={q.id} value={q.id}>{q.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Описание">
          <textarea
            defaultValue={row.description ?? ""}
            rows={4}
            onBlur={(e) => e.target.value !== row.description && onPatch({ description: e.target.value })}
            className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-primary/10 pt-3">
        {row.status !== "published" && (
          <button
            onClick={onPublish}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
          >
            <Send className="h-4 w-4" /> Публикувай на сайта
          </button>
        )}
        <button
          onClick={() => onPatch({ status: "approved" })}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-500/20"
        >
          <CheckCircle2 className="h-4 w-4" /> Одобри
        </button>
        <button
          onClick={() => onPatch({ status: "rejected" })}
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 hover:bg-red-500/20"
        >
          <XCircle className="h-4 w-4" /> Отхвърли
        </button>
        <button
          onClick={onDelete}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-700 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" /> Изтрий
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-primary/70">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
