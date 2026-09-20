// Автоматизация №3 — публичен въпросник за квалификация (сайт, кампании, лендинги).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  lead_id: z.string().uuid(),
  landing_path: z.string().max(400).optional().nullable(),
  answers: z.object({
    lead_type: z.string().max(40).optional().nullable(),
    budget_min: z.union([z.number(), z.string()]).optional().nullable(),
    budget_max: z.union([z.number(), z.string()]).optional().nullable(),
    currency: z.enum(["EUR", "BGN"]).optional().nullable(),
    desired_city: z.string().max(120).optional().nullable(),
    desired_district: z.string().max(120).optional().nullable(),
    desired_property_type: z.string().max(40).optional().nullable(),
    rooms_min: z.union([z.number(), z.string()]).optional().nullable(),
    area_min: z.union([z.number(), z.string()]).optional().nullable(),
    area_max: z.union([z.number(), z.string()]).optional().nullable(),
    timeframe: z
      .enum(["immediate", "1_3_months", "3_6_months", "6_12_months", "exploring"])
      .optional()
      .nullable(),
    financing: z
      .enum(["cash", "mortgage_approved", "mortgage_needed", "unknown"])
      .optional()
      .nullable(),
    motivation: z.string().max(1000).optional().nullable(),
  }),
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

export const Route = createFileRoute("/api/public/leads/qualify")({
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
        if (!parsed.success)
          return Response.json(
            { error: "Невалидни данни.", issues: parsed.error.issues },
            { status: 400 },
          );

        try {
          const { submitQualificationForm } = await import("@/lib/qualification.server");
          const result = await submitQualificationForm({
            lead_id: parsed.data.lead_id,
            answers: parsed.data.answers as Record<string, unknown>,
            ip,
            landing_path: parsed.data.landing_path ?? null,
          });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[leads/qualify]", e instanceof Error ? e.message : String(e));
          return Response.json({ error: "Вътрешна грешка при квалификацията." }, { status: 500 });
        }
      },
    },
  },
});
