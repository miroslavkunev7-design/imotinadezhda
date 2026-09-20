import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  RefreshCw,
  Settings2,
  Star,
  Zap,
} from "lucide-react";
import {
  createViewing,
  getViewingsAnalytics,
  getViewingsConfig,
  listViewingReminders,
  listViewings,
  resumeViewingsJob,
  runViewingReminderNow,
  runViewingsSweepNow,
  saveViewingsConfig,
  suggestViewingSlots,
  updateViewingStatus,
} from "@/lib/viewings.functions";

export const Route = createFileRoute("/admin/viewings")({
  component: ViewingsAdmin,
});

const STATUS_LABEL: Record<string, string> = {
  proposed: "Предложен",
  confirmed: "Потвърден",
  rescheduled: "Пренасрочен",
  completed: "Проведен",
  cancelled: "Отменен",
  no_show: "Не се яви",
};

const KIND_LABEL: Record<string, string> = {
  invite: "Покана",
  reminder_24h: "Напомняне 24ч",
  reminder_2h: "Напомняне 2ч",
  agent_brief: "Брифинг брокер",
  feedback: "Обратна връзка",
};

const REM_STATUS: Record<string, string> = {
  pending: "Изчаква",
  sent: "Изпратено",
  manual: "За ръчно",
  failed: "Грешка",
  skipped: "Пропуснато",
  cancelled: "Отменено",
};

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");
const localInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function ViewingsAdmin() {
  const [tab, setTab] = useState<"upcoming" | "past" | "reminders">("upcoming");
  const [viewings, setViewings] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [slots, setSlots] = useState<{ start: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    agentName: "",
    agentEmail: "",
    scheduledAt: "",
    durationMin: 45,
    location: "",
    notes: "",
    autoConfirm: false,
  });

  const load = useCallback(async () => {
    try {
      const [v, r, a, c] = await Promise.all([
        listViewings({ data: { scope: tab === "past" ? "past" : "upcoming" } }),
        listViewingReminders({ data: {} }),
        getViewingsAnalytics(),
        getViewingsConfig(),
      ]);
      setViewings(v as any[]);
      setReminders(r as any[]);
      setAnalytics(a);
      setCfg((c as any).settings);
      setJob((c as any).job);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при зареждане");
    }
  }, [tab]);

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
      setCfg(await saveViewingsConfig({ data: p as never }));
      toast.success("Настройките са запазени");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при запис");
    }
  };

  const loadSlots = async () => {
    try {
      setSlots((await suggestViewingSlots({ data: { limit: 12 } })) as { start: string }[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при часовете");
    }
  };

  const submitNew = async () => {
    if (!form.scheduledAt) {
      toast.error("Изберете дата и час");
      return;
    }
    await act(
      () =>
        createViewing({
          data: {
            contactName: form.contactName || null,
            contactEmail: form.contactEmail || null,
            contactPhone: form.contactPhone || null,
            agentName: form.agentName || null,
            agentEmail: form.agentEmail || null,
            scheduledAt: new Date(form.scheduledAt).toISOString(),
            durationMin: Number(form.durationMin) || 45,
            location: form.location || null,
            notes: form.notes || null,
            autoConfirm: form.autoConfirm,
          } as never,
        }),
      () => "Огледът е насрочен и поканата е планирана",
    );
    setShowNew(false);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const v of viewings) {
      const key = new Date(v.scheduled_at).toLocaleDateString("bg-BG", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
      map.set(key, [...(map.get(key) ?? []), v]);
    }
    return [...map.entries()];
  }, [viewings]);

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">Огледи &amp; напомняния</h1>
          <p className="mt-1 text-sm text-primary/70">
            №6 — насрочване на огледи, автоматични покани, напомняния и обратна връзка
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setShowNew(true);
              void loadSlots();
            }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#7a0d22] px-4 py-2 text-sm font-semibold text-amber-100"
          >
            <CalendarPlus className="h-4 w-4" /> Нов оглед
          </button>
          <button
            onClick={() =>
              void act(
                () => runViewingsSweepNow({ data: {} }),
                (r) =>
                  r.ran
                    ? `Изпратени ${r.sent} · ръчни ${r.manual} · пропуснати ${r.skipped} · неявили се ${r.no_show}`
                    : `Не се изпълни: ${r.reason}`,
              )
            }
            disabled={busy}
            className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
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
                () => resumeViewingsJob(),
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
            label: "Предстоящи огледи",
            value: analytics?.upcoming ?? 0,
            sub: `${analytics?.thisWeek ?? 0} тази седмица · ${analytics?.total ?? 0} общо`,
            icon: CalendarClock,
          },
          {
            label: "Потвърждения",
            value: `${analytics?.confirmRate ?? 0}%`,
            sub: `${analytics?.rescheduled ?? 0} пренасрочени · ${analytics?.cancelled ?? 0} отменени`,
            icon: CalendarCheck,
          },
          {
            label: "Проведени / явяване",
            value: `${analytics?.completed ?? 0} · ${analytics?.showRate ?? 0}%`,
            sub: `${analytics?.noShow ?? 0} не се явиха`,
            icon: CalendarCheck,
          },
          {
            label: "Средна оценка",
            value: analytics?.avgRating ?? 0,
            sub: `${analytics?.remindersSent ?? 0} напомняния · AI в ${analytics?.aiUsedPct ?? 0}%`,
            icon: Star,
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

      {showNew && (
        <section className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5">
          <h2 className="font-display text-2xl text-primary">Нов оглед</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              { k: "contactName", l: "Клиент" },
              { k: "contactEmail", l: "Имейл на клиента" },
              { k: "contactPhone", l: "Телефон" },
              { k: "agentName", l: "Брокер" },
              { k: "agentEmail", l: "Имейл на брокера" },
              { k: "location", l: "Място / адрес" },
            ].map((f) => (
              <label key={f.k} className="text-sm text-primary">
                <span className="mb-1 block font-semibold">{f.l}</span>
                <input
                  value={(form as any)[f.k]}
                  onChange={(e) => setForm((s) => ({ ...s, [f.k]: e.target.value }))}
                  className="w-full rounded-xl border border-primary/25 bg-white px-3 py-2 text-primary"
                />
              </label>
            ))}
            <label className="text-sm text-primary">
              <span className="mb-1 block font-semibold">Дата и час</span>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((s) => ({ ...s, scheduledAt: e.target.value }))}
                className="w-full rounded-xl border border-primary/25 bg-white px-3 py-2 text-primary"
              />
            </label>
            <label className="text-sm text-primary">
              <span className="mb-1 block font-semibold">Продължителност (мин.)</span>
              <input
                type="number"
                min={15}
                max={240}
                value={form.durationMin}
                onChange={(e) => setForm((s) => ({ ...s, durationMin: Number(e.target.value) }))}
                className="w-full rounded-xl border border-primary/25 bg-white px-3 py-2 text-primary"
              />
            </label>
            <label className="flex items-end gap-2 text-sm font-semibold text-primary">
              <input
                type="checkbox"
                checked={form.autoConfirm}
                onChange={(e) => setForm((s) => ({ ...s, autoConfirm: e.target.checked }))}
                className="h-4 w-4 accent-[#8b1a2b]"
              />
              Потвърден веднага
            </label>
          </div>
          <label className="mt-3 block text-sm text-primary">
            <span className="mb-1 block font-semibold">Бележки за брокера</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              className="w-full rounded-xl border border-primary/25 bg-white px-3 py-2 text-primary"
            />
          </label>
          {slots.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary/60">
                Свободни часове:
              </span>
              {slots.map((s) => (
                <button
                  key={s.start}
                  onClick={() => setForm((f) => ({ ...f, scheduledAt: localInput(s.start) }))}
                  className="rounded-lg border border-primary/25 bg-white px-2 py-1 text-xs font-semibold text-primary"
                >
                  {new Date(s.start).toLocaleString("bg-BG", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void submitNew()}
              disabled={busy}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
            >
              Насрочи
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary"
            >
              Затвори
            </button>
          </div>
        </section>
      )}

      {showCfg && cfg && (
        <section className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5">
          <h2 className="font-display text-2xl text-primary">Правила за огледите</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              {[
                { key: "enabled", label: "Автоматизацията е активна" },
                { key: "ai_enabled", label: "AI персонализиран текст" },
                { key: "send_invite", label: "Изпращай покана при насрочване" },
                { key: "reminder_24h", label: "Напомняне 24 часа преди" },
                { key: "reminder_2h", label: "Напомняне 2 часа преди" },
                { key: "agent_brief", label: "Брифинг до брокера" },
                { key: "feedback_request", label: "Питай за обратна връзка след огледа" },
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
                { key: "batch_size", label: "Напомняния на цикъл", min: 1, max: 100 },
                {
                  key: "feedback_delay_hours",
                  label: "Часове до искане за обратна връзка",
                  min: 0,
                  max: 72,
                },
                {
                  key: "auto_no_show_hours",
                  label: "Часове до авто „не се яви“",
                  min: 1,
                  max: 168,
                },
                {
                  key: "min_lead_hours",
                  label: "Минимум часове до първи свободен час",
                  min: 0,
                  max: 72,
                },
                { key: "slot_days_ahead", label: "Дни напред за свободни часове", min: 1, max: 30 },
                { key: "quiet_start", label: "Тихи часове от", min: 0, max: 23 },
                { key: "quiet_end", label: "Тихи часове до", min: 0, max: 23 },
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
                    className="w-24 rounded-lg border border-primary/25 bg-white px-2 py-1 text-right text-primary"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { id: "upcoming", label: "Предстоящи" },
          { id: "past", label: "Минали" },
          { id: "reminders", label: "Напомняния" },
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

      {tab !== "reminders" ? (
        <div className="space-y-5">
          {grouped.length === 0 && (
            <p className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-6 text-sm text-primary/70">
              Няма огледи в този изглед.
            </p>
          )}
          {grouped.map(([day, items]) => (
            <section key={day} className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-4">
              <h3 className="font-display text-xl capitalize text-primary">{day}</h3>
              <div className="mt-3 space-y-3">
                {items.map((v) => (
                  <article key={v.id} className="rounded-xl border border-primary/15 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-primary">
                          {new Date(v.scheduled_at).toLocaleTimeString("bg-BG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          · {v.properties?.title ?? "Имот по договорка"}
                        </div>
                        <div className="mt-1 text-sm text-primary/75">
                          {v.contact_name ?? "—"} · {v.contact_phone ?? "—"} ·{" "}
                          {v.contact_email ?? "—"}
                        </div>
                        <div className="mt-1 text-xs text-primary/60">
                          Брокер: {v.agent_name ?? "—"} · {v.duration_min} мин ·{" "}
                          {v.location ?? v.properties?.cities?.name ?? "—"} · напомняния:{" "}
                          {v.reminders_sent ?? 0}
                          {Number(v.reschedule_count ?? 0) > 0
                            ? ` · пренасрочен ${v.reschedule_count}×`
                            : ""}
                        </div>
                        {v.notes && (
                          <div className="mt-1 text-xs text-primary/60">Бележка: {v.notes}</div>
                        )}
                        {v.feedback && (
                          <div className="mt-1 text-xs text-primary/70">
                            Оценка {v.rating ?? "—"}/5 — {v.feedback}
                          </div>
                        )}
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {STATUS_LABEL[v.status] ?? v.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <button
                        onClick={() =>
                          void act(
                            () =>
                              updateViewingStatus({
                                data: { id: v.id, action: "confirm" } as never,
                              }),
                            () => "Потвърден",
                          )
                        }
                        className="rounded-lg border border-primary/25 px-3 py-1 text-primary"
                      >
                        Потвърди
                      </button>
                      <button
                        onClick={() => {
                          const val = window.prompt(
                            "Нов час (ГГГГ-ММ-ДД ЧЧ:ММ)",
                            localInput(v.scheduled_at).replace("T", " "),
                          );
                          if (!val) return;
                          void act(
                            () =>
                              updateViewingStatus({
                                data: {
                                  id: v.id,
                                  action: "reschedule",
                                  scheduledAt: new Date(val.replace(" ", "T")).toISOString(),
                                } as never,
                              }),
                            () => "Пренасрочен",
                          );
                        }}
                        className="rounded-lg border border-primary/25 px-3 py-1 text-primary"
                      >
                        Пренасрочи
                      </button>
                      <button
                        onClick={() => {
                          const outcome = window.prompt(
                            "Резултат (напр. интерес / отказ / оферта)",
                            "интерес",
                          );
                          if (!outcome) return;
                          void act(
                            () =>
                              updateViewingStatus({
                                data: { id: v.id, action: "complete", outcome } as never,
                              }),
                            () => "Отбелязан като проведен",
                          );
                        }}
                        className="rounded-lg border border-primary/25 px-3 py-1 text-primary"
                      >
                        Проведен
                      </button>
                      <button
                        onClick={() =>
                          void act(
                            () =>
                              updateViewingStatus({
                                data: { id: v.id, action: "no_show" } as never,
                              }),
                            () => "Отбелязано неявяване",
                          )
                        }
                        className="rounded-lg border border-primary/25 px-3 py-1 text-primary"
                      >
                        Не се яви
                      </button>
                      <button
                        onClick={() => {
                          const reason = window.prompt("Причина за отказ", "По желание на клиента");
                          if (reason === null) return;
                          void act(
                            () =>
                              updateViewingStatus({
                                data: { id: v.id, action: "cancel", reason } as never,
                              }),
                            () => "Отменен",
                          );
                        }}
                        className="rounded-lg border border-rose-500/30 px-3 py-1 text-rose-800"
                      >
                        Отмени
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="overflow-x-auto rounded-2xl border border-primary/15 bg-[#fffaf3]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/15 text-left text-xs uppercase tracking-wide text-primary/60">
                <th className="p-3">Тип</th>
                <th className="p-3">Оглед</th>
                <th className="p-3">Планирано</th>
                <th className="p-3">Изпратено</th>
                <th className="p-3">Получател</th>
                <th className="p-3">Статус</th>
                <th className="p-3">AI</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {reminders.map((r) => (
                <tr key={r.id} className="border-b border-primary/10 text-primary">
                  <td className="p-3 font-semibold">{KIND_LABEL[r.kind] ?? r.kind}</td>
                  <td className="p-3">
                    {r.viewings?.properties?.title ?? "—"}
                    <div className="text-xs text-primary/60">{r.viewings?.contact_name ?? "—"}</div>
                  </td>
                  <td className="p-3">{dt(r.scheduled_at)}</td>
                  <td className="p-3">{dt(r.sent_at)}</td>
                  <td className="p-3">{r.recipient ?? "—"}</td>
                  <td className="p-3">
                    {REM_STATUS[r.status] ?? r.status}
                    {r.error && <div className="text-xs text-rose-700">{r.error}</div>}
                  </td>
                  <td className="p-3">{r.ai_used ? "да" : "не"}</td>
                  <td className="p-3">
                    {["pending", "failed", "manual"].includes(String(r.status)) && (
                      <button
                        onClick={() =>
                          void act(
                            () => runViewingReminderNow({ data: { id: r.id } }),
                            (x) => `Резултат: ${x.result}`,
                          )
                        }
                        className="rounded-lg border border-primary/25 px-3 py-1 text-xs font-semibold text-primary"
                      >
                        Изпрати сега
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {reminders.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-primary/60">
                    Няма напомняния.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
