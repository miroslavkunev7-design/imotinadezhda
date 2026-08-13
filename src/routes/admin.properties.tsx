import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listArchive, deleteArchive, createArchive } from "@/lib/archive.functions";
import { supabase } from "@/integrations/supabase/client";

import { Database, Trash2, Search, Download, Loader2, ArrowLeft, Folder, Plus } from "lucide-react";
import { toast } from "sonner";
import { downloadPropertyZip, downloadBulkZip } from "@/lib/download-archive";
import cityBurgas from "@/assets/city-burgas.jpeg";
import cityVarna from "@/assets/city-varna.jpeg";
import cityShumen from "@/assets/city-shumen.jpeg";
import dealSaleImg from "@/assets/deal-sale.jpeg";
import dealRentImg from "@/assets/deal-rent.jpeg";
import dealGreenImg from "@/assets/deal-green.jpeg";
import { PropertyDetailModal } from "@/components/admin/property-detail-modal";

export const Route = createFileRoute("/admin/properties")({
  component: DatabasePage,
});

type Row = any;
type Deal = "sale" | "rent" | "green";

const DEAL_META: Record<Deal, { label: string; image: string; desc: string }> = {
  sale: { label: "Продажби", image: dealSaleImg, desc: "Имоти за продажба" },
  rent: { label: "Наеми", image: dealRentImg, desc: "Имоти под наем" },
  green: { label: "Проекти на зелено", image: dealGreenImg, desc: "Строящи се проекти" },
};

const dealOf = (r: any): Deal => {
  if (r?.is_green_project || r?.status === "green" || r?.status === "off_plan") return "green";
  return r?.status === "rent" ? "rent" : "sale";
};

const CITY_FALLBACK: Record<string, string> = {
  burgas: cityBurgas,
  varna: cityVarna,
  shumen: cityShumen,
};

function DatabasePage() {
  const list = useServerFn(listArchive);
  const remove = useServerFn(deleteArchive);
  const create = useServerFn(createArchive);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<Array<{ id: string; name: string; slug: string; hero_image_url: string | null }>>([]);
  const [quarters, setQuarters] = useState<Array<{ id: string; name: string; slug: string; city_id: string; image_url: string | null }>>([]);
  const [deal, setDeal] = useState<Deal | "">("");
  const [cityId, setCityId] = useState("");
  const [quarterId, setQuarterId] = useState("");
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const onDownload = async (row: Row) => {
    setDownloadingId(row.id);
    try {
      await downloadPropertyZip(row);
      toast.success("Готово — изтегли ZIP файла");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при изтегляне");
    }
    setDownloadingId(null);
  };

  const onBulkDownload = async () => {
    if (!rows.length) return;
    setBulkDownloading(true);
    try {
      await downloadBulkZip(rows);
      toast.success(`Готово — ${rows.length} имота в ZIP`);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при пакетиране");
    }
    setBulkDownloading(false);
  };

  useEffect(() => {
    supabase.from("cities").select("id, name, slug, hero_image_url").order("display_order").then(({ data }) => setCities((data as any) ?? []));
    supabase.from("quarters").select("id, name, slug, city_id, image_url").order("name").then(({ data }) => setQuarters((data as any) ?? []));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await list({
        data: {
          city_id: cityId || undefined,
          quarter_id: quarterId || undefined,
          search: search || undefined,
        },
      });
      setRows(data);
    } catch (e: any) {
      toast.error(e.message ?? "Грешка при зареждане");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, quarterId]);

  const onDelete = async (id: string) => {
    if (!confirm("Изтриване от архива?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Изтрито");
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e: any) {
      toast.error(e.message ?? "Грешка");
    }
  };

  // Counts per (deal, city, quarter)
  const countsByDeal = useMemo(() => {
    const m: Record<Deal, number> = { sale: 0, rent: 0, green: 0 };
    const scope = cityId ? rows.filter((r) => r.city_id === cityId) : rows;
    for (const r of scope) m[dealOf(r)]++;
    return m;
  }, [rows, cityId]);

  const rowsForDeal = useMemo(() => {
    if (!deal) return [];
    return rows.filter((r) => dealOf(r) === deal);
  }, [rows, deal]);

  const countsByCity = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) if (r.city_id) m[r.city_id] = (m[r.city_id] ?? 0) + 1;
    return m;
  }, [rows]);

  const countsByQuarter = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rowsForDeal) {
      if (cityId && r.city_id !== cityId) continue;
      if (r.quarter_id) m[r.quarter_id] = (m[r.quarter_id] ?? 0) + 1;
    }
    return m;
  }, [rowsForDeal, cityId]);

  const visibleQuarters = quarters.filter((q) => !cityId || q.city_id === cityId);
  const selectedCity = cities.find((c) => c.id === cityId);
  const selectedQuarter = quarters.find((q) => q.id === quarterId);

  const finalRows = rowsForDeal
    .filter((r) => (!cityId || r.city_id === cityId) && (!quarterId || r.quarter_id === quarterId))
    .filter((r) => !search || (r.title ?? "").toLowerCase().includes(search.toLowerCase()));

  const cityImage = (c: { slug: string; hero_image_url: string | null }) =>
    c.hero_image_url || CITY_FALLBACK[c.slug] || cityBurgas;

  return (
    <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-200">
              <Database className="h-3 w-3" /> Архив · само админ
            </div>
            <h1 className="mt-2 font-display text-4xl text-amber-100">Имоти</h1>
          </div>
          {cityId && (
            <div className="rounded-xl border border-amber-500/25 bg-[rgba(255,251,243,0.95)] px-4 py-3 text-center shadow-lg">
              <div className="text-[10px] uppercase tracking-wider text-primary/60">Общо</div>
              <div className="font-display text-3xl text-primary">{loading ? "…" : finalRows.length}</div>
            </div>
          )}
        </header>

        {/* Breadcrumbs */}
        {(cityId || deal) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={() => { setCityId(""); setDeal(""); setQuarterId(""); }}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-3 py-1.5 text-amber-100 hover:bg-amber-500/25"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Назад
            </button>
            <button
              onClick={() => { setCityId(""); setDeal(""); setQuarterId(""); }}
              className={`rounded-md px-2 py-1 ${!cityId ? "font-semibold text-amber-100" : "text-amber-300 hover:text-amber-100"}`}
            >
              Градове
            </button>
            {selectedCity && (
              <>
                <span className="text-amber-100/40">›</span>
                <button
                  onClick={() => { setDeal(""); setQuarterId(""); }}
                  className={`rounded-md px-2 py-1 ${!deal ? "font-semibold text-amber-100" : "text-amber-300 hover:text-amber-100"}`}
                >
                  {selectedCity.name}
                </button>
              </>
            )}
            {deal && (
              <>
                <span className="text-amber-100/40">›</span>
                <button
                  onClick={() => setQuarterId("")}
                  className={`rounded-md px-2 py-1 ${!quarterId ? "font-semibold text-amber-100" : "text-amber-300 hover:text-amber-100"}`}
                >
                  {DEAL_META[deal].label}
                </button>
              </>
            )}
            {selectedQuarter && (
              <>
                <span className="text-amber-100/40">›</span>
                <span className="font-semibold text-amber-100 px-2 py-1">{selectedQuarter.name}</span>
              </>
            )}
          </div>
        )}

        {/* Level 0: Cities */}
        {!cityId && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((c) => (
              <button
                key={c.id}
                onClick={() => setCityId(c.id)}
                className="crm-folder-card group relative block text-left transition hover:-translate-y-0.5 hover:shadow-2xl"
              >
                <div className="relative h-48 overflow-hidden rounded-[4px_18px_18px_18px] ring-1 ring-black/10">
                  <img src={cityImage(c)} alt={c.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="font-display text-2xl text-white drop-shadow">{c.name}</div>
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                      {countsByCity[c.id] ?? 0} имот{(countsByCity[c.id] ?? 0) === 1 ? "" : "а"}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Level 1: Deal type (per city) */}
        {cityId && !deal && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(["sale", "rent", "green"] as Deal[]).map((key) => {
              const meta = DEAL_META[key];
              const count = countsByDeal[key];
              return (
                <button
                  key={key}
                  onClick={() => setDeal(key)}
                  className="group relative overflow-hidden rounded-2xl border border-amber-500/25 bg-black/40 shadow-lg transition hover:border-amber-400 hover:shadow-xl"
                >
                  <div className="relative h-52 overflow-hidden">
                    <img src={meta.image} alt={meta.label} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                    <div className="font-display text-2xl text-white">{meta.label}</div>
                    <div className="text-xs text-white/70">{meta.desc}</div>
                    <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                      {count} имот{count === 1 ? "" : "а"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Level 2: Quarters */}
        {cityId && deal && !quarterId && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleQuarters.map((q) => (
              <button
                key={q.id}
                onClick={() => setQuarterId(q.id)}
                className="group relative overflow-hidden rounded-2xl border border-amber-500/25 bg-black/40 shadow-lg transition hover:border-amber-400 hover:shadow-xl"
              >
                <div className="relative h-40 overflow-hidden bg-primary/20">
                  {q.image_url ? (
                    <img src={q.image_url} alt={q.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-amber-300/50">
                      <Folder className="h-14 w-14" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3.5 text-left">
                  <div className="flex items-center gap-1.5 text-lg font-semibold text-white">
                    <Folder className="h-4 w-4 text-amber-300" /> {q.name}
                  </div>
                  <div className="text-[11px] text-white/80">Квартал / село</div>
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {countsByQuarter[q.id] ?? 0} имот{(countsByQuarter[q.id] ?? 0) === 1 ? "" : "а"}
                  </div>
                </div>
              </button>
            ))}
            {visibleQuarters.length === 0 && (
              <div className="col-span-full rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.95)] p-10 text-center text-primary/60">
                Няма квартали за този град.
              </div>
            )}
          </div>
        )}

        {/* Level 3: Properties as folder cards */}
        {deal && cityId && quarterId && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Търси по заглавие…"
                  className="w-full rounded-lg border border-primary/20 bg-white pl-9 pr-3 py-2 text-sm text-primary"
                />
              </div>
              <button
                onClick={onBulkDownload}
                disabled={bulkDownloading || !finalRows.length}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/90 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary shadow-lg hover:bg-amber-400 disabled:opacity-50"
              >
                {bulkDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Изтегли всички ({finalRows.length})
              </button>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.97)] p-5 shadow-lg">
              {loading ? (
                <div className="p-10 text-center text-primary/50">Зареждане…</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {/* + Нова папка */}
                  <button
                    onClick={async () => {
                      try {
                        const res = await create({
                          data: {
                            city_id: cityId || null,
                            quarter_id: quarterId || null,
                          },
                        });
                        await load();
                        setOpenId(res.id);
                      } catch (e: any) {
                        toast.error(e?.message ?? "Грешка при създаване");
                      }
                    }}
                    className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/25 bg-white/60 p-6 text-primary transition hover:border-primary/60 hover:bg-white"
                  >
                    <Plus className="h-10 w-10 text-primary/70 group-hover:text-primary" strokeWidth={2.5} />
                    <div className="font-semibold text-primary">Нова папка</div>
                    <div className="text-[11px] text-primary/60">Ръчно добавяне</div>
                  </button>

                  {finalRows.map((r) => {
                    const priceLabel = r.price ? `${Number(r.price).toLocaleString()} ${r.currency}` : "Без цена";
                    const subtitle = [
                      r.rooms ? `${r.rooms}` : null,
                      r.area_sqm ? `${r.area_sqm} м²` : null,
                      r.title,
                    ].filter(Boolean).join(" · ");
                    return (
                      <div
                        key={r.id}
                        className="group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-primary/15 bg-white/70 p-5 text-center transition hover:border-primary/50 hover:bg-white hover:shadow-md"
                        onClick={() => setOpenId(r.id)}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(r.id); }}
                          className="absolute right-2 top-2 rounded p-1.5 text-red-600/70 opacity-0 hover:bg-red-500/10 hover:text-red-600 group-hover:opacity-100"
                          title="Изтрий"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDownload(r); }}
                          disabled={downloadingId === r.id}
                          className="absolute left-2 top-2 rounded p-1.5 text-primary/60 opacity-0 hover:bg-primary/10 hover:text-primary group-hover:opacity-100 disabled:opacity-100"
                          title="Изтегли ZIP"
                        >
                          {downloadingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        </button>
                        <Folder className="h-14 w-14 text-primary" strokeWidth={1.6} />
                        <div className="font-display text-xl font-bold text-primary">{priceLabel}</div>
                        <div className="line-clamp-2 text-xs text-primary/70">{subtitle || "—"}</div>
                        {r.is_published && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-primary">
                            ✓ Публикуван
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {finalRows.length === 0 && (
                    <div className="col-span-full rounded-xl bg-white/50 p-8 text-center text-sm text-primary/60">
                      Няма имоти в тази папка — добави чрез „Нова папка".
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {openId && (
          <PropertyDetailModal
            id={openId}
            onClose={() => setOpenId(null)}
            onDeleted={(id) => setRows((r) => r.filter((x) => x.id !== id))}
            onChanged={() => load()}
          />
        )}
    </div>
  );
}
