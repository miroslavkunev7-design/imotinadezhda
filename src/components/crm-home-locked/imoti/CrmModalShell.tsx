import { Maximize2, Minimize2, X } from "lucide-react";
import type { ReactNode } from "react";

export function CrmModalShell({
  open,
  title,
  expanded,
  onToggleExpand,
  onClose,
  zIndex = 60,
  children,
  headerLeft,
  headerCenter,
  headerRight,
  className = "",
}: {
  open: boolean;
  title: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  zIndex?: number;
  children: ReactNode;
  headerLeft?: ReactNode;
  headerCenter?: ReactNode;
  headerRight?: ReactNode;
  className?: string;
}) {
  if (!open) return null;

  return (
    <div
      className={`crm-imoti-overlay${expanded ? " crm-imoti-overlay--expanded" : ""}`}
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`crm-imoti-shell${expanded ? " crm-imoti-shell--expanded" : ""}${className ? ` ${className}` : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="crm-imoti-shell__top">
          <div className="crm-imoti-shell__top-left">
            {headerLeft ?? (
              <img
                src="/crm-home-locked/logo-original.png"
                alt="Имоти Надежда"
                className="crm-imoti-shell__logo"
                draggable={false}
              />
            )}
          </div>
          <div className="crm-imoti-shell__top-center">{headerCenter}</div>
          <div className="crm-imoti-shell__top-right">
            {headerRight}
            <button
              type="button"
              className="crm-imoti-icon-btn"
              aria-label={expanded ? "Свий" : "Цял екран"}
              title={expanded ? "Свий" : "Цял екран"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              className="crm-imoti-icon-btn"
              aria-label="Затвори"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="crm-imoti-shell__body">{children}</div>
      </div>
    </div>
  );
}
