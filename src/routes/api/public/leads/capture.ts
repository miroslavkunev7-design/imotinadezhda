// Автоматизация №1 — публична входна точка за лийдове от всички канали
// (сайт, портали, реклами, външни форми). Валидира и rate-limit-ва по IP.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().min(2).max(200),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  message: z.string().max(4000).optional().nullable(),
  channel: z.string().max(40).optional().nullable(),
  source: z.string().max(120).optional().nullable(),
  preferred_contact: z.string().max(20).optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
  utm_source: z.string().max(120).optional().nullable(),
  utm_medium: z.string().max(120).optional().nullable(),
  utm_campaign: z.string().max(120).optional().nullable(),
  referrer: z.string().max(400).optional().nullable(),
  landing_path: z.string().max(400).optional().nullable(),
});

const hits = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  rec.count += 1;
  return rec.count > 10;
}

export const Route = createFileRoute("/api/public/leads/capture")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (rateLimited(ip))
          return Response.json({ error: "Твърде много заявки." }, { status: 429 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Невалиден JSON." }, { status: 400 });
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Невалидни данни.", issues: parsed.error.issues },
            { status: 400 },
          );
        }
        if (!parsed.data.phone && !parsed.data.email) {
          return Response.json({ error: "Нужен е телефон или имейл." }, { status: 400 });
        }

        try {
          const { captureLead } = await import("@/lib/leads.server");
          const result = await captureLead(parsed.data);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[leads/capture]", msg);
          return Response.json(
            { error: "Вътрешна грешка при обработка на запитването." },
            { status: 500 },
          );
        }
      },
    },
  },
});
