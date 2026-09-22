import { createFileRoute, useRouter } from "@tanstack/react-router";

import { LockedHomeDesktop } from "@/components/home-locked/locked-home-desktop";
import { getCities, getQuartersByCity } from "@/lib/catalog.functions";
import { HomeSkeleton, PageErrorRetry } from "@/components/site/page-skeleton";
import { SITE_URL, siteUrl } from "@/lib/site-config";

import homeHeroPoster from "@/assets/home-hero-living.jpeg";

export const Route = createFileRoute("/")({
    loader: async () => {
      const cities = await getCities();
      const publishedCities = cities.filter((city) => Boolean(city.slug && city.name));
      const quarterRows = await Promise.all(
        publishedCities.map(async (city) => [
          city.slug,
          await getQuartersByCity({ data: { city_slug: city.slug } }),
        ] as const),
      );
      return {
        catalog: {
          cities: publishedCities.map((city) => ({ slug: city.slug, name: city.name })),
          quartersByCity: Object.fromEntries(quarterRows),
        },
      };
    },
    head: () => ({
    meta: [
      { title: "Имоти Надежда — недвижими имоти в Бургас, Варна, Шумен" },
      {
        name: "description",
        content:
          "Имоти Надежда — водеща агенция за недвижими имоти. Апартаменти, къщи, парцели и офиси за продажба и под наем в Бургас, Варна, Шумен и Нови пазар.",
      },
      { property: "og:title", content: "Имоти Надежда — недвижими имоти в Бургас, Варна, Шумен" },
      {
        property: "og:description",
        content:
          "Имоти Надежда — водеща агенция за недвижими имоти. Апартаменти, къщи, парцели и офиси за продажба и под наем в Бургас, Варна, Шумен и Нови пазар.",
      },
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
          description:
            "Агенция за недвижими имоти Имоти Надежда — апартаменти, къщи, парцели и офиси в Бургас, Варна, Шумен и Нови пазар.",
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
  const { catalog } = Route.useLoaderData();
  // Новата начална страница от MASTER архива се показва на всички устройства (потвърдено от потребителя).
  return <LockedHomeDesktop catalog={catalog} />;
}
