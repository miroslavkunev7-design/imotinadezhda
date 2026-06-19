import { useRef, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import scrollLogo from "@/assets/logo-scroll-banner.png";
import { cn } from "@/lib/utils";

export type SiteNavKey = "sale" | "rent" | "about";

type NavItem = {
  key: SiteNavKey;
  label: string;
  to: string;
  search?: Record<string, string>;
  icon: ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "sale",
    label: "За продажба",
    to: "/search",
    search: { status: "sale" },
    icon: (
      <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    key: "rent",
    label: "Под наем",
    to: "/search",
    search: { status: "rent" },
    icon: (
      <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <circle cx="7" cy="12" r="3.5" />
        <path d="M10.5 12H21m0 0v3m-3-3v3m-3-3v3" />
      </svg>
    ),
  },
  {
    key: "about",
    label: "За нас",
    to: "/about",
    icon: (
      <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path d="M13.5 4.5l6 6m-2-7l-7.5 7.5L7 15l1 1-2.5 1.5L4 14l1.5-2.5L6 13l7.5-7.5m6 6L13 19a2.121 2.121 0 01-3 0l-5-5a2.121 2.121 0 010-3l6-6a2.121 2.121 0 013 0l5 5a2.121 2.121 0 010 3z" />
      </svg>
    ),
  },
];

export function SiteHeader({
  active,
  overlay = false,
}: {
  active?: SiteNavKey;
  /** When true, header floats over hero media (no layout spacer). */
  overlay?: boolean;
} = {}) {
  const navigate = useNavigate();
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogo = (_e: React.MouseEvent) => {
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    if (clickCount.current >= 3) {
      clickCount.current = 0;
      navigate({ to: "/login", search: { redirect: "/admin" } as never });
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickCount.current = 0;
    }, 420);
  };

  return (
    <>
    <header className="site-header-v2">
      <div className="site-header-v2__wrap">
        {/* Scroll logo — marble plaque + gold edges; swap image when final logo arrives */}
        <Link
          to="/"
          onClick={handleLogo}
          aria-label="Начало — Недвижими имоти Надежда"
          className="site-header-v2__logo"
        >
          <img src={scrollLogo} alt="Недвижими имоти Надежда" className="site-header-v2__logo-img" />
        </Link>

        {/* Navigation pill */}
        <nav className="site-header-v2__pill" aria-label="Главно меню">
          <div className="site-header-v2__pill-inner">
            <div className="site-header-v2__items">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  to={item.to}
                  search={item.search as never}
                  aria-label={item.label}
                  className={cn(
                    "site-header-v2__btn group",
                    active === item.key && "site-header-v2__btn--active",
                  )}
                >
                  <span className="site-header-v2__btn-icon">{item.icon}</span>
                  <span className="site-header-v2__btn-label">{item.label}</span>
                </Link>
              ))}
              <Link
                to="/login"
                search={{ redirect: "/admin" } as never}
                aria-label="Профил"
                className="site-header-v2__profile"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </Link>
            </div>
          </div>
        </nav>
      </div>
    </header>
    {!overlay ? <div className="site-header-v2__spacer" aria-hidden="true" /> : null}
    </>
  );
}

export default SiteHeader;
