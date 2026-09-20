// Автоматизация №5 — проследяване на follow-up имейли: отваряне, интерес, отписване.
import { createFileRoute } from "@tanstack/react-router";

const PIXEL = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function page(title: string, text: string) {
  return new Response(
    `<!doctype html><html lang="bg"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex"/><title>${title} · Имоти Надежда</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#fffaf3;color:#3a2a2e;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="max-width:520px;padding:32px;text-align:center">
<h1 style="color:#8b1a2b;font-size:26px;margin:0 0 12px">${title}</h1>
<p style="font-size:16px;line-height:1.6">${text}</p>
<a href="https://imotinadezhda.bg" style="display:inline-block;margin-top:18px;background:#8b1a2b;color:#f7e3c0;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">Към сайта</a>
</div></body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    },
  );
}

export const Route = createFileRoute("/api/public/followup/track")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = (url.searchParams.get("token") ?? "").replace(/[^a-f0-9]/gi, "").slice(0, 64);
        const action = url.searchParams.get("action") ?? "";
        if (!token || !["open", "interested", "opt_out"].includes(action)) {
          return page(
            "Невалидна връзка",
            "Линкът е изтекъл или непълен. Обадете ни се и ще помогнем веднага.",
          );
        }

        const { trackMessage, optOutByToken } = await import("@/lib/followup.server");

        if (action === "open") {
          await trackMessage(token, "open");
          return new Response(
            Uint8Array.from(atob(PIXEL), (c) => c.charCodeAt(0)),
            {
              status: 200,
              headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
            },
          );
        }

        if (action === "opt_out") {
          const r = await optOutByToken(token);
          return r.ok
            ? page("Отписахте се", "Няма да получавате повече последващи съобщения от нас.")
            : page(
                "Не намерихме записа",
                "Линкът е изтекъл. Свържете се с нас по телефона от сайта.",
              );
        }

        const r = await trackMessage(token, "click");
        return r.ok
          ? page(
              "Благодарим!",
              "Отбелязахме интереса Ви и спряхме автоматичните напомняния. Наш брокер ще Ви потърси в най-кратък срок.",
            )
          : page(
              "Не намерихме записа",
              "Линкът е изтекъл. Свържете се с нас по телефона от сайта.",
            );
      },
    },
  },
});
