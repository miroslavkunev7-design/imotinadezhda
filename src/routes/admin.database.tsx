import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listArchive, deleteArchive } from "@/lib/archive.functions";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Database, Trash2, Search, ExternalLink, FolderTree, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadPropertyZip, downloadBulkZip } from "@/lib/download-archive";

export const Route = createFileRoute("/admin/database")({
  component: DatabasePage,
});

type Row = any;

function DatabasePage() {
  const list = useServerFn(listArchive);
  const remove = useServerFn(deleteArchive);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([]);
  const [quarters, setQuarters] = useState<Array<{ id: string; name: string; city_id: string }>>([]);
  const [cityId, setCityId] = useState("");
  const [quarterId, setQuarterId] = useState("");
  const [year, setYear] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("cities").select("id, name").order("name").then(({ data }) => setCities(data ?? []));
    supabase.from("quarters").select("id, name, city_id").order("name").then(({ data }) => setQuarters(data ?? []));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await list({
        data: {
          city_id: cityId || undefined,
          quarter_id: quarterId || undefined,
          year: year ? Number(year) : undefined,
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
  }, [cityId, quarterId, year]);

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

  const years = useMemo(() => {
    const set = new Set(rows.map((r) => r.archived_year).filter(Boolean));
    return Array.from(set).sort((a, b) => b - a);
  }, [rows]);

  const filteredQuarters = quarters.filter((q) => !cityId || q.city_id === cityId);

  return (
    <AdminShell breadcrumb="База данни">
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-200">
              <Database className="h-3 w-3" /> Архив · само админ
            </div>
            <h1 className="mt-2 font-display text-4xl text-amber-100">База данни — Наши имоти</h1>
            <p className="mt-1 text-sm text-amber-100/70">
              Архивирани имоти от извлечените обяви. Подредени по град и квартал. Папки в Drive: <code className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-200">Година / Град / Квартал / Имот</code>
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-[rgba(255,251,243,0.95)] px-4 py-3 text-center shadow-lg">
            <div className="text-[10px] uppercase tracking-wider text-primary/60">Общо</div>
            <div className="font-display text-3xl text-primary">{loading ? "…" : rows.length}</div>
          </div>
        </header>

        {/* Filters */}
        <div className="grid gap-3 rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.95)] p-4 shadow-lg md:grid-cols-[1fr_1fr_1fr_2fr]">
          <select
            value={cityId}
            onChange={(e) => { setCityId(e.target.value); setQuarterId(""); }}
            className="rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-primary"
          >
            <option value="">Всички градове</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={quarterId}
            onChange={(e) => setQuarterId(e.target.value)}
            disabled={!cityId}
            className="rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-primary disabled:opacity-50"
          >
            <option value="">Всички квартали</option>
            {filteredQuarters.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-primary"
          >
            <option value="">Всички години</option>
            {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
            {years.filter((y) => y < new Date().getFullYear() - 2).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Търси по заглавие…"
                className="w-full rounded-lg border border-primary/20 bg-white pl-9 pr-3 py-2 text-sm text-primary"
              />
            </div>
            <button
              onClick={load}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              Търси
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.97)] shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-primary/15 bg-primary/5 text-left text-[11px] uppercase tracking-wider text-primary/70">
                <tr>
                  <th className="px-4 py-3">Заглавие</th>
                  <th className="px-4 py-3">Град</th>
                  <th className="px-4 py-3">Квартал</th>
                  <th className="px-4 py-3 text-right">Цена</th>
                  <th className="px-4 py-3 text-right">Площ</th>
                  <th className="px-4 py-3 text-center">Стаи</th>
                  <th className="px-4 py-3">Източник</th>
                  <th className="px-4 py-3">Архивиран</th>
                  <th className="px-4 py-3">Drive папка</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {loading ? (
                  <tr><td colSpan={10} className="p-10 text-center text-primary/50">Зареждане…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={10} className="p-10 text-center text-primary/50">Няма имоти. Архивирай от „Извлечени имоти".</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className="hover:bg-primary/5">
                    <td className="px-4 py-2.5 font-medium text-primary">{r.title}</td>
                    <td className="px-4 py-2.5 text-primary/80">{r.cities?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-primary/80">{r.quarters?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right text-primary">{r.price ? `${Number(r.price).toLocaleString()} ${r.currency}` : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-primary/80">{r.area_sqm ? `${r.area_sqm} m²` : "—"}</td>
                    <td className="px-4 py-2.5 text-center text-primary/80">{r.rooms ?? "—"}</td>
                    <td className="px-4 py-2.5 text-[11px] uppercase text-primary/60">{r.source ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-primary/60">{new Date(r.archived_at).toLocaleDateString("bg-BG")}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[10px] text-amber-800">
                        <FolderTree className="h-3 w-3" /> {r.drive_folder_path ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        {r.source_url && (
                          <a href={r.source_url} target="_blank" rel="noreferrer" className="rounded p-1.5 text-primary/60 hover:bg-primary/10" title="Оригинал">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button onClick={() => onDelete(r.id)} className="rounded p-1.5 text-red-600 hover:bg-red-500/10" title="Изтрий">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-amber-100/50">
          💡 Google Drive синхронизация ще се добави на следващ етап — папките вече се изчисляват автоматично.
        </p>
      </div>
    </AdminShell>
  );
}
