import {
  Briefcase,
  Building2,
  Calendar,
  CalendarCheck,
  CheckSquare,
  FileText,
  Home,
  MessageCircle,
  Settings,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { NAV_ROUTES, type NavKey } from "./LockedNav";

const MENU_LINKS: {
  label: string;
  to: string;
  icon: typeof Home;
  navKey?: NavKey;
}[] = [
  { label: "Начало", to: NAV_ROUTES.home, icon: Home, navKey: "home" },
  { label: "Клиенти", to: NAV_ROUTES.clients, icon: Users, navKey: "clients" },
  { label: "Имоти", to: NAV_ROUTES.properties, icon: Building2, navKey: "properties" },
  { label: "Сделки", to: "/admin/deals", icon: Briefcase },
  { label: "Огледи", to: "/admin/viewings", icon: CalendarCheck },
  { label: "Календар", to: NAV_ROUTES.calendar, icon: Calendar, navKey: "calendar" },
  { label: "Задачи", to: "/admin/tasks", icon: CheckSquare },
  { label: "Чат", to: "/admin/chat", icon: MessageCircle },
  { label: "Документи", to: "/admin/documents", icon: FileText },
  { label: "Банка / лихви", to: "/admin/bank-rates", icon: Wallet },
  { label: "AI асистент", to: NAV_ROUTES.ai, icon: Sparkles, navKey: "ai" },
  { label: "Настройки", to: "/admin/settings", icon: Settings },
];

export function BottomMenuSheet({
  open,
  active,
  onClose,
}: {
  open: boolean;
  active: NavKey;
  onClose: () => void;
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
          {MENU_LINKS.map((item) => {
            const Icon = item.icon;
            const isActive = item.navKey ? active === item.navKey : false;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  isActive
                    ? "crm-locked-sheet__item crm-locked-sheet__item--active"
                    : "crm-locked-sheet__item"
                }
                onClick={onClose}
              >
                <Icon size={18} strokeWidth={1.7} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
