import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Home,
  Send,
  RefreshCw,
  Settings2,
  MousePointerClick,
  MailOpen,
  Heart,
  Sparkles,
} from "lucide-react";
import {
  generateMatches,
  getMatchingAnalytics,
  getMatchingConfig,
  listMatchSends,
  listMatches,
  runMatchingBatch,
  saveMatchingConfig,
  sendMatches,
  updateMatchStatus,
} from "@/lib/matching.functions";

export const Route = createFileRoute("/admin/matching")({
  component: MatchingAdmin,
});

const STATUS_LABELS: Record<string, string> = {
  new: "Ново",
  queued: "На изчакване",
  sent: "Изпратено",
  viewed: "Отворено",
  interested: "Интерес",
  rejected: "Отказано",
  expired: "Изтекло",
};

const WEIGHT_LABELS: Record<string, string> = {
  price: "Цена",
  type: "Тип имот",
  location: "Локация",
  rooms: "Стаи",
  area: "Площ",
  freshness: "Свежест на офертата",
};

function tone(status: string) {
  if (status === "interested") return "bg-emerald-600/15 text-emerald-800 border-emerald-600/30";
  if (status === "rejected") return "bg-rose-600/10 text-rose-800 border-rose-600/25";
  if (status === "sent" || status === "viewed")
    return "bg-amber-500/15 text-amber-800 border-amber-600/30";
  return "bg-primary/10 text-primary border-primary/25";
}

const money = (v: number | null | undefined, currency?: string | null) =>
  v == null
    ? "—"
    : `${new Intl.NumberFormat("bg-BG").format(Math.round(v))} ${currency === "BGN" ? "лв." : "€"}`;

function MatchingAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [sends, setSends] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [tab, setTab] = useState<"matches" | "sends">("matches");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, s, a, c] = await Promise.all([
        listMatches({ data: { status: status || undefined, minScore: minScore || undefined } }),
        listMatchSends(),
        getMatchingAnalytics(),
        getMatchingConfig(),
      ]);
      setRows(m as any[]);
      setSends(s as any[]);
      setAnalytics(a);
      setConfig(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка при зареждане");
    }
  }, [status, minScore]);

  useEffect(() => {
    void load();
  }, [load]);

  const leadGroups = useMemo(() => {
    const map = new Map<string, { lead: any; items: any[] }>();
    for (const r of rows) {
      const id = r.leads?.id ?? "—";
      if (!map.has(id)) map.set(id, { lead: r.leads, items: [] });
      map.get(id)!.items.push(r);
    }
    return Array.from(map.entries()).sort(
      (a, b) => (b[1].items[0]?.score ?? 0) - (a[1].items[0]?.score ?? 0),
    );
  }, [rows]);

  const act = async (fn: () => Promise<unknown>, ok: (r: any) => string) => {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(ok(r));
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const patchConfig = async (patch: Record<string, unknown>) => {
    try {
      setConfig(await saveMatchingConfig({ data: patch as never }));
      toast.success("Настройките са запазени");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка при запис");
    }
  };

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">Автоматично изпращане на имоти</h1>
          <p className="mt-1 text-sm text-primary/70">
            №4 Matching Engine — съвпадение клиент ⇄ оферта, авто-имейл, обратна връзка (
            {rows.length} съвпадения)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              void act(
                () => runMatchingBatch({ data: { limit: 20 } }),
                (r) => `Обработени ${r.processed} · изпратени ${r.sent} · пропуснати ${r.skipped}`,
              )
            }
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#7a0d22] px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" /> Пусни разпращането
          </button>
          <button
            onClick={() => setShowConfig((v) => !v)}
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Съвпадения",
            value: analytics?.totalMatches ?? 0,
            sub: `Ø скор ${analytics?.avgScore ?? 0}`,
            icon: Home,
          },
          {
            label: "Изпратени имейли",
            value: analytics?.sentSends ?? 0,
            sub: `${analytics?.propertiesSent ?? 0} имота · ${analytics?.sentThisWeek ?? 0} тази седмица`,
            icon: Send,
          },
          {
            label: "Отваряния / клик",
            value: `${analytics?.openRate ?? 0}% / ${analytics?.clickRate ?? 0}%`,
            sub: `AI текст в ${analytics?.aiUsedPct ?? 0}%`,
            icon: MailOpen,
          },
          {
            label: "Заявен интерес",
            value: analytics?.interested ?? 0,
            sub: `${analytics?.conversionRate ?? 0}% конверсия`,
            icon: Heart,
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

      {showConfig && config && (
        <section className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5">
          <h2 className="font-display text-2xl text-primary">Правила на разпращането</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {[
                { key: "enabled", label: "Автоматизацията е активна" },
                { key: "ai_enabled", label: "AI персонализиран текст в имейла" },
                { key: "auto_on_qualified", label: "Изпращай при нов квалифициран клиент" },
                { key: "auto_on_new_property", label: "Изпращай при публикуван нов имот" },
              ].map((t) => (
                <label
                  key={t.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-primary"
                >
                  {t.label}
                  <input
                    type="checkbox"
                    checked={Boolean(config[t.key])}
                    onChange={(e) => void patchConfig({ [t.key]: e.target.checked })}
                    className="h-4 w-4 accent-[#8b1a2b]"
                  />
                </label>
              ))}
              <label className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-primary">
                Минимален клас на клиента
                <select
                  value={config.min_grade}
                  onChange={(e) => void patchConfig({ min_grade: e.target.value })}
                  className="rounded-lg border border-primary/25 px-2 py-1"
                >
                  {["A", "B", "C", "D"].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-2">
              {[
                { key: "min_score", label: "Минимален скор за изпращане", min: 30, max: 100 },
                { key: "max_per_send", label: "Имоти в едно изпращане", min: 1, max: 12 },
                {
                  key: "cooldown_hours",
                  label: "Пауза между изпращания (часове)",
                  min: 0,
                  max: 168,
                },
                {
                  key: "max_sends_per_week",
                  label: "Максимум изпращания седмично",
                  min: 1,
                  max: 10,
                },
                { key: "price_tolerance_pct", label: "Толеранс над бюджета (%)", min: 0, max: 30 },
              ].map((f) => (
                <label
                  key={f.key}
                  className="block rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-primary"
                >
                  <span className="flex items-center justify-between">
                    {f.label} <strong>{config[f.key]}</strong>
                  </span>
                  <input
                    type="range"
                    min={f.min}
                    max={f.max}
                    value={config[f.key]}
                    onChange={(e) => setConfig({ ...config, [f.key]: Number(e.target.value) })}
                    onMouseUp={(e) =>
                      void patchConfig({ [f.key]: Number((e.target as HTMLInputElement).value) })
                    }
                    className="mt-2 w-full accent-[#8b1a2b]"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(config.weights ?? {}).map(([k, v]) => (
              <label
                key={k}
                className="block rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-primary"
              >
                <span className="flex items-center justify-between">
                  {WEIGHT_LABELS[k] ?? k} <strong>{String(v)}</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={Number(v)}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      weights: { ...config.weights, [k]: Number(e.target.value) },
                    })
                  }
                  onMouseUp={(e) =>
                    void patchConfig({
                      weights: {
                        ...config.weights,
                        [k]: Number((e.target as HTMLInputElement).value),
                      },
                    })
                  }
                  className="mt-2 w-full accent-[#8b1a2b]"
                />
              </label>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-primary/25 p-1">
          {(["matches", "sends"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-primary text-amber-100" : "text-primary"}`}
            >
              {t === "matches" ? "Съвпадения" : "Изпращания"}
            </button>
          ))}
        </div>
        {tab === "matches" && (
          <>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-primary/25 bg-white px-3 py-2 text-sm text-primary"
            >
              <option value="">Всички статуси</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-primary/25 bg-white px-3 py-2 text-sm text-primary">
              Мин. скор <strong>{minScore}</strong>
              <input
                type="range"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-32 accent-[#8b1a2b]"
              />
            </label>
          </>
        )}
      </div>

      {tab === "matches" ? (
        <div className="space-y-3">
          {leadGroups.length === 0 && (
            <p className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-8 text-center text-primary/60">
              Няма съвпадения. Пусни разпращането или генерирай съвпадения от даден клиент.
            </p>
          )}
          {leadGroups.map(([leadId, g]) => (
            <div
              key={leadId}
              className="overflow-hidden rounded-2xl border border-primary/15 bg-[#fffaf3]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 bg-primary/5 px-4 py-3">
                <div>
                  <div className="font-semibold text-primary">
                    {g.lead?.full_name ?? "Без име"}{" "}
                    {g.lead?.qualification_grade && (
                      <span className="ml-1 rounded-lg border border-primary/25 bg-white px-1.5 py-0.5 text-xs font-bold text-primary">
                        {g.lead.qualification_grade}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-primary/60">
                    {g.lead?.email ?? g.lead?.phone ?? "—"} · {g.lead?.desired_city ?? "—"} ·{" "}
                    {money(g.lead?.budget_min, g.lead?.currency)} –{" "}
                    {money(g.lead?.budget_max, g.lead?.currency)}
                    {g.lead?.matching_opt_out ? " · отписан" : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      void act(
                        () => generateMatches({ data: { leadId } }),
                        (r) => `Генерирани ${r.count} съвпадения`,
                      )
                    }
                    disabled={busy}
                    className="rounded-lg border border-primary/25 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
                  >
                    Прегенерирай
                  </button>
                  <button
                    onClick={() =>
                      void act(
                        () => sendMatches({ data: { leadId } }),
                        (r) =>
                          r.status === "sent"
                            ? `Изпратени ${r.count} имота`
                            : `Пропуснато: ${r.reason ?? r.status}`,
                      )
                    }
                    disabled={busy}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-50"
                  >
                    Изпрати сега
                  </button>
                  <button
                    onClick={() =>
                      void act(
                        () => sendMatches({ data: { leadId, force: true } }),
                        (r) =>
                          r.status === "sent"
                            ? `Изпратени ${r.count} имота (форсирано)`
                            : `Пропуснато: ${r.reason ?? r.status}`,
                      )
                    }
                    disabled={busy}
                    className="rounded-lg border border-primary/25 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50"
                  >
                    Форсирай
                  </button>
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <tbody>
                  {g.items.map((m) => (
                    <Fragment key={m.id}>
                      <tr className="border-t border-primary/10 text-primary">
                        <td className="w-16 px-4 py-3">
                          <span
                            className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${tone(m.status)}`}
                          >
                            {m.score}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <div className="font-semibold">{m.properties?.title ?? "—"}</div>
                          <div className="text-xs text-primary/60">
                            {money(m.properties?.price, m.properties?.currency)} ·{" "}
                            {[m.properties?.cities?.name, m.properties?.quarters?.name]
                              .filter(Boolean)
                              .join(", ")}
                            {m.properties?.rooms ? ` · ${m.properties.rooms} стаи` : ""}
                          </div>
                        </td>
                        <td className="hidden px-2 py-3 text-xs text-primary/70 md:table-cell">
                          {(m.reasons ?? []).slice(0, 2).join(" · ") || "—"}
                        </td>
                        <td className="px-2 py-3 text-xs font-semibold">
                          {STATUS_LABELS[m.status] ?? m.status}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                void act(
                                  () =>
                                    sendMatches({
                                      data: { leadId, force: true, propertyIds: [m.properties.id] },
                                    }),
                                  () => "Изпратен единичен имот",
                                )
                              }
                              disabled={busy}
                              className="rounded-lg border border-primary/25 px-2 py-1 text-xs font-semibold text-primary disabled:opacity-50"
                            >
                              Изпрати
                            </button>
                            <select
                              value={m.status}
                              onChange={(e) =>
                                void act(
                                  () =>
                                    updateMatchStatus({
                                      data: { id: m.id, status: e.target.value },
                                    }),
                                  () => "Статусът е обновен",
                                )
                              }
                              className="rounded-lg border border-primary/25 bg-white px-2 py-1 text-xs text-primary"
                            >
                              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => setOpen(open === m.id ? null : m.id)}
                              className="rounded-lg border border-primary/25 px-2 py-1 text-xs text-primary"
                            >
                              детайли
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open === m.id && (
                        <tr className="border-t border-primary/10 bg-white/60">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="flex flex-wrap gap-2 text-xs text-primary">
                              {Object.entries((m.breakdown ?? {}) as Record<string, number>).map(
                                ([k, v]) => (
                                  <span key={k} className="rounded-lg bg-primary/5 px-2 py-1">
                                    {WEIGHT_LABELS[k] ?? k}: <strong>{v}</strong>
                                  </span>
                                ),
                              )}
                            </div>
                            {(m.reasons ?? []).length > 0 && (
                              <p className="mt-2 text-sm text-primary">
                                ✔ {(m.reasons as string[]).join(" · ")}
                              </p>
                            )}
                            {(m.mismatches ?? []).length > 0 && (
                              <p className="mt-1 text-sm text-rose-800">
                                ✖ {(m.mismatches as string[]).join(" · ")}
                              </p>
                            )}
                            <p className="mt-2 text-xs text-primary/60">
                              {m.sent_at
                                ? `Изпратено: ${new Date(m.sent_at).toLocaleString("bg-BG")}`
                                : "Още не е изпратено"}
                              {m.responded_at
                                ? ` · Отговор: ${new Date(m.responded_at).toLocaleString("bg-BG")} (${m.feedback})`
                                : ""}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-primary/15 bg-[#fffaf3]">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary/5 text-xs uppercase tracking-wide text-primary/70">
              <tr>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Тема</th>
                <th className="px-4 py-3">Имоти</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Отваряне / клик</th>
              </tr>
            </thead>
            <tbody>
              {sends.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-primary/60">
                    Няма изпращания.
                  </td>
                </tr>
              )}
              {sends.map((s) => (
                <tr key={s.id} className="border-t border-primary/10 text-primary">
                  <td className="px-4 py-3 text-xs">
                    {new Date(s.created_at).toLocaleString("bg-BG")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{s.leads?.full_name ?? "—"}</div>
                    <div className="text-xs text-primary/60">{s.leads?.email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {s.subject ?? "—"}
                    {s.ai_used ? " · AI" : ""}
                  </td>
                  <td className="px-4 py-3 text-xs">{s.match_count}</td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {s.status === "sent"
                      ? "Изпратен"
                      : s.status === "failed"
                        ? `Грешка: ${s.error ?? ""}`
                        : s.status === "manual"
                          ? "За ръчно"
                          : "Изчаква"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <MailOpen className="h-3.5 w-3.5 text-primary/50" />{" "}
                      {s.opened_at ? "да" : "—"}
                    </span>
                    <span className="ml-3 inline-flex items-center gap-1">
                      <MousePointerClick className="h-3.5 w-3.5 text-primary/50" />{" "}
                      {s.clicked_at ? "да" : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
