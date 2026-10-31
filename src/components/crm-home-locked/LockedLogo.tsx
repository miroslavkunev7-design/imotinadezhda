import { Link } from "@tanstack/react-router";

export function LockedLogo() {
  return (
    <Link to="/crm-home-locked" className="crm-locked-logo-link" aria-label="Начало — CRM">
      <img
        src="/crm-home-locked/logo-mark-white.png"
        alt="Недвижими имоти Надежда"
        className="crm-locked-logo"
        width={260}
        height={106}
        decoding="async"
        draggable={false}
      />
    </Link>
  );
}
