import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlarmClock,
  MailOpen,
  MousePointerClick,
  PlayCircle,
  RefreshCw,
  Repeat2,
  Settings2,
  StopCircle,
  Zap,
} from "lucide-react";
import {
  enrollLeadInFollowup,
  getFollowupAnalytics,
  getFollowupConfig,
  listFollowupEnrollments,
  listFollowupMessages,
  listFollowupSequences,
  resumeFollowupJob,
  runFollowupStepNow,
  runFollowupSweepNow,
  saveFollowupConfig,
  stopFollowupEnrollment,
  toggleFollowupSequence,
} from "@/lib/followup.functions";

export const Route = createFileRoute("/admin/followup")({
  component: FollowupAdmin,
});

const ENR_STATUS: Record<string, string> = {
  active: "Активно",
  completed: "Завършено",
  stopped: "Спряно",
  paused: "На пауза",
};

const MSG_STATUS: Record<string, string> = {
  pending: "Изчаква",
  sent: "Изпратено",
  manual: "За ръчно",
  failed: "Грешка",
  skipped: "Пропуснато",
};

const TRIGGERS: Record<string, string> = {
  no_response: "Няма отговор",
  after_send: "След изпратени имоти",
  qualified_no_action: "Квалифициран без действие",
  after_viewing: "След оглед",
  dormant: "Реактивация",
  manual: "Ръчно",
};

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");

function FollowupAdmin() {
  const [tab, setTab] = useState<"enrollments" | "messages" | "sequences">("enrollments");
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [sequences, setSequences] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [manualLead, setManualLead] = useState("");

  const load = useCallback(async () => {
    try {
      const [e, m, s, a, c] = await Promise.all([
        listFollowupEnrollments({ data: { status: status || undefined } }),
        listFollowupMessages({ data: {} }),
        listFollowupSequences(),
        getFollowupAnalytics(),
        getFollowupConfig(),
      ]);
      setEnrollments(e as any[]);
      setMessages(m as any[]);
      setSequences(s as any[]);
      setAnalytics(a);
      setCfg((c as any).settings);
      setJob((c as any).job);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при зареждане");
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<any>, ok: (r: any) => string) => {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(ok(r));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (p: Record<string, unknown>) => {
    try {
      setCfg(await saveFollowupConfig({ data: p as never }));
      toast.success("Настройките са запазени");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при запис");
    }
  };

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">Follow-Up автоматизация</h1>
          <p className="mt-1 text-sm text-primary/70">
            №5 — последващи контакти по последователности и реактивация на стари клиенти
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              void act(
                () => runFollowupSweepNow({ data: {} }),
                (r) =>
                  r.ran
                    ? `Записани ${r.enrolled} · изпратени ${r.sent} · ръчни ${r.manual} · пропуснати ${r.skipped}`
                    : `Не се изпълни: ${r.reason}`,
              )
            }
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#7a0d22] px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" /> Пусни цикъла
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
                () => resumeFollowupJob(),
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
            label: "Активни последователности",
            value: analytics?.active ?? 0,
            sub: `${analytics?.enrollments ?? 0} общо · ${analytics?.completed ?? 0} завършени`,
            icon: Repeat2,
          },
          {
            label: "Изпратени съобщения",
            value: analytics?.sent ?? 0,
            sub: `${analytics?.sentThisWeek ?? 0} тази седмица · ${analytics?.manual ?? 0} за ръчно`,
            icon: AlarmClock,
          },
          {
            label: "Отваряне / клик",
            value: `${analytics?.openRate ?? 0}% / ${analytics?.clickRate ?? 0}%`,
            sub: `AI текст в ${analytics?.aiUsedPct ?? 0}%`,
            icon: MailOpen,
          },
          {
            label: "Отговори / реактивации",
            value: `${analytics?.replyRate ?? 0}%`,
            sub: `${analytics?.reactivated ?? 0} реактивирани клиенти`,
            icon: MousePointerClick,
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
          <h2 className="font-display text-2xl text-primary">Правила на follow-up</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              {[
                { key: "enabled", label: "Автоматизацията е активна" },
                { key: "ai_enabled", label: "AI персонализиран текст" },
                { key: "stop_on_reply", label: "Спри при отговор от клиента" },
                { key: "auto_enroll_no_response", label: "Авто-записване при липса на отговор" },
                { key: "auto_enroll_after_send", label: "Авто-записване след изпратени имоти" },
                { key: "auto_enroll_dormant", label: "Авто-реактивация на стари контакти" },
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
                { key: "batch_size", label: "Стъпки на цикъл", min: 1, max: 100 },
                { key: "max_steps", label: "Максимум стъпки на клиент", min: 1, max: 12 },
                {
                  key: "min_hours_between",
                  label: "Минимум часове между съобщения",
                  min: 0,
                  max: 336,
                },
                { key: "dormant_days", label: "Дни без активност = „спящ“", min: 7, max: 720 },
                {
                  key: "reactivation_limit_per_run",
                  label: "Реактивации на цикъл",
                  min: 1,
                  max: 100,
                },
              ].map((f) => (
                <label
                  key={f.key}
                  className="block rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-primary"
                >
                  <span className="flex items-center justify-between">
                    {f.label} <strong>{cfg[f.key]}</strong>
                  </span>
                  <input
                    type="range"
                    min={f.min}
                    max={f.max}
                    value={cfg[f.key]}
                    onChange={(e) => setCfg({ ...cfg, [f.key]: Number(e.target.value) })}
                    onMouseUp={(e) =>
                      void patch({ [f.key]: Number((e.target as HTMLInputElement).value) })
                    }
                    className="mt-2 w-full accent-[#8b1a2b]"
                  />
                </label>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-primary/60">Последен цикъл: {dt(job?.last_run_at)}</p>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-primary/25 p-1">
          {(
            [
              ["enrollments", "Записвания"],
              ["messages", "Съобщения"],
              ["sequences", "Последователности"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === k ? "bg-primary text-amber-100" : "text-primary"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "enrollments" && (
          <>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-primary/25 bg-white px-3 py-2 text-sm text-primary"
            >
              <option value="">Всички</option>
              {Object.entries(ENR_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                value={manualLead}
                onChange={(e) => setManualLead(e.target.value)}
                placeholder="ID на лийд за ръчно записване"
                className="w-64 rounded-xl border border-primary/25 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/40"
              />
              <button
                onClick={() =>
                  void act(
                    () => enrollLeadInFollowup({ data: { leadId: manualLead.trim() } }),
                    (r) => (r.enrolled ? "Клиентът е записан" : `Пропуснато: ${r.reason}`),
                  )
                }
                disabled={busy || manualLead.trim().length < 30}
                className="rounded-xl border border-primary/30 px-3 py-2 text-sm font-semibold text-primary disabled:opacity-40"
              >
                Запиши
              </button>
            </div>
          </>
        )}
      </div>

      {tab === "enrollments" && (
        <div className="overflow-hidden rounded-2xl border border-primary/15 bg-[#fffaf3]">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary/5 text-xs uppercase tracking-wide text-primary/70">
              <tr>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Последователност</th>
                <th className="px-4 py-3">Стъпка</th>
                <th className="px-4 py-3">Следващо</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-primary/60">
                    Няма записвания за този филтър.
                  </td>
                </tr>
              )}
              {enrollments.map((e) => (
                <tr key={e.id} className="border-t border-primary/10 text-primary">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{e.leads?.full_name ?? "—"}</div>
                    <div className="text-xs text-primary/60">
                      {e.leads?.email ?? e.leads?.phone ?? "—"} · {e.leads?.status ?? "—"}
                      {e.leads?.followup_opt_out ? " · отписан" : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{e.followup_sequences?.name ?? "—"}</div>
                    <div className="text-xs text-primary/60">
                      {TRIGGERS[e.followup_sequences?.trigger_type] ??
                        e.followup_sequences?.trigger_type}{" "}
                      · {e.reason ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{e.current_step}</td>
                  <td className="px-4 py-3 text-xs">{dt(e.next_run_at)}</td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {ENR_STATUS[e.status] ?? e.status}
                    {e.stop_reason ? (
                      <div className="font-normal text-primary/60">{e.stop_reason}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          void act(
                            () => runFollowupStepNow({ data: { id: e.id } }),
                            (r) => `Резултат: ${r.result}${r.detail ? ` — ${r.detail}` : ""}`,
                          )
                        }
                        disabled={busy || e.status !== "active"}
                        className="flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-amber-100 disabled:opacity-40"
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Изпрати
                      </button>
                      <button
                        onClick={() =>
                          void act(
                            () => stopFollowupEnrollment({ data: { id: e.id } }),
                            () => "Спряно",
                          )
                        }
                        disabled={busy || e.status !== "active"}
                        className="flex items-center gap-1 rounded-lg border border-primary/25 px-2 py-1 text-xs font-semibold text-primary disabled:opacity-40"
                      >
                        <StopCircle className="h-3.5 w-3.5" /> Спри
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "messages" && (
        <div className="overflow-hidden rounded-2xl border border-primary/15 bg-[#fffaf3]">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary/5 text-xs uppercase tracking-wide text-primary/70">
              <tr>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Стъпка / тема</th>
                <th className="px-4 py-3">Канал</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Отваряне / клик / отговор</th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-primary/60">
                    Още няма изпратени съобщения.
                  </td>
                </tr>
              )}
              {messages.map((m) => (
                <tr key={m.id} className="border-t border-primary/10 text-primary">
                  <td className="px-4 py-3 text-xs">{dt(m.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{m.leads?.full_name ?? "—"}</div>
                    <div className="text-xs text-primary/60">{m.leads?.email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <strong>#{m.step_no}</strong> {m.subject ?? "—"}
                    <div className="text-primary/60">
                      {m.followup_sequences?.name ?? "—"}
                      {m.ai_used ? ` · AI${m.model ? ` (${m.model})` : ""}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{m.channel}</td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {MSG_STATUS[m.status] ?? m.status}
                    {m.error ? <div className="font-normal text-rose-800">{m.error}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {m.opened_at ? "отворено" : "—"} / {m.clicked_at ? "клик" : "—"} /{" "}
                    {m.replied_at ? "отговор" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "sequences" && (
        <div className="grid gap-3 lg:grid-cols-2">
          {sequences.map((s) => (
            <div key={s.id} className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl text-primary">{s.name}</h3>
                  <p className="text-xs text-primary/60">
                    {TRIGGERS[s.trigger_type] ?? s.trigger_type} · {s.lead_type ?? "всички типове"}{" "}
                    · тихи часове {s.quiet_start}:00–{s.quiet_end}:00
                  </p>
                  {s.description ? (
                    <p className="mt-1 text-sm text-primary/80">{s.description}</p>
                  ) : null}
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-primary">
                  активна
                  <input
                    type="checkbox"
                    checked={Boolean(s.is_active)}
                    onChange={(e) =>
                      void act(
                        () =>
                          toggleFollowupSequence({
                            data: { id: s.id, is_active: e.target.checked },
                          }),
                        () => "Обновено",
                      )
                    }
                    className="h-4 w-4 accent-[#8b1a2b]"
                  />
                </label>
              </div>
              <ol className="mt-3 space-y-2">
                {(s.followup_steps ?? []).map((st: any) => (
                  <li
                    key={st.id}
                    className="rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-primary"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>
                        Стъпка {st.step_no} · след {st.delay_hours} ч. · {st.channel}
                      </span>
                      <span className={st.is_active ? "text-emerald-800" : "text-primary/40"}>
                        {st.is_active ? "вкл." : "изкл."}
                      </span>
                    </div>
                    {st.subject ? <div className="mt-1 font-semibold">{st.subject}</div> : null}
                    <p className="mt-1 whitespace-pre-wrap text-xs text-primary/75">
                      {String(st.body).slice(0, 320)}
                    </p>
                  </li>
                ))}
                {(s.followup_steps ?? []).length === 0 && (
                  <li className="text-xs text-primary/60">Няма стъпки.</li>
                )}
              </ol>
            </div>
          ))}
          {sequences.length === 0 && (
            <p className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-8 text-center text-primary/60">
              Няма последователности — пусни миграцията за Автоматизация №5.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
