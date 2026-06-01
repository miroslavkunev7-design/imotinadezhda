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

  return (
    <header
      className="relative z-30 w-full select-none"
      style={{ filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.18))" }}
    >
      <div
        className="relative h-[88px] w-full overflow-hidden md:h-[108px] lg:h-[120px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(245,245,245,0.96) 0%, rgba(229,229,229,0.94) 100%)",
          borderBottom: "1px solid rgba(225,29,72,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {/* Subtle red accent sweep along the bottom — replaces the gold ribbon */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(225,29,72,0.0) 8%, rgba(239,68,68,0.85) 50%, rgba(225,29,72,0.0) 92%, transparent 100%)",
          }}
        />

        {/* Logo */}
        <Link
          to="/"
          onClick={handleLogo}
          aria-label="Начало (троен клик за админ вход)"
          className="absolute left-4 top-1/2 z-20 -translate-y-1/2 md:left-10"
        >
          <img
            src={logoNadezhda}
            alt="Недвижими имоти ИЛДЖ.ИА"
            draggable={false}
            className="h-[52px] w-auto object-contain md:h-[76px] lg:h-[88px]"
          />
        </Link>

        {/* Navigation */}
        <nav className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 items-center gap-5 md:right-10 md:gap-9 lg:gap-12">
          {NAV.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              search={item.search as never}
              className={cn(
                "relative font-display text-[14px] tracking-wide text-[#1a1a1a] transition hover:text-[#dc2626] md:text-[16px] lg:text-[17px]",
                active === item.key &&
                  "text-[#dc2626] after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:bg-[#dc2626]",
              )}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/login"
            search={{ redirect: "/admin" } as never}
            aria-label="Профил"
            className="text-[#1a1a1a] transition hover:text-[#dc2626]"
          >
            <User className="h-5 w-5 md:h-6 md:w-6" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
