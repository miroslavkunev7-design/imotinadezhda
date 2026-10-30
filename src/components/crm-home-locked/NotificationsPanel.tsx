import { X } from "lucide-react";

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
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, opacity: 0.9 }}>
        Няма нови известия. Тук ще се появяват напомняния за огледи и сделки.
      </p>
    </div>
  );
}
