// Автоматизация №15 — cron hook: авто-записване на неактивни клиенти и изпращане на дължимите стъпки.
import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  const secret = process.env["AUTOMATION_CRON_SECRET"];
  if (!secret) return true;
  const header =
    request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  return header === secret;
}

async function run(limit?: number) {
  const { runReactivationSweep } = await import("@/lib/reactivation.server");
  return runReactivationSweep(limit);
}

export const Route = createFileRoute("/api/public/hooks/reactivation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        let limit: number | undefined;
        try {
          const body = (await request.json()) as { limit?: number };
          if (body?.limit) limit = Math.min(Math.max(Number(body.limit), 1), 50);
        } catch {
          limit = undefined;
        }
        try {
          return Response.json({ ok: true, result: await run(limit) });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
      GET: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        try {
          return Response.json({ ok: true, result: await run() });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
