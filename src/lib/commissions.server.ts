// Автоматизация №17 — Изчисляване на Комисионни: правила, разпределение, изплащания, отчети.
// Без зависимост от Lovable: Supabase + конфигуриран AI провайдър.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions } from "@/lib/ai-provider";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: unknown) => any;
  };

const JOB_KEY = "commissions_sweep";
const SETTINGS_KEY = "commissions";

export type CommissionSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  auto_calculate_won_deals: boolean;
  auto_approve: boolean;
  default_currency: string;
  default_vat_percent: number;
  vat_registered: boolean;
  batch_size: number;
  lease_seconds: number;
  invoice_prefix: string;
  invoice_start: number;
};

export const DEFAULT_COMMISSION_SETTINGS: CommissionSettings = {
  enabled: true,
  ai_enabled: true,
  auto_calculate_won_deals: true,
  auto_approve: false,
  default_currency: "EUR",
  default_vat_percent: 20,
  vat_registered: true,
  batch_size: 25,
  lease_seconds: 300,
  invoice_prefix: "КОМ",
  invoice_start: 1,
};

export async function getCommissionSettings(): Promise<CommissionSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return {
    ...DEFAULT_COMMISSION_SETTINGS,
    ...((data?.value ?? {}) as Partial<CommissionSettings>),
  };
}

export async function saveCommissionSettings(
  patch: Partial<CommissionSettings>,
): Promise<CommissionSettings> {
  const next = { ...(await getCommissionSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert(
      { key: SETTINGS_KEY, value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

export async function getCommissionJobState() {
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

async function claimJob(leaseSeconds: number): Promise<boolean> {
  const { data, error } = await db().rpc("claim_automation_job", {
    _key: JOB_KEY,
    _lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(`Не може да се заеме задачата: ${error.message}`);
  return Boolean(data);
}

async function releaseJob(stats: Record<string, number | string | boolean | null>) {
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

export async function resumeCommissionJob() {
  await db()
    .from("automation_jobs")
    .upsert(
      {
        key: JOB_KEY,
        paused: false,
        paused_reason: null,
        paused_at: null,
        locked_until: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
  return getCommissionJobState();
}

async function logEvent(
  commissionId: string | null,
  dealId: string | null,
  action: string,
  status: string,
  message?: string | null,
  actor?: string | null,
) {
  await db()
    .from("commission_events")
    .insert({
      commission_id: commissionId,
      deal_id: dealId,
      action,
      status,
      message: message ?? null,
      actor: actor ?? "system",
    });
}

// ------------------------------------------------------------------
// Правила
// ------------------------------------------------------------------
export async function listCommissionRules() {
  const { data, error } = await db()
    .from("commission_rules")
    .select("*")
    .order("priority", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveCommissionRule(rule: Record<string, unknown>) {
  const payload = { ...rule, updated_at: new Date().toISOString() };
  const { data, error } = await db()
    .from("commission_rules")
    .upsert(payload, { onConflict: "code" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pickRule(rules: any[], dealType: string, base: number): any | null {
  const candidates = rules
    .filter((r) => r.is_active !== false)
    .filter((r) => r.deal_type === dealType || r.deal_type === "any")
    .filter(
      (r) =>
        (r.price_from == null || base >= num(r.price_from)) &&
        (r.price_to == null || base <= num(r.price_to)),
    )
    .sort((a, b) => num(a.priority, 100) - num(b.priority, 100));
  return candidates[0] ?? null;
}

export type CalcResult = {
  rule_code: string | null;
  base_amount: number;
  percent: number | null;
  gross_amount: number;
  vat_percent: number;
  vat_amount: number;
  total_amount: number;
  broker_amount: number;
  agency_amount: number;
  calc_note: string;
};

export function computeCommission(
  rule: any | null,
  base: number,
  settings: CommissionSettings,
): CalcResult {
  const vatPercent = settings.vat_registered
    ? num(rule?.vat_percent, settings.default_vat_percent)
    : 0;
  let gross = 0;
  let percent: number | null = null;
  let note = "";

  if (!rule) {
    percent = 3;
    gross = base * 0.03;
    note = "Няма съвпадащо правило — приложен резервен процент 3%.";
  } else if (rule.basis === "fixed") {
    gross = num(rule.fixed_amount);
    note = `Фиксирана сума по правило „${rule.name}“.`;
  } else if (rule.basis === "rent_months") {
    gross = base * num(rule.rent_months, 1);
    note = `${num(rule.rent_months, 1)} месечни наема по правило „${rule.name}“.`;
  } else {
    percent = num(rule.percent, 3);
    gross = (base * percent) / 100;
    note = `${percent}% от ${base.toLocaleString("bg-BG")} по правило „${rule.name}“.`;
  }

  const min = num(rule?.min_amount, 0);
  const max = rule?.max_amount == null ? null : num(rule.max_amount);
  if (min && gross < min) {
    gross = min;
    note += ` Приложен минимум ${min}.`;
  }
  if (max != null && gross > max) {
    gross = max;
    note += ` Приложен максимум ${max}.`;
  }

  if (rule?.vat_included && vatPercent > 0) {
    gross = gross / (1 + vatPercent / 100);
    note += " Сумата е приведена без ДДС (правилото е с включено ДДС).";
  }

  gross = round2(gross);
  const vatAmount = round2((gross * vatPercent) / 100);
  const brokerShare = num(rule?.broker_share_percent, 50);
  const agencyShare =
    rule?.agency_share_percent == null ? 100 - brokerShare : num(rule.agency_share_percent);

  return {
    rule_code: rule?.code ?? null,
    base_amount: round2(base),
    percent,
    gross_amount: gross,
    vat_percent: vatPercent,
    vat_amount: vatAmount,
    total_amount: round2(gross + vatAmount),
    broker_amount: round2((gross * brokerShare) / 100),
    agency_amount: round2((gross * agencyShare) / 100),
    calc_note: note.trim(),
  };
}

// ------------------------------------------------------------------
// Изчисляване по сделка
// ------------------------------------------------------------------
async function getDeal(dealId: string) {
  const { data, error } = await db()
    .from("deals")
    .select(
      "id, deal_number, title, deal_type, status, price, agreed_price, currency, broker_id, client_id, property_id, closed_at, commission_percent, commission_amount",
    )
    .eq("id", dealId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Сделката не е намерена.");
  return data;
}

function periodMonth(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function calculateForDeal(
  dealId: string,
  actor?: string | null,
  opts?: { ruleCode?: string | null; baseOverride?: number | null },
) {
  const settings = await getCommissionSettings();
  const deal = await getDeal(dealId);
  const rules = await listCommissionRules();
  const base = num(opts?.baseOverride ?? deal.agreed_price ?? deal.price, 0);
  if (base <= 0)
    throw new Error("Сделката няма договорена цена — комисионната не може да се изчисли.");

  const rule = opts?.ruleCode
    ? ((rules as any[]).find((r: any) => r.code === opts.ruleCode) ?? null)
    : pickRule(rules as any[], deal.deal_type ?? "sale", base);
  const calc = computeCommission(rule, base, settings);

  const payload = {
    deal_id: deal.id,
    rule_code: calc.rule_code,
    deal_type: deal.deal_type ?? "sale",
    currency: deal.currency ?? settings.default_currency,
    base_amount: calc.base_amount,
    percent: calc.percent,
    gross_amount: calc.gross_amount,
    vat_percent: calc.vat_percent,
    vat_amount: calc.vat_amount,
    total_amount: calc.total_amount,
    broker_amount: calc.broker_amount,
    agency_amount: calc.agency_amount,
    broker_id: deal.broker_id ?? null,
    status: settings.auto_approve ? "approved" : "calculated",
    approved_at: settings.auto_approve ? new Date().toISOString() : null,
    approved_by: settings.auto_approve ? (actor ?? "auto") : null,
    period_month: periodMonth(deal.closed_at),
    calc_note: calc.calc_note,
    created_by: actor ?? "system",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db()
    .from("commissions")
    .upsert(payload, { onConflict: "deal_id" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);

  await syncSplits(data.id, calc, deal.broker_id ?? null);
  await db()
    .from("deals")
    .update({
      commission_amount: calc.gross_amount,
      commission_percent: calc.percent ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deal.id);
  await logEvent(data.id, deal.id, "calculate", "ok", calc.calc_note, actor);
  return data;
}

async function syncSplits(commissionId: string, calc: CalcResult, brokerId: string | null) {
  await db()
    .from("commission_splits")
    .delete()
    .eq("commission_id", commissionId)
    .eq("status", "pending");
  const rows: Record<string, unknown>[] = [];
  if (calc.broker_amount > 0) {
    rows.push({
      commission_id: commissionId,
      broker_id: brokerId,
      role: "broker",
      share_percent: calc.gross_amount ? round2((calc.broker_amount / calc.gross_amount) * 100) : 0,
      amount: calc.broker_amount,
      status: "pending",
    });
  }
  if (calc.agency_amount > 0) {
    rows.push({
      commission_id: commissionId,
      role: "agency",
      name: "Имоти Надежда",
      share_percent: calc.gross_amount ? round2((calc.agency_amount / calc.gross_amount) * 100) : 0,
      amount: calc.agency_amount,
      status: "pending",
    });
  }
  if (rows.length) await db().from("commission_splits").insert(rows);
}

export async function addCommissionSplit(input: {
  commissionId: string;
  role?: string;
  name?: string | null;
  brokerId?: string | null;
  sharePercent?: number | null;
  amount?: number | null;
}) {
  const { data: c, error } = await db()
    .from("commissions")
    .select("gross_amount")
    .eq("id", input.commissionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const gross = num(c?.gross_amount);
  const share = num(input.sharePercent, 0);
  const amount = input.amount != null ? num(input.amount) : round2((gross * share) / 100);
  const { data, error: e2 } = await db()
    .from("commission_splits")
    .insert({
      commission_id: input.commissionId,
      broker_id: input.brokerId ?? null,
      role: input.role ?? "co_broker",
      name: input.name ?? null,
      share_percent: share,
      amount,
      status: "pending",
    })
    .select("*")
    .maybeSingle();
  if (e2) throw new Error(e2.message);
  await logEvent(
    input.commissionId,
    null,
    "split_add",
    "ok",
    `${input.role ?? "co_broker"}: ${amount}`,
  );
  return data;
}

export async function removeCommissionSplit(splitId: string) {
  const { error } = await db().from("commission_splits").delete().eq("id", splitId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function setCommissionStatus(
  commissionId: string,
  status: string,
  actor?: string | null,
) {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "approved") {
    patch["approved_at"] = new Date().toISOString();
    patch["approved_by"] = actor ?? "crm";
  }
  const { data, error } = await db()
    .from("commissions")
    .update(patch)
    .eq("id", commissionId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (status === "approved")
    await db()
      .from("commission_splits")
      .update({ status: "approved" })
      .eq("commission_id", commissionId)
      .eq("status", "pending");
  await logEvent(commissionId, data?.deal_id ?? null, "status", "ok", status, actor);
  return data;
}

export async function issueInvoice(commissionId: string, actor?: string | null) {
  const settings = await getCommissionSettings();
  const { count } = await db()
    .from("commissions")
    .select("id", { count: "exact", head: true })
    .not("invoice_number", "is", null);
  const seq = settings.invoice_start + num(count, 0);
  const invoice = `${settings.invoice_prefix}-${new Date().getUTCFullYear()}-${String(seq).padStart(4, "0")}`;
  const { data, error } = await db()
    .from("commissions")
    .update({
      invoice_number: invoice,
      invoiced_at: new Date().toISOString(),
      status: "invoiced",
      updated_at: new Date().toISOString(),
    })
    .eq("id", commissionId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  await logEvent(commissionId, data?.deal_id ?? null, "invoice", "ok", invoice, actor);
  return data;
}

export async function registerPayout(input: {
  commissionId: string;
  splitId?: string | null;
  amount: number;
  method?: string;
  reference?: string | null;
  note?: string | null;
  actor?: string | null;
}) {
  const { data: c, error } = await db()
    .from("commissions")
    .select("id, deal_id, broker_id, currency, total_amount, paid_amount, period_month")
    .eq("id", input.commissionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) throw new Error("Комисионната не е намерена.");

  const amount = round2(num(input.amount));
  if (amount <= 0) throw new Error("Сумата трябва да е положителна.");

  const { error: e2 } = await db()
    .from("commission_payouts")
    .insert({
      commission_id: c.id,
      split_id: input.splitId ?? null,
      broker_id: c.broker_id ?? null,
      amount,
      currency: c.currency ?? "EUR",
      method: input.method ?? "bank",
      reference: input.reference ?? null,
      note: input.note ?? null,
      period_month: c.period_month ?? periodMonth(),
      created_by: input.actor ?? "crm",
    });
  if (e2) throw new Error(e2.message);

  const paid = round2(num(c.paid_amount) + amount);
  const fullyPaid = paid + 0.01 >= num(c.total_amount);
  await db()
    .from("commissions")
    .update({
      paid_amount: paid,
      status: fullyPaid ? "paid" : "invoiced",
      paid_at: fullyPaid ? new Date().toISOString() : null,
      payment_method: input.method ?? "bank",
      updated_at: new Date().toISOString(),
    })
    .eq("id", c.id);
  if (input.splitId)
    await db()
      .from("commission_splits")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", input.splitId);
  if (fullyPaid)
    await db()
      .from("deals")
      .update({ commission_paid: true, updated_at: new Date().toISOString() })
      .eq("id", c.deal_id);
  await logEvent(
    c.id,
    c.deal_id ?? null,
    "payout",
    "ok",
    `${amount} ${c.currency ?? "EUR"}`,
    input.actor,
  );
  return { ok: true, paid_amount: paid, fully_paid: fullyPaid };
}

// ------------------------------------------------------------------
// AI резюме на комисионна
// ------------------------------------------------------------------
export async function generateCommissionSummary(commissionId: string, actor?: string | null) {
  const settings = await getCommissionSettings();
  if (!settings.ai_enabled) throw new Error("AI е изключен в настройките на модула.");
  const { data: c, error } = await db()
    .from("commissions")
    .select(
      "*, deals:deal_id(title, deal_number, deal_type, agreed_price, price, closed_at, status)",
    )
    .eq("id", commissionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) throw new Error("Комисионната не е намерена.");

  const res = await aiChatCompletions({
    messages: [
      {
        role: "system",
        content:
          "Ти си финансов асистент на българска агенция за недвижими имоти. Пиши кратко на български: 3 изречения — как е изчислена комисионната, какво предстои (одобрение/фактура/плащане) и рискове.",
      },
      { role: "user", content: JSON.stringify(c) },
    ],
    temperature: 0.3,
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const json = (await res.json()) as any;
  const summary = String(json?.choices?.[0]?.message?.content ?? "").trim();
  await db()
    .from("commissions")
    .update({
      ai_summary: summary,
      ai_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", commissionId);
  await logEvent(commissionId, c.deal_id ?? null, "ai_summary", "ok", null, actor);
  return { summary };
}

// ------------------------------------------------------------------
// Автоматичен сweep: печелившите сделки получават комисионна
// ------------------------------------------------------------------
export async function runCommissionSweep(limit?: number) {
  const settings = await getCommissionSettings();
  if (!settings.enabled) return { skipped: "disabled" as const };
  const job = await getCommissionJobState();
  if (job.paused) return { skipped: "paused" as const, reason: job.paused_reason };
  if (!(await claimJob(settings.lease_seconds))) return { skipped: "locked" as const };

  const stats = { scanned: 0, calculated: 0, failed: 0 } as Record<string, number>;
  try {
    if (settings.auto_calculate_won_deals) {
      const { data: deals } = await db()
        .from("deals")
        .select("id")
        .eq("status", "won")
        .order("closed_at", { ascending: false })
        .limit(Math.min(Math.max(num(limit, settings.batch_size), 1), 100));
      const ids = (deals ?? []).map((d: any) => d.id);
      stats["scanned"] = ids.length;
      if (ids.length) {
        const { data: existing } = await db()
          .from("commissions")
          .select("deal_id")
          .in("deal_id", ids);
        const done = new Set((existing ?? []).map((r: any) => r.deal_id));
        for (const id of ids.filter((i: string) => !done.has(i))) {
          try {
            await calculateForDeal(id, "auto");
            stats["calculated"] += 1;
          } catch (e) {
            stats["failed"] += 1;
            await logEvent(null, id, "calculate", "error", (e as Error).message, "auto");
          }
        }
      }
    }
    return stats;
  } finally {
    await releaseJob(stats);
  }
}

// ------------------------------------------------------------------
// Отчети / Analytics
// ------------------------------------------------------------------
export async function getCommissionAnalytics() {
  const { data: rows } = await db()
    .from("commissions")
    .select(
      "id, status, currency, gross_amount, vat_amount, total_amount, broker_amount, agency_amount, paid_amount, period_month, broker_id, deal_type",
    )
    .order("period_month", { ascending: false })
    .limit(2000);
  const list = rows ?? [];

  const byStatus: Record<string, number> = {};
  const byMonth: Record<string, { gross: number; paid: number; count: number }> = {};
  const byBroker: Record<string, { gross: number; broker: number; count: number }> = {};
  const byType: Record<string, number> = {};
  let gross = 0;
  let paid = 0;
  let vat = 0;
  let agency = 0;
  let brokerTotal = 0;

  for (const r of list) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    gross += num(r.gross_amount);
    paid += num(r.paid_amount);
    vat += num(r.vat_amount);
    agency += num(r.agency_amount);
    brokerTotal += num(r.broker_amount);
    byType[r.deal_type ?? "sale"] = (byType[r.deal_type ?? "sale"] ?? 0) + num(r.gross_amount);
    const m = (r.period_month ?? "—").slice(0, 7);
    byMonth[m] = byMonth[m] ?? { gross: 0, paid: 0, count: 0 };
    byMonth[m].gross += num(r.gross_amount);
    byMonth[m].paid += num(r.paid_amount);
    byMonth[m].count += 1;
    const b = r.broker_id ?? "—";
    byBroker[b] = byBroker[b] ?? { gross: 0, broker: 0, count: 0 };
    byBroker[b].gross += num(r.gross_amount);
    byBroker[b].broker += num(r.broker_amount);
    byBroker[b].count += 1;
  }

  const { data: brokers } = await db().from("brokers").select("id, full_name").limit(200);
  const brokerNames = new Map((brokers ?? []).map((b: any) => [b.id, b.full_name]));

  return {
    total: list.length,
    gross: round2(gross),
    vat: round2(vat),
    paid: round2(paid),
    outstanding: round2(gross - paid),
    agency: round2(agency),
    broker: round2(brokerTotal),
    avg: list.length ? round2(gross / list.length) : 0,
    byStatus,
    byType,
    months: Object.entries(byMonth)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 12)
      .map(([month, v]) => ({ month, ...v, gross: round2(v.gross), paid: round2(v.paid) })),
    brokers: Object.entries(byBroker)
      .sort((a, b) => b[1].gross - a[1].gross)
      .slice(0, 20)
      .map(([id, v]) => ({
        broker_id: id,
        name: brokerNames.get(id) ?? "Без брокер",
        ...v,
        gross: round2(v.gross),
        broker: round2(v.broker),
      })),
  };
}
