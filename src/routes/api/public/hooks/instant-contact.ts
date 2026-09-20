// Автоматизация №2 — cron endpoint: обработва изостанали първи контакти
// и ескалира лийдове без контакт. Викa се от pg_cron / външен планировчик.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/instant-contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["AUTOMATION_CRON_SECRET"];
        if (secret) {
          const provided = request.headers.get("x-cron-secret");
          if (provided !== secret) return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runInstantContactSweep } = await import("@/lib/leads.server");
          return Response.json(await runInstantContactSweep());
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
