import { ArrowRight, CalendarCheck, Handshake, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

const NOTICES = [
  {
    id: "viewings",
    title: "Огледи",
    body: "Няма насрочени огледи за днес.",
    to: "/admin/viewings",
    icon: CalendarCheck,
  },
  {
    id: "deals",
    title: "Сделки",
    body: "Няма активни сделки, които изискват действие.",
    to: "/admin/deals",
    icon: Handshake,
  },
] as const;

export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="crm-locked-notify" role="dialog" aria-label="Известия">
      <div className="crm-locked-sheet__head">
        <span>Известия</span>
        <button type="button" className="crm-locked-fab" aria-label="Затвори" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="crm-locked-notify__list">
        {NOTICES.map((n) => {
          const Icon = n.icon;
          return (
            <Link key={n.id} to={n.to} className="crm-locked-notify__item" onClick={onClose}>
              <span className="crm-locked-notify__icon" aria-hidden>
                <Icon size={16} strokeWidth={1.7} />
              </span>
              <span className="crm-locked-notify__text">
                <strong>{n.title}</strong>
                <span>{n.body}</span>
              </span>
              <ArrowRight size={14} strokeWidth={2} aria-hidden />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
