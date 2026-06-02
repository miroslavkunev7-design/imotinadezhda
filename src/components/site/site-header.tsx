import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import navbarAsset from "@/assets/navbar-bg.jpg.asset.json";
import { cn } from "@/lib/utils";

export type SiteNavKey = "sale" | "rent" | "about";

type NavItem = {
  key: SiteNavKey | "profile";
  label: string;
  to: string;
  search?: Record<string, string>;
  /** Hotspot in % of the reference image (1280x530). */
  left: number;
  right: number;
};

// Hotspots measured against file_8970.jpg (1280x530). Vertical band ~46%-74%.
const HOTSPOTS: NavItem[] = [
  { key: "sale",    label: "За продажба", to: "/search", search: { status: "sale" }, left: 41.5, right: 57 },
  { key: "rent",    label: "Под наем",   to: "/search", search: { status: "rent" }, left: 60.5, right: 75 },
  { key: "about",   label: "За нас",     to: "/about",                                left: 77.5, right: 88 },
  { key: "profile", label: "Профил",     to: "/login",  search: { redirect: "/admin" }, left: 91, right: 98 },
];

const BAND_TOP = 46;
const BAND_BOTTOM = 74;

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
    <header className="site-header">
      <div
        className="site-header__art"
        style={{ backgroundImage: `url(${navbarAsset.url})` }}
        role="navigation"
        aria-label="Главно меню"
      >
        {/* Logo scroll hotspot (left ribbon) */}
        <Link
          to="/"
          onClick={handleLogo}
          aria-label="Начало — Недвижими имоти Надежда"
          className="site-header__hotspot"
          style={{ left: "1%", right: "62%", top: `${BAND_TOP - 14}%`, bottom: `${100 - BAND_BOTTOM - 10}%` }}
        />

        {HOTSPOTS.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            search={item.search as never}
            aria-label={item.label}
            className={cn(
              "site-header__hotspot",
              active && active === item.key && "is-active",
            )}
            style={{
              left: `${item.left}%`,
              right: `${100 - item.right}%`,
              top: `${BAND_TOP}%`,
              bottom: `${100 - BAND_BOTTOM}%`,
            }}
          />
        ))}
      </div>
    </header>
  );
}

export default SiteHeader;
