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
      {/* Soft burgundy wash; on mobile stronger wash behind top nav links. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(139,26,43,0.0) 0%, rgba(139,26,43,0.15) 40%, rgba(139,26,43,0.45) 75%, rgba(94,15,29,0.6) 100%)",
        }}
      />
      <div className="relative h-[56px] w-full md:h-[150px] lg:h-[180px]">
        {/* Organic ink-splash burgundy panel (left) */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-[150%] w-[320px] sm:w-[400px] md:w-[520px] lg:w-[640px]"
        >
          <svg
            viewBox="0 0 640 240"
            preserveAspectRatio="none"
            className="h-full w-full"
            style={{ filter: "drop-shadow(0 14px 30px rgba(139,26,43,0.45))" }}
          >
            <defs>
              <linearGradient id="hdr-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={RED} />
                <stop offset="100%" stopColor={RED_DARK} />
              </linearGradient>
            </defs>
            {/* Bold organic ink-splash silhouette */}
            <path
              d="M0,0 L430,0 C460,18 470,40 455,62 C500,70 520,55 555,72 C585,86 560,108 525,115 C575,118 605,108 612,130 C620,156 560,168 505,160 C540,175 525,196 470,200 C520,212 495,232 430,228 C380,225 340,210 285,212 C230,214 180,228 130,222 C70,215 30,200 0,180 Z"
              fill="url(#hdr-grad)"
            />
            {/* Gold splash trim accent following the right contour */}
            <path
              d="M430,0 C460,18 470,40 455,62 C500,70 520,55 555,72 C585,86 560,108 525,115 C575,118 605,108 612,130 C620,156 560,168 505,160 C540,175 525,196 470,200 C520,212 495,232 430,228"
              fill="none"
              stroke={GOLD}
              strokeOpacity="0.55"
              strokeWidth="1.4"
            />
            {/* Tiny gold ink droplets */}
            <circle cx="600" cy="60" r="4" fill={GOLD} fillOpacity="0.55" />
            <circle cx="585" cy="190" r="3" fill={GOLD} fillOpacity="0.45" />
            <circle cx="625" cy="100" r="2" fill={GOLD} fillOpacity="0.4" />
          </svg>
        </div>

        {/* Logo — enlarged to fill splash */}
        <Link
          to="/"
          onClick={handleLogo}
          aria-label="Начало"
          className="absolute left-4 top-1/2 z-20 -translate-y-1/2 md:left-10 lg:left-14"
        >
          <img
            src={logoNadezhda}
            alt="Недвижими имоти ИЛДЖ.ИА"
            draggable={false}
            className="h-[90px] w-auto object-contain md:h-[140px] lg:h-[176px]"
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
