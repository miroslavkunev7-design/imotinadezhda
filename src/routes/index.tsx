import { createFileRoute, useRouter } from "@tanstack/react-router";

import { HomePage } from "@/components/site/luxury-real-estate";
import { HomeSkeleton, PageErrorRetry } from "@/components/site/page-skeleton";
import { getCities, getFeaturedProperties } from "@/lib/catalog.functions";
import { getPublicPageLayout } from "@/lib/page-layouts.functions";

const SITE_URL = "https://imotinadezhda.lovable.app";

// Race a promise with a timeout; on timeout resolve with fallback rather than rejecting,
// so a slow backend never blocks the whole page render.
function softTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch(() => {
        clearTimeout(t);
        resolve(fallback);
      });
  });
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Имоти Надежда — недвижими имоти в Бургас, Варна, Шумен" },
      { name: "description", content: "Имоти Надежда — водеща агенция за недвижими имоти. Апартаменти, къщи, парцели и офиси за продажба и под наем в Бургас, Варна, Шумен и Нови пазар." },
      { property: "og:title", content: "Имоти Надежда — недвижими имоти в Бургас, Варна, Шумен" },
      { property: "og:description", content: "Имоти Надежда — водеща агенция за недвижими имоти. Апартаменти, къщи, парцели и офиси за продажба и под наем в Бургас, Варна, Шумен и Нови пазар." },
      { property: "og:url", content: `${SITE_URL}/` },
    ],
    links: [
      { rel: "canonical", href: `${SITE_URL}/` },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "RealEstateAgent",
          name: "Имоти Надежда",
          alternateName: ["Imoti Nadezhda", "Nadezhda Imoti"],
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
          alternateName: "Imoti Nadezhda",
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

  loader: async () => {
    // Each fetch has its own soft timeout + fallback so a single slow query
    // doesn't blank the page. Layout is non-critical → null fallback.
    const [cities, featured, layout] = await Promise.all([
      softTimeout(getCities().catch(() => []), 6000, [] as any[]),
      softTimeout(getFeaturedProperties().catch(() => []), 6000, [] as any[]),
      softTimeout(
        getPublicPageLayout({ data: { page_key: "home" } }).catch(() => null),
        4000,
        null,
      ),
    ]);
    return {
      cities: (cities ?? []).map((c: any) => ({ name: c.name, image: c.hero_image_url, slug: c.slug })),
      featured: (featured ?? []).map((f: any) => ({
        id: f.id,
        title: f.title,
        price: f.price,
        currency: f.currency,
        area_sqm: f.area_sqm,
        bedrooms: f.bedrooms,
        bathrooms: f.bathrooms,
        cover_image_url: f.cover_image_url,
        city_name: f.cities?.name ?? null,
        city_slug: f.cities?.slug ?? null,
      })),
      layout,
    };
  },
  // Show skeleton quickly on slow nav, keep it visible long enough to avoid flicker.
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
  const { cities, featured, layout } = Route.useLoaderData();
  return <HomePage cities={cities} featured={featured} layout={layout} />;
}
