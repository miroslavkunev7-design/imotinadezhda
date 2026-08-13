import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { HomePage } from "@/components/site/luxury-real-estate";
import { HomeSkeleton, PageErrorRetry } from "@/components/site/page-skeleton";
import { getPublicPageLayout } from "@/lib/page-layouts.functions";
import { SITE_URL, siteUrl } from "@/lib/site-config";



import homeHeroPoster from "@/assets/home-hero-living.jpeg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Имоти Надежда — недвижими имоти в Бургас, Варна, Шумен" },
      { name: "description", content: "Имоти Надежда — водеща агенция за недвижими имоти. Апартаменти, къщи, парцели и офиси за продажба и под наем в Бургас, Варна, Шумен и Нови пазар." },
      { property: "og:title", content: "Имоти Надежда — недвижими имоти в Бургас, Варна, Шумен" },
      { property: "og:description", content: "Имоти Надежда — водеща агенция за недвижими имоти. Апартаменти, къщи, парцели и офиси за продажба и под наем в Бургас, Варна, Шумен и Нови пазар." },
      { property: "og:url", content: siteUrl("/") },
    ],
    links: [
      { rel: "canonical", href: siteUrl("/") },
      { rel: "preload", as: "image", href: homeHeroPoster, fetchPriority: "high" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "RealEstateAgent",
          name: "Имоти Надежда",
          alternateName: ["Imoti Nadezhda", "imoti nadezhda", "imotinadezhda"],
          url: SITE_URL,
          description: "Агенция за недвижими имоти Имоти Надежда — апартаменти, къщи, парцели и офиси в Бургас, Варна, Шумен и Нови пазар.",
          areaServed: ["Бургас", "Варна", "Шумен", "Нови пазар", "България"],
          address: { "@type": "PostalAddress", addressCountry: "BG" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Имоти Надежда",
          alternateName: ["Imoti Nadezhda", "imoti nadezhda", "imotinadezhda.bg"],
          url: SITE_URL,
          inLanguage: "bg-BG",
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}/search?city_slug={search_term}`,
            "query-input": "required name=search_term",
          },
        }),
      },
    ],
  }),

  pendingMs: 200,
  pendingMinMs: 400,
  pendingComponent: HomeSkeleton,
  errorComponent: HomeErrorRoute,
  notFoundComponent: () => <HomeSkeleton />,
  component: HomeRoute,
});

function HomeErrorRoute({ error }: { error: Error }) {
  const router = useRouter();
  return <PageErrorRetry error={error} onRetry={() => router.invalidate()} />;
}

function HomeRoute() {
  const fetchLayout = useServerFn(getPublicPageLayout);
  const [layout, setLayout] = useState<Awaited<ReturnType<typeof getPublicPageLayout>> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchLayout({ data: { page_key: "home" } })
      .then((res) => { if (!cancelled) setLayout(res); })
      .catch(() => { /* fallback to defaults */ });
    return () => { cancelled = true; };
  }, [fetchLayout]);
  return <HomePage layout={layout ?? undefined} />;
}
