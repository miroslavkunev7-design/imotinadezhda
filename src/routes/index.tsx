import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { HomePage } from "@/components/site/luxury-real-estate";
import { HomeSkeleton, PageErrorRetry } from "@/components/site/page-skeleton";
import { getPublicPageLayout } from "@/lib/page-layouts.functions";
import { getCities } from "@/lib/catalog.functions";
import { HOME_DESCRIPTION, HOME_TITLE, organizationJsonLd, siteUrl, websiteJsonLd } from "@/lib/site-config";



import homeHeroPoster from "@/assets/home-hero-living.jpeg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESCRIPTION },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESCRIPTION },
      { property: "og:url", content: siteUrl("/") },
    ],
    links: [
      { rel: "canonical", href: siteUrl("/") },
      { rel: "preload", as: "image", href: homeHeroPoster, fetchPriority: "high" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(organizationJsonLd()),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify(websiteJsonLd()),
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
  const fetchCities = useServerFn(getCities);
  const [layout, setLayout] = useState<Awaited<ReturnType<typeof getPublicPageLayout>> | null>(null);
  const [cities, setCities] = useState<Array<{ name: string; slug: string; hero_image_url?: string | null }>>([]);
  useEffect(() => {
    let cancelled = false;
    fetchLayout({ data: { page_key: "home" } })
      .then((res) => { if (!cancelled) setLayout(res); })
      .catch(() => { /* fallback to defaults */ });
    fetchCities()
      .then((rows) => {
        if (cancelled) return;
        setCities((rows ?? []).map((c) => ({ name: c.name, slug: c.slug, hero_image_url: c.hero_image_url })));
      })
      .catch(() => { /* fallback cards */ });
    return () => { cancelled = true; };
  }, [fetchLayout, fetchCities]);
  return (
    <HomePage
      layout={layout ?? undefined}
      cities={cities.map((c) => ({ name: c.name, slug: c.slug, image: c.hero_image_url }))}
    />
  );
}
