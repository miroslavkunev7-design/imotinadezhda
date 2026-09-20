// Автоматизация №8 — cron hook: обработва опашката за генериране на договори.
import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  const secret = process.env["AUTOMATION_CRON_SECRET"];
  if (!secret) return true;
  const header =
    request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  return header === secret;
}

export const Route = createFileRoute("/api/public/hooks/contracts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let limit: number | undefined;
        try {
          const body = (await request.json()) as { limit?: number } | null;
          if (body?.limit && Number.isFinite(body.limit))
            limit = Math.max(1, Math.min(Number(body.limit), 50));
        } catch {
          limit = undefined;
        }
        try {
          const { runContractsQueue } = await import("@/lib/contracts.server");
          const result = await runContractsQueue(limit);
          return Response.json({ ok: true, result });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
