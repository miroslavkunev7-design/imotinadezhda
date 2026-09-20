import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  HeartHandshake,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  UserPlus,
  Zap,
} from "lucide-react";
import {
  autoEnrollDormantFn,
  enrollClientFn,
  generateReactivationSummaryFn,
  getReactivationAnalyticsFn,
  getReactivationConfig,
  listReactivationCampaigns,
  listReactivationClients,
  listReactivationEnrollments,
  listReactivationEvents,
  listReactivationMessages,
  listReactivationTemplates,
  markReactivationRevivedFn,
  registerReactivationReplyFn,
  resumeReactivationJobFn,
  runReactivationSweepNow,
  saveReactivationConfig,
  sendReactivationStepFn,
  setReactivationStatusFn,
} from "@/lib/reactivation.functions";

export const Route = createFileRoute("/admin/reactivation")({ component: ReactivationAdmin });

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");

const STATUS_LABEL: Record<string, string> = {
  active: "активен",
  paused: "на пауза",
  revived: "реактивиран",
  exhausted: "изчерпан",
  opted_out: "отказал",
  failed: "грешка",
};
const STATUS_CLASS: Record<string, string> = {
  active: "bg-sky-100 text-sky-900",
  paused: "bg-amber-100 text-amber-900",
  revived: "bg-emerald-100 text-emerald-900",
  exhausted: "bg-stone-200 text-stone-800",
  opted_out: "bg-stone-200 text-stone-800",
  failed: "bg-rose-100 text-rose-900",
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

function ScoreBar({ value }: { value?: number | null }) {
  const n = Math.max(0, Math.min(100, Number(value ?? 0)));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-[#e6d3ae]">
        <div className="h-full rounded-full bg-[#8b1a2b]" style={{ width: `${n}%` }} />
      </div>
      <span className="text-xs font-semibold text-[#3a2b2e]">{n}</span>
    </div>
  );
}

function ReactivationAdmin() {
  const [tab, setTab] = useState<"enroll" | "pipeline" | "messages" | "analytics" | "log">(
    "pipeline",
  );
  const [clients, setClients] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [query, setQuery] = useState("");

  const [clientId, setClientId] = useState("");
  const [campaignCode, setCampaignCode] = useState("cold_90");
  const [channel, setChannel] = useState("email");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [cl, cp, tp, en, ms, ev, an, c] = await Promise.all([
        listReactivationClients(),
        listReactivationCampaigns(),
        listReactivationTemplates(),
        listReactivationEnrollments({ data: {} }),
        listReactivationMessages({ data: {} }),
        listReactivationEvents(),
        getReactivationAnalyticsFn(),
        getReactivationConfig(),
      ]);
      setClients(cl as any[]);
      setCampaigns(cp as any[]);
      setTemplates(tp as any[]);
      setEnrollments(en as any[]);
      setMessages(ms as any[]);
      setEvents(ev as any[]);
      setAnalytics(an);
      setCfg((c as any)?.settings ?? null);
      setJob((c as any)?.job ?? null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enrollments;
    return enrollments.filter((e) =>
      [e.contact_name, e.contact_email, e.contact_phone, e.campaign_code, e.status].some((v: any) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [enrollments, query]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveCfg = (patch: Record<string, unknown>) =>
    act(async () => {
      const next = await saveReactivationConfig({ data: patch });
      setCfg(next);
    }, "Настройките са запазени.");

  return (
    <div data-crm-themed className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#8b1a2b]">
            <HeartHandshake className="h-6 w-6" /> Реактивиране на клиенти
          </h1>
          <p className="text-sm text-[#5b4a44]">
            Автоматизация №15 — връщане на стари и студени контакти в процеса с AI кампании, скоринг
            и анализ.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              act(
                () => autoEnrollDormantFn({ data: {} }) as any,
                "Неактивните клиенти са записани.",
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-sm font-semibold text-[#8b1a2b]"
          >
            <UserPlus className="h-4 w-4" /> Авто-записване
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              act(() => runReactivationSweepNow({ data: {} }) as any, "Кампанията е пусната.")
            }
            className="inline-flex items-center gap-2 rounded-lg bg-[#8b1a2b] px-3 py-2 text-sm font-semibold text-white"
          >
            <PlayCircle className="h-4 w-4" /> Пусни цикъл
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowCfg((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-sm font-semibold text-[#8b1a2b]"
          >
            <Settings2 className="h-4 w-4" /> Настройки
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-sm font-semibold text-[#8b1a2b]"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Опресни
          </button>
        </div>
      </header>

      {job?.paused ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <span>Задачата е спряна автоматично: {job.paused_reason ?? "неизвестна причина"}</span>
          <button
            type="button"
            onClick={() => act(() => resumeReactivationJobFn() as any, "Задачата е възобновена.")}
            className="rounded-lg bg-[#8b1a2b] px-3 py-1.5 font-semibold text-white"
          >
            Възобнови
          </button>
        </div>
      ) : null}

      {showCfg && cfg ? (
        <div className="grid gap-4 rounded-xl border border-[#e6d3ae] bg-white p-4 md:grid-cols-3">
          {[
            { key: "enabled", label: "Автоматизацията е активна" },
            { key: "ai_enabled", label: "AI персонализация" },
            { key: "auto_enroll", label: "Авто-записване на неактивни" },
            { key: "stop_on_reply", label: "Спри при отговор" },
          ].map((f) => (
            <label
              key={f.key}
              className="flex items-center gap-2 text-sm font-medium text-[#3a2b2e]"
            >
              <input
                type="checkbox"
                checked={Boolean(cfg[f.key])}
                onChange={(e) => saveCfg({ [f.key]: e.target.checked })}
              />
              {f.label}
            </label>
          ))}
          {[
            { key: "inactive_days", label: "Неактивност (дни)" },
            { key: "batch_size", label: "Партида изпращания" },
            { key: "enroll_batch", label: "Партида записвания" },
            { key: "min_score_to_send", label: "Мин. скор за изпращане" },
            { key: "quiet_hours_start", label: "Тихи часове от" },
            { key: "quiet_hours_end", label: "Тихи часове до" },
          ].map((f) => (
            <label key={f.key} className="text-sm font-medium text-[#3a2b2e]">
              {f.label}
              <input
                type="number"
                defaultValue={Number(cfg[f.key] ?? 0)}
                onBlur={(e) => saveCfg({ [f.key]: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-[#3a2b2e]"
              />
            </label>
          ))}
          <label className="text-sm font-medium text-[#3a2b2e]">
            Кампания по подразбиране
            <select
              value={String(cfg.default_campaign ?? "cold_90")}
              onChange={(e) => saveCfg({ default_campaign: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-[#3a2b2e]"
            >
              {campaigns.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-[#7a6a5c] md:col-span-3">
            Cron: <code>POST /api/public/hooks/reactivation</code> · последно изпълнение:{" "}
            {dt(job?.last_run_at)}
          </div>
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-2">
        {(
          [
            ["pipeline", "Кампании"],
            ["enroll", "Записване"],
            ["messages", "Съобщения"],
            ["analytics", "Анализи"],
            ["log", "Журнал"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === k
                ? "bg-[#8b1a2b] text-white"
                : "border border-[#e6d3ae] bg-[#fdf7ec] text-[#8b1a2b]"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "enroll" ? (
        <section className="grid gap-4 rounded-xl border border-[#e6d3ae] bg-white p-4 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="font-semibold text-[#8b1a2b]">Ръчно записване в кампания</h2>
            <label className="block text-sm font-medium text-[#3a2b2e]">
              Клиент
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-[#3a2b2e]"
              >
                <option value="">— избери клиент —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} {c.email ? `· ${c.email}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-[#3a2b2e]">
              Кампания
              <select
                value={campaignCode}
                onChange={(e) => setCampaignCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-[#3a2b2e]"
              >
                {campaigns.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} · {c.inactive_days} дни
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-[#3a2b2e]">
              Канал
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-[#3a2b2e]"
              >
                <option value="email">Имейл</option>
                <option value="call">Обаждане (задача)</option>
                <option value="sms">SMS (задача)</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !clientId}
                onClick={() =>
                  act(
                    () => enrollClientFn({ data: { clientId, campaignCode, channel } }) as any,
                    "Клиентът е записан.",
                  )
                }
                className="inline-flex items-center gap-2 rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2 text-sm font-semibold text-[#8b1a2b]"
              >
                <UserPlus className="h-4 w-4" /> Запиши
              </button>
              <button
                type="button"
                disabled={busy || !clientId}
                onClick={() =>
                  act(
                    () =>
                      enrollClientFn({
                        data: { clientId, campaignCode, channel, sendNow: true },
                      }) as any,
                    "Съобщението е изпратено.",
                  )
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[#8b1a2b] px-3 py-2 text-sm font-semibold text-white"
              >
                <Send className="h-4 w-4" /> Запиши и изпрати
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="font-semibold text-[#8b1a2b]">Шаблони по стъпки</h2>
            <div className="max-h-80 space-y-2 overflow-auto">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] p-3 text-sm text-[#3a2b2e]"
                >
                  <div className="font-semibold text-[#8b1a2b]">
                    {t.campaign_code} · стъпка {t.step_no} · {t.channel}
                  </div>
                  <div className="font-medium">{t.subject ?? "—"}</div>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-[#5b4a44]">{t.body}</pre>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "pipeline" ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] px-3 py-2">
            <Search className="h-4 w-4 text-[#8b1a2b]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Търси по име, имейл, кампания…"
              className="w-full bg-transparent text-sm text-[#3a2b2e] outline-none"
            />
          </div>
          <div className="overflow-auto rounded-xl border border-[#e6d3ae] bg-white">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
                <tr>
                  <th className="p-3">Клиент</th>
                  <th className="p-3">Кампания</th>
                  <th className="p-3">Скор</th>
                  <th className="p-3">Неактивен</th>
                  <th className="p-3">Стъпка</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3">Следващо</th>
                  <th className="p-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t border-[#f0e2c8] text-[#3a2b2e]">
                    <td className="p-3">
                      <div className="font-semibold">
                        {e.contact_name ?? e.clients?.full_name ?? "—"}
                      </div>
                      <div className="text-xs text-[#7a6a5c]">
                        {e.contact_email ?? e.contact_phone ?? "—"}
                      </div>
                      {e.ai_summary ? (
                        <div className="mt-1 max-w-sm text-xs text-[#5b4a44]">{e.ai_summary}</div>
                      ) : null}
                    </td>
                    <td className="p-3">
                      {e.campaign_code}
                      <div className="text-xs text-[#7a6a5c]">{e.channel}</div>
                    </td>
                    <td className="p-3">
                      <ScoreBar value={e.score} />
                      <div className="text-xs text-[#7a6a5c]">{e.score_reason ?? "—"}</div>
                    </td>
                    <td className="p-3">{e.inactive_days ?? "—"} дни</td>
                    <td className="p-3">{e.step_no ?? 0}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASS[e.status] ?? "bg-stone-200 text-stone-800"}`}
                      >
                        {STATUS_LABEL[e.status] ?? e.status}
                      </span>
                      {e.error ? <div className="mt-1 text-xs text-rose-700">{e.error}</div> : null}
                    </td>
                    <td className="p-3 text-xs text-[#5b4a44]">{dt(e.next_action_at)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () => sendReactivationStepFn({ data: { enrollmentId: e.id } }) as any,
                              "Изпратено.",
                            )
                          }
                          className="rounded-lg bg-[#8b1a2b] px-2 py-1 text-xs font-semibold text-white"
                        >
                          Изпрати
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () =>
                                generateReactivationSummaryFn({
                                  data: { enrollmentId: e.id },
                                }) as any,
                              "AI препоръката е готова.",
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-[#e6d3ae] px-2 py-1 text-xs font-semibold text-[#8b1a2b]"
                        >
                          <Sparkles className="h-3 w-3" /> AI
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () =>
                                registerReactivationReplyFn({
                                  data: { enrollmentId: e.id, note: "отговор" },
                                }) as any,
                              "Отговорът е отчетен.",
                            )
                          }
                          className="rounded-lg border border-[#e6d3ae] px-2 py-1 text-xs font-semibold text-[#8b1a2b]"
                        >
                          Отговор
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () =>
                                markReactivationRevivedFn({
                                  data: { enrollmentId: e.id, reason: "върнат в процеса" },
                                }) as any,
                              "Клиентът е реактивиран.",
                            )
                          }
                          className="rounded-lg border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-800"
                        >
                          Реактивиран
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () =>
                                setReactivationStatusFn({
                                  data: {
                                    enrollmentId: e.id,
                                    status: e.status === "paused" ? "active" : "paused",
                                  },
                                }) as any,
                              "Статусът е обновен.",
                            )
                          }
                          className="rounded-lg border border-[#e6d3ae] px-2 py-1 text-xs font-semibold text-[#8b1a2b]"
                        >
                          {e.status === "paused" ? "Продължи" : "Пауза"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-[#7a6a5c]">
                      Няма записи. Стартирайте „Авто-записване“, за да добавите неактивни клиенти.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "messages" ? (
        <section className="overflow-auto rounded-xl border border-[#e6d3ae] bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
              <tr>
                <th className="p-3">Дата</th>
                <th className="p-3">Получател</th>
                <th className="p-3">Кампания</th>
                <th className="p-3">Стъпка</th>
                <th className="p-3">Тема / текст</th>
                <th className="p-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className="border-t border-[#f0e2c8] text-[#3a2b2e]">
                  <td className="p-3 text-xs">{dt(m.created_at)}</td>
                  <td className="p-3">{m.recipient ?? "—"}</td>
                  <td className="p-3">
                    {m.campaign_code}
                    <div className="text-xs text-[#7a6a5c]">{m.channel}</div>
                  </td>
                  <td className="p-3">{m.step_no}</td>
                  <td className="p-3">
                    <div className="font-medium">{m.subject ?? "—"}</div>
                    <div className="max-w-lg text-xs text-[#5b4a44]">
                      {String(m.body ?? "").slice(0, 220)}
                    </div>
                    {m.ai_used ? (
                      <span className="text-xs font-semibold text-[#c9a84c]">
                        AI · {m.model ?? ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <span className="rounded-full bg-[#fdf7ec] px-2 py-1 text-xs font-semibold text-[#8b1a2b]">
                      {m.status}
                    </span>
                    {m.replied_at ? (
                      <div className="text-xs text-emerald-700">отговорил {dt(m.replied_at)}</div>
                    ) : null}
                    {m.error ? <div className="text-xs text-rose-700">{m.error}</div> : null}
                  </td>
                </tr>
              ))}
              {!messages.length ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#7a6a5c]">
                    Няма изпратени съобщения.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "analytics" && analytics ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Записани клиенти"
              value={analytics.enrollments_total}
              hint={`активни: ${analytics.active}`}
            />
            <Kpi
              label="Реактивирани"
              value={analytics.revived}
              hint={`${analytics.revive_rate}% от записаните`}
            />
            <Kpi
              label="Изпратени съобщения"
              value={analytics.sent}
              hint={`отговори: ${analytics.replied} (${analytics.reply_rate}%)`}
            />
            <Kpi
              label="Среден скор"
              value={analytics.avg_score}
              hint={`средна неактивност: ${analytics.avg_inactive_days} дни`}
            />
            <Kpi label="Отказали" value={analytics.opted_out} hint={`${analytics.opt_out_rate}%`} />
            <Kpi label="Изчерпани кампании" value={analytics.exhausted} />
            <Kpi label="Задачи за обаждане" value={analytics.queued} />
            <Kpi label="Грешки" value={analytics.failed} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-[#8b1a2b]">
                <BarChart3 className="h-4 w-4" /> По кампания
              </h3>
              <div className="space-y-2">
                {Object.entries(analytics.by_campaign ?? {}).map(([code, v]: [string, any]) => (
                  <div
                    key={code}
                    className="flex items-center justify-between text-sm text-[#3a2b2e]"
                  >
                    <span className="font-medium">{code}</span>
                    <span className="text-xs text-[#5b4a44]">
                      записани {v.total} · изпратени {v.sent} · реактивирани {v.revived}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-[#8b1a2b]">
                <Zap className="h-4 w-4" /> По стъпки
              </h3>
              <div className="space-y-2">
                {Object.entries(analytics.by_step ?? {}).map(([step, count]: [string, any]) => (
                  <div key={step} className="flex items-center gap-2 text-sm text-[#3a2b2e]">
                    <span className="w-16 font-medium">Стъпка {step}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f0e2c8]">
                      <div
                        className="h-full rounded-full bg-[#c9a84c]"
                        style={{
                          width: `${analytics.messages_total ? (Number(count) / analytics.messages_total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "log" ? (
        <section className="overflow-auto rounded-xl border border-[#e6d3ae] bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
              <tr>
                <th className="p-3">Дата</th>
                <th className="p-3">Действие</th>
                <th className="p-3">Кампания</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Съобщение</th>
                <th className="p-3">Автор</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-t border-[#f0e2c8] text-[#3a2b2e]">
                  <td className="p-3 text-xs">{dt(ev.created_at)}</td>
                  <td className="p-3 font-medium">{ev.action}</td>
                  <td className="p-3">{ev.campaign_code ?? "—"}</td>
                  <td className="p-3">{ev.status}</td>
                  <td className="p-3 max-w-lg text-xs text-[#5b4a44]">{ev.message ?? "—"}</td>
                  <td className="p-3 text-xs">{ev.actor ?? "—"}</td>
                </tr>
              ))}
              {!events.length ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#7a6a5c]">
                    Няма записи в журнала.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
