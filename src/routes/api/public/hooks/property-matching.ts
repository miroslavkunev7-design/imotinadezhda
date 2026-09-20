// Автоматизация №4 — cron hook: генерира съвпадения и разпраща подборките.
import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  const secret = process.env["AUTOMATION_CRON_SECRET"];
  if (!secret) return true; // без конфигуриран секрет — отворено само за вътрешен cron
  const header =
    request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  return header === secret;
}

export const Route = createFileRoute("/api/public/hooks/property-matching")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let limit = 20;
        let propertyId: string | null = null;
        try {
          const body = (await request.json()) as { limit?: number; propertyId?: string };
          if (body?.limit) limit = Math.min(Math.max(Number(body.limit), 1), 100);
          if (body?.propertyId) propertyId = String(body.propertyId);
        } catch {
          /* празно тяло е валидно */
        }

        const { runMatchingSweep, onPropertyPublished } = await import("@/lib/matching.server");
        const result = propertyId
          ? await onPropertyPublished(propertyId)
          : await runMatchingSweep(limit);
        return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
      },
      GET: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        const { runMatchingSweep } = await import("@/lib/matching.server");
        return Response.json(
          { ok: true, ...(await runMatchingSweep(20)) },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
