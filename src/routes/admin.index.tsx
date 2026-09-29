import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAdminDashboard } from "@/lib/control-center.functions";
import { useAuth } from "@/hooks/use-auth";
import {
  Building2,
  Users,
  Handshake,
  Coins,
  Plus,
  CalendarPlus,
  UserPlus,
  FileText,
  ArrowRight,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { DeskCalendar } from "@/components/admin/desk-calendar";
import sectionBrush from "@/assets/mobile-opa/section-brush-dark.png";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "CRM Табло · Имоти Надежда" },
      {
        name: "description",
        content: "Вътрешно CRM табло на агенция Имоти Надежда — метрики, сделки, задачи и огледи.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STAGES: { code: string; label: string }[] = [
  { code: "new", label: "Запитване" },
  { code: "negotiation", label: "Преговори" },
  { code: "deposit", label: "Капаро" },
  { code: "notary", label: "Нотариус" },
  { code: "closed", label: "Сделка" },
];

function money(v: number | null | undefined, currency = "EUR") {
  if (v == null) return "—";
  return `${Number(v).toLocaleString("bg-BG")} ${currency}`;
}

function timeOf(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
}

function dayOf(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  if (d.toDateString() === today.toDateString()) return "Днес";
  if (d.toDateString() === tomorrow.toDateString()) return "Утре";
  return d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit" });
}

type AdminDashboardSnapshot = {
  kpi: { properties: number; clients: number; deals: number; revenue: number };
  stages: Record<string, number>;
  latest: Array<{
    id: string;
    title: string;
    price: number | null;
    currency: string;
    is_published: boolean;
    area_sqm: number | null;
    rooms: number | null;
    status: string | null;
    address: string | null;
    cover_image_url: string | null;
  }>;
  tasks: Array<{ id: string; title: string; due_at: string | null; task_type: string | null }>;
  viewings: Array<{
    id: string;
    scheduled_at: string;
    contact_name: string | null;
    location: string | null;
    status: string;
  }>;
};

function PaperCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`crm-paper ${className}`}>{children}</div>;
}

function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-3">
      <h2 className="crm-section-title font-display text-xl md:text-2xl">{title}</h2>
      {action && (
        <Link
          to={action.to}
          className="crm-section-link inline-flex items-center gap-1 text-[11.5px] font-semibold"
        >
          {action.label} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<AdminDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const firstName =
    ((user?.user_metadata?.full_name as string) || user?.email || "").split(/[\s@.]/)[0] ||
    "колега";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getAdminDashboard()
      .then((data) => {
        if (!cancelled) setDashboard(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "CRM данните не могат да бъдат заредени.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, reloadToken]);

  const kpi = dashboard?.kpi;
  const stages = dashboard?.stages ?? {};
  const latest = dashboard?.latest ?? [];
  const tasks = dashboard?.tasks ?? [];
  const viewings = dashboard?.viewings ?? [];

  const kpiCards = [
    {
      label: "Активни имоти",
      value: dashboard ? dashboard.kpi.properties.toLocaleString("bg-BG") : loading ? "…" : "—",
      icon: Building2,
      to: "/admin/properties",
    },
    {
      label: "Клиенти",
      value: dashboard ? dashboard.kpi.clients.toLocaleString("bg-BG") : loading ? "…" : "—",
      icon: Users,
      to: "/admin/clients",
    },
    {
      label: "Активни сделки",
      value: dashboard ? dashboard.kpi.deals.toLocaleString("bg-BG") : loading ? "…" : "—",
      icon: Handshake,
      to: "/admin/deals",
    },
    {
      label: "Приходи (комисионни)",
      value: dashboard ? money(dashboard.kpi.revenue) : loading ? "…" : "—",
      icon: Coins,
      to: "/admin/commissions",
    },
  ];

  const quick = [
    { label: "Нов имот", icon: Building2, to: "/admin/properties" },
    { label: "Нов клиент", icon: UserPlus, to: "/admin/clients" },
    { label: "Нова сделка", icon: Handshake, to: "/admin/deals" },
    { label: "Насрочи оглед", icon: CalendarPlus, to: "/admin/viewings" },
    { label: "Нов договор", icon: FileText, to: "/admin/contracts" },
  ];

  const prio = (due?: string | null) => {
    if (!due) return { label: "Ниско", bg: "#3f7d4a" };
    const diff = new Date(due).getTime() - Date.now();
    if (diff <= 2 * 3600_000) return { label: "Важно", bg: "#a41f33" };
    if (diff <= 6 * 3600_000) return { label: "Средно", bg: "#d09a2a" };
    return { label: "Ниско", bg: "#3f7d4a" };
  };

  return (
    <>
    <div className="flex flex-col gap-5 pb-4 md:hidden">
      <header>
        <h1 className="font-display text-3xl text-amber-50">Добре дошли, {firstName}!</h1>
        <p className="mt-1 text-sm text-amber-100/75">Реалните числа за днес.</p>
      </header>
      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            disabled={loading}
            className="mt-2 inline-flex items-center gap-2 font-semibold underline disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" /> Опитай отново
          </button>
        </div>
      ) : null}
      <section className="grid grid-cols-2 gap-3">
        {kpiCards.map((card) => (
          <Link key={card.label} to={card.to} className="rounded-2xl border border-amber-500/25 bg-[rgba(255,251,243,0.96)] p-3 text-primary shadow-lg">
            <card.icon className="h-5 w-5" strokeWidth={1.6} />
            <div className="mt-2 font-display text-2xl font-bold tabular-nums leading-none">{card.value}</div>
            <div className="mt-1 text-[11px] font-semibold leading-tight">{card.label}</div>
          </Link>
        ))}
      </section>
      <section>
        <div className="relative mb-3 overflow-hidden rounded-xl px-4 py-2 text-white">
          <img src={sectionBrush} alt="" aria-hidden className="absolute inset-0 h-full w-full object-fill" />
          <h2 className="relative font-display text-xl">Бързи действия</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {quick.map((item) => (
            <Link key={item.label} to={item.to} className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-[rgba(255,251,243,0.96)] px-3 py-3 text-sm font-semibold text-primary">
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl text-amber-50">Задачи за днес</h2>
          <Link to="/admin/tasks" className="text-xs font-semibold text-amber-200">Всички</Link>
        </div>
        <ul className="divide-y divide-primary/10 overflow-hidden rounded-2xl bg-[rgba(255,251,243,0.96)] text-primary">
          {loading && !dashboard ? <li className="px-4 py-4 text-sm">Зареждане на задачите…</li> : null}
          {tasks.map((task) => (
            <li key={task.id}>
              <Link to="/admin/tasks" className="flex items-center gap-3 px-4 py-3">
                <span className="w-12 shrink-0 text-xs font-semibold tabular-nums">{timeOf(task.due_at)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                <span className="rounded px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: prio(task.due_at).bg }}>
                  {prio(task.due_at).label}
                </span>
              </Link>
            </li>
          ))}
          {!loading && !tasks.length ? <li className="px-4 py-4 text-center text-sm">Няма задачи за днес.</li> : null}
        </ul>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl text-amber-50">Предстоящи огледи</h2>
          <Link to="/admin/viewings" className="text-xs font-semibold text-amber-200">Всички</Link>
        </div>
        <ul className="space-y-2">
          {loading && !dashboard ? <li className="rounded-2xl bg-[rgba(255,251,243,0.96)] px-4 py-4 text-sm text-primary">Зареждане на огледите…</li> : null}
          {viewings.map((viewing) => (
            <li key={viewing.id}>
              <Link to="/admin/viewings" className="block rounded-2xl bg-[rgba(255,251,243,0.96)] px-4 py-3 text-primary">
                <div className="text-[11px] font-semibold opacity-70">{dayOf(viewing.scheduled_at)}, {timeOf(viewing.scheduled_at)}</div>
                <div className="truncate text-sm font-semibold">{viewing.contact_name ?? "Оглед"}</div>
                <div className="truncate text-xs opacity-70">{viewing.location ?? viewing.status}</div>
              </Link>
            </li>
          ))}
          {!loading && !viewings.length ? <li className="rounded-2xl bg-[rgba(255,251,243,0.96)] px-4 py-4 text-center text-sm text-primary">Няма предстоящи огледи.</li> : null}
        </ul>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl text-amber-50">Календар</h2>
          <Link to="/admin/calendar" className="text-xs font-semibold text-amber-200">Отвори</Link>
        </div>
        <DeskCalendar />
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl text-amber-50">Последни имоти</h2>
          <Link to="/admin/properties" className="text-xs font-semibold text-amber-200">Всички</Link>
        </div>
        <div className="space-y-2">
          {latest.map((property) => (
            <Link key={property.id} to="/admin/properties" className="flex gap-3 rounded-2xl bg-[rgba(255,251,243,0.96)] p-3 text-primary">
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-[#e7ded0]">
                {property.cover_image_url ? <img src={property.cover_image_url} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{property.title}</div>
                <div className="truncate text-xs opacity-70">{property.address || "—"}</div>
                <div className="font-display text-lg font-bold">{money(property.price, property.currency)}</div>
              </div>
            </Link>
          ))}
          {!loading && !latest.length ? <p className="rounded-2xl bg-[rgba(255,251,243,0.96)] px-4 py-4 text-center text-sm text-primary">Няма имоти.</p> : null}
        </div>
      </section>
    </div>
    <div className="hidden flex-col gap-9 px-1 py-2 md:flex">
      <header>
        <h1 className="font-display text-3xl text-amber-50 md:text-4xl">
          Добре дошли, {firstName}!
        </h1>
        <p className="crm-section-sub mt-1 text-sm">Ето какво се случва във вашия бизнес днес.</p>
      </header>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 font-semibold underline disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" /> Опитай отново
          </button>
        </div>
      ) : null}

      {/* KPI — бели brush листа */}
      <div className="grid gap-x-8 gap-y-9 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((c) => (
          <Link key={c.label} to={c.to} className="crm-paper flex items-center gap-4 px-5 py-5">
            <c.icon className="h-10 w-10 flex-none opacity-80" strokeWidth={1.1} />
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] leading-tight">
                {c.label}
              </div>
              <div className="mt-1 font-display text-3xl font-bold tabular-nums leading-none">
                {c.value}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-x-10 gap-y-10 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        {/* Лява колона */}
        <div className="flex flex-col gap-10">
          <section>
            <SectionTitle title="Бързи действия" />
            <div className="grid grid-cols-2 gap-x-7 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {quick.map((q) => (
                <Link
                  key={q.label}
                  to={q.to}
                  className="crm-paper flex flex-col items-center gap-3 px-3 py-6 text-center"
                >
                  <span className="relative">
                    <q.icon className="h-11 w-11 opacity-85" strokeWidth={1.05} />
                    <Plus className="absolute -bottom-1 -right-1 h-4 w-4" strokeWidth={2.4} />
                  </span>
                  <span className="text-[12.5px] font-semibold leading-tight">{q.label}</span>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle
              title="Етапи на сделки"
              action={{ to: "/admin/deals", label: "Всички сделки" }}
            />
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {STAGES.map((s, i) => (
                <div key={s.code} className="flex items-center gap-3">
                  <div className="crm-paper flex-1 px-4 py-5 text-center">
                    <div className="text-[12px] font-semibold">{s.label}</div>
                    <div className="mt-2 font-display text-3xl font-bold tabular-nums leading-none">
                      {stages[s.code] ?? 0}
                    </div>
                  </div>
                  {i < STAGES.length - 1 && (
                    <ChevronRight className="hidden h-5 w-5 flex-none text-amber-100/60 lg:block" />
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle
              title="Последни имоти"
              action={{ to: "/admin/properties", label: "Всички имоти" }}
            />
            <div className="grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
              {loading && !dashboard ? (
                <PaperCard className="px-5 py-7 text-center text-[13px] sm:col-span-2 lg:col-span-4">
                  Зареждане на имотите…
                </PaperCard>
              ) : (
                latest.map((p) => (
                  <Link key={p.id} to="/admin/properties" className="crm-paper flex flex-col p-3">
                  <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-[4px] bg-[#e7ded0]">
                    {p.cover_image_url ? (
                      <img
                        src={p.cover_image_url}
                        alt={p.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    <span className="crm-badge absolute left-2 top-2 rounded-full bg-[#3c141a] px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide">
                      {p.status === "for_rent" || p.status === "rent" ? "Под наем" : "Продажба"}
                    </span>
                  </div>
                  <div className="truncate text-[13px] font-semibold">{p.title}</div>
                  <div className="crm-ink-soft truncate text-[11.5px]">{p.address || "—"}</div>
                  <div className="mt-1.5 font-display text-lg font-bold">
                    {money(p.price, p.currency)}
                  </div>
                  <div className="crm-ink-soft mt-1 flex items-center gap-3 text-[11px]">
                    {p.area_sqm ? <span>{p.area_sqm} m²</span> : null}
                    {p.rooms ? <span>{p.rooms} стаи</span> : null}
                  </div>
                </Link>
                ))
              )}
              {!loading && !latest.length && (
                <PaperCard className="px-5 py-7 text-center text-[13px] sm:col-span-2 lg:col-span-4">
                  Няма имоти.
                </PaperCard>
              )}
            </div>
          </section>
        </div>

        {/* Дясна колона */}
        <div className="flex flex-col gap-10">
          <section>
            <SectionTitle title="Задачи за днес" />
            <PaperCard className="px-5 py-4">
              <ul className="divide-y divide-[#3c141a]/12">
                {loading && !dashboard ? (
                  <li className="py-4 text-center text-[12.5px]">Зареждане на задачите…</li>
                ) : (
                  tasks.map((t) => {
                  const p = prio(t.due_at);
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-[42px] flex-none text-[11.5px] font-semibold tabular-nums">
                        {timeOf(t.due_at)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px]">{t.title}</span>
                      <span
                        className="crm-badge flex-none rounded-[4px] px-2 py-0.5 text-[9.5px] font-bold uppercase"
                        style={{ background: p.bg }}
                      >
                        {p.label}
                      </span>
                    </li>
                  );
                  })
                )}
                {!loading && !tasks.length && (
                  <li className="py-4 text-center text-[12.5px]">Няма задачи за днес.</li>
                )}
              </ul>
              <Link
                to="/admin/tasks"
                className="mt-3 flex items-center justify-center gap-2 text-[12px] font-semibold"
              >
                Виж всички задачи <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </PaperCard>
          </section>

          <section>
            <SectionTitle title="Предстоящи огледи" />
            <PaperCard className="px-4 py-4">
              <ul className="flex flex-col gap-3">
                {loading && !dashboard ? (
                  <li className="py-3 text-center text-[12.5px]">Зареждане на огледите…</li>
                ) : (
                  viewings.map((v) => (
                  <li key={v.id} className="flex items-center gap-3">
                    <div className="h-12 w-16 flex-none overflow-hidden rounded-[4px] bg-[#e7ded0]" />
                    <div className="min-w-0 flex-1">
                      <div className="crm-ink-soft text-[10.5px] font-semibold">
                        {dayOf(v.scheduled_at)}, {timeOf(v.scheduled_at)}
                      </div>
                      <div className="truncate text-[12.5px] font-semibold">
                        {v.contact_name ?? "Оглед"}
                      </div>
                      <div className="crm-ink-soft truncate text-[11px]">
                        {v.location ?? v.status}
                      </div>
                    </div>
                  </li>
                  ))
                )}
                {!loading && !viewings.length && (
                  <li className="py-3 text-center text-[12.5px]">Няма предстоящи огледи.</li>
                )}
              </ul>
              <Link
                to="/admin/viewings"
                className="mt-3 flex items-center justify-center gap-2 text-[12px] font-semibold"
              >
                Виж всички огледи <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </PaperCard>
          </section>

          <section>
            <SectionTitle title="Календар" action={{ to: "/admin/calendar", label: "Отвори" }} />
            <DeskCalendar />
          </section>
        </div>
      </div>
    </div>
    </>
  );
}
