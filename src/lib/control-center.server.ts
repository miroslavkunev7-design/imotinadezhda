// Автоматизация №20 — Контролен Център и Анализи.
// Агрегира KPI от всички модули (лийдове, огледи, сделки, комисиони, реклама, имоти),
// пази дневни снимки, цели и AI брифинги. Без зависимост от Lovable.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions } from "@/lib/ai-provider";

const db = () => supabaseAdmin as unknown as { from: (t: string) => any };

const JOB_KEY = "control_center_snapshot";
const SETTINGS_KEY = "control_center";

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const nowIso = () => new Date().toISOString();
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const round2 = (v: number) => Math.round(v * 100) / 100;

export type ControlCenterSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  currency: string;
  snapshot_days: number;
  target_conversion: number;
  alert_low_leads: number;
  lease_seconds: number;
};

export const DEFAULT_CC_SETTINGS: ControlCenterSettings = {
  enabled: true,
  ai_enabled: true,
  currency: "EUR",
  snapshot_days: 90,
  target_conversion: 12,
  alert_low_leads: 5,
  lease_seconds: 300,
};

export async function getCcSettings(): Promise<ControlCenterSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return { ...DEFAULT_CC_SETTINGS, ...((data?.value ?? {}) as Partial<ControlCenterSettings>) };
}

export async function saveCcSettings(patch: Partial<ControlCenterSettings>) {
  const next = { ...(await getCcSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert({ key: SETTINGS_KEY, value: next, updated_at: nowIso() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return next;
}

export async function getCcJobState() {
  const { data } = await db().from("automation_jobs").select("*").eq("key", JOB_KEY).maybeSingle();
  return {
    key: JOB_KEY,
    paused: Boolean(data?.paused),
    paused_reason: data?.paused_reason ?? null,
    last_run_at: data?.last_run_at ?? null,
    locked_until: data?.locked_until ?? null,
    stats: (data?.stats ?? {}) as Record<string, string | number | boolean | null>,
  };
}

export async function resumeCcJob() {
  await db()
    .from("automation_jobs")
    .upsert(
      {
        key: JOB_KEY,
        paused: false,
        paused_reason: null,
        locked_until: null,
        updated_at: nowIso(),
      },
      { onConflict: "key" },
    );
  return getCcJobState();
}

async function logEvent(
  type: string,
  status: "ok" | "warn" | "error",
  message?: string | null,
  payload?: Record<string, unknown>,
  actor?: string | null,
) {
  try {
    await db()
      .from("kpi_events")
      .insert({
        event_type: type,
        status,
        message: message ?? null,
        payload: payload ?? {},
        actor: actor ?? "crm",
      });
  } catch {
    /* журналът не бива да чупи модула */
  }
}

// ------------------------------------------------------------------
// Безопасно четене (таблица може да липсва в дадена инсталация)
// ------------------------------------------------------------------
async function safeRows(
  table: string,
  columns: string,
  since?: string,
  dateColumn = "created_at",
): Promise<any[]> {
  try {
    let q = db().from(table).select(columns).limit(5000);
    if (since) q = q.gte(dateColumn, since);
    const { data, error } = await q;
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export type CcRange = { from: string; to: string; days: number };

export function resolveRange(days = 30): CcRange {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString(), days };
}

export type CcOverview = Awaited<ReturnType<typeof computeOverview>>;

// ------------------------------------------------------------------
// Основна агрегация
// ------------------------------------------------------------------
export async function computeOverview(days = 30) {
  const settings = await getCcSettings();
  const range = resolveRange(days);
  const since = range.from;

  const [
    leads,
    viewings,
    deals,
    commissions,
    spend,
    properties,
    brokers,
    prospects,
    reviews,
    campaignRows,
    budgetRows,
    clientRows,
  ] = await Promise.all([
    safeRows(
      "leads",
      "id, created_at, status, channel, source, score, desired_city, assigned_broker_id, first_contact_seconds",
      since,
    ),
    safeRows("viewings", "id, created_at, status", since),
    safeRows(
      "deals",
      "id, created_at, status, stage_code, price, agreed_price, commission_amount, broker_id",
      since,
    ),
    safeRows(
      "commissions",
      "id, created_at, status, gross_amount, total_amount, broker_amount, agency_amount, broker_id, paid_amount",
      since,
    ),
    safeRows("ad_spend", "id, day, spend, source", since.slice(0, 10), "day"),
    safeRows(
      "properties",
      "id, created_at, status, price, currency, property_type, is_published, broker_id",
    ),
    safeRows("brokers", "id, full_name, email, is_active"),
    safeRows("seller_prospects", "id, created_at, status, score", since),
    safeRows("reviews", "id, created_at, rating, status", since),
    safeRows(
      "ad_campaigns",
      "id, created_at, name, channel_code, status, city, start_date, end_date, budget_total, budget_daily, spent, currency, impressions, clicks, leads, deals, revenue",
    ),
    safeRows(
      "ad_budgets",
      "id, created_at, period_month, channel_code, campaign_id, planned, actual, currency, notes",
    ),
    safeRows("clients", "id, created_at, assigned_broker_id"),
  ]);

  const leadCount = leads.length;
  const qualified = leads.filter((l) =>
    ["qualified", "converted"].includes(String(l.status)),
  ).length;
  const contacted = leads.filter((l) => l.status !== "new").length;
  const isWon = (d: any) =>
    ["won", "closed", "completed"].includes(String(d.status)) ||
    ["closed", "won", "notary"].includes(String(d.stage_code));
  const isLost = (d: any) => ["lost", "cancelled", "canceled"].includes(String(d.status));
  const dealsWonRows = deals.filter(isWon);
  const dealsOpen = deals.filter((d) => !isWon(d) && !isLost(d)).length;
  const dealsLost = deals.filter(isLost).length;

  const revenue = dealsWonRows.reduce((s, d) => s + num(d.agreed_price ?? d.price), 0);
  const commissionTotal = commissions.reduce(
    (s, c) => s + num(c.total_amount || c.gross_amount),
    0,
  );
  const commissionPaid = commissions.reduce((s, c) => s + num(c.paid_amount), 0);
  const brokerPayout = commissions.reduce((s, c) => s + num(c.broker_amount), 0);
  const agencyNet = commissions.reduce((s, c) => s + num(c.agency_amount), 0);
  const campaignSpent = campaignRows.reduce((s, c) => s + num(c.spent), 0);
  const adSpend = spend.reduce((s, r) => s + num(r.spend), 0) || campaignSpent;
  const budgetPlanned =
    budgetRows.reduce((s, b) => s + num(b.planned), 0) ||
    campaignRows.reduce((s, c) => s + num(c.budget_total), 0);
  const budgetActual = budgetRows.reduce((s, b) => s + num(b.actual), 0) || campaignSpent;
  const campaignsActive = campaignRows.filter((c) =>
    ["active", "running", "live"].includes(String(c.status)),
  ).length;

  const viewingsDone = viewings.filter((v) => String(v.status) === "completed").length;
  const conversion = leadCount ? round2((dealsWonRows.length / leadCount) * 100) : 0;
  const leadToViewing = leadCount ? round2((viewings.length / leadCount) * 100) : 0;
  const cpl = leadCount ? round2(adSpend / leadCount) : 0;
  const cac = dealsWonRows.length ? round2(adSpend / dealsWonRows.length) : 0;
  const roi = adSpend > 0 ? round2(((commissionTotal - adSpend) / adSpend) * 100) : 0;
  const avgDeal = dealsWonRows.length ? round2(revenue / dealsWonRows.length) : 0;
  const responseSamples = leads.map((l) => num(l.first_contact_seconds)).filter((v) => v > 0);
  const avgResponseMin = responseSamples.length
    ? round2(responseSamples.reduce((s, v) => s + v, 0) / responseSamples.length / 60)
    : 0;
  const ratings = reviews.map((r) => num(r.rating)).filter((v) => v > 0);
  const avgRating = ratings.length
    ? round2(ratings.reduce((s, v) => s + v, 0) / ratings.length)
    : 0;

  const kpis = {
    leads: leadCount,
    contacted,
    qualified,
    viewings: viewings.length,
    viewings_done: viewingsDone,
    deals_open: dealsOpen,
    deals_won: dealsWonRows.length,
    deals_lost: dealsLost,
    revenue: round2(revenue),
    commission: round2(commissionTotal),
    commission_paid: round2(commissionPaid),
    broker_payout: round2(brokerPayout),
    agency_net: round2(agencyNet),
    ad_spend: round2(adSpend),
    campaigns_total: campaignRows.length,
    campaigns_active: campaignsActive,
    budget_planned: round2(budgetPlanned),
    budget_actual: round2(budgetActual),
    brokers_active: brokers.filter((b) => b.is_active !== false).length,
    clients: clientRows.length,
    properties_active: properties.filter((p) => p.is_published !== false).length,
    new_listings: properties.filter((p) => new Date(String(p.created_at)).toISOString() >= since)
      .length,
    seller_prospects: prospects.length,
    conversion,
    lead_to_viewing: leadToViewing,
    cpl,
    cac,
    roi,
    avg_deal: avgDeal,
    avg_response_min: avgResponseMin,
    avg_rating: avgRating,
  };

  // Дневен тренд
  const trendMap = new Map<
    string,
    {
      day: string;
      leads: number;
      viewings: number;
      deals: number;
      revenue: number;
      commission: number;
      spend: number;
    }
  >();
  for (let i = 0; i < range.days; i++) {
    const d = dayKey(new Date(new Date(since).getTime() + i * 86400000));
    trendMap.set(d, {
      day: d,
      leads: 0,
      viewings: 0,
      deals: 0,
      revenue: 0,
      commission: 0,
      spend: 0,
    });
  }
  const bump = (
    dateVal: unknown,
    patch: (row: NonNullable<ReturnType<typeof trendMap.get>>) => void,
  ) => {
    const key = String(dateVal ?? "").slice(0, 10);
    const row = trendMap.get(key);
    if (row) patch(row);
  };
  leads.forEach((l) =>
    bump(l.created_at, (r) => {
      r.leads += 1;
    }),
  );
  viewings.forEach((v) =>
    bump(v.created_at, (r) => {
      r.viewings += 1;
    }),
  );
  dealsWonRows.forEach((d) =>
    bump(d.created_at, (r) => {
      r.deals += 1;
      r.revenue += num(d.agreed_price ?? d.price);
    }),
  );
  commissions.forEach((c) =>
    bump(c.created_at, (r) => {
      r.commission += num(c.total_amount || c.gross_amount);
    }),
  );
  spend.forEach((s) =>
    bump(s.day, (r) => {
      r.spend += num(s.spend);
    }),
  );
  const trend = [...trendMap.values()].map((r) => ({
    ...r,
    revenue: round2(r.revenue),
    commission: round2(r.commission),
    spend: round2(r.spend),
  }));

  // По брокери
  const brokerName = (id: unknown) => {
    const b = brokers.find((x) => String(x.id) === String(id));
    return (b?.full_name || b?.name || (id ? "Брокер" : "Без брокер")) as string;
  };
  type BrokerAgg = {
    id: string;
    name: string;
    leads: number;
    deals_won: number;
    revenue: number;
    commission: number;
    payout: number;
    listings: number;
    clients: number;
  };
  const brokerMap = new Map<string, BrokerAgg>();
  const brokerRow = (id: unknown) => {
    const key = String(id ?? "none");
    if (!brokerMap.has(key))
      brokerMap.set(key, {
        id: key,
        name: brokerName(id),
        leads: 0,
        deals_won: 0,
        revenue: 0,
        commission: 0,
        payout: 0,
        listings: 0,
        clients: 0,
      });
    return brokerMap.get(key)!;
  };
  // Всички активни брокери се показват, дори с нулеви резултати за периода
  brokers.filter((b) => b.is_active !== false).forEach((b) => brokerRow(b.id));
  leads.forEach((l) => {
    brokerRow(l.assigned_broker_id).leads += 1;
  });
  clientRows.forEach((c) => {
    brokerRow(c.assigned_broker_id).clients += 1;
  });
  properties.forEach((p) => {
    if (p.broker_id) brokerRow(p.broker_id).listings += 1;
  });
  dealsWonRows.forEach((d) => {
    const row = brokerRow(d.broker_id);
    row.deals_won += 1;
    row.revenue += num(d.agreed_price ?? d.price);
  });
  commissions.forEach((c) => {
    const row = brokerRow(c.broker_id);
    row.commission += num(c.total_amount || c.gross_amount);
    row.payout += num(c.broker_amount);
  });
  const brokerStats = [...brokerMap.values()]
    .map((r) => ({
      ...r,
      revenue: round2(r.revenue),
      commission: round2(r.commission),
      payout: round2(r.payout),
      conversion: r.leads ? round2((r.deals_won / r.leads) * 100) : 0,
    }))
    .sort((a, b) => b.commission - a.commission || b.deals_won - a.deals_won);

  // По канали и градове
  const groupCount = (rows: any[], field: string) => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const key = String(r[field] ?? "—") || "—";
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return [...map.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  };
  const channels = groupCount(leads, "channel");
  const sources = groupCount(leads, "source").slice(0, 12);
  const cities = groupCount(leads, "desired_city").slice(0, 12);
  const dealStages = groupCount(deals, "stage_code");
  const commissionStatuses = groupCount(commissions, "status");

  // Фуния
  const funnel = [
    { code: "leads", label: "Лийдове", value: leadCount },
    { code: "contacted", label: "Контактувани", value: contacted },
    { code: "qualified", label: "Квалифицирани", value: qualified },
    { code: "viewings", label: "Огледи", value: viewings.length },
    { code: "deals_open", label: "Активни сделки", value: dealsOpen },
    { code: "deals_won", label: "Сключени", value: dealsWonRows.length },
  ];

  // Цели
  const targets = await listTargets();
  const targetProgress = targets.map((t: any) => {
    const key = String(t.metric);
    const actual = num((kpis as Record<string, unknown>)[key]);
    const target = num(t.target);
    return {
      ...t,
      actual: round2(actual),
      progress: target > 0 ? round2((actual / target) * 100) : 0,
    };
  });

  // Известия
  const alerts: { level: "info" | "warn" | "error"; message: string }[] = [];
  if (leadCount < num(settings.alert_low_leads))
    alerts.push({ level: "warn", message: `Малко лийдове за периода: ${leadCount}` });
  if (conversion < num(settings.target_conversion))
    alerts.push({
      level: "warn",
      message: `Конверсия ${conversion}% под целта ${settings.target_conversion}%`,
    });
  if (adSpend > 0 && roi < 0)
    alerts.push({ level: "error", message: `Отрицателна възвръщаемост на рекламата: ${roi}%` });
  if (avgResponseMin > 30)
    alerts.push({ level: "warn", message: `Средно време за първи контакт ${avgResponseMin} мин.` });
  if (!alerts.length)
    alerts.push({ level: "info", message: "Няма отклонения от заложените прагове." });

  return {
    range: { from: since, to: range.to, days: range.days },
    currency: settings.currency,
    kpis,
    trend,
    funnel,
    brokers: brokerStats,
    channels,
    sources,
    cities,
    dealStages,
    commissionStatuses,
    campaigns: campaignRows
      .map((c) => ({
        id: String(c.id),
        name: String(c.name ?? "—"),
        channel: String(c.channel_code ?? "—"),
        status: String(c.status ?? "—"),
        city: c.city ? String(c.city) : "—",
        budget_total: round2(num(c.budget_total)),
        spent: round2(num(c.spent)),
        leads: num(c.leads),
        deals: num(c.deals),
        revenue: round2(num(c.revenue)),
        clicks: num(c.clicks),
        impressions: num(c.impressions),
        currency: String(c.currency ?? settings.currency),
      }))
      .sort((a, b) => b.spent - a.spent || b.budget_total - a.budget_total),
    budgets: budgetRows
      .map((b) => ({
        id: String(b.id),
        period: String(b.period_month ?? "—").slice(0, 7),
        channel: String(b.channel_code ?? "—"),
        planned: round2(num(b.planned)),
        actual: round2(num(b.actual)),
        currency: String(b.currency ?? settings.currency),
        notes: b.notes ? String(b.notes) : "",
      }))
      .sort((a, b) => (a.period < b.period ? 1 : -1)),
    deals: deals
      .map((d) => ({
        id: String(d.id),
        stage: String(d.stage_code ?? "—"),
        status: String(d.status ?? "—"),
        price: round2(num(d.agreed_price ?? d.price)),
        commission: round2(num(d.commission_amount)),
        broker: brokerName(d.broker_id),
        created_at: String(d.created_at ?? ""),
      }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 50),
    targets: targetProgress,
    alerts,
  };
}

// ------------------------------------------------------------------
// Цели
// ------------------------------------------------------------------
export async function listTargets() {
  const { data, error } = await db()
    .from("kpi_targets")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(200);
  if (error) return [];
  return data ?? [];
}

export async function saveTarget(input: {
  id?: string | null;
  metric: string;
  period?: string;
  period_start?: string;
  scope?: string;
  scope_ref?: string | null;
  target: number;
  label?: string | null;
}) {
  const monthStart = new Date();
  monthStart.setDate(1);
  const row = {
    metric: String(input.metric).trim(),
    period: input.period ?? "month",
    period_start: input.period_start ?? dayKey(monthStart),
    scope: input.scope ?? "agency",
    scope_ref: input.scope_ref ?? null,
    target: round2(num(input.target)),
    label: input.label ?? null,
    updated_at: nowIso(),
  };
  const payload = input.id ? { id: input.id, ...row } : row;
  const { error } = await db()
    .from("kpi_targets")
    .upsert(payload, { onConflict: "metric,period,period_start,scope,scope_ref" });
  if (error) throw new Error(error.message);
  await logEvent("target", "ok", `Цел ${row.metric}: ${row.target}`, row);
  return { ok: true };
}

export async function deleteTarget(id: string) {
  const { error } = await db().from("kpi_targets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ------------------------------------------------------------------
// Снимки
// ------------------------------------------------------------------
export async function listSnapshots(limit = 120) {
  const { data, error } = await db()
    .from("kpi_snapshots")
    .select("*")
    .eq("scope", "agency")
    .order("snapshot_date", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

export async function takeSnapshot(actor?: string | null) {
  const overview = await computeOverview(1);
  const today = dayKey(new Date());
  const k = overview.kpis;
  const row = {
    snapshot_date: today,
    scope: "agency",
    scope_ref: null,
    leads: k.leads,
    qualified: k.qualified,
    viewings: k.viewings,
    deals_open: k.deals_open,
    deals_won: k.deals_won,
    revenue: k.revenue,
    commission: k.commission,
    ad_spend: k.ad_spend,
    properties_active: k.properties_active,
    new_listings: k.new_listings,
    seller_prospects: k.seller_prospects,
    conversion: k.conversion,
    cpl: k.cpl,
    roi: k.roi,
    currency: overview.currency,
    payload: { kpis: k, alerts: overview.alerts },
  };
  const { error } = await db()
    .from("kpi_snapshots")
    .upsert(row, { onConflict: "snapshot_date,scope,scope_ref" });
  if (error) throw new Error(error.message);
  await logEvent(
    "snapshot",
    "ok",
    `Снимка за ${today}`,
    { leads: k.leads, deals_won: k.deals_won },
    actor,
  );
  return { ok: true, snapshot: row };
}

export async function listCcEvents(limit = 120) {
  const { data, error } = await db()
    .from("kpi_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

// ------------------------------------------------------------------
// AI брифинг
// ------------------------------------------------------------------
export async function listBriefings(limit = 20) {
  const { data, error } = await db()
    .from("kpi_briefings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

export async function generateBriefing(days = 30, actor?: string | null) {
  const settings = await getCcSettings();
  if (!settings.ai_enabled) throw new Error("AI обобщенията са изключени в настройките.");
  const overview = await computeOverview(days);

  const prompt = [
    "Ти си директор анализи в българска агенция за недвижими имоти.",
    'Върни само JSON: {"summary": string, "highlights": string[], "actions": string[]}.',
    "summary: до 700 знака на български. highlights: до 5 кратки извода. actions: до 5 конкретни действия.",
    `Период: последните ${days} дни. Валута: ${overview.currency}.`,
    `KPI: ${JSON.stringify(overview.kpis)}`,
    `Брокери: ${JSON.stringify(overview.brokers.slice(0, 8))}`,
    `Канали: ${JSON.stringify(overview.channels.slice(0, 8))}`,
    `Фуния: ${JSON.stringify(overview.funnel)}`,
    `Известия: ${JSON.stringify(overview.alerts)}`,
  ].join("\n");

  let parsed: { summary?: string; highlights?: string[]; actions?: string[] } = {};
  try {
    const res = await aiChatCompletions({
      messages: [
        { role: "system", content: "Отговаряш само с валиден JSON без markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    } as never);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : {};
  } catch (e) {
    await logEvent("ai_briefing", "error", (e as Error).message, {}, actor);
    throw new Error(`AI обобщението не бе генерирано: ${(e as Error).message}`);
  }

  const record = {
    period_label: `Последни ${days} дни`,
    summary: String(parsed.summary ?? "").slice(0, 4000) || "Няма обобщение.",
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 5) : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 5) : [],
    metrics: overview.kpis,
    actor: actor ?? "crm",
  };
  const { data, error } = await db().from("kpi_briefings").insert(record).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  await logEvent("ai_briefing", "ok", "Генериран AI брифинг", { days }, actor);
  return data ?? record;
}

export async function deleteBriefing(id: string) {
  const { error } = await db().from("kpi_briefings").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ------------------------------------------------------------------
// Табло + cron
// ------------------------------------------------------------------
export async function getControlCenterBoard(days = 30) {
  const [overview, snapshots, briefings, events, settings, job] = await Promise.all([
    computeOverview(days),
    listSnapshots(),
    listBriefings(),
    listCcEvents(),
    getCcSettings(),
    getCcJobState(),
  ]);
  return { overview, snapshots, briefings, events, settings, job };
}

export async function runControlCenterSweep() {
  const settings = await getCcSettings();
  const job = await getCcJobState();
  if (!settings.enabled) return { skipped: "disabled" as const };
  if (job.paused) return { skipped: "paused" as const };
  if (job.locked_until && new Date(job.locked_until).getTime() > Date.now())
    return { skipped: "locked" as const };

  const lockedUntil = new Date(
    Date.now() + num(settings.lease_seconds || 300) * 1000,
  ).toISOString();
  await db()
    .from("automation_jobs")
    .upsert(
      { key: JOB_KEY, locked_until: lockedUntil, updated_at: nowIso() },
      { onConflict: "key" },
    );

  try {
    const snap = await takeSnapshot("cron");
    const stats = {
      leads: snap.snapshot.leads,
      deals_won: snap.snapshot.deals_won,
      revenue: snap.snapshot.revenue,
    };
    await db()
      .from("automation_jobs")
      .upsert(
        { key: JOB_KEY, locked_until: null, last_run_at: nowIso(), stats, updated_at: nowIso() },
        { onConflict: "key" },
      );
    return { ok: true, stats };
  } catch (e) {
    await db()
      .from("automation_jobs")
      .upsert({ key: JOB_KEY, locked_until: null, updated_at: nowIso() }, { onConflict: "key" });
    await logEvent("snapshot", "error", (e as Error).message, {}, "cron");
    throw e;
  }
}
