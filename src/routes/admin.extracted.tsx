import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listExtracted, runScrape, updateExtracted, publishExtracted, deleteExtracted } from "@/lib/scraper.functions";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2, Eye, Trash2, Send, CheckCircle2, XCircle, Phone, Euro, Square, MapPin } from "lucide-react";
import { toast } from "sonner";

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

function ExtractedPage() {
  const list = useServerFn(listExtracted);
  const run = useServerFn(runScrape);
  const update = useServerFn(updateExtracted);
  const publish = useServerFn(publishExtracted);
  const remove = useServerFn(deleteExtracted);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [status, setStatus] = useState<string>("pending");
  const [selected, setSelected] = useState<Row | null>(null);
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

  const onScrape = async () => {
    setScraping(true);
    try {
      const res = await run({ data: {} });
      toast.success(`Готово: ${res.inserted} нови чернови, ${res.skipped} пропуснати (дубликати).`);
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
      await load();
      if (selected?.id === id) setSelected({ ...selected, ...patch });
    } catch (e: any) {
      toast.error(e.message ?? "Грешка");
    }
  };

  const onPublish = async (id: string) => {
    if (!confirm("Сигурни ли сте, че искате да публикувате тази обява на сайта?")) return;
    try {
      await publish({ data: { id } });
      toast.success("Публикувано на сайта");
      await load();
      setSelected(null);
    } catch (e: any) {
      toast.error(e.message ?? "Грешка");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Изтриване?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Изтрито");
      await load();
      if (selected?.id === id) setSelected(null);
    } catch (e: any) {
      toast.error(e.message ?? "Грешка");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-amber-100">Извлечени имоти</h1>
          <p className="mt-1 max-w-2xl text-sm text-amber-100/70">
            Извличане от Realistimo, Imoti.bg, OLX (само частни), Bazar.bg, Home.bg и Alo.bg —{" "}
            <strong className="text-amber-200">само обяви от собственик / частни</strong>. Записват се като{" "}
            <strong className="text-amber-200">непубликувани чернови</strong> — редактирайте телефон, цена, снимки, после „Публикувай на сайта".
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/85">
        Нищо не отива автоматично на сайта. Публикувате само след преглед в CRM редактора.
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <button
          onClick={onScrape}
          disabled={scraping}
          className="group relative col-span-1 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-primary via-primary to-[#3a0a14] p-5 text-left text-primary-foreground shadow-[0_18px_45px_rgba(0,0,0,0.45)] transition hover:scale-[1.01] disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            {scraping ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            <span className="font-bold uppercase tracking-wider">{scraping ? "Извличане..." : "Извлечи имоти (всички сайтове)"}</span>
          </div>
          <p className="mt-2 text-xs text-primary-foreground/70">Бургас · Варна · Шумен · Нови пазар · само частни</p>
        </button>

        <div className="col-span-1 rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.92)] p-5 shadow-lg">
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

        <div className="col-span-1 rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.92)] p-5 shadow-lg">
          <div className="text-xs uppercase tracking-wider text-primary/70">Списък</div>
          <div className="mt-1 font-display text-3xl text-primary">{loading ? "..." : rows.length}</div>
          <div className="text-xs text-primary/60">{loading ? "Зареждане..." : "обяви в избрания статус"}</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        {/* List */}
        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.95)] p-3 shadow-lg">
          {loading ? (
            <div className="p-10 text-center text-primary/60">Зареждане...</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-primary/60">Няма обяви в този статус. Кликнете „Извлечи имоти" горе.</div>
          ) : (
            <div className="divide-y divide-primary/10">
              {rows.map((r) => {
                const isOpen = selected?.id === r.id;
                return (
                  <div
                    key={r.id}
                    className={`flex items-start gap-3 p-3 transition ${isOpen ? "bg-primary/10" : "hover:bg-primary/5"}`}
                  >
                    <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-xs text-primary/60">
                      {Array.isArray(r.images) && r.images[0] ? (
                        <img src={r.images[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        "няма"
                      )}
                    </div>
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
                          onClick={() => setSelected(r)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-white px-3 py-1.5 text-xs font-semibold text-primary shadow-sm hover:bg-primary/5"
                        >
                          <Eye className="h-3.5 w-3.5" /> Редакция
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
                          onClick={() => onDelete(r.id)}
                          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-700 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </div>

        {/* Editor */}
        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.95)] p-5 shadow-lg">
          <h2 className="font-display text-xl text-primary">CRM редактор — чернова</h2>
          <p className="mt-1 text-xs text-primary/60">Променете телефон, цена, квартал преди публикуване.</p>
          {!selected ? (
            <p className="mt-6 text-sm text-primary/50">Изберете обява от списъка.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <a href={selected.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline">
                <Eye className="h-3 w-3" /> Виж оригинала ({SOURCE_LABEL[selected.source]})
              </a>

              <Field label="Заглавие">
                <input
                  defaultValue={selected.title ?? ""}
                  onBlur={(e) => e.target.value !== selected.title && onPatch(selected.id, { title: e.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Цена">
                  <input
                    type="number"
                    defaultValue={selected.price ?? ""}
                    onBlur={(e) => onPatch(selected.id, { price: e.target.value ? Number(e.target.value) : null })}
                    className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Валута">
                  <select
                    defaultValue={selected.currency ?? "EUR"}
                    onBlur={(e) => onPatch(selected.id, { currency: e.target.value })}
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
                    defaultValue={selected.area_sqm ?? ""}
                    onBlur={(e) => onPatch(selected.id, { area_sqm: e.target.value ? Number(e.target.value) : null })}
                    className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Спални">
                  <input
                    type="number"
                    defaultValue={selected.bedrooms ?? ""}
                    onBlur={(e) => onPatch(selected.id, { bedrooms: e.target.value ? Number(e.target.value) : null })}
                    className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <Field label="Телефон">
                <input
                  defaultValue={selected.phone ?? ""}
                  onBlur={(e) => e.target.value !== selected.phone && onPatch(selected.id, { phone: e.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Град">
                <select
                  defaultValue={selected.city_id ?? ""}
                  onChange={(e) => onPatch(selected.id, { city_id: e.target.value || null, quarter_id: null })}
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
                  defaultValue={selected.quarter_id ?? ""}
                  onChange={(e) => onPatch(selected.id, { quarter_id: e.target.value || null })}
                  className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
                  disabled={!selected.city_id}
                >
                  <option value="">— По избор —</option>
                  {quarters.filter((q) => q.city_id === selected.city_id).map((q) => (
                    <option key={q.id} value={q.id}>{q.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Описание">
                <textarea
                  defaultValue={selected.description ?? ""}
                  rows={4}
                  onBlur={(e) => e.target.value !== selected.description && onPatch(selected.id, { description: e.target.value })}
                  className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm"
                />
              </Field>

              <div className="flex flex-wrap gap-2 pt-2">
                {selected.status !== "published" ? (
                  <button
                    onClick={() => onPublish(selected.id)}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4" /> Публикувай на сайта
                  </button>
                ) : null}
                <button
                  onClick={() => onPatch(selected.id, { status: "approved" })}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-500/20"
                >
                  <CheckCircle2 className="h-4 w-4" /> Одобри
                </button>
                <button
                  onClick={() => onPatch(selected.id, { status: "rejected" })}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 hover:bg-red-500/20"
                >
                  <XCircle className="h-4 w-4" /> Отхвърли
                </button>
                <button
                  onClick={() => onDelete(selected.id)}
                  className="ml-auto inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-700 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" /> Изтрий
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
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
