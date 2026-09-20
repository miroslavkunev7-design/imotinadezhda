import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Brain,
  RefreshCw,
  Sparkles,
  Target,
  Wallet,
  Clock,
  MapPin,
  ChevronRight,
  Settings2,
} from "lucide-react";
import {
  getQualificationAnalytics,
  getQualificationConfig,
  getQualificationHistory,
  listQualifiedLeads,
  runQualification,
  runQualificationBatch,
  saveQualificationConfig,
} from "@/lib/qualification.functions";

export const Route = createFileRoute("/admin/qualification")({
  component: QualificationAdmin,
});

type Lead = {
  id: string;
  created_at: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  channel: string;
  lead_type: string | null;
  qualification_status: string | null;
  qualification_score: number | null;
  qualification_grade: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  desired_city: string | null;
  desired_district: string | null;
  desired_property_type: string | null;
  rooms_min: number | null;
  timeframe: string | null;
  financing: string | null;
  ai_summary: string | null;
  properties: { title: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Изчаква",
  qualified: "Квалифициран",
  nurture: "Подхранване",
  disqualified: "Неподходящ",
};

const TIMEFRAME_LABELS: Record<string, string> = {
  immediate: "Веднага",
  "1_3_months": "1–3 месеца",
  "3_6_months": "3–6 месеца",
  "6_12_months": "6–12 месеца",
  exploring: "Проучва",
};

const FINANCING_LABELS: Record<string, string> = {
  cash: "В брой",
  mortgage_approved: "Одобрен кредит",
  mortgage_needed: "Нужен кредит",
  unknown: "Неизвестно",
};

const TYPE_LABELS: Record<string, string> = {
  apartment: "Апартамент",
  studio: "Студио",
  house: "Къща",
  land: "Земя / парцел",
  office: "Офис",
  shop: "Магазин",
  warehouse: "Склад",
  garage: "Гараж",
  hotel: "Хотел",
  other: "Друго",
};

const WEIGHT_LABELS: Record<string, string> = {
  budget: "Бюджет",
  timeframe: "Срок",
  financing: "Финансиране",
  location: "Локация / тип",
  contactability: "Контакт",
  engagement: "Ангажираност",
};

function gradeTone(grade: string | null) {
  if (grade === "A") return "bg-emerald-600/15 text-emerald-800 border-emerald-600/30";
  if (grade === "B") return "bg-amber-500/15 text-amber-800 border-amber-600/30";
  if (grade === "C") return "bg-orange-500/15 text-orange-800 border-orange-600/30";
  return "bg-primary/10 text-primary border-primary/25";
}

function money(v: number | null, currency: string | null) {
  if (!v) return "—";
  return `${new Intl.NumberFormat("bg-BG").format(v)} ${currency === "BGN" ? "лв." : "€"}`;
}

function QualificationAdmin() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [grade, setGrade] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rows, stats, cfg] = await Promise.all([
        listQualifiedLeads({
          data: {
            status: status || undefined,
            grade: grade || undefined,
            search: search || undefined,
          },
        }),
        getQualificationAnalytics(),
        getQualificationConfig(),
      ]);
      setLeads(rows as unknown as Lead[]);
      setAnalytics(stats);
      setConfig(cfg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка при зареждане");
    }
  }, [status, grade, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return setHistory([]);
    getQualificationHistory({ data: { leadId: open } })
      .then((r) => setHistory(r as any[]))
      .catch(() => setHistory([]));
  }, [open]);

  const qualifyOne = async (id: string) => {
    setBusy(true);
    try {
      const rec: any = await runQualification({ data: { leadId: id } });
      toast.success(
        `Скор ${rec?.score ?? "—"} (${rec?.grade ?? "—"}) · ${STATUS_LABELS[rec?.status ?? ""] ?? rec?.status ?? ""}`,
      );
      if (open === id) setHistory((h) => [rec, ...h]);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка при квалификация");
    } finally {
      setBusy(false);
    }
  };

  const qualifyBatch = async () => {
    setBusy(true);
    try {
      const r = await runQualificationBatch({ data: { limit: 25 } });
      toast.success(
        `Обработени: ${r.processed} · квалифицирани: ${r.qualified} · грешки: ${r.failed}`,
      );
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const patchConfig = async (patch: Record<string, unknown>) => {
    try {
      const next = await saveQualificationConfig({ data: patch as never });
      setConfig(next);
      toast.success("Настройките са запазени");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Грешка при запис");
    }
  };

  const cities = useMemo(
    () => Object.entries((analytics?.byCity ?? {}) as Record<string, number>).slice(0, 6),
    [analytics],
  );
  const grades = useMemo(
    () => Object.entries((analytics?.byGrade ?? {}) as Record<string, number>),
    [analytics],
  );
  const timeframes = useMemo(
    () => Object.entries((analytics?.byTimeframe ?? {}) as Record<string, number>),
    [analytics],
  );

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-primary">AI Квалификация на клиенти</h1>
          <p className="mt-1 text-sm text-primary/70">
            №3 AI Qualification — бюджет · район · интерес · скоринг ({leads.length} записа)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={qualifyBatch}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#7a0d22] px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" /> Квалифицирай изчакващите
          </button>
          <button
            onClick={() => setShowConfig((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary"
          >
            <Settings2 className="h-4 w-4" /> Скоринг настройки
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

      {/* KPI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Квалифицирани",
            value: analytics?.qualified ?? 0,
            sub: `${analytics?.qualifiedPct ?? 0}% от всички`,
            icon: Target,
          },
          {
            label: "Среден скор",
            value: analytics?.avgScore ?? 0,
            sub: `${analytics?.scored ?? 0} оценени`,
            icon: Brain,
          },
          {
            label: "Среден бюджет",
            value: money(analytics?.avgBudget ?? null, "EUR"),
            sub: "по заявени данни",
            icon: Wallet,
          },
          {
            label: "Изчакват оценка",
            value: analytics?.pending ?? 0,
            sub: `Ø ${analytics?.avgMatches ?? 0} съвпадения`,
            icon: Clock,
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
          <h2 className="font-display text-2xl text-primary">Модел на скоринга</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {[
                { key: "enabled", label: "Автоматизацията е активна" },
                { key: "ai_enabled", label: "AI извличане (иначе само евристика)" },
                { key: "auto_on_capture", label: "Квалифицирай веднага при нов лийд" },
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
              <label className="block rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-primary">
                Праг „квалифициран“: <strong>{config.qualified_threshold}</strong>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={config.qualified_threshold}
                  onChange={(e) =>
                    setConfig({ ...config, qualified_threshold: Number(e.target.value) })
                  }
                  onMouseUp={(e) =>
                    void patchConfig({
                      qualified_threshold: Number((e.target as HTMLInputElement).value),
                    })
                  }
                  className="mt-2 w-full accent-[#8b1a2b]"
                />
              </label>
              <label className="block rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-primary">
                Праг „подхранване“: <strong>{config.nurture_threshold}</strong>
                <input
                  type="range"
                  min={0}
                  max={99}
                  value={config.nurture_threshold}
                  onChange={(e) =>
                    setConfig({ ...config, nurture_threshold: Number(e.target.value) })
                  }
                  onMouseUp={(e) =>
                    void patchConfig({
                      nurture_threshold: Number((e.target as HTMLInputElement).value),
                    })
                  }
                  className="mt-2 w-full accent-[#8b1a2b]"
                />
              </label>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary/60">
                Тегла (общо{" "}
                {Object.values(config.weights ?? {}).reduce((a: number, b) => a + Number(b), 0)})
              </p>
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
          </div>
        </section>
      )}

      {/* Аналитика по сегменти */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-4">
          <h3 className="text-sm font-semibold text-primary">Класове</h3>
          <ul className="mt-3 space-y-2 text-sm text-primary/80">
            {grades.length === 0 && <li className="text-primary/50">Няма данни</li>}
            {grades.map(([g, n]) => (
              <li key={g} className="flex items-center justify-between">
                <span className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${gradeTone(g)}`}>
                  {g}
                </span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-4">
          <h3 className="text-sm font-semibold text-primary">Срокове</h3>
          <ul className="mt-3 space-y-2 text-sm text-primary/80">
            {timeframes.length === 0 && <li className="text-primary/50">Няма данни</li>}
            {timeframes.map(([t, n]) => (
              <li key={t} className="flex items-center justify-between">
                <span>{TIMEFRAME_LABELS[t] ?? t}</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-primary/15 bg-[#fffaf3] p-4">
          <h3 className="text-sm font-semibold text-primary">Търсени локации</h3>
          <ul className="mt-3 space-y-2 text-sm text-primary/80">
            {cities.length === 0 && <li className="text-primary/50">Няма данни</li>}
            {cities.map(([c, n]) => (
              <li key={c} className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary/50" /> {c}
                </span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Филтри */}
      <div className="flex flex-wrap items-center gap-2">
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
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="rounded-xl border border-primary/25 bg-white px-3 py-2 text-sm text-primary"
        >
          <option value="">Всички класове</option>
          {["A", "B", "C", "D"].map((g) => (
            <option key={g} value={g}>
              Клас {g}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Търси име, телефон, град…"
          className="min-w-[220px] flex-1 rounded-xl border border-primary/25 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/40"
        />
      </div>

      {/* Таблица */}
      <div className="overflow-hidden rounded-2xl border border-primary/15 bg-[#fffaf3]">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary/5 text-xs uppercase tracking-wide text-primary/70">
            <tr>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Скор</th>
              <th className="px-4 py-3">Бюджет</th>
              <th className="px-4 py-3">Локация / тип</th>
              <th className="px-4 py-3">Срок</th>
              <th className="px-4 py-3">Финансиране</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-primary/60">
                  Няма лийдове по този филтър.
                </td>
              </tr>
            )}
            {leads.map((l) => (
              <Fragment key={l.id}>
                <tr className="border-t border-primary/10 text-primary">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{l.full_name}</div>
                    <div className="text-xs text-primary/60">{l.phone ?? l.email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-lg border px-2 py-0.5 text-xs font-bold ${gradeTone(l.qualification_grade)}`}
                    >
                      {l.qualification_score ?? "—"} · {l.qualification_grade ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {l.budget_min || l.budget_max
                      ? `${money(l.budget_min, l.currency)} – ${money(l.budget_max, l.currency)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {[l.desired_city, l.desired_district].filter(Boolean).join(", ") || "—"}
                    <div className="text-primary/60">
                      {l.desired_property_type
                        ? (TYPE_LABELS[l.desired_property_type] ?? l.desired_property_type)
                        : "—"}
                      {l.rooms_min ? ` · ${l.rooms_min}+ стаи` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {l.timeframe ? (TIMEFRAME_LABELS[l.timeframe] ?? l.timeframe) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {l.financing ? (FINANCING_LABELS[l.financing] ?? l.financing) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {STATUS_LABELS[l.qualification_status ?? "pending"] ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void qualifyOne(l.id)}
                        disabled={busy}
                        className="rounded-lg border border-primary/25 px-2 py-1 text-xs font-semibold text-primary disabled:opacity-50"
                      >
                        Оцени
                      </button>
                      <button
                        onClick={() => setOpen(open === l.id ? null : l.id)}
                        className="rounded-lg border border-primary/25 px-2 py-1 text-xs font-semibold text-primary"
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 transition ${open === l.id ? "rotate-90" : ""}`}
                        />
                      </button>
                    </div>
                  </td>
                </tr>
                {open === l.id && (
                  <tr className="border-t border-primary/10 bg-white/60">
                    <td colSpan={8} className="px-4 py-4">
                      {l.ai_summary && <p className="mb-3 text-sm text-primary">{l.ai_summary}</p>}
                      {history.length === 0 && (
                        <p className="text-sm text-primary/60">Няма записана квалификация.</p>
                      )}
                      <div className="space-y-3">
                        {history.map((h) => (
                          <div
                            key={h.id}
                            className="rounded-xl border border-primary/15 bg-[#fffaf3] p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-primary/70">
                              <span>
                                {new Date(h.created_at).toLocaleString("bg-BG")} · {h.source} ·{" "}
                                {h.model ?? "—"}
                              </span>
                              <span
                                className={`rounded-lg border px-2 py-0.5 font-bold ${gradeTone(h.grade)}`}
                              >
                                {h.score} · {h.grade}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-primary">
                              {Object.entries((h.breakdown ?? {}) as Record<string, number>).map(
                                ([k, v]) => (
                                  <span key={k} className="rounded-lg bg-primary/5 px-2 py-1">
                                    {WEIGHT_LABELS[k] ?? k}: <strong>{v}</strong>
                                  </span>
                                ),
                              )}
                            </div>
                            {h.recommended_action && (
                              <p className="mt-2 text-sm font-semibold text-primary">
                                ➜ {h.recommended_action}
                              </p>
                            )}
                            {Array.isArray(h.next_questions) && h.next_questions.length > 0 && (
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-primary/80">
                                {h.next_questions.map((q: string, i: number) => (
                                  <li key={i}>{q}</li>
                                ))}
                              </ul>
                            )}
                            <p className="mt-2 text-xs text-primary/60">
                              Съвпадащи имоти: {h.matched_properties ?? 0}
                              {Array.isArray(h.missing_fields) && h.missing_fields.length > 0
                                ? ` · липсва: ${h.missing_fields.join(", ")}`
                                : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
