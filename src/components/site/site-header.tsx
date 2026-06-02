import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Home, Key, Users, User } from "lucide-react";

import logoNadezhda from "@/assets/logo-nadezhda-red.png";
import { cn } from "@/lib/utils";

export type SiteNavKey = "sale" | "rent" | "about";

const RED = "#8B1A2B";
const RED_DARK = "#5E0F1D";
const GOLD = "#C9A84C";

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
 * Site-wide premium header.
 * - Dark near-black bar containing a bordeaux/gold rounded "pill" hosting the
 *   nav links + profile icon (centered/right).
 * - Left: a decorative bordeaux scroll/banner panel with gold trim that hosts
 *   the white logo and overlaps below the bar.
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
    <header className="relative z-30 w-full select-none" style={{ backgroundColor: "#0f0a0b" }}>
      <div className="relative mx-auto flex h-[80px] w-full max-w-[1440px] items-center justify-end px-4 md:h-[100px] md:px-8 lg:h-[110px]">
        {/* Nav pill */}
        <nav
          className="flex h-[52px] items-center gap-1 rounded-full border px-2 sm:gap-2 sm:px-3 md:h-[60px] md:gap-3 md:px-4 lg:h-[64px] lg:gap-4 lg:px-5"
          style={{
            backgroundColor: "rgba(42,15,20,0.85)",
            borderColor: `${GOLD}66`,
            boxShadow: `inset 0 0 0 1px rgba(201,168,76,0.08), 0 6px 18px rgba(0,0,0,0.45)`,
          }}
        >
          {NAV.map((item, idx) => (
            <div key={item.key} className="flex items-center">
              {idx > 0 && (
                <span
                  aria-hidden
                  className="mx-1 hidden h-5 w-px sm:inline-block md:mx-2"
                  style={{ backgroundColor: `${GOLD}40` }}
                />
              )}
              <Link
                to={item.to}
                search={item.search as never}
                className={cn(
                  "group inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 font-display text-[12px] tracking-wide text-white transition hover:text-[#C9A84C] sm:px-3 sm:text-[13px] md:gap-2 md:px-4 md:py-2 md:text-[15px] lg:text-[16px]",
                  active === item.key && "text-[#C9A84C]",
                )}
              >
                <item.Icon
                  className="h-3.5 w-3.5 md:h-4 md:w-4"
                  style={{ color: GOLD }}
                  strokeWidth={1.75}
                />
                <span>{item.label}</span>
              </Link>
            </div>
          ))}
          <span aria-hidden className="mx-1 hidden h-5 w-px sm:inline-block md:mx-2" style={{ backgroundColor: `${GOLD}40` }} />
          <Link
            to="/login"
            search={{ redirect: "/admin" } as never}
            aria-label="Профил"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:text-[#C9A84C] md:h-9 md:w-9"
          >
            <User className="h-4 w-4 md:h-5 md:w-5" style={{ color: GOLD }} strokeWidth={1.75} />
          </Link>
        </nav>

        {/* Left: decorative ribbon/scroll panel with the logo. Sits over the bar
            and overlaps slightly below for a scroll effect. */}
        <Link
          to="/"
          onClick={handleLogo}
          aria-label="Начало"
          className="absolute left-2 top-1 z-20 md:left-6 md:top-2 lg:left-10"
        >
          <div className="relative h-[88px] w-[200px] md:h-[124px] md:w-[300px] lg:h-[140px] lg:w-[340px]">
            <svg
              viewBox="0 0 340 140"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              style={{ filter: "drop-shadow(0 12px 22px rgba(0,0,0,0.55))" }}
            >
              <defs>
                <linearGradient id="ribbon-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RED} />
                  <stop offset="100%" stopColor={RED_DARK} />
                </linearGradient>
              </defs>
              {/* Left curl tail */}
              <path
                d="M0,14 L18,4 L26,22 L10,30 Z"
                fill={RED_DARK}
                opacity="0.85"
              />
              {/* Right curl tail */}
              <path
                d="M340,14 L322,4 L314,22 L330,30 Z"
                fill={RED_DARK}
                opacity="0.85"
              />
              {/* Main banner body — gentle dip at bottom for scroll feel */}
              <path
                d="M12,6 L328,6 Q336,6 336,18 L336,108 Q336,118 326,120 L260,124 Q170,132 80,124 L14,120 Q4,118 4,108 L4,18 Q4,6 12,6 Z"
                fill="url(#ribbon-grad)"
              />
              {/* Inner gold border */}
              <path
                d="M14,12 L326,12 Q330,12 330,18 L330,106 Q330,114 322,116 L258,119 Q170,126 82,119 L18,116 Q10,114 10,106 L10,18 Q10,12 14,12 Z"
                fill="none"
                stroke={GOLD}
                strokeOpacity="0.7"
                strokeWidth="1.2"
              />
              {/* Decorative gold dots in corners */}
              <circle cx="22" cy="22" r="1.6" fill={GOLD} opacity="0.7" />
              <circle cx="318" cy="22" r="1.6" fill={GOLD} opacity="0.7" />
            </svg>
            <div className="relative z-10 flex h-full w-full items-center justify-center px-6">
              <img
                src={logoNadezhda}
                alt="Недвижими имоти Надежда"
                draggable={false}
                className="max-h-[78%] w-auto object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}

export default SiteHeader;
