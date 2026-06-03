import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Home, KeyRound, Users, User } from "lucide-react";

import logoScrollBanner from "@/assets/logo-scroll-banner.png";

export type SiteNavKey = "sale" | "rent" | "about";

const navItems = [
  { key: "sale" as const,  label: "За продажба", icon: Home,     to: "/search", search: { status: "sale" } },
  { key: "rent" as const,  label: "Под наем",    icon: KeyRound, to: "/search", search: { status: "rent" } },
  { key: "about" as const, label: "За нас",      icon: Users,    to: "/about" },
];

const panelStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #8B1A2B 0%, #6e1422 100%)",
  border: "2px solid #C9A84C",
  boxShadow:
    "0 10px 28px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(201,168,76,0.25)",
};

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
    <header className="site-header" style={{ overflow: "visible" }}>
      <div className="relative mx-auto flex w-full max-w-[1400px] items-stretch gap-2 px-2 py-2 md:gap-3 md:px-4 md:py-3">
        {/* Logo — oversized scroll-banner overlapping below the navbar */}
        <Link
          to="/"
          onClick={handleLogo}
          aria-label="Начало — Недвижими имоти Надежда"
          className="absolute -left-4 -top-10 z-20 flex flex-none items-center justify-center"
        >
          <img
            src={logoScrollBanner}
            alt="Недвижими имоти Надежда"
            className="block w-auto drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]"
            style={{ height: "220px" }}
            draggable={false}
          />
        </Link>
        {/* Spacer to reserve the logo's footprint in the layout */}
        <div aria-hidden className="flex-none" style={{ width: "min(28%, 360px)" }} />

        {/* Menu bar */}
        <nav
          className="flex flex-1 items-center justify-end gap-4 rounded-md px-3 md:gap-8 md:px-6"
          style={panelStyle}
          aria-label="Главно меню"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <Link
                key={item.key}
                to={item.to}
                search={item.search as never}
                className={`flex items-center gap-2 font-display text-sm transition md:text-base ${
                  isActive ? "text-white" : "text-white/95 hover:text-[#C9A84C]"
                }`}
              >
                <Icon
                  className="h-5 w-5 md:h-6 md:w-6"
                  style={{ color: "#C9A84C" }}
                  strokeWidth={1.75}
                />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
          <span
            aria-hidden
            className="hidden h-8 w-px md:inline-block"
            style={{ backgroundColor: "rgba(201,168,76,0.45)" }}
          />
          <Link
            to="/login"
            search={{ redirect: "/admin" } as never}
            aria-label="Профил"
            className="flex items-center justify-center rounded-full p-1.5 transition hover:bg-white/10"
          >
            <User
              className="h-5 w-5 md:h-6 md:w-6"
              style={{ color: "#C9A84C" }}
              strokeWidth={1.75}
            />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default SiteHeader;
