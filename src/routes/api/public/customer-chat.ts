import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { safeAdmin } from "@/integrations/supabase/safe-admin";
import {
  callCustomerAI,
  customerSystemPrompt,
  fallbackCustomerReply,
  runCustomerTool,
} from "@/lib/customer-assistant";

const InputSchema = z.object({
  chat_id: z.string().uuid().nullable().optional(),
  visitor_token: z.string().min(8).max(128),
  property_id: z.string().uuid().nullable().optional(),
  page_url: z.string().max(500).optional(),
  visitor_name: z.string().max(120).optional(),
  visitor_phone: z.string().max(40).optional(),
  visitor_email: z.string().email().max(200).optional(),
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(40)
    .optional(),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function loadPropertyContext(propertyId: string | null | undefined) {
  if (!propertyId) return undefined;
  const { data } = await safeAdmin
    .from("properties")
    .select("title, description, price, currency, area_sqm, rooms, floor, address, property_type, cities(name), quarters(name)")
    .eq("id", propertyId)
    .maybeSingle();
  if (!data) return undefined;
  const c: any = data;
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

async function prepareChat(body: z.infer<typeof InputSchema>) {
  const { data, error } = await safeAdmin.rpc("visitor_prepare_customer_chat", {
    p_visitor_token: body.visitor_token,
    p_chat_id: body.chat_id ?? null,
    p_property_id: body.property_id ?? null,
    p_page_url: body.page_url ?? null,
    p_visitor_name: body.visitor_name ?? null,
    p_visitor_phone: body.visitor_phone ?? null,
    p_visitor_email: body.visitor_email ?? null,
    p_message: body.message,
  });
  if (error) throw new Error(error.message);
  return data as { chat_id: string; history: Array<{ role: string; content: string }> };
}

async function resolveChat(body: z.infer<typeof InputSchema>) {
  try {
    const prepared = await prepareChat(body);
    return { ...prepared, persisted: true as const };
  } catch (e) {
    console.warn("[customer-chat] DB unavailable, using stateless mode:", (e as Error)?.message);
    const prior = body.history ?? [];
    return {
      chat_id: body.chat_id ?? crypto.randomUUID(),
      history: [...prior, { role: "user" as const, content: body.message }],
      persisted: false as const,
    };
  }
}

async function saveReply(visitorToken: string, chatId: string, reply: string) {
  const { error } = await safeAdmin.rpc("visitor_save_customer_reply", {
    p_visitor_token: visitorToken,
    p_chat_id: chatId,
    p_reply: reply,
  });
  if (error) throw new Error(error.message);
}

export const Route = createFileRoute("/api/public/customer-chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        try {
          const body = InputSchema.parse(await request.json());
          const prepared = await resolveChat(body);
          const chatId = prepared.chat_id;
          const history = prepared.history ?? [];

          const propertyInfo = await loadPropertyContext(body.property_id);
          const sys = customerSystemPrompt({ propertyInfo, pageUrl: body.page_url });

          const messages: any[] = [
            { role: "system", content: sys },
            ...history.map((m) => ({
              role: m.role === "agent" ? "assistant" : m.role,
              content: m.content,
            })),
          ];

          let finalContent = "";

          try {
            for (let i = 0; i < 4; i++) {
              const json = await callCustomerAI(messages);
              const msg = json.choices?.[0]?.message;
              if (!msg) break;
              if (msg.tool_calls?.length) {
                messages.push(msg);
                for (const call of msg.tool_calls) {
                  let args: Record<string, unknown> = {};
                  try {
                    args = JSON.parse(call.function.arguments || "{}");
                  } catch {
                    args = {};
                  }
                  const result = await runCustomerTool(safeAdmin, call.function?.name, args);
                  messages.push({
                    role: "tool",
                    tool_call_id: call.id,
                    content: JSON.stringify(result).slice(0, 12000),
                  });
                }
                continue;
              }
              finalContent = msg.content ?? "";
              break;
            }
          } catch (aiErr: any) {
            const code = aiErr?.message ?? "";
            if (code === "AI_NOT_CONFIGURED" || code.startsWith("AI ") || code === "RATE_LIMIT" || code === "PAYMENT_REQUIRED") {
              console.warn("[customer-chat] AI unavailable, using fallback:", code);
              finalContent = await fallbackCustomerReply(safeAdmin, body.message, propertyInfo);
            } else {
              throw aiErr;
            }
          }

          if (!finalContent) {
            finalContent = await fallbackCustomerReply(safeAdmin, body.message, propertyInfo);
          }

          if (prepared.persisted) {
            await saveReply(body.visitor_token, chatId, finalContent);
          }

          return new Response(JSON.stringify({ chat_id: chatId, reply: finalContent }), {
            status: 200,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        } catch (e: any) {
          const msg = e?.message ?? "error";
          console.error("[customer-chat] error:", msg, e);
          const status = msg === "RATE_LIMIT" ? 429 : msg === "PAYMENT_REQUIRED" ? 402 : 500;
          const safe =
            status === 429
              ? "Малко натоварване — опитайте пак след минута."
              : status === 402
                ? "Асистентът е временно недостъпен. Можете да се обадите на +359 885 774 863."
                : "Възникна грешка. Моля, опитайте отново.";
          return new Response(JSON.stringify({ error: safe }), {
            status,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
