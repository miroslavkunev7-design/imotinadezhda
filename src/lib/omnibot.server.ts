// Автоматизация №16 — AI Асистент 24/7 (омниканален чатбот: сайт, Viber, WhatsApp, Messenger).
// Server-only: съдържа достъп до service role клиент и външни API-та на каналите.
import {
  callCustomerAI,
  customerSystemPrompt,
  fallbackCustomerReply,
  searchPublishedProperties,
} from "@/lib/customer-assistant";

export type ChannelCode = "web" | "viber" | "whatsapp" | "messenger";

export type BotSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  handoff_after_messages: number;
  capture_lead: boolean;
  summary_enabled: boolean;
};

const DEFAULT_SETTINGS: BotSettings = {
  enabled: true,
  ai_enabled: true,
  handoff_after_messages: 12,
  capture_lead: true,
  summary_enabled: true,
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function getBotSettings(): Promise<BotSettings> {
  try {
    const { data } = await (await db())
      .from("automation_settings")
      .select("value")
      .eq("key", "bot_24_7")
      .maybeSingle();
    return { ...DEFAULT_SETTINGS, ...((data?.value ?? {}) as Partial<BotSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveBotSettings(patch: Partial<BotSettings>): Promise<BotSettings> {
  const next = { ...(await getBotSettings()), ...patch };
  const { error } = await (await db())
    .from("automation_settings")
    .upsert(
      { key: "bot_24_7", value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

export async function listChannels() {
  const { data, error } = await (await db()).from("bot_channels").select("*").order("code");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateChannel(id: string, patch: Record<string, unknown>) {
  const { error } = await (
    await db()
  )
    .from("bot_channels")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}

async function logEvent(
  eventType: string,
  data: {
    conversation_id?: string | null;
    channel_code?: string | null;
    message?: string;
    payload?: unknown;
  },
) {
  try {
    await (await db()).from("bot_events").insert({
      event_type: eventType,
      conversation_id: data.conversation_id ?? null,
      channel_code: data.channel_code ?? null,
      message: data.message ?? null,
      payload: (data.payload ?? {}) as Record<string, unknown>,
    });
  } catch {
    /* журналът не блокира разговора */
  }
}

// ---------------- Разговори ----------------

export async function ensureConversation(input: {
  channel: ChannelCode;
  externalUserId: string;
  displayName?: string | null;
  propertyId?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const client = await db();
  const { data: existing } = await client
    .from("bot_conversations")
    .select("*")
    .eq("channel_code", input.channel)
    .eq("external_user_id", input.externalUserId)
    .maybeSingle();
  if (existing) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.displayName && !existing.display_name) patch["display_name"] = input.displayName;
    if (input.phone && !existing.contact_phone) patch["contact_phone"] = input.phone;
    if (input.email && !existing.contact_email) patch["contact_email"] = input.email;
    if (input.propertyId) patch["property_id"] = input.propertyId;
    await client.from("bot_conversations").update(patch).eq("id", existing.id);
    return { ...existing, ...patch } as any;
  }
  const { data, error } = await client
    .from("bot_conversations")
    .insert({
      channel_code: input.channel,
      external_user_id: input.externalUserId,
      display_name: input.displayName ?? null,
      contact_phone: input.phone ?? null,
      contact_email: input.email ?? null,
      property_id: input.propertyId ?? null,
      status: "bot",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as any;
}

export async function conversationHistory(conversationId: string, limit = 24) {
  const { data } = await (await db())
    .from("bot_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse() as Array<{ role: string; content: string }>;
}

async function saveMessage(row: Record<string, unknown>) {
  const { data, error } = await (await db()).from("bot_messages").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return data?.id as string;
}

// ---------------- База знания ----------------

export async function matchKnowledge(text: string): Promise<{ id: string; answer: string } | null> {
  const q = text.toLowerCase();
  const { data } = await (await db())
    .from("bot_knowledge")
    .select("id, question, answer, keywords")
    .eq("is_active", true);
  for (const row of (data ?? []) as any[]) {
    const kws: string[] = row.keywords ?? [];
    if (kws.some((k) => k && q.includes(String(k).toLowerCase())))
      return { id: row.id, answer: row.answer };
  }
  return null;
}

export async function listKnowledge() {
  const { data, error } = await (await db())
    .from("bot_knowledge")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertKnowledge(row: {
  id?: string;
  question: string;
  answer: string;
  keywords?: string[];
  category?: string;
  is_active?: boolean;
}) {
  const client = await db();
  const payload = {
    question: row.question,
    answer: row.answer,
    keywords: row.keywords ?? [],
    category: row.category ?? "general",
    is_active: row.is_active ?? true,
    updated_at: new Date().toISOString(),
  };
  if (row.id) {
    const { error } = await client.from("bot_knowledge").update(payload).eq("id", row.id);
    if (error) throw new Error(error.message);
    return row.id;
  }
  const { data, error } = await client.from("bot_knowledge").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data?.id as string;
}

// ---------------- Изпращане по канали ----------------

async function sendViber(receiver: string, text: string) {
  const token = process.env["VIBER_BOT_TOKEN"];
  if (!token) return { delivered: false, error: "Липсва VIBER_BOT_TOKEN" };
  const res = await fetch("https://chatapi.viber.com/pa/send_message", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Viber-Auth-Token": token },
    body: JSON.stringify({ receiver, type: "text", text, sender: { name: "Имоти Надежда" } }),
  });
  const body = await res.text();
  return { delivered: res.ok, error: res.ok ? null : body.slice(0, 300) };
}

async function sendWhatsApp(to: string, text: string) {
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneId)
    return { delivered: false, error: "Липсва WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID" };
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  const body = await res.text();
  return { delivered: res.ok, error: res.ok ? null : body.slice(0, 300) };
}

async function sendMessenger(psid: string, text: string) {
  const token = process.env["MESSENGER_PAGE_TOKEN"];
  if (!token) return { delivered: false, error: "Липсва MESSENGER_PAGE_TOKEN" };
  const res = await fetch(
    `https://graph.facebook.com/v20.0/me/messages?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        messaging_type: "RESPONSE",
        message: { text },
      }),
    },
  );
  const body = await res.text();
  return { delivered: res.ok, error: res.ok ? null : body.slice(0, 300) };
}

/** Изпраща изходящо съобщение по съответния канал (web се доставя в отговора на API-то). */
export async function deliverOutbound(channel: ChannelCode, externalUserId: string, text: string) {
  if (channel === "viber") return sendViber(externalUserId, text);
  if (channel === "whatsapp") return sendWhatsApp(externalUserId, text);
  if (channel === "messenger") return sendMessenger(externalUserId, text);
  return { delivered: true, error: null };
}

// ---------------- Ядро: обработка на входящо съобщение ----------------

function detectIntent(text: string): string {
  const t = text.toLowerCase();
  if (/наем|под наем|наемам/.test(t)) return "rent";
  if (/продам|продавам|продажба на моя/.test(t)) return "sell";
  if (/оцен|колко струва|пазарна стойност/.test(t)) return "valuation";
  if (/нотар|документ|правн|адвокат|данък/.test(t)) return "legal";
  if (/купя|купувам|търся имот|апартамент|къща/.test(t)) return "buy";
  return "other";
}

function needsHandoff(text: string, keywords: string[]): string | null {
  const t = text.toLowerCase();
  const hit = (keywords ?? []).find((k) => k && t.includes(String(k).toLowerCase()));
  return hit ? `Ключова дума: ${hit}` : null;
}

export type InboundResult = {
  conversation_id: string;
  reply: string;
  handoff: boolean;
  ai_used: boolean;
  delivered: boolean;
};

export async function handleInbound(input: {
  channel: ChannelCode;
  externalUserId: string;
  text: string;
  displayName?: string | null;
  propertyId?: string | null;
  phone?: string | null;
  email?: string | null;
  pageUrl?: string | null;
  autoDeliver?: boolean;
}): Promise<InboundResult> {
  const started = Date.now();
  const settings = await getBotSettings();
  const client = await db();

  const channels = await listChannels().catch(() => []);
  const channel = (channels as any[]).find((c) => c.code === input.channel);

  const conv = await ensureConversation({
    channel: input.channel,
    externalUserId: input.externalUserId,
    displayName: input.displayName ?? null,
    propertyId: input.propertyId ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
  });

  const history = await conversationHistory(conv.id);
  await saveMessage({
    conversation_id: conv.id,
    channel_code: input.channel,
    direction: "in",
    role: "user",
    content: input.text,
  });
  await logEvent("inbound", {
    conversation_id: conv.id,
    channel_code: input.channel,
    message: input.text.slice(0, 300),
  });

  const intent = conv.intent ?? detectIntent(input.text);
  const handoffReason =
    needsHandoff(input.text, channel?.handoff_keywords ?? []) ??
    (settings.handoff_after_messages > 0 &&
    (conv.messages_count ?? 0) + 1 >= settings.handoff_after_messages
      ? "Достигнат лимит от съобщения без брокер"
      : null);

  let reply = "";
  let aiUsed = false;

  const autoReply = channel ? channel.is_active && channel.auto_reply : true;

  if (!settings.enabled || !autoReply) {
    reply = "Благодаря! Съобщението Ви е получено — брокер ще се свърже с Вас в работно време.";
  } else {
    const known = await matchKnowledge(input.text).catch(() => null);
    if (known) {
      reply = known.answer;
      await client
        .from("bot_knowledge")
        .update({ hits: 1, updated_at: new Date().toISOString() })
        .eq("id", known.id)
        .then(
          () => undefined,
          () => undefined,
        );
    } else if (settings.ai_enabled) {
      try {
        const sys = customerSystemPrompt({ pageUrl: input.pageUrl ?? undefined });
        const messages: any[] = [
          {
            role: "system",
            content: `${sys}\n\nКанал: ${input.channel}. Отговаряй кратко (до 700 знака), на български.`,
          },
          ...history.map((m) => ({
            role: m.role === "agent" ? "assistant" : m.role,
            content: m.content,
          })),
          { role: "user", content: input.text },
        ];
        const json: any = await callCustomerAI(messages);
        reply = json?.choices?.[0]?.message?.content?.trim() ?? "";
        aiUsed = Boolean(reply);
      } catch (e) {
        await logEvent("error", {
          conversation_id: conv.id,
          channel_code: input.channel,
          message: (e as Error).message,
        });
      }
    }
    if (!reply) {
      reply = await fallbackCustomerReply(client, input.text).catch(
        () =>
          "Благодаря за съобщението! Ще проверя и ще Ви отговоря веднага. Междувременно можете да ми напишете район и бюджет.",
      );
    }
  }

  if (handoffReason) {
    reply = `${reply}\n\nПрехвърлям разговора към наш брокер — ще се свърже с Вас възможно най-скоро. 📞 За спешни случаи: 0800 / офис Шумен.`;
  }

  const outboundDelivery =
    input.autoDeliver === false || input.channel === "web"
      ? { delivered: true, error: null }
      : await deliverOutbound(input.channel, input.externalUserId, reply);

  await saveMessage({
    conversation_id: conv.id,
    channel_code: input.channel,
    direction: "out",
    role: "assistant",
    content: reply,
    ai_used: aiUsed,
    latency_ms: Date.now() - started,
    delivered: outboundDelivery.delivered,
    error: outboundDelivery.error,
  });

  await client
    .from("bot_conversations")
    .update({
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      last_bot_at: new Date().toISOString(),
      messages_count: (conv.messages_count ?? 0) + 2,
      bot_messages_count: (conv.bot_messages_count ?? 0) + 1,
      intent,
      status: handoffReason ? "handoff" : conv.status === "handoff" ? "handoff" : "bot",
      handoff_at: handoffReason ? new Date().toISOString() : conv.handoff_at,
      handoff_reason: handoffReason ?? conv.handoff_reason,
    })
    .eq("id", conv.id);

  if (handoffReason) {
    await logEvent("handoff", {
      conversation_id: conv.id,
      channel_code: input.channel,
      message: handoffReason,
    });
  }

  if (settings.capture_lead && (input.phone || input.email) && !conv.lead_id) {
    try {
      const { captureLead } = await import("@/lib/leads.server");
      const lead = await captureLead({
        full_name: input.displayName ?? conv.display_name ?? "Чат контакт",
        phone: input.phone ?? conv.contact_phone ?? undefined,
        email: input.email ?? conv.contact_email ?? undefined,
        message: input.text,
        source: `bot_${input.channel}`,
        property_id: input.propertyId ?? conv.property_id ?? undefined,
      } as any);
      await client.from("bot_conversations").update({ lead_id: lead.id }).eq("id", conv.id);
      await logEvent("lead_created", {
        conversation_id: conv.id,
        channel_code: input.channel,
        payload: { lead_id: lead.id },
      });
    } catch (e) {
      await logEvent("error", {
        conversation_id: conv.id,
        channel_code: input.channel,
        message: (e as Error).message,
      });
    }
  }

  return {
    conversation_id: conv.id,
    reply,
    handoff: Boolean(handoffReason),
    ai_used: aiUsed,
    delivered: outboundDelivery.delivered,
  };
}

/** Отговор от брокер (от CRM) — записва се и се доставя по канала. */
export async function replyAsAgent(conversationId: string, text: string, agentId?: string | null) {
  const client = await db();
  const { data: conv, error } = await client
    .from("bot_conversations")
    .select("*")
    .eq("id", conversationId)
    .single();
  if (error) throw new Error(error.message);
  const delivery = await deliverOutbound(
    conv.channel_code as ChannelCode,
    conv.external_user_id ?? "",
    text,
  );
  await saveMessage({
    conversation_id: conversationId,
    channel_code: conv.channel_code,
    direction: "out",
    role: "agent",
    content: text,
    delivered: delivery.delivered,
    error: delivery.error,
  });
  await client
    .from("bot_conversations")
    .update({
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      messages_count: (conv.messages_count ?? 0) + 1,
      status: "handoff",
      assigned_to: agentId ?? conv.assigned_to,
    })
    .eq("id", conversationId);
  return delivery;
}

export async function setConversationStatus(
  conversationId: string,
  status: "open" | "bot" | "handoff" | "closed",
) {
  const { error } = await (await db())
    .from("bot_conversations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (error) throw new Error(error.message);
  return true;
}

/** AI резюме на разговор за брокера. */
export async function summarizeConversation(conversationId: string) {
  const client = await db();
  const history = await conversationHistory(conversationId, 40);
  if (!history.length) return null;
  const transcript = history
    .map((m) => `${m.role === "user" ? "Клиент" : "Асистент"}: ${m.content}`)
    .join("\n");
  let summary: string | null = null;
  try {
    const json: any = await callCustomerAI([
      {
        role: "system",
        content:
          "Ти си асистент в агенция за недвижими имоти. Направи кратко резюме (до 120 думи) на разговора: намерение, бюджет, район, следваща стъпка. На български.",
      },
      { role: "user", content: transcript.slice(0, 6000) },
    ] as any);
    summary = json?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    summary = null;
  }
  if (!summary) {
    summary = `Разговор с ${history.length} съобщения. Последно запитване: ${history[history.length - 1]?.content?.slice(0, 200) ?? "—"}`;
  }
  await client
    .from("bot_conversations")
    .update({ ai_summary: summary, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  return summary;
}

/** Предложения за имоти по текста на разговора (за бърз отговор от брокера). */
export async function suggestPropertiesFor(conversationId: string) {
  const client = await db();
  const history = await conversationHistory(conversationId, 12);
  const text = history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");
  const cityMatch = text.match(/шумен|варна|бургас|нови пазар|велики преслав|каспичан|софия/i);
  return searchPublishedProperties(client, {
    city: cityMatch ? cityMatch[0] : undefined,
    limit: 5,
  }).catch(() => []);
}

// ---------------- Анализи ----------------

export async function botAnalytics() {
  const client = await db();
  const [{ data: convs }, { data: msgs }] = await Promise.all([
    client
      .from("bot_conversations")
      .select("id, channel_code, status, intent, created_at, messages_count, satisfaction, lead_id")
      .limit(2000),
    client
      .from("bot_messages")
      .select("id, channel_code, direction, ai_used, latency_ms, delivered, created_at")
      .limit(5000),
  ]);
  const conversations = (convs ?? []) as any[];
  const messages = (msgs ?? []) as any[];

  const byChannel: Record<
    string,
    { conversations: number; messages: number; handoffs: number; leads: number }
  > = {};
  for (const c of conversations) {
    const k = c.channel_code ?? "web";
    byChannel[k] ??= { conversations: 0, messages: 0, handoffs: 0, leads: 0 };
    byChannel[k].conversations += 1;
    if (c.status === "handoff") byChannel[k].handoffs += 1;
    if (c.lead_id) byChannel[k].leads += 1;
  }
  for (const m of messages) {
    const k = m.channel_code ?? "web";
    byChannel[k] ??= { conversations: 0, messages: 0, handoffs: 0, leads: 0 };
    byChannel[k].messages += 1;
  }

  const outbound = messages.filter((m) => m.direction === "out");
  const latencies = outbound
    .map((m) => m.latency_ms)
    .filter((n) => typeof n === "number") as number[];
  const intents: Record<string, number> = {};
  for (const c of conversations)
    intents[c.intent ?? "other"] = (intents[c.intent ?? "other"] ?? 0) + 1;

  const ratings = conversations
    .map((c) => c.satisfaction)
    .filter((n) => typeof n === "number") as number[];

  return {
    total_conversations: conversations.length,
    total_messages: messages.length,
    handoffs: conversations.filter((c) => c.status === "handoff").length,
    closed: conversations.filter((c) => c.status === "closed").length,
    leads_created: conversations.filter((c) => c.lead_id).length,
    ai_reply_share: outbound.length
      ? Math.round((outbound.filter((m) => m.ai_used).length / outbound.length) * 100)
      : 0,
    delivery_rate: outbound.length
      ? Math.round((outbound.filter((m) => m.delivered).length / outbound.length) * 100)
      : 100,
    avg_latency_ms: latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0,
    avg_messages_per_conversation: conversations.length
      ? Math.round((messages.length / conversations.length) * 10) / 10
      : 0,
    avg_satisfaction: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null,
    by_channel: byChannel,
    intents,
  };
}
