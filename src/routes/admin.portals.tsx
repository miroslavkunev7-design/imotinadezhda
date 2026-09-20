import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe2, ListChecks, Radio, RefreshCw, Rss, Settings2, Upload, Zap } from "lucide-react";
import {
  getPortalsAnalytics,
  getPortalsConfig,
  listPortalListings,
  listPortalLog,
  listPortalsAdmin,
  markPortalListingPublished,
  pushPortalListing,
  queuePortalProperties,
  removePortalListing,
  resumePortalsJob,
  runPortalsSyncNow,
  savePortalSettingsRow,
  savePortalsConfig,
} from "@/lib/portals.functions";

export const Route = createFileRoute("/admin/portals")({
  component: PortalsAdmin,
});

const STATUS_LABEL: Record<string, string> = {
  queued: "В опашка",
  published: "Публикувана",
  updated: "Обновена",
  pending_approval: "За ръчно публикуване",
  rejected: "Отказана",
  removed: "Свалена",
  error: "Грешка",
  skipped: "Пропусната",
};

const KIND_LABEL: Record<string, string> = { feed: "XML/JSON фид", api: "API", manual: "Ръчно" };

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");

function PortalsAdmin() {
  const [tab, setTab] = useState<"portals" | "listings" | "log">("portals");
  const [portals, setPortals] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [p, l, g, a, c] = await Promise.all([
        listPortalsAdmin(),
        listPortalListings({ data: { status: status || undefined } }),
        listPortalLog(),
        getPortalsAnalytics(),
        getPortalsConfig(),
      ]);
      setPortals(p as any[]);
      setListings(l as any[]);
      setLog(g as any[]);
      setAnalytics(a);
      setCfg((c as any).settings);
      setJob((c as any).job);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при зареждане");
    }
  }, [status]);

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
      setCfg(await savePortalsConfig({ data: p as never }));
      toast.success("Настройките са запазени");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при запис");
    }
  };

  const feedUrl = (p: any) =>
    `https://imotinadezhda.bg/api/public/portals/feed/${p.code}${p.feed_token ? `?token=${p.feed_token}` : ""}`;

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">Публикуване към портали</h1>
          <p className="mt-1 text-sm text-primary/70">
            №7 — автоматична синхронизация на обявите към Imot.bg, Imoti.net, Homes.bg и други
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              void act(
                () => runPortalsSyncNow({ data: {} }),
                (r) =>
                  r.ran
                    ? `Публикувани ${r.published} · обновени ${r.updated} · свалени ${r.removed} · грешки ${r.errors}`
                    : `Не се изпълни: ${r.reason}`,
              )
            }
            disabled={busy}
            className="crm-btn flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <Zap className="h-4 w-4" /> Синхронизирай сега
          </button>
          <button
            onClick={() =>
              void act(
                () => queuePortalProperties({ data: {} }),
                (r) => `В опашка: ${r.queued} · пропуснати: ${r.skipped}`,
              )
            }
            disabled={busy}
            className="crm-btn-outline flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <ListChecks className="h-4 w-4" /> Постави всички в опашка
          </button>
          <button
            onClick={() => setShowCfg((v) => !v)}
            className="crm-btn-outline flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            <Settings2 className="h-4 w-4" /> Настройки
          </button>
          <button
            onClick={() => void load()}
            disabled={busy}
            className="crm-btn-outline flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
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
                () => resumePortalsJob(),
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
            label: "Активни обяви в портали",
            value: analytics?.live ?? 0,
            sub: `${analytics?.publishedThisWeek ?? 0} нови тази седмица`,
            icon: Globe2,
          },
          {
            label: "В опашка",
            value: analytics?.queued ?? 0,
            sub: `${analytics?.pendingApproval ?? 0} за ръчно публикуване`,
            icon: ListChecks,
          },
          {
            label: "Активни портали",
            value: `${analytics?.activePortals ?? 0}/${analytics?.totalPortals ?? 0}`,
            sub: `${analytics?.syncedThisWeek ?? 0} успешни синхронизации`,
            icon: Rss,
          },
          {
            label: "Грешки",
            value: analytics?.errors ?? 0,
            sub: `${analytics?.errorsThisWeek ?? 0} тази седмица · AI текст в ${analytics?.aiUsedPct ?? 0}%`,
            icon: Radio,
          },
        ].map((k) => (
          <div key={k.label} className="crm-card rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-primary/60">
                {k.label}
              </span>
              <k.icon className="h-4 w-4 text-primary/50" />
            </div>
            <div className="crm-card-title mt-2 font-display text-3xl">{k.value}</div>
            <div className="mt-1 text-xs text-primary/60">{k.sub}</div>
          </div>
        ))}
      </div>

      {showCfg && cfg && (
        <section className="crm-card rounded-2xl p-5">
          <h2 className="crm-card-title font-display text-2xl">Правила за публикуване</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              {[
                { key: "enabled", label: "Автоматизацията е активна" },
                { key: "ai_enabled", label: "AI заглавия и описания" },
                { key: "auto_queue", label: "Авто-опашка на нови и променени имоти" },
                { key: "auto_remove_sold", label: "Авто-сваляне при продаден/скрит имот" },
                { key: "require_cover_image", label: "Изисквай основна снимка" },
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
                { key: "batch_size", label: "Обяви на цикъл", min: 1, max: 100 },
                { key: "min_price", label: "Минимална цена за публикуване", min: 0, max: 1000000 },
                { key: "retry_limit", label: "Опити при грешка", min: 1, max: 10 },
                { key: "resync_hours", label: "Часове до повторно изпращане", min: 1, max: 720 },
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
                    className="w-28 rounded-lg border border-primary/25 bg-white px-2 py-1 text-right text-primary"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { id: "portals", label: "Портали" },
          { id: "listings", label: "Обяви" },
          { id: "log", label: "Лог" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === t.id ? "bg-primary text-amber-100" : "border border-primary/25 text-primary"}`}
          >
            {t.label}
          </button>
        ))}
        {tab === "listings" && (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-primary/25 bg-white px-3 py-2 text-sm text-primary"
          >
            <option value="">Всички статуси</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        )}
      </div>

      {tab === "portals" && (
        <div className="grid gap-3 lg:grid-cols-2">
          {portals.map((p) => {
            const stat = analytics?.byPortal?.find((x: any) => x.id === p.id);
            return (
              <section key={p.id} className="crm-card rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="crm-card-title font-display text-2xl">{p.name}</h3>
                    <div className="mt-1 text-xs text-primary/60">
                      {KIND_LABEL[p.kind] ?? p.kind} · формат {String(p.feed_format).toUpperCase()}{" "}
                      · последна синхронизация {dt(p.last_sync_at)}
                    </div>
                    <div className="mt-1 text-sm text-primary/75">
                      Активни: <strong>{stat?.live ?? 0}</strong> · в опашка: {stat?.queued ?? 0} ·
                      грешки: {stat?.errors ?? 0}
                    </div>
                    {p.last_error && (
                      <div className="mt-1 text-xs text-rose-700">{p.last_error}</div>
                    )}
                    {p.notes && <div className="mt-1 text-xs text-primary/60">{p.notes}</div>}
                  </div>
                  <label className="crm-check flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={Boolean(p.is_active)}
                      onChange={(e) =>
                        void act(
                          () =>
                            savePortalSettingsRow({
                              data: { id: p.id, is_active: e.target.checked } as never,
                            }),
                          () => (e.target.checked ? "Порталът е активен" : "Порталът е спрян"),
                        )
                      }
                      className="h-4 w-4 accent-[#8b1a2b]"
                    />
                    Активен
                  </label>
                </div>

                {p.kind === "feed" && (
                  <div className="crm-field mt-3 p-3 text-xs">
                    <div className="crm-field-label">Адрес на фида за портала:</div>
                    <code className="crm-field-value mt-1 block break-all">{feedUrl(p)}</code>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <button
                    onClick={() =>
                      void act(
                        () => queuePortalProperties({ data: { portalId: p.id } }),
                        (r) => `В опашка: ${r.queued}`,
                      )
                    }
                    disabled={busy}
                    className="crm-btn-outline rounded-lg px-3 py-1 disabled:opacity-50"
                  >
                    Постави имотите в опашка
                  </button>
                  <button
                    onClick={() => setEdit(edit?.id === p.id ? null : { ...p })}
                    className="crm-btn-outline rounded-lg px-3 py-1"
                  >
                    {edit?.id === p.id ? "Затвори" : "Настройки на портала"}
                  </button>
                </div>

                {edit?.id === p.id && (
                  <div className="crm-field mt-3 grid gap-2 p-3 md:grid-cols-2">
                    {[
                      { k: "name", l: "Име", t: "text" },
                      { k: "endpoint_url", l: "API endpoint", t: "text" },
                      { k: "credentials_env", l: "Име на секрета с токена", t: "text" },
                      { k: "auth_header", l: "Име на header (при header авт.)", t: "text" },
                      { k: "feed_token", l: "Токен за фида", t: "text" },
                      { k: "max_listings", l: "Максимум обяви", t: "number" },
                      { k: "price_markup", l: "Надценка към цената (%)", t: "number" },
                    ].map((f) => (
                      <label key={f.k} className="text-sm text-primary">
                        <span className="mb-1 block font-semibold">{f.l}</span>
                        <input
                          type={f.t}
                          defaultValue={edit[f.k] ?? ""}
                          onBlur={(e) => {
                            const raw = e.target.value.trim();
                            const value = f.t === "number" ? Number(raw || 0) : raw || null;
                            void act(
                              () =>
                                savePortalSettingsRow({
                                  data: { id: p.id, [f.k]: value } as never,
                                }),
                              () => "Записано",
                            );
                          }}
                          className="w-full rounded-lg border border-primary/25 bg-white px-2 py-1 text-primary"
                        />
                      </label>
                    ))}
                    <label className="text-sm text-primary">
                      <span className="mb-1 block font-semibold">Тип интеграция</span>
                      <select
                        defaultValue={p.kind}
                        onChange={(e) =>
                          void act(
                            () =>
                              savePortalSettingsRow({
                                data: { id: p.id, kind: e.target.value } as never,
                              }),
                            () => "Записано",
                          )
                        }
                        className="w-full rounded-lg border border-primary/25 bg-white px-2 py-1 text-primary"
                      >
                        {["feed", "api", "manual"].map((k) => (
                          <option key={k} value={k}>
                            {KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-primary">
                      <span className="mb-1 block font-semibold">Формат</span>
                      <select
                        defaultValue={p.feed_format}
                        onChange={(e) =>
                          void act(
                            () =>
                              savePortalSettingsRow({
                                data: { id: p.id, feed_format: e.target.value } as never,
                              }),
                            () => "Записано",
                          )
                        }
                        className="w-full rounded-lg border border-primary/25 bg-white px-2 py-1 text-primary"
                      >
                        {["xml", "json", "csv"].map((k) => (
                          <option key={k} value={k}>
                            {k.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-primary">
                      <span className="mb-1 block font-semibold">Авторизация</span>
                      <select
                        defaultValue={p.auth_type}
                        onChange={(e) =>
                          void act(
                            () =>
                              savePortalSettingsRow({
                                data: { id: p.id, auth_type: e.target.value } as never,
                              }),
                            () => "Записано",
                          )
                        }
                        className="w-full rounded-lg border border-primary/25 bg-white px-2 py-1 text-primary"
                      >
                        {["none", "bearer", "basic", "header"].map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-end gap-2 text-sm font-semibold text-primary">
                      <input
                        type="checkbox"
                        defaultChecked={Boolean(p.ai_copy)}
                        onChange={(e) =>
                          void act(
                            () =>
                              savePortalSettingsRow({
                                data: { id: p.id, ai_copy: e.target.checked } as never,
                              }),
                            () => "Записано",
                          )
                        }
                        className="h-4 w-4 accent-[#8b1a2b]"
                      />
                      AI текст за този портал
                    </label>
                  </div>
                )}
              </section>
            );
          })}
          {portals.length === 0 && (
            <p className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-6 text-sm text-primary/70">
              Няма конфигурирани портали — пуснете миграцията за Автоматизация №7.
            </p>
          )}
        </div>
      )}

      {tab === "listings" && (
        <section className="overflow-x-auto rounded-2xl border border-primary/15 bg-[#fffaf3]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/15 text-left text-xs uppercase tracking-wide text-primary/60">
                <th className="p-3">Имот</th>
                <th className="p-3">Портал</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Цена</th>
                <th className="p-3">Публикувана</th>
                <th className="p-3">Синхр.</th>
                <th className="p-3">AI</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} className="border-b border-primary/10 text-primary">
                  <td className="p-3">
                    <div className="font-semibold">{l.ai_title ?? l.properties?.title ?? "—"}</div>
                    <div className="text-xs text-primary/60">
                      {l.properties?.cities?.name ?? "—"}
                    </div>
                  </td>
                  <td className="p-3">{l.listing_portals?.name ?? "—"}</td>
                  <td className="p-3">
                    {STATUS_LABEL[l.status] ?? l.status}
                    {l.last_error && <div className="text-xs text-rose-700">{l.last_error}</div>}
                  </td>
                  <td className="p-3">
                    {l.price_at_publish
                      ? `${Number(l.price_at_publish).toLocaleString("bg-BG")} ${l.properties?.currency ?? ""}`
                      : "—"}
                  </td>
                  <td className="p-3">{dt(l.published_at)}</td>
                  <td className="p-3">{dt(l.last_synced_at)}</td>
                  <td className="p-3">{l.ai_used ? "да" : "не"}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() =>
                          void act(
                            () => pushPortalListing({ data: { id: l.id } }),
                            (r) => `Резултат: ${r.result}`,
                          )
                        }
                        className="rounded-lg border border-primary/25 px-2 py-1 text-xs font-semibold text-primary"
                      >
                        Изпрати
                      </button>
                      {l.status === "pending_approval" && (
                        <button
                          onClick={() => {
                            const url = window.prompt(
                              "Линк към публикуваната обява (по желание)",
                              "",
                            );
                            void act(
                              () =>
                                markPortalListingPublished({
                                  data: { id: l.id, externalUrl: url || null } as never,
                                }),
                              () => "Отбелязана като публикувана",
                            );
                          }}
                          className="flex items-center gap-1 rounded-lg border border-primary/25 px-2 py-1 text-xs font-semibold text-primary"
                        >
                          <Upload className="h-3 w-3" /> Публикувана
                        </button>
                      )}
                      {l.external_url && (
                        <a
                          href={l.external_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-primary/25 px-2 py-1 text-xs font-semibold text-primary"
                        >
                          Отвори
                        </a>
                      )}
                      <button
                        onClick={() =>
                          void act(
                            () => removePortalListing({ data: { id: l.id } }),
                            () => "Свалена",
                          )
                        }
                        className="rounded-lg border border-rose-500/30 px-2 py-1 text-xs font-semibold text-rose-800"
                      >
                        Свали
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {listings.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-primary/60">
                    Няма обяви в този изглед.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {tab === "log" && (
        <section className="overflow-x-auto rounded-2xl border border-primary/15 bg-[#fffaf3]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/15 text-left text-xs uppercase tracking-wide text-primary/60">
                <th className="p-3">Дата</th>
                <th className="p-3">Действие</th>
                <th className="p-3">Портал</th>
                <th className="p-3">Имот</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Съобщение</th>
                <th className="p-3">мс</th>
              </tr>
            </thead>
            <tbody>
              {log.map((r) => (
                <tr key={r.id} className="border-b border-primary/10 text-primary">
                  <td className="p-3">{dt(r.created_at)}</td>
                  <td className="p-3 font-semibold">{r.action}</td>
                  <td className="p-3">{r.listing_portals?.name ?? "—"}</td>
                  <td className="p-3">{r.properties?.title ?? "—"}</td>
                  <td className="p-3">
                    {r.status === "error" ? (
                      <span className="text-rose-700">грешка</span>
                    ) : (
                      r.status
                    )}
                  </td>
                  <td className="p-3">
                    {r.message ?? "—"}
                    {r.http_status ? ` (HTTP ${r.http_status})` : ""}
                  </td>
                  <td className="p-3">{r.duration_ms ?? "—"}</td>
                </tr>
              ))}
              {log.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-primary/60">
                    Няма записи в лога.
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
