import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export type GlassStatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  photoUrl: string;
  to: string;
  icon: ReactNode;
};

export function GlassStatCard({
  title,
  value,
  subtitle = "Реални данни",
  photoUrl,
  to,
  icon,
}: GlassStatCardProps) {
  return (
    <Link to={to} className="crm-locked-card" aria-label={`${title}: ${value}`}>
      <div
        className="crm-locked-card__photo"
        style={{ backgroundImage: `url(${photoUrl})` }}
        aria-hidden
      />
      <div className="crm-locked-card__veil" aria-hidden />
      <div className="crm-locked-card__body">
        <div className="crm-locked-card__icon">{icon}</div>
        <div className="crm-locked-card__value">{value}</div>
        <div className="crm-locked-card__title">{title}</div>
        <div className="crm-locked-card__sub">{subtitle}</div>
        <span className="crm-locked-card__arrow" aria-hidden>
          <ArrowRight size={16} strokeWidth={2} />
        </span>
      </div>
    </Link>
  );
}
