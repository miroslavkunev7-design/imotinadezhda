import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/site-header";
import { SearchBar, CityCard } from "@/components/site/luxury-real-estate";
import heroBg from "@/assets/hero-shumen-panorama.jpg.asset.json";

const SITE_URL = "https://imotinadezhda.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Недвижими имоти Надежда | Луксозни имоти в България" },
      { name: "description", content: "Луксозни имоти, квартали и подбрани предложения с премиум визуално изживяване." },
      { property: "og:title", content: "Недвижими имоти Надежда" },
      { property: "og:description", content: "Луксозни имоти, квартали и подбрани предложения с премиум визуално изживяване." },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:image", content: heroBg.url },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  }),
  component: HomeRoute,
});

const CITIES: Array<{ slug: string; name: string }> = [
  { slug: "burgas", name: "Бургас" },
  { slug: "varna", name: "Варна" },
  { slug: "shumen", name: "Шумен" },
  { slug: "novi-pazar", name: "Нов пазар" },
];

function HomeRoute() {
  return (
    <div
      className="relative h-screen w-screen overflow-hidden flex flex-col"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(10,5,8,0.35) 0%, rgba(10,5,8,0.15) 35%, rgba(10,5,8,0.65) 100%), url("${heroBg.url}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <SiteHeader />
      <main className="flex-1 min-h-0 flex flex-col justify-end px-4 pb-6 md:px-8 md:pb-10">
        <div className="mx-auto w-full max-w-[1320px] space-y-5 md:space-y-7">
          <SearchBar cities={CITIES} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {CITIES.map((c) => (
              <CityCard key={c.slug} name={c.name} href="/cities/$slug" params={{ slug: c.slug }} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
