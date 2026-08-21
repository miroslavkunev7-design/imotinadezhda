import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { handleInbound } from "@/lib/customer-inbox";

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

export const Route = createFileRoute("/api/public/customer-chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        try {
          const body = InputSchema.parse(await request.json());
          const result = await handleInbound({
            channel: "site",
            text: body.message,
            visitorToken: body.visitor_token,
            chatId: body.chat_id ?? null,
            displayName: body.visitor_name ?? null,
            visitorPhone: body.visitor_phone ?? null,
            visitorEmail: body.visitor_email ?? null,
            pageUrl: body.page_url ?? null,
            propertyId: body.property_id ?? null,
            history: body.history,
          });
          return new Response(
            JSON.stringify({
              chat_id: result.chat_id,
              reply: result.reply,
              handed_off: result.handed_off,
              lead_captured: result.lead_captured,
            }),
            { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
          );
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
