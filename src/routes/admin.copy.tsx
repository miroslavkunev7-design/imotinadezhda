import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  CheckCircle2,
  FileText,
  PenLine,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import {
  applyCopyFn,
  generateCopyFn,
  getCopyAnalyticsFn,
  getCopyConfig,
  listCopyEvents,
  listCopyProperties,
  listCopyTemplates,
  listPropertyCopy,
  queueCopyFn,
  resumeCopyJobFn,
  runCopyQueueNow,
  saveCopyConfig,
  setCopyStatusFn,
  updateCopyFn,
} from "@/lib/copy.functions";

export const Route = createFileRoute("/admin/copy")({ component: CopyAdmin });

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");
const money = (v?: number | null, c?: string | null) =>
  v == null
    ? "—"
    : `${Number(v).toLocaleString("bg-BG", { maximumFractionDigits: 0 })} ${c ?? "EUR"}`;

const STATUS_LABEL: Record<string, string> = {
  draft: "чернова",
  approved: "одобрен",
  published: "приложен",
  rejected: "отказан",
};
const STATUS_CLASS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-900",
  approved: "bg-sky-100 text-sky-900",
  published: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900",
};
const CHANNEL_LABEL: Record<string, string> = {
  site: "сайт",
  portal: "портал",
  social: "социални",
  seo: "SEO",
  email: "имейл",
};

function scoreClass(v: number) {
  if (v >= 85) return "text-emerald-700";
  if (v >= 65) return "text-amber-700";
  return "text-rose-700";
}

function CopyAdmin() {
  const [tab, setTab] = useState<"generate" | "library" | "analytics" | "log">("generate");
  const [properties, setProperties] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [copies, setCopies] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [query, setQuery] = useState("");
  const [template, setTemplate] = useState("site_premium");
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [p, t, c, e, a, conf] = await Promise.all([
        listCopyProperties(),
        listCopyTemplates(),
        listPropertyCopy({ data: {} }),
        listCopyEvents(),
        getCopyAnalyticsFn(),
        getCopyConfig(),
      ]);
      setProperties(p as any[]);
      setTemplates(t as any[]);
      setCopies(c as any[]);
      setEvents(e as any[]);
      setAnalytics(a);
      setCfg((conf as any).settings);
      setJob((conf as any).job);
      setTemplate((conf as any).settings?.default_template ?? "site_premium");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при зареждане");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async <T,>(fn: () => Promise<T>, msg: (r: T) => string) => {
      setBusy(true);
      try {
        const r = await fn();
        toast.success(msg(r));
        await load();
        return r;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Грешка");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) =>
      [p.title, p.cities?.name, p.quarters?.name]
        .filter(Boolean)
        .some((x: string) => String(x).toLowerCase().includes(q)),
    );
  }, [properties, query]);

  const open = copies.find((c) => c.id === openId) ?? null;

  useEffect(() => {
    if (!open) {
      setEdit(null);
      return;
    }
    setEdit({
      title: open.title ?? "",
      body: open.body ?? "",
      short_text: open.short_text ?? "",
      seo_title: open.seo_title ?? "",
      seo_description: open.seo_description ?? "",
      seo_keywords: (open.seo_keywords ?? []).join(", "),
    });
  }, [openId, copies.length]);

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success("Копирано");
  };

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">AI Описание на имот</h1>
          <p className="mt-1 text-sm text-primary/70">
            №11 — обяви, портални текстове, социални постове и SEO мета
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              void act(
                () => runCopyQueueNow({ data: {} }),
                (r: any) =>
                  r.skipped
                    ? `Не се изпълни: ${r.skipped}`
                    : `Обработени ${r.processed} · генерирани ${r.generated} · грешки ${r.errors}`,
              )
            }
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#7a0d22] px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" /> Обработи опашката
          </button>
          <button
            onClick={() => void load()}
            className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary"
          >
            <RefreshCw className="h-4 w-4" /> Обнови
          </button>
          <button
            onClick={() => setShowCfg((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary"
          >
            <Settings2 className="h-4 w-4" /> Настройки
          </button>
        </div>
      </header>

      {job?.paused && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <span>Автоматизацията е спряна: {job.paused_reason ?? "неизвестна причина"}</span>
          <button
            onClick={() =>
              void act(
                () => resumeCopyJobFn(),
                () => "Автоматизацията е активирана",
              )
            }
            className="rounded-lg bg-rose-700 px-3 py-1.5 font-semibold text-white"
          >
            Активирай
          </button>
        </div>
      )}

      {showCfg && cfg && (
        <section className="rounded-2xl border border-primary/20 bg-[#fffaf3] p-5" data-crm-themed>
          <h2 className="font-display text-xl text-primary">Настройки на автоматизацията</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["enabled", "Активна", "bool"],
              ["ai_enabled", "AI генериране", "bool"],
              ["auto_queue_new", "Авт. опашка за имоти без описание", "bool"],
              ["auto_apply_approved", "Авт. записване в имота", "bool"],
              ["batch_size", "Пакет на пас", "num"],
              ["auto_approve_min_score", "Мин. оценка за авт. одобрение", "num"],
              ["min_words", "Мин. думи", "num"],
              ["max_words", "Макс. думи", "num"],
            ].map(([key, label, type]) => (
              <label key={key as string} className="text-sm text-primary">
                <span className="block font-semibold">{label}</span>
                {type === "bool" ? (
                  <input
                    type="checkbox"
                    checked={Boolean(cfg[key as string])}
                    onChange={(e) => setCfg({ ...cfg, [key as string]: e.target.checked })}
                    className="mt-2 h-4 w-4"
                  />
                ) : (
                  <input
                    type="number"
                    value={Number(cfg[key as string] ?? 0)}
                    onChange={(e) => setCfg({ ...cfg, [key as string]: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-primary/30 bg-white px-3 py-2 text-primary"
                  />
                )}
              </label>
            ))}
            <label className="text-sm text-primary">
              <span className="block font-semibold">Шаблон по подразбиране</span>
              <select
                value={cfg.default_template}
                onChange={(e) => setCfg({ ...cfg, default_template: e.target.value })}
                className="mt-1 w-full rounded-lg border border-primary/30 bg-white px-3 py-2 text-primary"
              >
                {templates.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            onClick={() =>
              void act(
                () => saveCopyConfig({ data: cfg }),
                () => "Настройките са запазени",
              )
            }
            disabled={busy}
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
          >
            Запази
          </button>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Генерирани текстове", analytics?.total ?? 0],
          ["Покритие с описания", `${analytics?.coverage ?? 0}%`],
          ["Средно качество", `${analytics?.avg_quality ?? 0}/100`],
          ["Средно SEO", `${analytics?.avg_seo ?? 0}/100`],
          ["В опашка", analytics?.queue?.queued ?? 0],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-4"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-primary/60">
              {label}
            </div>
            <div className="mt-1 font-display text-2xl text-primary">{value as string}</div>
          </div>
        ))}
      </div>

      <nav className="flex flex-wrap gap-2">
        {(
          [
            ["generate", "Генериране", Sparkles],
            ["library", "Библиотека текстове", FileText],
            ["analytics", "Аналитика", BarChart3],
            ["log", "Журнал", RefreshCw],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === key ? "bg-primary text-amber-100" : "border border-primary/25 text-primary"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </nav>

      {tab === "generate" && (
        <section className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5" data-crm-themed>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 text-sm text-primary">
              <span className="block font-semibold">Търси имот</span>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-primary/50" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="заглавие, град, квартал"
                  className="w-full rounded-lg border border-primary/30 bg-white py-2 pl-9 pr-3 text-primary"
                />
              </div>
            </label>
            <label className="text-sm text-primary">
              <span className="block font-semibold">Шаблон / канал</span>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="mt-1 rounded-lg border border-primary/30 bg-white px-3 py-2 text-primary"
              >
                {templates.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() =>
                void act(
                  () => queueCopyFn({ data: { propertyIds: selected, templateCode: template } }),
                  (r: any) => `Добавени в опашка: ${r.queued}`,
                )
              }
              disabled={busy || selected.length === 0}
              className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
            >
              <Upload className="h-4 w-4" /> В опашка ({selected.length})
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm text-primary">
              <thead className="text-xs uppercase tracking-wide text-primary/60">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.length > 0 && selected.length === filtered.length}
                      onChange={(e) =>
                        setSelected(e.target.checked ? filtered.map((p) => p.id) : [])
                      }
                    />
                  </th>
                  <th className="px-3 py-2">Имот</th>
                  <th className="px-3 py-2">Локация</th>
                  <th className="px-3 py-2">Цена</th>
                  <th className="px-3 py-2">Описание</th>
                  <th className="px-3 py-2">Действие</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const wc = String(p.description ?? "")
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean).length;
                  return (
                    <tr key={p.id} className="border-t border-primary/10">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id)}
                          onChange={(e) =>
                            setSelected((s) =>
                              e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id),
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold">{p.title}</td>
                      <td className="px-3 py-2">
                        {[p.quarters?.name, p.cities?.name].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2">{money(p.price, p.currency)}</td>
                      <td
                        className={`px-3 py-2 ${wc < (cfg?.min_words ?? 90) ? "font-semibold text-rose-700" : ""}`}
                      >
                        {wc} думи
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() =>
                            void act(
                              () =>
                                generateCopyFn({
                                  data: { propertyId: p.id, templateCode: template },
                                }),
                              (r: any) =>
                                `Готово · качество ${r.scores.quality_score}/100 · SEO ${r.scores.seo_score}/100${r.ai_used ? " (AI)" : " (шаблон)"}`,
                            )
                          }
                          disabled={busy}
                          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-50"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Генерирай
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-primary/60">
                      Няма намерени имоти.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "library" && (
        <section className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5" data-crm-themed>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm text-primary">
              <thead className="text-xs uppercase tracking-wide text-primary/60">
                <tr>
                  <th className="px-3 py-2">Имот</th>
                  <th className="px-3 py-2">Канал</th>
                  <th className="px-3 py-2">Верс.</th>
                  <th className="px-3 py-2">Качество</th>
                  <th className="px-3 py-2">SEO</th>
                  <th className="px-3 py-2">Думи</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Създаден</th>
                </tr>
              </thead>
              <tbody>
                {copies.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-t border-primary/10 hover:bg-white"
                    onClick={() => setOpenId(c.id)}
                  >
                    <td className="px-3 py-2 font-semibold">{c.properties?.title ?? "—"}</td>
                    <td className="px-3 py-2">{CHANNEL_LABEL[c.channel] ?? c.channel}</td>
                    <td className="px-3 py-2">v{c.version}</td>
                    <td className={`px-3 py-2 font-semibold ${scoreClass(c.quality_score)}`}>
                      {c.quality_score}
                    </td>
                    <td className={`px-3 py-2 font-semibold ${scoreClass(c.seo_score)}`}>
                      {c.seo_score}
                    </td>
                    <td className="px-3 py-2">{c.word_count}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[c.status] ?? ""}`}
                      >
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{dt(c.created_at)}</td>
                  </tr>
                ))}
                {copies.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-primary/60">
                      Още няма генерирани текстове.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "analytics" && analytics && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5" data-crm-themed>
            <h3 className="font-display text-lg text-primary">По канал</h3>
            <div className="mt-3 space-y-2 text-sm text-primary">
              {Object.entries(analytics.by_channel ?? {}).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-28">{CHANNEL_LABEL[k] ?? k}</span>
                  <div className="h-2 flex-1 rounded-full bg-primary/10">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${Math.round((Number(v) / Math.max(analytics.total, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-10 text-right font-semibold">{v as number}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5" data-crm-themed>
            <h3 className="font-display text-lg text-primary">По статус</h3>
            <div className="mt-3 space-y-2 text-sm text-primary">
              {Object.entries(analytics.by_status ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span>{STATUS_LABEL[k] ?? k}</span>
                  <span className="font-semibold">{v as number}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-primary">
              <div>
                Дял AI: <b>{analytics.ai_share}%</b>
              </div>
              <div>
                Средно думи: <b>{analytics.avg_words}</b>
              </div>
              <div>
                Имоти без описание: <b>{analytics.properties_missing_copy}</b>
              </div>
              <div>
                Грешки: <b>{analytics.recent_errors}</b>
              </div>
            </div>
          </div>
          <div
            className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5 lg:col-span-2"
            data-crm-themed
          >
            <h3 className="font-display text-lg text-primary">Генерирани по дни (30 дни)</h3>
            <div className="mt-3 flex h-32 items-end gap-1">
              {(analytics.trend ?? []).map((t: any) => {
                const max = Math.max(...(analytics.trend ?? []).map((x: any) => x.count), 1);
                return (
                  <div key={t.day} className="flex-1" title={`${t.day}: ${t.count}`}>
                    <div
                      className="rounded-t bg-primary"
                      style={{ height: `${(t.count / max) * 100}%`, minHeight: 4 }}
                    />
                  </div>
                );
              })}
              {(analytics.trend ?? []).length === 0 && (
                <p className="text-sm text-primary/60">Няма данни.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "log" && (
        <section className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5" data-crm-themed>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm text-primary">
              <thead className="text-xs uppercase tracking-wide text-primary/60">
                <tr>
                  <th className="px-3 py-2">Дата</th>
                  <th className="px-3 py-2">Имот</th>
                  <th className="px-3 py-2">Действие</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Съобщение</th>
                  <th className="px-3 py-2">Автор</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-primary/10">
                    <td className="px-3 py-2">{dt(e.created_at)}</td>
                    <td className="px-3 py-2">{e.properties?.title ?? "—"}</td>
                    <td className="px-3 py-2">{e.action}</td>
                    <td
                      className={`px-3 py-2 font-semibold ${e.status === "error" ? "text-rose-700" : e.status === "warn" ? "text-amber-700" : "text-emerald-700"}`}
                    >
                      {e.status}
                    </td>
                    <td className="px-3 py-2">{e.message ?? "—"}</td>
                    <td className="px-3 py-2">{e.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {open && edit && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setOpenId(null)}
        >
          <div
            className="h-full w-full max-w-2xl overflow-y-auto bg-[#fffaf3] p-6"
            data-crm-themed
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-primary">
                  {open.properties?.title ?? "Текст"}
                </h2>
                <p className="text-sm text-primary/70">
                  {CHANNEL_LABEL[open.channel] ?? open.channel} · v{open.version} · качество{" "}
                  <b className={scoreClass(open.quality_score)}>{open.quality_score}</b> · SEO{" "}
                  <b className={scoreClass(open.seo_score)}>{open.seo_score}</b>
                </p>
              </div>
              <button
                onClick={() => setOpenId(null)}
                className="rounded-lg border border-primary/30 px-3 py-1.5 text-sm text-primary"
              >
                Затвори
              </button>
            </div>

            {(open.issues ?? []).length > 0 && (
              <ul className="mt-4 space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                {open.issues.map((i: string) => (
                  <li key={i}>• {i}</li>
                ))}
              </ul>
            )}

            <div className="mt-4 space-y-3 text-sm text-primary">
              {(
                [
                  ["title", "Заглавие", "input"],
                  ["body", "Описание", "area"],
                  ["short_text", "Кратък текст", "area"],
                  ["seo_title", "SEO заглавие", "input"],
                  ["seo_description", "SEO описание", "area"],
                  ["seo_keywords", "Ключови думи (със запетая)", "input"],
                ] as const
              ).map(([key, label, kind]) => (
                <label key={key} className="block">
                  <span className="block font-semibold">{label}</span>
                  {kind === "area" ? (
                    <textarea
                      rows={key === "body" ? 10 : 3}
                      value={edit[key]}
                      onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-primary/30 bg-white px-3 py-2 text-primary"
                    />
                  ) : (
                    <input
                      value={edit[key]}
                      onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-primary/30 bg-white px-3 py-2 text-primary"
                    />
                  )}
                </label>
              ))}
              {(open.bullets ?? []).length > 0 && (
                <div>
                  <span className="block font-semibold">Акценти</span>
                  <ul className="mt-1 list-disc pl-5">
                    {open.bullets.map((b: string) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(open.hashtags ?? []).length > 0 && (
                <p className="text-primary/70">{open.hashtags.join(" ")}</p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  void act(
                    () =>
                      updateCopyFn({
                        data: {
                          copyId: open.id,
                          patch: {
                            title: edit.title,
                            body: edit.body,
                            short_text: edit.short_text,
                            seo_title: edit.seo_title,
                            seo_description: edit.seo_description,
                            seo_keywords: String(edit.seo_keywords)
                              .split(",")
                              .map((s: string) => s.trim())
                              .filter(Boolean),
                          },
                        },
                      }),
                    () => "Текстът е обновен",
                  )
                }
                disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
              >
                <PenLine className="h-4 w-4" /> Запази промените
              </button>
              <button
                onClick={() =>
                  void act(
                    () => setCopyStatusFn({ data: { copyId: open.id, status: "approved" } }),
                    () => "Одобрен",
                  )
                }
                disabled={busy}
                className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> Одобри
              </button>
              <button
                onClick={() =>
                  void act(
                    () => applyCopyFn({ data: { copyId: open.id } }),
                    () => "Записан в имота",
                  )
                }
                disabled={busy}
                className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
              >
                <Upload className="h-4 w-4" /> Приложи в имота
              </button>
              <button
                onClick={() => copy(`${open.title}\n\n${open.body}`)}
                className="rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary"
              >
                Копирай
              </button>
              <button
                onClick={() =>
                  void act(
                    () =>
                      generateCopyFn({
                        data: { propertyId: open.property_id, templateCode: open.template_code },
                      }),
                    (r: any) => `Нова версия · качество ${r.scores.quality_score}/100`,
                  )
                }
                disabled={busy}
                className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" /> Регенерирай
              </button>
              <button
                onClick={() =>
                  void act(
                    () => setCopyStatusFn({ data: { copyId: open.id, status: "rejected" } }),
                    () => "Отказан",
                  )
                }
                disabled={busy}
                className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
              >
                Откажи
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
