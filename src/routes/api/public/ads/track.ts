// Автоматизация №18 — публичен endpoint за атрибуция на лийдове от реклами.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/ads/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ ok: false, error: "Невалиден JSON" }, { status: 400 });
        }
        const str = (k: string) =>
          typeof body[k] === "string" ? (body[k] as string).slice(0, 300) : null;
        try {
          const { trackAttribution } = await import("@/lib/marketing-auto.server");
          const result = await trackAttribution({
            campaign_id: str("cid"),
            creative_id: str("creative_id"),
            lead_id: str("lead_id"),
            utm_source: str("utm_source"),
            utm_medium: str("utm_medium"),
            utm_campaign: str("utm_campaign"),
            landing_url: str("landing_url"),
          });
          return Response.json({ ...result, ok: true });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
