import { cn } from "@/lib/utils";
import { scoreToTier, tierLabel } from "@/lib/qualify-score";

export function LeadScoreBadge({
  score,
  tier,
  compact,
  tone = "dark",
}: {
  score: number | null | undefined;
  tier?: string | null;
  compact?: boolean;
  tone?: "dark" | "light";
}) {
  const light = tone === "light";
  if (score == null && !tier) {
    return (
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[10px]",
          light ? "border-[#8B1A2B]/20 text-[#8B1A2B]/45" : "border-amber-500/25 text-amber-100/50",
        )}
      >
        няма оценка
      </span>
    );
  }
  const t = (tier as "hot" | "warm" | "cold" | undefined) ?? (score != null ? scoreToTier(score) : "cold");
  const palette =
    t === "hot"
      ? light
        ? "bg-rose-100 text-rose-800 border-rose-300"
        : "bg-rose-500/20 text-rose-200 border-rose-400/40"
      : t === "warm"
        ? light
          ? "bg-amber-100 text-amber-900 border-amber-300"
          : "bg-amber-500/20 text-amber-100 border-amber-400/40"
        : light
          ? "bg-sky-100 text-sky-900 border-sky-300"
          : "bg-sky-500/15 text-sky-100 border-sky-400/30";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        compact ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-[11px]",
        palette,
      )}
      title={tierLabel(t)}
    >
      {score != null ? score : "—"}
      <span className="font-medium opacity-80">{tierLabel(t)}</span>
    </span>
  );
}
