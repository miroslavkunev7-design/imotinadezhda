import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  CalendarClock,
  FileBarChart2,
  Mail,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  deleteOwnerReportScheduleFn,
  generateOwnerReportFn,
  getOwnerReportAnalyticsFn,
  getOwnerReportConfig,
  listOwnerReportEvents,
  listOwnerReportOwners,
  listOwnerReportSchedules,
  listOwnerReportTemplates,
  listOwnerReports,
  resumeOwnerReportJobFn,
  runOwnerReportSweepNow,
  saveOwnerReportConfig,
  saveOwnerReportScheduleFn,
  sendOwnerReportFn,
  setOwnerReportStatusFn,
} from "@/lib/owner-reports.functions";

export const Route = createFileRoute("/admin/owner-reports")({ component: OwnerReportsAdmin });

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");
const d = (v?: string | null) => (v ? new Date(v).toLocaleDateString("bg-BG") : "—");

const STATUS_LABEL: Record<string, string> = {
  draft: "чернова",
  ready: "готов",
  sent: "изпратен",
  failed: "грешка",
  archived: "архивиран",
};
const STATUS_CLASS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-900",
  ready: "bg-sky-100 text-sky-900",
  sent: "bg-emerald-100 text-emerald-900",
  failed: "bg-rose-100 text-rose-900",
  archived: "bg-stone-200 text-stone-800",
};
const FREQ_LABEL: Record<string, string> = {
  weekly: "седмично",
  biweekly: "на 2 седмици",
  monthly: "месечно",
};

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4">
      <div className="text-2xl font-bold text-[#8b1a2b]">{value}</div>
      <div className="text-sm font-medium text-[#3a2b2e]">{label}</div>
      {hint ? <div className="mt-1 text-xs text-[#7a6a5c]">{hint}</div> : null}
    </div>
  );
}

function OwnerReportsAdmin() {
  const [tab, setTab] = useState<"generate" | "reports" | "schedules" | "analytics" | "log">(
    "generate",
  );
  const [owners, setOwners] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [query, setQuery] = useState("");
  const [templateCode, setTemplateCode] = useState("monthly_standard");
  const [periodDays, setPeriodDays] = useState(30);
  const [useAi, setUseAi] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [o, t, r, s, e, a, c] = await Promise.all([
        listOwnerReportOwners(),
        listOwnerReportTemplates(),
        listOwnerReports({ data: {} }),
        listOwnerReportSchedules(),
        listOwnerReportEvents(),
        getOwnerReportAnalyticsFn(),
        getOwnerReportConfig(),
      ]);
      setOwners(o as any[]);
      setTemplates(t as any[]);
      setReports(r as any[]);
      setSchedules(s as any[]);
      setEvents(e as any[]);
      setAnalytics(a);
      setCfg((c as any).settings);
      setJob((c as any).job);
      setTemplateCode((c as any).settings?.default_template ?? "monthly_standard");
      setPeriodDays((c as any).settings?.period_days ?? 30);
      setUseAi(Boolean((c as any).settings?.ai_enabled));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при зареждане");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredOwners = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return owners;
    return owners.filter((o) =>
      `${o.full_name} ${o.email ?? ""} ${o.phone ?? ""}`.toLowerCase().includes(q),
    );
  }, [owners, query]);

  const openReport = reports.find((r) => r.id === openId) ?? null;

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-crm-themed className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#8b1a2b]">
            <FileBarChart2 className="h-6 w-6" /> Отчети към собственици
          </h1>
          <p className="text-sm text-[#5c4a44]">
            Автоматизация №13 — периодични отчети за интерес, огледи и препоръки.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              act(() => runOwnerReportSweepNow({ data: {} }), "Обработката е стартирана")
            }
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#8b1a2b] px-3 py-2 text-sm font-semibold text-[#f7e3c0] disabled:opacity-60"
          >
            <Zap className="h-4 w-4" /> Пусни графиците
          </button>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#c9a84c] px-3 py-2 text-sm font-semibold text-[#8b1a2b]"
          >
            <RefreshCw className="h-4 w-4" /> Обнови
          </button>
          <button
            onClick={() => setShowCfg((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#c9a84c] px-3 py-2 text-sm font-semibold text-[#8b1a2b]"
          >
            <Settings2 className="h-4 w-4" /> Настройки
          </button>
        </div>
      </header>

      {job?.paused ? (
        <div className="flex items-center justify-between rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <span>Задачата е спряна: {job.paused_reason ?? "без причина"}</span>
          <button
            onClick={() => act(() => resumeOwnerReportJobFn(), "Възобновено")}
            className="rounded bg-rose-700 px-3 py-1 font-semibold text-white"
          >
            Възобнови
          </button>
        </div>
      ) : null}

      {showCfg && cfg ? (
        <div className="grid gap-3 rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4 md:grid-cols-3">
          {[
            ["enabled", "Активна автоматизация"],
            ["ai_enabled", "AI резюме"],
            ["auto_send", "Автоматично изпращане"],
            ["skip_empty_activity", "Пропускай периоди без активност"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-[#3a2b2e]">
              <input
                type="checkbox"
                checked={Boolean(cfg[key])}
                onChange={(e) => setCfg({ ...cfg, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          {[
            ["period_days", "Период (дни)"],
            ["batch_size", "Партида"],
            ["send_hour", "Час на изпращане"],
          ].map(([key, label]) => (
            <label key={key} className="text-sm text-[#3a2b2e]">
              {label}
              <input
                type="number"
                value={Number(cfg[key] ?? 0)}
                onChange={(e) => setCfg({ ...cfg, [key]: Number(e.target.value) })}
                className="mt-1 w-full rounded border border-[#e6d3ae] bg-white px-2 py-1 text-[#3a2b2e]"
              />
            </label>
          ))}
          <label className="text-sm text-[#3a2b2e]">
            Шаблон по подразбиране
            <select
              value={String(cfg.default_template ?? "monthly_standard")}
              onChange={(e) => setCfg({ ...cfg, default_template: e.target.value })}
              className="mt-1 w-full rounded border border-[#e6d3ae] bg-white px-2 py-1 text-[#3a2b2e]"
            >
              {templates.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[#3a2b2e]">
            Честота по подразбиране
            <select
              value={String(cfg.default_frequency ?? "monthly")}
              onChange={(e) => setCfg({ ...cfg, default_frequency: e.target.value })}
              className="mt-1 w-full rounded border border-[#e6d3ae] bg-white px-2 py-1 text-[#3a2b2e]"
            >
              {Object.entries(FREQ_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-3">
            <button
              onClick={() =>
                act(() => saveOwnerReportConfig({ data: cfg }), "Настройките са запазени")
              }
              disabled={busy}
              className="rounded-lg bg-[#8b1a2b] px-4 py-2 text-sm font-semibold text-[#f7e3c0] disabled:opacity-60"
            >
              Запази настройките
            </button>
          </div>
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-2">
        {(
          [
            ["generate", "Генериране"],
            ["reports", `Отчети (${reports.length})`],
            ["schedules", `Графици (${schedules.length})`],
            ["analytics", "Аналитика"],
            ["log", "Журнал"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === key ? "bg-[#8b1a2b] text-[#f7e3c0]" : "border border-[#c9a84c] text-[#8b1a2b]"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "generate" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4">
            <label className="text-sm text-[#3a2b2e]">
              Шаблон
              <select
                value={templateCode}
                onChange={(e) => setTemplateCode(e.target.value)}
                className="mt-1 block rounded border border-[#e6d3ae] bg-white px-2 py-1"
              >
                {templates.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[#3a2b2e]">
              Период (дни)
              <input
                type="number"
                value={periodDays}
                onChange={(e) => setPeriodDays(Number(e.target.value))}
                className="mt-1 block w-24 rounded border border-[#e6d3ae] bg-white px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-[#3a2b2e]">
              <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />{" "}
              AI резюме
            </label>
            <div className="relative ml-auto">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-[#8b1a2b]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Търси собственик…"
                className="rounded border border-[#e6d3ae] bg-white py-2 pl-8 pr-3 text-sm text-[#3a2b2e]"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredOwners.map((o) => (
              <article key={o.id} className="rounded-xl border border-[#e6d3ae] bg-white p-4">
                <h3 className="font-semibold text-[#8b1a2b]">{o.full_name}</h3>
                <p className="text-xs text-[#7a6a5c]">
                  {o.email ?? "без имейл"} · {o.phone ?? "—"}
                </p>
                <p className="mt-2 text-sm text-[#3a2b2e]">Имоти: {o.properties?.length ?? 0}</p>
                <ul className="mt-1 space-y-1 text-xs text-[#5c4a44]">
                  {(o.properties ?? []).slice(0, 3).map((p: any) => (
                    <li key={p.id}>· {p.title}</li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      act(
                        () =>
                          generateOwnerReportFn({
                            data: { ownerId: o.id, templateCode, periodDays, useAi },
                          }),
                        "Отчетът е генериран",
                      )
                    }
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded bg-[#8b1a2b] px-3 py-1.5 text-xs font-semibold text-[#f7e3c0] disabled:opacity-60"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Генерирай
                  </button>
                  <button
                    onClick={() =>
                      act(
                        () =>
                          saveOwnerReportScheduleFn({
                            data: {
                              ownerId: o.id,
                              templateCode,
                              frequency: cfg?.default_frequency ?? "monthly",
                              hour: cfg?.send_hour ?? 9,
                            },
                          }),
                        "Графикът е записан",
                      )
                    }
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded border border-[#c9a84c] px-3 py-1.5 text-xs font-semibold text-[#8b1a2b] disabled:opacity-60"
                  >
                    <CalendarClock className="h-3.5 w-3.5" /> Абонирай
                  </button>
                </div>
              </article>
            ))}
            {!filteredOwners.length ? (
              <p className="text-sm text-[#7a6a5c]">Няма собственици по този критерий.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "reports" ? (
        <section className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#f7e3c0] text-[#8b1a2b]">
              <tr>
                <th className="p-3 text-left">Собственик</th>
                <th className="p-3 text-left">Период</th>
                <th className="p-3">Запитвания</th>
                <th className="p-3">Огледи</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Изпратен</th>
                <th className="p-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-t border-[#eadfce] text-[#3a2b2e]">
                  <td className="p-3">
                    <button
                      onClick={() => setOpenId(r.id)}
                      className="font-semibold text-[#8b1a2b] underline-offset-2 hover:underline"
                    >
                      {r.owner_name ?? "—"}
                    </button>
                    <div className="text-xs text-[#7a6a5c]">{r.recipient ?? "без имейл"}</div>
                  </td>
                  <td className="p-3">
                    {d(r.period_start)} – {d(r.period_end)}
                  </td>
                  <td className="p-3 text-center">{r.metrics?.totals?.inquiries ?? 0}</td>
                  <td className="p-3 text-center">
                    {r.metrics?.totals?.viewings ?? 0} /{" "}
                    {r.metrics?.totals?.viewings_completed ?? 0}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${STATUS_CLASS[r.status] ?? "bg-stone-100 text-stone-800"}`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="p-3 text-center text-xs">{dt(r.sent_at)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() =>
                          act(
                            () => sendOwnerReportFn({ data: { reportId: r.id } }),
                            "Отчетът е изпратен",
                          )
                        }
                        disabled={busy || !r.recipient}
                        className="inline-flex items-center gap-1 rounded bg-[#8b1a2b] px-2 py-1 text-xs font-semibold text-[#f7e3c0] disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" /> Изпрати
                      </button>
                      <button
                        onClick={() =>
                          act(
                            () =>
                              setOwnerReportStatusFn({
                                data: { reportId: r.id, status: "archived" },
                              }),
                            "Архивиран",
                          )
                        }
                        disabled={busy}
                        className="rounded border border-[#c9a84c] px-2 py-1 text-xs font-semibold text-[#8b1a2b] disabled:opacity-50"
                      >
                        Архивирай
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!reports.length ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-[#7a6a5c]">
                    Още няма генерирани отчети.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "schedules" ? (
        <section className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#f7e3c0] text-[#8b1a2b]">
              <tr>
                <th className="p-3 text-left">Собственик</th>
                <th className="p-3">Шаблон</th>
                <th className="p-3">Честота</th>
                <th className="p-3">Час</th>
                <th className="p-3">Следващ</th>
                <th className="p-3">Активен</th>
                <th className="p-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-t border-[#eadfce] text-[#3a2b2e]">
                  <td className="p-3 font-semibold text-[#8b1a2b]">
                    {s.owners?.full_name ?? "—"}
                    <div className="text-xs font-normal text-[#7a6a5c]">
                      {s.owners?.email ?? "без имейл"}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    {templates.find((t) => t.code === s.template_code)?.name ?? s.template_code}
                  </td>
                  <td className="p-3 text-center">{FREQ_LABEL[s.frequency] ?? s.frequency}</td>
                  <td className="p-3 text-center">{s.hour}:00</td>
                  <td className="p-3 text-center text-xs">{dt(s.next_run_at)}</td>
                  <td className="p-3 text-center">{s.is_active ? "да" : "не"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() =>
                          act(
                            () =>
                              saveOwnerReportScheduleFn({
                                data: { id: s.id, ownerId: s.owner_id, isActive: !s.is_active },
                              }),
                            "Обновено",
                          )
                        }
                        disabled={busy}
                        className="rounded border border-[#c9a84c] px-2 py-1 text-xs font-semibold text-[#8b1a2b] disabled:opacity-50"
                      >
                        {s.is_active ? "Спри" : "Активирай"}
                      </button>
                      <button
                        onClick={() =>
                          act(() => deleteOwnerReportScheduleFn({ data: { id: s.id } }), "Изтрито")
                        }
                        disabled={busy}
                        className="rounded bg-rose-700 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Изтрий
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!schedules.length ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-[#7a6a5c]">
                    Няма абонирани собственици.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "analytics" && analytics ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Общо отчети" value={analytics.total} />
            <Kpi label="Изпратени" value={analytics.sent} hint={`отворени: ${analytics.opened}`} />
            <Kpi label="Отваряемост" value={`${analytics.open_rate}%`} />
            <Kpi label="С AI резюме" value={`${analytics.ai_share}%`} />
            <Kpi
              label="Активни графици"
              value={analytics.schedules_active}
              hint={`покрити собственици: ${analytics.owners_covered}/${analytics.owners_total}`}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Kpi label="Отчетени запитвания" value={analytics.reported_totals.inquiries} />
            <Kpi label="Отчетени огледи" value={analytics.reported_totals.viewings} />
            <Kpi label="Отчетени съвпадения" value={analytics.reported_totals.matches} />
          </div>
          <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-[#8b1a2b]">
              <BarChart3 className="h-4 w-4" /> Отчети по дни (90 дни)
            </h3>
            <div className="flex flex-wrap gap-2 text-xs text-[#3a2b2e]">
              {(analytics.trend as Array<[string, number]>).map(([day, n]) => (
                <span key={day} className="rounded bg-[#f7e3c0] px-2 py-1">
                  {day}: <strong>{n}</strong>
                </span>
              ))}
              {!analytics.trend.length ? <span className="text-[#7a6a5c]">Няма данни.</span> : null}
            </div>
          </div>
          <div className="rounded-xl border border-[#e6d3ae] bg-white p-4 text-sm text-[#3a2b2e]">
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#8b1a2b]" /> Собственици с имейл:{" "}
              <strong>{analytics.owners_with_email}</strong> от {analytics.owners_total}
            </p>
            <p className="mt-1 text-xs text-[#7a6a5c]">
              Последно изпълнение на задачата: {dt(job?.last_run_at)}
            </p>
          </div>
        </section>
      ) : null}

      {tab === "log" ? (
        <section className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#f7e3c0] text-[#8b1a2b]">
              <tr>
                <th className="p-3 text-left">Дата</th>
                <th className="p-3 text-left">Действие</th>
                <th className="p-3">Статус</th>
                <th className="p-3 text-left">Съобщение</th>
                <th className="p-3">Автор</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-[#eadfce] text-[#3a2b2e]">
                  <td className="p-3 text-xs">{dt(e.created_at)}</td>
                  <td className="p-3">{e.action}</td>
                  <td className="p-3 text-center">{e.status}</td>
                  <td className="p-3">{e.message ?? "—"}</td>
                  <td className="p-3 text-center text-xs">{e.actor ?? "—"}</td>
                </tr>
              ))}
              {!events.length ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-[#7a6a5c]">
                    Журналът е празен.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {openReport ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full max-w-3xl rounded-xl bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-[#8b1a2b]">
                Преглед на отчета — {openReport.owner_name}
              </h3>
              <button
                onClick={() => setOpenId(null)}
                className="rounded border border-[#c9a84c] px-2 py-1 text-sm text-[#8b1a2b]"
              >
                Затвори
              </button>
            </div>
            <div dangerouslySetInnerHTML={{ __html: String(openReport.html ?? "") }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
