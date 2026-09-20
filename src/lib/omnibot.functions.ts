// Автоматизация №16 — API слой (typed RPC) за модула „AI Асистент 24/7“.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const listBotConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; channel?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("bot_conversations")
      .select(
        "id, created_at, updated_at, channel_code, external_user_id, display_name, contact_phone, contact_email, status, intent, last_message_at, messages_count, bot_messages_count, handoff_at, handoff_reason, satisfaction, ai_summary, lead_id, property_id",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(300);
    if (data.status) q = q.eq("status", data.status);
    if (data.channel) q = q.eq("channel_code", data.channel);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listBotMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("bot_messages")
      .select(
        "id, created_at, direction, role, content, ai_used, delivered, error, latency_ms, channel_code",
      )
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(400);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listBotChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listChannels } = await import("@/lib/omnibot.server");
    return listChannels();
  });

export const updateBotChannelFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { updateChannel } = await import("@/lib/omnibot.server");
    return updateChannel(data.id, data.patch);
  });

export const listBotKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listKnowledge } = await import("@/lib/omnibot.server");
    return listKnowledge();
  });

export const upsertBotKnowledgeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      question: string;
      answer: string;
      keywords?: string[];
      category?: string;
      is_active?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { upsertKnowledge } = await import("@/lib/omnibot.server");
    return upsertKnowledge(data);
  });

export const replyAsAgentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string; text: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { replyAsAgent } = await import("@/lib/omnibot.server");
    return replyAsAgent(data.conversationId, data.text, context.userId);
  });

export const setBotConversationStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { conversationId: string; status: "open" | "bot" | "handoff" | "closed" }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { setConversationStatus } = await import("@/lib/omnibot.server");
    return setConversationStatus(data.conversationId, data.status);
  });

export const summarizeBotConversationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { summarizeConversation } = await import("@/lib/omnibot.server");
    return summarizeConversation(data.conversationId);
  });

export const suggestBotPropertiesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { suggestPropertiesFor } = await import("@/lib/omnibot.server");
    return suggestPropertiesFor(data.conversationId);
  });

export const getBotSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getBotSettings } = await import("@/lib/omnibot.server");
    return getBotSettings();
  });

export const saveBotSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveBotSettings } = await import("@/lib/omnibot.server");
    return saveBotSettings(data as never);
  });

export const botAnalyticsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { botAnalytics } = await import("@/lib/omnibot.server");
    return botAnalytics();
  });

export const listBotEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("bot_events")
      .select("id, created_at, conversation_id, channel_code, event_type, message")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
