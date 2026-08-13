import { Link, useRouterState } from "@tanstack/react-router";

/**
 * Fixed mobile bottom navigation, visible on every page.
 * Rendered globally from __root.tsx; hidden on admin/login/auth screens.
 */
export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hide =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth");
  if (hide) return null;

  return (
    <>
      {/* Spacer so page content doesn't hide behind the fixed bottom nav */}
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: "calc(58px + env(safe-area-inset-bottom, 0px) + 16px)" }}
      />
    <nav
      className="md:hidden fixed left-1/2 -translate-x-1/2 z-[70]"
      style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Мобилна навигация"
    >
      <div
        className="h-[58px] rounded-full border shadow-[0_14px_30px_rgba(0,0,0,0.35)] flex items-center gap-1 px-3 text-white"
        style={{
          background: "linear-gradient(135deg, #5A001D 0%, #760028 100%)",
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        <Link to="/" aria-label="Начало" className="flex items-center justify-center w-11 h-11 transition">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <Link to="/search" search={{} as never} aria-label="Търсене" className="flex items-center justify-center w-11 h-11 transition">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
        </Link>
        <Link to="/search" search={{ favorites: "1" } as never} aria-label="Любими" className="flex items-center justify-center w-11 h-11 transition">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <Link
          to="/contacts"
          aria-label="Чат"
          className="flex items-center justify-center w-[58px] h-[44px] rounded-full text-white"
          style={{ border: "2px solid #D9B06F" }}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </nav>
    </>
  );
}

export default MobileBottomNav;