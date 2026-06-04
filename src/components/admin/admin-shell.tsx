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
  Briefcase,
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
  ShieldCheck,
  Database,
  Menu,
  X,
  Download as DownloadIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { newMatchesCount } from "@/lib/crm.functions";
import { AdminAIBubble } from "@/components/admin/ai-bubble";
import { onInstallAvailabilityChange, promptInstall } from "@/lib/pwa";
import marbleBg from "@/assets/marble-bg.png";
import heroBg from "@/assets/burgundy-terrace-hero.jpeg";
import brandLogoAsset from "@/assets/brand-logo-square.png.asset.json";
import loginHeroVideo from "@/assets/login-hero.mp4.asset.json";

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
  { to: "/admin/database", label: "База данни (архив)", icon: Database },
  { to: "/admin/cities", label: "Градове", icon: MapPin },
  { to: "/admin/quarters", label: "Квартали", icon: Layers },
  { to: "/admin/inquiries", label: "Запитвания", icon: MessageSquare },
  { to: "/admin/clients", label: "Клиенти", icon: Users },
  { to: "/admin/brokers", label: "Брокери", icon: UserCog },
  { to: "/admin/matches", label: "Съвпадения", icon: Heart, badgeKey: "matches" },
  { to: "/admin/contracts", label: "Договори", icon: FileText },
  { to: "/admin/audit", label: "Одит лог", icon: ShieldCheck },
  { to: "/admin/owners", label: "Собственици", icon: Crown },
  { to: "/admin/contacts", label: "Компании / Контакти", icon: Briefcase, badge: "NEW" },
  { to: "/admin/chat", label: "Чат", icon: MessageCircle },
  { to: "/admin/calendar", label: "Календар", icon: Calendar },
  { to: "/admin/finance", label: "Финанси", icon: Wallet },
  { to: "/admin/marketing", label: "Маркетинг", icon: Megaphone },
  { to: "/admin/tasks", label: "Задачи", icon: CheckSquare },
  { to: "/admin/documents", label: "Документи", icon: FolderOpen },
  { to: "/admin/settings", label: "Настройки", icon: Settings },
];

export function AdminShell({ children, breadcrumb }: { children: ReactNode; breadcrumb?: string }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [matchBadge, setMatchBadge] = useState<number>(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [crmBg, setCrmBg] = useState<string | null>(null);

  useEffect(() => onInstallAvailabilityChange(setInstallAvailable), []);

  useEffect(() => {
    if (!user) return;
    import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase
        .from("profiles")
        .select("crm_background_url")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setCrmBg(data?.crm_background_url ?? null))
    );
  }, [user]);

  useEffect(() => {
    let cancel = false;
    const tick = () => newMatchesCount().then((r) => { if (!cancel) setMatchBadge(r.count); }).catch(() => {});
    tick();
    const t = setInterval(tick, 30000);
    return () => { cancel = true; clearInterval(t); };
  }, []);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [path]);

  const current = NAV.find((n) => (n.to === "/admin" ? path === "/admin" : path.startsWith(n.to)));

  return (
    <div className="flex min-h-screen bg-[#5e0f1d]">
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          aria-label="Затвори меню"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-[#8B1A2B]/55 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar — бял мрамор със златни жилки */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-amber-500/25 shadow-[8px_0_30px_rgba(139, 26, 43,0.45)] backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        style={{
          backgroundImage: `
            linear-gradient(180deg, rgba(26,6,8,0.55), rgba(26,6,8,0.65)),
            repeating-linear-gradient(115deg, transparent 0 80px, rgba(201,160,76,0.08) 80px 81px, transparent 81px 180px)
          `,
        }}
      >

        {/* Logo */}
        <div className="flex items-center justify-between gap-3 border-b border-amber-600/25 px-5 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl ring-1 ring-amber-400/40 shadow-md">
              <img src={brandLogoAsset.url} alt="Имоти Надежда" className="h-full w-full object-cover" />
            </div>
            <div>
              <div className="font-display text-base leading-tight text-amber-100">Имоти</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">Надежда</div>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1.5 text-amber-100/80 hover:bg-amber-500/10 lg:hidden"
            aria-label="Затвори"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Profile */}
        <div className="border-b border-amber-600/25 px-4 py-3">
          <Link
            to="/admin/profile"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-xl border border-amber-400/25 bg-white/5 px-3 py-2.5 backdrop-blur-sm transition hover:bg-amber-500/15"
          >
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url as string} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              ) : (
                (user?.email ?? "U").slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-amber-100">
                {(user?.user_metadata?.full_name as string) || "Моят профил"}
              </div>
              <div className="text-[11px] text-amber-300/80">Админ · редактирай</div>
            </div>
          </Link>
        </div>


        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((item) => {
            const active = item.to === "/admin" ? path === "/admin" : path.startsWith(item.to);
            const baseClass = cn(
              "group relative mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
              active
                ? "bg-gradient-to-r from-primary via-[#7a0d22] to-primary text-primary-foreground shadow-[0_10px_22px_rgba(102,8,28,0.4)] ring-1 ring-amber-400/60"
                : "text-amber-100/85 hover:bg-amber-500/15",
                item.disabled && !active && "opacity-50",

            );
            const content = (
              <>
                {active && (
                  <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
                )}
                <item.icon className={cn("h-4 w-4 flex-none", active && "text-amber-200")} />
                <span className={cn("flex-1 truncate", active && "text-white font-semibold")}>{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-950">
                    {item.badge}
                  </span>
                ) : null}
                {item.badgeKey === "matches" && matchBadge > 0 ? (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {matchBadge}
                  </span>
                ) : null}
                {item.disabled ? (
                  <span className={cn("text-[9px] uppercase", active ? "text-amber-200/80" : "text-amber-100/40")}>скоро</span>
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
              <Link key={item.to} to={item.to} className={baseClass} onClick={() => setMobileOpen(false)}>
                {content}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-amber-600/25 px-3 py-3">
          <Link to="/admin/ai" onClick={() => setMobileOpen(false)} className="mb-2 flex items-center gap-2 rounded-lg border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-amber-300/15 px-3 py-2.5 text-sm text-amber-100 transition hover:from-amber-500/30 hover:to-amber-300/25">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span className="flex-1 font-medium">AI Асистент</span>
          </Link>
          <div className="mb-2 flex items-center gap-2 rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Системата работи
          </div>
          <button
            onClick={() => signOut().then(() => navigate({ to: "/login" }))}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-amber-100/70 transition hover:bg-amber-500/10 hover:text-amber-100"
          >
            <LogOut className="h-3.5 w-3.5" /> Изход
          </button>

        </div>
      </aside>

      {/* Main — херо фон */}
      <div
        className="relative flex min-w-0 flex-1 flex-col"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(20,4,8,0.82) 0%, rgba(20,4,8,0.92) 100%), url(${crmBg ?? heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-2 border-b border-amber-500/20 bg-[rgba(20,4,8,0.55)] px-4 py-3 backdrop-blur-md md:px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm text-amber-100/70">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md border border-amber-500/30 bg-amber-500/5 p-1.5 text-amber-100 hover:bg-amber-500/15 lg:hidden"
              aria-label="Отвори меню"
            >
              <Menu className="h-4 w-4" />
            </button>
            <Link to="/admin" className="hover:text-amber-100">Admin</Link>
            <ChevronRight className="h-3.5 w-3.5 flex-none" />
            <span className="truncate text-amber-100">{breadcrumb ?? current?.label ?? "Admin"}</span>
          </div>
          <div className="flex flex-none items-center gap-2">
            {installAvailable && (
              <button
                onClick={() => promptInstall()}
                title="Инсталирай като приложение"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-gradient-to-r from-amber-500/25 to-amber-300/20 px-2.5 py-1.5 text-xs font-semibold text-amber-100 shadow-sm transition hover:from-amber-500/35 hover:to-amber-300/30"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Инсталирай приложението</span>
                <span className="sm:hidden">Инсталирай</span>
              </button>
            )}
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-100 transition hover:bg-amber-500/15">
              <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Към сайта</span>
            </Link>
            <button
              onClick={() => signOut().then(() => navigate({ to: "/login" }))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-100 transition hover:bg-amber-500/15"
            >
              <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Изход</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 lg:p-8 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-amber-500/25 bg-[rgba(20,4,8,0.95)] backdrop-blur-md lg:hidden">
        {[
          { to: "/admin/properties", label: "Имоти", icon: Building2 },
          { to: "/admin/clients", label: "Клиенти", icon: Users },
          { to: "/admin/calendar", label: "Календар", icon: Calendar },
          { to: "/admin/chat", label: "Чат", icon: MessageCircle },
        ].map((item) => {
          const active = path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition",
                active ? "text-amber-300" : "text-amber-100/70",
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "text-amber-300")} />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center gap-0.5 py-2.5 text-[10px] text-amber-100/70 transition hover:text-amber-200"
          aria-label="Още"
        >
          <Menu className="h-5 w-5" />
          <span className="leading-none">Още</span>
        </button>
      </nav>

      {/* Floating AI assistant bubble */}
      <AdminAIBubble />
    </div>
  );
}

export function MarbleCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-500/20 p-5 shadow-[0_18px_45px_rgba(139, 26, 43,0.35)]",
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
