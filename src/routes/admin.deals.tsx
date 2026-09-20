import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Brain,
  Coins,
  Gavel,
  KanbanSquare,
  ListChecks,
  Plus,
  RefreshCw,
  Settings2,
  Zap,
} from "lucide-react";
import {
  addDealTaskFn,
  analyzeDealFn,
  createDealFn,
  getDealsAnalytics,
  getDealsConfig,
  listDealEvents,
  listDealPickers,
  listDealStages,
  listDealTasks,
  listDeals,
  moveDealStage,
  resumeDealsJob,
  runDealsSweepNow,
  saveDealsConfig,
  setDealTaskStatus,
  updateDealFn,
} from "@/lib/deals.functions";

export const Route = createFileRoute("/admin/deals")({ component: DealsAdmin });

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");
const d = (v?: string | null) => (v ? new Date(v).toLocaleDateString("bg-BG") : "—");
const money = (v?: number | null, c?: string | null) =>
  v == null
    ? "—"
    : `${Number(v).toLocaleString("bg-BG", { maximumFractionDigits: 0 })} ${c ?? "EUR"}`;

const RISK_LABEL: Record<string, string> = { low: "нисък", medium: "среден", high: "висок" };
const RISK_CLASS: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-900",
  medium: "bg-amber-100 text-amber-900",
  high: "bg-rose-100 text-rose-900",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Активна",
  won: "Приключена",
  lost: "Отпаднала",
  paused: "Пауза",
};

function DealsAdmin() {
  const [tab, setTab] = useState<"pipeline" | "list" | "tasks" | "analytics" | "log">("pipeline");
  const [stages, setStages] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [pickers, setPickers] = useState<any>({ clients: [], properties: [], brokers: [] });
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, dl, t, e, a, c, p] = await Promise.all([
        listDealStages(),
        listDeals({ data: {} }),
        listDealTasks({ data: {} }),
        listDealEvents({ data: {} }),
        getDealsAnalytics(),
        getDealsConfig(),
        listDealPickers(),
      ]);
      setStages(s as any[]);
      setDeals(dl as any[]);
      setTasks(t as any[]);
      setEvents(e as any[]);
      setAnalytics(a);
      setCfg((c as any).settings);
      setJob((c as any).job);
      setPickers(p);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при зареждане");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<any>, ok: (r: any) => string) => {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(ok(r));
      await load();
      return r;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (p: Record<string, unknown>) => {
    try {
      setCfg(await saveDealsConfig({ data: p as never }));
      toast.success("Настройките са запазени");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при запис");
    }
  };

  const openDeal = useMemo(() => deals.find((x) => x.id === openId) ?? null, [deals, openId]);
  const openTasks = useMemo(() => tasks.filter((t) => t.deal_id === openId), [tasks, openId]);
  const openEvents = useMemo(() => events.filter((e) => e.deal_id === openId), [events, openId]);
  const activeStages = stages.filter((s) => s.is_active !== false);

  const move = async (id: string, stageCode: string) => {
    const r = await act(
      () => moveDealStage({ data: { id, stageCode } }),
      (x) => (x.ok ? "Етапът е сменен" : "Липсват документи"),
    );
    if (r && r.ok === false) {
      const names = (r.missing ?? []).map((m: any) => m.name).join(", ");
      if (confirm(`Липсват документи: ${names}\n\nДа продължим ли въпреки това?`)) {
        await act(
          () => moveDealStage({ data: { id, stageCode, force: true } }),
          () => "Етапът е сменен принудително",
        );
      }
    }
  };

  const submitNew = async (form: HTMLFormElement) => {
    const f = new FormData(form);
    const num = (k: string) => {
      const v = String(f.get(k) ?? "").trim();
      return v ? Number(v) : null;
    };
    const str = (k: string) => {
      const v = String(f.get(k) ?? "").trim();
      return v || null;
    };
    await act(
      () =>
        createDealFn({
          data: {
            title: str("title"),
            dealType: (str("dealType") ?? "sale") as "sale" | "rent",
            clientId: str("clientId"),
            propertyId: str("propertyId"),
            brokerId: str("brokerId"),
            price: num("price"),
            agreedPrice: num("agreedPrice"),
            currency: str("currency") ?? "EUR",
            commissionPercent: num("commissionPercent"),
            mortgageNeeded: f.get("mortgageNeeded") === "on",
            expectedCloseAt: str("expectedCloseAt"),
            notes: str("notes"),
            stageCode: str("stageCode"),
          } as never,
        }),
      (r) => `Създадена сделка ${r.deal_number ?? ""}`,
    );
    setShowNew(false);
  };

  const totals = analytics?.totals ?? {};

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">Сделки до нотариус</h1>
          <p className="mt-1 text-sm text-primary/70">
            №10 — пайплайн, документи, задачи, рискове и комисиони
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#7a0d22] px-4 py-2 text-sm font-semibold text-amber-100"
          >
            <Plus className="h-4 w-4" /> Нова сделка
          </button>
          <button
            onClick={() =>
              void act(
                () => runDealsSweepNow({ data: {} }),
                (r) =>
                  r.ran
                    ? `Анализирани ${r.analyzed} · застояли ${r.stalled} · нотариус след малко ${r.notary_soon}`
                    : `Не се изпълни: ${r.reason}`,
              )
            }
            disabled={busy}
            className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
          >
            <Zap className="h-4 w-4" /> Провери сделките
          </button>
          <button
            onClick={() => setShowCfg((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary"
          >
            <Settings2 className="h-4 w-4" /> Настройки
          </button>
          <button
            onClick={() => void load()}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Обнови
          </button>
        </div>
      </header>

      {job?.paused && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-600/30 bg-rose-50 p-4">
          <div className="text-sm text-rose-900">
            <strong>Автоматизацията е на пауза.</strong> {job.paused_reason ?? "—"} (
            {dt(job.paused_at)})
          </div>
          <button
            onClick={() =>
              void act(
                () => resumeDealsJob(),
                () => "Автоматизацията е възобновена",
              )
            }
            disabled={busy}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
          >
            Възобнови
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Активни сделки",
            value: totals.active ?? 0,
            sub: `${totals.won ?? 0} приключени · ${totals.lost ?? 0} отпаднали`,
            icon: KanbanSquare,
          },
          {
            label: "Стойност в пайплайна",
            value: money(totals.pipeline_value, "EUR"),
            sub: `Претеглено: ${money(totals.weighted_value, "EUR")}`,
            icon: BarChart3,
          },
          {
            label: "Очаквана комисиона",
            value: money(totals.commission_expected, "EUR"),
            sub: `Приключена: ${money(totals.commission_won, "EUR")}`,
            icon: Coins,
          },
          {
            label: "Предстоящи нотариуси",
            value: totals.notary_upcoming ?? 0,
            sub: `${totals.overdue_tasks ?? 0} просрочени задачи · успеваемост ${totals.win_rate ?? 0}%`,
            icon: Gavel,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary/60">
                {k.label}
              </span>
              <k.icon className="h-4 w-4 text-primary/50" />
            </div>
            <div className="mt-2 font-display text-3xl text-primary">{k.value}</div>
            <div className="mt-1 text-xs text-primary/60">{k.sub}</div>
          </div>
        ))}
      </div>

      {showCfg && cfg && (
        <section className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5">
          <h2 className="font-display text-2xl text-primary">Правила за сделките</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              {[
                { key: "enabled", label: "Автоматизацията е активна" },
                { key: "ai_enabled", label: "AI анализ на риска и следваща стъпка" },
                { key: "auto_tasks", label: "Авто-задачи при смяна на етап" },
              ].map((t) => (
                <label
                  key={t.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-primary"
                >
                  {t.label}
                  <input
                    type="checkbox"
                    checked={Boolean(cfg[t.key])}
                    onChange={(e) => void patch({ [t.key]: e.target.checked })}
                    className="h-4 w-4 accent-[#8b1a2b]"
                  />
                </label>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { key: "batch_size", label: "Сделки на цикъл", min: 1, max: 50 },
                {
                  key: "default_commission",
                  label: "Комисиона по подразбиране (%)",
                  min: 0,
                  max: 20,
                },
                { key: "stall_days", label: "Дни до сигнал „застояла“", min: 1, max: 90 },
                {
                  key: "notary_reminder_days",
                  label: "Дни преди нотариус за напомняне",
                  min: 1,
                  max: 30,
                },
              ].map((n) => (
                <label
                  key={n.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-primary"
                >
                  {n.label}
                  <input
                    type="number"
                    min={n.min}
                    max={n.max}
                    defaultValue={Number(cfg[n.key] ?? 0)}
                    onBlur={(e) => void patch({ [n.key]: Number(e.target.value) })}
                    className="w-28 rounded-lg border border-primary/25 bg-white px-2 py-1 text-right text-primary"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { id: "pipeline", label: "Пайплайн" },
          { id: "list", label: "Списък" },
          { id: "tasks", label: "Задачи" },
          { id: "analytics", label: "Анализи" },
          { id: "log", label: "История" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === t.id ? "bg-primary text-amber-100" : "border border-primary/25 text-primary"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pipeline" && (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {activeStages.map((s) => {
            const col = deals.filter(
              (x) => x.stage_code === s.code && (s.is_final ? true : x.status === "active"),
            );
            const value = col.reduce((a, x) => a + Number(x.agreed_price ?? x.price ?? 0), 0);
            return (
              <div
                key={s.code}
                className="min-w-[260px] flex-1 rounded-2xl border border-primary/15 bg-[#fffaf3] p-3"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-lg text-primary">{s.name}</h3>
                  <span className="text-xs text-primary/60">{col.length}</span>
                </div>
                <div className="mt-1 text-xs text-primary/60">
                  {money(value, "EUR")} · {s.probability}% · норма {s.target_days} дни
                </div>
                <div className="mt-3 space-y-2">
                  {col.map((x) => (
                    <button
                      key={x.id}
                      onClick={() => setOpenId(x.id)}
                      className="w-full rounded-xl border border-primary/15 bg-white p-3 text-left shadow-sm hover:border-primary/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-primary">{x.title}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RISK_CLASS[x.risk_level] ?? RISK_CLASS["low"]}`}
                        >
                          {RISK_LABEL[x.risk_level] ?? "нисък"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-primary/70">
                        {x.deal_number ?? "—"} · {money(x.agreed_price ?? x.price, x.currency)}
                      </div>
                      {x.notary_at && (
                        <div className="mt-1 text-xs text-primary/70">
                          Нотариус: {dt(x.notary_at)}
                        </div>
                      )}
                      {x.ai_next_step && (
                        <div className="mt-1 line-clamp-2 text-xs text-primary/60">
                          → {x.ai_next_step}
                        </div>
                      )}
                    </button>
                  ))}
                  {!col.length && (
                    <div className="rounded-xl border border-dashed border-primary/20 p-3 text-xs text-primary/50">
                      Няма сделки
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "list" && (
        <div className="overflow-x-auto rounded-2xl border border-primary/15 bg-[#fffaf3]">
          <table className="w-full text-sm text-primary">
            <thead className="bg-primary/10 text-left text-xs uppercase tracking-wide">
              <tr>
                {[
                  "№",
                  "Сделка",
                  "Клиент",
                  "Етап",
                  "Статус",
                  "Цена",
                  "Комисиона",
                  "Нотариус",
                  "Риск",
                ].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((x) => (
                <tr
                  key={x.id}
                  onClick={() => setOpenId(x.id)}
                  className="cursor-pointer border-t border-primary/10 hover:bg-white"
                >
                  <td className="px-3 py-2 font-mono text-xs">{x.deal_number ?? "—"}</td>
                  <td className="px-3 py-2 font-semibold">{x.title}</td>
                  <td className="px-3 py-2">{x.clients?.full_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    {stages.find((s) => s.code === x.stage_code)?.name ?? x.stage_code}
                  </td>
                  <td className="px-3 py-2">{STATUS_LABEL[x.status] ?? x.status}</td>
                  <td className="px-3 py-2">{money(x.agreed_price ?? x.price, x.currency)}</td>
                  <td className="px-3 py-2">{money(x.commission_amount, x.currency)}</td>
                  <td className="px-3 py-2">{x.notary_at ? dt(x.notary_at) : "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RISK_CLASS[x.risk_level] ?? RISK_CLASS["low"]}`}
                    >
                      {RISK_LABEL[x.risk_level] ?? "нисък"}
                    </span>
                  </td>
                </tr>
              ))}
              {!deals.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-primary/60">
                    Няма сделки
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "tasks" && (
        <div className="overflow-x-auto rounded-2xl border border-primary/15 bg-[#fffaf3]">
          <table className="w-full text-sm text-primary">
            <thead className="bg-primary/10 text-left text-xs uppercase tracking-wide">
              <tr>
                {["Задача", "Сделка", "Етап", "Срок", "Статус", ""].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const late =
                  t.status === "open" && t.due_at && new Date(t.due_at).getTime() < Date.now();
                return (
                  <tr key={t.id} className="border-t border-primary/10">
                    <td className="px-3 py-2 font-semibold">{t.title}</td>
                    <td className="px-3 py-2">{t.deals?.title ?? "—"}</td>
                    <td className="px-3 py-2">
                      {stages.find((s) => s.code === t.stage_code)?.name ?? t.stage_code ?? "—"}
                    </td>
                    <td className={`px-3 py-2 ${late ? "font-semibold text-rose-700" : ""}`}>
                      {dt(t.due_at)}
                    </td>
                    <td className="px-3 py-2">
                      {t.status === "done"
                        ? "Изпълнена"
                        : t.status === "skipped"
                          ? "Пропусната"
                          : "Отворена"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {t.status === "open" && (
                        <button
                          onClick={() =>
                            void act(
                              () => setDealTaskStatus({ data: { id: t.id, status: "done" } }),
                              () => "Задачата е изпълнена",
                            )
                          }
                          className="rounded-lg border border-primary/30 px-3 py-1 text-xs font-semibold text-primary"
                        >
                          Готово
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!tasks.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-primary/60">
                    Няма задачи
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "analytics" && analytics && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5">
            <h2 className="font-display text-2xl text-primary">Фуния по етапи</h2>
            <div className="mt-3 space-y-2">
              {activeStages.map((s) => {
                const b = analytics.by_stage?.[s.code] ?? { count: 0, value: 0 };
                const max = Math.max(
                  1,
                  ...Object.values(analytics.by_stage ?? {}).map((x: any) => x.count),
                );
                return (
                  <div key={s.code}>
                    <div className="flex justify-between text-xs text-primary/70">
                      <span>{s.name}</span>
                      <span>
                        {b.count} · {money(b.value, "EUR")} · средно{" "}
                        {analytics.avg_stage_days?.[s.code] ?? 0} дни
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-primary/10">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${(b.count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5">
            <h2 className="font-display text-2xl text-primary">Показатели</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-primary">
              {[
                ["Общо сделки", totals.all ?? 0],
                ["Успеваемост", `${totals.win_rate ?? 0}%`],
                ["Среден цикъл", `${totals.avg_cycle_days ?? 0} дни`],
                ["Отворени задачи", totals.open_tasks ?? 0],
                ["Просрочени задачи", totals.overdue_tasks ?? 0],
                ["Изплатена комисиона", money(totals.commission_paid, "EUR")],
                ["Висок риск", analytics.risk?.high ?? 0],
                ["Среден риск", analytics.risk?.medium ?? 0],
              ].map(([k, v]) => (
                <div
                  key={String(k)}
                  className="rounded-xl border border-primary/15 bg-white px-3 py-2"
                >
                  <dt className="text-xs text-primary/60">{k}</dt>
                  <dd className="font-display text-xl text-primary">{v as any}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}

      {tab === "log" && (
        <div className="space-y-2">
          {events.map((e) => (
            <div
              key={e.id}
              className="rounded-xl border border-primary/15 bg-[#fffaf3] p-3 text-sm text-primary"
            >
              <div className="flex flex-wrap justify-between gap-2 text-xs text-primary/60">
                <span>
                  {e.deals?.deal_number ?? e.deals?.title ?? "—"} · {e.action}
                  {e.status === "warn" ? " · внимание" : ""}
                </span>
                <span>
                  {dt(e.created_at)} · {e.actor}
                </span>
              </div>
              <div className="mt-1">{e.message}</div>
            </div>
          ))}
          {!events.length && (
            <div className="rounded-xl border border-dashed border-primary/20 p-6 text-center text-primary/60">
              Няма събития
            </div>
          )}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitNew(e.currentTarget);
            }}
            className="mt-10 w-full max-w-2xl rounded-2xl border border-primary/20 bg-[#fffaf3] p-5"
            data-crm-themed
          >
            <h2 className="font-display text-2xl text-primary">Нова сделка</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-primary">
                Заглавие
                <input
                  name="title"
                  className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                  placeholder="Автоматично от имот и клиент"
                />
              </label>
              <label className="text-sm text-primary">
                Тип
                <select
                  name="dealType"
                  className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                >
                  <option value="sale">Продажба</option>
                  <option value="rent">Наем</option>
                </select>
              </label>
              <label className="text-sm text-primary">
                Клиент
                <select
                  name="clientId"
                  className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                >
                  <option value="">—</option>
                  {pickers.clients.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name ?? c.phone ?? c.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-primary">
                Имот
                <select
                  name="propertyId"
                  className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                >
                  <option value="">—</option>
                  {pickers.properties.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.title ?? p.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-primary">
                Брокер
                <select
                  name="brokerId"
                  className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                >
                  <option value="">—</option>
                  {pickers.brokers.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.full_name ?? b.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-primary">
                Начален етап
                <select
                  name="stageCode"
                  className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                >
                  {activeStages
                    .filter((s) => !s.is_final)
                    .map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm text-primary">
                Цена по обява
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm text-primary">
                Договорена цена
                <input
                  name="agreedPrice"
                  type="number"
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm text-primary">
                Валута
                <input
                  name="currency"
                  defaultValue="EUR"
                  className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm text-primary">
                Комисиона (%)
                <input
                  name="commissionPercent"
                  type="number"
                  step="0.1"
                  defaultValue={cfg?.default_commission ?? 3}
                  className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm text-primary">
                Очаквано приключване
                <input
                  name="expectedCloseAt"
                  type="date"
                  className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 self-end text-sm text-primary">
                <input name="mortgageNeeded" type="checkbox" className="h-4 w-4 accent-[#8b1a2b]" />{" "}
                Нужна е ипотека
              </label>
              <label className="text-sm text-primary md:col-span-2">
                Бележки
                <textarea
                  name="notes"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary"
              >
                Отказ
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
              >
                Създай
              </button>
            </div>
          </form>
        </div>
      )}

      {openDeal && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setOpenId(null)}
        >
          <aside
            className="h-full w-full max-w-xl overflow-y-auto border-l border-primary/20 bg-[#fffaf3] p-5"
            data-crm-themed
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-primary">{openDeal.title}</h2>
                <p className="text-xs text-primary/60">
                  {openDeal.deal_number ?? "—"} · {STATUS_LABEL[openDeal.status] ?? openDeal.status}{" "}
                  · създадена {d(openDeal.created_at)}
                </p>
              </div>
              <button
                onClick={() => setOpenId(null)}
                className="rounded-lg border border-primary/30 px-3 py-1 text-sm text-primary"
              >
                Затвори
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-primary/15 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-primary/60">Етап</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RISK_CLASS[openDeal.risk_level] ?? RISK_CLASS["low"]}`}
                >
                  риск: {RISK_LABEL[openDeal.risk_level] ?? "нисък"}
                </span>
              </div>
              <select
                value={openDeal.stage_code}
                onChange={(e) => void move(openDeal.id, e.target.value)}
                className="mt-2 w-full rounded-lg border border-primary/25 bg-white px-3 py-2 text-sm text-primary"
              >
                {activeStages.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} · {s.probability}%
                  </option>
                ))}
              </select>
              {openDeal.ai_summary && (
                <p className="mt-2 text-sm text-primary/80">{openDeal.ai_summary}</p>
              )}
              {openDeal.ai_next_step && (
                <p className="mt-1 text-sm font-semibold text-primary">
                  Следваща стъпка: {openDeal.ai_next_step}
                </p>
              )}
              <button
                onClick={() =>
                  void act(
                    () => analyzeDealFn({ data: { id: openDeal.id } }),
                    (r) => `AI анализ: риск ${RISK_LABEL[r.risk] ?? r.risk}`,
                  )
                }
                disabled={busy}
                className="mt-3 flex items-center gap-2 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
              >
                <Brain className="h-4 w-4" /> AI анализ на сделката
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                {
                  k: "agreedPrice",
                  label: "Договорена цена",
                  type: "number",
                  value: openDeal.agreed_price,
                },
                {
                  k: "depositAmount",
                  label: "Депозит",
                  type: "number",
                  value: openDeal.deposit_amount,
                },
                {
                  k: "depositPaidAt",
                  label: "Депозит платен на",
                  type: "date",
                  value: openDeal.deposit_paid_at,
                },
                {
                  k: "commissionPercent",
                  label: "Комисиона (%)",
                  type: "number",
                  value: openDeal.commission_percent,
                },
                {
                  k: "preliminaryContractAt",
                  label: "Предварителен договор",
                  type: "date",
                  value: openDeal.preliminary_contract_at,
                },
                { k: "mortgageBank", label: "Банка", type: "text", value: openDeal.mortgage_bank },
                {
                  k: "mortgageApprovedAt",
                  label: "Одобрена ипотека",
                  type: "date",
                  value: openDeal.mortgage_approved_at,
                },
                { k: "notaryName", label: "Нотариус", type: "text", value: openDeal.notary_name },
                {
                  k: "notaryOffice",
                  label: "Нотариална кантора",
                  type: "text",
                  value: openDeal.notary_office,
                },
                {
                  k: "notaryAt",
                  label: "Час при нотариус",
                  type: "datetime-local",
                  value: openDeal.notary_at ? String(openDeal.notary_at).slice(0, 16) : "",
                },
                {
                  k: "deedNumber",
                  label: "Нотариален акт №",
                  type: "text",
                  value: openDeal.deed_number,
                },
                {
                  k: "expectedCloseAt",
                  label: "Очаквано приключване",
                  type: "date",
                  value: openDeal.expected_close_at,
                },
              ].map((f) => (
                <label key={f.k} className="text-sm text-primary">
                  {f.label}
                  <input
                    type={f.type}
                    defaultValue={(f.value as any) ?? ""}
                    onBlur={(e) => {
                      const raw = e.target.value;
                      const v =
                        raw === ""
                          ? null
                          : f.type === "number"
                            ? Number(raw)
                            : f.k === "notaryAt"
                              ? new Date(raw).toISOString()
                              : raw;
                      void act(
                        () => updateDealFn({ data: { id: openDeal.id, [f.k]: v } as never }),
                        () => "Записано",
                      );
                    }}
                    className="mt-1 w-full rounded-lg border border-primary/25 bg-white px-3 py-2"
                  />
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm text-primary">
                <input
                  type="checkbox"
                  defaultChecked={Boolean(openDeal.notary_confirmed)}
                  onChange={(e) =>
                    void act(
                      () =>
                        updateDealFn({
                          data: { id: openDeal.id, notaryConfirmed: e.target.checked } as never,
                        }),
                      () => "Записано",
                    )
                  }
                  className="h-4 w-4 accent-[#8b1a2b]"
                />
                Часът при нотариус е потвърден
              </label>
              <label className="flex items-center gap-2 text-sm text-primary">
                <input
                  type="checkbox"
                  defaultChecked={Boolean(openDeal.commission_paid)}
                  onChange={(e) =>
                    void act(
                      () =>
                        updateDealFn({
                          data: { id: openDeal.id, commissionPaid: e.target.checked } as never,
                        }),
                      () => "Записано",
                    )
                  }
                  className="h-4 w-4 accent-[#8b1a2b]"
                />
                Комисионата е платена ({money(openDeal.commission_amount, openDeal.currency)})
              </label>
            </div>

            <section className="mt-5">
              <h3 className="flex items-center gap-2 font-display text-xl text-primary">
                <ListChecks className="h-4 w-4" /> Задачи
              </h3>
              <div className="mt-2 space-y-2">
                {openTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-primary"
                  >
                    <div>
                      <div
                        className={
                          t.status === "done" ? "line-through opacity-60" : "font-semibold"
                        }
                      >
                        {t.title}
                      </div>
                      <div className="text-xs text-primary/60">Срок: {dt(t.due_at)}</div>
                    </div>
                    {t.status === "open" && (
                      <button
                        onClick={() =>
                          void act(
                            () => setDealTaskStatus({ data: { id: t.id, status: "done" } }),
                            () => "Задачата е изпълнена",
                          )
                        }
                        className="rounded-lg border border-primary/30 px-3 py-1 text-xs font-semibold text-primary"
                      >
                        Готово
                      </button>
                    )}
                  </div>
                ))}
                {!openTasks.length && (
                  <div className="rounded-xl border border-dashed border-primary/20 p-3 text-xs text-primary/60">
                    Няма задачи
                  </div>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="Нова задача"
                  className="flex-1 rounded-lg border border-primary/25 bg-white px-3 py-2 text-sm text-primary"
                />
                <button
                  onClick={() => {
                    if (newTask.trim().length < 2) return;
                    void act(
                      () => addDealTaskFn({ data: { dealId: openDeal.id, title: newTask.trim() } }),
                      () => "Задачата е добавена",
                    ).then(() => setNewTask(""));
                  }}
                  disabled={busy}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
                >
                  Добави
                </button>
              </div>
            </section>

            <section className="mt-5">
              <h3 className="font-display text-xl text-primary">История</h3>
              <div className="mt-2 space-y-2">
                {openEvents.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-xl border border-primary/15 bg-white p-3 text-sm text-primary"
                  >
                    <div className="text-xs text-primary/60">
                      {dt(e.created_at)} · {e.actor}
                    </div>
                    <div>{e.message}</div>
                  </div>
                ))}
                {!openEvents.length && (
                  <div className="rounded-xl border border-dashed border-primary/20 p-3 text-xs text-primary/60">
                    Няма събития
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
