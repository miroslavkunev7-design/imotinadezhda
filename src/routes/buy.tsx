import { createFileRoute, Navigate } from "@tanstack/react-router";

import { PAGE_SEO, siteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/buy")({
  head: () => ({
    meta: [
      { title: PAGE_SEO.buy.title },
      { name: "description", content: PAGE_SEO.buy.description },
      { property: "og:title", content: PAGE_SEO.buy.title },
      { property: "og:description", content: PAGE_SEO.buy.description },
      { property: "og:url", content: siteUrl("/search?status=sale") },
    ],
    links: [{ rel: "canonical", href: siteUrl("/search?status=sale") }],
  }),
  component: () => <Navigate to="/search" search={{ status: "sale" } as never} replace />,
});
