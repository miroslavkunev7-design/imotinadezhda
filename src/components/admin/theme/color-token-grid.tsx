import { TOKEN_LABELS, type ThemeTokens } from "@/lib/theme/tokens";
import { ensureContrast, isValidHex } from "@/lib/theme/contrast";

type Props = {
  tokens: ThemeTokens;
  onChange: (next: ThemeTokens) => void;
};

// Pairs of (background token, foreground token) that should auto-contrast.
const CONTRAST_PAIRS: Array<[keyof ThemeTokens, keyof ThemeTokens]> = [
  ["background", "foreground"],
  ["card", "cardForeground"],
  ["primary", "primaryForeground"],
  ["secondary", "secondaryForeground"],
  ["muted", "mutedForeground"],
  ["accent", "accentForeground"],
  ["sidebar", "sidebarForeground"],
];

export function ColorTokenGrid({ tokens, onChange }: Props) {
  const setToken = (key: keyof ThemeTokens, value: string) => {
    if (!isValidHex(value)) {
      onChange({ ...tokens, [key]: value });
      return;
    }
    const next = { ...tokens, [key]: value } as ThemeTokens;

    // Auto-contrast: if we just changed a background, ensure its paired fg stays readable.
    for (const [bg, fg] of CONTRAST_PAIRS) {
      if (bg === key) {
        const safe = ensureContrast(value, next[fg] as string);
        if (safe !== next[fg]) (next as Record<string, string | number>)[fg] = safe;
      }
    }
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {(Object.keys(TOKEN_LABELS) as Array<keyof typeof TOKEN_LABELS>).map((key) => {
        const value = tokens[key];
        const safeValue = isValidHex(value) ? value : "#000000";
        return (
          <label
            key={key}
            className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-[rgba(20,4,8,0.55)] p-3"
          >
            <input
              type="color"
              value={safeValue}
              onChange={(e) => setToken(key, e.target.value)}
              className="h-10 w-12 cursor-pointer rounded border border-amber-500/30 bg-transparent"
              aria-label={TOKEN_LABELS[key]}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-amber-100/70">{TOKEN_LABELS[key]}</div>
              <input
                type="text"
                value={value}
                onChange={(e) => setToken(key, e.target.value)}
                className="mt-1 w-full rounded border border-amber-500/30 bg-black/30 px-2 py-1 font-mono text-xs text-amber-100"
              />
            </div>
          </label>
        );
      })}
    </div>
  );
}
