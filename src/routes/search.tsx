import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { LuxuryHeader, ListingCard } from "@/components/site/luxury-real-estate";
import { getQuartersByCity, searchProperties } from "@/lib/catalog.functions";

const searchSchema = z.object({
  city_slug: z.string().optional(),
  quarter_slug: z.string().optional(),
  property_type: z.string().optional(),
  status: z.enum(["sale", "rent"]).optional(),
  price_min: z.string().optional(),
  price_max: z.string().optional(),
  area_min: z.string().optional(),
  area_max: z.string().optional(),
});

const CITIES = [
  { slug: "burgas", name: "Бургас" },
  { slug: "varna", name: "Варна" },
  { slug: "shumen", name: "Шумен" },
  { slug: "novi-pazar", name: "Нов Пазар" },
];

const PROPERTY_TYPES = [
  { value: "apartment", label: "Апартамент" },
  { value: "house", label: "Къща" },
  { value: "land", label: "Парцел" },
  { value: "commercial", label: "Бизнес" },
];

export const Route = createFileRoute("/search")({
  validateSearch: (s) => searchSchema.parse(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const rows = await searchProperties({ data: deps as any });
    return { results: rows ?? [] };
  },
  head: () => ({
    meta: [
      { title: "Търсене на имоти | ИЛДЖ.ИА" },
      { name: "description", content: "Търсене на луксозни имоти в България — филтри по град, квартал, цена и площ." },
      { property: "og:title", content: "Търсене на имоти | ИЛДЖ.ИА" },
      { property: "og:description", content: "Търсене на луксозни имоти в България." },
      { property: "og:url", content: "https://imotinadezhda.lovable.app/search" },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [
      { rel: "canonical", href: "https://imotinadezhda.lovable.app/search" },
    ],
  }),
  component: SearchRoute,
});

type SearchKey =
  | "city_slug"
  | "quarter_slug"
  | "property_type"
  | "status"
  | "price_min"
  | "price_max"
  | "area_min"
  | "area_max";

function SearchRoute() {
  const { results } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });

  const { data: quarters = [] } = useQuery({
    queryKey: ["quarters", search.city_slug ?? ""],
    queryFn: () =>
      search.city_slug
        ? getQuartersByCity({ data: { city_slug: search.city_slug } })
        : Promise.resolve([]),
    enabled: !!search.city_slug,
  });

  const update = (patch: Partial<Record<SearchKey, string | undefined>>) => {
    navigate({
      search: (prev: Record<string, string | undefined>) => {
        const next: Record<string, string | undefined> = { ...prev, ...patch };
        // If city changes, clear quarter so filter stays valid.
        if (patch.city_slug !== undefined && patch.city_slug !== prev.city_slug) {
          next.quarter_slug = undefined;
        }
        // Drop empty strings so URL stays clean.
        Object.keys(next).forEach((k) => {
          if (next[k] === "" || next[k] === undefined) delete next[k];
        });
        return next as never;
      },
    });
  };

  const clearAll = () => {
    navigate({ search: {} as never });
  };

  const activeCount = (Object.keys(search) as SearchKey[]).filter((k) => !!search[k]).length;

  return (
    <main className="luxury-page flex h-screen max-h-screen flex-col overflow-hidden bg-background">
      <LuxuryHeader active={search.status === "rent" ? "rent" : "sale"} />

      {/* Filter bar — bound to URL search params */}
      <section className="flex-none border-b border-[#C9A84C]/30 bg-white/85 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[1420px] flex-wrap items-center gap-2">
          {/* Status pills */}
          <div className="flex items-center gap-1 rounded-full border border-[#C9A84C]/50 bg-[#fbf6ea] p-1">
            {([
              { val: undefined, label: "Всички" },
              { val: "sale", label: "Продажба" },
              { val: "rent", label: "Под наем" },
            ] as const).map((opt) => {
              const active = (search.status ?? undefined) === opt.val;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => update({ status: opt.val })}
                  className={
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                    (active ? "bg-[#8B1A2B] text-white" : "text-[#2b1418] hover:bg-white")
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <FilterSelect
            label="Град"
            value={search.city_slug ?? ""}
            onChange={(v) => update({ city_slug: v || undefined })}
            options={CITIES.map((c) => ({ value: c.slug, label: c.name }))}
          />
          <FilterSelect
            label="Квартал"
            value={search.quarter_slug ?? ""}
            onChange={(v) => update({ quarter_slug: v || undefined })}
            options={(quarters as any[]).map((q) => ({ value: q.slug, label: q.name }))}
            disabled={!search.city_slug}
          />
          <FilterSelect
            label="Вид имот"
            value={search.property_type ?? ""}
            onChange={(v) => update({ property_type: v || undefined })}
            options={PROPERTY_TYPES}
          />

          <FilterNumberRange
            label="Цена"
            min={search.price_min ?? ""}
            max={search.price_max ?? ""}
            onMin={(v) => update({ price_min: v || undefined })}
            onMax={(v) => update({ price_max: v || undefined })}
          />
          <FilterNumberRange
            label="Площ"
            min={search.area_min ?? ""}
            max={search.area_max ?? ""}
            onMin={(v) => update({ area_min: v || undefined })}
            onMax={(v) => update({ area_max: v || undefined })}
          />

          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto rounded-full border border-[#8B1A2B]/40 px-3 py-1 text-xs font-medium text-[#8B1A2B] hover:bg-[#8B1A2B] hover:text-white"
            >
              Изчисти филтрите ({activeCount})
            </button>
          )}
        </div>
      </section>

      {/* Title bar */}
      <header className="flex-none border-b border-[#C9A84C]/20 bg-white/60 px-4 py-2 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[1420px] flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-display text-xl text-[#2b1418] md:text-2xl">
            Намерени имоти
          </h1>
          <span className="font-display text-xs uppercase tracking-[0.18em] text-[#8B1A2B] md:text-sm">
            {results.length} резултата
          </span>
        </div>
      </header>

      {/* Results */}
      <section className="mx-auto w-full max-w-[1420px] flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6">
        {results.length === 0 ? (
          <div className="rounded-3xl border border-[#C9A84C]/40 bg-[#fbf6ea] p-10 text-center text-[#2b1418]/80">
            Няма намерени имоти с тези критерии.{" "}
            <Link to="/" className="text-[#8B1A2B] underline">Към началото</Link>
          </div>
        ) : (
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((p: any) => (
              <ListingCard
                key={p.id}
                title={p.title ?? "Имот"}
                price={`${p.currency === "BGN" ? "лв." : "€"} ${new Intl.NumberFormat("bg-BG").format(Number(p.price ?? 0))}`}
                size={`${p.area_sqm ?? "—"} m²`}
                beds={Number(p.bedrooms ?? p.rooms ?? 0)}
                baths={Number(p.bathrooms ?? 0)}
                image={p.cover_image_url ?? ""}
                tag={p.status === "rent" ? "ПОД НАЕМ" : "ПРОДАЖБА"}
                location={p.cities?.name}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-[#C9A84C]/50 bg-white px-3 py-1 text-xs text-[#2b1418] focus-within:border-[#8B1A2B]">
      <span className="text-[#2b1418]/60">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="cursor-pointer appearance-none bg-transparent pr-1 outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">Всички</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function FilterNumberRange({
  label,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  min: string;
  max: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-[#C9A84C]/50 bg-white px-3 py-1 text-xs text-[#2b1418] focus-within:border-[#8B1A2B]">
      <span className="text-[#2b1418]/60">{label}:</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder="от"
        defaultValue={min}
        key={`min-${min}`}
        onBlur={(e) => {
          if (e.target.value !== min) onMin(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-14 bg-transparent outline-none placeholder:text-[#2b1418]/40"
      />
      <span className="text-[#2b1418]/40">–</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder="до"
        defaultValue={max}
        key={`max-${max}`}
        onBlur={(e) => {
          if (e.target.value !== max) onMax(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-14 bg-transparent outline-none placeholder:text-[#2b1418]/40"
      />
    </div>
  );
}
