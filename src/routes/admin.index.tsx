import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { DeskCalendar } from "@/components/admin/desk-calendar";
import { looseDb } from "@/lib/supabase-loose-db";

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
  const [kpi, setKpi] = useState({ properties: 0, clients: 0, deals: 0, revenue: 0 });
  const [stages, setStages] = useState<Record<string, number>>({});
  const [latest, setLatest] = useState<
    Array<{
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
    }>
  >([]);
  const [tasks, setTasks] = useState<
    Array<{ id: string; title: string; due_at: string | null; task_type: string | null }>
  >([]);
  const [viewings, setViewings] = useState<
    Array<{
      id: string;
      scheduled_at: string;
      contact_name: string | null;
      location: string | null;
      status: string;
    }>
  >([]);

  const firstName =
    ((user?.user_metadata?.full_name as string) || user?.email || "").split(/[\s@.]/)[0] ||
    "Мирослав";

  useEffect(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    Promise.all([
      looseDb(supabase).from("properties").select("id", { count: "exact", head: true }),
      looseDb(supabase).from("clients").select("id", { count: "exact", head: true }),
      looseDb(supabase).from("deals").select("id", { count: "exact", head: true }).neq("status", "lost"),
      looseDb(supabase).from("deals").select("commission_amount").eq("commission_paid", true),
    ]).then(([p, c, d, com]) => {
      const revenue = (com.data ?? []).reduce(
        (s: number, r: any) => s + Number(r.commission_amount ?? 0),
        0,
      );
      setKpi({ properties: p.count ?? 0, clients: c.count ?? 0, deals: d.count ?? 0, revenue });
    });

    looseDb(supabase)
      .from("deals")
      .select("stage_code")
      .then(({ data }) => {
        const map: Record<string, number> = {};
        (data ?? []).forEach((r: any) => {
          map[r.stage_code] = (map[r.stage_code] ?? 0) + 1;
        });
        setStages(map);
      });

    looseDb(supabase)
      .from("properties")
      .select(
        "id, title, price, currency, is_published, area_sqm, rooms, status, address, cover_image_url",
      )
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => setLatest((data ?? []) as never));

    looseDb(supabase)
      .from("broker_tasks")
      .select("id, title, due_at, task_type")
      .eq("is_completed", false)
      .lte("due_at", endOfDay.toISOString())
      .order("due_at", { ascending: true })
      .limit(4)
      .then(({ data }) => setTasks((data ?? []) as never));

    looseDb(supabase)
      .from("viewings")
      .select("id, scheduled_at, contact_name, location, status")
      .gte("scheduled_at", startOfDay.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(3)
      .then(({ data }) => setViewings((data ?? []) as never));
  }, []);

  const kpiCards = [
    {
      label: "Активни имоти",
      value: kpi.properties.toLocaleString("bg-BG"),
      icon: Building2,
      to: "/admin/properties",
    },
    {
      label: "Клиенти",
      value: kpi.clients.toLocaleString("bg-BG"),
      icon: Users,
      to: "/admin/clients",
    },
    {
      label: "Активни сделки",
      value: kpi.deals.toLocaleString("bg-BG"),
      icon: Handshake,
      to: "/admin/deals",
    },
    {
      label: "Приходи (комисионни)",
      value: money(kpi.revenue),
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
    <div className="flex flex-col gap-9 px-1 py-2">
      <header>
        <h1 className="font-display text-3xl text-amber-50 md:text-4xl">
          Добре дошли, {firstName}!
        </h1>
        <p className="crm-section-sub mt-1 text-sm">Ето какво се случва във вашия бизнес днес.</p>
      </header>

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
              {latest.map((p) => (
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
              ))}
              {!latest.length && (
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
                {tasks.map((t) => {
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
                })}
                {!tasks.length && (
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
                {viewings.map((v) => (
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
                ))}
                {!viewings.length && (
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
  );
}
