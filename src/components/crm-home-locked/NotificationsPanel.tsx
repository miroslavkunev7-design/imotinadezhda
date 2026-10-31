import { ArrowRight, CalendarCheck, Handshake, X } from "lucide-react";

const NOTICES = [
  {
    id: "viewings",
    title: "Огледи",
    body: "Няма насрочени огледи за днес.",
    section: "ogledi" as const,
    icon: CalendarCheck,
  },
  {
    id: "deals",
    title: "Сделки",
    body: "Няма активни сделки, които изискват действие.",
    section: "sdelki" as const,
    icon: Handshake,
  },
] as const;

export type NoticeSection = (typeof NOTICES)[number]["section"];

export function NotificationsPanel({
  open,
  onClose,
  onOpenSection,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSection: (section: NoticeSection) => void;
}) {
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
            <button
              key={n.id}
              type="button"
              className="crm-locked-notify__item"
              onClick={() => {
                onOpenSection(n.section);
                onClose();
              }}
            >
              <span className="crm-locked-notify__icon" aria-hidden>
                <Icon size={16} strokeWidth={1.7} />
              </span>
              <span className="crm-locked-notify__text">
                <strong>{n.title}</strong>
                <span>{n.body}</span>
              </span>
              <ArrowRight size={14} strokeWidth={2} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
