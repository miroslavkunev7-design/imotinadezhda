import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import navbarDesktop from "@/assets/navbar-desktop.png.asset.json";
import navbarMobile from "@/assets/navbar-mobile.png.asset.json";
import { cn } from "@/lib/utils";

export type SiteNavKey = "sale" | "rent" | "about";

type Hotspot = {
  key: SiteNavKey | "profile";
  label: string;
  to: string;
  search?: Record<string, string>;
  left: number;
  right: number;
};

// Desktop image is 1367x307. Hotspots in % of that image.
const DESKTOP_HOTSPOTS: Hotspot[] = [
  { key: "sale",    label: "За продажба", to: "/search", search: { status: "sale" }, left: 37,  right: 51 },
  { key: "rent",    label: "Под наем",    to: "/search", search: { status: "rent" }, left: 56,  right: 69.5 },
  { key: "about",   label: "За нас",      to: "/about",                                left: 72,  right: 85 },
  { key: "profile", label: "Профил",      to: "/login",  search: { redirect: "/admin" }, left: 92, right: 99 },
];
const DESKTOP_BAND = { top: 28, bottom: 70 };

// Mobile image is 1024x301. Icons-only nav.
const MOBILE_HOTSPOTS: Hotspot[] = [
  { key: "sale",    label: "За продажба", to: "/search", search: { status: "sale" }, left: 50.5, right: 60.5 },
  { key: "rent",    label: "Под наем",    to: "/search", search: { status: "rent" }, left: 63,   right: 73 },
  { key: "about",   label: "За нас",      to: "/about",                                left: 75.5, right: 85.5 },
  { key: "profile", label: "Профил",      to: "/login",  search: { redirect: "/admin" }, left: 88, right: 98 },
];
const MOBILE_BAND = { top: 33, bottom: 73 };

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

  const renderArt = (
    src: string,
    aspect: string,
    hotspots: Hotspot[],
    band: { top: number; bottom: number },
    logoRight: number,
    className: string,
  ) => (
    <div
      className={cn("site-header__art", className)}
      style={{ aspectRatio: aspect, backgroundImage: `url(${src})` }}
      role="navigation"
      aria-label="Главно меню"
    >
      <Link
        to="/"
        onClick={handleLogo}
        aria-label="Начало — Недвижими имоти Надежда"
        className="site-header__hotspot"
        style={{ left: "0%", right: `${100 - logoRight}%`, top: "5%", bottom: "5%" }}
      />
      {hotspots.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          search={item.search as never}
          aria-label={item.label}
          className={cn("site-header__hotspot", active && active === item.key && "is-active")}
          style={{
            left: `${item.left}%`,
            right: `${100 - item.right}%`,
            top: `${band.top}%`,
            bottom: `${100 - band.bottom}%`,
          }}
        />
      ))}
    </div>
  );

  return (
    <header className="site-header">
      {renderArt(navbarDesktop.url, "1367 / 307", DESKTOP_HOTSPOTS, DESKTOP_BAND, 35, "site-header__art--desktop")}
      {renderArt(navbarMobile.url, "1024 / 301", MOBILE_HOTSPOTS, MOBILE_BAND, 50, "site-header__art--mobile")}
    </header>
  );
}

export default SiteHeader;
