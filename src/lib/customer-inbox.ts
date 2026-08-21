import { safeAdmin } from "@/integrations/supabase/safe-admin";
import { ingestLead } from "@/lib/lead-capture";
import {
  extractContactHints,
  generateCustomerReply,
  wantsHumanHandoff,
  type ContactHints,
  type ToolEvent,
} from "@/lib/customer-assistant";
import {
  sendChannelReply,
  isQuietHours,
  type AssistantChannel,
} from "@/lib/customer-channels";

const db = () => safeAdmin as any;

export type InboundInput = {
  channel: AssistantChannel;
  text: string;
  visitorToken?: string;
  externalUserId?: string | null;
  displayName?: string | null;
  visitorPhone?: string | null;
  visitorEmail?: string | null;
  pageUrl?: string | null;
  propertyId?: string | null;
  chatId?: string | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type InboundResult = {
  chat_id: string;
  reply: string;
  persisted: boolean;
  handed_off: boolean;
  lead_captured: boolean;
  outbound_sent: boolean;
  quiet_hours: boolean;
};

function channelToLead(channel: AssistantChannel): { source: string; channel: string } {
  if (channel === "whatsapp") return { source: "whatsapp", channel: "whatsapp" };
  if (channel === "messenger") return { source: "facebook", channel: "messenger" };
  if (channel === "viber") return { source: "other", channel: "chat" };
  return { source: "chat", channel: "chat" };
}

function tokenFor(input: InboundInput) {
  if (input.visitorToken && input.visitorToken.length >= 8) return input.visitorToken.slice(0, 128);
  const ext = (input.externalUserId || "anon").replace(/[^a-zA-Z0-9+_-]/g, "").slice(0, 80);
  return `${input.channel}:${ext || "anon"}`.slice(0, 128);
}

async function loadPropertyContext(propertyId: string | null | undefined) {
  if (!propertyId) return undefined;
  const { data } = await db()
    .from("properties")
    .select("title, description, price, currency, area_sqm, rooms, floor, address, property_type, cities(name), quarters(name)")
    .eq("id", propertyId)
    .maybeSingle();
  if (!data) return undefined;
  const c = data as any;
  return [
    `Заглавие: ${c.title}`,
    `Град/Квартал: ${c.cities?.name ?? "—"} / ${c.quarters?.name ?? "—"}`,
    `Цена: ${c.price} ${c.currency}`,
    `Площ: ${c.area_sqm ?? "—"} m², стаи: ${c.rooms ?? "—"}, етаж: ${c.floor ?? "—"}`,
    `Тип: ${c.property_type ?? "—"}`,
    c.description ? `Описание: ${String(c.description).slice(0, 800)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function findOrCreateChat(input: InboundInput) {
  const token = tokenFor(input);
  if (input.chatId) {
    const { data } = await db().from("customer_chats").select("*").eq("id", input.chatId).maybeSingle();
    if (data) return { chat: data as Record<string, unknown>, token, created: false };
  }
  if (input.externalUserId) {
    const { data } = await db()
      .from("customer_chats")
      .select("*")
      .eq("channel", input.channel)
      .eq("external_user_id", input.externalUserId)
      .maybeSingle();
    if (data) return { chat: data as Record<string, unknown>, token, created: false };
  }
  const { data: byToken } = await db()
    .from("customer_chats")
    .select("*")
    .eq("visitor_token", token)
    .order("last_message_at", { ascending: false })
    .limit(1);
  const existing = Array.isArray(byToken) ? byToken[0] : byToken;
  if (existing) return { chat: existing as Record<string, unknown>, token, created: false };

  const insert: Record<string, unknown> = {
    visitor_token: token,
    channel: input.channel,
    external_user_id: input.externalUserId ?? null,
    visitor_name: input.displayName ?? null,
    visitor_phone: input.visitorPhone ?? null,
    visitor_email: input.visitorEmail ?? null,
    page_url: input.pageUrl ?? null,
    property_id: input.propertyId ?? null,
    unanswered: true,
  };
  const { data: created, error } = await db().from("customer_chats").insert(insert).select("*").single();
  if (error) throw error;
  return { chat: created as Record<string, unknown>, token, created: true };
}

async function appendMessage(chatId: string, role: string, content: string) {
  await db().from("customer_chat_messages").insert({
    chat_id: chatId,
    role,
    content: content.slice(0, 8000),
    metadata: {},
  });
}

async function loadHistory(chatId: string) {
  const { data } = await db()
    .from("customer_chat_messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(40);
  return (data ?? []) as Array<{ role: string; content: string }>;
}

function mergeHints(a: ContactHints, b: ContactHints): ContactHints {
  return {
    name: b.name || a.name,
    phone: b.phone || a.phone,
    email: b.email || a.email,
    city: b.city || a.city,
    budget: b.budget ?? a.budget,
  };
}

function hintsFromTools(tools: ToolEvent[]): ContactHints {
  const cap = tools.find((t) => t.name === "capture_contact");
  if (!cap) return {};
  const a = cap.args;
  return {
    name: a.name ? String(a.name) : undefined,
    phone: a.phone ? String(a.phone) : undefined,
    email: a.email ? String(a.email) : undefined,
    city: a.city ? String(a.city) : undefined,
    budget: typeof a.budget === "number" ? a.budget : undefined,
  };
}

async function maybeCaptureLead(
  chat: Record<string, unknown>,
  hints: ContactHints,
  lastMessage: string,
  channel: AssistantChannel,
) {
  if (chat.lead_captured) {
    return { lead_captured: true, inquiry_id: chat.inquiry_id as string | null, client_id: chat.client_id as string | null };
  }
  const name = hints.name || (chat.visitor_name as string | null) || "";
  const phone = hints.phone || (chat.visitor_phone as string | null) || "";
  const email = hints.email || (chat.visitor_email as string | null) || "";
  if (!phone && !email && !name) return { lead_captured: false, inquiry_id: null, client_id: null };
  if (!phone && !email) return { lead_captured: false, inquiry_id: null, client_id: null };

  const map = channelToLead(channel);
  try {
    const result = await ingestLead({
      name: name || "Клиент от чат",
      phone: phone || null,
      email: email || null,
      message: lastMessage.slice(0, 2000),
      property_id: (chat.property_id as string | null) ?? null,
      source: map.source,
      channel: map.channel,
      page_url: (chat.page_url as string | null) ?? null,
      raw: { chat_id: chat.id, assistant: true },
    });
    if (!result.ok) return { lead_captured: false, inquiry_id: null, client_id: null };
    return { lead_captured: true, inquiry_id: result.id, client_id: result.client_id };
  } catch (e: any) {
    console.warn("[assistant] ingestLead failed:", e?.message);
    return { lead_captured: false, inquiry_id: null, client_id: null };
  }
}

export async function handleInbound(input: InboundInput): Promise<InboundResult> {
  const quiet = isQuietHours();
  const text = input.text.trim();
  let persisted = true;
  let chat: Record<string, unknown>;
  let history: Array<{ role: string; content: string }>;

  try {
    const found = await findOrCreateChat(input);
    chat = found.chat;
    await appendMessage(String(chat.id), "user", text);
    history = await loadHistory(String(chat.id));
  } catch (e: any) {
    console.warn("[assistant] persist failed, stateless:", e?.message);
    persisted = false;
    chat = {
      id: input.chatId ?? crypto.randomUUID(),
      is_handed_off: false,
      lead_captured: false,
      visitor_name: input.displayName,
      visitor_phone: input.visitorPhone,
      visitor_email: input.visitorEmail,
      property_id: input.propertyId,
      page_url: input.pageUrl,
    };
    history = [...(input.history ?? []), { role: "user", content: text }];
  }

  const handedAlready = Boolean(chat.is_handed_off);
  const propertyInfo = await loadPropertyContext((input.propertyId || chat.property_id) as string | null);
  const hints = mergeHints(
    {
      name: (input.displayName || chat.visitor_name) as string | undefined,
      phone: (input.visitorPhone || chat.visitor_phone) as string | undefined,
      email: (input.visitorEmail || chat.visitor_email) as string | undefined,
      city: chat.visitor_city as string | undefined,
      budget: chat.visitor_budget != null ? Number(chat.visitor_budget) : undefined,
    },
    extractContactHints(text),
  );

  let reply: string;
  let tools: ToolEvent[] = [];
  let handed_off = handedAlready;

  if (handedAlready) {
    reply = quiet
      ? "Съобщението е предадено на брокер. Ще се свържем след 8:30."
      : "Съобщението е предадено на брокер — ще отговорим лично възможно най-скоро.";
  } else {
    const generated = await generateCustomerReply({
      db: safeAdmin,
      history,
      message: text,
      propertyInfo,
      pageUrl: input.pageUrl ?? (chat.page_url as string | undefined),
    });
    reply = generated.reply;
    tools = generated.tools;
    const toolHints = hintsFromTools(tools);
    Object.assign(hints, mergeHints(hints, toolHints));
    if (tools.some((t) => t.name === "request_human") || wantsHumanHandoff(text)) {
      handed_off = true;
    }
  }

  const lead = persisted
    ? await maybeCaptureLead(chat, hints, text, input.channel)
    : { lead_captured: false, inquiry_id: null, client_id: null };

  if (persisted) {
    const patch: Record<string, unknown> = {
      last_message_at: new Date().toISOString(),
      unanswered: handed_off,
      visitor_name: hints.name || chat.visitor_name || null,
      visitor_phone: hints.phone || chat.visitor_phone || null,
      visitor_email: hints.email || chat.visitor_email || null,
      visitor_city: hints.city || chat.visitor_city || null,
      visitor_budget: hints.budget ?? chat.visitor_budget ?? null,
    };
    if (handed_off) {
      patch.is_handed_off = true;
      patch.handoff_reason = quiet ? "quiet_hours_human" : "user_requested_human";
    }
    if (!handedAlready && !chat.first_response_at) {
      patch.first_response_at = new Date().toISOString();
    }
    if (lead.lead_captured) {
      patch.lead_captured = true;
      patch.inquiry_id = lead.inquiry_id;
      patch.client_id = lead.client_id;
    }
    await db().from("customer_chats").update(patch).eq("id", chat.id);
    await appendMessage(String(chat.id), "assistant", reply);
  }

  let outbound_sent = false;
  if (input.channel !== "site") {
    const pageToken = input.channel === "messenger" ? await loadFacebookPageToken() : null;
    const sent = await sendChannelReply(input.channel, input.externalUserId, reply, pageToken);
    outbound_sent = sent.sent;
  }

  return {
    chat_id: String(chat.id),
    reply,
    persisted,
    handed_off,
    lead_captured: Boolean(lead.lead_captured),
    outbound_sent,
    quiet_hours: quiet,
  };
}

export async function loadFacebookPageToken() {
  const env = (process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "").trim();
  if (env) return env;
  const { data } = await db()
    .from("platform_connections")
    .select("access_token, is_connected")
    .eq("platform_key", "facebook")
    .maybeSingle();
  if (data?.is_connected && data.access_token) return String(data.access_token);
  return null;
}
