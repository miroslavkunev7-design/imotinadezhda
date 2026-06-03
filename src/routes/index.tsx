import { createFileRoute } from "@tanstack/react-router";

import landing from "@/assets/landing-master.png.asset.json";
import { LandingImageHome } from "@/components/site/landing-image-home";

const SITE_URL = "https://imotinadezhda.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Недвижими имоти Надежда | Луксозни имоти в България" },
      { name: "description", content: "Премиум недвижими имоти в Бургас, Варна, Шумен и Нов Пазар. Луксозни апартаменти, къщи и инвестиционни оферти." },
      { property: "og:title", content: "Недвижими имоти Надежда | Луксозни имоти в България" },
      { property: "og:description", content: "Премиум недвижими имоти в Бургас, Варна, Шумен и Нов Пазар." },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:image", content: landing.url },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: landing.url },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/` },
      { rel: "preload", as: "image", href: landing.url, fetchpriority: "high" } as never,
      { rel: "preconnect", href: "https://imotinadezhda.lovable.app" },
      { rel: "dns-prefetch", href: "https://imotinadezhda.lovable.app" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "RealEstateAgent",
          name: "Недвижими имоти Надежда",
          url: SITE_URL,
          areaServed: ["Бургас", "Варна", "Шумен", "Нов Пазар"],
          description: "Луксозни недвижими имоти в България.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Недвижими имоти Надежда",
          url: SITE_URL,
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}/search?city_slug={search_term}`,
            "query-input": "required name=search_term",
          },
        }),
      },
    ],
  }),
  component: LandingImageHome,
});
