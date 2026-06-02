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

/**
 * Cinematic SiteHeader — light grey panel, charcoal text, bright red accent.
 * No gold, no marble. A single thin red hairline anchors the bottom edge.
 */
export function SiteHeader({ active }: { active?: SiteNavKey } = {}) {
  const navigate = useNavigate();
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Triple-click logo → /login?redirect=/admin (preserved easter egg).
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

  const RED = "#8B1A2B";
  return (
    <header className="relative z-30 w-full select-none bg-transparent">
      <div className="relative h-[88px] w-full md:h-[108px] lg:h-[120px]">
        {/* Solid red diagonal-cut logo panel (left) */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-full w-[260px] md:w-[340px] lg:w-[400px]"
          style={{
            background: RED,
            clipPath:
              "polygon(0 0, 78% 0, 58% 100%, 0 100%)",
            boxShadow: "0 8px 24px rgba(139,26,43,0.35)",
          }}
        />
        {/* Red diagonal ribbon sweeping across */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-full w-[640px] md:w-[820px] lg:w-[960px]"
          style={{
            background: RED,
            clipPath:
              "polygon(54% 0, 64% 0, 22% 100%, 12% 100%)",
            opacity: 0.95,
          }}
        />

        {/* Logo (inside the red panel) */}
        <Link
          to="/"
          onClick={handleLogo}
          aria-label="Начало (троен клик за админ вход)"
          className="absolute left-3 top-1/2 z-20 -translate-y-1/2 md:left-6"
        >
          <img
            src={logoNadezhda}
            alt="Недвижими имоти ИЛДЖ.ИА"
            draggable={false}
            className="h-[52px] w-auto object-contain md:h-[76px] lg:h-[88px]"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </Link>

        {/* Navigation — floats over the transparent hero area */}
        <nav className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 items-center gap-5 md:right-10 md:gap-9 lg:gap-12">
          {NAV.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              search={item.search as never}
              className={cn(
                "relative font-display text-[14px] tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition hover:text-[#C9A84C] md:text-[16px] lg:text-[17px]",
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
            className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition hover:text-[#C9A84C]"
          >
            <User className="h-5 w-5 md:h-6 md:w-6" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
