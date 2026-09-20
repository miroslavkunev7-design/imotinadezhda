// Автоматизация №18 — cron hook: бюджетни проверки и авто-пауза на кампании.
import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  const secret = process.env["AUTOMATION_CRON_SECRET"];
  if (!secret) return true;
  const header =
    request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  return header === secret;
}

async function run() {
  const { runMarketingSweep } = await import("@/lib/marketing-auto.server");
  return runMarketingSweep();
}

export const Route = createFileRoute("/api/public/hooks/marketing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        try {
          return Response.json({ ok: true, result: await run() });
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
