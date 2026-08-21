import { createFileRoute } from "@tanstack/react-router";
import { viberAuthToken } from "@/lib/customer-channels";
import { handleInbound } from "@/lib/customer-inbox";

/**
 * Viber Public Account webhook.
 * Without VIBER_AUTH_TOKEN inbound is logged and answered in CRM only.
 */
export const Route = createFileRoute("/api/public/hooks/viber")({
  server: {
    handlers: {
      GET: async () => {
        const connected = Boolean(viberAuthToken());
        return Response.json({
          ok: true,
          connected,
          hint: connected
            ? "Viber webhook е активен."
            : "Свържи с VIBER_AUTH_TOKEN в .env — входящите се приемат, изходящите чакат токена.",
        });
      },
      POST: async ({ request }) => {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: true });
        }
        if (body?.event === "webhook" || body?.event === "subscribed") {
          return Response.json({ ok: true });
        }
        if (body?.event !== "message") return Response.json({ ok: true });
        const senderId = String(body?.sender?.id ?? "");
        const name = body?.sender?.name ? String(body.sender.name) : null;
        const text = body?.message?.text ?? "";
        if (!senderId || !text) return Response.json({ ok: true });
        try {
          await handleInbound({
            channel: "viber",
            text,
            externalUserId: senderId,
            displayName: name,
          });
        } catch (e: any) {
          console.warn("[viber] assistant failed:", e?.message);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
