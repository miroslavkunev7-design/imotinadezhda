// Автоматизация №7 — публичен фид: порталите изтеглят активните обяви (XML/JSON/CSV).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/portals/feed/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = new URL(request.url).searchParams.get("token");
        const { buildPortalFeed } = await import("@/lib/portals.server");
        const feed = await buildPortalFeed(String((params as { code: string }).code), token);
        return new Response(feed.body, {
          status: feed.status,
          headers: { "Content-Type": feed.contentType, "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
