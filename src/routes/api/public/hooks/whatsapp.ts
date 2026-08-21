import { createFileRoute } from "@tanstack/react-router";
import { handleInbound } from "@/lib/customer-inbox";
import { verifyMetaHub } from "@/lib/customer-channels";

/** Meta WhatsApp Cloud API webhook — verify + inbound into bot_messages AND customer assistant. */
export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const challenge = verifyMetaHub(request.url, process.env["WHATSAPP_VERIFY_TOKEN"] ?? "");
        if (challenge) return new Response(challenge, { status: 200 });
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: true });
        }
        const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages ?? [];
        for (const msg of messages) {
          const from = String(msg.from ?? "").replace(/\D/g, "");
          const text = msg.text?.body ?? "";
          if (!from || !text) continue;
          const { data: clients } = await supabaseAdmin.from("clients").select("id, phone").not("phone", "is", null);
          const client = (clients ?? []).find((c) => {
            const d = String(c.phone ?? "").replace(/\D/g, "");
            return d.endsWith(from.slice(-8)) || from.endsWith(d.slice(-8));
          });
          await supabaseAdmin.from("bot_messages").insert({
            bot_id: "senior",
            client_id: client?.id ?? null,
            direction: "in",
            channel: "whatsapp",
            body: text,
          });
          try {
            const result = await handleInbound({
              channel: "whatsapp",
              text,
              externalUserId: from,
              visitorPhone: from,
              displayName: client ? undefined : null,
            });
            if (result.reply) {
              await supabaseAdmin.from("bot_messages").insert({
                bot_id: "assistant",
                client_id: client?.id ?? null,
                direction: "out",
                channel: "whatsapp",
                body: result.reply,
              });
            }
          } catch (e: any) {
            console.warn("[whatsapp] assistant failed:", e?.message);
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});
