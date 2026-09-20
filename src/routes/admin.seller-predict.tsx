import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Brain,
  Flame,
  PlayCircle,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  addSellerSignalFn,
  deleteSellerProspectFn,
  discoverSellersFn,
  generateSellerMessageFn,
  getSellerBoard,
  logSellerOutreachFn,
  predictSellerFn,
  removeSellerSignalFn,
  rescoreSellersFn,
  resumeSellerJobFn,
  runSellerSweepNow,
  saveSellerProspectFn,
  saveSellerRuleFn,
  saveSellerSettingsFn,
  scoreSellerProspectFn,
  setSellerProspectStatusFn,
} from "@/lib/seller-predict.functions";

export const Route = createFileRoute("/admin/seller-predict")({ component: SellerPredictAdmin });

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");
const money = (v: unknown, cur = "EUR") =>
  `${Number(v ?? 0).toLocaleString("bg-BG", { maximumFractionDigits: 0 })} ${cur}`;

const STATUS_LABEL: Record<string, string> = {
  new: "нов",
  scored: "оценен",
  contacted: "контактуван",
  meeting: "среща",
  listing_won: "спечелен договор",
  not_interested: "не желае",
  lost: "загубен",
};
const STATUS_CLASS: Record<string, string> = {
  new: "bg-stone-200 text-stone-800",
  scored: "bg-sky-100 text-sky-900",
  contacted: "bg-amber-100 text-amber-900",
  meeting: "bg-indigo-100 text-indigo-900",
  listing_won: "bg-emerald-100 text-emerald-900",
  not_interested: "bg-rose-100 text-rose-900",
  lost: "bg-rose-100 text-rose-900",
};

const CHANNELS = [
  { code: "phone", label: "Телефон" },
  { code: "sms", label: "SMS" },
  { code: "email", label: "Имейл" },
  { code: "viber", label: "Viber" },
  { code: "letter", label: "Писмо" },
  { code: "visit", label: "Посещение" },
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
      : "border border-[#e6d3ae]/60 bg-[rgba(255,255,255,0.10)] text-[#ffe9c2] hover:bg-[rgba(255,255,255,0.18)]";
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

function ScoreBar({ score, hot, warm }: { score: number; hot: number; warm: number }) {
  const color = score >= hot ? "bg-[#8b1a2b]" : score >= warm ? "bg-[#c9a84c]" : "bg-stone-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-[#eadfc9]">
        <div
          className={`h-full ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-sm font-bold text-[#8b1a2b]">{score}</span>
    </div>
  );
}

function SellerPredictAdmin() {
  const [tab, setTab] = useState<"list" | "detail" | "rules" | "analytics" | "log">("list");
  const [board, setBoard] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [showCfg, setShowCfg] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [form, setForm] = useState<Record<string, string>>({});
  const [signalCode, setSignalCode] = useState("");
  const [channel, setChannel] = useState("phone");
  const [message, setMessage] = useState("");
  const [outcome, setOutcome] = useState("");

  const load = useCallback(async () => {
    try {
      setBusy(true);
      const data = await getSellerBoard();
      setBoard(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const settings = board?.settings ?? {};
  const prospects: any[] = board?.prospects ?? [];
  const analytics = board?.analytics;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prospects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.full_name, p.phone, p.email, p.city, p.district, p.address].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(q),
      );
    });
  }, [prospects, query, statusFilter]);

  const current = useMemo(
    () => prospects.find((p) => p.id === selected) ?? null,
    [prospects, selected],
  );
  const currentSignals = useMemo(
    () => (board?.signals ?? []).filter((s: any) => s.prospect_id === selected),
    [board, selected],
  );
  const currentOutreach = useMemo(
    () => (board?.outreach ?? []).filter((o: any) => o.prospect_id === selected),
    [board, selected],
  );

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      setBusy(true);
      await fn();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-crm-themed className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[#8b1a2b]">
            <Target className="h-6 w-6" /> AI Прогнозиране на Продавачи
          </h1>
          <p className="text-sm text-[#5b4a44]">
            Автоматизация №19 — откриване на потенциални продавачи, скоринг по сигнали и AI подход
            за контакт.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn tone="ghost" onClick={() => void load()} disabled={busy}>
            <RefreshCw className="h-4 w-4" /> Опресни
          </Btn>
          <Btn
            tone="ghost"
            onClick={() => act(() => discoverSellersFn(), "Сканирането е готово")}
            disabled={busy}
          >
            <Search className="h-4 w-4" /> Открий кандидати
          </Btn>
          <Btn
            tone="ghost"
            onClick={() => act(() => rescoreSellersFn(), "Скоровете са преизчислени")}
            disabled={busy}
          >
            <Brain className="h-4 w-4" /> Преизчисли скор
          </Btn>
          <Btn
            onClick={() => act(() => runSellerSweepNow(), "Автоматизацията е пусната")}
            disabled={busy}
          >
            <PlayCircle className="h-4 w-4" /> Пусни сега
          </Btn>
          <Btn tone="ghost" onClick={() => setShowCfg((v) => !v)}>
            <Settings2 className="h-4 w-4" /> Настройки
          </Btn>
        </div>
      </header>

      {board?.job?.paused ? (
        <div className="flex items-center justify-between rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          <span>Автоматизацията е на пауза: {board.job.paused_reason ?? "без причина"}</span>
          <Btn tone="ghost" onClick={() => act(() => resumeSellerJobFn(), "Възобновено")}>
            Възобнови
          </Btn>
        </div>
      ) : null}

      {showCfg ? (
        <section className="rounded-xl border border-[#e6d3ae] bg-white p-4">
          <h2 className="mb-3 text-lg font-bold text-[#8b1a2b]">Настройки на модула</h2>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { key: "hot_threshold", label: "Праг „горещ“ (скор)" },
              { key: "warm_threshold", label: "Праг „топъл“ (скор)" },
              { key: "batch_size", label: "Партида при sweep" },
              { key: "follow_up_days", label: "Дни до следващ контакт" },
            ].map((f) => (
              <label key={f.key} className="text-sm font-medium text-[#3a2b2e]">
                {f.label}
                <input
                  className={`${inputCls} mt-1`}
                  type="number"
                  defaultValue={String(settings[f.key] ?? "")}
                  onBlur={(e) =>
                    act(
                      () => saveSellerSettingsFn({ data: { [f.key]: Number(e.target.value) } }),
                      "Записано",
                    )
                  }
                />
              </label>
            ))}
            {[
              { key: "enabled", label: "Модулът е активен" },
              { key: "ai_enabled", label: "AI е активен" },
              { key: "auto_score_new", label: "Авто-скор на нови" },
              { key: "auto_assign_broker", label: "Авто-възлагане на брокер" },
            ].map((f) => (
              <label
                key={f.key}
                className="flex items-center gap-2 text-sm font-medium text-[#3a2b2e]"
              >
                <input
                  type="checkbox"
                  checked={Boolean(settings[f.key])}
                  onChange={(e) =>
                    act(
                      () => saveSellerSettingsFn({ data: { [f.key]: e.target.checked } }),
                      "Записано",
                    )
                  }
                />
                {f.label}
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#7a6a5c]">
            Cron: <code>/api/public/hooks/seller-prediction</code> (заглавка{" "}
            <code>x-cron-secret</code>). Последно пускане: {dt(board?.job?.last_run_at)}
          </p>
        </section>
      ) : null}

      {analytics ? (
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Kpi label="Общо кандидати" value={analytics.kpi.total} />
          <Kpi
            label="Горещи"
            value={analytics.kpi.hot}
            hint={`скор ≥ ${analytics.kpi.hot_threshold}`}
          />
          <Kpi
            label="Топли"
            value={analytics.kpi.warm}
            hint={`скор ≥ ${analytics.kpi.warm_threshold}`}
          />
          <Kpi label="Контактувани" value={analytics.kpi.contacted} />
          <Kpi label="Спечелени договори" value={analytics.kpi.won} />
          <Kpi label="Среден скор" value={analytics.kpi.avg_score} />
          <Kpi label="Конверсия" value={`${analytics.kpi.conversion}%`} />
          <Kpi label="Прогнозен обем" value={money(analytics.kpi.pipeline_value)} />
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-2 border-b border-[#e6d3ae] pb-2">
        {(
          [
            ["list", "Кандидати"],
            ["detail", "Карта на продавача"],
            ["rules", "Сигнали и тегла"],
            ["analytics", "Анализи"],
            ["log", "Журнал"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === k ? "bg-[#8b1a2b] text-white" : "text-[#8b1a2b] hover:bg-[#fdf7ec]"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "list" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inputCls} max-w-xs`}
              placeholder="Търси по име, телефон, град…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className={`${inputCls} max-w-[220px]`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Всички статуси</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <Btn onClick={() => setShowNew((v) => !v)}>
              <UserPlus className="h-4 w-4" /> Нов кандидат
            </Btn>
          </div>

          {showNew ? (
            <div className="grid gap-3 rounded-xl border border-[#e6d3ae] bg-white p-4 md:grid-cols-4">
              {[
                ["full_name", "Име"],
                ["phone", "Телефон"],
                ["email", "Имейл"],
                ["city", "Град"],
                ["district", "Квартал"],
                ["address", "Адрес"],
                ["area", "Площ (м²)"],
                ["rooms", "Стаи"],
                ["build_year", "Година"],
                ["estimated_price", "Прогнозна цена"],
                ["ownership_years", "Години собственост"],
              ].map(([k, label]) => (
                <label key={k} className="text-sm font-medium text-[#3a2b2e]">
                  {label}
                  <input
                    className={`${inputCls} mt-1`}
                    value={form[k] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  />
                </label>
              ))}
              <label className="text-sm font-medium text-[#3a2b2e]">
                Тип имот
                <select
                  className={`${inputCls} mt-1`}
                  value={form.property_type ?? "apartment"}
                  onChange={(e) => setForm((f) => ({ ...f, property_type: e.target.value }))}
                >
                  <option value="apartment">Апартамент</option>
                  <option value="house">Къща</option>
                  <option value="land">Земя</option>
                  <option value="office">Офис</option>
                  <option value="shop">Магазин</option>
                </select>
              </label>
              <div className="flex items-end">
                <Btn
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await saveSellerProspectFn({
                        data: {
                          ...form,
                          area: form.area ? Number(form.area) : null,
                          rooms: form.rooms ? Number(form.rooms) : null,
                          build_year: form.build_year ? Number(form.build_year) : null,
                          estimated_price: form.estimated_price
                            ? Number(form.estimated_price)
                            : null,
                          ownership_years: form.ownership_years
                            ? Number(form.ownership_years)
                            : null,
                        },
                      });
                      setForm({});
                      setShowNew(false);
                    }, "Кандидатът е записан")
                  }
                >
                  <Save className="h-4 w-4" /> Запиши
                </Btn>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
                <tr>
                  {[
                    "Собственик",
                    "Имот",
                    "Скор",
                    "Вероятност",
                    "Хоризонт",
                    "Статус",
                    "Последен контакт",
                    "Действия",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t border-[#f0e4cd] text-[#3a2b2e]">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-[#8b1a2b]">{p.full_name ?? "—"}</div>
                      <div className="text-xs text-[#7a6a5c]">{p.phone ?? p.email ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{[p.city, p.district].filter(Boolean).join(", ") || "—"}</div>
                      <div className="text-xs text-[#7a6a5c]">
                        {[p.property_type, p.area ? `${p.area} м²` : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <ScoreBar
                        score={Number(p.score ?? 0)}
                        hot={Number(settings.hot_threshold ?? 70)}
                        warm={Number(settings.warm_threshold ?? 45)}
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      {p.probability != null ? `${Number(p.probability).toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-3 py-2">{p.expected_window ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${STATUS_CLASS[p.status] ?? "bg-stone-200 text-stone-800"}`}
                      >
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{dt(p.last_contacted_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Btn
                          tone="ghost"
                          onClick={() => {
                            setSelected(p.id);
                            setTab("detail");
                          }}
                        >
                          Отвори
                        </Btn>
                        <Btn
                          tone="ghost"
                          disabled={busy}
                          onClick={() =>
                            act(() => scoreSellerProspectFn({ data: { id: p.id } }), "Преизчислено")
                          }
                        >
                          <Brain className="h-4 w-4" />
                        </Btn>
                        <Btn
                          tone="ghost"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () => predictSellerFn({ data: { id: p.id } }),
                              "AI прогнозата е готова",
                            )
                          }
                        >
                          <Sparkles className="h-4 w-4" />
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-[#7a6a5c]" colSpan={8}>
                      Няма кандидати. Стартирайте „Открий кандидати“ или добавете ръчно.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "detail" ? (
        current ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-[#e6d3ae] bg-white p-4">
              <h2 className="text-lg font-bold text-[#8b1a2b]">
                {current.full_name ?? "Собственик"}
              </h2>
              <div className="grid gap-2 text-sm text-[#3a2b2e] md:grid-cols-2">
                <div>
                  Телефон: <b>{current.phone ?? "—"}</b>
                </div>
                <div>
                  Имейл: <b>{current.email ?? "—"}</b>
                </div>
                <div>
                  Град: <b>{current.city ?? "—"}</b>
                </div>
                <div>
                  Квартал: <b>{current.district ?? "—"}</b>
                </div>
                <div>
                  Площ: <b>{current.area ?? "—"}</b>
                </div>
                <div>
                  Прогнозна цена: <b>{money(current.estimated_price, current.currency ?? "EUR")}</b>
                </div>
                <div>
                  Собственост: <b>{current.ownership_years ?? "—"} г.</b>
                </div>
                <div>
                  Източник: <b>{current.source}</b>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ScoreBar
                  score={Number(current.score ?? 0)}
                  hot={Number(settings.hot_threshold ?? 70)}
                  warm={Number(settings.warm_threshold ?? 45)}
                />
                <span className="text-sm font-semibold text-[#3a2b2e]">
                  {current.probability != null ? `${Number(current.probability).toFixed(0)}%` : "—"}{" "}
                  · {current.expected_window ?? "—"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  className={`${inputCls} max-w-[220px]`}
                  value={current.status}
                  onChange={(e) =>
                    act(
                      () =>
                        setSellerProspectStatusFn({
                          data: { id: current.id, status: e.target.value },
                        }),
                      "Статусът е обновен",
                    )
                  }
                >
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <Btn
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => predictSellerFn({ data: { id: current.id } }),
                      "AI прогнозата е готова",
                    )
                  }
                >
                  <Sparkles className="h-4 w-4" /> AI прогноза
                </Btn>
                <Btn
                  tone="ghost"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () =>
                        deleteSellerProspectFn({ data: { id: current.id } }).then(() =>
                          setSelected(""),
                        ),
                      "Изтрито",
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" /> Изтрий
                </Btn>
              </div>

              {current.ai_reasoning ? (
                <div className="rounded-lg border border-[#e6d3ae] bg-[#fdf7ec] p-3 text-sm text-[#3a2b2e]">
                  <div className="mb-1 font-bold text-[#8b1a2b]">AI анализ</div>
                  <p className="whitespace-pre-wrap">{current.ai_reasoning}</p>
                  {current.ai_pitch ? (
                    <>
                      <div className="mt-2 font-bold text-[#8b1a2b]">Подход за контакт</div>
                      <p className="whitespace-pre-wrap">{current.ai_pitch}</p>
                    </>
                  ) : null}
                  <div className="mt-2 text-xs text-[#7a6a5c]">
                    Обновено: {dt(current.ai_updated_at)}
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-[#e6d3ae] p-3">
                <div className="mb-2 font-bold text-[#8b1a2b]">Сигнали</div>
                <div className="flex flex-wrap gap-2">
                  <select
                    className={`${inputCls} max-w-[260px]`}
                    value={signalCode}
                    onChange={(e) => setSignalCode(e.target.value)}
                  >
                    <option value="">Избери сигнал…</option>
                    {(board?.rules ?? []).map((r: any) => (
                      <option key={r.code} value={r.code}>
                        {r.label} (+{r.weight})
                      </option>
                    ))}
                  </select>
                  <Btn
                    disabled={busy || !signalCode}
                    onClick={() =>
                      act(
                        () =>
                          addSellerSignalFn({
                            data: { prospect_id: current.id, signal_code: signalCode },
                          }),
                        "Сигналът е добавен",
                      )
                    }
                  >
                    <Flame className="h-4 w-4" /> Добави
                  </Btn>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-[#3a2b2e]">
                  {currentSignals.map((s: any) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded border border-[#f0e4cd] px-2 py-1"
                    >
                      <span>
                        {(board?.rules ?? []).find((r: any) => r.code === s.signal_code)?.label ??
                          s.signal_code}{" "}
                        · +{s.weight}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-700"
                        onClick={() =>
                          act(() => removeSellerSignalFn({ data: { id: s.id } }), "Премахнато")
                        }
                      >
                        премахни
                      </button>
                    </li>
                  ))}
                  {currentSignals.length === 0 ? (
                    <li className="text-[#7a6a5c]">Няма сигнали.</li>
                  ) : null}
                </ul>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-[#e6d3ae] bg-white p-4">
              <h3 className="text-lg font-bold text-[#8b1a2b]">Контакт със собственика</h3>
              <div className="flex flex-wrap gap-2">
                <select
                  className={`${inputCls} max-w-[200px]`}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {CHANNELS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <Btn
                  tone="ghost"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      const res = (await generateSellerMessageFn({
                        data: { id: current.id, channel },
                      })) as { message: string };
                      setMessage(res.message);
                    }, "AI съобщението е готово")
                  }
                >
                  <Sparkles className="h-4 w-4" /> AI съобщение
                </Btn>
              </div>
              <textarea
                className={`${inputCls} min-h-[150px]`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Съобщение / скрипт за разговор…"
              />
              <input
                className={inputCls}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="Резултат от контакта"
              />
              <div className="flex flex-wrap gap-2">
                {(["sent", "answered", "no_answer", "refused"] as const).map((st) => (
                  <Btn
                    key={st}
                    tone={st === "sent" ? "primary" : "ghost"}
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        await logSellerOutreachFn({
                          data: {
                            prospect_id: current.id,
                            channel,
                            body: message,
                            status: st,
                            outcome: outcome || null,
                            ai_used: Boolean(message),
                          },
                        });
                        setOutcome("");
                      }, "Контактът е записан")
                    }
                  >
                    {st === "sent"
                      ? "Изпратено"
                      : st === "answered"
                        ? "Отговорил"
                        : st === "no_answer"
                          ? "Няма отговор"
                          : "Отказ"}
                  </Btn>
                ))}
              </div>

              <div className="mt-2 space-y-2">
                {currentOutreach.map((o: any) => (
                  <div
                    key={o.id}
                    className="rounded-lg border border-[#f0e4cd] p-2 text-sm text-[#3a2b2e]"
                  >
                    <div className="flex justify-between text-xs text-[#7a6a5c]">
                      <span>
                        {o.channel} · {o.status}
                      </span>
                      <span>{dt(o.created_at)}</span>
                    </div>
                    {o.body ? <p className="mt-1 whitespace-pre-wrap">{o.body}</p> : null}
                    {o.outcome ? (
                      <p className="mt-1 text-xs font-semibold">Резултат: {o.outcome}</p>
                    ) : null}
                  </div>
                ))}
                {currentOutreach.length === 0 ? (
                  <p className="text-sm text-[#7a6a5c]">Няма записани контакти.</p>
                ) : null}
              </div>
            </div>
          </section>
        ) : (
          <p className="text-sm text-[#7a6a5c]">Изберете кандидат от списъка.</p>
        )
      ) : null}

      {tab === "rules" ? (
        <section className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
              <tr>
                {["Код", "Сигнал", "Тегло", "Активен", "Описание"].map((h) => (
                  <th key={h} className="px-3 py-2 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(board?.rules ?? []).map((r: any) => (
                <tr key={r.id} className="border-t border-[#f0e4cd] text-[#3a2b2e]">
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-2 font-semibold">{r.label}</td>
                  <td className="px-3 py-2">
                    <input
                      className={`${inputCls} w-20`}
                      type="number"
                      defaultValue={r.weight}
                      onBlur={(e) =>
                        act(
                          () =>
                            saveSellerRuleFn({
                              data: {
                                code: r.code,
                                label: r.label,
                                weight: Number(e.target.value),
                                is_active: r.is_active,
                                description: r.description,
                              },
                            }),
                          "Записано",
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(r.is_active)}
                      onChange={(e) =>
                        act(
                          () =>
                            saveSellerRuleFn({
                              data: {
                                code: r.code,
                                label: r.label,
                                weight: r.weight,
                                is_active: e.target.checked,
                                description: r.description,
                              },
                            }),
                          "Записано",
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-[#7a6a5c]">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "analytics" && analytics ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
            <h3 className="mb-2 flex items-center gap-2 font-bold text-[#8b1a2b]">
              <BarChart3 className="h-4 w-4" /> По градове
            </h3>
            <table className="min-w-full text-sm text-[#3a2b2e]">
              <thead className="text-left text-[#8b1a2b]">
                <tr>
                  <th className="py-1">Град</th>
                  <th className="py-1">Общо</th>
                  <th className="py-1">Горещи</th>
                  <th className="py-1">Среден скор</th>
                </tr>
              </thead>
              <tbody>
                {analytics.by_city.map((c: any) => (
                  <tr key={c.city} className="border-t border-[#f0e4cd]">
                    <td className="py-1">{c.city}</td>
                    <td className="py-1">{c.total}</td>
                    <td className="py-1">{c.hot}</td>
                    <td className="py-1">{c.avg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
            <h3 className="mb-2 font-bold text-[#8b1a2b]">Най-чести сигнали</h3>
            <ul className="space-y-1 text-sm text-[#3a2b2e]">
              {analytics.by_signal.map((s: any) => (
                <li key={s.code} className="flex justify-between border-b border-[#f0e4cd] py-1">
                  <span>
                    {(board?.rules ?? []).find((r: any) => r.code === s.code)?.label ?? s.code}
                  </span>
                  <b>{s.count}</b>
                </li>
              ))}
              {analytics.by_signal.length === 0 ? (
                <li className="text-[#7a6a5c]">Няма данни.</li>
              ) : null}
            </ul>
          </div>
          <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
            <h3 className="mb-2 font-bold text-[#8b1a2b]">Топ 10 по скор</h3>
            <ul className="space-y-1 text-sm text-[#3a2b2e]">
              {analytics.top.map((t: any) => (
                <li key={t.id} className="flex justify-between border-b border-[#f0e4cd] py-1">
                  <span>
                    {t.name ?? "—"} · {t.city ?? "—"}
                  </span>
                  <b>
                    {t.score} · {t.window ?? "—"}
                  </b>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[#e6d3ae] bg-white p-4">
            <h3 className="mb-2 font-bold text-[#8b1a2b]">Статуси и канали</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-[#3a2b2e]">
              <ul>
                {analytics.by_status.map((s: any) => (
                  <li
                    key={s.status}
                    className="flex justify-between border-b border-[#f0e4cd] py-1"
                  >
                    <span>{STATUS_LABEL[s.status] ?? s.status}</span>
                    <b>{s.count}</b>
                  </li>
                ))}
              </ul>
              <ul>
                {analytics.by_channel.map((c: any) => (
                  <li
                    key={c.channel}
                    className="flex justify-between border-b border-[#f0e4cd] py-1"
                  >
                    <span>{CHANNELS.find((x) => x.code === c.channel)?.label ?? c.channel}</span>
                    <b>{c.count}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "log" ? (
        <section className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-[#fdf7ec] text-left text-[#8b1a2b]">
              <tr>
                {["Кога", "Тип", "Статус", "Съобщение", "Оператор"].map((h) => (
                  <th key={h} className="px-3 py-2 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(board?.events ?? []).map((e: any) => (
                <tr key={e.id} className="border-t border-[#f0e4cd] text-[#3a2b2e]">
                  <td className="px-3 py-2 text-xs">{dt(e.created_at)}</td>
                  <td className="px-3 py-2 font-semibold">{e.event_type}</td>
                  <td className="px-3 py-2">{e.status}</td>
                  <td className="px-3 py-2">{e.message ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{e.actor ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
