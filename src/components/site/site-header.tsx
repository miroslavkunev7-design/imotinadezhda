import { useRef, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";

import { NadezhdaLogo } from "@/components/site/nadezhda-logo";
import navbarDesktopAsset from "@/assets/navbar-desktop-clean.png.asset.json";
import { cn } from "@/lib/utils";

export type SiteNavKey = "sale" | "rent" | "about";

type NavItem = {
  key: SiteNavKey;
  label: string;
  to: string;
  search?: Record<string, string>;
  icon: ReactNode;
};

/** Hotspot geometry as fractions of the desktop navbar brush image (917x121). */
const NAV_HOTSPOTS: Record<SiteNavKey | "profile", { left: string; width: string }> = {
  sale: { left: "29%", width: "19%" },
  rent: { left: "51%", width: "17%" },
  about: { left: "71.5%", width: "14%" },
  profile: { left: "90%", width: "6%" },
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "sale",
    label: "За продажба",
    to: "/search",
    search: { status: "sale" },
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5z"
        />
      </svg>
    ),
  },
  {
    key: "rent",
    label: "Под наем",
    to: "/search",
    search: { status: "rent" },
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <circle cx="8" cy="12" r="3.5" strokeLinecap="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.5 12H21m0 0v3m-3-3v3m-3-3v2" />
      </svg>
    ),
  },
  {
    key: "about",
    label: "За нас",
    to: "/about",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 11a3 3 0 1 0-6 0 3 3 0 0 0 6 0zM4 20a5 5 0 0 1 10 0M13 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM15 20a5 5 0 0 1 6-4"
        />
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
  const location = useLocation();
  const isHome = location.pathname === "/";
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
      <Link
        to="/"
        onClick={handleLogo}
        aria-label="Начало — Недвижими имоти Надежда"
        className="md:hidden absolute left-0 right-0 z-[60] pointer-events-auto flex justify-center"
        style={{ position: isHome ? "fixed" : "absolute", top: "0px" }}
      >
        <NadezhdaLogo
          variant="mobile"
          className="object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
          style={{
            width: isHome ? "120vw" : "78vw",
            maxWidth: "none",
            height: "auto",
            marginLeft: 0,
          }}
        />
      </Link>
      <Link
        to="/login"
        search={{ redirect: "/admin" } as never}
        aria-label="Профил"
        className="md:hidden fixed z-[70] w-11 h-11 rounded-full flex items-center justify-center text-white pointer-events-auto"
        style={{
          top: "0px",
          right: "0px",
          border: "1.5px solid rgba(255,255,255,0.7)",
          background: "linear-gradient(135deg, #5A001D 0%, #760028 100%)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
        }}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
      <nav
        className="hidden md:block fixed z-50"
        style={{
          top: "max(0px, env(safe-area-inset-top))",
          right: "4.5vw",
          width: "min(63.5vw, 917px)",
        }}
      >
        <div className="relative w-full" style={{ aspectRatio: "917 / 121" }}>
          <img
            src={navbarDesktopAsset.url}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain object-center drop-shadow-[0_18px_44px_rgba(0,0,0,0.32)]"
          />
          <Link
            to="/"
            onClick={handleLogo}
            aria-label="Начало — Недвижими имоти Надежда"
            className="hidden md:flex absolute z-20 items-center pointer-events-auto"
            style={{ left: 0, top: 0, transform: "translate(-104%, -10.5%)" }}
          >
            <NadezhdaLogo
              className="object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
              style={{ width: "auto", height: "clamp(140px, 14.2vw, 200px)" }}
            />
          </Link>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              search={item.search as never}
              aria-label={item.label}
              className={cn(
                "absolute z-10 rounded-full transition",
                active === item.key && "opacity-100",
              )}
              style={{ ...NAV_HOTSPOTS[item.key], top: "24%", height: "68%" }}
            >
              <span className="sr-only">{item.label}</span>
            </Link>
          ))}
          <Link
            to="/login"
            search={{ redirect: "/admin" } as never}
            aria-label="Профил"
            className="absolute z-10 rounded-full transition"
            style={{ ...NAV_HOTSPOTS.profile, top: "24%", height: "68%" }}
          >
            <span className="sr-only">Профил</span>
          </Link>
        </div>
      </nav>
      {!overlay ? <div className="site-header-v2__spacer" aria-hidden="true" /> : null}
    </>
  );
}

export default SiteHeader;
