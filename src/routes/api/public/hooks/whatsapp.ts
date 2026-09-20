// Автоматизация №16 — WhatsApp Cloud API webhook (bot чат 24/7).
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

function verifyMeta(rawBody: string, header: string | null): boolean {
  const secret = process.env["META_APP_SECRET"];
  if (!secret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const verify = process.env["META_VERIFY_TOKEN"];
        if (
          url.searchParams.get("hub.mode") === "subscribe" &&
          url.searchParams.get("hub.verify_token") === verify
        ) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        if (!verifyMeta(raw, request.headers.get("x-hub-signature-256"))) {
          return new Response("Invalid signature", { status: 401 });
        }
        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        try {
          const { handleInbound } = await import("@/lib/omnibot.server");
          for (const entry of payload?.entry ?? []) {
            for (const change of entry?.changes ?? []) {
              const value = change?.value ?? {};
              const profileName = value?.contacts?.[0]?.profile?.name ?? null;
              for (const msg of value?.messages ?? []) {
                const text = String(msg?.text?.body ?? "").slice(0, 2000);
                if (!text || !msg?.from) continue;
                await handleInbound({
                  channel: "whatsapp",
                  externalUserId: String(msg.from),
                  displayName: profileName,
                  phone: String(msg.from),
                  text,
                });
              }
            }
          }
        } catch (e) {
          console.error("[whatsapp-hook]", (e as Error).message);
        }
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
