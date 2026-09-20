// Автоматизация №14 — cron hook: изпраща дължимите покани за ревюта и напомнянията.
import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  const secret = process.env["AUTOMATION_CRON_SECRET"];
  if (!secret) return true;
  const header =
    request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  return header === secret;
}

async function run(limit?: number) {
  const { runReviewSweep } = await import("@/lib/reviews.server");
  return runReviewSweep(limit);
}

export const Route = createFileRoute("/api/public/hooks/reviews")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let limit: number | undefined;
        try {
          const body = (await request.json()) as { limit?: number };
          if (body?.limit) limit = Math.min(Math.max(Number(body.limit), 1), 50);
        } catch {
          /* празно тяло е валидно */
        }
        return Response.json(
          { ok: true, ...(await run(limit)) },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      GET: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        return Response.json(
          { ok: true, ...(await run()) },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
