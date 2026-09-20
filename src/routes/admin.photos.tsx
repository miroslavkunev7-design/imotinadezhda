import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Images,
  ImagePlus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
  Zap,
} from "lucide-react";
import {
  applyPhotoFn,
  deletePhotoAssetFn,
  getPhotoAnalyticsFn,
  getPhotoConfig,
  listPhotoAssets,
  listPhotoEvents,
  listPhotoPresetsFn,
  listPhotoSources,
  processPhotoFn,
  queuePhotosFn,
  resumePhotoJobFn,
  runPhotoQueueNow,
  savePhotoConfig,
  setPhotoStatusFn,
} from "@/lib/photos.functions";

export const Route = createFileRoute("/admin/photos")({ component: PhotosAdmin });

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");
const kb = (v?: number | null) => (v ? `${Math.round(Number(v) / 1024)} KB` : "—");

const STATUS_LABEL: Record<string, string> = {
  processing: "обработва се",
  ready: "готова",
  approved: "одобрена",
  published: "в галерията",
  rejected: "отказана",
  error: "грешка",
};
const STATUS_CLASS: Record<string, string> = {
  processing: "bg-slate-100 text-slate-900",
  ready: "bg-amber-100 text-amber-900",
  approved: "bg-sky-100 text-sky-900",
  published: "bg-emerald-100 text-emerald-900",
  rejected: "bg-rose-100 text-rose-900",
  error: "bg-rose-200 text-rose-900",
};
const KIND_LABEL: Record<string, string> = {
  enhance: "подобрение",
  hdr: "HDR",
  staging: "виртуално обзавеждане",
  declutter: "разчистване",
  twilight: "залез",
  sky: "небе",
};

function scoreClass(v: number) {
  if (v >= 85) return "text-emerald-700";
  if (v >= 65) return "text-amber-700";
  return "text-rose-700";
}

function PhotosAdmin() {
  const [tab, setTab] = useState<"process" | "library" | "analytics" | "log">("process");
  const [sources, setSources] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState("enhance_pro");
  const [extra, setExtra] = useState("");
  const [selected, setSelected] = useState<
    Record<string, { propertyId: string; sourceUrl: string; sourceImageId: string }>
  >({});
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, p, a, e, an, conf] = await Promise.all([
        listPhotoSources(),
        listPhotoPresetsFn(),
        listPhotoAssets({ data: {} }),
        listPhotoEvents(),
        getPhotoAnalyticsFn(),
        getPhotoConfig(),
      ]);
      setSources(s as any[]);
      setPresets(p as any[]);
      setAssets(a as any[]);
      setEvents(e as any[]);
      setAnalytics(an);
      setCfg((conf as any).settings);
      setJob((conf as any).job);
      setPreset((conf as any).settings?.default_preset ?? "enhance_pro");
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
    if (!q) return sources;
    return sources.filter((p) =>
      [p.title, p.cities?.name, p.quarters?.name]
        .filter(Boolean)
        .some((x: string) => String(x).toLowerCase().includes(q)),
    );
  }, [sources, query]);

  const selectedList = Object.values(selected);
  const open = assets.find((a) => a.id === openId) ?? null;

  const toggle = (img: any, propertyId: string) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[img.id]) delete next[img.id];
      else next[img.id] = { propertyId, sourceUrl: img.url, sourceImageId: img.id };
      return next;
    });

  const processSelected = async () => {
    if (selectedList.length === 0) {
      toast.error("Изберете поне една снимка");
      return;
    }
    setBusy(true);
    let ok = 0;
    let bad = 0;
    for (const item of selectedList) {
      try {
        await processPhotoFn({ data: { ...item, presetCode: preset, extraPrompt: extra || null } });
        ok += 1;
      } catch (err) {
        bad += 1;
        toast.error(err instanceof Error ? err.message : "Грешка при обработка");
      }
    }
    setBusy(false);
    setSelected({});
    await load();
    toast.success(`Обработени ${ok}${bad ? ` · грешки ${bad}` : ""}`);
  };

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">AI Обработка на снимки</h1>
          <p className="mt-1 text-sm text-primary/70">
            №12 — подобрение, HDR и виртуално обзавеждане
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              void act(
                () => runPhotoQueueNow({ data: {} }),
                (r: any) =>
                  r.skipped
                    ? `Не се изпълни: ${r.skipped}`
                    : `Обработени ${r.processed} · готови ${r.done} · грешки ${r.errors}`,
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
                () => resumePhotoJobFn(),
                () => "Автоматизацията е активирана",
              )
            }
            className="rounded-lg bg-rose-700 px-3 py-1.5 font-semibold text-white"
          >
            Активирай
          </button>
        </div>
      )}

      {analytics?.providers_configured?.length === 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Няма конфигуриран доставчик за обработка на снимки. Задайте <b>OPENAI_API_KEY</b> или{" "}
          <b>AI_GATEWAY_KEY</b> в променливите на Vercel.
        </div>
      )}

      {showCfg && cfg && (
        <section className="rounded-2xl border border-primary/20 bg-[#fffaf3] p-5" data-crm-themed>
          <h2 className="font-display text-xl text-primary">Настройки на автоматизацията</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["enabled", "Активна", "bool"],
              ["ai_enabled", "AI обработка", "bool"],
              ["auto_queue_new", "Авт. опашка за нови снимки", "bool"],
              ["auto_apply_approved", "Авт. добавяне в галерията", "bool"],
              ["batch_size", "Пакет на пас", "num"],
              ["auto_approve_min_score", "Мин. оценка за авт. одобрение", "num"],
              ["max_per_property", "Макс. обработени/имот", "num"],
              ["retry_limit", "Опити при грешка", "num"],
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
              <span className="block font-semibold">Пресет по подразбиране</span>
              <select
                value={cfg.default_preset}
                onChange={(e) => setCfg({ ...cfg, default_preset: e.target.value })}
                className="mt-1 w-full rounded-lg border border-primary/30 bg-white px-3 py-2 text-primary"
              >
                {presets.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            onClick={() =>
              void act(
                () => savePhotoConfig({ data: cfg }),
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
          ["Обработени снимки", analytics?.total ?? 0],
          ["Покритие", `${analytics?.coverage ?? 0}%`],
          ["Средно качество", `${analytics?.avg_quality ?? 0}/100`],
          ["В галерията", analytics?.published ?? 0],
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
            ["process", "Обработка", Wand2],
            ["library", "Библиотека снимки", Images],
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

      {tab === "process" && (
        <section className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5" data-crm-themed>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-56 flex-1 text-sm text-primary">
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
              <span className="block font-semibold">Пресет</span>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                className="mt-1 rounded-lg border border-primary/30 bg-white px-3 py-2 text-primary"
              >
                {presets.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-56 flex-1 text-sm text-primary">
              <span className="block font-semibold">Допълнително указание (по избор)</span>
              <input
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="напр. по-топла светлина, без растения"
                className="mt-1 w-full rounded-lg border border-primary/30 bg-white px-3 py-2 text-primary"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void processSelected()}
              disabled={busy || selectedList.length === 0}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" /> Обработи сега ({selectedList.length})
            </button>
            <button
              onClick={() =>
                void act(
                  () => queuePhotosFn({ data: { items: selectedList, presetCode: preset } }),
                  (r: any) => `Добавени в опашката: ${r.queued}`,
                )
              }
              disabled={busy || selectedList.length === 0}
              className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" /> Добави в опашка
            </button>
            {selectedList.length > 0 && (
              <button
                onClick={() => setSelected({})}
                className="text-sm font-semibold text-primary/70 underline"
              >
                Изчисти избора
              </button>
            )}
          </div>

          <div className="mt-5 space-y-5">
            {filtered.map((p) => (
              <div key={p.id} className="rounded-xl border border-primary/15 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-primary">{p.title}</div>
                    <div className="text-xs text-primary/60">
                      {[p.cities?.name, p.quarters?.name].filter(Boolean).join(" · ") || "—"} ·
                      снимки: {p.images.length}
                    </div>
                  </div>
                  {p.images.length > 0 && (
                    <button
                      onClick={() =>
                        setSelected((prev) => {
                          const next = { ...prev };
                          for (const img of p.images)
                            next[img.id] = {
                              propertyId: p.id,
                              sourceUrl: img.url,
                              sourceImageId: img.id,
                            };
                          return next;
                        })
                      }
                      className="text-xs font-semibold text-primary underline"
                    >
                      Избери всички
                    </button>
                  )}
                </div>
                {p.images.length === 0 ? (
                  <div className="mt-3 text-sm text-primary/60">Няма оригинални снимки.</div>
                ) : (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {p.images.map((img: any) => {
                      const on = Boolean(selected[img.id]);
                      return (
                        <button
                          key={img.id}
                          onClick={() => toggle(img, p.id)}
                          className={`relative overflow-hidden rounded-lg border-2 ${on ? "border-[#C9A84C]" : "border-primary/15"}`}
                        >
                          <img
                            src={img.url}
                            alt={p.title}
                            loading="lazy"
                            className="h-24 w-full object-cover"
                          />
                          {on && (
                            <span className="absolute right-1 top-1 rounded bg-[#C9A84C] px-1.5 text-[10px] font-bold text-white">
                              избрана
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "library" && (
        <section className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5" data-crm-themed>
          {assets.length === 0 ? (
            <div className="text-sm text-primary/70">Още няма обработени снимки.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((a) => (
                <div
                  key={a.id}
                  className="overflow-hidden rounded-xl border border-primary/15 bg-white"
                >
                  <div className="grid grid-cols-2">
                    <img
                      src={a.source_url}
                      alt="оригинал"
                      loading="lazy"
                      className="h-36 w-full object-cover"
                    />
                    {a.result_url ? (
                      <button onClick={() => setOpenId(a.id)}>
                        <img
                          src={a.result_url}
                          alt="обработена"
                          loading="lazy"
                          className="h-36 w-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-rose-50 p-2 text-center text-xs text-rose-900">
                        {a.error ?? "няма резултат"}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-3 text-sm text-primary">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{a.properties?.title ?? "—"}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[a.status] ?? ""}`}
                      >
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </div>
                    <div className="text-xs text-primary/60">
                      {KIND_LABEL[a.kind] ?? a.kind} · v{a.version} · {kb(a.bytes)} ·{" "}
                      {a.provider ?? "—"} · {dt(a.created_at)}
                    </div>
                    <div
                      className={`text-xs font-semibold ${scoreClass(Number(a.quality_score ?? 0))}`}
                    >
                      Качество: {a.quality_score}/100
                    </div>
                    {(a.issues ?? []).length > 0 && (
                      <ul className="list-disc pl-4 text-xs text-primary/70">
                        {a.issues.map((i: string) => (
                          <li key={i}>{i}</li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {a.status !== "approved" && a.result_url && (
                        <button
                          onClick={() =>
                            void act(
                              () =>
                                setPhotoStatusFn({ data: { assetId: a.id, status: "approved" } }),
                              () => "Одобрена",
                            )
                          }
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-amber-100"
                        >
                          Одобри
                        </button>
                      )}
                      {a.result_url && (
                        <>
                          <button
                            onClick={() =>
                              void act(
                                () => applyPhotoFn({ data: { assetId: a.id } }),
                                () => "Добавена в галерията",
                              )
                            }
                            className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary"
                          >
                            В галерията
                          </button>
                          <button
                            onClick={() =>
                              void act(
                                () => applyPhotoFn({ data: { assetId: a.id, asCover: true } }),
                                () => "Зададена като корица",
                              )
                            }
                            className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary"
                          >
                            Като корица
                          </button>
                        </>
                      )}
                      <button
                        onClick={() =>
                          void act(
                            () => setPhotoStatusFn({ data: { assetId: a.id, status: "rejected" } }),
                            () => "Отказана",
                          )
                        }
                        className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-800"
                      >
                        Откажи
                      </button>
                      <button
                        onClick={() =>
                          void act(
                            () => deletePhotoAssetFn({ data: { assetId: a.id } }),
                            () => "Изтрита",
                          )
                        }
                        className="flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-800"
                      >
                        <Trash2 className="h-3 w-3" /> Изтрий
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "analytics" && (
        <section className="grid gap-4 lg:grid-cols-2" data-crm-themed>
          <div className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5">
            <h2 className="font-display text-xl text-primary">По вид обработка</h2>
            <ul className="mt-3 space-y-2 text-sm text-primary">
              {Object.entries(analytics?.by_kind ?? {}).map(([k, v]) => (
                <li key={k} className="flex justify-between border-b border-primary/10 pb-1">
                  <span>{KIND_LABEL[k] ?? k}</span>
                  <span className="font-semibold">{v as number}</span>
                </li>
              ))}
              {Object.keys(analytics?.by_kind ?? {}).length === 0 && (
                <li className="text-primary/60">Няма данни.</li>
              )}
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5">
            <h2 className="font-display text-xl text-primary">Статуси и доставчици</h2>
            <ul className="mt-3 space-y-2 text-sm text-primary">
              {Object.entries(analytics?.by_status ?? {}).map(([k, v]) => (
                <li key={k} className="flex justify-between border-b border-primary/10 pb-1">
                  <span>{STATUS_LABEL[k] ?? k}</span>
                  <span className="font-semibold">{v as number}</span>
                </li>
              ))}
              {Object.entries(analytics?.by_provider ?? {}).map(([k, v]) => (
                <li key={k} className="flex justify-between border-b border-primary/10 pb-1">
                  <span>доставчик: {k}</span>
                  <span className="font-semibold">{v as number}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 text-sm text-primary/70">
              Средно време: {Math.round(Number(analytics?.avg_duration_ms ?? 0) / 1000)}с · среден
              размер: {kb(analytics?.avg_bytes)} · грешки: {analytics?.failed ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-5 lg:col-span-2">
            <h2 className="font-display text-xl text-primary">Обработки за последните 30 дни</h2>
            <div className="mt-3 flex h-32 items-end gap-1">
              {(analytics?.trend ?? []).map((d: any) => (
                <div
                  key={d.day}
                  title={`${d.day}: ${d.count}`}
                  className="flex-1 rounded-t bg-primary/70"
                  style={{ height: `${Math.min(100, d.count * 12)}%` }}
                />
              ))}
              {(analytics?.trend ?? []).length === 0 && (
                <div className="text-sm text-primary/60">Няма данни.</div>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "log" && (
        <section
          className="overflow-hidden rounded-2xl border border-primary/15 bg-[#fffaf3]"
          data-crm-themed
        >
          <table className="w-full text-left text-sm text-primary">
            <thead className="bg-primary/10 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2">Дата</th>
                <th className="px-4 py-2">Действие</th>
                <th className="px-4 py-2">Имот</th>
                <th className="px-4 py-2">Съобщение</th>
                <th className="px-4 py-2">Автор</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-primary/10">
                  <td className="px-4 py-2 whitespace-nowrap">{dt(e.created_at)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${e.status === "error" ? "bg-rose-100 text-rose-900" : "bg-emerald-100 text-emerald-900"}`}
                    >
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-2">{e.properties?.title ?? "—"}</td>
                  <td className="px-4 py-2">{e.message ?? "—"}</td>
                  <td className="px-4 py-2">{e.actor}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-primary/60">
                    Няма записи.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {open?.result_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="max-h-full w-full max-w-6xl overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <figure>
                <img
                  src={open.source_url}
                  alt="оригинал"
                  className="w-full rounded-xl object-contain"
                />
                <figcaption className="mt-1 text-center text-xs text-amber-100">
                  Оригинал
                </figcaption>
              </figure>
              <figure>
                <img
                  src={open.result_url}
                  alt="обработена"
                  className="w-full rounded-xl object-contain"
                />
                <figcaption className="mt-1 text-center text-xs text-amber-100">
                  {KIND_LABEL[open.kind] ?? open.kind} · {open.quality_score}/100
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
