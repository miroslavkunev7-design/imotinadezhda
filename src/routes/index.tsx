import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/site-header";

const SITE_URL = "https://imotinadezhda.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Недвижими имоти Надежда | Луксозни имоти в България" },
      { name: "description", content: "Луксозни имоти, квартали и подбрани предложения с премиум визуално изживяване." },
      { property: "og:title", content: "Недвижими имоти Надежда" },
      { property: "og:description", content: "Луксозни имоти, квартали и подбрани предложения с премиум визуално изживяване." },
      { property: "og:url", content: `${SITE_URL}/` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  }),
  component: HomeRoute,
});

function HomeRoute() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#1a0a0f] flex flex-col">
      <SiteHeader />
      <main className="flex-1 min-h-0" />
    </div>
  );
}
