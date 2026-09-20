// Автоматизация №10 — Управление на сделки: пайплайн до нотариус, задачи, рискове, комисиони.
// Без зависимост от Lovable: Supabase + конфигуриран AI провайдър.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions } from "@/lib/ai-provider";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: unknown) => any;
  };

const JOB_KEY = "deals_sweep";
const TZ = "Europe/Sofia";

// ------------------------------------------------------------------
// Настройки
// ------------------------------------------------------------------
export type DealSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  batch_size: number;
  lease_seconds: number;
  number_prefix: string;
  default_commission: number;
  stall_days: number;
  notary_reminder_days: number;
  task_reminder_days: number;
  auto_tasks: boolean;
};

export const DEFAULT_DEALS: DealSettings = {
  enabled: true,
  ai_enabled: true,
  batch_size: 10,
  lease_seconds: 300,
  number_prefix: "СД",
  default_commission: 3,
  stall_days: 10,
  notary_reminder_days: 3,
  task_reminder_days: 1,
  auto_tasks: true,
};

export async function getDealSettings(): Promise<DealSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", "deals")
    .maybeSingle();
  return { ...DEFAULT_DEALS, ...((data?.value ?? {}) as Partial<DealSettings>) };
}

export async function saveDealSettings(patch: Partial<DealSettings>): Promise<DealSettings> {
  const next = { ...(await getDealSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert(
      { key: "deals", value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

// ------------------------------------------------------------------
// Състояние на фоновата задача
// ------------------------------------------------------------------
export async function getDealJobState() {
  const { data } = await db().from("automation_jobs").select("*").eq("key", JOB_KEY).maybeSingle();
  return {
    key: JOB_KEY,
    paused: Boolean(data?.paused),
    paused_reason: data?.paused_reason ?? null,
    paused_at: data?.paused_at ?? null,
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

export async function resumeDealJob() {
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
  return getDealJobState();
}

export async function pauseDealJob(reason: string) {
  await db()
    .from("automation_jobs")
    .upsert(
      {
        key: JOB_KEY,
        paused: true,
        paused_reason: reason,
        paused_at: new Date().toISOString(),
        locked_until: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
}

// ------------------------------------------------------------------
// Помощни
// ------------------------------------------------------------------
export type DealStage = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  position: number;
  probability: number;
  target_days: number;
  required_docs: string[];
  task_templates: { title: string; days?: number }[];
  is_final: boolean;
  is_won: boolean;
  is_active: boolean;
};

export async function listStages(): Promise<DealStage[]> {
  const { data, error } = await db()
    .from("deal_stages")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DealStage[];
}

async function logEvent(
  dealId: string | null,
  action: string,
  message: string,
  extra?: {
    from?: string | null;
    to?: string | null;
    status?: string;
    meta?: unknown;
    actor?: string;
  },
) {
  await db()
    .from("deal_events")
    .insert({
      deal_id: dealId,
      action,
      message: message.slice(0, 1000),
      from_stage: extra?.from ?? null,
      to_stage: extra?.to ?? null,
      status: extra?.status ?? "ok",
      meta: extra?.meta ?? null,
      actor: extra?.actor ?? "automation",
    });
}

export function formatSofia(iso: string): string {
  return new Intl.DateTimeFormat("bg-BG", {
    timeZone: TZ,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function commissionOf(
  price: number | null | undefined,
  percent: number | null | undefined,
): number | null {
  if (!price || !percent) return null;
  return Math.round(price * (percent / 100) * 100) / 100;
}

async function generateStageTasks(dealId: string, stage: DealStage) {
  const settings = await getDealSettings();
  if (!settings.auto_tasks) return 0;
  const templates = Array.isArray(stage.task_templates) ? stage.task_templates : [];
  if (!templates.length) return 0;
  const { data: existing } = await db()
    .from("deal_tasks")
    .select("title")
    .eq("deal_id", dealId)
    .eq("stage_code", stage.code);
  const have = new Set(((existing ?? []) as any[]).map((t) => String(t.title)));
  const rows = templates
    .filter((t) => t?.title && !have.has(String(t.title)))
    .map((t, i) => ({
      deal_id: dealId,
      stage_code: stage.code,
      title: String(t.title).slice(0, 200),
      due_at: new Date(Date.now() + (Number(t.days ?? 3) || 3) * 86400_000).toISOString(),
      auto_generated: true,
      sort_order: (i + 1) * 10,
    }));
  if (!rows.length) return 0;
  const { error } = await db().from("deal_tasks").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

// ------------------------------------------------------------------
// Създаване / редакция
// ------------------------------------------------------------------
export type CreateDealInput = {
  title?: string | null;
  dealType?: "sale" | "rent";
  clientId?: string | null;
  propertyId?: string | null;
  ownerId?: string | null;
  brokerId?: string | null;
  price?: number | null;
  agreedPrice?: number | null;
  currency?: string | null;
  commissionPercent?: number | null;
  mortgageNeeded?: boolean;
  expectedCloseAt?: string | null;
  notes?: string | null;
  stageCode?: string | null;
  createdBy?: string | null;
};

export async function createDeal(input: CreateDealInput) {
  const settings = await getDealSettings();
  const stages = await listStages();
  const stage = stages.find((s) => s.code === (input.stageCode ?? "reserved")) ?? stages[0];
  if (!stage) throw new Error("Няма конфигурирани етапи");

  let title = (input.title ?? "").trim();
  if (!title) {
    const parts: string[] = [];
    if (input.propertyId) {
      const { data: p } = await db()
        .from("properties")
        .select("title")
        .eq("id", input.propertyId)
        .maybeSingle();
      if (p?.title) parts.push(String(p.title));
    }
    if (input.clientId) {
      const { data: c } = await db()
        .from("clients")
        .select("full_name, name")
        .eq("id", input.clientId)
        .maybeSingle();
      const n = c?.full_name ?? c?.name;
      if (n) parts.push(String(n));
    }
    title = parts.join(" · ") || "Нова сделка";
  }

  let number: string | null = null;
  const { data: num } = await db().rpc("next_deal_number", { _prefix: settings.number_prefix });
  if (num) number = String(num);

  const percent = input.commissionPercent ?? settings.default_commission;
  const price = input.agreedPrice ?? input.price ?? null;

  const { data, error } = await db()
    .from("deals")
    .insert({
      deal_number: number,
      title: title.slice(0, 200),
      deal_type: input.dealType ?? "sale",
      client_id: input.clientId ?? null,
      property_id: input.propertyId ?? null,
      owner_id: input.ownerId ?? null,
      broker_id: input.brokerId ?? null,
      stage_code: stage.code,
      price: input.price ?? null,
      agreed_price: input.agreedPrice ?? null,
      currency: input.currency ?? "EUR",
      commission_percent: percent,
      commission_amount: commissionOf(price, percent),
      mortgage_needed: Boolean(input.mortgageNeeded),
      expected_close_at: input.expectedCloseAt ?? null,
      probability: stage.probability,
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("id, deal_number")
    .maybeSingle();
  if (error) throw new Error(error.message);

  const dealId = String(data?.id);
  const tasks = await generateStageTasks(dealId, stage);
  await logEvent(
    dealId,
    "deal_created",
    `Създадена сделка ${data?.deal_number ?? ""} на етап „${stage.name}“ (${tasks} задачи)`,
    {
      to: stage.code,
      actor: "crm",
    },
  );
  return { ok: true as const, id: dealId, deal_number: data?.deal_number ?? null, tasks };
}

export type UpdateDealInput = {
  id: string;
  title?: string | null;
  price?: number | null;
  agreedPrice?: number | null;
  currency?: string | null;
  depositAmount?: number | null;
  depositPaidAt?: string | null;
  commissionPercent?: number | null;
  commissionPaid?: boolean;
  mortgageNeeded?: boolean;
  mortgageBank?: string | null;
  mortgageApprovedAt?: string | null;
  preliminaryContractAt?: string | null;
  notaryName?: string | null;
  notaryOffice?: string | null;
  notaryAt?: string | null;
  notaryConfirmed?: boolean;
  deedNumber?: string | null;
  expectedCloseAt?: string | null;
  brokerId?: string | null;
  riskLevel?: "low" | "medium" | "high";
  riskNote?: string | null;
  notes?: string | null;
  actor?: string;
};

export async function updateDeal(input: UpdateDealInput) {
  const { data: current } = await db().from("deals").select("*").eq("id", input.id).maybeSingle();
  if (!current) throw new Error("Сделката липсва");

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  };
  const map: Record<string, string> = {
    title: "title",
    price: "price",
    agreedPrice: "agreed_price",
    currency: "currency",
    depositAmount: "deposit_amount",
    depositPaidAt: "deposit_paid_at",
    commissionPercent: "commission_percent",
    commissionPaid: "commission_paid",
    mortgageNeeded: "mortgage_needed",
    mortgageBank: "mortgage_bank",
    mortgageApprovedAt: "mortgage_approved_at",
    preliminaryContractAt: "preliminary_contract_at",
    notaryName: "notary_name",
    notaryOffice: "notary_office",
    notaryAt: "notary_at",
    notaryConfirmed: "notary_confirmed",
    deedNumber: "deed_number",
    expectedCloseAt: "expected_close_at",
    brokerId: "broker_id",
    riskLevel: "risk_level",
    riskNote: "risk_note",
    notes: "notes",
  };
  for (const [k, col] of Object.entries(map)) {
    const v = (input as Record<string, unknown>)[k];
    if (v !== undefined) patch[col] = v;
  }

  const price =
    (patch["agreed_price"] as number | null) ??
    current.agreed_price ??
    (patch["price"] as number | null) ??
    current.price ??
    null;
  const percent =
    (patch["commission_percent"] as number | null) ?? current.commission_percent ?? null;
  patch["commission_amount"] = commissionOf(price, percent);

  const { error } = await db().from("deals").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
  await logEvent(
    input.id,
    "deal_updated",
    `Обновени данни по сделката (${Object.keys(patch).length - 3} полета)`,
    { actor: input.actor ?? "crm" },
  );
  return { ok: true as const };
}

// ------------------------------------------------------------------
// Смяна на етап + проверка на изискванията
// ------------------------------------------------------------------
export async function checkStageRequirements(dealId: string, stageCode: string) {
  const stages = await listStages();
  const stage = stages.find((s) => s.code === stageCode);
  const required = (stage?.required_docs ?? []) as string[];
  if (!required.length)
    return { ok: true as const, missing: [] as { code: string; name: string }[] };

  const { data: reqs } = await db()
    .from("document_requirements")
    .select("code, name")
    .in("code", required);
  const nameByCode = new Map(((reqs ?? []) as any[]).map((r) => [String(r.code), String(r.name)]));

  const { data: deal } = await db()
    .from("deals")
    .select("client_id, property_id")
    .eq("id", dealId)
    .maybeSingle();
  let q = db().from("document_items").select("requirement_code, status");
  if (deal?.client_id) q = q.eq("client_id", deal.client_id);
  else if (deal?.property_id) q = q.eq("property_id", deal.property_id);
  const { data: items } = await q;
  const approved = new Set(
    ((items ?? []) as any[])
      .filter((i) => ["approved", "received"].includes(String(i.status)))
      .map((i) => String(i.requirement_code)),
  );

  const missing = required
    .filter((c) => !approved.has(c))
    .map((c) => ({ code: c, name: nameByCode.get(c) ?? c }));
  return { ok: missing.length === 0, missing };
}

export async function moveStage(input: {
  id: string;
  stageCode: string;
  force?: boolean;
  note?: string | null;
  actor?: string;
}) {
  const stages = await listStages();
  const stage = stages.find((s) => s.code === input.stageCode);
  if (!stage) throw new Error("Непознат етап");
  const { data: deal } = await db().from("deals").select("*").eq("id", input.id).maybeSingle();
  if (!deal) throw new Error("Сделката липсва");

  const check = await checkStageRequirements(input.id, stage.code);
  if (!check.ok && !input.force) {
    await logEvent(
      input.id,
      "stage_blocked",
      `Липсват документи за „${stage.name}“: ${check.missing.map((m) => m.name).join(", ")}`,
      {
        from: deal.stage_code,
        to: stage.code,
        status: "warn",
        actor: input.actor ?? "crm",
      },
    );
    return { ok: false as const, reason: "missing_documents", missing: check.missing };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    stage_code: stage.code,
    probability: stage.probability,
    stage_entered_at: now,
    last_activity_at: now,
    updated_at: now,
  };
  if (stage.is_final) {
    patch["status"] = stage.is_won ? "won" : "lost";
    patch["closed_at"] = now;
    if (!stage.is_won) patch["lost_reason"] = input.note ?? deal.lost_reason ?? null;
  } else {
    patch["status"] = "active";
    patch["closed_at"] = null;
  }

  const { error } = await db().from("deals").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);

  const tasks = stage.is_final ? 0 : await generateStageTasks(input.id, stage);
  const days = Math.max(
    0,
    Math.round(
      (Date.now() - new Date(deal.stage_entered_at ?? deal.created_at).getTime()) / 86400_000,
    ),
  );
  await logEvent(
    input.id,
    "stage_moved",
    `Етап „${stages.find((s) => s.code === deal.stage_code)?.name ?? deal.stage_code}“ → „${stage.name}“ след ${days} дни${tasks ? ` (+${tasks} задачи)` : ""}${
      check.ok ? "" : " — принудително, с липсващи документи"
    }`,
    {
      from: deal.stage_code,
      to: stage.code,
      actor: input.actor ?? "crm",
      meta: { days, forced: !check.ok },
    },
  );
  return { ok: true as const, tasks, days, missing: check.missing };
}

// ------------------------------------------------------------------
// Задачи
// ------------------------------------------------------------------
export async function addDealTask(input: {
  dealId: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  actor?: string;
}) {
  const { data: deal } = await db()
    .from("deals")
    .select("stage_code")
    .eq("id", input.dealId)
    .maybeSingle();
  const { data, error } = await db()
    .from("deal_tasks")
    .insert({
      deal_id: input.dealId,
      stage_code: deal?.stage_code ?? null,
      title: input.title.slice(0, 200),
      description: input.description ?? null,
      due_at: input.dueAt ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  await logEvent(input.dealId, "task_added", `Добавена задача: ${input.title}`, {
    actor: input.actor ?? "crm",
  });
  return { ok: true as const, id: data?.id };
}

export async function setTaskStatus(input: {
  id: string;
  status: "open" | "done" | "skipped";
  actor?: string;
}) {
  const { data: task } = await db()
    .from("deal_tasks")
    .select("id, deal_id, title")
    .eq("id", input.id)
    .maybeSingle();
  const { error } = await db()
    .from("deal_tasks")
    .update({
      status: input.status,
      done_at: input.status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  if (task?.deal_id) {
    await db()
      .from("deals")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", task.deal_id);
    await logEvent(
      task.deal_id,
      "task_status",
      `Задача „${task.title}“ → ${input.status === "done" ? "изпълнена" : input.status === "skipped" ? "пропусната" : "отворена"}`,
      {
        actor: input.actor ?? "crm",
      },
    );
  }
  return { ok: true as const };
}

// ------------------------------------------------------------------
// AI преглед на сделка
// ------------------------------------------------------------------
export async function analyzeDeal(
  dealId: string,
): Promise<{ ok: boolean; risk?: string; summary?: string; next?: string; reason?: string }> {
  const settings = await getDealSettings();
  const { data: deal } = await db()
    .from("deals")
    .select(
      "id, deal_number, title, deal_type, stage_code, status, price, agreed_price, currency, deposit_amount, deposit_paid_at, mortgage_needed, mortgage_bank, mortgage_approved_at, preliminary_contract_at, notary_at, notary_confirmed, expected_close_at, stage_entered_at, last_activity_at, notes, created_at",
    )
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return { ok: false, reason: "Сделката липсва" };

  const [{ data: tasks }, stages] = await Promise.all([
    db().from("deal_tasks").select("title, status, due_at").eq("deal_id", dealId).limit(50),
    listStages(),
  ]);
  const stage = stages.find((s) => s.code === deal.stage_code);
  const check = await checkStageRequirements(dealId, String(deal.stage_code));
  const daysInStage = Math.round(
    (Date.now() - new Date(deal.stage_entered_at ?? deal.created_at).getTime()) / 86400_000,
  );
  const openTasks = ((tasks ?? []) as any[]).filter((t) => t.status === "open");
  const overdue = openTasks.filter((t) => t.due_at && new Date(t.due_at).getTime() < Date.now());

  // Правилов риск (работи и без AI)
  let risk: "low" | "medium" | "high" = "low";
  const notes: string[] = [];
  if (stage && daysInStage > stage.target_days * 2) {
    risk = "high";
    notes.push(`Забавяне: ${daysInStage} дни в етап „${stage.name}“ (норма ${stage.target_days}).`);
  } else if (stage && daysInStage > stage.target_days) {
    risk = "medium";
    notes.push(`Леко забавяне: ${daysInStage} дни в „${stage.name}“.`);
  }
  if (overdue.length) {
    risk = risk === "high" ? "high" : "medium";
    notes.push(`${overdue.length} просрочени задачи.`);
  }
  if (!check.ok) {
    risk = risk === "low" ? "medium" : risk;
    notes.push(`Липсват документи: ${check.missing.map((m) => m.name).join(", ")}.`);
  }
  if (
    deal.mortgage_needed &&
    !deal.mortgage_approved_at &&
    ["documents", "notary_prep", "notary"].includes(String(deal.stage_code))
  ) {
    risk = "high";
    notes.push("Ипотеката още не е одобрена, а сделката е близо до нотариус.");
  }
  const summaryFallback = notes.join(" ") || "Сделката се движи по план.";
  const nextFallback =
    openTasks[0]?.title ??
    (stage?.is_final
      ? "Сделката е приключена."
      : `Придвижи към следващия етап след „${stage?.name ?? deal.stage_code}“.`);

  let summary = summaryFallback;
  let next = nextFallback;
  let aiUsed = false;

  if (settings.ai_enabled) {
    const res = await aiChatCompletions({
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            'Ти си опитен български брокер и координатор на сделки с недвижими имоти. Анализирай статуса на сделката до нотариус. Върни само JSON: {"risk":"low|medium|high","summary":"до 220 знака","next":"конкретна следваща стъпка до 140 знака"}. Без измислени факти.',
        },
        {
          role: "user",
          content: JSON.stringify({
            deal,
            stage: stage
              ? {
                  name: stage.name,
                  target_days: stage.target_days,
                  required_docs: stage.required_docs,
                }
              : null,
            days_in_stage: daysInStage,
            open_tasks: openTasks.map((t) => t.title),
            overdue_tasks: overdue.map((t) => t.title),
            missing_documents: check.missing.map((m) => m.name),
            rule_based: { risk, summary: summaryFallback },
          }),
        },
      ],
    });
    if (res.ok) {
      try {
        const json = (await res.json()) as any;
        const raw = String(json?.choices?.[0]?.message?.content ?? "");
        const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
        if (parsed?.risk && ["low", "medium", "high"].includes(parsed.risk)) risk = parsed.risk;
        if (parsed?.summary) summary = String(parsed.summary).slice(0, 400);
        if (parsed?.next) next = String(parsed.next).slice(0, 300);
        aiUsed = true;
      } catch {
        /* оставаме на правиловия анализ */
      }
    } else if (res.status === 402 || res.status === 403) {
      await pauseDealJob(`AI е блокиран (HTTP ${res.status})`);
    }
  }

  await db()
    .from("deals")
    .update({
      risk_level: risk,
      risk_note: summary,
      ai_summary: summary,
      ai_next_step: next,
      ai_updated_at: new Date().toISOString(),
    })
    .eq("id", dealId);
  await logEvent(dealId, "deal_analyzed", `Риск: ${risk}. ${summary}`, {
    status: risk === "high" ? "warn" : "ok",
    meta: { ai: aiUsed },
  });
  return { ok: true, risk, summary, next };
}

// ------------------------------------------------------------------
// Cron: застояли сделки, просрочени задачи, нотариус наближава
// ------------------------------------------------------------------
export async function runDealsSweep(limitOverride?: number) {
  const settings = await getDealSettings();
  const empty = { analyzed: 0, stalled: 0, overdue: 0, notary_soon: 0, tasks_created: 0 };
  if (!settings.enabled) return { ran: false, reason: "Автоматизацията е изключена", ...empty };

  const state = await getDealJobState();
  const probeOnly = state.paused;
  if (!(await claimJob(settings.lease_seconds)))
    return { ran: false, reason: "Друг цикъл вече работи", ...empty };

  const limit = Math.min(Math.max(limitOverride ?? settings.batch_size, 1), 50);
  const stats = { ...empty };

  try {
    const stages = await listStages();
    const stageByCode = new Map(stages.map((s) => [s.code, s]));

    const { data: active } = await db()
      .from("deals")
      .select(
        "id, title, stage_code, stage_entered_at, created_at, notary_at, notary_confirmed, ai_updated_at",
      )
      .eq("status", "active")
      .order("last_activity_at", { ascending: true })
      .limit(probeOnly ? 1 : limit);

    for (const d of (active ?? []) as any[]) {
      const stage = stageByCode.get(String(d.stage_code));
      const daysInStage = Math.round(
        (Date.now() - new Date(d.stage_entered_at ?? d.created_at).getTime()) / 86400_000,
      );

      // застояли сделки
      if (daysInStage >= (stage?.target_days ?? settings.stall_days) + settings.stall_days) {
        stats.stalled++;
        await logEvent(
          d.id,
          "deal_stalled",
          `Сделката е ${daysInStage} дни в етап „${stage?.name ?? d.stage_code}“`,
          { status: "warn" },
        );
      }

      // липсващи задачи за текущия етап
      if (stage && !stage.is_final)
        stats.tasks_created += await generateStageTasks(String(d.id), stage);

      // нотариус наближава
      if (d.notary_at) {
        const days = (new Date(d.notary_at).getTime() - Date.now()) / 86400_000;
        if (days > 0 && days <= settings.notary_reminder_days) {
          stats.notary_soon++;
          await logEvent(
            d.id,
            "notary_soon",
            `Нотариус на ${formatSofia(String(d.notary_at))}${d.notary_confirmed ? "" : " — часът още не е потвърден"}`,
            { status: d.notary_confirmed ? "ok" : "warn" },
          );
        }
      }

      // AI преглед максимум веднъж на 24 часа
      const lastAi = d.ai_updated_at ? new Date(d.ai_updated_at).getTime() : 0;
      if (Date.now() - lastAi > 86400_000) {
        await analyzeDeal(String(d.id));
        stats.analyzed++;
      }
    }

    const { data: overdue } = await db()
      .from("deal_tasks")
      .select("id")
      .eq("status", "open")
      .lte("due_at", new Date().toISOString())
      .limit(200);
    stats.overdue = (overdue ?? []).length;

    if (probeOnly && stats.analyzed > 0) await resumeDealJob();
    await releaseJob({ ...stats, at: new Date().toISOString(), probe: probeOnly });
    return {
      ran: true,
      reason: probeOnly ? "Пробен цикъл (автоматизацията е на пауза)" : undefined,
      ...stats,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await releaseJob({ ...stats, error: detail, at: new Date().toISOString() });
    throw new Error(detail);
  }
}

// ------------------------------------------------------------------
// Аналитика
// ------------------------------------------------------------------
export async function dealsAnalytics() {
  const [{ data: ds }, { data: ts }, { data: es }, stages] = await Promise.all([
    db()
      .from("deals")
      .select(
        "id, stage_code, status, price, agreed_price, currency, commission_amount, commission_paid, probability, risk_level, created_at, closed_at, stage_entered_at, notary_at, deal_type",
      )
      .limit(5000),
    db().from("deal_tasks").select("status, due_at").limit(5000),
    db().from("deal_events").select("action, from_stage, to_stage, created_at, meta").limit(5000),
    listStages(),
  ]);
  const deals = (ds ?? []) as any[];
  const tasks = (ts ?? []) as any[];
  const events = (es ?? []) as any[];

  const byStage: Record<string, { name: string; count: number; value: number }> = {};
  for (const s of stages) byStage[s.code] = { name: s.name, count: 0, value: 0 };
  for (const d of deals) {
    const b =
      byStage[String(d.stage_code)] ??
      (byStage[String(d.stage_code)] = { name: String(d.stage_code), count: 0, value: 0 });
    b.count++;
    b.value += Number(d.agreed_price ?? d.price ?? 0);
  }

  const active = deals.filter((d) => d.status === "active");
  const won = deals.filter((d) => d.status === "won");
  const lost = deals.filter((d) => d.status === "lost");
  const pipelineValue = active.reduce((s, d) => s + Number(d.agreed_price ?? d.price ?? 0), 0);
  const weighted = active.reduce(
    (s, d) => s + Number(d.agreed_price ?? d.price ?? 0) * (Number(d.probability ?? 0) / 100),
    0,
  );
  const commissionExpected = active.reduce((s, d) => s + Number(d.commission_amount ?? 0), 0);
  const commissionWon = won.reduce((s, d) => s + Number(d.commission_amount ?? 0), 0);
  const commissionPaid = won
    .filter((d) => d.commission_paid)
    .reduce((s, d) => s + Number(d.commission_amount ?? 0), 0);

  const cycleDays = won
    .filter((d) => d.closed_at)
    .map((d) => (new Date(d.closed_at).getTime() - new Date(d.created_at).getTime()) / 86400_000);
  const avgCycle = cycleDays.length
    ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length)
    : 0;

  const stageDurations: Record<string, number[]> = {};
  for (const e of events) {
    if (e.action !== "stage_moved" || !e.from_stage) continue;
    const days = Number((e.meta as any)?.days ?? 0);
    (stageDurations[String(e.from_stage)] ??= []).push(days);
  }
  const avgStageDays = Object.fromEntries(
    Object.entries(stageDurations).map(([code, arr]) => [
      code,
      Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
    ]),
  );

  const risk = { low: 0, medium: 0, high: 0 } as Record<string, number>;
  for (const d of active)
    risk[String(d.risk_level ?? "low")] = (risk[String(d.risk_level ?? "low")] ?? 0) + 1;

  const now = Date.now();
  const notaryUpcoming = deals.filter(
    (d) => d.notary_at && new Date(d.notary_at).getTime() > now,
  ).length;
  const openTasks = tasks.filter((t) => t.status === "open").length;
  const overdueTasks = tasks.filter(
    (t) => t.status === "open" && t.due_at && new Date(t.due_at).getTime() < now,
  ).length;

  return {
    totals: {
      all: deals.length,
      active: active.length,
      won: won.length,
      lost: lost.length,
      win_rate:
        won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0,
      pipeline_value: Math.round(pipelineValue),
      weighted_value: Math.round(weighted),
      commission_expected: Math.round(commissionExpected),
      commission_won: Math.round(commissionWon),
      commission_paid: Math.round(commissionPaid),
      avg_cycle_days: avgCycle,
      notary_upcoming: notaryUpcoming,
      open_tasks: openTasks,
      overdue_tasks: overdueTasks,
    },
    by_stage: byStage,
    avg_stage_days: avgStageDays,
    risk,
  };
}
