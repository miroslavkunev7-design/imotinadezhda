// Автоматизация №16 — публичен endpoint за чат уиджета на сайта (канал web).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const InputSchema = z.object({
  visitor_token: z.string().min(8).max(128),
  message: z.string().min(1).max(2000),
  property_id: z.string().uuid().nullable().optional(),
  page_url: z.string().max(500).optional(),
  name: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(200).optional(),
});

export const Route = createFileRoute("/api/public/bot/message")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        try {
          const body = InputSchema.parse(await request.json());
          const { handleInbound } = await import("@/lib/omnibot.server");
          const result = await handleInbound({
            channel: "web",
            externalUserId: body.visitor_token,
            text: body.message,
            displayName: body.name ?? null,
            phone: body.phone ?? null,
            email: body.email ?? null,
            propertyId: body.property_id ?? null,
            pageUrl: body.page_url ?? null,
          });
          return Response.json({ ok: true, ...result }, { headers: cors });
        } catch (e) {
          return Response.json(
            { ok: false, error: (e as Error).message },
            { status: 400, headers: cors },
          );
        }
      },
    },
  },
});
