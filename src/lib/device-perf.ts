// Adaptive video quality helper.
// Classifies the current device/connection into a tier so hero videos can
// gracefully fall back to poster-only on weak laptops, cheap phones, or
// throttled networks — preventing jank on the visible page.
//
// Tiers:
//   "high"  — desktop / strong laptop / good network → play full video
//   "mid"   — average device → play video but with preload="metadata" only
//   "low"   — weak CPU / slow net / save-data → skip video, keep poster

export type DeviceTier = "high" | "mid" | "low";

type NetInfo = {
  saveData?: boolean;
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  downlink?: number;
};

export function detectDeviceTier(): DeviceTier {
  if (typeof navigator === "undefined") return "high";

  const nav = navigator as Navigator & {
    connection?: NetInfo;
    deviceMemory?: number;
  };

  const conn = nav.connection;
  if (conn?.saveData) return "low";
  if (conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g") return "low";
  if (typeof conn?.downlink === "number" && conn.downlink > 0 && conn.downlink < 1.5) return "low";

  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;

  if (mem <= 2 || cores <= 2) return "low";
  if (mem <= 4 || cores <= 4 || conn?.effectiveType === "3g") return "mid";
  return "high";
}

/** Whether the current device should mount hero videos at all. */
export function shouldPlayHeroVideo(): boolean {
  if (typeof window === "undefined") return true;
  // Honour prefers-reduced-motion — never auto-play video for those users.
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  } catch {
    /* ignore */
  }
  return detectDeviceTier() !== "low";
}