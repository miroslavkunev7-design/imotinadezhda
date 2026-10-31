import { X } from "lucide-react";
import { LOCKED_NAV_ITEMS, type NavKey } from "./LockedNav";

export function BottomMenuSheet({
  open,
  active,
  onClose,
  onSelect,
}: {
  open: boolean;
  active: NavKey;
  onClose: () => void;
  onSelect: (key: NavKey) => void;
}) {
  if (!open) return null;

  return (
    <div
      className="crm-locked-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Меню"
      onClick={onClose}
    >
      <div className="crm-locked-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="crm-locked-sheet__head">
          <span>Меню</span>
          <button type="button" className="crm-locked-fab" aria-label="Затвори" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="crm-locked-sheet__list">
          {LOCKED_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={
                  isActive
                    ? "crm-locked-sheet__item crm-locked-sheet__item--active"
                    : "crm-locked-sheet__item"
                }
                onClick={() => {
                  onSelect(item.key);
                  onClose();
                }}
              >
                <Icon size={18} strokeWidth={1.7} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
