import { Skeleton } from "@/components/ui/skeleton";

export function HomeSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <div className="h-[100dvh] w-full bg-gradient-to-b from-[#8B1A2B] to-[#5e0f1d] relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-28 bg-[#5e0f1d]/80" />
        <div className="absolute inset-x-0 bottom-10 mx-auto max-w-[1200px] px-4 flex flex-col items-center gap-4">
          <Skeleton className="h-10 w-2/3 bg-white/10" />
          <Skeleton className="h-10 w-1/2 bg-white/10" />
        </div>
      </div>
      <section className="mx-auto max-w-[1420px] px-4 py-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl bg-[#fbf6ea]" />
        ))}
      </section>
      <section className="mx-auto max-w-[1420px] px-4 pb-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full rounded-2xl bg-[#fbf6ea]" />
        ))}
      </section>
    </main>
  );
}

export function PageErrorRetry({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl text-[#8B1A2B]">Бавна връзка</h1>
        <p className="mt-2 text-sm text-[#2b1418]/70">
          Съдържанието се зарежда твърде дълго. {error?.message ? `(${error.message})` : ""}
        </p>
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center justify-center rounded-full bg-[#8B1A2B] px-6 py-2.5 font-display text-sm uppercase tracking-[0.18em] text-white hover:bg-[#5e0f1d] transition-colors"
        >
          Опитай отново
        </button>
      </div>
    </main>
  );
}
