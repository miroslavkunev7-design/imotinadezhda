import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronRight, MapPin, Compass, Umbrella } from "lucide-react";

import { getVillagesAround, type VillageRow } from "@/lib/villages.functions";
import { breadcrumbJsonLd, siteUrl, SITE_NAME } from "@/lib/site-config";
import { resolveAssetUrl } from "@/lib/asset-url";
import { SiteHeader } from "@/components/site/site-header";
import { SiteSeoFooter } from "@/components/site/site-seo-footer";
import shumenHeroVideo from "@/assets/shumen-hero.mp4.asset.json";
import varnaHeroVideo from "@/assets/varna-hero.mp4.asset.json";
import burgasHeroVideo from "@/assets/burgas-hero.mp4.asset.json";
import burgasPier from "@/assets/burgas-pier.jpeg";
import dealGreen from "@/assets/deal-green.jpeg";

const HERO_VIDEOS: Record<string, string> = {
  shumen: resolveAssetUrl(shumenHeroVideo),
  varna: resolveAssetUrl(varnaHeroVideo),
  burgas: resolveAssetUrl(burgasHeroVideo),
  "novi-pazar": resolveAssetUrl(shumenHeroVideo),
};

type AroundGroup = "resorts" | "villages";

export const Route = createFileRoute("/cities/$slug/around")({
  validateSearch: (s: Record<string, unknown>): { group?: AroundGroup } => {
    if (s.group === "resorts" || s.group === "villages") return { group: s.group };
    return {};
  },
  loaderDeps: ({ search }) => ({ group: search.group }),
  loader: async ({ params, deps }) => {
    const kind =
      params.slug === "burgas" && deps.group
        ? deps.group === "resorts"
          ? "resort"
          : "village"
        : undefined;
    const data = await getVillagesAround({ data: { citySlug: params.slug, kind } });
    if (!data.oblast) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const label = loaderData?.cityLabel ?? params.slug;
    const url = siteUrl(`/cities/${params.slug}/around`);
    const title = `Имоти около ${label} | ${SITE_NAME}`;
    const desc = `Имоти Надежда — населени места около ${label}: села${params.slug === "burgas" ? " и курорти" : ""}, подредени по близост. Апартаменти, къщи и парцели в областта.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Начало", path: "/" },
              { name: `Имоти в ${label}`, path: `/cities/${params.slug}` },
              { name: `Около ${label}`, path: `/cities/${params.slug}/around` },
            ]),
          ),
        },
      ],
    };
  },
  component: AroundCityPage,
  errorComponent: () => <FallbackEmpty />,
  notFoundComponent: () => <FallbackEmpty />,
});

function FallbackEmpty() {
  return (
    <main className="min-h-screen nadezhda-marble-bg px-4 py-16">
      <SiteHeader />
      <div className="mx-auto max-w-3xl pt-24 text-center">
        <h1 className="font-serif-nadezhda text-3xl font-bold text-[#600f1c]">Списъкът ще се появи скоро</h1>
        <p className="mt-3 text-[#600f1c]/80">Опитайте отново след малко.</p>
      </div>
    </main>
  );
}

function AroundCityPage() {
  const { slug } = Route.useParams();
  const { group } = Route.useSearch();
  const { cityLabel, municipality, villages, resortCount, villageCount } = Route.useLoaderData();
  const isBurgasHub = slug === "burgas" && !group;
  const scopeText = municipality ? `община ${cityLabel}` : `област ${cityLabel}`;
  const videoUrl = HERO_VIDEOS[slug] ?? resolveAssetUrl(shumenHeroVideo);
  const subtitle = isBurgasHub
    ? `Избери карта — курортите по морето или селата във вътрешността на област Бургас.`
    : group === "resorts"
      ? `${villages.length} курорта и морски селища в област Бургас.`
      : `Всички села в ${scopeText} — ${villages.length} населени места, подредени по близост до ${cityLabel}.`;

  return (
    <main className="min-h-screen nadezhda-marble-bg">
      <SiteHeader overlay />
      <section className="relative h-[52vh] min-h-[360px] w-full overflow-hidden">
        <video
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#260108]/55 via-[#260108]/65 to-[#260108]/85" />
        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-10 md:pb-14">
          <Link
            to="/cities/$slug"
            params={{ slug } as never}
            className="mb-4 inline-flex w-fit items-center gap-2 text-sm text-[#f4d07d] hover:underline"
          >
            ← Обратно към {cityLabel}
          </Link>
          {group && slug === "burgas" && (
            <Link
              to="/cities/$slug/around"
              params={{ slug } as never}
              className="mb-2 inline-flex w-fit items-center gap-2 text-xs text-white/80 hover:underline"
            >
              ← Около Бургас — картите
            </Link>
          )}
          <h1 className="flex items-center gap-3 font-serif-nadezhda text-4xl font-bold text-white drop-shadow-lg md:text-5xl">
            <Compass className="h-8 w-8 text-[#f4d07d]" />
            {group === "resorts" ? `Курорти около ${cityLabel}`
              : group === "villages" ? `Селата около ${cityLabel}`
              : `Имоти около ${cityLabel}`}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/90 md:text-base">{subtitle}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        {isBurgasHub ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <BurgasMapCard
              slug={slug}
              group="resorts"
              title="Курорти"
              hint={`${resortCount} морски курорта и селища`}
              image={burgasPier}
              icon={Umbrella}
            />
            <BurgasMapCard
              slug={slug}
              group="villages"
              title="Селата"
              hint={`${villageCount} села в област Бургас`}
              image={dealGreen}
              icon={MapPin}
            />
          </div>
        ) : villages.length === 0 ? (
          <p className="text-center text-[#600f1c]/80">Все още няма добавени населени места за този град.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {villages.map((v: VillageRow) => {
              const distLabel =
                v.distance_km != null && v.distance_km < 999
                  ? `~${Math.round(v.distance_km)} км`
                  : null;
              return (
                <Link
                  key={v.id}
                  to="/search"
                  search={{ city_slug: slug, q: v.name } as never}
                  className="group flex items-center justify-between rounded-xl border border-[#C9A84C]/40 bg-white px-3.5 py-3 shadow-[0_6px_18px_rgba(139,26,43,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(139,26,43,0.18)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 flex-none text-[#C9A84C]" />
                    <span className="min-w-0 truncate font-serif-nadezhda text-[15px] font-semibold text-[#600f1c]">
                      {v.name}
                    </span>
                  </span>
                  <span className="ml-2 flex flex-none items-center gap-1.5">
                    {v.property_count > 0 && (
                      <span className="rounded-full nadezhda-gold-bg px-1.5 py-0.5 text-[10px] font-bold text-[#260108]">
                        {v.property_count}
                      </span>
                    )}
                    {distLabel && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#600f1c]/60">
                        {distLabel}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-[#C9A84C] transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <SiteSeoFooter />
    </main>
  );
}

function BurgasMapCard({
  slug,
  group,
  title,
  hint,
  image,
  icon: Icon,
}: {
  slug: string;
  group: AroundGroup;
  title: string;
  hint: string;
  image: string;
  icon: typeof Umbrella;
}) {
  return (
    <Link
      to="/cities/$slug/around"
      params={{ slug } as never}
      search={{ group } as never}
      className="group overflow-hidden rounded-3xl border border-[#C9A84C]/50 bg-[#2a0810] shadow-[0_16px_40px_rgba(139,26,43,0.22)] transition hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(139,26,43,0.32)]"
    >
      <div className="relative aspect-[16/10]">
        <img src={image} alt={`${title} около Бургас — Имоти Надежда`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#260108]/90 via-[#260108]/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <Icon className="mb-2 h-8 w-8 text-[#f4d07d]" />
          <h2 className="font-serif-nadezhda text-3xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm text-[#f4d07d]/90">{hint}</p>
        </div>
      </div>
    </Link>
  );
}
