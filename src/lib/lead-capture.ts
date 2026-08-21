import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions, resolveAiProvider } from "@/lib/ai-provider";

export const LEAD_SOURCES = [
  "website",
  "property",
  "contacts",
  "sell",
  "chat",
  "whatsapp",
  "facebook",
  "phone",
  "email",
  "manual",
  "other",
] as const;

export const LEAD_CHANNELS = ["web", "chat", "whatsapp", "messenger", "phone", "email", "crm"] as const;
export const LEAD_INTENTS = ["buy", "sell", "rent", "mortgage", "valuation", "other"] as const;
export const LEAD_URGENCY = ["low", "medium", "high"] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadChannel = (typeof LEAD_CHANNELS)[number];
export type LeadIntent = (typeof LEAD_INTENTS)[number];
export type LeadUrgency = (typeof LEAD_URGENCY)[number];

export type IngestLeadInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  property_id?: string | null;
  source?: LeadSource | string;
  channel?: LeadChannel | string;
  page_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  honeypot?: string | null;
  raw?: Record<string, unknown>;
};

export type IngestLeadResult = {
  ok: true;
  id: string;
  duplicate: boolean;
  score: number;
  client_id: string | null;
} | { ok: false; skipped: true; reason: string };

const db = () => supabaseAdmin as any;

export function phoneDigits(raw: string | null | undefined) {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("359")) return d;
  if (d.startsWith("0") && d.length >= 9) return `359${d.slice(1)}`;
  return d;
}

function last8(d: string) {
  return d.slice(-8);
}

function heuristicScore(input: IngestLeadInput, digits: string) {
  let score = 20;
  if (digits.length >= 8) score += 18;
  if ((input.email ?? "").includes("@")) score += 8;
  if (input.property_id) score += 16;
  const msg = (input.message ?? "").trim();
  if (msg.length > 40) score += 10;
  if (msg.length > 120) score += 6;
  const low = msg.toLowerCase();
  if (/(спешн|веднага|днес|утре|ипотек)/.test(low)) score += 14;
  if (/(куп|buy|търся)/.test(low)) score += 8;
  if (input.source === "sell" || input.source === "whatsapp" || input.source === "phone") score += 10;
  return Math.max(0, Math.min(100, score));
}

function heuristicIntent(input: IngestLeadInput): LeadIntent {
  const blob = `${input.source ?? ""} ${input.message ?? ""}`.toLowerCase();
  if (input.source === "sell" || /продав|оценк/.test(blob)) return "sell";
  if (/наем|наема/.test(blob)) return "rent";
  if (/ипотек/.test(blob)) return "mortgage";
  if (/куп|търся|апартамент|къща/.test(blob)) return "buy";
  if (input.property_id) return "buy";
  return "other";
}

function heuristicUrgency(input: IngestLeadInput): LeadUrgency {
  const low = (input.message ?? "").toLowerCase();
  if (/(спешн|веднага|днес|утре)/.test(low)) return "high";
  if ((input.message ?? "").length > 160) return "medium";
  return "medium";
}

async function classifyWithAi(input: IngestLeadInput) {
  if (!resolveAiProvider()) return null;
  const prompt = [
    "Класифицирай запитване към агенция за недвижими имоти в България.",
    "Върни САМО JSON без markdown:",
    '{"intent":"buy|sell|rent|mortgage|valuation|other","urgency":"low|medium|high","city":null,"budget_min":null,"budget_max":null,"summary":"1-2 изречения на български","score_delta":0}',
    `Име: ${input.name ?? "—"}`,
    `Телефон: ${input.phone ?? "—"}`,
    `Имейл: ${input.email ?? "—"}`,
    `Канал: ${input.source ?? "website"}`,
    `Съобщение: ${(input.message ?? "").slice(0, 1500)}`,
  ].join("\n");
  try {
    const res = await aiChatCompletions({
      temperature: 0.1,
      messages: [
        { role: "system", content: "Ти си класификатор на лийдове. Отговаряй само с валиден JSON." },
        { role: "user", content: prompt },
      ],
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as {
      intent?: string;
      urgency?: string;
      city?: string | null;
      budget_min?: number | null;
      budget_max?: number | null;
      summary?: string;
      score_delta?: number;
    };
    const intent = LEAD_INTENTS.includes(parsed.intent as LeadIntent) ? (parsed.intent as LeadIntent) : null;
    const urgency = LEAD_URGENCY.includes(parsed.urgency as LeadUrgency) ? (parsed.urgency as LeadUrgency) : null;
    return {
      intent,
      urgency,
      city: parsed.city ? String(parsed.city).slice(0, 80) : null,
      budget_min: typeof parsed.budget_min === "number" ? parsed.budget_min : null,
      budget_max: typeof parsed.budget_max === "number" ? parsed.budget_max : null,
      summary: parsed.summary ? String(parsed.summary).slice(0, 500) : null,
      score_delta: Math.max(0, Math.min(40, Number(parsed.score_delta) || 0)),
    };
  } catch {
    return null;
  }
}

async function findDuplicate(digits: string, email: string) {
  const q = db().from("inquiries").select("id, phone_digits, email, created_at").order("created_at", { ascending: false }).limit(80);
  const { data } = await q;
  const since = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const needle = last8(digits);
  for (const row of data ?? []) {
    if (new Date(row.created_at).getTime() < since) continue;
    if (needle && last8(String(row.phone_digits ?? "")) === needle) return row.id as string;
    const em = String(row.email ?? "").trim().toLowerCase();
    if (email && em && em === email) return row.id as string;
  }
  return null;
}

async function pickBroker() {
  const { data: brokers } = await db().from("brokers").select("id").eq("is_active", true);
  const list = brokers ?? [];
  if (!list.length) return null;
  const { data: open } = await db()
    .from("inquiries")
    .select("assigned_broker_id")
    .neq("status", "closed")
    .not("assigned_broker_id", "is", null);
  const counts = new Map<string, number>();
  for (const b of list) counts.set(b.id, 0);
  for (const row of open ?? []) {
    const id = row.assigned_broker_id as string;
    if (counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let best = list[0].id as string;
  let min = Infinity;
  for (const [id, n] of counts) {
    if (n < min) {
      min = n;
      best = id;
    }
  }
  return best;
}

function clientTypeFromIntent(intent: LeadIntent) {
  if (intent === "sell") return "seller";
  if (intent === "rent") return "tenant";
  return "buyer";
}

async function linkOrCreateClient(opts: {
  name: string;
  email: string;
  digits: string;
  phone: string | null;
  intent: LeadIntent;
  brokerId: string | null;
}) {
  const { data: clients } = await db().from("clients").select("id, phone, email, full_name").limit(400);
  const needle = last8(opts.digits);
  const email = opts.email.toLowerCase();
  const found = (clients ?? []).find((c: any) => {
    const pd = phoneDigits(c.phone);
    if (needle && last8(pd) === needle) return true;
    const em = String(c.email ?? "").trim().toLowerCase();
    return Boolean(email && em && em === email);
  });
  if (found) return found.id as string;
  if (!opts.digits && !email) return null;
  const { data: created, error } = await db()
    .from("clients")
    .insert({
      full_name: opts.name || "Клиент от запитване",
      phone: opts.phone,
      email: email || null,
      client_type: clientTypeFromIntent(opts.intent),
      status: "active",
      assigned_broker_id: opts.brokerId,
      notes: "Създаден автоматично от Smart Lead Capture",
    })
    .select("id")
    .single();
  if (error) {
    console.warn("[lead-capture] client insert", error.message);
    return null;
  }
  return created?.id ?? null;
}

async function addEvent(inquiryId: string, kind: string, payload: Record<string, unknown> = {}) {
  await db().from("lead_events").insert({ inquiry_id: inquiryId, kind, payload });
}

/** Единен вход за всички канали. */
export async function ingestLead(input: IngestLeadInput): Promise<IngestLeadResult> {
  if ((input.honeypot ?? "").trim()) return { ok: false, skipped: true, reason: "honeypot" };

  const name = (input.name ?? "").trim().slice(0, 120) || "Без име";
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = (input.phone ?? "").trim() || null;
  const digits = phoneDigits(phone);
  const message = (input.message ?? "").trim().slice(0, 4000) || null;
  const source = (LEAD_SOURCES as readonly string[]).includes(input.source ?? "")
    ? (input.source as LeadSource)
    : "website";
  const channel = (LEAD_CHANNELS as readonly string[]).includes(input.channel ?? "")
    ? (input.channel as LeadChannel)
    : source === "whatsapp"
      ? "whatsapp"
      : source === "chat"
        ? "chat"
        : source === "phone" || source === "manual"
          ? "phone"
          : source === "facebook"
            ? "messenger"
            : "web";

  if (name === "Без име" && !digits && !email && !message) {
    return { ok: false, skipped: true, reason: "empty" };
  }

  const duplicateOf = await findDuplicate(digits, email);
  if (duplicateOf && (source === "whatsapp" || source === "chat")) {
    return { ok: true, id: duplicateOf, duplicate: true, score: 0, client_id: null };
  }
  let intent = heuristicIntent(input);
  let urgency = heuristicUrgency(input);
  let score = heuristicScore(input, digits);
  let cityHint: string | null = null;
  let budgetMin: number | null = null;
  let budgetMax: number | null = null;
  let summary: string | null = null;

  const ai = await classifyWithAi(input);
  if (ai) {
    if (ai.intent) intent = ai.intent;
    if (ai.urgency) urgency = ai.urgency;
    cityHint = ai.city;
    budgetMin = ai.budget_min;
    budgetMax = ai.budget_max;
    summary = ai.summary;
    score = Math.max(0, Math.min(100, score + ai.score_delta));
  }

  const brokerId = duplicateOf ? null : await pickBroker();
  const clientId = await linkOrCreateClient({
    name,
    email,
    digits,
    phone,
    intent,
    brokerId,
  });

  const insert: Record<string, unknown> = {
    name,
    email: email || "",
    phone,
    message,
    property_id: input.property_id ?? null,
    status: duplicateOf ? "in_progress" : "new",
    source,
    channel,
    intent,
    urgency,
    score,
    city_hint: cityHint,
    budget_min: budgetMin,
    budget_max: budgetMax,
    client_id: clientId,
    assigned_broker_id: brokerId,
    duplicate_of: duplicateOf,
    page_url: input.page_url ?? null,
    utm_source: input.utm_source ?? null,
    utm_medium: input.utm_medium ?? null,
    utm_campaign: input.utm_campaign ?? null,
    raw: input.raw ?? {},
    ai_summary: summary,
    processed_at: new Date().toISOString(),
    phone_digits: digits || null,
    notes: duplicateOf ? `Възможно дублиране на ${duplicateOf}` : null,
  };

  const { data: row, error } = await db().from("inquiries").insert(insert).select("id").single();
  if (error) throw new Error(error.message);
  const id = row.id as string;
  await addEvent(id, "captured", { source, channel, score, duplicate: Boolean(duplicateOf) });
  if (ai) await addEvent(id, "classified", { intent, urgency, summary });
  if (clientId) await addEvent(id, "linked_client", { client_id: clientId });
  if (brokerId) await addEvent(id, "assigned", { broker_id: brokerId });
  if (duplicateOf) await addEvent(id, "duplicate", { of: duplicateOf });

  return { ok: true, id, duplicate: Boolean(duplicateOf), score, client_id: clientId };
}

export const ingestLeadSchemaShape = {
  name: true,
  email: true,
  phone: true,
  message: true,
  property_id: true,
  source: true,
  channel: true,
  page_url: true,
  honeypot: true,
};
