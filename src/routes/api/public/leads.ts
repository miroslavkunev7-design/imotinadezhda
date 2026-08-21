import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ingestLead } from "@/lib/lead-capture";

const Body = z.object({
  name: z.string().max(120).optional().nullable(),
  email: z.union([z.literal(""), z.string().email().max(200)]).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  message: z.string().max(4000).optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
  source: z.string().max(40).optional(),
  channel: z.string().max(40).optional(),
  page_url: z.string().max(500).optional().nullable(),
  utm_source: z.string().max(80).optional().nullable(),
  utm_medium: z.string().max(80).optional().nullable(),
  utm_campaign: z.string().max(80).optional().nullable(),
  website: z.string().max(120).optional().nullable(),
  honeypot: z.string().max(120).optional().nullable(),
});

const hits = new Map<string, number[]>();

function rateOk(ip: string) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const prev = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= 12) {
    hits.set(ip, prev);
    return false;
  }
  prev.push(now);
  hits.set(ip, prev);
  return true;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/leads")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("cf-connecting-ip") ||
          "local";
        if (!rateOk(ip)) {
          return Response.json({ error: "Твърде много запитвания. Опитайте след малко." }, { status: 429, headers: cors });
        }
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "Невалиден JSON" }, { status: 400, headers: cors });
        }
        const parsed = Body.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ error: "Невалидни данни", details: parsed.error.flatten() }, { status: 400, headers: cors });
        }
        const d = parsed.data;
        try {
          const result = await ingestLead({
            name: d.name,
            email: d.email,
            phone: d.phone,
            message: d.message,
            property_id: d.property_id,
            source: d.source,
            channel: d.channel,
            page_url: d.page_url,
            utm_source: d.utm_source,
            utm_medium: d.utm_medium,
            utm_campaign: d.utm_campaign,
            honeypot: d.honeypot || d.website,
            raw: { ip },
          });
          if (!result.ok) return Response.json({ ok: true, skipped: true }, { status: 200, headers: cors });
          return Response.json(
            { ok: true, id: result.id, duplicate: result.duplicate, score: result.score },
            { status: 200, headers: cors },
          );
        } catch (e: any) {
          console.error("[leads] ingest", e?.message);
          return Response.json({ error: "Не успяхме да запишем запитването." }, { status: 500, headers: cors });
        }
      },
    },
  },
});
