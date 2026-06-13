import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronRight, MapPin, Compass } from "lucide-react";

import { getVillagesAround, type VillageRow } from "@/lib/villages.functions";
import shumenHeroVideo from "@/assets/shumen-hero.mp4.asset.json";
import varnaHeroVideo from "@/assets/varna-hero.mp4.asset.json";
import burgasHeroVideo from "@/assets/burgas-hero.mp4.asset.json";

const HERO_VIDEOS: Record<string, string> = {
  shumen: shumenHeroVideo.url,
  varna: varnaHeroVideo.url,
  burgas: burgasHeroVideo.url,
  "novi-pazar": shumenHeroVideo.url,
};

export const Route = createFileRoute("/cities/$slug/around")({
  loader: async ({ params }) => {
    const data = await getVillagesAround({ data: { citySlug: params.slug } });
    if (!data.oblast) throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => {
    const label = loaderData?.cityLabel ?? params.slug;
    const url = `https://imotinadezhda.lovable.app/cities/${params.slug}/around`;
    const title = `Села около ${label} | Имоти Надежда`;
    const desc = `Пълен списък на селата${loaderData?.municipality ? ` в община ${label}` : ` в област ${label}`}, подредени по близост. Намерете имот в селата около ${label}.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: AroundCityPage,
  errorComponent: () => <FallbackEmpty />,
  notFoundComponent: () => <FallbackEmpty />,
});

function FallbackEmpty() {
  return (
    <main className="min-h-screen nadezhda-marble-bg px-4 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-serif-nadezhda text-3xl font-bold text-[#600f1c]">Списъкът ще се появи скоро</h1>
        <p className="mt-3 text-[#600f1c]/80">Опитайте отново след малко.</p>
      </div>
    </main>
  );
}

function AroundCityPage() {
  const { slug } = Route.useParams();
  const { cityLabel, municipality, villages } = Route.useLoaderData();
  const scopeText = municipality ? `община ${cityLabel}` : `област ${cityLabel}`;
  const videoUrl = HERO_VIDEOS[slug] ?? shumenHeroVideo.url;

  return (
    <main className="min-h-screen nadezhda-marble-bg">
      {/* HERO with video background */}
      <section className="relative h-[60vh] min-h-[420px] w-full overflow-hidden">
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
          <h1 className="flex items-center gap-3 font-serif-nadezhda text-4xl font-bold text-white drop-shadow-lg md:text-5xl">
            <Compass className="h-8 w-8 text-[#f4d07d]" />
            Около {cityLabel}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/90 md:text-base">
            Всички села в {scopeText} — {villages.length} населени места, подредени по близост до {cityLabel}.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        {villages.length === 0 ? (
          <p className="text-center text-[#600f1c]/80">Все още няма добавени села за този град.</p>
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
    </main>
  );
}
