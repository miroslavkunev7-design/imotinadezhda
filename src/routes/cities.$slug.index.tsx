import { createFileRoute, notFound } from "@tanstack/react-router";

import { CityLikeShumenPage } from "@/components/site/city-like-shumen-page";
import { getCityBySlug } from "@/lib/catalog.functions";
import {
  resolveCityHeroMp4,
  resolveCityHeroWebm,
  resolveCityHeroLegacyMp4,
} from "@/lib/city-hero-videos";
import { citySeo, siteUrl, SITE_NAME, SITE_URL } from "@/lib/site-config";
import { resolveAssetUrl } from "@/lib/asset-url";
import shumenPanorama from "@/assets/city-photos/shumen.jpeg.asset.json";
import varnaPanorama from "@/assets/city-photos/varna.jpeg.asset.json";
import burgasPanorama from "@/assets/city-photos/burgas.jpeg.asset.json";
import noviPazarPanorama from "@/assets/city-photos/novi-pazar.jpeg.asset.json";
import burgasHeroMp4 from "@/assets/burgas-hero-2026.mp4.asset.json";
import burgasHeroWebm from "@/assets/burgas-hero-2026.webm.asset.json";
import varnaHeroMp4 from "@/assets/varna-2026.mp4.asset.json";
import varnaHeroWebm from "@/assets/varna-2026.webm.asset.json";
import shumenHeroMp4 from "@/assets/shumen-2026.mp4.asset.json";
import shumenHeroWebm from "@/assets/shumen-2026.webm.asset.json";

const CITY_PANORAMA_ASSETS: Record<string, { url: string }> = {
  shumen: shumenPanorama,
  varna: varnaPanorama,
  burgas: burgasPanorama,
  "novi-pazar": noviPazarPanorama,
};

/** Stable, SSR/CSR-identical absolute og:image URL (uses /media proxy on prod). */
function buildOgImage(slug: string, dbHero?: string | null): string {
  const asset = CITY_PANORAMA_ASSETS[slug];
  if (asset?.url) {
    return `${SITE_URL}${asset.url.replace(/^\/__l5e/, "/media")}`;
  }
  if (dbHero) {
    if (dbHero.startsWith("http")) return dbHero;
    if (dbHero.startsWith("/")) return `${SITE_URL}${dbHero.replace(/^\/__l5e/, "/media")}`;
  }
  return "";
}

type CityMeta = {
  name: string;
  panoramaUrl: string;
  heroVideoUrl?: string;
  heroVideoWebmUrl?: string;
  description: string;
  region: string;
  stats: { population: string; area: string };
};

const CITY_META: Record<string, CityMeta> = {
  shumen: {
    name: "Шумен",
    panoramaUrl: resolveAssetUrl(shumenPanorama),
    heroVideoUrl: resolveAssetUrl(shumenHeroMp4),
    heroVideoWebmUrl: resolveAssetUrl(shumenHeroWebm),
    description:
      "Историческа столица в Североизточна България, дом на паметника „Създатели на българската държава“. Стабилен пазар, силна образователна и индустриална база.",
    region: "Североизточен",
    stats: { population: "≈ 73 000", area: "6 291 km²" },
  },
  varna: {
    name: "Варна",
    panoramaUrl: resolveAssetUrl(varnaPanorama),
    heroVideoUrl: resolveAssetUrl(varnaHeroMp4),
    heroVideoWebmUrl: resolveAssetUrl(varnaHeroWebm),
    description:
      "Морската столица на България — най-големият град на Черноморието, водещ туристически, пристанищен и икономически център с динамичен пазар на имоти.",
    region: "Североизточен",
    stats: { population: "≈ 335 000", area: "238 km²" },
  },
  burgas: {
    name: "Бургас",
    panoramaUrl: resolveAssetUrl(burgasPanorama),
    heroVideoUrl: resolveAssetUrl(burgasHeroMp4),
    heroVideoWebmUrl: resolveAssetUrl(burgasHeroWebm),
    description:
      "Бургас 2026 — водещият черноморски град в Югоизточна България. Разширена Морска градина с нова крайбрежна алея, модернизирано пристанище „Бургас“ и разширен терминал на Летище Бургас с рекорден пътникопоток. Активно строителство в кв. Меден рудник, Славейков, Сарафово и Крайморие, стабилно поскъпване на новите жилищни комплекси и силен интерес от инвеститори и купувачи целогодишно. Област Бургас наброява близо 380 000 жители и е един от най-динамичните региони в страната.",
    region: "Югоизточен",
    stats: { population: "≈ 200 000 (град) · ≈ 380 000 (област)", area: "482 km²" },
  },
  "novi-pazar": {
    name: "Нови пазар",
    panoramaUrl: resolveAssetUrl(noviPazarPanorama),
    description:
      "Спокоен град в област Шумен с уредена централна част, достъпни жилища и добри възможности за инвестиции близо до магистрала „Хемус“.",
    region: "Област Шумен",
    stats: { population: "≈ 12 000", area: "247 km²" },
  },
};

function renderCity(slug: string, data: any) {
  const quarterCounts: Record<string, number> = data?.quarterCounts ?? {};
  const aroundCount: number = data?.aroundCount ?? 0;
  const meta = CITY_META[slug] ?? {
    name: data?.city?.name ?? slug,
    panoramaUrl: data?.city?.hero_image_url ?? "",
    description: data?.city?.description ?? "Имоти и квартали от Имоти Надежда.",
    region: data?.city?.region ?? "България",
    stats: {
      population: data?.city?.population
        ? `≈ ${new Intl.NumberFormat("bg-BG").format(data.city.population)}`
        : "—",
      area: data?.city?.area_km2 ? `${data.city.area_km2} km²` : "—",
    },
  };
  const cityLabel = data?.city?.name ?? meta.name;
  const heroVideoUrl = resolveCityHeroMp4(slug, data?.city?.hero_video_url);
  const heroVideoWebmUrl = resolveCityHeroWebm(slug);
  const heroVideoFallbackUrl = resolveCityHeroLegacyMp4(slug);
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
      cityDescription={CITY_META[slug]?.description ?? data?.city?.description ?? meta.description}
      panoramaUrl={data?.city?.hero_image_url ?? meta.panoramaUrl}
      heroVideoUrl={heroVideoUrl || undefined}
      heroVideoWebmUrl={heroVideoWebmUrl}
      heroVideoFallbackUrl={heroVideoFallbackUrl}
      regionLabel={data?.city?.region ?? meta.region}
      stats={{
        population: data?.city?.population
          ? `≈ ${new Intl.NumberFormat("bg-BG").format(data.city.population)}`
          : meta.stats.population,
        area: data?.city?.area_km2 ? `${data.city.area_km2} km²` : meta.stats.area,
        activeProperties: String(data?.activePropertiesTotal ?? 0),
      }}
      quarters={quarters}
      quarterCounts={quarterCounts}
      aroundCount={aroundCount}
    />
  );
}

function CityLoading() {
  return <RouteState title="Зареждаме града…" />;
}

function CityError({ error }: { error: Error }) {
  return <RouteState title="Градът не може да се зареди" detail={error.message} />;
}

function CityNotFound() {
  return <RouteState title="Градът не е намерен" detail="Проверете адреса или изберете друг град." />;
}

function RouteState({ title, detail }: { title: string; detail?: string }) {
  return (
    <main className="nadezhda-marble-bg flex min-h-screen items-center justify-center px-4">
      <div role="status" className="max-w-lg text-center text-[#600f1c]">
        <h1 className="font-serif-nadezhda text-3xl font-bold">{title}</h1>
        {detail ? <p className="mt-3 text-[#600f1c]/75">{detail}</p> : null}
      </div>
    </main>
  );
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
    const meta = CITY_META[params.slug];
    const cityName = loaderData?.city?.name ?? meta?.name ?? params.slug;
    const activeCount = loaderData?.activePropertiesTotal ?? 0;
    const quarterCount = (loaderData?.quarters ?? []).length;
    const liveDescription =
      activeCount > 0 || quarterCount > 0
        ? `${seo.description} Актуални оферти: ${activeCount} активни имота${quarterCount ? ` в ${quarterCount} квартала` : ""}.`
        : seo.description;
    const ogImage = buildOgImage(params.slug, loaderData?.city?.hero_image_url);
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: liveDescription },
        {
          name: "keywords",
          content: `имоти ${cityName}, недвижими имоти ${cityName}, апартаменти ${cityName}, къщи ${cityName}, ${SITE_NAME}`,
        },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: liveDescription },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:locale", content: "bg_BG" },
        ...(ogImage
          ? [
              { property: "og:image", content: ogImage },
              { property: "og:image:alt", content: `Панорама на ${cityName}` },
              { name: "twitter:image", content: ogImage },
            ]
          : []),
        { name: "twitter:card", content: ogImage ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: seo.title },
        { name: "twitter:description", content: liveDescription },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Начало", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Градове", item: siteUrl("/cities") },
              { "@type": "ListItem", position: 3, name: cityName, item: url },
            ],
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "RealEstateAgent",
            name: `${SITE_NAME} — ${cityName}`,
            description: liveDescription,
            url,
            areaServed: { "@type": "City", name: cityName },
            ...(ogImage ? { image: ogImage } : {}),
          }),
        },
      ],
    };
  },
  component: CityRoute,
  pendingComponent: CityLoading,
  errorComponent: CityError,
  notFoundComponent: CityNotFound,
});

function CityRoute() {
  const { slug } = Route.useParams();
  const data = Route.useLoaderData();
  return renderCity(slug, data);
}
