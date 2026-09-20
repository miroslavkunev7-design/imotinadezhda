// Автоматизация №13 — публична онлайн версия на отчета (само по таен токен).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/reports/view/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String((params as { token?: string }).token ?? "");
        if (!token || token.length < 16) return new Response("Not found", { status: 404 });
        const { markReportOpened } = await import("@/lib/owner-reports.server");
        const report = await markReportOpened(token);
        if (!report?.html) return new Response("Not found", { status: 404 });
        const html = `<!doctype html><html lang="bg"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Отчет към собственик — Имоти Надежда</title>
<style>body{margin:0;background:#f4ece0;padding:24px}</style></head>
<body>${report.html}</body></html>`;
        return new Response(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
