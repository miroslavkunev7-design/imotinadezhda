// Автоматизация №18 — Маркетинг Автоматизация: кампании, бюджети, разходи, ROI, AI криейтиви.
// Без зависимост от Lovable: Supabase + конфигуриран AI провайдър.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions } from "@/lib/ai-provider";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: unknown) => any;
  };

const JOB_KEY = "marketing_sweep";
const SETTINGS_KEY = "marketing";

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v: number) => Math.round(v * 100) / 100;
const monthStart = (d = new Date()) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;

export type MarketingSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  default_currency: string;
  monthly_budget: number;
  budget_alert_percent: number;
  auto_pause_on_budget: boolean;
  target_cpl: number;
  max_cpl: number;
  auto_pause_bad_cpl: boolean;
};

export const DEFAULT_MARKETING_SETTINGS: MarketingSettings = {
  enabled: true,
  ai_enabled: true,
  default_currency: "BGN",
  monthly_budget: 3000,
  budget_alert_percent: 80,
  auto_pause_on_budget: true,
  target_cpl: 25,
  max_cpl: 60,
  auto_pause_bad_cpl: false,
};

export async function getMarketingSettings(): Promise<MarketingSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return { ...DEFAULT_MARKETING_SETTINGS, ...((data?.value ?? {}) as Partial<MarketingSettings>) };
}

export async function saveMarketingSettings(
  patch: Partial<MarketingSettings>,
): Promise<MarketingSettings> {
  const next = { ...(await getMarketingSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert(
      { key: SETTINGS_KEY, value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

export async function getMarketingJobState() {
  const { data } = await db().from("automation_jobs").select("*").eq("key", JOB_KEY).maybeSingle();
  return {
    key: JOB_KEY,
    paused: Boolean(data?.paused),
    paused_reason: data?.paused_reason ?? null,
    last_run_at: data?.last_run_at ?? null,
    locked_until: data?.locked_until ?? null,
    stats: (data?.stats ?? {}) as Record<string, number | string | boolean | null>,
  };
}

export async function resumeMarketingJob() {
  await db()
    .from("automation_jobs")
    .upsert(
      {
        key: JOB_KEY,
        paused: false,
        paused_reason: null,
        locked_until: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
  return getMarketingJobState();
}

async function logEvent(
  campaignId: string | null,
  type: string,
  status: "ok" | "error" | "warn",
  message?: string | null,
  payload?: Record<string, unknown>,
  actor?: string | null,
) {
  await db()
    .from("ad_events")
    .insert({
      campaign_id: campaignId,
      event_type: type,
      status,
      message: message ?? null,
      payload: payload ?? {},
      actor: actor ?? "crm",
    });
}

// ------------------------------------------------------------------
// Канали и кампании
// ------------------------------------------------------------------
export async function listChannels() {
  const { data, error } = await db().from("ad_channels").select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listCampaigns(filter?: { status?: string; channel?: string }) {
  let q = db()
    .from("ad_campaigns")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(400);
  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.channel) q = q.eq("channel_code", filter.channel);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type CampaignInput = {
  id?: string | null;
  name: string;
  channel_code?: string;
  objective?: string;
  status?: string;
  property_id?: string | null;
  city?: string | null;
  audience?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget_total?: number | null;
  budget_daily?: number | null;
  currency?: string | null;
  auto_pause_on_budget?: boolean;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  notes?: string | null;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/gi, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);

export async function saveCampaign(input: CampaignInput, actor?: string | null) {
  const settings = await getMarketingSettings();
  const row: Record<string, unknown> = {
    name: input.name,
    channel_code: input.channel_code ?? "facebook",
    objective: input.objective ?? "leads",
    status: input.status ?? "draft",
    property_id: input.property_id ?? null,
    city: input.city ?? null,
    audience: input.audience ?? null,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    budget_total: num(input.budget_total),
    budget_daily: input.budget_daily != null ? num(input.budget_daily) : null,
    currency: input.currency ?? settings.default_currency,
    auto_pause_on_budget: input.auto_pause_on_budget ?? settings.auto_pause_on_budget,
    utm_source: input.utm_source ?? input.channel_code ?? "facebook",
    utm_medium: input.utm_medium ?? "cpc",
    utm_campaign: input.utm_campaign ?? slug(input.name),
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await db()
      .from("ad_campaigns")
      .update(row)
      .eq("id", input.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await logEvent(input.id, "status", "ok", `Обновена кампания: ${input.name}`, undefined, actor);
    return data;
  }
  const { data, error } = await db().from("ad_campaigns").insert(row).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  await logEvent(
    data?.id ?? null,
    "created",
    "ok",
    `Създадена кампания: ${input.name}`,
    undefined,
    actor,
  );
  await syncBudgetActuals();
  return data;
}

export async function setCampaignStatus(id: string, status: string, actor?: string | null) {
  const { error } = await db()
    .from("ad_campaigns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(id, "status", "ok", `Статус → ${status}`, undefined, actor);
  return { ok: true };
}

export function buildTrackedUrl(
  base: string,
  c: {
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    id?: string;
  },
) {
  try {
    const u = new URL(base);
    if (c.utm_source) u.searchParams.set("utm_source", c.utm_source);
    if (c.utm_medium) u.searchParams.set("utm_medium", c.utm_medium);
    if (c.utm_campaign) u.searchParams.set("utm_campaign", c.utm_campaign);
    if (c.id) u.searchParams.set("cid", c.id);
    return u.toString();
  } catch {
    return base;
  }
}

// ------------------------------------------------------------------
// Криейтиви + AI генериране
// ------------------------------------------------------------------
export async function listCreatives(campaignId?: string) {
  let q = db()
    .from("ad_creatives")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (campaignId) q = q.eq("campaign_id", campaignId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveCreative(input: Record<string, any>, actor?: string | null) {
  const row = {
    campaign_id: input.campaign_id,
    variant: input.variant ?? "A",
    headline: input.headline ?? null,
    body: input.body ?? null,
    cta: input.cta ?? "Виж имота",
    image_url: input.image_url ?? null,
    target_url: input.target_url ?? null,
    status: input.status ?? "draft",
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await db()
      .from("ad_creatives")
      .update(row)
      .eq("id", input.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await db().from("ad_creatives").insert(row).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  await logEvent(row.campaign_id, "created", "ok", "Нов криейтив", undefined, actor);
  return data;
}

export async function deleteCreative(id: string) {
  const { error } = await db().from("ad_creatives").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** AI генерира 2–3 варианта реклама на български за дадена кампания. */
export async function generateCreatives(
  campaignId: string,
  extra?: string | null,
  actor?: string | null,
) {
  const settings = await getMarketingSettings();
  if (!settings.ai_enabled) throw new Error("AI е изключен в настройките на модула.");
  const { data: c, error } = await db()
    .from("ad_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) throw new Error("Кампанията не е намерена.");

  let property: any = null;
  if (c.property_id) {
    const { data: p } = await db()
      .from("properties")
      .select("title, price, currency, area_sqm, rooms, description, city_id, cities(name)")
      .eq("id", c.property_id)
      .maybeSingle();
    property = p
      ? { ...p, city: (p as any).cities?.name ?? null, area: (p as any).area_sqm ?? null }
      : null;
  }

  const res = await aiChatCompletions({
    messages: [
      {
        role: "system",
        content:
          'Ти си маркетинг копирайтър на българска агенция за недвижими имоти „Имоти Надежда". Върни САМО JSON: {"variants":[{"variant":"A","headline":"...","body":"...","cta":"..."}]}. 3 варианта, на български, headline до 60 знака, body до 200 знака, без емоджи излишни, без обещания за доход.',
      },
      {
        role: "user",
        content: JSON.stringify({
          campaign: {
            name: c.name,
            channel: c.channel_code,
            objective: c.objective,
            city: c.city,
            audience: c.audience,
          },
          property,
          extra: extra ?? null,
        }),
      },
    ],
    temperature: 0.7,
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const json = (await res.json()) as any;
  const raw = String(json?.choices?.[0]?.message?.content ?? "");
  const match = raw.match(/\{[\s\S]*\}/);
  let variants: any[] = [];
  try {
    variants = JSON.parse(match ? match[0] : raw)?.variants ?? [];
  } catch {
    variants = [];
  }
  if (!variants.length) throw new Error("AI не върна валидни варианти.");

  const inserted: any[] = [];
  for (const v of variants.slice(0, 3)) {
    const { data } = await db()
      .from("ad_creatives")
      .insert({
        campaign_id: campaignId,
        variant: String(v.variant ?? "A").slice(0, 2),
        headline: v.headline ?? null,
        body: v.body ?? null,
        cta: v.cta ?? "Виж имота",
        target_url: property?.slug
          ? buildTrackedUrl(`https://imotinadezhda.bg/imoti/${property.slug}`, c)
          : null,
        ai_used: true,
        model: json?.model ?? null,
        status: "draft",
      })
      .select("*")
      .maybeSingle();
    if (data) inserted.push(data);
  }
  await logEvent(campaignId, "ai_creative", "ok", `${inserted.length} варианта`, undefined, actor);
  return inserted;
}

// ------------------------------------------------------------------
// Разходи и резултати
// ------------------------------------------------------------------
export async function listSpend(campaignId?: string) {
  let q = db().from("ad_spend").select("*").order("day", { ascending: false }).limit(400);
  if (campaignId) q = q.eq("campaign_id", campaignId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function recordSpend(input: {
  campaign_id: string;
  creative_id?: string | null;
  day?: string | null;
  spend?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  leads?: number | null;
  notes?: string | null;
  actor?: string | null;
}) {
  const day = input.day ?? new Date().toISOString().slice(0, 10);
  const { error } = await db()
    .from("ad_spend")
    .upsert(
      {
        campaign_id: input.campaign_id,
        creative_id: input.creative_id ?? null,
        day,
        spend: num(input.spend),
        impressions: Math.round(num(input.impressions)),
        clicks: Math.round(num(input.clicks)),
        leads: Math.round(num(input.leads)),
        source: "manual",
        notes: input.notes ?? null,
      },
      { onConflict: "campaign_id,creative_id,day" },
    );
  if (error) throw new Error(error.message);
  await recalcCampaign(input.campaign_id);
  await logEvent(
    input.campaign_id,
    "spend",
    "ok",
    `${day}: ${num(input.spend)}`,
    undefined,
    input.actor,
  );
  return { ok: true };
}

/** Преизчислява агрегатите на кампанията от ad_spend + атрибуции. */
export async function recalcCampaign(campaignId: string) {
  const { data: spendRows } = await db()
    .from("ad_spend")
    .select("spend, impressions, clicks, leads")
    .eq("campaign_id", campaignId);
  const totals = (spendRows ?? []).reduce(
    (a: any, r: any) => ({
      spend: a.spend + num(r.spend),
      impressions: a.impressions + num(r.impressions),
      clicks: a.clicks + num(r.clicks),
      leads: a.leads + num(r.leads),
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0 },
  );

  const { data: attrs } = await db()
    .from("ad_attributions")
    .select("status, revenue")
    .eq("campaign_id", campaignId);
  const won = (attrs ?? []).filter((a: any) => a.status === "won");
  const revenue = won.reduce((s: number, a: any) => s + num(a.revenue), 0);
  const attrLeads = (attrs ?? []).length;

  const { data: c } = await db()
    .from("ad_campaigns")
    .select("id, status, budget_total, auto_pause_on_budget, name")
    .eq("id", campaignId)
    .maybeSingle();
  const settings = await getMarketingSettings();

  const update: Record<string, unknown> = {
    spent: round2(totals.spend),
    impressions: totals.impressions,
    clicks: totals.clicks,
    leads: Math.max(totals.leads, attrLeads),
    deals: won.length,
    revenue: round2(revenue),
    updated_at: new Date().toISOString(),
  };

  const budget = num(c?.budget_total);
  if (budget > 0) {
    const pct = (totals.spend / budget) * 100;
    if (pct >= settings.budget_alert_percent && pct < 100) {
      await logEvent(
        campaignId,
        "budget_alert",
        "warn",
        `Изразходвани ${Math.round(pct)}% от бюджета на „${c?.name ?? ""}"`,
      );
    }
    if (
      pct >= 100 &&
      (c?.auto_pause_on_budget ?? settings.auto_pause_on_budget) &&
      c?.status === "active"
    ) {
      update.status = "paused";
      await logEvent(
        campaignId,
        "auto_pause",
        "warn",
        `Кампанията е спряна: изчерпан бюджет (${Math.round(pct)}%)`,
      );
    }
  }

  await db().from("ad_campaigns").update(update).eq("id", campaignId);
  await syncBudgetActuals();
  return update;
}

// ------------------------------------------------------------------
// Бюджети
// ------------------------------------------------------------------
export async function listBudgets(month?: string) {
  let q = db()
    .from("ad_budgets")
    .select("*")
    .order("period_month", { ascending: false })
    .limit(200);
  if (month) q = q.eq("period_month", `${month}-01`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveBudget(input: {
  id?: string | null;
  period_month: string;
  channel_code?: string | null;
  planned: number;
  currency?: string | null;
  notes?: string | null;
}) {
  const period = input.period_month.length === 7 ? `${input.period_month}-01` : input.period_month;
  const { error } = await db()
    .from("ad_budgets")
    .upsert(
      {
        period_month: period,
        channel_code: input.channel_code ?? null,
        campaign_id: null,
        planned: num(input.planned),
        currency: input.currency ?? (await getMarketingSettings()).default_currency,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "period_month,channel_code,campaign_id" },
    );
  if (error) throw new Error(error.message);
  await syncBudgetActuals();
  return { ok: true };
}

/** Пълни actual стойностите на бюджетите от реалните разходи. */
export async function syncBudgetActuals() {
  const { data: budgets } = await db().from("ad_budgets").select("id, period_month, channel_code");
  if (!budgets?.length) return { updated: 0 };
  const { data: spend } = await db().from("ad_spend").select("day, spend, campaign_id");
  const { data: camps } = await db().from("ad_campaigns").select("id, channel_code");
  const chanOf = new Map((camps ?? []).map((c: any) => [c.id, c.channel_code]));

  let updated = 0;
  for (const b of budgets) {
    const month = String(b.period_month).slice(0, 7);
    const actual = (spend ?? [])
      .filter(
        (s: any) =>
          String(s.day).slice(0, 7) === month &&
          (!b.channel_code || chanOf.get(s.campaign_id) === b.channel_code),
      )
      .reduce((sum: number, s: any) => sum + num(s.spend), 0);
    await db()
      .from("ad_budgets")
      .update({ actual: round2(actual), updated_at: new Date().toISOString() })
      .eq("id", b.id);
    updated += 1;
  }
  return { updated };
}

// ------------------------------------------------------------------
// Атрибуция (публично проследяване от лийд форми)
// ------------------------------------------------------------------
export async function trackAttribution(input: {
  campaign_id?: string | null;
  creative_id?: string | null;
  lead_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  landing_url?: string | null;
}) {
  let campaignId = input.campaign_id ?? null;
  if (!campaignId && input.utm_campaign) {
    const { data } = await db()
      .from("ad_campaigns")
      .select("id")
      .eq("utm_campaign", input.utm_campaign)
      .limit(1)
      .maybeSingle();
    campaignId = data?.id ?? null;
  }
  const { error } = await db()
    .from("ad_attributions")
    .insert({
      campaign_id: campaignId,
      creative_id: input.creative_id ?? null,
      lead_id: input.lead_id ?? null,
      utm_source: input.utm_source ?? null,
      utm_medium: input.utm_medium ?? null,
      utm_campaign: input.utm_campaign ?? null,
      landing_url: input.landing_url ?? null,
      status: "lead",
    });
  if (error) throw new Error(error.message);
  if (campaignId) {
    if (input.creative_id) {
      const { data: cr } = await db()
        .from("ad_creatives")
        .select("leads")
        .eq("id", input.creative_id)
        .maybeSingle();
      await db()
        .from("ad_creatives")
        .update({ leads: Math.round(num(cr?.leads)) + 1 })
        .eq("id", input.creative_id);
    }
    await recalcCampaign(campaignId);
  }
  return { ok: true, campaign_id: campaignId };
}

export async function listAttributions(campaignId?: string) {
  let q = db()
    .from("ad_attributions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (campaignId) q = q.eq("campaign_id", campaignId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ------------------------------------------------------------------
// Analytics
// ------------------------------------------------------------------
export async function getMarketingAnalytics() {
  const settings = await getMarketingSettings();
  const { data: camps } = await db().from("ad_campaigns").select("*");
  const rows = camps ?? [];
  const active = rows.filter((c: any) => c.status === "active");

  const sum = (k: string, list = rows) => list.reduce((s: number, c: any) => s + num(c[k]), 0);
  const spent = round2(sum("spent"));
  const leads = sum("leads");
  const clicks = sum("clicks");
  const impressions = sum("impressions");
  const deals = sum("deals");
  const revenue = round2(sum("revenue"));

  const month = monthStart();
  const { data: spendRows } = await db()
    .from("ad_spend")
    .select("day, spend, leads, clicks, campaign_id");
  const monthSpend = round2(
    (spendRows ?? [])
      .filter((s: any) => String(s.day).slice(0, 7) === month.slice(0, 7))
      .reduce((a: number, s: any) => a + num(s.spend), 0),
  );

  const byChannel = new Map<
    string,
    { channel: string; spend: number; leads: number; deals: number; revenue: number }
  >();
  for (const c of rows) {
    const k = c.channel_code ?? "—";
    const e = byChannel.get(k) ?? { channel: k, spend: 0, leads: 0, deals: 0, revenue: 0 };
    e.spend += num(c.spent);
    e.leads += num(c.leads);
    e.deals += num(c.deals);
    e.revenue += num(c.revenue);
    byChannel.set(k, e);
  }

  const daily = new Map<string, { day: string; spend: number; leads: number; clicks: number }>();
  for (const s of spendRows ?? []) {
    const k = String(s.day).slice(0, 10);
    const e = daily.get(k) ?? { day: k, spend: 0, leads: 0, clicks: 0 };
    e.spend += num(s.spend);
    e.leads += num(s.leads);
    e.clicks += num(s.clicks);
    daily.set(k, e);
  }

  const top = [...rows]
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      channel: c.channel_code,
      spent: num(c.spent),
      leads: num(c.leads),
      cpl: num(c.leads) > 0 ? round2(num(c.spent) / num(c.leads)) : null,
      roi: num(c.spent) > 0 ? round2(((num(c.revenue) - num(c.spent)) / num(c.spent)) * 100) : null,
    }))
    .sort((a, b) => (a.cpl ?? 1e9) - (b.cpl ?? 1e9))
    .slice(0, 8);

  return {
    kpi: {
      campaigns: rows.length,
      active: active.length,
      spent,
      month_spend: monthSpend,
      monthly_budget: settings.monthly_budget,
      budget_used_percent:
        settings.monthly_budget > 0 ? Math.round((monthSpend / settings.monthly_budget) * 100) : 0,
      impressions,
      clicks,
      ctr: impressions > 0 ? round2((clicks / impressions) * 100) : 0,
      leads,
      cpl: leads > 0 ? round2(spent / leads) : 0,
      target_cpl: settings.target_cpl,
      deals,
      revenue,
      roi: spent > 0 ? round2(((revenue - spent) / spent) * 100) : 0,
      conversion: leads > 0 ? round2((deals / leads) * 100) : 0,
    },
    by_channel: [...byChannel.values()].sort((a, b) => b.spend - a.spend),
    daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-30),
    top,
  };
}

/** AI препоръки за преразпределение на бюджета. */
export async function generateBudgetAdvice(actor?: string | null) {
  const settings = await getMarketingSettings();
  if (!settings.ai_enabled) throw new Error("AI е изключен в настройките на модула.");
  const analytics = await getMarketingAnalytics();
  const res = await aiChatCompletions({
    messages: [
      {
        role: "system",
        content:
          "Ти си маркетинг анализатор на българска агенция за недвижими имоти. На база данните дай кратък анализ на български: 3 извода и 3 конкретни действия (какъв бюджет да се увеличи/намали, кои канали да се спрат). Максимум 900 знака.",
      },
      { role: "user", content: JSON.stringify({ settings, analytics }) },
    ],
    temperature: 0.4,
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const json = (await res.json()) as any;
  const advice = String(json?.choices?.[0]?.message?.content ?? "").trim();
  await logEvent(null, "ai_creative", "ok", "AI бюджетен анализ", { advice }, actor);
  return { advice };
}

export async function listMarketingEvents() {
  const { data, error } = await db()
    .from("ad_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ------------------------------------------------------------------
// Sweep: бюджетни проверки, авто-пауза, приключване по дата
// ------------------------------------------------------------------
export async function runMarketingSweep() {
  const settings = await getMarketingSettings();
  if (!settings.enabled) return { skipped: "disabled" as const };
  const job = await getMarketingJobState();
  if (job.paused) return { skipped: "paused" as const, reason: job.paused_reason };

  const claimed = await db().rpc("claim_automation_job", { _key: JOB_KEY, _lease_seconds: 300 });
  if (claimed?.error) throw new Error(claimed.error.message);
  if (claimed?.data === false) return { skipped: "locked" as const };

  const stats = { checked: 0, paused: 0, completed: 0, alerts: 0 };
  try {
    const { data: camps } = await db()
      .from("ad_campaigns")
      .select("*")
      .in("status", ["active", "paused"]);
    const today = new Date().toISOString().slice(0, 10);
    for (const c of camps ?? []) {
      stats.checked += 1;
      await recalcCampaign(c.id);
      const { data: fresh } = await db()
        .from("ad_campaigns")
        .select("status, end_date, spent, leads")
        .eq("id", c.id)
        .maybeSingle();
      if (fresh?.status === "paused") stats.paused += 1;
      if (fresh?.end_date && String(fresh.end_date) < today && fresh.status !== "completed") {
        await db()
          .from("ad_campaigns")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", c.id);
        stats.completed += 1;
      }
      const cpl = num(fresh?.leads) > 0 ? num(fresh?.spent) / num(fresh?.leads) : null;
      if (cpl != null && cpl > settings.max_cpl) {
        stats.alerts += 1;
        await logEvent(
          c.id,
          "budget_alert",
          "warn",
          `Висока цена на лийд: ${round2(cpl)} (лимит ${settings.max_cpl})`,
        );
        if (settings.auto_pause_bad_cpl && fresh?.status === "active") {
          await db()
            .from("ad_campaigns")
            .update({ status: "paused", updated_at: new Date().toISOString() })
            .eq("id", c.id);
          await logEvent(c.id, "auto_pause", "warn", "Спряна заради висока цена на лийд");
          stats.paused += 1;
        }
      }
    }
    await syncBudgetActuals();
    await logEvent(null, "sweep", "ok", `Проверени ${stats.checked} кампании`, stats);
  } catch (e) {
    await logEvent(null, "sweep", "error", (e as Error).message);
    throw e;
  } finally {
    await db()
      .from("automation_jobs")
      .upsert(
        {
          key: JOB_KEY,
          locked_until: null,
          last_run_at: new Date().toISOString(),
          stats,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
  }
  return stats;
}
