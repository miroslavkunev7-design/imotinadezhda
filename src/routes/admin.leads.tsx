import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Zap,
  Sparkles,
  Plus,
  RefreshCw,
  Send,
  Clock,
  Target,
  Filter,
  ChevronRight,
} from "lucide-react";
import {
  createLeadManual,
  getInstantContactSettings,
  getLeadAnalytics,
  getLeadTimeline,
  listLeads,
  retryFirstContact,
  saveInstantContactSettings,
  sweepInstantContact,
  updateLead,
} from "@/lib/leads.functions";

export const Route = createFileRoute("/admin/leads")({
  component: LeadsAdmin,
});

type Lead = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  channel: string;
  source: string | null;
  lead_type: string | null;
  score: number;
  status: string;
  ai_summary: string | null;
  first_contact_seconds: number | null;
  notes: string | null;
  properties: { title: string } | null;
  clients: { id: string; full_name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  new: "Нов",
  contacted: "Контактуван",
  qualified: "Квалифициран",
  converted: "Сделка",
  lost: "Загубен",
  spam: "Спам",
};

const CHANNEL_LABELS: Record<string, string> = {
  website: "Сайт",
  property_page: "Страница на имот",
  mortgage: "Ипотека",
  chat: "Чат",
  phone: "Телефон",
  portal: "Портал",
  manual: "Ръчно",
  facebook: "Facebook",
};

function scoreTone(score: number) {
  if (score >= 75) return "bg-emerald-600/15 text-emerald-800 border-emerald-600/30";
  if (score >= 50) return "bg-amber-500/15 text-amber-800 border-amber-600/30";
  return "bg-primary/10 text-primary border-primary/25";
}

function LeadsAdmin() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rows, stats, cfg] = await Promise.all([
        listLeads({
          data: {
            status: status || undefined,
            channel: channel || undefined,
            search: search || undefined,
          },
        }),
        getLeadAnalytics(),
        getInstantContactSettings(),
      ]);
      setLeads(rows as unknown as Lead[]);
      setAnalytics(stats);
      setSettings(cfg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка при зареждане");
    }
  }, [status, channel, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return setTimeline(null);
    getLeadTimeline({ data: { leadId: open } })
      .then(setTimeline)
      .catch(() => setTimeline(null));
  }, [open]);

  const setLeadStatus = async (id: string, next: string) => {
    await updateLead({ data: { id, status: next as any } });
    toast.success("Статусът е обновен");
    void load();
  };

  const retry = async (id: string) => {
    setBusy(true);
    try {
      await retryFirstContact({ data: { leadId: id } });
      toast.success("Първият контакт е изпратен наново");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const sweep = async () => {
    setBusy(true);
    try {
      const r = await sweepInstantContact();
      toast.success(
        `Обработени: ${r.processed} · изпратени: ${r.sent} · ескалирани: ${r.escalated}`,
      );
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const toggleSetting = async (patch: Record<string, unknown>) => {
    const next = await saveInstantContactSettings({ data: patch as any });
    setSettings(next);
    toast.success("Настройките са запазени");
  };

  const channels = useMemo(
    () => Object.entries((analytics?.byChannel ?? {}) as Record<string, number>),
    [analytics],
  );

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">Лийдове и автоматизации</h1>
          <p className="mt-1 text-sm text-primary/70">
            №1 Smart Lead Capture · №2 Instant First Contact — {leads.length} записа
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowNew((v) => !v)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#7a0d22] px-4 py-2 text-sm font-semibold text-amber-100"
          >
            <Plus className="h-4 w-4" /> Нов лийд
          </button>
          <button
            onClick={sweep}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Обработи опашката
          </button>
        </div>
      </header>

      {/* Analytics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Target}
          label="Общо лийдове"
          value={analytics?.total ?? 0}
          hint={`Ср. score ${analytics?.avgScore ?? 0}`}
        />
        <StatCard
          icon={Clock}
          label="Ср. първи контакт"
          value={
            analytics?.avgFirstContactSeconds != null
              ? `${analytics.avgFirstContactSeconds} сек.`
              : "—"
          }
          hint={
            analytics?.under30Pct != null ? `${analytics.under30Pct}% под 30 сек.` : "няма данни"
          }
        />
        <StatCard
          icon={Send}
          label="Контактувани"
          value={analytics?.contacted ?? 0}
          hint="автоматичен първи контакт"
        />
        <StatCard
          icon={Zap}
          label="Сделки"
          value={analytics?.converted ?? 0}
          hint={`${analytics?.conversionPct ?? 0}% конверсия`}
        />
      </div>

      {/* Settings */}
      {settings && (
        <section className="rounded-2xl border border-primary/20 bg-white/85 p-5">
          <h2 className="flex items-center gap-2 font-display text-xl text-primary">
            <Zap className="h-5 w-5" /> Автоматизация №2 — първи контакт
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-primary">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.enabled}
                onChange={(e) => toggleSetting({ enabled: e.target.checked })}
              />
              Активна
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.ai_personalize}
                onChange={(e) => toggleSetting({ ai_personalize: e.target.checked })}
              />
              AI персонализация
            </label>
            <label className="flex items-center gap-2">
              Канал
              <select
                value={settings.channel}
                onChange={(e) => toggleSetting({ channel: e.target.value })}
                className="rounded border border-primary/30 bg-white px-2 py-1"
              >
                <option value="email">Имейл</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="viber">Viber</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              Ескалация след (мин.)
              <input
                type="number"
                min={1}
                value={settings.escalate_after_minutes}
                onChange={(e) => toggleSetting({ escalate_after_minutes: Number(e.target.value) })}
                className="w-20 rounded border border-primary/30 bg-white px-2 py-1"
              />
            </label>
          </div>
          {channels.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {channels.map(([c, n]) => (
                <span
                  key={c}
                  className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary"
                >
                  {CHANNEL_LABELS[c] ?? c}: {n}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {showNew && (
        <NewLeadForm
          onDone={() => {
            setShowNew(false);
            void load();
          }}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-primary/60" />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-primary/30 bg-white px-3 py-1.5 text-sm text-primary"
        >
          <option value="">Статус: всички</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded border border-primary/30 bg-white px-3 py-1.5 text-sm text-primary"
        >
          <option value="">Канал: всички</option>
          {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Търси по име, телефон, имейл…"
          className="min-w-[220px] flex-1 rounded border border-primary/30 bg-white px-3 py-1.5 text-sm text-primary"
        />
      </div>

      {/* List */}
      <div className="space-y-3">
        {leads.map((l) => (
          <article
            key={l.id}
            className="rounded-2xl border border-primary/15 bg-white/90 p-5 text-primary"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreTone(l.score)}`}
                  >
                    {l.score}
                  </span>
                  <span className="font-semibold">{l.full_name}</span>
                  {l.phone && <span className="text-sm text-primary/70">{l.phone}</span>}
                  {l.email && <span className="text-sm text-primary/70">· {l.email}</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-primary/60">
                  <span>{CHANNEL_LABELS[l.channel] ?? l.channel}</span>
                  {l.source && <span>· {l.source}</span>}
                  {l.lead_type && <span>· {l.lead_type}</span>}
                  {l.properties?.title && <span>· Имот: {l.properties.title}</span>}
                  {l.clients?.full_name && <span>· Клиент: {l.clients.full_name}</span>}
                  <span>· {new Date(l.created_at).toLocaleString("bg-BG")}</span>
                  {l.first_contact_seconds != null && (
                    <span className="rounded bg-emerald-600/10 px-1.5 py-0.5 text-emerald-800">
                      първи контакт: {l.first_contact_seconds} сек.
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={l.status}
                  onChange={(e) => setLeadStatus(l.id, e.target.value)}
                  className="rounded border border-primary/30 bg-white px-3 py-1 text-sm text-primary"
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => retry(l.id)}
                  disabled={busy}
                  title="Изпрати първи контакт наново"
                  className="rounded-lg border border-primary/30 p-2 text-primary disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            {l.ai_summary && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm">
                <Sparkles className="mt-0.5 h-4 w-4 flex-none text-amber-700" />
                {l.ai_summary}
              </p>
            )}
            {l.message && <p className="mt-2 whitespace-pre-wrap text-sm">{l.message}</p>}

            <button
              onClick={() => setOpen(open === l.id ? null : l.id)}
              className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition ${open === l.id ? "rotate-90" : ""}`}
              />
              История на автоматизациите
            </button>

            {open === l.id && timeline && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-primary/15 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary/70">
                    Събития
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {timeline.events.map((e: any) => (
                      <li key={e.id}>
                        <span className="font-semibold">{e.event_type}</span> — {e.detail ?? "—"}
                        <span className="block text-primary/50">
                          {new Date(e.created_at).toLocaleString("bg-BG")}
                        </span>
                      </li>
                    ))}
                    {!timeline.events.length && (
                      <li className="italic text-primary/50">Няма събития</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-xl border border-primary/15 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary/70">
                    Опити за контакт
                  </div>
                  <ul className="space-y-2 text-xs">
                    {timeline.attempts.map((a: any) => (
                      <li key={a.id} className="rounded bg-primary/5 p-2">
                        <div className="font-semibold">
                          {a.channel} · {a.status}
                          {a.latency_seconds != null && ` · ${a.latency_seconds} сек.`}
                        </div>
                        {a.subject && <div>{a.subject}</div>}
                        {a.body && (
                          <div className="mt-1 whitespace-pre-wrap text-primary/80">{a.body}</div>
                        )}
                        {a.error && <div className="mt-1 text-red-700">{a.error}</div>}
                      </li>
                    ))}
                    {!timeline.attempts.length && (
                      <li className="italic text-primary/50">Няма опити</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </article>
        ))}
        {!leads.length && (
          <p className="py-10 text-center text-primary/50">Няма лийдове по този филтър</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-white/85 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary/70">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 font-display text-3xl text-primary">{value}</div>
      {hint && <div className="text-xs text-primary/60">{hint}</div>}
    </div>
  );
}

function NewLeadForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    message: "",
    source: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (form.full_name.trim().length < 2) return toast.error("Въведете име");
    if (!form.phone && !form.email) return toast.error("Нужен е телефон или имейл");
    setSaving(true);
    try {
      await createLeadManual({
        data: {
          full_name: form.full_name,
          phone: form.phone || null,
          email: form.email || null,
          message: form.message || null,
          channel: "manual",
          source: form.source || null,
        },
      });
      toast.success("Лийдът е създаден и обработен");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-primary/20 bg-white/90 p-5" data-task-dialog>
      <h2 className="font-display text-xl text-primary">Нов лийд</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          value={form.full_name}
          onChange={set("full_name")}
          placeholder="Име и фамилия"
          className="rounded border border-primary/30 bg-white px-3 py-2 text-sm"
        />
        <input
          value={form.phone}
          onChange={set("phone")}
          placeholder="Телефон"
          className="rounded border border-primary/30 bg-white px-3 py-2 text-sm"
        />
        <input
          value={form.email}
          onChange={set("email")}
          placeholder="Имейл"
          className="rounded border border-primary/30 bg-white px-3 py-2 text-sm"
        />
        <input
          value={form.source}
          onChange={set("source")}
          placeholder="Източник (imot.bg, реклама…)"
          className="rounded border border-primary/30 bg-white px-3 py-2 text-sm"
        />
        <textarea
          value={form.message}
          onChange={set("message")}
          rows={3}
          placeholder="Съобщение / търсене"
          className="rounded border border-primary/30 bg-white px-3 py-2 text-sm sm:col-span-2"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={saving}
          className="rounded-lg bg-gradient-to-r from-primary to-[#7a0d22] px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
        >
          {saving ? "Записване…" : "Създай и стартирай автоматизацията"}
        </button>
        <button
          onClick={onDone}
          className="rounded-lg border border-primary/30 px-4 py-2 text-sm text-primary"
        >
          Отказ
        </button>
      </div>
    </section>
  );
}
