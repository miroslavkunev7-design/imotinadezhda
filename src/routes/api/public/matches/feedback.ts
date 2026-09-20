// Автоматизация №4 — обратна връзка от изпратените имоти (клик в имейла).
import { createFileRoute } from "@tanstack/react-router";

const ACTIONS = ["interested", "rejected", "opt_out", "open"] as const;

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

export const Route = createFileRoute("/api/public/matches/feedback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = (url.searchParams.get("token") ?? "").replace(/[^a-f0-9]/gi, "").slice(0, 64);
        const action = url.searchParams.get("action") ?? "";
        if (!token || !ACTIONS.includes(action as (typeof ACTIONS)[number])) {
          return page(
            "Невалидна връзка",
            "Линкът е изтекъл или непълен. Свържете се с нас на телефона от сайта.",
          );
        }

        const { registerMatchFeedback } = await import("@/lib/matching.server");
        const res = await registerMatchFeedback(token, action as (typeof ACTIONS)[number]);
        if (!res.ok)
          return page(
            "Не намерихме записа",
            "Възможно е линкът да е изтекъл. Обадете ни се и ще помогнем веднага.",
          );

        if (action === "open") {
          return new Response(
            Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) =>
              c.charCodeAt(0),
            ),
            { status: 200, headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } },
          );
        }
        if (action === "interested")
          return page(
            "Благодарим!",
            "Отбелязахме интереса Ви. Наш брокер ще Ви потърси в най-кратък срок за организиране на оглед.",
          );
        if (action === "rejected")
          return page(
            "Разбрахме Ви",
            "Ще прецизираме подбора. Ако желаете, отговорете на имейла с уточнени критерии.",
          );
        return page("Отписахте се", "Няма да получавате повече автоматични предложения за имоти.");
      },
    },
  },
});
