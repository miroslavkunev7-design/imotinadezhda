import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { User } from "lucide-react";

import logoNadezhda from "@/assets/logo-nadezhda-red.png";
import { cn } from "@/lib/utils";

export type SiteNavKey = "sale" | "rent" | "about";

const NAV: Array<{
  key: SiteNavKey;
  label: string;
  to: string;
  search?: Record<string, string>;
}> = [
  { key: "sale", label: "За продажба", to: "/search", search: { status: "sale" } },
  { key: "rent", label: "Под наем", to: "/search", search: { status: "rent" } },
  { key: "about", label: "За нас", to: "/about" },
];

const RED = "#8B1A2B";
const RED_DARK = "#5E0F1D";
const GOLD = "#C9A84C";

/**
 * Premium SiteHeader.
 * Left: asymmetric burgundy "wave-cut" shield panel hosting the white logo.
 * Right: nav links + user icon, always visible on every breakpoint.
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
    <header className="relative z-30 w-full select-none bg-transparent">
      {/* Soft burgundy wash so navbar stays legible on any background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(139,26,43,0.0) 0%, rgba(139,26,43,0.0) 35%, rgba(139,26,43,0.35) 70%, rgba(94,15,29,0.55) 100%)",
        }}
      />
      <div className="relative h-[84px] w-full md:h-[108px] lg:h-[120px]">
        {/* Asymmetric wave-cut burgundy shield (left panel) */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-full w-[220px] sm:w-[260px] md:w-[340px] lg:w-[400px]"
        >
          <svg
            viewBox="0 0 400 120"
            preserveAspectRatio="none"
            className="h-full w-full"
            style={{ filter: "drop-shadow(0 10px 24px rgba(139,26,43,0.4))" }}
          >
            <defs>
              <linearGradient id="hdr-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={RED} />
                <stop offset="100%" stopColor={RED_DARK} />
              </linearGradient>
            </defs>
            {/* Main shield with curved wave right edge */}
            <path
              d="M0,0 L300,0 C320,30 290,55 305,80 C315,100 280,118 250,120 L0,120 Z"
              fill="url(#hdr-grad)"
            />
            {/* Inner gold hairline accent following the curve */}
            <path
              d="M300,0 C320,30 290,55 305,80 C315,100 280,118 250,120"
              fill="none"
              stroke={GOLD}
              strokeOpacity="0.55"
              strokeWidth="1.2"
            />
            {/* Decorative trailing wave ribbon */}
            <path
              d="M305,80 C330,90 360,70 400,72 L400,86 C360,84 332,104 312,98 Z"
              fill={GOLD}
              fillOpacity="0.28"
            />
          </svg>
        </div>

        {/* Logo */}
        <Link
          to="/"
          onClick={handleLogo}
          aria-label="Начало"
          className="absolute left-3 top-1/2 z-20 -translate-y-1/2 md:left-7"
        >
          <img
            src={logoNadezhda}
            alt="Недвижими имоти ИЛДЖ.ИА"
            draggable={false}
            className="h-[48px] w-auto object-contain md:h-[72px] lg:h-[84px]"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </Link>

        {/* Navigation — always visible on every breakpoint */}
        <nav className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 items-center gap-3 sm:gap-5 md:right-10 md:gap-8 lg:gap-12">
          {NAV.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              search={item.search as never}
              className={cn(
                "relative font-display text-[12px] tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] transition hover:text-[#C9A84C] sm:text-[14px] md:text-[16px] lg:text-[17px]",
                active === item.key &&
                  "text-[#C9A84C] after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:bg-[#C9A84C]",
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/login"
            search={{ redirect: "/admin" } as never}
            aria-label="Профил"
            className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] transition hover:text-[#C9A84C]"
          >
            <User className="h-5 w-5 md:h-6 md:w-6" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
