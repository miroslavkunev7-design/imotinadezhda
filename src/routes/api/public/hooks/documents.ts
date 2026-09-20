// Автоматизация №9 — cron hook: AI проверки, напомняния и изтекли документи.
import { createFileRoute } from "@tanstack/react-router";

function authorized(request: Request): boolean {
  const secret = process.env["AUTOMATION_CRON_SECRET"];
  if (!secret) return true;
  const header =
    request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  return header === secret;
}

export const Route = createFileRoute("/api/public/hooks/documents")({
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
          const { runDocumentsQueue } = await import("@/lib/documents.server");
          const result = await runDocumentsQueue(limit);
          return Response.json({ ok: true, result });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
