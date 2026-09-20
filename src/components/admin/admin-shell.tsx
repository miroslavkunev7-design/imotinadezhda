import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ReactNode, useEffect, useState } from "react";
import {
  CrmPageSettingsProvider,
  pageBackgroundStyle,
  pageSettingsStyle,
  useCrmPageSettings,
} from "@/hooks/use-crm-page-settings";
import { CrmPageSettingsPanel } from "@/components/admin/page-settings/page-settings-panel";
import { BRUSH_KEYS } from "@/lib/crm-page-settings/types";
import { CrmPageEditLayer } from "@/components/admin/page-settings/page-edit-mode";
import { CrmCustomBlocks } from "@/components/admin/page-settings/custom-blocks";
import {
  LayoutDashboard,
  Building2,
  Download,
  UserCog,
  Users,
  Crown,
  MessageSquare,
  MessageSquareQuote,
  HeartHandshake,
  MessageCircle,
  Calendar,
  CalendarCheck,
  Globe2,
  Images,
  FileBarChart2,
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
  ChevronDown,
  MapPin,
  Target,
  Gauge,
  Layers,
  Heart,
  ShieldCheck,
  ScrollText,
  Menu,
  X,
  Search,
  Database,
  Brain,
  Send,
  Repeat2,
  Zap,
  Download as DownloadIcon,
  Gavel,
  PenLine,
  Percent,
  Bot,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { newMatchesCount } from "@/lib/crm.functions";
import { AdminAIBubble } from "@/components/admin/ai-bubble";
import { onInstallAvailabilityChange, promptInstall } from "@/lib/pwa";
import { useCrmTheme, crmThemeStyle } from "@/hooks/use-crm-theme";
import { useTaskReminders } from "@/hooks/use-task-reminders";
import { PushToggle } from "@/components/admin/push-toggle";
import { shouldPlayHeroVideo } from "@/lib/device-perf";
import marbleBg from "@/assets/marble-bg.png";
import brushMask from "@/assets/brush-panel-mask.png";
import crmDefaultBg from "@/assets/shumen-hero-mobile.jpeg.asset.json";
import { resolveAssetUrl } from "@/lib/asset-url";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
  badge?: string;
  badgeKey?: "matches";
};

type NavGroup = {
  key: string;
  label: string;
  icon: typeof LayoutDashboard;
  children: NavItem[];
};

type NavEntry = NavItem | NavGroup;

const isGroup = (e: NavEntry): e is NavGroup => "children" in e;

// Отдел „Автоматизации“ — всички автоматизации на едно място, номерирани
const AUTOMATIONS: NavItem[] = [
  { to: "/admin/leads", label: "1. Лийдове (прием)", icon: Zap },
  { to: "/admin/qualification", label: "2. AI Квалификация", icon: Brain },
  { to: "/admin/matching", label: "3. Авто изпращане имоти", icon: Send },
  { to: "/admin/followup", label: "4. Follow-Up", icon: Repeat2 },
  { to: "/admin/viewings", label: "5. Огледи & напомняния", icon: CalendarCheck },
  { to: "/admin/portals", label: "6. Портали (публикуване)", icon: Globe2 },
  { to: "/admin/deals", label: "7. Сделки до нотариус", icon: Gavel },
  { to: "/admin/copy", label: "8. AI Описания и SEO", icon: PenLine },
  { to: "/admin/photos", label: "9. AI Обработка на снимки", icon: Images },
  { to: "/admin/owner-reports", label: "10. Отчети към собственици", icon: FileBarChart2 },
  { to: "/admin/reviews", label: "11. Ревюта (Google/Facebook)", icon: MessageSquareQuote },
  { to: "/admin/reactivation", label: "12. Реактивиране на клиенти", icon: HeartHandshake },
  { to: "/admin/commissions", label: "13. Комисионни", icon: Percent },
  { to: "/admin/marketing-auto", label: "14. Маркетинг автоматизация", icon: Megaphone },
  { to: "/admin/seller-predict", label: "15. AI Прогноза продавачи", icon: Target },
  { to: "/admin/omnibot", label: "16. AI Асистент 24/7", icon: Bot },
  { to: "/admin/extracted", label: "17. Извлечени имоти", icon: Download },
  { to: "/admin/rules", label: "18. Правила", icon: ScrollText },
  { to: "/admin/control-center", label: "19. Контролен център", icon: Gauge },
];

const NAV: NavEntry[] = [
  { to: "/admin", label: "Дашборд", icon: LayoutDashboard },
  { to: "/admin/master-board", label: "Таблица с референции", icon: ScrollText },
  { to: "/admin/properties", label: "Имоти", icon: Building2 },
  { to: "/admin/cities", label: "Градове", icon: MapPin },
  { to: "/admin/quarters", label: "Квартали", icon: Layers },
  { to: "/admin/inquiries", label: "Запитвания", icon: MessageSquare },
  { key: "automations", label: "Автоматизации", icon: Zap, children: AUTOMATIONS },
  { to: "/admin/clients", label: "Клиенти", icon: Users },
  { to: "/admin/rentals", label: "Наеми & плащания", icon: Wallet },
  { to: "/admin/brokers", label: "Брокери", icon: UserCog },
  { to: "/admin/matches", label: "Съвпадения", icon: Heart, badgeKey: "matches" },
  { to: "/admin/contracts", label: "Договори (генератор)", icon: FileText },
  { to: "/admin/audit", label: "Одит лог", icon: ShieldCheck },
  { to: "/admin/owners", label: "Собственици", icon: Crown },
  { to: "/admin/contacts", label: "Компании / Контакти", icon: Briefcase },
  { to: "/admin/chat", label: "Чат", icon: MessageCircle },
  { to: "/admin/calendar", label: "Календар", icon: Calendar },
  { to: "/admin/finance", label: "Финанси", icon: Wallet },
  { to: "/admin/bank-rates", label: "Лихви по банки", icon: Wallet },

  { to: "/admin/marketing", label: "Маркетинг", icon: Megaphone },
  { to: "/admin/tasks", label: "Задачи", icon: CheckSquare },
  { to: "/admin/documents", label: "Документи (управление)", icon: FolderOpen },
  { to: "/admin/schema", label: "Supabase схема", icon: Database, badge: "DIAG" },
  { to: "/admin/settings", label: "Настройки", icon: Settings },
];

const FLAT_NAV: NavItem[] = NAV.flatMap((e) => (isGroup(e) ? e.children : [e]));

const QUICK_NAV: { to: string; label: string }[] = [
  { to: "/admin", label: "Табло" },
  { to: "/admin/properties", label: "Имоти" },
  { to: "/admin/clients", label: "Клиенти" },
  { to: "/admin/viewings", label: "Срещи" },
  { to: "/admin/tasks", label: "Задачи" },
  { to: "/admin/calendar", label: "Календар" },
  { to: "/admin/owner-reports", label: "Справки" },
];

function AdminShellInner({ children, breadcrumb }: { children: ReactNode; breadcrumb?: string }) {
  const { settings, editMode, previewMode, setPreviewMode } = useCrmPageSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [matchBadge, setMatchBadge] = useState<number>(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState<boolean>(false);
  const [automationsQuery, setAutomationsQuery] = useState("");
  const [installAvailable, setInstallAvailable] = useState(false);
  const [crmBg, setCrmBg] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [allowBgVideo, setAllowBgVideo] = useState(true);
  const { theme } = useCrmTheme();

  useTaskReminders();

  useEffect(() => onInstallAvailabilityChange(setInstallAvailable), []);
  useEffect(() => {
    setAllowBgVideo(shouldPlayHeroVideo());
  }, []);

  useEffect(() => {
    if (!user) return;
    import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase
        .from("profiles")
        .select("crm_background_url, avatar_url, full_name")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          setCrmBg(data?.crm_background_url ?? null);
          setProfileAvatar(data?.avatar_url ?? null);
          setProfileName(data?.full_name ?? null);
        }),
    );
  }, [user]);

  useEffect(() => {
    let cancel = false;
    const tick = () =>
      newMatchesCount()
        .then((r) => {
          if (!cancel) setMatchBadge(r.count);
        })
        .catch(() => {});
    tick();
    const t = setInterval(tick, 30000);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  const current = FLAT_NAV.find((n) =>
    n.to === "/admin" ? path === "/admin" : path.startsWith(n.to),
  );
  const automationsActive = AUTOMATIONS.some((a) => path.startsWith(a.to));
  const filteredAutomations = (() => {
    const q = automationsQuery.trim().toLowerCase();
    if (!q) return AUTOMATIONS;
    return AUTOMATIONS.filter((a) => a.label.toLowerCase().includes(q));
  })();

  useEffect(() => {
    if (automationsActive) setAutomationsOpen(true);
  }, [automationsActive]);

  // CRM четливост: маркираме и <body>, за да важат правилата и за
  // диалози/менюта, които се рендират в портал извън тази обвивка.
  useEffect(() => {
    document.body.setAttribute("data-crm-themed", "");
    return () => document.body.removeAttribute("data-crm-themed");
  }, []);

  // Интензитетът на четката важи и за порталите (диалози, менюта).
  const brushKey = BRUSH_KEYS[settings.brush?.intensity ?? 2];
  useEffect(() => {
    document.body.setAttribute("data-crm-brush", brushKey);
    return () => document.body.removeAttribute("data-crm-brush");
  }, [brushKey]);

  return (
    <div
      data-crm-themed
      data-crm-brush={brushKey}
      className="crm-shell-bg relative flex min-h-[100dvh] overflow-x-hidden"
      style={{
        ...crmThemeStyle(theme),
        ["--crm-brush-mask" as any]: `url(${brushMask})`,
        color: theme.text,
        fontFamily: theme.fontFamily ?? undefined,
      }}
    >
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          aria-label="Затвори меню"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-[#8B1A2B]/55 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar — тъмно бордо, brush активен ред, профилна карта долу */}
      <aside
        className={cn(
          "crm-rail fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col shadow-[8px_0_30px_rgba(0,0,0,0.55)] transition-transform duration-300 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between gap-3 border-b border-amber-600/15 px-5 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl ring-1 ring-amber-400/30 shadow-md">
              <img
                src="/apple-touch-icon.png"
                alt="Имоти Надежда"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="font-display text-base leading-tight text-amber-50">Имоти</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/90">
                Надежда
              </div>
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

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((entry) => {
            if (isGroup(entry)) {
              const open = automationsOpen;
              return (
                <div key={entry.key} className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => setAutomationsOpen((v) => !v)}
                    aria-expanded={open}
                    className={cn(
                      "crm-nav-item group mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition",
                      automationsActive
                        ? "crm-nav-item--active font-semibold"
                        : "text-amber-100/70 hover:bg-white/5 hover:text-amber-50",
                    )}
                  >
                    <entry.icon
                      className={cn("h-4 w-4 flex-none", automationsActive && "text-amber-200")}
                    />
                    <span className="flex-1 truncate">{entry.label}</span>
                    <span className="rounded-full bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-bold text-amber-950">
                      {entry.children.length}
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 flex-none transition-transform", open && "rotate-180")}
                    />
                  </button>
                  {open ? (
                    <div className="mb-1 ml-3 space-y-0.5 border-l border-amber-400/25 pl-2">
                      <div className="relative mb-1 pr-1">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-200/70" />
                        <input
                          value={automationsQuery}
                          onChange={(e) => setAutomationsQuery(e.target.value)}
                          placeholder="Търси по име или номер…"
                          aria-label="Търсене в автоматизации"
                          className="w-full rounded-lg border border-amber-400/25 bg-black/25 py-1.5 pl-7 pr-6 text-[12px] text-amber-50 placeholder:text-amber-100/45 focus:border-amber-300/60 focus:outline-none"
                        />
                        {automationsQuery ? (
                          <button
                            type="button"
                            onClick={() => setAutomationsQuery("")}
                            aria-label="Изчисти търсенето"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-100/60 hover:text-amber-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      {filteredAutomations.length === 0 ? (
                        <div className="px-2.5 py-2 text-[12px] text-amber-100/50">
                          Няма съвпадения
                        </div>
                      ) : null}
                      {filteredAutomations.map((sub) => {
                        const subActive = path.startsWith(sub.to);
                        return (
                          <Link
                            key={sub.to}
                            to={sub.to}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] leading-tight transition",
                              subActive
                                ? "bg-amber-400/15 font-semibold text-amber-100"
                                : "text-amber-100/65 hover:bg-white/5 hover:text-amber-50",
                            )}
                          >
                            <sub.icon
                              className={cn("h-3.5 w-3.5 flex-none", subActive && "text-amber-200")}
                            />
                            <span className="flex-1 truncate">{sub.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }
            const item = entry;
            const active = item.to === "/admin" ? path === "/admin" : path.startsWith(item.to);
            const baseClass = cn(
              "crm-nav-item group mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
              active
                ? "crm-nav-item--active font-semibold"
                : "text-amber-100/70 hover:bg-white/5 hover:text-amber-50",
              item.disabled && !active && "opacity-50",
            );
            const content = (
              <>
                <item.icon className={cn("h-4 w-4 flex-none", active && "text-amber-200")} />
                <span className="flex-1 truncate">{item.label}</span>
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
                  <span
                    className={cn(
                      "text-[9px] uppercase",
                      active ? "text-amber-200/80" : "text-amber-100/40",
                    )}
                  >
                    скоро
                  </span>
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
              <Link
                key={item.to}
                to={item.to}
                className={baseClass}
                onClick={() => setMobileOpen(false)}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        {/* Footer — профилна карта */}
        <div className="border-t border-amber-600/15 px-3 py-3">
          <Link
            to="/admin/ai"
            onClick={() => setMobileOpen(false)}
            className="mb-2 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-white/5 px-3 py-2.5 text-sm text-amber-100 transition hover:bg-white/10"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span className="flex-1 font-medium">AI Асистент</span>
          </Link>
          <div className="mb-2 flex items-center gap-2 rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Системата работи
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-amber-400/25 bg-[#5a0f1c]/70 px-3 py-2.5">
            <Link
              to="/admin/profile"
              onClick={() => setMobileOpen(false)}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {profileAvatar || user?.user_metadata?.avatar_url ? (
                  <img
                    src={profileAvatar || (user?.user_metadata?.avatar_url as string)}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  (user?.email ?? "U").slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-amber-50">
                  {profileName || (user?.user_metadata?.full_name as string) || "Моят профил"}
                </div>
                <div className="text-[10.5px] font-medium tracking-wide text-amber-200/70">
                  Администратор
                </div>
              </div>
            </Link>
            <button
              onClick={() => signOut().then(() => navigate({ to: "/login" }))}
              className="rounded-md p-1.5 text-amber-100/70 transition hover:bg-white/10 hover:text-amber-50"
              aria-label="Изход"
              title="Изход"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main — херо фон (персонален фон на потребителя, иначе мобилният фон от началната страница) */}
      {(() => {
        const effectiveBg = settings.bg.url ?? crmBg ?? resolveAssetUrl(crmDefaultBg);
        return (
          <div
            className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white lg:min-h-screen"
            style={
              effectiveBg
                ? pageBackgroundStyle(settings, effectiveBg)
                : theme.heroBg
                  ? {
                      background: theme.heroBg,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
            }
          >
            {/* Ambient hero video is provided globally at the shell root */}

            {/* Header */}
            <header className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-amber-500/20 px-3 py-3 backdrop-blur-sm md:px-6">
              <div className="flex min-w-0 items-center gap-3 text-sm text-amber-100/70">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="rounded-md border border-amber-500/30 bg-amber-500/5 p-1.5 text-amber-100 hover:bg-amber-500/15 lg:hidden"
                  aria-label="Отвори меню"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <nav className="hidden min-w-0 items-center gap-1 xl:flex">
                  {QUICK_NAV.map((q) => {
                    const active = q.to === "/admin" ? path === "/admin" : path.startsWith(q.to);
                    return (
                      <Link
                        key={q.to}
                        to={q.to}
                        className={cn(
                          "crm-topnav-link whitespace-nowrap px-4 py-2 text-sm font-medium",
                          active && "crm-topnav-link--active font-semibold",
                        )}
                      >
                        {q.label}
                      </Link>
                    );
                  })}
                </nav>
                <div className="flex min-w-0 items-center gap-2 xl:hidden">
                  <Link to="/admin" className="hover:text-amber-100">
                    Admin
                  </Link>
                  <ChevronRight className="h-3.5 w-3.5 flex-none" />
                  <span className="truncate text-amber-100">
                    {breadcrumb ?? current?.label ?? "Admin"}
                  </span>
                </div>
              </div>
              <div className="flex min-w-0 flex-none items-center justify-end gap-1.5 sm:gap-2">
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
                <PushToggle />
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-100 transition hover:bg-amber-500/15"
                >
                  <ExternalLink className="h-3.5 w-3.5" />{" "}
                  <span className="hidden sm:inline">Към сайта</span>
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
            <main className="crm-content relative z-10 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3 pb-[calc(6.75rem+env(safe-area-inset-bottom,0px))] md:p-6 lg:p-8 lg:pb-8">
              {settings.bg.dim > 0 || settings.bg.blur > 0 ? (
                <div
                  aria-hidden
                  className="pointer-events-none fixed inset-0 z-0"
                  style={{
                    backgroundColor: `rgba(0,0,0,${settings.bg.dim / 100})`,
                    backdropFilter: settings.bg.blur ? `blur(${settings.bg.blur}px)` : undefined,
                  }}
                />
              ) : null}
              <div data-crm-page-root className="relative z-10" style={pageSettingsStyle(settings)}>
                {children}
                <CrmCustomBlocks />
              </div>
            </main>

            {/* Бутон „Настройки на страницата“ (зъбно колело) */}
            {!previewMode && (
              <button
                type="button"
                data-crm-edit-ui
                onClick={() => setSettingsOpen((v) => !v)}
                aria-label="Настройки на страницата"
                title="Настройки на страницата"
                className={cn(
                  "fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] right-4 z-[9990] flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/70 shadow-[0_10px_30px_rgba(20,4,8,0.45)] transition lg:bottom-24",
                  settingsOpen || editMode
                    ? "bg-amber-400 text-[#2b0210]"
                    : "bg-[#4f0314] text-amber-200 hover:bg-[#63071c]",
                )}
              >
                <Settings className={cn("h-5 w-5", editMode && "animate-spin")} />
              </button>
            )}
            {previewMode && (
              <div
                data-crm-edit-ui
                className="fixed left-1/2 top-3 z-[9999] flex -translate-x-1/2 items-center gap-3 rounded-full border border-amber-400/50 bg-[#4f0314] px-4 py-2 text-xs font-semibold text-amber-200 shadow-lg"
              >
                Преглед — така изглежда страницата
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-amber-100"
                >
                  Изход
                </button>
              </div>
            )}
            {settingsOpen && !previewMode && (
              <CrmPageSettingsPanel onClose={() => setSettingsOpen(false)} />
            )}
            <CrmPageEditLayer />
          </div>
        );
      })()}

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4.75rem+env(safe-area-inset-bottom,0px))] grid-cols-5 border-t border-amber-500/25 bg-[rgba(20,4,8,0.96)] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-14px_32px_rgba(20,4,8,0.35)] backdrop-blur-md lg:hidden">
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
                "flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[10px] transition",
                active ? "text-amber-300" : "text-amber-100/70",
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", active && "text-amber-300")} />
              <span className="max-w-full truncate leading-none">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[10px] text-amber-100/70 transition hover:text-amber-200"
          aria-label="Още"
        >
          <Menu className="h-5 w-5 shrink-0" />
          <span className="max-w-full truncate leading-none">Още</span>
        </button>
      </nav>

      {/* Floating AI assistant bubble */}
      <AdminAIBubble />
    </div>
  );
}

export function AdminShell({ children, breadcrumb }: { children: ReactNode; breadcrumb?: string }) {
  return (
    <CrmPageSettingsProvider>
      <AdminShellInner breadcrumb={breadcrumb}>{children}</AdminShellInner>
    </CrmPageSettingsProvider>
  );
}

export function MarbleCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-500/20 p-5 shadow-[0_18px_45px_rgba(139,26,43,0.35)]",
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
