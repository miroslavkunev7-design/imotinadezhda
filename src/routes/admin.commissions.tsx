import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Calculator,
  FileText,
  PlayCircle,
  Percent,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  addCommissionSplitFn,
  calculateCommissionFn,
  generateCommissionSummaryFn,
  getCommissionAnalyticsFn,
  getCommissionConfig,
  issueCommissionInvoiceFn,
  listCommissionDealsFn,
  listCommissionEventsFn,
  listCommissionPayoutsFn,
  listCommissionRulesFn,
  listCommissionSplitsFn,
  listCommissions,
  registerCommissionPayoutFn,
  removeCommissionSplitFn,
  resumeCommissionJobFn,
  runCommissionSweepNow,
  saveCommissionConfig,
  saveCommissionRuleFn,
  setCommissionStatusFn,
} from "@/lib/commissions.functions";

export const Route = createFileRoute("/admin/commissions")({ component: CommissionsAdmin });

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");
const money = (v: unknown, cur = "EUR") =>
  `${Number(v ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

const STATUS_LABEL: Record<string, string> = {
  draft: "чернова",
  calculated: "изчислена",
  approved: "одобрена",
  invoiced: "фактурирана",
  paid: "платена",
  cancelled: "отказана",
};
const STATUS_CLASS: Record<string, string> = {
  draft: "bg-stone-200 text-stone-800",
  calculated: "bg-sky-100 text-sky-900",
  approved: "bg-amber-100 text-amber-900",
  invoiced: "bg-indigo-100 text-indigo-900",
  paid: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-rose-100 text-rose-900",
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

function CommissionsAdmin() {
  const [tab, setTab] = useState<"list" | "calc" | "payouts" | "rules" | "analytics" | "log">(
    "list",
  );
  const [rows, setRows] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>("");

  const [dealId, setDealId] = useState("");
  const [ruleCode, setRuleCode] = useState("");
  const [baseOverride, setBaseOverride] = useState("");

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank");
  const [payRef, setPayRef] = useState("");

  const [splitRole, setSplitRole] = useState("co_broker");
  const [splitName, setSplitName] = useState("");
  const [splitShare, setSplitShare] = useState("10");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [c, d, r, p, e, a, conf] = await Promise.all([
        listCommissions({ data: {} }),
        listCommissionDealsFn(),
        listCommissionRulesFn(),
        listCommissionPayoutsFn(),
        listCommissionEventsFn(),
        getCommissionAnalyticsFn(),
        getCommissionConfig(),
      ]);
      setRows(c as any[]);
      setDeals(d as any[]);
      setRules(r as any[]);
      setPayouts(p as any[]);
      setEvents(e as any[]);
      setAnalytics(a);
      setCfg((conf as any).settings);
      setJob((conf as any).job);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSplits = useCallback(async (commissionId: string) => {
    try {
      setSplits((await listCommissionSplitsFn({ data: { commissionId } })) as any[]);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (selected) void loadSplits(selected);
    else setSplits([]);
  }, [selected, loadSplits]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
      if (selected) await loadSplits(selected);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.deals?.deal_number,
        r.deals?.title,
        r.invoice_number,
        r.rule_code,
        r.brokers?.full_name,
        STATUS_LABEL[r.status],
      ]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, query]);

  const current = rows.find((r) => r.id === selected);

  return (
    <div data-crm-themed className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#8b1a2b]">
            <Percent className="h-6 w-6" /> Комисионни — автоматично изчисляване и отчети
          </h1>
          <p className="text-sm text-[#5b4a44]">
            Автоматизация №17 · правила, ДДС, разпределение между брокери, фактури, изплащания и
            анализ.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn tone="ghost" onClick={() => void load()} disabled={busy}>
            <RefreshCw className="h-4 w-4" /> Обнови
          </Btn>
          <Btn
            onClick={() =>
              void act(() => runCommissionSweepNow({ data: {} }), "Обходът е изпълнен")
            }
            disabled={busy}
          >
            <PlayCircle className="h-4 w-4" /> Пусни обхода
          </Btn>
          <Btn tone="ghost" onClick={() => setShowCfg((v) => !v)}>
            <Settings2 className="h-4 w-4" /> Настройки
          </Btn>
        </div>
      </header>

      {job?.paused ? (
        <div className="flex items-center justify-between rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          <span>Задачата е на пауза: {job.paused_reason ?? "неизвестна причина"}</span>
          <Btn
            tone="ghost"
            onClick={() => void act(() => resumeCommissionJobFn(), "Задачата е възобновена")}
          >
            Възобнови
          </Btn>
        </div>
      ) : null}

      {showCfg && cfg ? (
        <div className="grid gap-3 rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4 md:grid-cols-3">
          {[
            ["enabled", "Модулът е активен"],
            ["ai_enabled", "AI резюмета"],
            ["auto_calculate_won_deals", "Авто изчисляване при спечелена сделка"],
            ["auto_approve", "Авто одобрение"],
            ["vat_registered", "Регистрация по ДДС"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm font-medium text-[#3a2b2e]">
              <input
                type="checkbox"
                checked={Boolean(cfg[key])}
                onChange={(ev) => setCfg({ ...cfg, [key]: ev.target.checked })}
              />
              {label}
            </label>
          ))}
          {[
            ["default_vat_percent", "ДДС %"],
            ["batch_size", "Партида (сделки)"],
            ["invoice_prefix", "Префикс фактури"],
            ["default_currency", "Валута"],
          ].map(([key, label]) => (
            <label key={key} className="text-sm font-medium text-[#3a2b2e]">
              {label}
              <input
                className="mt-1 w-full rounded-lg border border-[#e6d3ae] bg-white px-3 py-2 text-[#3a2b2e]"
                value={String(cfg[key] ?? "")}
                onChange={(ev) =>
                  setCfg({
                    ...cfg,
                    [key]:
                      key === "invoice_prefix" || key === "default_currency"
                        ? ev.target.value
                        : Number(ev.target.value),
                  })
                }
              />
            </label>
          ))}
          <div className="md:col-span-3">
            <Btn
              onClick={() =>
                void act(() => saveCommissionConfig({ data: cfg }), "Настройките са запазени")
              }
              disabled={busy}
            >
              Запази настройките
            </Btn>
          </div>
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-2">
        {(
          [
            ["list", "Комисионни", Wallet],
            ["calc", "Ново изчисление", Calculator],
            ["payouts", "Изплащания", FileText],
            ["rules", "Правила", Percent],
            ["analytics", "Анализ", BarChart3],
            ["log", "Журнал", Sparkles],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === key
                ? "bg-[#8b1a2b] text-white"
                : "border border-[#e6d3ae] bg-white text-[#8b1a2b]"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>

      {tab === "list" ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#e6d3ae] bg-white px-3 py-2">
            <Search className="h-4 w-4 text-[#8b1a2b]" />
            <input
              className="w-full bg-transparent text-sm text-[#3a2b2e] outline-none"
              placeholder="Търси по сделка, фактура, брокер…"
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
                <tr>
                  {[
                    "Сделка",
                    "База",
                    "Комисионна",
                    "ДДС",
                    "Общо",
                    "Брокер / Агенция",
                    "Статус",
                    "Платено",
                    "Действия",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-t border-[#f0e2c8] text-[#3a2b2e] ${selected === r.id ? "bg-[#fdf7ec]" : ""}`}
                    onClick={() => setSelected(r.id)}
                  >
                    <td className="px-3 py-2">
                      <div className="font-semibold">{r.deals?.deal_number ?? "—"}</div>
                      <div className="text-xs text-[#7a6a5c]">{r.deals?.title ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2">{money(r.base_amount, r.currency)}</td>
                    <td className="px-3 py-2">
                      {money(r.gross_amount, r.currency)}
                      {r.percent ? (
                        <span className="ml-1 text-xs text-[#7a6a5c]">({r.percent}%)</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{money(r.vat_amount, r.currency)}</td>
                    <td className="px-3 py-2 font-semibold">{money(r.total_amount, r.currency)}</td>
                    <td className="px-3 py-2 text-xs">
                      {money(r.broker_amount, r.currency)} / {money(r.agency_amount, r.currency)}
                      <div className="text-[#7a6a5c]">{r.brokers?.full_name ?? "без брокер"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CLASS[r.status] ?? "bg-stone-200 text-stone-800"}`}
                      >
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                      {r.invoice_number ? (
                        <div className="mt-1 text-xs text-[#7a6a5c]">{r.invoice_number}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{money(r.paid_amount, r.currency)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Btn
                          tone="ghost"
                          onClick={() =>
                            void act(
                              () =>
                                setCommissionStatusFn({
                                  data: { commissionId: r.id, status: "approved" },
                                }),
                              "Одобрена",
                            )
                          }
                          disabled={busy}
                        >
                          Одобри
                        </Btn>
                        <Btn
                          tone="ghost"
                          onClick={() =>
                            void act(
                              () => issueCommissionInvoiceFn({ data: { commissionId: r.id } }),
                              "Издадена фактура",
                            )
                          }
                          disabled={busy}
                        >
                          Фактура
                        </Btn>
                        <Btn
                          tone="ghost"
                          onClick={() =>
                            void act(
                              () => generateCommissionSummaryFn({ data: { commissionId: r.id } }),
                              "AI резюме е готово",
                            )
                          }
                          disabled={busy}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-[#7a6a5c]">
                      Няма изчислени комисионни.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {current ? (
            <div className="grid gap-4 rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4 md:grid-cols-2">
              <div>
                <h3 className="font-semibold text-[#8b1a2b]">Разпределение</h3>
                <p className="text-xs text-[#7a6a5c]">{current.calc_note}</p>
                <ul className="mt-2 space-y-1 text-sm text-[#3a2b2e]">
                  {splits.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                    >
                      <span>
                        {s.role} · {s.brokers?.full_name ?? s.name ?? "—"} · {s.share_percent}% ·{" "}
                        {money(s.amount, current.currency)} ({s.status})
                      </span>
                      <div className="flex gap-1">
                        <Btn
                          tone="ghost"
                          onClick={() =>
                            void act(
                              () =>
                                registerCommissionPayoutFn({
                                  data: {
                                    commissionId: current.id,
                                    splitId: s.id,
                                    amount: Number(s.amount),
                                    method: payMethod,
                                  },
                                }),
                              "Изплащането е записано",
                            )
                          }
                          disabled={busy}
                        >
                          Плати
                        </Btn>
                        <Btn
                          tone="ghost"
                          onClick={() =>
                            void act(
                              () => removeCommissionSplitFn({ data: { splitId: s.id } }),
                              "Изтрито",
                            )
                          }
                          disabled={busy}
                        >
                          ✕
                        </Btn>
                      </div>
                    </li>
                  ))}
                  {!splits.length ? <li className="text-[#7a6a5c]">Няма записи.</li> : null}
                </ul>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-xs font-medium text-[#3a2b2e]">
                    Роля
                    <select
                      className="mt-1 block rounded-lg border border-[#e6d3ae] bg-white px-2 py-2 text-sm text-[#3a2b2e]"
                      value={splitRole}
                      onChange={(ev) => setSplitRole(ev.target.value)}
                    >
                      <option value="co_broker">Съ-брокер</option>
                      <option value="referral">Препоръчал</option>
                      <option value="agency">Агенция</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-[#3a2b2e]">
                    Име
                    <input
                      className="mt-1 block rounded-lg border border-[#e6d3ae] bg-white px-2 py-2 text-sm text-[#3a2b2e]"
                      value={splitName}
                      onChange={(ev) => setSplitName(ev.target.value)}
                    />
                  </label>
                  <label className="text-xs font-medium text-[#3a2b2e]">
                    Дял %
                    <input
                      className="mt-1 block w-20 rounded-lg border border-[#e6d3ae] bg-white px-2 py-2 text-sm text-[#3a2b2e]"
                      value={splitShare}
                      onChange={(ev) => setSplitShare(ev.target.value)}
                    />
                  </label>
                  <Btn
                    onClick={() =>
                      void act(
                        () =>
                          addCommissionSplitFn({
                            data: {
                              commissionId: current.id,
                              role: splitRole,
                              name: splitName || null,
                              sharePercent: Number(splitShare) || 0,
                            },
                          }),
                        "Добавен участник",
                      )
                    }
                    disabled={busy}
                  >
                    Добави дял
                  </Btn>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[#8b1a2b]">Плащане</h3>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label className="text-xs font-medium text-[#3a2b2e]">
                    Сума
                    <input
                      className="mt-1 block w-28 rounded-lg border border-[#e6d3ae] bg-white px-2 py-2 text-sm text-[#3a2b2e]"
                      value={payAmount}
                      onChange={(ev) => setPayAmount(ev.target.value)}
                    />
                  </label>
                  <label className="text-xs font-medium text-[#3a2b2e]">
                    Начин
                    <select
                      className="mt-1 block rounded-lg border border-[#e6d3ae] bg-white px-2 py-2 text-sm text-[#3a2b2e]"
                      value={payMethod}
                      onChange={(ev) => setPayMethod(ev.target.value)}
                    >
                      <option value="bank">Банка</option>
                      <option value="cash">Каса</option>
                      <option value="other">Друго</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-[#3a2b2e]">
                    Основание
                    <input
                      className="mt-1 block rounded-lg border border-[#e6d3ae] bg-white px-2 py-2 text-sm text-[#3a2b2e]"
                      value={payRef}
                      onChange={(ev) => setPayRef(ev.target.value)}
                    />
                  </label>
                  <Btn
                    onClick={() =>
                      void act(
                        () =>
                          registerCommissionPayoutFn({
                            data: {
                              commissionId: current.id,
                              amount: Number(payAmount) || 0,
                              method: payMethod,
                              reference: payRef || null,
                            },
                          }),
                        "Плащането е записано",
                      )
                    }
                    disabled={busy}
                  >
                    Запиши плащане
                  </Btn>
                </div>
                {current.ai_summary ? (
                  <div className="mt-4 rounded-lg bg-white p-3 text-sm text-[#3a2b2e]">
                    <div className="mb-1 font-semibold text-[#8b1a2b]">AI резюме</div>
                    {current.ai_summary}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "calc" ? (
        <section className="grid gap-3 rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4 md:grid-cols-4">
          <label className="text-sm font-medium text-[#3a2b2e] md:col-span-2">
            Сделка
            <select
              className="mt-1 w-full rounded-lg border border-[#e6d3ae] bg-white px-3 py-2 text-[#3a2b2e]"
              value={dealId}
              onChange={(ev) => setDealId(ev.target.value)}
            >
              <option value="">— избери сделка —</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {(d.deal_number ?? "—") +
                    " · " +
                    d.title +
                    " · " +
                    money(d.agreed_price ?? d.price, d.currency ?? "EUR")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[#3a2b2e]">
            Правило (по избор)
            <select
              className="mt-1 w-full rounded-lg border border-[#e6d3ae] bg-white px-3 py-2 text-[#3a2b2e]"
              value={ruleCode}
              onChange={(ev) => setRuleCode(ev.target.value)}
            >
              <option value="">авто по правила</option>
              {rules.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-[#3a2b2e]">
            База (ръчно)
            <input
              className="mt-1 w-full rounded-lg border border-[#e6d3ae] bg-white px-3 py-2 text-[#3a2b2e]"
              value={baseOverride}
              onChange={(ev) => setBaseOverride(ev.target.value)}
            />
          </label>
          <div className="md:col-span-4">
            <Btn
              onClick={() =>
                void act(
                  () =>
                    calculateCommissionFn({
                      data: {
                        dealId,
                        ruleCode: ruleCode || null,
                        baseOverride: baseOverride ? Number(baseOverride) : null,
                      },
                    }),
                  "Комисионната е изчислена",
                )
              }
              disabled={busy || !dealId}
            >
              <Calculator className="h-4 w-4" /> Изчисли
            </Btn>
          </div>
        </section>
      ) : null}

      {tab === "payouts" ? (
        <div className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
              <tr>
                {["Дата", "Брокер", "Сума", "Начин", "Основание", "Период"].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-t border-[#f0e2c8] text-[#3a2b2e]">
                  <td className="px-3 py-2">{dt(p.paid_at)}</td>
                  <td className="px-3 py-2">{p.brokers?.full_name ?? "—"}</td>
                  <td className="px-3 py-2 font-semibold">{money(p.amount, p.currency)}</td>
                  <td className="px-3 py-2">{p.method}</td>
                  <td className="px-3 py-2">{p.reference ?? "—"}</td>
                  <td className="px-3 py-2">{p.period_month ?? "—"}</td>
                </tr>
              ))}
              {!payouts.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[#7a6a5c]">
                    Няма изплащания.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "rules" ? (
        <div className="space-y-3">
          {rules.map((r) => (
            <div
              key={r.code}
              className="grid gap-2 rounded-xl border border-[#e6d3ae] bg-white p-4 md:grid-cols-6"
            >
              <div className="md:col-span-2">
                <div className="font-semibold text-[#8b1a2b]">{r.name}</div>
                <div className="text-xs text-[#7a6a5c]">
                  {r.code} · {r.deal_type} · {r.basis}
                </div>
              </div>
              {[
                ["percent", "%"],
                ["fixed_amount", "Фикс"],
                ["rent_months", "Наеми"],
                ["min_amount", "Мин."],
                ["broker_share_percent", "Брокер %"],
              ].map(([key, label]) => (
                <label key={key} className="text-xs font-medium text-[#3a2b2e]">
                  {label}
                  <input
                    className="mt-1 w-full rounded-lg border border-[#e6d3ae] bg-white px-2 py-1 text-[#3a2b2e]"
                    value={String(r[key] ?? "")}
                    onChange={(ev) =>
                      setRules(
                        rules.map((x) =>
                          x.code === r.code
                            ? {
                                ...x,
                                [key]: ev.target.value === "" ? null : Number(ev.target.value),
                              }
                            : x,
                        ),
                      )
                    }
                  />
                </label>
              ))}
              <div className="md:col-span-6">
                <Btn
                  onClick={() =>
                    void act(
                      () =>
                        saveCommissionRuleFn({
                          data: {
                            ...r,
                            agency_share_percent: 100 - Number(r.broker_share_percent ?? 50),
                          },
                        }),
                      "Правилото е запазено",
                    )
                  }
                  disabled={busy}
                >
                  Запази
                </Btn>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "analytics" && analytics ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Kpi label="Комисионни (бр.)" value={analytics.total} />
            <Kpi
              label="Общо без ДДС"
              value={money(analytics.gross)}
              hint={`ДДС: ${money(analytics.vat)}`}
            />
            <Kpi
              label="Платено"
              value={money(analytics.paid)}
              hint={`Остава: ${money(analytics.outstanding)}`}
            />
            <Kpi
              label="Средно на сделка"
              value={money(analytics.avg)}
              hint={`Брокери: ${money(analytics.broker)} · Агенция: ${money(analytics.agency)}`}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
              <h3 className="mb-2 font-semibold text-[#8b1a2b]">По месеци</h3>
              <ul className="space-y-1 text-sm text-[#3a2b2e]">
                {analytics.months.map((m: any) => (
                  <li key={m.month} className="flex justify-between">
                    <span>{m.month}</span>
                    <span>
                      {money(m.gross)} · платено {money(m.paid)} · {m.count} бр.
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
              <h3 className="mb-2 font-semibold text-[#8b1a2b]">По брокери</h3>
              <ul className="space-y-1 text-sm text-[#3a2b2e]">
                {analytics.brokers.map((b: any) => (
                  <li key={b.broker_id} className="flex justify-between">
                    <span>{b.name}</span>
                    <span>
                      {money(b.gross)} · дял {money(b.broker)} · {b.count} бр.
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "log" ? (
        <div className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
              <tr>
                {["Кога", "Действие", "Статус", "Съобщение", "Автор"].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-[#f0e2c8] text-[#3a2b2e]">
                  <td className="px-3 py-2">{dt(e.created_at)}</td>
                  <td className="px-3 py-2">{e.action}</td>
                  <td className="px-3 py-2">{e.status}</td>
                  <td className="px-3 py-2">{e.message ?? "—"}</td>
                  <td className="px-3 py-2">{e.actor ?? "—"}</td>
                </tr>
              ))}
              {!events.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[#7a6a5c]">
                    Няма записи.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
