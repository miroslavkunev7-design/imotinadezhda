import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Flame,
  Gauge,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Thermometer,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadScoreBadge } from "@/components/admin/lead-score-badge";
import { ClientDetailsSheet } from "@/components/admin/client-details-sheet";
import {
  listQualifiedLeads,
  qualifyAllClients,
  qualifyAllInquiries,
  qualifyClient,
  qualifyInquiry,
} from "@/lib/qualify.functions";
import { urgencyLabel } from "@/lib/qualify-score";

export const Route = createFileRoute("/admin/qualify")({
  component: QualifyAdmin,
});

type ClientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  client_type: string;
  status: string;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  search_property_type: string | null;
  search_status: string | null;
  lead_score: number | null;
  lead_tier: string | null;
  lead_urgency: string | null;
  qualification_source: string | null;
  qualification_summary: string | null;
  qualification_breakdown: { budget?: number; area?: number; intent?: number; completeness?: number; reasons?: string[] } | null;
  qualified_at: string | null;
  city_name: string | null;
  quarter_name: string | null;
  broker_name: string | null;
  match_count: number;
  origin: string;
};

type InquiryRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  lead_score: number | null;
  lead_tier: string | null;
  lead_urgency: string | null;
  qualification_summary: string | null;
  qualification_source: string | null;
  properties: { title: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  buyer: "Купувач",
  seller: "Продавач",
  tenant: "Наемател",
  landlord: "Наемодател",
};

function QualifyAdmin() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [analytics, setAnalytics] = useState<{
    total: number;
    scored: number;
    avg: number;
    byTier: { hot: number; warm: number; cold: number; none: number };
    byCity: { name: string; total: number; hot: number; avg: number }[];
    byOrigin: { site: number; crm: number };
    byType: Record<string, number>;
    inquiriesScored: number;
    inquiriesTotal: number;
  } | null>(null);
  const [tier, setTier] = useState("");
  const [city, setCity] = useState("");
  const [origin, setOrigin] = useState("");
  const [q, setQ] = useState("");
  const [detailsFor, setDetailsFor] = useState<ClientRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listQualifiedLeads();
      setAiAvailable(data.aiAvailable);
      setClients(data.clients as ClientRow[]);
      setInquiries(data.inquiries as InquiryRow[]);
      setAnalytics(data.analytics);
    } catch (e: any) {
      toast.error(e?.message ?? "Квалификацията не се зареди.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clients.filter((c) => {
      if (tier && c.lead_tier !== tier) return false;
      if (city && (c.city_name ?? "Без град") !== city) return false;
      if (origin && c.origin !== origin) return false;
      if (!needle) return true;
      return [c.full_name, c.phone, c.email, c.city_name, c.quarter_name, c.qualification_summary]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [clients, tier, city, origin, q]);

  const run = async (label: string, fn: () => Promise<{ processed: number; aiUsed: number; heuristic: number; errors: string[] }>) => {
    setBusy(label);
    try {
      const r = await fn();
      toast.success(
        `${r.processed} записа · AI ${r.aiUsed} · евристика ${r.heuristic}` +
          (r.errors.length ? ` · ${r.errors.length} грешки` : ""),
      );
      if (r.errors[0]) toast.error(r.errors[0]);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при оценка");
    } finally {
      setBusy(null);
    }
  };

  const maxCity = Math.max(1, ...(analytics?.byCity.map((c) => c.total) ?? [1]));
  const tierTotal = Math.max(1, analytics?.total ?? 1);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-200">
            AI квалификация · автоматизация 3
          </div>
          <h1 className="mt-2 font-display text-4xl text-amber-100">Квалификация</h1>
          <p className="mt-1 max-w-2xl text-sm text-amber-100/60">
            Оценка 0–100 по бюджет, район, интерес и пълнота на профила.
            {aiAvailable
              ? " AI попълва липсващи полета от бележки и запитвания."
              : " AI ключовете липсват — работи евристичната оценка."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-amber-500/50 text-amber-100 hover:bg-amber-500/15"
            disabled={!!busy}
            onClick={() =>
              run("fast", () => qualifyAllClients({ data: { useAi: false, applyFields: false, limit: 80 } }))
            }
          >
            {busy === "fast" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Оцени всички
          </Button>
          <Button
            className="gold-cta-button"
            disabled={!!busy}
            onClick={() =>
              run("ai", () => qualifyAllClients({ data: { useAi: true, applyFields: true, limit: 80 } }))
            }
          >
            {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Оцени с AI
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-amber-500/20 p-10 text-center text-amber-100/60">Зареждане...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat icon={<Flame className="h-5 w-5" />} label="Горещи" value={String(analytics?.byTier.hot ?? 0)} accent />
            <Stat icon={<Thermometer className="h-5 w-5" />} label="Топли" value={String(analytics?.byTier.warm ?? 0)} />
            <Stat icon={<Gauge className="h-5 w-5" />} label="Студени" value={String(analytics?.byTier.cold ?? 0)} />
            <Stat icon={<Users className="h-5 w-5" />} label="Средна оценка" value={String(analytics?.avg ?? 0)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Разпределение">
              <Bar label="Горещи (70–100)" value={analytics?.byTier.hot ?? 0} total={tierTotal} color="bg-rose-400" />
              <Bar label="Топли (40–69)" value={analytics?.byTier.warm ?? 0} total={tierTotal} color="bg-amber-400" />
              <Bar label="Студени (0–39)" value={analytics?.byTier.cold ?? 0} total={tierTotal} color="bg-sky-400" />
              <Bar label="Без оценка" value={analytics?.byTier.none ?? 0} total={tierTotal} color="bg-amber-100/30" />
              <p className="mt-2 text-[11px] text-amber-100/50">
                {analytics?.scored ?? 0} от {analytics?.total ?? 0} клиента са оценени
              </p>
            </Panel>
            <Panel title="По градове">
              {(analytics?.byCity ?? []).length === 0 ? (
                <p className="text-sm text-amber-100/50">Няма клиенти.</p>
              ) : (
                <ul className="space-y-2">
                  {analytics!.byCity.map((c) => (
                    <li key={c.name}>
                      <div className="mb-0.5 flex justify-between text-xs text-amber-100/80">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {c.name}
                        </span>
                        <span>
                          {c.total} · ср. {c.avg} · {c.hot} горещи
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round((c.total / maxCity) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Източници и тип">
              <Bar label="От сайта (запитване)" value={analytics?.byOrigin.site ?? 0} total={tierTotal} color="bg-emerald-400" />
              <Bar label="Въведени в CRM" value={analytics?.byOrigin.crm ?? 0} total={tierTotal} color="bg-amber-400" />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(analytics?.byType ?? {}).map(([k, v]) => (
                  <span key={k} className="rounded-full border border-amber-500/25 px-2 py-0.5 text-[11px] text-amber-100/80">
                    {TYPE_LABEL[k] ?? k}: {v}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-amber-100/50">
                Запитвания: {analytics?.inquiriesScored ?? 0} оценени / {analytics?.inquiriesTotal ?? 0}
              </p>
            </Panel>
          </div>

          <div className="flex flex-wrap gap-2 rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.06)] p-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Търси име, телефон, град..."
              className="w-full rounded border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-1.5 text-sm text-amber-100 placeholder:text-amber-100/40 sm:w-56"
            />
            <select value={tier} onChange={(e) => setTier(e.target.value)} className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-1.5 text-sm text-amber-100">
              <option value="">Всички температури</option>
              <option value="hot">Горещи</option>
              <option value="warm">Топли</option>
              <option value="cold">Студени</option>
            </select>
            <select value={city} onChange={(e) => setCity(e.target.value)} className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-1.5 text-sm text-amber-100">
              <option value="">Всички градове</option>
              {(analytics?.byCity ?? []).map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-1.5 text-sm text-amber-100">
              <option value="">Всички източници</option>
              <option value="сайт">Сайт</option>
              <option value="CRM">CRM</option>
            </select>
            <span className="ml-auto self-center text-xs text-amber-100/50">
              {filtered.length} / {clients.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(20,4,8,0.35)]">
            <table className="w-full min-w-[860px] text-sm text-amber-100">
              <thead className="bg-[rgba(40,8,16,0.7)] text-left text-amber-100/80">
                <tr>
                  <th className="px-4 py-3">Оценка</th>
                  <th className="px-4 py-3">Клиент</th>
                  <th className="px-4 py-3">Район / интерес</th>
                  <th className="px-4 py-3">Бюджет</th>
                  <th className="px-4 py-3">Източник</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-amber-500/10 hover:bg-amber-500/5">
                    <td className="px-4 py-2">
                      <LeadScoreBadge score={r.lead_score} tier={r.lead_tier} />
                      <div className="mt-1 text-[10px] text-amber-100/45">
                        {r.qualification_source === "ai" ? "AI" : r.qualification_source === "heuristic" ? "евристика" : "—"}
                        {r.lead_urgency ? ` · ${urgencyLabel(r.lead_urgency)}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <button type="button" className="font-semibold hover:text-amber-300" onClick={() => setDetailsFor({
                        ...r,
                        cities: r.city_name ? { name: r.city_name } : null,
                        quarters: r.quarter_name ? { name: r.quarter_name } : null,
                        brokers: r.broker_name ? { full_name: r.broker_name } : null,
                      } as ClientRow)}>
                        {r.full_name}
                      </button>
                      <div className="text-[11px] text-amber-100/50">
                        {TYPE_LABEL[r.client_type] ?? r.client_type}
                        {r.phone ? ` · ${r.phone}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <div>{[r.city_name, r.quarter_name].filter(Boolean).join(", ") || "—"}</div>
                      <div className="text-amber-100/50">
                        {r.search_property_type ?? "—"} {r.search_status ? `· ${r.search_status === "rent" ? "наем" : "покупка"}` : ""}
                        {r.match_count ? ` · ${r.match_count} съвп.` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {r.budget_min || r.budget_max
                        ? `${r.budget_min ?? "?"} – ${r.budget_max ?? "?"} ${r.currency ?? ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">{r.origin}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs text-amber-300 underline disabled:opacity-40"
                        disabled={!!busy}
                        onClick={async () => {
                          setBusy(r.id);
                          try {
                            await qualifyClient({ data: { clientId: r.id, useAi: true, applyFields: true } });
                            toast.success("Оценен");
                            await load();
                          } catch (e: any) {
                            toast.error(e?.message ?? "Грешка");
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        {busy === r.id ? "..." : "Оцени"}
                      </button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-amber-100/40">
                      Няма клиенти за този филтър. Натисни „Оцени всички“.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl text-amber-100">Запитвания</h2>
              <div className="flex gap-2">
                <Link to="/admin/inquiries" className="text-xs text-amber-300 underline">
                  Отвори запитванията
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-500/50 text-amber-100"
                  disabled={!!busy}
                  onClick={() => run("inq", () => qualifyAllInquiries({ data: { useAi: aiAvailable, limit: 80 } }))}
                >
                  {busy === "inq" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Оцени запитванията
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(20,4,8,0.35)]">
              <table className="w-full min-w-[720px] text-sm text-amber-100">
                <thead className="bg-[rgba(40,8,16,0.7)] text-left text-amber-100/80">
                  <tr>
                    <th className="px-4 py-3">Оценка</th>
                    <th className="px-4 py-3">Име</th>
                    <th className="px-4 py-3">Съобщение / имот</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.slice(0, 40).map((i) => (
                    <tr key={i.id} className="border-t border-amber-500/10">
                      <td className="px-4 py-2">
                        <LeadScoreBadge score={i.lead_score} tier={i.lead_tier} compact />
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-semibold">{i.name}</div>
                        <div className="text-[11px] text-amber-100/50">{i.phone || i.email}</div>
                      </td>
                      <td className="px-4 py-2 text-xs text-amber-100/70">
                        <div className="line-clamp-2">{i.qualification_summary || i.message || "—"}</div>
                        {i.properties?.title && <div className="text-amber-200/70">{i.properties.title}</div>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          className="text-xs text-amber-300 underline"
                          disabled={!!busy}
                          onClick={async () => {
                            setBusy(i.id);
                            try {
                              await qualifyInquiry({ data: { inquiryId: i.id, useAi: true } });
                              toast.success("Запитването е оценено");
                              await load();
                            } catch (e: any) {
                              toast.error(e?.message ?? "Грешка");
                            } finally {
                              setBusy(null);
                            }
                          }}
                        >
                          Оцени
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!inquiries.length && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-amber-100/40">
                        Няма запитвания.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <ClientDetailsSheet
        client={detailsFor}
        open={!!detailsFor}
        onClose={() => setDetailsFor(null)}
        onChanged={load}
        onEdit={() => toast.message("Отвори Клиенти за пълна редакция.")}
        onMortgageSend={() => {}}
        onMortgageStages={() => {}}
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-rose-400/30 bg-rose-500/10" : "border-amber-500/20 bg-[rgba(255,255,255,0.05)]"}`}>
      <div className="flex items-center gap-2 text-amber-200/80">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 font-display text-3xl text-amber-50">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,255,255,0.05)] p-4">
      <h2 className="mb-3 font-display text-lg text-amber-100">{title}</h2>
      {children}
    </div>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div className="mb-2">
      <div className="mb-0.5 flex justify-between text-xs text-amber-100/75">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round((value / Math.max(total, 1)) * 100)}%` }} />
      </div>
    </div>
  );
}
