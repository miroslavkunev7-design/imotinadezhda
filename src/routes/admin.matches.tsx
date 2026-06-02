import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Phone, Mail, ExternalLink, Sparkles } from "lucide-react";
import { listMatches, updateMatchStatus, triggerMatchForProperty } from "@/lib/crm.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/matches")({
  component: MatchesAdmin,
});

function MatchesAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "new" | "contacted" | "interested" | "rejected">("new");

  const load = async () => {
    try { setRows(await listMatches()); } catch (e: any) { alert(e.message); }
  };
  useEffect(() => { load(); }, []);

  const runForAll = async () => {
    const { data: props } = await supabase.from("properties").select("id").eq("is_published", true);
    if (!props) return;
    let count = 0;
    for (const p of props) {
      try { const r = await triggerMatchForProperty({ data: { property_id: p.id } }); count += r.matches; } catch {}
    }
    alert(`Готово. Намерени съвпадения: ${count}`);
    await load();
  };

  const update = async (id: string, status: any) => {
    try { await updateMatchStatus({ data: { id, status } }); await load(); } catch (e: any) { alert(e.message); }
  };

  const filtered = rows.filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-amber-100">Съвпадения <Heart className="inline h-7 w-7 text-rose-400" /></h1>
          <p className="mt-1 text-sm text-amber-100/60">Автоматично съпоставяне клиент ↔ имот</p>
        </div>
        <Button onClick={runForAll} className="gold-cta-button"><Sparkles className="h-4 w-4" /> Пресметни всички</Button>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "new", label: "Нови" },
          { key: "contacted", label: "Уведомени" },
          { key: "interested", label: "Заинтересовани" },
          { key: "rejected", label: "Отхвърлени" },
          { key: "all", label: "Всички" },
        ].map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key as any)} className={`rounded-full px-4 py-1.5 text-sm transition ${filter === t.key ? "bg-amber-500 text-amber-950" : "border border-amber-500/30 text-amber-100/70 hover:bg-amber-500/10"}`}>
            {t.label} ({rows.filter((r) => t.key === "all" || r.status === t.key).length})
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {filtered.map((m) => (
          <div key={m.id} className="rounded-2xl border border-amber-500/20 bg-[rgba(255, 255, 255,0.85)] p-5 text-amber-100">
            <div className="grid gap-5 md:grid-cols-[200px_1fr_auto] md:items-center">
              <div className="flex items-center gap-3">
                {m.properties?.cover_image_url ? (
                  <img src={m.properties.cover_image_url} alt="" className="h-20 w-28 rounded-lg object-cover" />
                ) : <div className="h-20 w-28 rounded-lg bg-amber-500/10" />}
                <div className="text-2xl font-display text-amber-200">{m.score}%</div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to="/properties/$propertyId" params={{ propertyId: m.property_id }} target="_blank" className="font-display text-lg hover:underline">{m.properties?.title}</Link>
                  <span className="text-xs text-amber-100/60">{m.properties?.cities?.name} • {m.properties?.price} {m.properties?.currency}</span>
                </div>
                <div className="mt-1 text-sm text-amber-100/80">
                  Клиент: <strong>{m.clients?.full_name}</strong>
                  {m.clients?.phone && <a href={`tel:${m.clients.phone}`} className="ml-3 inline-flex items-center gap-1 text-amber-300"><Phone className="h-3 w-3" />{m.clients.phone}</a>}
                  {m.clients?.email && <a href={`mailto:${m.clients.email}`} className="ml-3 inline-flex items-center gap-1 text-amber-300"><Mail className="h-3 w-3" />{m.clients.email}</a>}
                </div>
                {Array.isArray(m.match_reasons) && m.match_reasons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.match_reasons.map((r: string, i: number) => <span key={i} className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">✓ {r}</span>)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {m.status === "new" && <button onClick={() => update(m.id, "contacted")} className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs hover:bg-amber-500/10">Маркирай уведомен</button>}
                {m.status !== "interested" && <button onClick={() => update(m.id, "interested")} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-200">Заинтересован</button>}
                {m.status !== "rejected" && <button onClick={() => update(m.id, "rejected")} className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300">Отхвърли</button>}
              </div>
            </div>
          </div>
        ))}
        {!filtered.length && <div className="rounded-2xl border border-dashed border-amber-500/30 p-10 text-center text-amber-100/50">Няма съвпадения в тази категория. Натисни „Пресметни всички" за да генерираш.</div>}
      </div>
    </div>
  );
}
