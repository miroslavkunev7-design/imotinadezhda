import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronRight, MapPin, Compass } from "lucide-react";

import { getVillagesAround, type VillageRow } from "@/lib/villages.functions";

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
    const desc = `Пълен списък на селата${loaderData?.municipality ? ` в община ${label}` : ` в област ${label}`}. Намерете имот в селата около ${label}.`;
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

  return (
    <main className="min-h-screen nadezhda-marble-bg">
      <header className="nadezhda-dark-red-bg px-4 py-10 md:py-14">
        <div className="mx-auto max-w-6xl">
          <Link
            to="/cities/$slug"
            params={{ slug } as never}
            className="inline-flex items-center gap-2 text-sm text-[#f4d07d] hover:underline"
          >
            ← Обратно към {cityLabel}
          </Link>
          <h1 className="mt-4 flex items-center gap-3 font-serif-nadezhda text-3xl font-bold text-white md:text-4xl">
            <Compass className="h-7 w-7 text-[#f4d07d]" />
            Около {cityLabel}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85 md:text-base">
            Всички села в {scopeText} — {villages.length} населени места. Изберете село за повече информация и имоти в района.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        {villages.length === 0 ? (
          <p className="text-center text-[#600f1c]/80">Все още няма добавени села за този град.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {villages.map((v: VillageRow) => (
              <Link
                key={v.id}
                to="/search"
                search={{ city_slug: slug, q: v.name } as never}
                className="group flex items-center justify-between rounded-xl border border-[#C9A84C]/40 bg-white px-3.5 py-3 shadow-[0_6px_18px_rgba(139,26,43,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(139,26,43,0.18)]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 flex-none text-[#C9A84C]" />
                  <span className="truncate font-serif-nadezhda text-[15px] font-semibold text-[#600f1c]">
                    {v.name}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 flex-none text-[#C9A84C] transition group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
