import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Coins,
  Megaphone,
  PlayCircle,
  RefreshCw,
  Settings2,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import {
  deleteAdCreativeFn,
  generateAdCreativesFn,
  generateBudgetAdviceFn,
  getMarketingBoard,
  listAdAttributionsFn,
  listAdCreativesFn,
  listAdPropertiesFn,
  listAdSpendFn,
  recordAdSpendFn,
  resumeMarketingJobFn,
  runMarketingSweepNow,
  saveAdBudgetFn,
  saveAdCampaignFn,
  saveMarketingConfigFn,
  setAdCampaignStatusFn,
} from "@/lib/marketing-auto.functions";

export const Route = createFileRoute("/admin/marketing-auto")({ component: MarketingAutoAdmin });

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");
const money = (v: unknown, cur = "BGN") =>
  `${Number(v ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

const STATUS_LABEL: Record<string, string> = {
  draft: "чернова",
  active: "активна",
  paused: "спряна",
  completed: "завършена",
  stopped: "прекратена",
};
const STATUS_CLASS: Record<string, string> = {
  draft: "bg-stone-200 text-stone-800",
  active: "bg-emerald-100 text-emerald-900",
  paused: "bg-amber-100 text-amber-900",
  completed: "bg-sky-100 text-sky-900",
  stopped: "bg-rose-100 text-rose-900",
};
const OBJECTIVES: Array<[string, string]> = [
  ["leads", "Лийдове"],
  ["traffic", "Трафик"],
  ["awareness", "Разпознаваемост"],
  ["listing_promo", "Промо на имот"],
];

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4">
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

const field = "w-full rounded-lg border border-[#e6d3ae] bg-white px-3 py-2 text-sm text-[#3a2b2e]";
const label = "block text-xs font-semibold uppercase tracking-wide text-[#8b1a2b]";

function MarketingAutoAdmin() {
  const [tab, setTab] = useState<
    "campaigns" | "creatives" | "spend" | "budgets" | "analytics" | "log"
  >("campaigns");
  const [board, setBoard] = useState<any>(null);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [spend, setSpend] = useState<any[]>([]);
  const [attrs, setAttrs] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [advice, setAdvice] = useState<string>("");

  const [form, setForm] = useState<any>({
    name: "",
    channel_code: "facebook",
    objective: "leads",
    budget_total: "",
    budget_daily: "",
    city: "",
    audience: "",
    start_date: "",
    end_date: "",
    property_id: "",
  });
  const [sp, setSp] = useState<any>({
    day: new Date().toISOString().slice(0, 10),
    spend: "",
    impressions: "",
    clicks: "",
    leads: "",
  });
  const [bd, setBd] = useState<any>({
    period_month: new Date().toISOString().slice(0, 7),
    channel_code: "",
    planned: "",
  });
  const [aiExtra, setAiExtra] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [b, p] = await Promise.all([getMarketingBoard(), listAdPropertiesFn()]);
      setBoard(b);
      setProperties(p as any[]);
      if (!selected && (b as any)?.campaigns?.length) setSelected((b as any).campaigns[0].id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [selected]);

  useEffect(() => {
    void load();
  }, []);

  const loadDetails = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const [c, s, a] = await Promise.all([
        listAdCreativesFn({ data: { campaignId: id } }),
        listAdSpendFn({ data: { campaignId: id } }),
        listAdAttributionsFn({ data: { campaignId: id } }),
      ]);
      setCreatives(c as any[]);
      setSpend(s as any[]);
      setAttrs(a as any[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadDetails(selected);
  }, [selected, loadDetails]);

  const campaigns: any[] = board?.campaigns ?? [];
  const channels: any[] = board?.channels ?? [];
  const analytics = board?.analytics;
  const current = useMemo(
    () => campaigns.find((c) => c.id === selected) ?? null,
    [campaigns, selected],
  );

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      await load();
      if (selected) await loadDetails(selected);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-crm-themed className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#8b1a2b]">
            <Megaphone className="h-6 w-6" /> Маркетинг автоматизация
          </h1>
          <p className="text-sm text-[#7a6a5c]">
            Кампании, бюджети, разходи, атрибуция и ROI по канали — Автоматизация №18.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn tone="ghost" onClick={() => void load()} disabled={busy}>
            <RefreshCw className="h-4 w-4" /> Обнови
          </Btn>
          <Btn
            onClick={() => void act(() => runMarketingSweepNow(), "Проверката е изпълнена")}
            disabled={busy}
          >
            <PlayCircle className="h-4 w-4" /> Пусни проверка
          </Btn>
          <Btn tone="ghost" onClick={() => setShowCfg((v) => !v)}>
            <Settings2 className="h-4 w-4" /> Настройки
          </Btn>
        </div>
      </header>

      {board?.job?.paused ? (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <span>Задачата е на пауза: {board.job.paused_reason ?? "неизвестна причина"}</span>
          <Btn
            tone="ghost"
            onClick={() => void act(() => resumeMarketingJobFn(), "Задачата е пусната")}
          >
            Пусни
          </Btn>
        </div>
      ) : null}

      {showCfg && board?.settings ? (
        <section className="grid gap-3 rounded-xl border border-[#e6d3ae] bg-white p-4 md:grid-cols-4">
          <div>
            <span className={label}>Месечен бюджет</span>
            <input
              className={field}
              defaultValue={board.settings.monthly_budget}
              onBlur={(e) =>
                void act(
                  () => saveMarketingConfigFn({ data: { monthly_budget: Number(e.target.value) } }),
                  "Записано",
                )
              }
            />
          </div>
          <div>
            <span className={label}>Целева цена/лийд</span>
            <input
              className={field}
              defaultValue={board.settings.target_cpl}
              onBlur={(e) =>
                void act(
                  () => saveMarketingConfigFn({ data: { target_cpl: Number(e.target.value) } }),
                  "Записано",
                )
              }
            />
          </div>
          <div>
            <span className={label}>Макс. цена/лийд</span>
            <input
              className={field}
              defaultValue={board.settings.max_cpl}
              onBlur={(e) =>
                void act(
                  () => saveMarketingConfigFn({ data: { max_cpl: Number(e.target.value) } }),
                  "Записано",
                )
              }
            />
          </div>
          <div>
            <span className={label}>Аларма при % бюджет</span>
            <input
              className={field}
              defaultValue={board.settings.budget_alert_percent}
              onBlur={(e) =>
                void act(
                  () =>
                    saveMarketingConfigFn({
                      data: { budget_alert_percent: Number(e.target.value) },
                    }),
                  "Записано",
                )
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#3a2b2e]">
            <input
              type="checkbox"
              defaultChecked={board.settings.auto_pause_on_budget}
              onChange={(e) =>
                void act(
                  () => saveMarketingConfigFn({ data: { auto_pause_on_budget: e.target.checked } }),
                  "Записано",
                )
              }
            />{" "}
            Авто-пауза при изчерпан бюджет
          </label>
          <label className="flex items-center gap-2 text-sm text-[#3a2b2e]">
            <input
              type="checkbox"
              defaultChecked={board.settings.auto_pause_bad_cpl}
              onChange={(e) =>
                void act(
                  () => saveMarketingConfigFn({ data: { auto_pause_bad_cpl: e.target.checked } }),
                  "Записано",
                )
              }
            />{" "}
            Авто-пауза при висока цена/лийд
          </label>
          <label className="flex items-center gap-2 text-sm text-[#3a2b2e]">
            <input
              type="checkbox"
              defaultChecked={board.settings.ai_enabled}
              onChange={(e) =>
                void act(
                  () => saveMarketingConfigFn({ data: { ai_enabled: e.target.checked } }),
                  "Записано",
                )
              }
            />{" "}
            AI активен
          </label>
          <label className="flex items-center gap-2 text-sm text-[#3a2b2e]">
            <input
              type="checkbox"
              defaultChecked={board.settings.enabled}
              onChange={(e) =>
                void act(
                  () => saveMarketingConfigFn({ data: { enabled: e.target.checked } }),
                  "Записано",
                )
              }
            />{" "}
            Модулът е активен
          </label>
        </section>
      ) : null}

      {analytics ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Активни кампании"
            value={analytics.kpi.active}
            hint={`общо ${analytics.kpi.campaigns}`}
          />
          <Kpi
            label="Разход този месец"
            value={money(analytics.kpi.month_spend)}
            hint={`${analytics.kpi.budget_used_percent}% от бюджета`}
          />
          <Kpi
            label="Цена на лийд"
            value={money(analytics.kpi.cpl)}
            hint={`цел ${money(analytics.kpi.target_cpl)}`}
          />
          <Kpi
            label="ROI"
            value={`${analytics.kpi.roi}%`}
            hint={`${analytics.kpi.deals} сделки / ${money(analytics.kpi.revenue)}`}
          />
        </section>
      ) : null}

      <nav className="flex flex-wrap gap-2 border-b border-[#e6d3ae] pb-2">
        {(
          [
            ["campaigns", "Кампании", Megaphone],
            ["creatives", "Криейтиви", Sparkles],
            ["spend", "Разходи", Coins],
            ["budgets", "Бюджети", Wallet],
            ["analytics", "Анализи", BarChart3],
            ["log", "Журнал", Target],
          ] as const
        ).map(([k, l, Icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === k ? "bg-[#8b1a2b] text-white" : "border border-[#e6d3ae]/60 bg-[rgba(255,255,255,0.10)] text-[#ffe9c2] hover:bg-[rgba(255,255,255,0.18)]"}`}
          >
            <Icon className="h-4 w-4" /> {l}
          </button>
        ))}
      </nav>

      {tab === "campaigns" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
                <tr>
                  <th className="p-3">Кампания</th>
                  <th className="p-3">Канал</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3">Бюджет / Разход</th>
                  <th className="p-3">Лийдове / CPL</th>
                  <th className="p-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const cpl = Number(c.leads) > 0 ? Number(c.spent) / Number(c.leads) : null;
                  return (
                    <tr
                      key={c.id}
                      className={`border-t border-[#f0e2c8] ${selected === c.id ? "bg-[#fdf7ec]" : ""}`}
                      onClick={() => setSelected(c.id)}
                    >
                      <td className="p-3 font-semibold text-[#3a2b2e]">
                        {c.name}
                        <div className="text-xs text-[#7a6a5c]">
                          {c.city ?? "—"} ·{" "}
                          {OBJECTIVES.find(([v]) => v === c.objective)?.[1] ?? c.objective}
                        </div>
                      </td>
                      <td className="p-3">
                        {channels.find((ch) => ch.code === c.channel_code)?.name ?? c.channel_code}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASS[c.status] ?? "bg-stone-200 text-stone-800"}`}
                        >
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {money(c.spent, c.currency)} / {money(c.budget_total, c.currency)}
                      </td>
                      <td className="p-3">
                        {c.leads}{" "}
                        {cpl != null ? (
                          <span className="text-xs text-[#7a6a5c]">({money(cpl, c.currency)})</span>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {c.status !== "active" ? (
                            <Btn
                              tone="ghost"
                              onClick={() =>
                                void act(
                                  () =>
                                    setAdCampaignStatusFn({ data: { id: c.id, status: "active" } }),
                                  "Активирана",
                                )
                              }
                            >
                              Активирай
                            </Btn>
                          ) : (
                            <Btn
                              tone="ghost"
                              onClick={() =>
                                void act(
                                  () =>
                                    setAdCampaignStatusFn({ data: { id: c.id, status: "paused" } }),
                                  "Спряна",
                                )
                              }
                            >
                              Спри
                            </Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!campaigns.length ? (
                  <tr>
                    <td className="p-6 text-center text-[#7a6a5c]" colSpan={6}>
                      Няма кампании.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <aside className="space-y-3 rounded-xl border border-[#e6d3ae] bg-white p-4">
            <h2 className="font-bold text-[#8b1a2b]">Нова кампания</h2>
            <div>
              <span className={label}>Име</span>
              <input
                className={field}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={label}>Канал</span>
                <select
                  className={field}
                  value={form.channel_code}
                  onChange={(e) => setForm({ ...form, channel_code: e.target.value })}
                >
                  {channels.map((ch) => (
                    <option key={ch.code} value={ch.code}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={label}>Цел</span>
                <select
                  className={field}
                  value={form.objective}
                  onChange={(e) => setForm({ ...form, objective: e.target.value })}
                >
                  {OBJECTIVES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={label}>Общ бюджет</span>
                <input
                  className={field}
                  value={form.budget_total}
                  onChange={(e) => setForm({ ...form, budget_total: e.target.value })}
                />
              </div>
              <div>
                <span className={label}>Дневен бюджет</span>
                <input
                  className={field}
                  value={form.budget_daily}
                  onChange={(e) => setForm({ ...form, budget_daily: e.target.value })}
                />
              </div>
              <div>
                <span className={label}>От дата</span>
                <input
                  type="date"
                  className={field}
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div>
                <span className={label}>До дата</span>
                <input
                  type="date"
                  className={field}
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div>
                <span className={label}>Град</span>
                <input
                  className={field}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <span className={label}>Аудитория</span>
                <input
                  className={field}
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value })}
                />
              </div>
            </div>
            <div>
              <span className={label}>Имот (по избор)</span>
              <select
                className={field}
                value={form.property_id}
                onChange={(e) => setForm({ ...form, property_id: e.target.value })}
              >
                <option value="">—</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {p.city}
                  </option>
                ))}
              </select>
            </div>
            <Btn
              disabled={busy || !form.name}
              onClick={() =>
                void act(async () => {
                  await saveAdCampaignFn({
                    data: {
                      ...form,
                      budget_total: Number(form.budget_total || 0),
                      budget_daily: form.budget_daily ? Number(form.budget_daily) : null,
                      property_id: form.property_id || null,
                      start_date: form.start_date || null,
                      end_date: form.end_date || null,
                    },
                  });
                  setForm({ ...form, name: "", budget_total: "", budget_daily: "" });
                }, "Кампанията е създадена")
              }
            >
              <Megaphone className="h-4 w-4" /> Създай
            </Btn>
          </aside>
        </div>
      ) : null}

      {tab === "creatives" ? (
        <section className="space-y-3 rounded-xl border border-[#e6d3ae] bg-white p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <span className={label}>Кампания</span>
              <select
                className={field}
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[220px] flex-1">
              <span className={label}>Насока към AI (по избор)</span>
              <input
                className={field}
                value={aiExtra}
                onChange={(e) => setAiExtra(e.target.value)}
                placeholder="напр. акцент върху панорама и гараж"
              />
            </div>
            <Btn
              disabled={busy || !selected}
              onClick={() =>
                void act(
                  () =>
                    generateAdCreativesFn({
                      data: { campaignId: selected, extra: aiExtra || null },
                    }),
                  "AI генерира варианти",
                )
              }
            >
              <Sparkles className="h-4 w-4" /> Генерирай с AI
            </Btn>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {creatives.map((cr) => (
              <article key={cr.id} className="rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] p-3">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#8b1a2b] px-2 py-0.5 text-xs font-bold text-white">
                    Вариант {cr.variant}
                  </span>
                  <span className="text-xs text-[#7a6a5c]">{cr.ai_used ? "AI" : "ръчно"}</span>
                </div>
                <h3 className="mt-2 font-bold text-[#8b1a2b]">{cr.headline ?? "—"}</h3>
                <p className="mt-1 text-sm text-[#3a2b2e]">{cr.body ?? "—"}</p>
                <div className="mt-2 text-xs text-[#7a6a5c]">
                  CTA: {cr.cta ?? "—"} · Кликове: {cr.clicks} · Лийдове: {cr.leads}
                </div>
                <div className="mt-2">
                  <Btn
                    tone="ghost"
                    onClick={() =>
                      void act(() => deleteAdCreativeFn({ data: { id: cr.id } }), "Изтрит")
                    }
                  >
                    Изтрий
                  </Btn>
                </div>
              </article>
            ))}
            {!creatives.length ? (
              <p className="text-sm text-[#7a6a5c]">Няма криейтиви за тази кампания.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {tab === "spend" ? (
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
                <tr>
                  <th className="p-3">Дата</th>
                  <th className="p-3">Разход</th>
                  <th className="p-3">Импресии</th>
                  <th className="p-3">Кликове</th>
                  <th className="p-3">Лийдове</th>
                </tr>
              </thead>
              <tbody>
                {spend.map((s) => (
                  <tr key={s.id} className="border-t border-[#f0e2c8]">
                    <td className="p-3">{s.day}</td>
                    <td className="p-3 font-semibold text-[#8b1a2b]">
                      {money(s.spend, current?.currency ?? "BGN")}
                    </td>
                    <td className="p-3">{s.impressions}</td>
                    <td className="p-3">{s.clicks}</td>
                    <td className="p-3">{s.leads}</td>
                  </tr>
                ))}
                {!spend.length ? (
                  <tr>
                    <td className="p-6 text-center text-[#7a6a5c]" colSpan={5}>
                      Няма въведени разходи.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="border-t border-[#f0e2c8] p-3 text-sm text-[#3a2b2e]">
              Атрибутирани лийдове: <b>{attrs.length}</b>
            </div>
          </div>
          <aside className="space-y-3 rounded-xl border border-[#e6d3ae] bg-white p-4">
            <h2 className="font-bold text-[#8b1a2b]">Въведи дневен резултат</h2>
            <div>
              <span className={label}>Кампания</span>
              <select
                className={field}
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={label}>Дата</span>
                <input
                  type="date"
                  className={field}
                  value={sp.day}
                  onChange={(e) => setSp({ ...sp, day: e.target.value })}
                />
              </div>
              <div>
                <span className={label}>Разход</span>
                <input
                  className={field}
                  value={sp.spend}
                  onChange={(e) => setSp({ ...sp, spend: e.target.value })}
                />
              </div>
              <div>
                <span className={label}>Импресии</span>
                <input
                  className={field}
                  value={sp.impressions}
                  onChange={(e) => setSp({ ...sp, impressions: e.target.value })}
                />
              </div>
              <div>
                <span className={label}>Кликове</span>
                <input
                  className={field}
                  value={sp.clicks}
                  onChange={(e) => setSp({ ...sp, clicks: e.target.value })}
                />
              </div>
              <div>
                <span className={label}>Лийдове</span>
                <input
                  className={field}
                  value={sp.leads}
                  onChange={(e) => setSp({ ...sp, leads: e.target.value })}
                />
              </div>
            </div>
            <Btn
              disabled={busy || !selected}
              onClick={() =>
                void act(
                  () =>
                    recordAdSpendFn({
                      data: {
                        campaign_id: selected,
                        day: sp.day,
                        spend: Number(sp.spend || 0),
                        impressions: Number(sp.impressions || 0),
                        clicks: Number(sp.clicks || 0),
                        leads: Number(sp.leads || 0),
                      },
                    }),
                  "Записано",
                )
              }
            >
              <Coins className="h-4 w-4" /> Запиши
            </Btn>
          </aside>
        </section>
      ) : null}

      {tab === "budgets" ? (
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
                <tr>
                  <th className="p-3">Месец</th>
                  <th className="p-3">Канал</th>
                  <th className="p-3">План</th>
                  <th className="p-3">Реален</th>
                  <th className="p-3">Усвояване</th>
                </tr>
              </thead>
              <tbody>
                {(board?.budgets ?? []).map((b: any) => {
                  const pct =
                    Number(b.planned) > 0
                      ? Math.round((Number(b.actual) / Number(b.planned)) * 100)
                      : 0;
                  return (
                    <tr key={b.id} className="border-t border-[#f0e2c8]">
                      <td className="p-3">{String(b.period_month).slice(0, 7)}</td>
                      <td className="p-3">
                        {b.channel_code
                          ? (channels.find((c) => c.code === b.channel_code)?.name ??
                            b.channel_code)
                          : "всички"}
                      </td>
                      <td className="p-3">{money(b.planned, b.currency)}</td>
                      <td className="p-3 font-semibold text-[#8b1a2b]">
                        {money(b.actual, b.currency)}
                      </td>
                      <td className="p-3">{pct}%</td>
                    </tr>
                  );
                })}
                {!(board?.budgets ?? []).length ? (
                  <tr>
                    <td className="p-6 text-center text-[#7a6a5c]" colSpan={5}>
                      Няма зададени бюджети.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <aside className="space-y-3 rounded-xl border border-[#e6d3ae] bg-white p-4">
            <h2 className="font-bold text-[#8b1a2b]">Задай бюджет</h2>
            <div>
              <span className={label}>Месец</span>
              <input
                type="month"
                className={field}
                value={bd.period_month}
                onChange={(e) => setBd({ ...bd, period_month: e.target.value })}
              />
            </div>
            <div>
              <span className={label}>Канал</span>
              <select
                className={field}
                value={bd.channel_code}
                onChange={(e) => setBd({ ...bd, channel_code: e.target.value })}
              >
                <option value="">Всички канали</option>
                {channels.map((ch) => (
                  <option key={ch.code} value={ch.code}>
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={label}>Планиран бюджет</span>
              <input
                className={field}
                value={bd.planned}
                onChange={(e) => setBd({ ...bd, planned: e.target.value })}
              />
            </div>
            <Btn
              disabled={busy}
              onClick={() =>
                void act(
                  () =>
                    saveAdBudgetFn({
                      data: {
                        period_month: bd.period_month,
                        channel_code: bd.channel_code || null,
                        planned: Number(bd.planned || 0),
                      },
                    }),
                  "Бюджетът е записан",
                )
              }
            >
              <Wallet className="h-4 w-4" /> Запиши
            </Btn>
          </aside>
        </section>
      ) : null}

      {tab === "analytics" && analytics ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Импресии" value={analytics.kpi.impressions.toLocaleString("bg-BG")} />
            <Kpi
              label="CTR"
              value={`${analytics.kpi.ctr}%`}
              hint={`${analytics.kpi.clicks} кликове`}
            />
            <Kpi label="Лийдове" value={analytics.kpi.leads} />
            <Kpi label="Конверсия лийд→сделка" value={`${analytics.kpi.conversion}%`} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
            <table className="w-full text-sm">
              <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
                <tr>
                  <th className="p-3">Канал</th>
                  <th className="p-3">Разход</th>
                  <th className="p-3">Лийдове</th>
                  <th className="p-3">CPL</th>
                  <th className="p-3">Сделки</th>
                  <th className="p-3">Приход</th>
                </tr>
              </thead>
              <tbody>
                {analytics.by_channel.map((r: any) => (
                  <tr key={r.channel} className="border-t border-[#f0e2c8]">
                    <td className="p-3 font-semibold text-[#3a2b2e]">
                      {channels.find((c) => c.code === r.channel)?.name ?? r.channel}
                    </td>
                    <td className="p-3">{money(r.spend)}</td>
                    <td className="p-3">{r.leads}</td>
                    <td className="p-3">{r.leads > 0 ? money(r.spend / r.leads) : "—"}</td>
                    <td className="p-3">{r.deals}</td>
                    <td className="p-3">{money(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#8b1a2b]">AI бюджетен анализ</h2>
              <Btn
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r: any = await generateBudgetAdviceFn();
                    setAdvice(r?.advice ?? "");
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Sparkles className="h-4 w-4" /> Анализирай
              </Btn>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-[#3a2b2e]">
              {advice || "Натисни „Анализирай“ за препоръки за преразпределение на бюджета."}
            </p>
          </div>
        </section>
      ) : null}

      {tab === "log" ? (
        <section className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
              <tr>
                <th className="p-3">Дата</th>
                <th className="p-3">Тип</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Съобщение</th>
              </tr>
            </thead>
            <tbody>
              {(board?.events ?? []).map((e: any) => (
                <tr key={e.id} className="border-t border-[#f0e2c8]">
                  <td className="p-3">{dt(e.created_at)}</td>
                  <td className="p-3">{e.event_type}</td>
                  <td className="p-3">{e.status}</td>
                  <td className="p-3 text-[#3a2b2e]">{e.message ?? "—"}</td>
                </tr>
              ))}
              {!(board?.events ?? []).length ? (
                <tr>
                  <td className="p-6 text-center text-[#7a6a5c]" colSpan={4}>
                    Няма записи.
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
