import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  MessageSquareQuote,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import {
  createReviewRequestFn,
  generateReviewReplyFn,
  getReviewAnalyticsFn,
  getReviewConfig,
  importExternalReviewFn,
  listReviewDeals,
  listReviewEvents,
  listReviewPlatformsFn,
  listReviewRequests,
  listReviewTemplatesFn,
  listReviewsFn,
  resumeReviewJobFn,
  runReviewSweepNow,
  saveReviewConfig,
  sendReviewRequestFn,
  setReviewStatusFn,
} from "@/lib/reviews.functions";

export const Route = createFileRoute("/admin/reviews")({ component: ReviewsAdmin });

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");

const REQ_LABEL: Record<string, string> = {
  pending: "изчаква",
  scheduled: "насрочена",
  sent: "изпратена",
  clicked: "отворена",
  rated: "оценена",
  completed: "завършена",
  failed: "грешка",
  skipped: "пропусната",
  opted_out: "отказал",
};
const REQ_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  scheduled: "bg-amber-100 text-amber-900",
  sent: "bg-sky-100 text-sky-900",
  clicked: "bg-indigo-100 text-indigo-900",
  rated: "bg-emerald-100 text-emerald-900",
  completed: "bg-emerald-100 text-emerald-900",
  failed: "bg-rose-100 text-rose-900",
  skipped: "bg-stone-200 text-stone-800",
  opted_out: "bg-stone-200 text-stone-800",
};
const PLATFORM_LABEL: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
  internal: "Сайт",
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

function Stars({ value }: { value?: number | null }) {
  const n = Number(value ?? 0);
  if (!n) return <span className="text-[#7a6a5c]">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5 text-[#c9a84c]">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= n ? "fill-[#c9a84c]" : "opacity-30"}`} />
      ))}
      <span className="ml-1 text-xs font-semibold text-[#3a2b2e]">{n}/5</span>
    </span>
  );
}

function ReviewsAdmin() {
  const [tab, setTab] = useState<"invite" | "requests" | "reviews" | "analytics" | "log">("invite");
  const [deals, setDeals] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [query, setQuery] = useState("");

  const [dealId, setDealId] = useState("");
  const [platformCode, setPlatformCode] = useState("google");
  const [channel, setChannel] = useState("email");
  const [delayHours, setDelayHours] = useState(24);
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");

  const [impPlatform, setImpPlatform] = useState("google");
  const [impName, setImpName] = useState("");
  const [impRating, setImpRating] = useState(5);
  const [impBody, setImpBody] = useState("");
  const [impUrl, setImpUrl] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [d, p, t, rq, rv, ev, an, c] = await Promise.all([
        listReviewDeals(),
        listReviewPlatformsFn(),
        listReviewTemplatesFn(),
        listReviewRequests({ data: {} }),
        listReviewsFn({ data: {} }),
        listReviewEvents(),
        getReviewAnalyticsFn(),
        getReviewConfig(),
      ]);
      setDeals(d as any[]);
      setPlatforms(p as any[]);
      setTemplates(t as any[]);
      setRequests(rq as any[]);
      setReviews(rv as any[]);
      setEvents(ev as any[]);
      setAnalytics(an);
      setCfg((c as any).settings);
      setJob((c as any).job);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
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

  const filteredReviews = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((r) =>
      `${r.author_name ?? ""} ${r.body ?? ""} ${r.platform_code ?? ""}`.toLowerCase().includes(q),
    );
  }, [reviews, query]);

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      `${r.contact_name ?? ""} ${r.contact_email ?? ""} ${r.deals?.title ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [requests, query]);

  return (
    <div data-crm-themed className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#8b1a2b]">
            <MessageSquareQuote className="h-6 w-6" /> Събиране на ревюта
          </h1>
          <p className="text-sm text-[#7a6a5c]">
            Автоматизация №14 · Google и Facebook оценки след приключена сделка
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void load()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-[#e6d3ae] bg-[#fdf7ec] px-4 py-2 text-sm font-semibold text-[#8b1a2b]"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Обнови
          </button>
          <button
            onClick={() => void run(() => runReviewSweepNow({ data: {} }), "Цикълът е изпълнен")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-[#8b1a2b] px-4 py-2 text-sm font-semibold text-[#fffaf2]"
          >
            <Zap className="h-4 w-4" /> Пусни цикъл
          </button>
          <button
            onClick={() => setShowCfg((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-[#e6d3ae] bg-[#fdf7ec] px-4 py-2 text-sm font-semibold text-[#8b1a2b]"
          >
            <Settings2 className="h-4 w-4" /> Настройки
          </button>
        </div>
      </header>

      {job?.paused ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <span>Задачата е на пауза: {job.paused_reason ?? "неизвестна причина"}</span>
          <button
            onClick={() => void run(() => resumeReviewJobFn(), "Задачата е активирана")}
            className="rounded-full bg-[#8b1a2b] px-4 py-1.5 font-semibold text-[#fffaf2]"
          >
            Активирай
          </button>
        </div>
      ) : null}

      {showCfg && cfg ? (
        <section className="grid gap-3 rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4 md:grid-cols-3">
          {[
            ["enabled", "Автоматизацията е активна"],
            ["ai_enabled", "AI персонализация на поканите"],
            ["auto_enroll_won_deals", "Автоматично след приключена сделка"],
            ["gate_low_ratings", "Пази ниските оценки от публикуване"],
            ["auto_ai_reply", "AI отговори на публични ревюта"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-[#3a2b2e]">
              <input
                type="checkbox"
                checked={Boolean(cfg[key as string])}
                onChange={(e) => setCfg({ ...cfg, [key as string]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          {[
            ["delay_hours", "Изчакване след сделка (часове)"],
            ["reminder_after_days", "Напомняне след (дни)"],
            ["batch_size", "Партида на цикъл"],
            ["min_public_rating", "Мин. оценка за публична платформа"],
            ["auto_publish_min_rating", "Мин. оценка за авто-публикуване"],
          ].map(([key, label]) => (
            <label key={key} className="text-sm text-[#3a2b2e]">
              <span className="mb-1 block font-medium">{label}</span>
              <input
                type="number"
                value={Number(cfg[key as string] ?? 0)}
                onChange={(e) => setCfg({ ...cfg, [key as string]: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
              />
            </label>
          ))}
          <label className="text-sm text-[#3a2b2e]">
            <span className="mb-1 block font-medium">Основна платформа</span>
            <select
              value={String(cfg.default_platform ?? "google")}
              onChange={(e) => setCfg({ ...cfg, default_platform: e.target.value })}
              className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
            >
              {platforms.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-3">
            <button
              onClick={() =>
                void run(() => saveReviewConfig({ data: cfg }), "Настройките са запазени")
              }
              disabled={busy}
              className="rounded-full bg-[#8b1a2b] px-5 py-2 text-sm font-semibold text-[#fffaf2]"
            >
              Запази настройките
            </button>
          </div>
        </section>
      ) : null}

      <nav className="flex flex-wrap gap-2">
        {(
          [
            ["invite", "Нова покана"],
            ["requests", `Покани (${requests.length})`],
            ["reviews", `Ревюта (${reviews.length})`],
            ["analytics", "Анализи"],
            ["log", "Журнал"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === key ? "bg-[#8b1a2b] text-[#fffaf2]" : "border border-[#e6d3ae] bg-[#fdf7ec] text-[#8b1a2b]"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "invite" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4">
            <h2 className="flex items-center gap-2 font-semibold text-[#8b1a2b]">
              <Send className="h-4 w-4" /> Покана за оценка
            </h2>
            <label className="block text-sm text-[#3a2b2e]">
              <span className="mb-1 block font-medium">Сделка</span>
              <select
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
              >
                <option value="">— без сделка (ръчен контакт) —</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} · {d.clients?.full_name ?? "без клиент"}{" "}
                    {d.status === "won" ? "· приключена" : ""}
                  </option>
                ))}
              </select>
            </label>
            {!dealId ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-[#3a2b2e]">
                  <span className="mb-1 block font-medium">Име</span>
                  <input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
                  />
                </label>
                <label className="text-sm text-[#3a2b2e]">
                  <span className="mb-1 block font-medium">Имейл</span>
                  <input
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
                  />
                </label>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-[#3a2b2e]">
                <span className="mb-1 block font-medium">Платформа</span>
                <select
                  value={platformCode}
                  onChange={(e) => setPlatformCode(e.target.value)}
                  className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
                >
                  {platforms.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-[#3a2b2e]">
                <span className="mb-1 block font-medium">Канал</span>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
                >
                  <option value="email">имейл</option>
                  <option value="sms">SMS</option>
                </select>
              </label>
              <label className="text-sm text-[#3a2b2e]">
                <span className="mb-1 block font-medium">Изчакване (часове)</span>
                <input
                  type="number"
                  value={delayHours}
                  onChange={(e) => setDelayHours(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  void run(
                    () =>
                      createReviewRequestFn({
                        data: {
                          dealId: dealId || null,
                          contactName: manualName || null,
                          contactEmail: manualEmail || null,
                          channel,
                          platformCode,
                          delayHours,
                          sendNow: true,
                        },
                      }),
                    "Поканата е изпратена",
                  )
                }
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full bg-[#8b1a2b] px-5 py-2 text-sm font-semibold text-[#fffaf2]"
              >
                <Send className="h-4 w-4" /> Изпрати сега
              </button>
              <button
                onClick={() =>
                  void run(
                    () =>
                      createReviewRequestFn({
                        data: {
                          dealId: dealId || null,
                          contactName: manualName || null,
                          contactEmail: manualEmail || null,
                          channel,
                          platformCode,
                          delayHours,
                        },
                      }),
                    "Поканата е насрочена",
                  )
                }
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full border border-[#e6d3ae] bg-[#fffaf2] px-5 py-2 text-sm font-semibold text-[#8b1a2b]"
              >
                <Plus className="h-4 w-4" /> Насрочи
              </button>
            </div>
            <p className="text-xs text-[#7a6a5c]">
              Активни шаблони: {templates.filter((t) => t.is_active).length}
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4">
            <h2 className="flex items-center gap-2 font-semibold text-[#8b1a2b]">
              <Plus className="h-4 w-4" /> Внасяне на външно ревю
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-[#3a2b2e]">
                <span className="mb-1 block font-medium">Платформа</span>
                <select
                  value={impPlatform}
                  onChange={(e) => setImpPlatform(e.target.value)}
                  className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
                >
                  {platforms.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-[#3a2b2e]">
                <span className="mb-1 block font-medium">Автор</span>
                <input
                  value={impName}
                  onChange={(e) => setImpName(e.target.value)}
                  className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
                />
              </label>
              <label className="text-sm text-[#3a2b2e]">
                <span className="mb-1 block font-medium">Оценка (1-5)</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={impRating}
                  onChange={(e) => setImpRating(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
                />
              </label>
              <label className="text-sm text-[#3a2b2e]">
                <span className="mb-1 block font-medium">Линк</span>
                <input
                  value={impUrl}
                  onChange={(e) => setImpUrl(e.target.value)}
                  className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
                />
              </label>
            </div>
            <label className="block text-sm text-[#3a2b2e]">
              <span className="mb-1 block font-medium">Текст</span>
              <textarea
                value={impBody}
                onChange={(e) => setImpBody(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-[#e6d3ae] bg-[#fffaf2] px-3 py-2 text-[#3a2b2e]"
              />
            </label>
            <button
              onClick={() =>
                void run(
                  () =>
                    importExternalReviewFn({
                      data: {
                        platformCode: impPlatform,
                        authorName: impName,
                        rating: impRating,
                        body: impBody || null,
                        externalUrl: impUrl || null,
                      },
                    }),
                  "Ревюто е добавено",
                )
              }
              disabled={busy || !impName}
              className="rounded-full bg-[#8b1a2b] px-5 py-2 text-sm font-semibold text-[#fffaf2] disabled:opacity-50"
            >
              Добави ревю
            </button>
          </div>
        </section>
      ) : null}

      {tab === "requests" || tab === "reviews" ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7a6a5c]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Търсене..."
            className="w-full rounded-full border border-[#e6d3ae] bg-[#fffaf2] py-2 pl-10 pr-4 text-sm text-[#3a2b2e]"
          />
        </div>
      ) : null}

      {tab === "requests" ? (
        <section className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-[#fdf7ec]">
          <table className="w-full text-sm">
            <thead className="bg-[#8b1a2b] text-[#fffaf2]">
              <tr>
                {["Клиент", "Сделка", "Канал / платформа", "Статус", "Изпратена", "Оценка", ""].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => (
                <tr key={r.id} className="border-b border-[#eadfce] last:border-0">
                  <td className="px-3 py-2 text-[#3a2b2e]">
                    <div className="font-semibold">{r.contact_name ?? "—"}</div>
                    <div className="text-xs text-[#7a6a5c]">
                      {r.contact_email ?? r.contact_phone ?? "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[#3a2b2e]">{r.deals?.title ?? "—"}</td>
                  <td className="px-3 py-2 text-[#3a2b2e]">
                    {r.channel === "email" ? "имейл" : "SMS"} ·{" "}
                    {PLATFORM_LABEL[r.platform_code] ?? r.platform_code} · стъпка {r.step_no}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${REQ_CLASS[r.status] ?? "bg-stone-200 text-stone-800"}`}
                    >
                      {REQ_LABEL[r.status] ?? r.status}
                    </span>
                    {r.error ? <div className="mt-1 text-xs text-rose-700">{r.error}</div> : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-[#3a2b2e]">
                    {dt(r.sent_at)}
                    {r.click_count ? (
                      <div className="text-[#7a6a5c]">клика: {r.click_count}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <Stars value={r.rating} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() =>
                        void run(
                          () => sendReviewRequestFn({ data: { requestId: r.id } }),
                          "Изпратено",
                        )
                      }
                      disabled={busy}
                      className="rounded-full border border-[#e6d3ae] bg-[#fffaf2] px-3 py-1 text-xs font-semibold text-[#8b1a2b]"
                    >
                      {r.sent_at ? "Изпрати отново" : "Изпрати"}
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredRequests.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[#7a6a5c]">
                    Няма покани.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "reviews" ? (
        <section className="grid gap-3 md:grid-cols-2">
          {filteredReviews.map((r) => (
            <article
              key={r.id}
              className="space-y-2 rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-[#8b1a2b]">{r.author_name ?? "Клиент"}</div>
                  <div className="text-xs text-[#7a6a5c]">
                    {PLATFORM_LABEL[r.platform_code] ?? r.platform_code} · {dt(r.created_at)}{" "}
                    {r.deals?.title ? `· ${r.deals.title}` : ""}
                  </div>
                </div>
                <Stars value={r.rating} />
              </div>
              <p className="text-sm text-[#3a2b2e]">
                {r.body || <span className="text-[#7a6a5c]">без текст</span>}
              </p>
              {r.ai_reply ? (
                <div className="rounded-lg border border-[#e6d3ae] bg-[#fffaf2] p-3 text-sm text-[#3a2b2e]">
                  <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-[#8b1a2b]">
                    <Sparkles className="h-3 w-3" /> AI отговор
                  </div>
                  {r.ai_reply}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    void run(
                      () =>
                        setReviewStatusFn({
                          data: { reviewId: r.id, status: "published", isPublic: true },
                        }),
                      "Публикувано",
                    )
                  }
                  disabled={busy}
                  className="rounded-full bg-[#8b1a2b] px-3 py-1 text-xs font-semibold text-[#fffaf2]"
                >
                  Публикувай
                </button>
                <button
                  onClick={() =>
                    void run(
                      () =>
                        setReviewStatusFn({
                          data: { reviewId: r.id, status: "hidden", isPublic: false },
                        }),
                      "Скрито",
                    )
                  }
                  disabled={busy}
                  className="rounded-full border border-[#e6d3ae] bg-[#fffaf2] px-3 py-1 text-xs font-semibold text-[#8b1a2b]"
                >
                  Скрий
                </button>
                <button
                  onClick={() =>
                    void run(
                      () =>
                        setReviewStatusFn({ data: { reviewId: r.id, isFeatured: !r.is_featured } }),
                      "Обновено",
                    )
                  }
                  disabled={busy}
                  className="rounded-full border border-[#e6d3ae] bg-[#fffaf2] px-3 py-1 text-xs font-semibold text-[#8b1a2b]"
                >
                  {r.is_featured ? "Премахни от избрани" : "Направи избрано"}
                </button>
                <button
                  onClick={() =>
                    void run(
                      () => generateReviewReplyFn({ data: { reviewId: r.id } }),
                      "AI отговорът е готов",
                    )
                  }
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full border border-[#e6d3ae] bg-[#fffaf2] px-3 py-1 text-xs font-semibold text-[#8b1a2b]"
                >
                  <Sparkles className="h-3 w-3" /> AI отговор
                </button>
              </div>
            </article>
          ))}
          {!filteredReviews.length ? <p className="text-[#7a6a5c]">Няма ревюта.</p> : null}
        </section>
      ) : null}

      {tab === "analytics" && analytics ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Изпратени покани"
              value={analytics.sent}
              hint={`общо ${analytics.requests_total}`}
            />
            <Kpi
              label="Отворени (CTR)"
              value={`${analytics.click_rate}%`}
              hint={`${analytics.clicked} клика`}
            />
            <Kpi
              label="Оценили"
              value={`${analytics.rating_rate}%`}
              hint={`${analytics.rated} оценки`}
            />
            <Kpi
              label="Среден рейтинг"
              value={analytics.avg_rating ?? "—"}
              hint={`${analytics.reviews_total} ревюта`}
            />
            <Kpi label="Публични ревюта" value={analytics.reviews_public} />
            <Kpi label="Позитивни" value={analytics.nps_positive} />
            <Kpi label="Негативни" value={analytics.nps_negative} />
            <Kpi label="Чакащи / грешки" value={`${analytics.pending} / ${analytics.failed}`} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4">
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-[#8b1a2b]">
                <BarChart3 className="h-4 w-4" /> Разпределение на оценките
              </h3>
              {[5, 4, 3, 2, 1].map((n) => {
                const count = Number(analytics.distribution?.[String(n)] ?? 0);
                const pct = analytics.reviews_total
                  ? Math.round((count / analytics.reviews_total) * 100)
                  : 0;
                return (
                  <div key={n} className="mb-2 flex items-center gap-2 text-sm text-[#3a2b2e]">
                    <span className="w-10">{n} ★</span>
                    <div className="h-2 flex-1 rounded-full bg-[#eadfce]">
                      <div className="h-2 rounded-full bg-[#8b1a2b]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-14 text-right text-xs">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="rounded-xl border border-[#e6d3ae] bg-[#fdf7ec] p-4">
              <h3 className="mb-3 font-semibold text-[#8b1a2b]">По платформи</h3>
              {Object.entries(analytics.by_platform ?? {}).map(([code, v]: [string, any]) => (
                <div
                  key={code}
                  className="flex items-center justify-between border-b border-[#eadfce] py-2 text-sm text-[#3a2b2e] last:border-0"
                >
                  <span>{PLATFORM_LABEL[code] ?? code}</span>
                  <span>
                    {v.count} ревюта · среден {v.avg}
                  </span>
                </div>
              ))}
              {!Object.keys(analytics.by_platform ?? {}).length ? (
                <p className="text-sm text-[#7a6a5c]">Няма данни.</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "log" ? (
        <section className="overflow-x-auto rounded-xl border border-[#e6d3ae] bg-[#fdf7ec]">
          <table className="w-full text-sm">
            <thead className="bg-[#8b1a2b] text-[#fffaf2]">
              <tr>
                {["Време", "Действие", "Статус", "Съобщение", "Изпълнител"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-[#eadfce] last:border-0">
                  <td className="px-3 py-2 text-xs text-[#3a2b2e]">{dt(e.created_at)}</td>
                  <td className="px-3 py-2 text-[#3a2b2e]">{e.action}</td>
                  <td className="px-3 py-2 text-[#3a2b2e]">{e.status}</td>
                  <td className="px-3 py-2 text-xs text-[#3a2b2e]">{e.message ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-[#7a6a5c]">{e.actor ?? "—"}</td>
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
        </section>
      ) : null}
    </div>
  );
}
