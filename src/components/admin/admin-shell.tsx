import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ReactNode, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Building2,
  Download,
  UserCog,
  Users,
  Crown,
  MessageSquare,
  MessageCircle,
  Calendar,
  FileText,
  Wallet,
  Megaphone,
  CheckSquare,
  FolderOpen,
  Settings,
  Sparkles,
  LogOut,
  ExternalLink,
  ChevronRight,
  MapPin,
  Layers,
  Heart,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { newMatchesCount } from "@/lib/crm.functions";
import marbleBg from "@/assets/marble-bg.png";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
  badge?: string;
  badgeKey?: "matches";
};

const NAV: NavItem[] = [
  { to: "/admin", label: "Дашборд", icon: LayoutDashboard },
  { to: "/admin/properties", label: "Имоти", icon: Building2 },
  { to: "/admin/extracted", label: "Извлечени имоти", icon: Download, badge: "NEW" },
  { to: "/admin/cities", label: "Градове", icon: MapPin },
  { to: "/admin/quarters", label: "Квартали", icon: Layers },
  { to: "/admin/inquiries", label: "Запитвания", icon: MessageSquare },
  { to: "/admin/clients", label: "Клиенти", icon: Users },
  { to: "/admin/brokers", label: "Брокери", icon: UserCog },
  { to: "/admin/matches", label: "Съвпадения", icon: Heart, badgeKey: "matches" },
  { to: "/admin/contracts", label: "Договори", icon: FileText },
  { to: "/admin/owners", label: "Собственици", icon: Crown, disabled: true },
  { to: "/admin/chat", label: "Чат", icon: MessageCircle, disabled: true },
  { to: "/admin/calendar", label: "Календар", icon: Calendar, disabled: true },
  { to: "/admin/finance", label: "Финанси", icon: Wallet, disabled: true },
  { to: "/admin/marketing", label: "Маркетинг", icon: Megaphone, disabled: true },
  { to: "/admin/tasks", label: "Задачи", icon: CheckSquare, disabled: true },
  { to: "/admin/documents", label: "Документи", icon: FolderOpen, disabled: true },
  { to: "/admin/settings", label: "Настройки", icon: Settings, disabled: true },
];

export function AdminShell({ children, breadcrumb }: { children: ReactNode; breadcrumb?: string }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const current = NAV.find((n) => (n.to === "/admin" ? path === "/admin" : path.startsWith(n.to)));

  return (
    <div className="flex min-h-screen bg-[#1a0608]" style={{ backgroundImage: `url(${marbleBg})`, backgroundSize: "600px", backgroundBlendMode: "overlay" }}>
      {/* Sidebar */}
      <aside className="flex w-[250px] flex-col border-r border-primary-foreground/10 bg-[linear-gradient(180deg,#fbf6ec_0%,#f4ead5_100%)] shadow-[8px_0_30px_rgba(0,0,0,0.25)]">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-primary/15 px-5 py-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-base leading-none text-primary">Имоти</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/70">Надежда</div>
            </div>
          </Link>
        </div>

        {/* Profile */}
        <div className="border-b border-primary/15 px-4 py-3">
          <div className="flex items-center gap-3 rounded-xl bg-primary/5 px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {(user?.email ?? "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-primary">Профил</div>
              <div className="text-[11px] text-primary/60">Админ</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((item) => {
            const active = item.to === "/admin" ? path === "/admin" : path.startsWith(item.to);
            const baseClass = cn(
              "group mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
              active
                ? "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-[0_8px_18px_rgba(102,8,28,0.3)]"
                : "text-primary/85 hover:bg-primary/8",
              item.disabled && !active && "opacity-50",
            );
            const content = (
              <>
                <item.icon className="h-4 w-4 flex-none" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-950">
                    {item.badge}
                  </span>
                ) : null}
                {item.disabled ? (
                  <span className="text-[9px] uppercase text-primary/40">скоро</span>
                ) : null}
              </>
            );
            if (item.disabled) {
              return (
                <div key={item.to} className={baseClass} aria-disabled>
                  {content}
                </div>
              );
            }
            return (
              <Link key={item.to} to={item.to} className={baseClass}>
                {content}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-primary/15 px-3 py-3">
          <Link to="/admin/ai" className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-amber-300/10 px-3 py-2.5 text-sm text-primary transition hover:from-amber-500/20 hover:to-amber-300/20">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span className="flex-1 font-medium">AI Асистент</span>
          </Link>
          <div className="mb-2 flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Системата работи
          </div>
          <button
            onClick={() => signOut().then(() => navigate({ to: "/login" }))}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-primary/60 transition hover:bg-primary/10 hover:text-primary"
          >
            <LogOut className="h-3.5 w-3.5" /> Изход
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-amber-500/15 bg-[rgba(20,4,8,0.7)] px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2 text-sm text-amber-100/70">
            <Link to="/admin" className="hover:text-amber-100">Admin</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-amber-100">{breadcrumb ?? current?.label ?? "Admin"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-500/15">
              <ExternalLink className="h-3.5 w-3.5" /> Към сайта
            </Link>
            <button
              onClick={() => signOut().then(() => navigate({ to: "/login" }))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-500/15"
            >
              <LogOut className="h-3.5 w-3.5" /> Изход
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function MarbleCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-500/20 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.35)]",
        className,
      )}
      style={{
        backgroundImage: `url(${marbleBg})`,
        backgroundSize: "cover",
      }}
    >
      <div className="rounded-xl bg-[rgba(255,251,243,0.92)] p-4 md:p-5">{children}</div>
    </div>
  );
}
