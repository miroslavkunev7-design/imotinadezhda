import { createFileRoute } from "@tanstack/react-router";
import { facebookVerifyToken, verifyMetaHub } from "@/lib/customer-channels";
import { handleInbound } from "@/lib/customer-inbox";

/** Facebook Messenger webhook — verify + inbound through the same customer assistant. */
export const Route = createFileRoute("/api/public/hooks/facebook-messenger")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const challenge = verifyMetaHub(request.url, facebookVerifyToken());
        if (challenge) return new Response(challenge, { status: 200 });
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: true });
        }
        const entries = body?.entry ?? [];
        for (const entry of entries) {
          const events = entry?.messaging ?? [];
          for (const ev of events) {
            const psid = String(ev?.sender?.id ?? "");
            const text = ev?.message?.text ?? "";
            if (!psid || !text || ev?.message?.is_echo) continue;
            try {
              await handleInbound({
                channel: "messenger",
                text,
                externalUserId: psid,
              });
            } catch (e: any) {
              console.warn("[messenger] assistant failed:", e?.message);
            }
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});
