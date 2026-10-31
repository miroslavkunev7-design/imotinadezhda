import { ArrowRight, X } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export type SectionSheetData = {
  title: string;
  value: string | number;
  subtitle?: string;
  photoUrl: string;
  to: string;
  description: string;
  icon: ReactNode;
};

export function SectionSheet({
  open,
  data,
  onClose,
}: {
  open: boolean;
  data: SectionSheetData | null;
  onClose: () => void;
}) {
  if (!open || !data) return null;

  return (
    <div
      className="crm-locked-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={data.title}
      onClick={onClose}
    >
      <div className="crm-locked-sheet crm-locked-sheet--card" onClick={(e) => e.stopPropagation()}>
        <div className="crm-locked-sheet__head">
          <span className="crm-locked-sheet__title-row">
            <span className="crm-locked-card__icon" aria-hidden>
              {data.icon}
            </span>
            {data.title}
          </span>
          <button type="button" className="crm-locked-fab" aria-label="Затвори" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div
          className="crm-locked-sheet__hero"
          style={{ backgroundImage: `url(${data.photoUrl})` }}
          aria-hidden
        />

        <div className="crm-locked-sheet__body">
          <div className="crm-locked-card__value">{data.value}</div>
          <p className="crm-locked-sheet__desc">{data.description}</p>
          <p className="crm-locked-card__sub">{data.subtitle ?? "Реални данни"}</p>

          <Link to={data.to} className="crm-locked-sheet__cta" onClick={onClose}>
            Отвори таб „{data.title}“
            <ArrowRight size={16} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}
