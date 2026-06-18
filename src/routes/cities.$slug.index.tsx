import { createFileRoute, notFound } from "@tanstack/react-router";

import { ShumenHomePage } from "@/components/site/shumen-home-page";
import { CityLikeShumenPage } from "@/components/site/city-like-shumen-page";
import { getCityBySlug } from "@/lib/catalog.functions";
import { citySeo, siteUrl } from "@/lib/site-config";
import varnaHeroVideo from "@/assets/varna-hero.mp4.asset.json";
import burgasHeroVideo from "@/assets/burgas-hero.mp4.asset.json";
import shumenHeroVideo from "@/assets/shumen-hero.mp4.asset.json";

const CITY_MEDIA: Record<string, { videoUrl: string; description: string; stats: { population: string; area: string; activeProperties: string } }> = {
  varna: {
    videoUrl: varnaHeroVideo.url,
    description: "Морската столица на България — динамичен пазар, развита инфраструктура и силен туристически потенциал.",
    stats: { population: "≈ 335 000", area: "238 km²", activeProperties: "—" },
  },
  burgas: {
    videoUrl: burgasHeroVideo.url,
    description: "Втората морска столица — модерен град с богат избор на имоти, плажове и възможности за инвестиции.",
    stats: { population: "≈ 200 000", area: "482 km²", activeProperties: "—" },
  },
  "novi-pazar": {
    videoUrl: shumenHeroVideo.url,
    description: "Спокоен град в област Шумен — практични жилища и достъпни инвестиционни възможности.",
    stats: { population: "≈ 12 000", area: "247 km²", activeProperties: "—" },
  },
};

const fallbackCities: Record<string, { name: string; description: string; region: string }> = {
  burgas: { name: "Бургас", description: CITY_MEDIA.burgas.description, region: "Черноморие" },
  varna: { name: "Варна", description: CITY_MEDIA.varna.description, region: "Черноморие" },
  shumen: { name: "Шумен", description: "Исторически град с удобна локация и стабилна жилищна среда.", region: "Североизточна България" },
  "novi-pazar": { name: "Нов пазар", description: CITY_MEDIA["novi-pazar"].description, region: "Североизточна България" },
};

function renderCity(slug: string, data: any) {
  const quarterCounts: Record<string, number> = data?.quarterCounts ?? {};
  const aroundCount: number = data?.aroundCount ?? 0;
  if (slug === "shumen") {
    return (
      <ShumenHomePage
        quarterCounts={quarterCounts}
        aroundCount={aroundCount}
        activePropertiesTotal={data?.activePropertiesTotal}
      />
    );
  }
  const media = CITY_MEDIA[slug];
  if (!media) return <ShumenHomePage quarterCounts={quarterCounts} aroundCount={aroundCount} activePropertiesTotal={data?.activePropertiesTotal} />;
  const cityLabel = data?.city?.name ?? fallbackCities[slug]?.name ?? slug;
  const posterUrl = data?.city?.hero_image_url ?? "";
  const quarters = (data?.quarters ?? []).map((q: any) => ({
    name: q.name,
    slug: q.slug,
    count: quarterCounts[q.slug] ?? 0,
    image: q.image_url ?? "",
  }));
  return (
    <CityLikeShumenPage
      citySlug={slug}
      cityLabel={cityLabel}
      cityDescription={data?.city?.description ?? media.description}
      heroVideoUrl={media.videoUrl}
      heroPosterUrl={posterUrl}
      panoramaUrl={posterUrl}
      stats={{
        population: media.stats.population,
        area: media.stats.area,
        activeProperties: String(data?.activePropertiesTotal ?? media.stats.activeProperties),
      }}
      quarters={quarters}
      quarterCounts={quarterCounts}
      aroundCount={aroundCount}
    />
  );
}

function CityFallbackRoute() {
  const { slug } = Route.useParams();
  const fallback = fallbackCities[slug] ?? { name: "Град", description: "Имоти и квартали от Имоти Надежда.", region: "България" };
  const cityData = { city: { slug, ...fallback, hero_image_url: null, hero_video_url: null }, quarters: [], properties: [] };
  return renderCity(slug, cityData);
}

export const Route = createFileRoute("/cities/$slug/")({
  loader: async ({ params }) => {
    const data = await getCityBySlug({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const seo = citySeo(params.slug, loaderData?.city.name);
    const url = siteUrl(`/cities/${params.slug}`);
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:url", content: url },
        ...(loaderData?.city.hero_image_url ? [{ property: "og:image", content: loaderData.city.hero_image_url }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: CityRoute,
  errorComponent: CityFallbackRoute,
  notFoundComponent: CityFallbackRoute,
});

function CityRoute() {
  const { slug } = Route.useParams();
  const data = Route.useLoaderData();
  return renderCity(slug, data);
}
