import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  BarChart3,
  Camera,
  Gauge,
  PlayCircle,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  deleteKpiBriefingFn,
  deleteKpiTargetFn,
  generateKpiBriefingFn,
  getControlCenter,
  resumeCcJobFn,
  runCcSweepNow,
  saveCcSettingsFn,
  saveKpiTargetFn,
  takeKpiSnapshotFn,
} from "@/lib/control-center.functions";

export const Route = createFileRoute("/admin/control-center")({ component: ControlCenterAdmin });

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");
const nf = (v: unknown) => Number(v ?? 0).toLocaleString("bg-BG", { maximumFractionDigits: 0 });
const money = (v: unknown, cur = "EUR") => `${nf(v)} ${cur}`;

const METRICS: { code: string; label: string }[] = [
  { code: "leads", label: "Лийдове" },
  { code: "qualified", label: "Квалифицирани" },
  { code: "viewings", label: "Огледи" },
  { code: "deals_won", label: "Сключени сделки" },
  { code: "revenue", label: "Оборот" },
  { code: "commission", label: "Комисиони" },
  { code: "new_listings", label: "Нови обяви" },
  { code: "conversion", label: "Конверсия (%)" },
];

function Kpi({
  label,
  value,
  hint,
  tone = "base",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "base" | "gold";
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${tone === "gold" ? "border-[#c9a84c] bg-[#fbf3dd]" : "border-[#e6d3ae] bg-[#fdf7ec]"}`}
    >
      <div className="text-2xl font-bold text-[#8b1a2b]">{value}</div>
      <div className="text-sm font-medium text-[#3a2b2e]">{label}</div>
      {hint ? <div className="mt-1 text-xs text-[#7a6a5c]">{hint}</div> : null}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  tone = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "ghost";
}) {
  const cls =
    tone === "primary"
      ? "bg-[#8b1a2b] text-white hover:bg-[#71121f]"
      : "border border-[#e6d3ae] bg-white text-[#8b1a2b] hover:bg-[#fdf7ec]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

const inputCls =
  "w-full rounded-lg border border-[#e6d3ae] bg-white px-3 py-2 text-sm text-[#3a2b2e] placeholder:text-[#a3927f] focus:border-[#8b1a2b] focus:outline-none";

function Card({
  title,
  children,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e6d3ae] bg-white p-4">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-[#8b1a2b]">
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}

function Bars({ rows, cur }: { rows: { key: string; count: number }[]; cur?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="text-sm text-[#7a6a5c]">Няма данни за периода.</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm text-[#3a2b2e]">{r.key}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#eadfc9]">
            <div className="h-full bg-[#8b1a2b]" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="w-16 text-right text-sm font-bold text-[#8b1a2b]">
            {cur ? money(r.count, cur) : nf(r.count)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ rows }: { rows: any[] }) {
  const data = rows.slice(-30);
  const max = Math.max(1, ...data.map((r) => Number(r.leads)), ...data.map((r) => Number(r.deals)));
  if (!data.length) return <p className="text-sm text-[#7a6a5c]">Няма данни.</p>;
  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((r) => (
        <div
          key={r.day}
          className="flex flex-1 flex-col items-center justify-end gap-[2px]"
          title={`${r.day}: ${r.leads} лийда, ${r.deals} сделки`}
        >
          <div
            className="w-full rounded-t bg-[#c9a84c]"
            style={{ height: `${(Number(r.deals) / max) * 100}%` }}
          />
          <div
            className="w-full rounded-t bg-[#8b1a2b]"
            style={{ height: `${(Number(r.leads) / max) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function ControlCenterAdmin() {
  const [tab, setTab] = useState<"overview" | "brokers" | "targets" | "ai" | "history" | "log">(
    "overview",
  );
  const [days, setDays] = useState(30);
  const [board, setBoard] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [target, setTarget] = useState<Record<string, string>>({
    metric: "leads",
    period: "month",
    target: "",
  });

  const load = useCallback(async (d: number) => {
    try {
      setBusy(true);
      const data = await getControlCenter({ data: { days: d } });
      setBoard(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [load, days]);

  const overview = board?.overview;
  const k = overview?.kpis ?? {};
  const cur = overview?.currency ?? "EUR";
  const settings = board?.settings ?? {};

  useEffect(() => {
    if (board?.settings) {
      setCfg({
        currency: String(board.settings.currency ?? "EUR"),
        target_conversion: String(board.settings.target_conversion ?? 12),
        alert_low_leads: String(board.settings.alert_low_leads ?? 5),
        snapshot_days: String(board.settings.snapshot_days ?? 90),
      });
    }
  }, [board?.settings]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      setBusy(true);
      await fn();
      toast.success(ok);
      await load(days);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const brokers: any[] = overview?.brokers ?? [];
  const targets: any[] = overview?.targets ?? [];
  const briefings: any[] = board?.briefings ?? [];
  const snapshots: any[] = board?.snapshots ?? [];
  const events: any[] = board?.events ?? [];
  const funnelMax = useMemo(
    () => Math.max(1, ...(overview?.funnel ?? []).map((f: any) => Number(f.value))),
    [overview],
  );

  return (
    <div data-crm-themed className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#8b1a2b]">
            <Gauge className="h-6 w-6" /> Контролен Център и Анализи
          </h1>
          <p className="text-sm text-[#5b4a44]">
            Автоматизация №20 — KPI, приходи, сделки и брокери на едно място, с дневни снимки и AI
            обобщения.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={`${inputCls} w-auto`}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                Последни {d} дни
              </option>
            ))}
          </select>
          <Btn tone="ghost" onClick={() => void load(days)} disabled={busy}>
            <RefreshCw className="h-4 w-4" /> Опресни
          </Btn>
          <Btn
            tone="ghost"
            onClick={() => act(() => takeKpiSnapshotFn(), "Снимката е записана")}
            disabled={busy}
          >
            <Camera className="h-4 w-4" /> Снимка сега
          </Btn>
          <Btn
            tone="ghost"
            onClick={() => act(() => runCcSweepNow(), "Задачата е изпълнена")}
            disabled={busy}
          >
            <PlayCircle className="h-4 w-4" /> Пусни задачата
          </Btn>
          <Btn tone="ghost" onClick={() => setShowCfg((v) => !v)}>
            <Settings2 className="h-4 w-4" /> Настройки
          </Btn>
        </div>
      </header>

      {showCfg ? (
        <Card title="Настройки на модула" icon={<Settings2 className="h-5 w-5" />}>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { key: "currency", label: "Валута" },
              { key: "target_conversion", label: "Целева конверсия (%)" },
              { key: "alert_low_leads", label: "Праг за малко лийдове" },
              { key: "snapshot_days", label: "История (дни)" },
            ].map((f) => (
              <label key={f.key} className="block text-sm font-medium text-[#3a2b2e]">
                {f.label}
                <input
                  className={`${inputCls} mt-1`}
                  value={cfg[f.key] ?? ""}
                  onChange={(e) => setCfg((p) => ({ ...p, [f.key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn
              onClick={() =>
                act(
                  () =>
                    saveCcSettingsFn({
                      data: {
                        currency: cfg.currency || "EUR",
                        target_conversion: Number(cfg.target_conversion || 0),
                        alert_low_leads: Number(cfg.alert_low_leads || 0),
                        snapshot_days: Number(cfg.snapshot_days || 90),
                      },
                    }),
                  "Настройките са записани",
                )
              }
              disabled={busy}
            >
              <Save className="h-4 w-4" /> Запази
            </Btn>
            {board?.job?.paused ? (
              <Btn
                tone="ghost"
                onClick={() => act(() => resumeCcJobFn(), "Задачата е възобновена")}
                disabled={busy}
              >
                <PlayCircle className="h-4 w-4" /> Възобнови задачата
              </Btn>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-[#7a6a5c]">
            Cron: POST /api/public/hooks/control-center (по избор с хедър x-cron-secret). Последно
            изпълнение: {dt(board?.job?.last_run_at)}
          </p>
        </Card>
      ) : null}

      <nav className="flex flex-wrap gap-2">
        {[
          { code: "overview", label: "Обзор", icon: <BarChart3 className="h-4 w-4" /> },
          { code: "brokers", label: "Брокери", icon: <TrendingUp className="h-4 w-4" /> },
          { code: "targets", label: "Цели", icon: <Target className="h-4 w-4" /> },
          { code: "ai", label: "AI брифинг", icon: <Sparkles className="h-4 w-4" /> },
          { code: "history", label: "История", icon: <Camera className="h-4 w-4" /> },
          { code: "log", label: "Журнал", icon: <Activity className="h-4 w-4" /> },
        ].map((t) => (
          <button
            key={t.code}
            type="button"
            onClick={() => setTab(t.code as typeof tab)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === t.code
                ? "bg-[#8b1a2b] text-white"
                : "border border-[#e6d3ae] bg-white text-[#8b1a2b]"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      {!overview ? (
        <p className="text-sm text-[#7a6a5c]">{busy ? "Зареждане…" : "Няма данни."}</p>
      ) : tab === "overview" ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <Kpi label="Лийдове" value={nf(k.leads)} hint={`Контактувани: ${nf(k.contacted)}`} />
            <Kpi label="Огледи" value={nf(k.viewings)} hint={`Проведени: ${nf(k.viewings_done)}`} />
            <Kpi
              label="Сключени сделки"
              value={nf(k.deals_won)}
              hint={`Активни: ${nf(k.deals_open)} · Загубени: ${nf(k.deals_lost)}`}
            />
            <Kpi
              label="Оборот"
              value={money(k.revenue, cur)}
              hint={`Средна сделка: ${money(k.avg_deal, cur)}`}
              tone="gold"
            />
            <Kpi
              label="Комисиони"
              value={money(k.commission, cur)}
              hint={`Платени: ${money(k.commission_paid, cur)}`}
              tone="gold"
            />
            <Kpi
              label="Приход агенция"
              value={money(k.agency_net, cur)}
              hint={`Към брокери: ${money(k.broker_payout, cur)}`}
            />
            <Kpi
              label="Рекламен бюджет"
              value={money(k.ad_spend, cur)}
              hint={`CPL: ${money(k.cpl, cur)} · CAC: ${money(k.cac, cur)}`}
            />
            <Kpi label="ROI" value={`${nf(k.roi)}%`} hint={`Конверсия: ${k.conversion}%`} />
            <Kpi
              label="Активни имоти"
              value={nf(k.properties_active)}
              hint={`Нови обяви: ${nf(k.new_listings)}`}
            />
            <Kpi label="Потенциални продавачи" value={nf(k.seller_prospects)} />
            <Kpi
              label="Кампании"
              value={nf(k.campaigns_total)}
              hint={`Активни: ${nf(k.campaigns_active)}`}
            />
            <Kpi
              label="Планиран бюджет"
              value={money(k.budget_planned, cur)}
              hint={`Изпълнение: ${money(k.budget_actual, cur)}`}
            />
            <Kpi label="Брокери" value={nf(k.brokers_active)} hint={`Клиенти: ${nf(k.clients)}`} />
            <Kpi
              label="Реакция (мин.)"
              value={nf(k.avg_response_min)}
              hint="Средно време до първи контакт"
            />
            <Kpi label="Оценка клиенти" value={k.avg_rating || "—"} hint="Средно ревю" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Динамика (лийдове и сделки)" icon={<BarChart3 className="h-5 w-5" />}>
              <TrendChart rows={overview.trend} />
              <div className="mt-2 flex gap-4 text-xs text-[#5b4a44]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-3 rounded bg-[#8b1a2b]" /> лийдове
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-3 rounded bg-[#c9a84c]" /> сделки
                </span>
              </div>
            </Card>
            <Card title="Фуния на продажбите" icon={<TrendingUp className="h-5 w-5" />}>
              <div className="space-y-2">
                {overview.funnel.map((f: any) => (
                  <div key={f.code} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-sm text-[#3a2b2e]">{f.label}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded-full bg-[#eadfc9]">
                      <div
                        className="h-full bg-[#8b1a2b]"
                        style={{ width: `${(Number(f.value) / funnelMax) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-bold text-[#8b1a2b]">
                      {nf(f.value)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Канали на лийдове" icon={<BarChart3 className="h-5 w-5" />}>
              <Bars rows={overview.channels} />
            </Card>
            <Card title="Търсени градове" icon={<BarChart3 className="h-5 w-5" />}>
              <Bars rows={overview.cities} />
            </Card>
            <Card title="Етапи на сделките" icon={<BarChart3 className="h-5 w-5" />}>
              <Bars rows={overview.dealStages} />
            </Card>
            <Card title="Последни сделки" icon={<TrendingUp className="h-5 w-5" />}>
              {(overview.deals ?? []).length === 0 ? (
                <p className="text-sm text-[#7a6a5c]">Няма сделки за периода.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e6d3ae] text-left text-[#8b1a2b]">
                        <th className="p-2">Етап</th>
                        <th className="p-2">Статус</th>
                        <th className="p-2">Брокер</th>
                        <th className="p-2">Цена</th>
                        <th className="p-2">Комисион</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview.deals ?? []).slice(0, 8).map((d: any) => (
                        <tr key={d.id} className="border-b border-[#f0e4cd] text-[#3a2b2e]">
                          <td className="p-2">{d.stage}</td>
                          <td className="p-2">{d.status}</td>
                          <td className="p-2">{d.broker}</td>
                          <td className="p-2">{money(d.price, cur)}</td>
                          <td className="p-2">{money(d.commission, cur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card title="Кампании" icon={<BarChart3 className="h-5 w-5" />}>
              {(overview.campaigns ?? []).length === 0 ? (
                <p className="text-sm text-[#7a6a5c]">Няма заведени кампании.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e6d3ae] text-left text-[#8b1a2b]">
                        <th className="p-2">Кампания</th>
                        <th className="p-2">Канал</th>
                        <th className="p-2">Статус</th>
                        <th className="p-2">Бюджет</th>
                        <th className="p-2">Похарчено</th>
                        <th className="p-2">Лийдове</th>
                        <th className="p-2">Сделки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview.campaigns ?? []).slice(0, 8).map((c: any) => (
                        <tr key={c.id} className="border-b border-[#f0e4cd] text-[#3a2b2e]">
                          <td className="p-2 font-semibold text-[#8b1a2b]">{c.name}</td>
                          <td className="p-2">{c.channel}</td>
                          <td className="p-2">{c.status}</td>
                          <td className="p-2">{money(c.budget_total, c.currency || cur)}</td>
                          <td className="p-2">{money(c.spent, c.currency || cur)}</td>
                          <td className="p-2">{nf(c.leads)}</td>
                          <td className="p-2">{nf(c.deals)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card title="Бюджети по месеци" icon={<Target className="h-5 w-5" />}>
              {(overview.budgets ?? []).length === 0 ? (
                <p className="text-sm text-[#7a6a5c]">Няма заведени бюджети.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e6d3ae] text-left text-[#8b1a2b]">
                        <th className="p-2">Месец</th>
                        <th className="p-2">Канал</th>
                        <th className="p-2">План</th>
                        <th className="p-2">Изпълнение</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overview.budgets ?? []).slice(0, 8).map((b: any) => (
                        <tr key={b.id} className="border-b border-[#f0e4cd] text-[#3a2b2e]">
                          <td className="p-2">{b.period}</td>
                          <td className="p-2">{b.channel}</td>
                          <td className="p-2">{money(b.planned, b.currency || cur)}</td>
                          <td className="p-2">{money(b.actual, b.currency || cur)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card title="Известия" icon={<Activity className="h-5 w-5" />}>
              <ul className="space-y-2">
                {overview.alerts.map((a: any, i: number) => (
                  <li
                    key={i}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      a.level === "error"
                        ? "bg-rose-100 text-rose-900"
                        : a.level === "warn"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-emerald-100 text-emerald-900"
                    }`}
                  >
                    {a.message}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      ) : tab === "brokers" ? (
        <Card title="Резултати по брокери" icon={<TrendingUp className="h-5 w-5" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6d3ae] text-left text-[#8b1a2b]">
                  <th className="p-2">Брокер</th>
                  <th className="p-2">Обяви</th>
                  <th className="p-2">Клиенти</th>
                  <th className="p-2">Лийдове</th>
                  <th className="p-2">Сделки</th>
                  <th className="p-2">Конверсия</th>
                  <th className="p-2">Оборот</th>
                  <th className="p-2">Комисиони</th>
                  <th className="p-2">Дял брокер</th>
                </tr>
              </thead>
              <tbody>
                {brokers.length === 0 ? (
                  <tr>
                    <td className="p-3 text-[#7a6a5c]" colSpan={9}>
                      Няма данни за периода.
                    </td>
                  </tr>
                ) : (
                  brokers.map((b) => (
                    <tr key={b.id} className="border-b border-[#f0e4cd] text-[#3a2b2e]">
                      <td className="p-2 font-semibold text-[#8b1a2b]">{b.name}</td>
                      <td className="p-2">{nf(b.listings ?? 0)}</td>
                      <td className="p-2">{nf(b.clients ?? 0)}</td>
                      <td className="p-2">{nf(b.leads)}</td>
                      <td className="p-2">{nf(b.deals_won)}</td>
                      <td className="p-2">{b.conversion}%</td>
                      <td className="p-2">{money(b.revenue, cur)}</td>
                      <td className="p-2">{money(b.commission, cur)}</td>
                      <td className="p-2">{money(b.payout, cur)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : tab === "targets" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Нова цел" icon={<Target className="h-5 w-5" />}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-medium text-[#3a2b2e]">
                Показател
                <select
                  className={`${inputCls} mt-1`}
                  value={target.metric}
                  onChange={(e) => setTarget((p) => ({ ...p, metric: e.target.value }))}
                >
                  {METRICS.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-[#3a2b2e]">
                Период
                <select
                  className={`${inputCls} mt-1`}
                  value={target.period}
                  onChange={(e) => setTarget((p) => ({ ...p, period: e.target.value }))}
                >
                  <option value="month">Месец</option>
                  <option value="quarter">Тримесечие</option>
                  <option value="year">Година</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-[#3a2b2e]">
                Стойност
                <input
                  className={`${inputCls} mt-1`}
                  value={target.target}
                  onChange={(e) => setTarget((p) => ({ ...p, target: e.target.value }))}
                  placeholder="напр. 40"
                />
              </label>
              <label className="block text-sm font-medium text-[#3a2b2e]">
                Етикет
                <input
                  className={`${inputCls} mt-1`}
                  value={target.label ?? ""}
                  onChange={(e) => setTarget((p) => ({ ...p, label: e.target.value }))}
                  placeholder="напр. Цел за месеца"
                />
              </label>
            </div>
            <div className="mt-3">
              <Btn
                onClick={() =>
                  act(
                    () =>
                      saveKpiTargetFn({
                        data: {
                          metric: target.metric,
                          period: target.period,
                          target: Number(target.target || 0),
                          label: target.label || null,
                        },
                      }),
                    "Целта е записана",
                  )
                }
                disabled={busy || !target.target}
              >
                <Save className="h-4 w-4" /> Запази целта
              </Btn>
            </div>
          </Card>
          <Card title="Изпълнение на целите" icon={<Gauge className="h-5 w-5" />}>
            {targets.length === 0 ? (
              <p className="text-sm text-[#7a6a5c]">Няма зададени цели.</p>
            ) : (
              <div className="space-y-3">
                {targets.map((t) => (
                  <div key={t.id} className="rounded-lg border border-[#f0e4cd] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#8b1a2b]">
                        {METRICS.find((m) => m.code === t.metric)?.label ?? t.metric} ·{" "}
                        {t.period_start}
                      </span>
                      <button
                        type="button"
                        className="text-[#8b1a2b] hover:opacity-70"
                        onClick={() =>
                          act(() => deleteKpiTargetFn({ data: { id: t.id } }), "Целта е изтрита")
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#eadfc9]">
                      <div
                        className={`h-full ${Number(t.progress) >= 100 ? "bg-emerald-600" : "bg-[#c9a84c]"}`}
                        style={{ width: `${Math.min(100, Number(t.progress))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[#5b4a44]">
                      {nf(t.actual)} от {nf(t.target)} ({t.progress}%)
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : tab === "ai" ? (
        <div className="space-y-4">
          <Card title="AI обобщение на периода" icon={<Sparkles className="h-5 w-5" />}>
            <Btn
              onClick={() =>
                act(() => generateKpiBriefingFn({ data: { days } }), "Брифингът е готов")
              }
              disabled={busy}
            >
              <Sparkles className="h-4 w-4" /> Генерирай брифинг ({days} дни)
            </Btn>
            <p className="mt-2 text-xs text-[#7a6a5c]">
              Използва конфигурирания AI ключ (OPENAI_API_KEY / GEMINI_API_KEY) от средата на
              Vercel.
            </p>
          </Card>
          {briefings.map((b) => (
            <Card
              key={b.id}
              title={`${b.period_label} · ${dt(b.created_at)}`}
              icon={<Sparkles className="h-5 w-5" />}
            >
              <p className="whitespace-pre-wrap text-sm text-[#3a2b2e]">{b.summary}</p>
              {(b.highlights ?? []).length ? (
                <>
                  <h3 className="mt-3 text-sm font-bold text-[#8b1a2b]">Ключови изводи</h3>
                  <ul className="list-disc pl-5 text-sm text-[#3a2b2e]">
                    {b.highlights.map((h: string, i: number) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {(b.actions ?? []).length ? (
                <>
                  <h3 className="mt-3 text-sm font-bold text-[#8b1a2b]">Препоръчани действия</h3>
                  <ul className="list-disc pl-5 text-sm text-[#3a2b2e]">
                    {b.actions.map((a: string, i: number) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              <div className="mt-3">
                <Btn
                  tone="ghost"
                  onClick={() => act(() => deleteKpiBriefingFn({ data: { id: b.id } }), "Изтрито")}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" /> Изтрий
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      ) : tab === "history" ? (
        <Card title="Дневни снимки на KPI" icon={<Camera className="h-5 w-5" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6d3ae] text-left text-[#8b1a2b]">
                  <th className="p-2">Дата</th>
                  <th className="p-2">Лийдове</th>
                  <th className="p-2">Огледи</th>
                  <th className="p-2">Сделки</th>
                  <th className="p-2">Оборот</th>
                  <th className="p-2">Комисиони</th>
                  <th className="p-2">Реклама</th>
                  <th className="p-2">Конверсия</th>
                  <th className="p-2">ROI</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.length === 0 ? (
                  <tr>
                    <td className="p-3 text-[#7a6a5c]" colSpan={9}>
                      Още няма записани снимки.
                    </td>
                  </tr>
                ) : (
                  snapshots.map((s) => (
                    <tr key={s.id} className="border-b border-[#f0e4cd] text-[#3a2b2e]">
                      <td className="p-2 font-semibold text-[#8b1a2b]">{s.snapshot_date}</td>
                      <td className="p-2">{nf(s.leads)}</td>
                      <td className="p-2">{nf(s.viewings)}</td>
                      <td className="p-2">{nf(s.deals_won)}</td>
                      <td className="p-2">{money(s.revenue, s.currency)}</td>
                      <td className="p-2">{money(s.commission, s.currency)}</td>
                      <td className="p-2">{money(s.ad_spend, s.currency)}</td>
                      <td className="p-2">{s.conversion}%</td>
                      <td className="p-2">{s.roi}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card title="Журнал на модула" icon={<Activity className="h-5 w-5" />}>
          <ul className="space-y-2">
            {events.length === 0 ? (
              <li className="text-sm text-[#7a6a5c]">Няма записи.</li>
            ) : (
              events.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-[#f0e4cd] p-3 text-sm text-[#3a2b2e]"
                >
                  <span className="font-semibold text-[#8b1a2b]">{e.event_type}</span> · {e.status}{" "}
                  · {dt(e.created_at)}
                  {e.message ? <div className="text-[#5b4a44]">{e.message}</div> : null}
                </li>
              ))
            )}
          </ul>
        </Card>
      )}

      <p className="text-xs text-[#7a6a5c]">
        Валута: {settings.currency ?? "EUR"} · Целева конверсия: {settings.target_conversion ?? 12}%
      </p>
    </div>
  );
}
