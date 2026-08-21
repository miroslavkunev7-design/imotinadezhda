import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";
import { resolveServerDb } from "@/lib/supabase-server-db";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { channelStatus, isQuietHours } from "@/lib/customer-channels";
import { ingestLead } from "@/lib/lead-capture";

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

async function gate(ctx: { userId: string; supabase: any; claims: unknown }) {
  await assertCrmAccess(ctx.userId, ctx.supabase, authEmail(ctx.claims));
  return resolveServerDb(ctx.supabase) as any;
}

export const getAssistantChannelStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await gate(context);
    const { data: fb } = await (supabaseAdmin as any)
      .from("platform_connections")
      .select("is_connected, username, connect_status")
      .eq("platform_key", "facebook")
      .maybeSingle();
    const status = channelStatus();
    if (fb?.is_connected) {
      status.messenger.ready = true;
      status.messenger.send = true;
      status.messenger.hint = `Свързана страница: ${fb.username || "Facebook"}`;
    }
    return {
      quiet_hours: isQuietHours(),
      quiet_window: {
        start: process.env.ASSISTANT_QUIET_HOURS_START || "17:30",
        end: process.env.ASSISTANT_QUIET_HOURS_END || "08:30",
        tz: "Europe/Sofia",
      },
      channels: status,
    };
  });

export const getAssistantAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await gate(context);
    const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await db
      .from("customer_chats")
      .select("id, channel, lead_captured, unanswered, is_handed_off, created_at, first_response_at, last_message_at, client_id")
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<Record<string, unknown>>;

    const byChannel = (list: typeof rows) => {
      const m: Record<string, number> = { site: 0, whatsapp: 0, messenger: 0, viber: 0 };
      for (const r of list) {
        const c = String(r.channel || "site");
        m[c] = (m[c] ?? 0) + 1;
      }
      return m;
    };

    const in7 = rows.filter((r) => String(r.created_at) >= since7);
    const responseMs = rows
      .filter((r) => r.first_response_at && r.created_at)
      .map((r) => new Date(String(r.first_response_at)).getTime() - new Date(String(r.created_at)).getTime())
      .filter((n) => n >= 0 && n < 24 * 3600 * 1000);
    const avgMs = responseMs.length ? Math.round(responseMs.reduce((a, b) => a + b, 0) / responseMs.length) : null;

    return {
      total_30d: rows.length,
      total_7d: in7.length,
      by_channel_30d: byChannel(rows),
      by_channel_7d: byChannel(in7),
      leads_30d: rows.filter((r) => r.lead_captured).length,
      leads_7d: in7.filter((r) => r.lead_captured).length,
      unanswered: rows.filter((r) => r.unanswered).length,
      handed_off: rows.filter((r) => r.is_handed_off).length,
      avg_first_response_ms: avgMs,
      clients_linked: rows.filter((r) => r.client_id).length,
    };
  });

export const convertChatToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ chat_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await gate(context);
    const { data: chat, error } = await (supabaseAdmin as any)
      .from("customer_chats")
      .select("*")
      .eq("id", data.chat_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!chat) throw new Error("Разговорът не е намерен.");

    const { data: msgs } = await (supabaseAdmin as any)
      .from("customer_chat_messages")
      .select("role, content")
      .eq("chat_id", data.chat_id)
      .order("created_at", { ascending: true })
      .limit(12);
    const snippet = (msgs ?? [])
      .filter((m: any) => m.role === "user")
      .map((m: any) => m.content)
      .join("\n")
      .slice(0, 1500);

    const channel = String(chat.channel || "site");
    const result = await ingestLead({
      name: chat.visitor_name || "Клиент от чат",
      phone: chat.visitor_phone,
      email: chat.visitor_email,
      message: snippet || "Конвертиран от AI чат.",
      property_id: chat.property_id,
      source: channel === "whatsapp" ? "whatsapp" : channel === "messenger" ? "facebook" : "chat",
      channel: channel === "whatsapp" ? "whatsapp" : channel === "messenger" ? "messenger" : "chat",
      page_url: chat.page_url,
      raw: { chat_id: chat.id, converted: true },
    });
    if (!result.ok) throw new Error("Недостатъчни данни за клиент (трябва телефон или имейл).");

    await (supabaseAdmin as any)
      .from("customer_chats")
      .update({
        lead_captured: true,
        inquiry_id: result.id,
        client_id: result.client_id,
      })
      .eq("id", data.chat_id);

    return { inquiry_id: result.id, client_id: result.client_id, duplicate: result.duplicate };
  });

export const setChatHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ chat_id: z.string().uuid(), handed_off: z.boolean(), reason: z.string().max(80).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await gate(context);
    const { error } = await (supabaseAdmin as any)
      .from("customer_chats")
      .update({
        is_handed_off: data.handed_off,
        unanswered: data.handed_off,
        handoff_reason: data.handed_off ? data.reason ?? "broker" : null,
      })
      .eq("id", data.chat_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
