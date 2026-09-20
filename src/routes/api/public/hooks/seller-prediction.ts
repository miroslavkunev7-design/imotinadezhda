// Автоматизация №19 — cron hook: откриване и скоринг на потенциални продавачи.
import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  const secret = process.env["AUTOMATION_CRON_SECRET"];
  if (!secret) return true;
  const header =
    request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  return header === secret;
}

async function run() {
  const { runSellerSweep } = await import("@/lib/seller-predict.server");
  return runSellerSweep();
}

export const Route = createFileRoute("/api/public/hooks/seller-prediction")({
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
