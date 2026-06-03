import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import navbarDesktop from "@/assets/navbar-desktop.png.asset.json";

export type SiteNavKey = "sale" | "rent" | "about";

// Click-zone coordinates in % of the 1367x307 navbar PNG.
// Each zone is rendered as a transparent <Link>.
const zones: {
  key: SiteNavKey | "logo" | "profile";
  to: string;
  search?: Record<string, string>;
  label: string;
  // left / top / width / height in %
  l: number; t: number; w: number; h: number;
}[] = [
  { key: "logo",    to: "/",       label: "Начало",      l: 0,    t: 0,  w: 38, h: 100 },
  { key: "sale",    to: "/search", search: { status: "sale" }, label: "За продажба", l: 39, t: 24, w: 17, h: 60 },
  { key: "rent",    to: "/search", search: { status: "rent" }, label: "Под наем",    l: 57, t: 24, w: 16, h: 60 },
  { key: "about",   to: "/about",  label: "За нас",      l: 74, t: 24, w: 13, h: 60 },
  { key: "profile", to: "/login",  search: { redirect: "/admin" }, label: "Профил", l: 89, t: 24, w: 9,  h: 60 },
];

export function SiteHeader({ active: _active }: { active?: SiteNavKey } = {}) {
  const navigate = useNavigate();
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Triple-click on logo opens admin login (kept from previous behavior).
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
    <header className="site-header" style={{ overflow: "visible" }}>
      <div
        className="relative mx-auto w-full"
        style={{ maxWidth: "1400px", aspectRatio: "1367 / 307" }}
      >
        <img
          src={navbarDesktop.url}
          alt="Недвижими имоти Надежда"
          className="block h-full w-full select-none"
          draggable={false}
          style={{ filter: "drop-shadow(0 10px 24px rgba(0,0,0,0.45))" }}
        />

        {zones.map((z) => {
          const common = {
            "aria-label": z.label,
            className: "absolute block",
            style: {
              left:   `${z.l}%`,
              top:    `${z.t}%`,
              width:  `${z.w}%`,
              height: `${z.h}%`,
              background: "transparent",
            } as React.CSSProperties,
          };
          if (z.key === "logo") {
            return (
              <Link key={z.key} to="/" onClick={handleLogo} {...common} />
            );
          }
          return (
            <Link
              key={z.key}
              to={z.to}
              search={z.search as never}
              {...common}
            />
          );
        })}
      </div>
    </header>
  );
}

export default SiteHeader;
