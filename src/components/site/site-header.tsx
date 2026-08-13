import { useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { NadezhdaLogo } from "@/components/site/nadezhda-logo";
import navbarOfficial from "@/assets/navbar-official.png";

export type SiteNavKey = "sale" | "rent" | "about";

export function SiteHeader({
  active: _active,
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

  const header = (
    <div className="nadezhda-nav-root">
      <Link
        to="/"
        onClick={handleLogo}
        aria-label="Начало — Недвижими имоти Надежда"
        className="nadezhda-nav-logo"
      >
        <NadezhdaLogo className="nadezhda-nav-logo__img" />
      </Link>

      <nav className="nav-wrap" aria-label="Главна навигация">
        <img className="nav-img" src={navbarOfficial} alt="" draggable={false} />
        <div className="hotspots">
          <Link to="/" onClick={handleLogo} aria-label="Начало" />
          <Link to="/search" search={{ status: "sale" } as never} aria-label="За продажба" />
          <Link to="/search" search={{ status: "rent" } as never} aria-label="Под наем" />
          <Link to="/about" aria-label="За нас" />
          <Link to="/login" search={{ redirect: "/admin" } as never} aria-label="Профил" />
        </div>
      </nav>
    </div>
  );

  return (
    <div className="nadezhda-nav-slot relative">
      {header}
      {!overlay ? <div className="nadezhda-nav-spacer" aria-hidden="true" /> : null}
    </div>
  );
}

export default SiteHeader;
