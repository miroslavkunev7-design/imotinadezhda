// Автоматизация №15 — публичен линк за отказ от кампании за реактивиране.
import { createFileRoute } from "@tanstack/react-router";

function page(title: string, text: string) {
  return new Response(
    `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fdf7ec;color:#3a2b2e;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.card{max-width:520px;margin:24px;padding:32px;border:1px solid #e6d3ae;border-radius:16px;background:#fff;text-align:center}
h1{color:#8b1a2b;font-size:22px;margin:0 0 12px}p{margin:0;line-height:1.6}a{color:#8b1a2b;font-weight:600}</style></head>
<body><div class="card"><h1>${title}</h1><p>${text}</p><p style="margin-top:18px"><a href="https://imotinadezhda.bg">Имоти Надежда</a></p></div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } },
  );
}

export const Route = createFileRoute("/api/public/reactivation/o/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String((params as { token?: string }).token ?? "");
        if (!/^[a-f0-9]{16,64}$/i.test(token))
          return page("Невалиден линк", "Линкът е изтекъл или е неправилен.");
        try {
          const { optOutByToken } = await import("@/lib/reactivation.server");
          const ok = await optOutByToken(token);
          return ok
            ? page(
                "Отписахме Ви",
                "Няма да получавате повече съобщения от кампаниите ни. Благодарим Ви за доверието!",
              )
            : page("Невалиден линк", "Линкът е изтекъл или е неправилен.");
        } catch {
          return page(
            "Възникна грешка",
            "Опитайте по-късно или ни пишете на office@imotinadezhda.bg.",
          );
        }
      },
    },
  },
});
