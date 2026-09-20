// Автоматизация №8 — Генериране на договори: шаблони, автоматично попълване,
// AI допълване на липсващи текстове, изпращане за подпис и аналитика.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions, listAiProviders } from "@/lib/ai-provider";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: unknown) => any;
  };

export const SITE_URL = "https://imotinadezhda.bg";
const JOB_KEY = "contracts_generate";

// ------------------------------------------------------------------
// Настройки
// ------------------------------------------------------------------
export type ContractSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  batch_size: number;
  auto_send: boolean;
  retry_limit: number;
  expire_days: number;
  lease_seconds: number;
  number_prefix: string;
  agency_name: string;
  agency_city: string;
  commission: number;
  term_months: number;
  reserve_days: number;
};

export const DEFAULT_CONTRACTS: ContractSettings = {
  enabled: true,
  ai_enabled: true,
  batch_size: 10,
  auto_send: false,
  retry_limit: 3,
  expire_days: 14,
  lease_seconds: 300,
  number_prefix: "ИН",
  agency_name: "Имоти Надежда",
  agency_city: "Шумен",
  commission: 3,
  term_months: 12,
  reserve_days: 14,
};

export async function getContractSettings(): Promise<ContractSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", "contracts")
    .maybeSingle();
  return { ...DEFAULT_CONTRACTS, ...((data?.value ?? {}) as Partial<ContractSettings>) };
}

export async function saveContractSettings(
  patch: Partial<ContractSettings>,
): Promise<ContractSettings> {
  const next = { ...(await getContractSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert(
      { key: "contracts", value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

// ------------------------------------------------------------------
// Състояние на фоновата задача (single-flight + circuit breaker)
// ------------------------------------------------------------------
export type ContractJobState = {
  key: string;
  paused: boolean;
  paused_reason: string | null;
  paused_at: string | null;
  last_run_at: string | null;
  locked_until: string | null;
  stats: Record<string, number | string | boolean | null>;
};

export async function getContractJobState(): Promise<ContractJobState> {
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

export async function pauseContractJob(reason: string) {
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

export async function resumeContractJob() {
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
  return getContractJobState();
}

// ------------------------------------------------------------------
// Логване
// ------------------------------------------------------------------
async function logEvent(entry: {
  contract_id?: string | null;
  template_id?: string | null;
  action: string;
  status?: string;
  message?: string | null;
  meta?: unknown;
  duration_ms?: number | null;
  actor?: string;
}) {
  await db()
    .from("contract_events")
    .insert({
      contract_id: entry.contract_id ?? null,
      template_id: entry.template_id ?? null,
      action: entry.action,
      status: entry.status ?? "ok",
      message: entry.message ?? null,
      meta: (entry.meta ?? null) as never,
      duration_ms: entry.duration_ms ?? null,
      actor: entry.actor ?? "automation",
    });
}

// ------------------------------------------------------------------
// Шаблонен енджин: {{var}}, {{#if var}}…{{/if}}
// ------------------------------------------------------------------
export type Vars = Record<string, string | number | null | undefined>;

export function extractPlaceholders(template: string): string[] {
  const found = new Set<string>();
  for (const m of template.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)) found.add(m[1]!);
  return [...found];
}

export function renderTemplate(template: string, vars: Vars): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const val = (k: string) => {
    const v = vars[k];
    return v === null || v === undefined || v === "" ? null : String(v);
  };

  // Условни блокове
  let out = template.replace(
    /{{#if\s+([a-zA-Z0-9_]+)\s*}}([\s\S]*?){{\/if}}/g,
    (_m, key: string, body: string) => (val(key) ? body : ""),
  );

  // Променливи
  out = out.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, key: string) => {
    const v = val(key);
    if (v === null) {
      missing.add(key);
      return "________________";
    }
    return v;
  });

  return { text: out, missing: [...missing] };
}

// ------------------------------------------------------------------
// Данни за променливите
// ------------------------------------------------------------------
const bgDate = (d: Date) =>
  d.toLocaleDateString("bg-BG", { day: "2-digit", month: "long", year: "numeric" });
const num = (v: unknown) => (v == null || v === "" ? null : Number(v).toLocaleString("bg-BG"));

const ONES = ["нула", "едно", "две", "три", "четири", "пет", "шест", "седем", "осем", "девет"];

/** Число с думи (опростено, за суми до милион). */
export function amountInWords(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Math.round(Number(value));
  if (n < 10) return ONES[n]!;
  const groups: string[] = [];
  if (n >= 1000) groups.push(`${Math.floor(n / 1000).toLocaleString("bg-BG")} хиляди`);
  const rest = n % 1000;
  if (rest) groups.push(rest.toLocaleString("bg-BG"));
  return groups.join(" и ");
}

export async function buildVariables(input: {
  clientId?: string | null;
  propertyId?: string | null;
  extra?: Vars;
  docNumber?: string | null;
}): Promise<Vars> {
  const s = await getContractSettings();
  const now = new Date();
  const vars: Vars = {
    today: bgDate(now),
    today_iso: now.toISOString().slice(0, 10),
    city: s.agency_city,
    agency_name: s.agency_name,
    commission: s.commission,
    term_months: s.term_months,
    reserve_days: s.reserve_days,
    currency: "EUR",
    pay_day: 5,
    doc_number: input.docNumber ?? null,
    deadline: bgDate(new Date(now.getTime() + 60 * 86400000)),
    start_date: bgDate(now),
  };

  if (input.clientId) {
    const { data: c } = await db()
      .from("clients")
      .select(
        "id, full_name, email, phone, notes, currency, deposit_amount, deposit_currency, interested_property_id, assigned_broker_id",
      )
      .eq("id", input.clientId)
      .maybeSingle();
    if (c) {
      vars.client_name = c.full_name ?? null;
      vars.client_email = c.email ?? null;
      vars.client_phone = c.phone ?? null;
      if (c.deposit_amount) {
        vars.amount = num(c.deposit_amount);
        vars.amount_words = amountInWords(Number(c.deposit_amount));
        vars.deposit = num(c.deposit_amount);
        if (c.deposit_currency) vars.currency = c.deposit_currency;
      }
      if (c.assigned_broker_id) {
        const { data: b } = await db()
          .from("brokers")
          .select("full_name, phone, email")
          .eq("id", c.assigned_broker_id)
          .maybeSingle();
        if (b) {
          vars.broker_name = b.full_name ?? null;
          vars.broker_phone = b.phone ?? null;
          vars.broker_email = b.email ?? null;
        }
      }
    }
  }

  const propertyId = input.propertyId ?? null;
  if (propertyId) {
    const { data: p } = await db()
      .from("properties")
      .select(
        "id, title, price, currency, area_sqm, built_up_area_sqm, address, property_type, floor, total_floors, cities:city_id(name), quarters:quarter_id(name)",
      )
      .eq("id", propertyId)
      .maybeSingle();
    if (p) {
      vars.property_title = p.title ?? null;
      vars.property_price = num(p.price);
      vars.price_words = amountInWords(p.price ? Number(p.price) : null);
      vars.property_area = p.area_sqm ?? p.built_up_area_sqm ?? null;
      vars.property_type = p.property_type ?? null;
      vars.property_floor = p.floor ?? null;
      vars.property_address =
        [p.address, p.quarters?.name, p.cities?.name].filter(Boolean).join(", ") || null;
      if (p.currency) vars.currency = p.currency;
    }
  }

  return { ...vars, ...(input.extra ?? {}) };
}

// ------------------------------------------------------------------
// AI попълване на липсващи описателни полета
// ------------------------------------------------------------------
class GatewayDenied extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function aiFill(templateName: string, vars: Vars, missing: string[]): Promise<Vars> {
  if (!missing.length || listAiProviders().length === 0) return {};
  const res = await aiChatCompletions({
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Ти си български юрист-асистент в агенция за недвижими имоти. Попълваш липсващи полета в договор. " +
          "Връщаш САМО валиден JSON обект (без markdown) с ключове = имената на полетата. " +
          "Ако не можеш да определиш стойност от контекста — върни null. НЕ измисляй имена, ЕГН, суми, дати или адреси.",
      },
      {
        role: "user",
        content: `Документ: ${templateName}\nИзвестни данни: ${JSON.stringify(vars)}\nЛипсващи полета: ${JSON.stringify(missing)}`,
      },
    ],
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 402 || res.status === 403)
      throw new GatewayDenied(res.status, text.slice(0, 400));
    if (res.status === 429 || res.status >= 500)
      throw new Error(`AI временно недостъпен (HTTP ${res.status})`);
    throw new Error(`AI грешка (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content ?? "";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const out: Vars = {};
    for (const key of missing) {
      const v = parsed[key];
      if (typeof v === "string" && v.trim()) out[key] = v.trim();
      else if (typeof v === "number") out[key] = v;
    }
    return out;
  } catch {
    return {};
  }
}

// ------------------------------------------------------------------
// Генериране
// ------------------------------------------------------------------
export type GenerateInput = {
  templateId?: string | null;
  templateCode?: string | null;
  clientId?: string | null;
  propertyId?: string | null;
  leadId?: string | null;
  variables?: Vars;
  useAi?: boolean;
  autoSend?: boolean;
  source?: string;
  actor?: string;
};

async function loadTemplate(input: GenerateInput) {
  let q = db().from("contract_templates").select("*").eq("is_active", true).limit(1);
  if (input.templateId)
    q = db().from("contract_templates").select("*").eq("id", input.templateId).limit(1);
  else if (input.templateCode)
    q = db().from("contract_templates").select("*").eq("code", input.templateCode).limit(1);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const tpl = data?.[0];
  if (!tpl) throw new Error("Шаблонът не е намерен или е неактивен.");
  return tpl;
}

async function nextDocNumber(prefix: string): Promise<string> {
  const { data, error } = await db().rpc("next_contract_number", { _prefix: prefix });
  if (error || !data)
    return `${prefix}-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
  return String(data);
}

export async function generateContract(input: GenerateInput) {
  const started = Date.now();
  const settings = await getContractSettings();
  const tpl = await loadTemplate(input);

  const docNumber = await nextDocNumber(settings.number_prefix);
  let vars = await buildVariables({
    clientId: input.clientId ?? null,
    propertyId: input.propertyId ?? null,
    extra: input.variables,
    docNumber,
  });

  let first = renderTemplate(tpl.template_content ?? "", vars);
  let aiUsed = false;

  const wantAi = (input.useAi ?? settings.ai_enabled) && settings.ai_enabled;
  if (wantAi && first.missing.length) {
    try {
      const filled = await aiFill(tpl.name, vars, first.missing);
      if (Object.keys(filled).length) {
        vars = { ...vars, ...filled };
        first = renderTemplate(tpl.template_content ?? "", vars);
        aiUsed = true;
      }
    } catch (e) {
      if (e instanceof GatewayDenied) {
        await pauseContractJob(`AI блокиран (HTTP ${e.status}): ${e.message}`);
        await logEvent({
          template_id: tpl.id,
          action: "ai_fill",
          status: "error",
          message: `HTTP ${e.status}: ${e.message}`,
        });
      } else {
        await logEvent({
          template_id: tpl.id,
          action: "ai_fill",
          status: "error",
          message: (e as Error).message,
        });
      }
    }
  }

  const amount =
    vars.amount != null
      ? Number(
          String(vars.amount)
            .replace(/[^\d.,-]/g, "")
            .replace(/\s/g, "")
            .replace(",", "."),
        )
      : null;
  const expires = new Date(Date.now() + settings.expire_days * 86400000).toISOString();

  const { data: row, error } = await db()
    .from("generated_contracts")
    .insert({
      title: `${tpl.name} № ${docNumber}`,
      contract_type: tpl.contract_type ?? "other",
      content: first.text,
      template_id: tpl.id,
      template_version: tpl.version ?? 1,
      doc_number: docNumber,
      client_id: input.clientId ?? null,
      property_id: input.propertyId ?? null,
      lead_id: input.leadId ?? null,
      variables: vars as never,
      missing_fields: first.missing as never,
      ai_used: aiUsed,
      amount: Number.isFinite(amount as number) ? amount : null,
      currency: (vars.currency as string) ?? "EUR",
      status: "draft",
      source: input.source ?? "manual",
      expires_at: expires,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await db()
    .from("contract_templates")
    .update({
      generated_count: (tpl.generated_count ?? 0) + 1,
      placeholders: extractPlaceholders(tpl.template_content ?? "") as never,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tpl.id);

  await logEvent({
    contract_id: row.id,
    template_id: tpl.id,
    action: "generate",
    message: `Генериран ${docNumber}${aiUsed ? " (с AI допълване)" : ""}`,
    meta: { missing: first.missing },
    duration_ms: Date.now() - started,
    actor: input.actor ?? "crm",
  });

  if (input.autoSend ?? settings.auto_send) {
    try {
      return await sendForSignature(row.id, input.actor);
    } catch (e) {
      await logEvent({
        contract_id: row.id,
        action: "send",
        status: "error",
        message: (e as Error).message,
      });
    }
  }

  return row;
}

// ------------------------------------------------------------------
// Подпис по линк
// ------------------------------------------------------------------
function token(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sendForSignature(id: string, actor?: string) {
  const settings = await getContractSettings();
  const { data: current } = await db()
    .from("generated_contracts")
    .select("share_token, client_id")
    .eq("id", id)
    .maybeSingle();
  let signer: { name?: string | null; email?: string | null; phone?: string | null } = {};
  if (current?.client_id) {
    const { data: c } = await db()
      .from("clients")
      .select("full_name, email, phone")
      .eq("id", current.client_id)
      .maybeSingle();
    if (c) signer = { name: c.full_name, email: c.email, phone: c.phone };
  }
  const now = new Date().toISOString();
  const share = current?.share_token ?? token();
  const { data: row, error } = await db()
    .from("generated_contracts")
    .update({
      status: "sent",
      share_token: share,
      sent_at: now,
      updated_at: now,
      signer_name: signer.name ?? null,
      signer_email: signer.email ?? null,
      signer_phone: signer.phone ?? null,
      expires_at: new Date(Date.now() + settings.expire_days * 86400000).toISOString(),
      last_error: null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent({
    contract_id: id,
    action: "send",
    message: `Изпратен за подпис на ${signer.email ?? signer.phone ?? "клиента"}`,
    actor: actor ?? "crm",
  });
  return { ...row, sign_url: signUrl(share) };
}

export const signUrl = (shareToken: string) =>
  `${SITE_URL}/api/public/contracts/sign/${shareToken}`;

export async function getContractByToken(shareToken: string) {
  const { data } = await db()
    .from("generated_contracts")
    .select(
      "id, title, doc_number, content, status, signed_at, declined_at, expires_at, signer_name",
    )
    .eq("share_token", shareToken)
    .maybeSingle();
  if (!data) return null;
  if (data.status === "sent") {
    await db()
      .from("generated_contracts")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("viewed_at", null);
    await logEvent({ contract_id: data.id, action: "view", actor: "client" });
  }
  return data;
}

export async function signByToken(shareToken: string, signatureName: string, ip?: string | null) {
  const doc = await db()
    .from("generated_contracts")
    .select("id, status, expires_at")
    .eq("share_token", shareToken)
    .maybeSingle();
  const row = doc.data;
  if (!row) throw new Error("Документът не е намерен.");
  if (row.status === "signed") return { ok: true, already: true };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now())
    throw new Error("Срокът за подписване е изтекъл.");
  const now = new Date().toISOString();
  const { error } = await db()
    .from("generated_contracts")
    .update({
      status: "signed",
      signed_at: now,
      updated_at: now,
      signature_name: signatureName,
      signature_ip: ip ?? null,
    })
    .eq("id", row.id);
  if (error) throw new Error(error.message);
  await logEvent({
    contract_id: row.id,
    action: "sign",
    message: `Подписан от ${signatureName}`,
    actor: "client",
  });
  return { ok: true, already: false };
}

export async function declineByToken(shareToken: string, reason: string) {
  const { data: row } = await db()
    .from("generated_contracts")
    .select("id")
    .eq("share_token", shareToken)
    .maybeSingle();
  if (!row) throw new Error("Документът не е намерен.");
  const now = new Date().toISOString();
  await db()
    .from("generated_contracts")
    .update({ status: "declined", declined_at: now, decline_reason: reason, updated_at: now })
    .eq("id", row.id);
  await logEvent({
    contract_id: row.id,
    action: "decline",
    status: "skipped",
    message: reason,
    actor: "client",
  });
  return { ok: true };
}

export async function voidContract(id: string, reason: string, actor?: string) {
  const now = new Date().toISOString();
  await db()
    .from("generated_contracts")
    .update({ status: "void", share_token: null, updated_at: now, last_error: reason })
    .eq("id", id);
  await logEvent({ contract_id: id, action: "void", message: reason, actor: actor ?? "crm" });
  return { ok: true };
}

// ------------------------------------------------------------------
// Опашка + фонова обработка
// ------------------------------------------------------------------
export async function enqueueContract(input: {
  templateId?: string | null;
  templateCode?: string | null;
  clientId?: string | null;
  propertyId?: string | null;
  leadId?: string | null;
  variables?: Vars;
  autoSend?: boolean;
  requestedBy?: string;
}) {
  const dedupe = [
    input.templateId ?? input.templateCode ?? "tpl",
    input.clientId ?? "-",
    input.propertyId ?? "-",
  ].join(":");
  const { data, error } = await db()
    .from("contract_queue")
    .upsert(
      {
        template_id: input.templateId ?? null,
        template_code: input.templateCode ?? null,
        client_id: input.clientId ?? null,
        property_id: input.propertyId ?? null,
        lead_id: input.leadId ?? null,
        dedupe_key: dedupe,
        variables: (input.variables ?? {}) as never,
        auto_send: input.autoSend ?? false,
        requested_by: input.requestedBy ?? "crm",
        status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(error.message);
  await logEvent({
    template_id: input.templateId ?? null,
    action: "queue",
    message: `В опашка: ${dedupe}`,
    actor: input.requestedBy ?? "crm",
  });
  return { queued: (data ?? []).length };
}

export async function runContractsQueue(limit?: number) {
  const settings = await getContractSettings();
  if (!settings.enabled) return { skipped: "disabled" as const };

  const job = await getContractJobState();
  const batch = Math.max(1, Math.min(limit ?? settings.batch_size, 50));

  if (job.paused) {
    // Пауза заради AI блокировка → правим само 1 пробен документ.
    const probe = await processQueue(1, settings, true);
    return { paused: true, reason: job.paused_reason, probe };
  }

  if (!(await claimJob(settings.lease_seconds))) return { skipped: "locked" as const };
  try {
    const stats = await processQueue(batch, settings, false);
    await releaseJob(stats as unknown as Record<string, number | string | boolean | null>);
    return stats;
  } catch (e) {
    await releaseJob({ error: (e as Error).message });
    throw e;
  }
}

async function processQueue(batch: number, settings: ContractSettings, probe: boolean) {
  const { data: rows, error } = await db()
    .from("contract_queue")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", settings.retry_limit)
    .order("created_at", { ascending: true })
    .limit(batch);
  if (error) throw new Error(error.message);

  let generated = 0;
  let failed = 0;
  let sent = 0;

  for (const item of rows ?? []) {
    const now = new Date().toISOString();
    try {
      const doc = await generateContract({
        templateId: item.template_id,
        templateCode: item.template_code,
        clientId: item.client_id,
        propertyId: item.property_id,
        leadId: item.lead_id,
        variables: (item.variables ?? {}) as Vars,
        autoSend: item.auto_send || settings.auto_send,
        source: "automation",
        actor: item.requested_by ?? "automation",
      });
      generated += 1;
      if (doc?.status === "sent") sent += 1;
      await db()
        .from("contract_queue")
        .update({
          status: "done",
          contract_id: doc.id,
          processed_at: now,
          updated_at: now,
          attempts: (item.attempts ?? 0) + 1,
          last_error: null,
        })
        .eq("id", item.id);
      if (probe) {
        await resumeContractJob();
        break;
      }
    } catch (e) {
      failed += 1;
      const message = (e as Error).message;
      await db()
        .from("contract_queue")
        .update({
          status: (item.attempts ?? 0) + 1 >= settings.retry_limit ? "error" : "pending",
          attempts: (item.attempts ?? 0) + 1,
          last_error: message,
          updated_at: now,
        })
        .eq("id", item.id);
      await logEvent({ action: "error", status: "error", message, meta: { queue_id: item.id } });
      if ((await getContractJobState()).paused) break;
    }
  }

  return { processed: (rows ?? []).length, generated, sent, failed };
}

// ------------------------------------------------------------------
// Аналитика
// ------------------------------------------------------------------
export async function contractsAnalytics() {
  const { data: docs } = await db()
    .from("generated_contracts")
    .select("status, ai_used, amount, currency, created_at, signed_at, sent_at, contract_type")
    .order("created_at", { ascending: false })
    .limit(1000);
  const rows = docs ?? [];

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let aiCount = 0;
  let signedValue = 0;
  let signHours = 0;
  let signHoursCount = 0;

  for (const r of rows) {
    byStatus[r.status ?? "draft"] = (byStatus[r.status ?? "draft"] ?? 0) + 1;
    byType[r.contract_type ?? "other"] = (byType[r.contract_type ?? "other"] ?? 0) + 1;
    if (r.ai_used) aiCount += 1;
    if (r.status === "signed") {
      signedValue += Number(r.amount ?? 0);
      if (r.sent_at && r.signed_at) {
        signHours += (new Date(r.signed_at).getTime() - new Date(r.sent_at).getTime()) / 3600000;
        signHoursCount += 1;
      }
    }
  }

  const { count: pending } = await db()
    .from("contract_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  const sentTotal =
    (byStatus["sent"] ?? 0) + (byStatus["signed"] ?? 0) + (byStatus["declined"] ?? 0);

  return {
    total: rows.length,
    byStatus,
    byType,
    aiCount,
    signedValue,
    pendingQueue: pending ?? 0,
    signRate: sentTotal ? Math.round(((byStatus["signed"] ?? 0) / sentTotal) * 100) : 0,
    avgSignHours: signHoursCount ? Math.round((signHours / signHoursCount) * 10) / 10 : 0,
  };
}

export async function listTemplates() {
  const { data, error } = await db()
    .from("contract_templates")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveTemplate(id: string | null, patch: Record<string, unknown>) {
  const body = { ...patch, updated_at: new Date().toISOString() } as Record<string, unknown>;
  if (typeof body["template_content"] === "string") {
    body["placeholders"] = extractPlaceholders(body["template_content"] as string);
  }
  if (id) {
    const { error } = await db().from("contract_templates").update(body).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true, id };
  }
  const { data, error } = await db().from("contract_templates").insert(body).select("id").single();
  if (error) throw new Error(error.message);
  return { ok: true, id: data.id as string };
}
