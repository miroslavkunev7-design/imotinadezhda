import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { User } from "lucide-react";

import logoNadezhda from "@/assets/logo-nadezhda-red.png";
import { cn } from "@/lib/utils";

export type SiteNavKey = "sale" | "rent" | "about";

const GOLD = "#C9A84C";

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
 * Site header — scroll panel (SVG background) overlapping a bordeaux nav pill.
 * Matches the HTML/CSS spec provided by the user.
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
    <header className="relative z-30 w-full select-none">
      <div className="navbar-wrapper">
        {/* Scroll panel with logo */}
        <Link
          to="/"
          onClick={handleLogo}
          aria-label="Начало"
          className="logo-scroll"
        >
          <img src={logoNadezhda} alt="Недвижими имоти Надежда" draggable={false} />
        </Link>

        {/* Bordeaux nav pill */}
        <nav className="main-nav">
          {NAV.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              search={item.search as never}
              className={cn("nav-link", active === item.key && "is-active")}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/login"
            search={{ redirect: "/admin" } as never}
            aria-label="Профил"
            className="nav-link nav-icon"
          >
            <User className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.75} />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
