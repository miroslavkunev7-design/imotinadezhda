import { useEffect, useState } from "react";
import { getAssistantAnalytics, getAssistantChannelStatus } from "@/lib/customer-assistant.functions";
import { Link } from "@tanstack/react-router";

type Analytics = Awaited<ReturnType<typeof getAssistantAnalytics>>;
type Status = Awaited<ReturnType<typeof getAssistantChannelStatus>>;

function fmtMs(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} мс`;
  if (ms < 60_000) return `${Math.round(ms / 1000)} сек`;
  return `${Math.round(ms / 60000)} мин`;
}

const CHANNEL_LABEL: Record<string, string> = {
  site: "Сайт",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  viber: "Viber",
};

export function AssistantAnalytics() {
  const [stats, setStats] = useState<Analytics | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    Promise.all([getAssistantAnalytics(), getAssistantChannelStatus()])
      .then(([a, s]) => {
        if (cancel) return;
        setStats(a);
        setStatus(s);
      })
      .catch((e) => {
        if (!cancel) setErr(e?.message ?? "Грешка");
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (err) return <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">{err}</div>;
  if (!stats || !status) return <div className="p-6 text-sm text-amber-100/60">Зареждане…</div>;

  const cards = [
    { label: "Разговори 7 дни", value: stats.total_7d },
    { label: "Разговори 30 дни", value: stats.total_30d },
    { label: "Лийдове 7 дни", value: stats.leads_7d },
    { label: "Лийдове 30 дни", value: stats.leads_30d },
    { label: "Неотговорени", value: stats.unanswered },
    { label: "Предадени на брокер", value: stats.handed_off },
    { label: "Средно първи отговор", value: fmtMs(stats.avg_first_response_ms) },
    { label: "Свързани клиенти", value: stats.clients_linked },
  ];

  const channels = status.channels as Record<string, { ready?: boolean; send?: boolean; hint?: string; waMe?: string }>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-amber-100">AI Асистент 24/7</h2>
          <p className="text-xs text-amber-100/60">
            Работно време на брокерите {status.quiet_window.start}–{status.quiet_window.end} ({status.quiet_window.tz}).
            {status.quiet_hours ? " Сега е извън смяна — AI отговаря, жив брокер сутринта." : " Брокерите са на линия."}
          </p>
        </div>
        <Link to="/admin/chat" className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/10">
          Към входящата кутия
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-amber-500/20 bg-[rgba(20,4,8,0.55)] p-4">
            <div className="text-[11px] uppercase tracking-wide text-amber-100/50">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold text-amber-50">{c.value}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-amber-500/20 bg-[rgba(20,4,8,0.55)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-amber-100">Обем по канал (7 / 30 дни)</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.keys(CHANNEL_LABEL).map((key) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-amber-500/15 px-3 py-2 text-sm">
              <span className="text-amber-100/80">{CHANNEL_LABEL[key]}</span>
              <span className="font-semibold text-amber-50">
                {stats.by_channel_7d[key] ?? 0}
                <span className="text-amber-100/40"> / {stats.by_channel_30d[key] ?? 0}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {(["site", "whatsapp", "messenger", "viber"] as const).map((key) => {
          const ch = channels[key];
          const ready = Boolean(ch?.ready || ch?.send);
          return (
            <div key={key} className="rounded-xl border border-amber-500/20 bg-[rgba(20,4,8,0.55)] p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-amber-100">{CHANNEL_LABEL[key]}</div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ready ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>
                  {ready ? "активен" : "локален запис"}
                </span>
              </div>
              <p className="mt-2 text-xs text-amber-100/65">{ch?.hint}</p>
              {key === "whatsapp" && ch?.waMe ? (
                <a href={ch.waMe} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-emerald-300 hover:underline">
                  Резервен канал: wa.me
                </a>
              ) : null}
              {key === "viber" && !ready ? (
                <p className="mt-2 text-xs text-amber-200/80">Свържи с VIBER_AUTH_TOKEN — webhook: /api/public/hooks/viber</p>
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}
