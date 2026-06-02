import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Home, Key, Users, User } from "lucide-react";

import logoNadezhda from "@/assets/logo-nadezhda-red.png";
import { cn } from "@/lib/utils";

export type SiteNavKey = "sale" | "rent" | "about";

const RED = "#8B1A2B";
const RED_DARK = "#5E0F1D";
const RED_DARKER = "#3a0912";
const GOLD = "#C9A84C";
const BAR_BG = "#0f0a0b";

const NAV: Array<{
  key: SiteNavKey;
  label: string;
  to: string;
  search?: Record<string, string>;
  Icon: typeof Home;
}> = [
  { key: "sale", label: "За продажба", to: "/search", search: { status: "sale" }, Icon: Home },
  { key: "rent", label: "Под наем", to: "/search", search: { status: "rent" }, Icon: Key },
  { key: "about", label: "За нас", to: "/about", Icon: Users },
];

/**
 * Site-wide premium header (matches file_8957.jpg).
 * - Near-black bar across the top.
 * - Right: rounded pill track with gold border, hosting nav links + profile icon.
 * - Left: decorative bordeaux scroll/ribbon panel with curled corner folds and
 *   a gold inner stroke. The panel overhangs below the dark bar to give the
 *   unfurled-parchment effect.
 */
export function SiteHeader({ active }: { active?: SiteNavKey } = {}) {
  const navigate = useNavigate();
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (clickCount.current >= 3) {
      clickCount.current = 0;
      navigate({ to: "/login", search: { redirect: "/admin" } as never });
      return;
    }
    clickTimer.current = setTimeout(() => {
      const c = clickCount.current;
      clickCount.current = 0;
      if (c === 1) navigate({ to: "/" });
    }, 420);
  };

  return (
    <header className="relative z-30 w-full select-none" style={{ backgroundColor: BAR_BG }}>
      <div className="relative mx-auto w-full max-w-[1440px] px-3 md:px-8">
        {/* Bar row */}
        <div className="relative flex h-[64px] items-center justify-end md:h-[96px] lg:h-[108px]">
          {/* Right: nav pill — fits next to the scroll panel even on small phones */}
          <nav
            className="ml-auto flex h-[40px] items-center gap-0 rounded-full border px-1 md:h-[60px] md:px-3 lg:h-[64px]"
            style={{
              backgroundColor: "rgba(42,15,20,0.85)",
              borderColor: `${GOLD}80`,
              boxShadow:
                "inset 0 0 0 1px rgba(201,168,76,0.12), 0 6px 18px rgba(0,0,0,0.55)",
            }}
          >
            {NAV.map((item, idx) => (
              <div key={item.key} className="flex items-center">
                {idx > 0 && (
                  <span
                    aria-hidden
                    className="mx-0.5 h-4 w-px md:mx-2 md:h-6"
                    style={{ backgroundColor: `${GOLD}55` }}
                  />
                )}
                <Link
                  to={item.to}
                  search={item.search as never}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-1 font-display text-[9.5px] tracking-tight text-white transition hover:text-[#C9A84C] md:gap-2 md:px-4 md:py-2 md:text-[15px] md:tracking-wide lg:text-[16px]",
                    active === item.key && "text-[#C9A84C]",
                  )}
                >
                  <item.Icon
                    className="h-3 w-3 md:h-4 md:w-4"
                    style={{ color: GOLD }}
                    strokeWidth={1.75}
                  />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              </div>
            ))}
            <span
              aria-hidden
              className="mx-0.5 h-4 w-px md:mx-2 md:h-6"
              style={{ backgroundColor: `${GOLD}55` }}
            />
            <Link
              to="/login"
              search={{ redirect: "/admin" } as never}
              aria-label="Профил"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:text-[#C9A84C] md:h-10 md:w-10"
            >
              <User className="h-3.5 w-3.5 md:h-[18px] md:w-[18px]" style={{ color: GOLD }} strokeWidth={1.75} />
            </Link>
          </nav>

          {/* Left: scroll/ribbon panel with logo. Absolutely positioned so it
              overhangs below the bar for the unfurled-parchment effect. */}
          <Link
            to="/"
            onClick={handleLogo}
            aria-label="Начало"
            className="absolute left-0 top-1 z-20 md:top-2"
          >
            <ScrollPanel />
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Decorative scroll/ribbon SVG with curled corner folds and gold trim,
 * containing the white logo. Sized responsively.
 */
function ScrollPanel() {
  return (
    <div className="relative h-[64px] w-[150px] sm:h-[80px] sm:w-[180px] md:h-[132px] md:w-[300px] lg:h-[150px] lg:w-[340px]">
      <svg
        viewBox="0 0 340 150"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        style={{ filter: "drop-shadow(0 14px 22px rgba(0,0,0,0.55))" }}
      >
        <defs>
          <linearGradient id="scroll-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RED} />
            <stop offset="55%" stopColor={RED} />
            <stop offset="100%" stopColor={RED_DARK} />
          </linearGradient>
          <linearGradient id="scroll-curl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RED_DARK} />
            <stop offset="100%" stopColor={RED_DARKER} />
          </linearGradient>
        </defs>

        {/* === Back curled tabs (darker) — peek out behind the main body === */}
        {/* top-left curl */}
        <path
          d="M14,8 C26,2 44,2 56,12 L40,30 C30,22 22,18 12,22 Z"
          fill="url(#scroll-curl)"
        />
        {/* top-right curl */}
        <path
          d="M326,8 C314,2 296,2 284,12 L300,30 C310,22 318,18 328,22 Z"
          fill="url(#scroll-curl)"
        />
        {/* bottom-left curl */}
        <path
          d="M10,118 C20,140 44,148 64,140 L52,124 C40,130 28,128 18,118 Z"
          fill="url(#scroll-curl)"
        />
        {/* bottom-right curl */}
        <path
          d="M330,118 C320,140 296,148 276,140 L288,124 C300,130 312,128 322,118 Z"
          fill="url(#scroll-curl)"
        />

        {/* === Main scroll body — gentle parchment shape === */}
        <path
          d="
            M40,12
            C20,12 16,22 16,34
            L16,108
            C16,124 28,134 50,134
            L290,134
            C312,134 324,124 324,108
            L324,34
            C324,22 320,12 300,12
            Z
          "
          fill="url(#scroll-body)"
        />

        {/* Inner gold trim — traces the same body slightly inset */}
        <path
          d="
            M42,18
            C26,18 22,26 22,36
            L22,106
            C22,120 32,128 50,128
            L290,128
            C308,128 318,120 318,106
            L318,36
            C318,26 314,18 298,18
            Z
          "
          fill="none"
          stroke={GOLD}
          strokeOpacity="0.75"
          strokeWidth="1.2"
        />
        {/* second hairline for richness */}
        <path
          d="
            M44,22
            C30,22 26,28 26,38
            L26,104
            C26,116 34,124 50,124
            L290,124
            C306,124 314,116 314,104
            L314,38
            C314,28 310,22 296,22
            Z
          "
          fill="none"
          stroke={GOLD}
          strokeOpacity="0.25"
          strokeWidth="0.6"
        />

        {/* Decorative gold dots in inner corners */}
        <circle cx="36" cy="32" r="1.4" fill={GOLD} opacity="0.7" />
        <circle cx="304" cy="32" r="1.4" fill={GOLD} opacity="0.7" />
        <circle cx="36" cy="112" r="1.4" fill={GOLD} opacity="0.6" />
        <circle cx="304" cy="112" r="1.4" fill={GOLD} opacity="0.6" />

        {/* Subtle inner shadow at top to give depth */}
        <path
          d="
            M40,12
            C20,12 16,22 16,34
            L16,46
            C40,38 80,36 170,36
            C260,36 300,38 324,46
            L324,34
            C324,22 320,12 300,12
            Z
          "
          fill="rgba(0,0,0,0.18)"
        />
      </svg>

      {/* Logo on top — centered within the body */}
      <div className="absolute inset-0 z-10 flex items-center justify-center px-7 pb-1 pt-2 md:px-10">
        <img
          src={logoNadezhda}
          alt="Недвижими имоти Надежда"
          draggable={false}
          className="max-h-[78%] w-auto object-contain"
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </div>
    </div>
  );
}

export default SiteHeader;
