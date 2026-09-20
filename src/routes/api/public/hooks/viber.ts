// Автоматизация №16 — Viber webhook (bot чат 24/7).
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

function verifyViber(rawBody: string, signature: string | null): boolean {
  const token = process.env["VIBER_BOT_TOKEN"];
  if (!token) return true; // все още неконфигуриран канал
  if (!signature) return false;
  const expected = createHmac("sha256", token).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/hooks/viber")({
  server: {
    handlers: {
      GET: async () => Response.json({ status: "ok", channel: "viber" }),
      POST: async ({ request }) => {
        const raw = await request.text();
        if (!verifyViber(raw, request.headers.get("x-viber-content-signature"))) {
          return new Response("Invalid signature", { status: 401 });
        }
        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (payload?.event !== "message") return Response.json({ status: 0, status_message: "ok" });
        const text = String(payload?.message?.text ?? "").slice(0, 2000);
        const sender = payload?.sender ?? {};
        if (!text || !sender.id) return Response.json({ status: 0, status_message: "ok" });
        try {
          const { handleInbound } = await import("@/lib/omnibot.server");
          await handleInbound({
            channel: "viber",
            externalUserId: String(sender.id),
            displayName: sender.name ?? null,
            text,
          });
        } catch (e) {
          console.error("[viber-hook]", (e as Error).message);
        }
        return Response.json({ status: 0, status_message: "ok" });
      },
    },
  },
});
