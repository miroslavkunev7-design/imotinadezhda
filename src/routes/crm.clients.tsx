import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Banknote,
  Bot,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckSquare,
  FileText,
  Home,
  Key,
  LayoutDashboard,
  ListTodo,
  Mail,
  MapPin,
  Maximize2,
  MessageCircle,
  MessagesSquare,
  Minimize2,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { listClients, upsertClient, getClientDocuments } from "@/lib/crm.functions";
import { supabase } from "@/integrations/supabase/client";
import brushBurgundy from "@/assets/crm-brush-burgundy.png";
import brushDeep from "@/assets/crm-brush-deep.png";
import brushWhite from "@/assets/crm-brush-white.png";
import cardWhite from "@/assets/crm-card-white.png";
import logoBrush from "@/assets/nadezhda-brush-original.png";
import cityShumen from "@/assets/city-shumen.jpeg";
import cityVarna from "@/assets/city-varna.jpeg";
import cityBurgas from "@/assets/city-burgas.jpeg";
import clientBuyer from "@/assets/client-buyer.jpg";
import clientTenant from "@/assets/client-tenant.jpg";
import clientSeller from "@/assets/client-seller.jpg";
import clientLandlord from "@/assets/client-landlord.jpg";
import livingRoom from "@/assets/home-hero-living.jpeg";
import officePhoto from "@/assets/login-hero.jpeg";
import architecture from "@/assets/crm-bg-architecture.jpg";

export const Route = createFileRoute("/crm/clients")({
  head: () => ({
    meta: [
      { title: "Клиенти — CRM Имоти Надежда" },
      { name: "description", content: "CRM модул за клиенти на Имоти Надежда — продажби и наеми." },
      { property: "og:title", content: "Клиенти — CRM Имоти Надежда" },
      { property: "og:description", content: "Хората зад всеки успешен имот." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;600;700;800;900&display=swap",
      },
    ],
  }),
  component: CrmClientsPage,
});

/* ------------------------------------------------------------------ */
const C = {
  burg: "#980018",
  deep: "#720014",
  navy: "#0C2D5A",
  green: "#0AAA68",
  gold: "#C9A84C",
};
const COND = { fontFamily: '"Roboto Condensed", "Arial Narrow", sans-serif' };
const SCRIPT = { fontFamily: '"Marck Script", "Segoe Script", cursive' };

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  client_type: string;
  status: string;
  search_city_id: string | null;
  search_quarter_id: string | null;
  search_property_type: string | null;
  search_status: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  rooms_min: number | null;
  rooms_max: number | null;
  area_min: number | null;
  area_max: number | null;
  notes: string | null;
  assigned_broker_id: string | null;
  created_at: string;
  updated_at: string;
  deal_stage?: string | null;
  cities?: { name: string; slug: string } | null;
  quarters?: { name: string } | null;
  brokers?: { full_name: string } | null;
};

type Filter = "all" | "sale" | "rent" | "newest";

const isRent = (c: Client) =>
  c.client_type === "tenant" || c.client_type === "landlord" || c.search_status === "rent";

const TYPE_LABEL: Record<string, string> = {
  buyer: "Купувач",
  seller: "Продавач",
  tenant: "Наемател",
  landlord: "Наемодател",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Активен",
  inactive: "Неактивен",
  closed: "Приключен",
};
const PROP_LABEL: Record<string, string> = {
  apartment: "Апартамент",
  house: "Къща",
  office: "Офис",
  land: "Парцел",
  commercial: "Търговски имот",
};

function money(n: number | null | undefined, cur?: string | null) {
  if (n == null) return null;
  return `${Math.round(n).toLocaleString("bg-BG")} ${cur === "BGN" ? "лв." : cur === "EUR" || !cur ? "€" : cur}`;
}
function budgetText(c: Client) {
  const a = money(c.budget_min, c.currency);
  const b = money(c.budget_max, c.currency);
  if (a && b) return `${a} – ${b}`;
  if (b) return `до ${b}`;
  if (a) return `от ${a}`;
  return "Не е посочен";
}
function clientPhoto(c: Client) {
  const slug = c.cities?.slug ?? "";
  if (c.client_type === "tenant") return clientTenant;
  if (c.client_type === "landlord") return clientLandlord;
  if (c.client_type === "seller") return clientSeller;
  if (slug === "varna") return cityVarna;
  if (slug === "burgas") return cityBurgas;
  return clientBuyer;
}
function digits(p: string | null) {
  const d = (p ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("359")) return d;
  if (d.startsWith("0")) return "359" + d.slice(1);
  return d;
}
function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return s;
  }
}

/* Painterly brush layer — raster PNG 1:1 (object-fill to strip) */
function Brush({ src, className = "" }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={`pointer-events-none absolute inset-0 h-full w-full select-none object-fill ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
function CrmClientsPage() {
  const { user, loading } = useAuth();
  if (loading)
    return <div className="grid min-h-screen place-items-center" style={COND}>Зареждане…</div>;
  if (!user)
    return (
      <div className="grid min-h-screen place-items-center bg-white" style={COND}>
        <div className="text-center">
          <p className="mb-4 text-xl font-bold" style={{ color: C.navy }}>Нужен е вход в CRM.</p>
          <Link to="/login" className="rounded-full px-6 py-3 font-bold text-white" style={{ background: C.burg }}>
            Вход
          </Link>
        </div>
      </div>
    );
  return <ClientsModule />;
}

function ClientsModule() {
  const fetchClients = useServerFn(listClients);
  const saveClient = useServerFn(upsertClient);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expand, setExpand] = useState<{ sale: boolean; rent: boolean }>({ sale: false, rent: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = (await fetchClients()) as unknown as Client[];
      setClients(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при зареждане");
    } finally {
      setLoading(false);
    }
  }, [fetchClients]);

  useEffect(() => {
    void load();
  }, [load]);

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    const sd = s.replace(/\D/g, "");
    let rows = clients.filter(
      (c) =>
        !s ||
        c.full_name.toLowerCase().includes(s) ||
        (sd.length > 0 && (c.phone ?? "").replace(/\D/g, "").includes(sd)),
    );
    if (filter === "newest")
      rows = [...rows].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return rows;
  }, [clients, q, filter]);

  const sale = searched.filter((c) => !isRent(c));
  const rent = searched.filter(isRent);
  const saleCount = clients.filter((c) => !isRent(c)).length;
  const rentCount = clients.filter(isRent).length;
  const selected = clients.find((c) => c.id === selectedId) ?? null;

  const onSaved = (row: Client) => {
    setEditing(null);
    void load();
    if (row?.id) setSelectedId(row.id);
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden" style={{ ...COND, color: C.navy }}>
      {/* background photo + white veil */}
      <div className="fixed inset-0 -z-10">
        <img src={cityShumen} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-white/[0.86]" />
      </div>

      <Sidebar />

      <main className="min-h-screen lg:ml-[200px]">
        {/* HERO */}
        <header className="relative h-[210px] overflow-hidden">
          <img src={cityShumen} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_35%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-white/35 to-white/90" />
          <div className="relative flex h-full items-center px-6 xl:px-10">
            <img src={logoBrush} alt="Имоти Надежда" className="hidden h-[150px] w-auto object-contain md:block" />
            <div className="relative mx-auto flex h-[170px] w-[min(640px,70%)] flex-col items-center justify-center">
              <Brush src={brushBurgundy} />
              <h1 className="relative text-6xl leading-none text-white drop-shadow md:text-7xl" style={SCRIPT}>
                Клиенти
              </h1>
              <p className="relative mt-2 text-base font-semibold tracking-wide text-white/95 md:text-lg">
                Хората зад всеки успешен имот!
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="relative flex h-[62px] w-[200px] shrink-0 items-center justify-center gap-2 text-lg font-extrabold text-white transition hover:scale-[1.03]"
            >
              <Brush src={brushBurgundy} />
              <Plus className="relative h-5 w-5" strokeWidth={3} />
              <span className="relative">Нов клиент</span>
            </button>
          </div>
        </header>

        {/* TOOLBAR */}
        <div className="flex flex-col gap-4 px-6 py-5 xl:flex-row xl:items-center xl:px-10">
          <label className="relative flex h-[64px] flex-1 items-center px-8 drop-shadow-[0_6px_14px_rgba(12,45,90,0.15)]">
            <Brush src={brushWhite} />
            <Search className="relative mr-3 h-5 w-5" style={{ color: C.burg }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Търси клиент по име или телефон..."
              className="relative w-full bg-transparent text-lg font-semibold outline-none placeholder:text-slate-400"
              style={{ color: C.navy }}
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="relative" aria-label="Изчисти">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "Всички"],
                ["sale", `Продажби (${saleCount})`],
                ["rent", `Наеми (${rentCount})`],
                ["newest", "Най-нови"],
              ] as [Filter, string][]
            ).map(([k, label]) => {
              const active = filter === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={`relative h-[54px] min-w-[120px] px-6 text-base font-extrabold transition ${active ? "text-white" : "hover:scale-[1.03]"}`}
                  style={{ color: active ? "#fff" : C.navy }}
                >
                  <Brush src={active ? brushBurgundy : brushWhite} className={active ? "" : "drop-shadow-[0_3px_8px_rgba(12,45,90,0.18)]"} />
                  <span className="relative">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mx-6 mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 font-semibold text-red-800 xl:mx-10">
            {error}
          </div>
        )}

        {loading ? (
          <p className="px-10 py-10 text-lg font-bold">Зареждане на клиентите…</p>
        ) : (
          <div className="space-y-6 px-6 pb-12 xl:px-10">
            {filter !== "rent" && (
              <ClientSection
                title="Клиенти – Продажби"
                icon={<Home className="h-7 w-7" />}
                rows={sale}
                expanded={expand.sale}
                onToggle={() => setExpand((e) => ({ ...e, sale: !e.sale }))}
                onOpen={setSelectedId}
              />
            )}
            {filter !== "sale" && (
              <ClientSection
                title="Клиенти – Наеми"
                icon={<Key className="h-7 w-7" />}
                rows={rent}
                expanded={expand.rent}
                onToggle={() => setExpand((e) => ({ ...e, rent: !e.rent }))}
                onOpen={setSelectedId}
              />
            )}
          </div>
        )}
      </main>

      {selected && (
        <ClientDetail
          client={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditing(selected)}
          onSaveNote={async (note) => {
            const row = await saveClient({ data: toPayload(selected, { notes: note }) });
            setClients((cs) => cs.map((c) => (c.id === selected.id ? { ...c, notes: (row as Client).notes } : c)));
          }}
        />
      )}

      {editing && (
        <ClientForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

function toPayload(c: Client, over: Partial<Client> = {}) {
  const m = { ...c, ...over };
  return {
    id: m.id,
    full_name: m.full_name,
    phone: m.phone,
    email: m.email ?? "",
    client_type: m.client_type as "buyer" | "seller" | "tenant" | "landlord",
    status: m.status as "active" | "inactive" | "closed",
    search_city_id: m.search_city_id,
    search_quarter_id: m.search_quarter_id,
    search_property_type: m.search_property_type,
    search_status: (m.search_status as "sale" | "rent" | null) ?? null,
    budget_min: m.budget_min,
    budget_max: m.budget_max,
    currency: m.currency ?? "EUR",
    rooms_min: m.rooms_min,
    rooms_max: m.rooms_max,
    area_min: m.area_min,
    area_max: m.area_max,
    notes: m.notes,
    assigned_broker_id: m.assigned_broker_id,
  };
}

/* ------------------------------------------------------------------ */
const NAV: { label: string; href: string; icon: typeof Home; active?: boolean }[] = [
  { label: "Начало", href: "/admin", icon: LayoutDashboard },
  { label: "Клиенти", href: "/crm/clients", icon: Users, active: true },
  { label: "Имоти", href: "/admin/properties", icon: Building2 },
  { label: "Сделки", href: "/admin/deals", icon: Briefcase },
  { label: "Документи", href: "/admin/documents", icon: FileText },
  { label: "Комуникация", href: "/admin/chat", icon: MessagesSquare },
  { label: "Календар", href: "/admin/calendar", icon: CalendarDays },
  { label: "Задачи", href: "/admin/tasks", icon: ListTodo },
  { label: "Качи имот", href: "/admin/properties", icon: Upload },
  { label: "Банка", href: "/admin/bank-rates", icon: Wallet },
  { label: "AI Асистент", href: "/admin/ai", icon: Bot },
  { label: "Настройки", href: "/admin/settings", icon: Settings },
];

function Sidebar() {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-[200px] flex-col overflow-hidden lg:flex"
      style={{ background: `linear-gradient(180deg, ${C.deep} 0%, #5a0010 60%, #3f000b 100%)` }}
    >
      <div className="relative mx-3 mt-4 flex h-[118px] flex-col items-center justify-center text-center">
        <Brush src={brushWhite} />
        <span className="relative text-[26px] leading-none" style={{ ...SCRIPT, color: C.burg }}>Имоти Надежда</span>
        <span className="relative mt-1 text-[11px] font-bold" style={{ color: C.navy }}>
          Доверието днес – Домът утре!
        </span>
      </div>
      <nav className="relative z-10 mt-4 flex flex-col gap-0.5 px-2">
        {NAV.map((n) => (
          <a
            key={n.label}
            href={n.href}
            className={`relative flex h-[42px] items-center gap-3 px-4 text-[15px] font-bold text-white transition ${n.active ? "" : "opacity-90 hover:bg-white/10"}`}
          >
            {n.active && <Brush src={brushBurgundy} className="scale-x-110 brightness-125" />}
            <n.icon className="relative h-[18px] w-[18px]" />
            <span className="relative">{n.label}</span>
          </a>
        ))}
      </nav>
      <div className="relative mt-auto h-[220px]">
        <img src={architecture} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, #5a0010 0%, rgba(90,0,16,0.3) 55%, rgba(63,0,11,0.6) 100%)` }} />
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
function ClientSection({
  title,
  icon,
  rows,
  expanded,
  onToggle,
  onOpen,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Client[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
}) {
  const shown = expanded ? rows : rows.slice(0, 4);
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="relative flex h-[70px] w-[min(480px,90%)] items-center gap-3 px-10 text-white">
          <Brush src={brushBurgundy} />
          <span className="relative">{icon}</span>
          <h2 className="relative text-3xl font-black tracking-tight">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-lg font-extrabold hover:underline"
          style={{ color: C.burg }}
        >
          {expanded ? "Покажи по-малко" : `Виж всички (${rows.length})`} <ArrowRight className="h-5 w-5" />
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-lg font-semibold text-slate-500">Няма клиенти по тези критерии.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {shown.map((c) => (
            <ClientCard key={c.id} c={c} onOpen={() => onOpen(c.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function ClientCard({ c, onOpen }: { c: Client; onOpen: () => void }) {
  const place = [c.cities?.name, c.quarters?.name].filter(Boolean).join(", ") || "Без локация";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative h-[190px] w-full text-left drop-shadow-[0_10px_18px_rgba(12,45,90,0.16)] transition hover:-translate-y-1"
    >
      <Brush src={cardWhite} />
      {/* burgundy accent strip on edge */}
      <div className="pointer-events-none absolute -left-1 top-5 h-[40px] w-[26px] opacity-90">
        <Brush src={brushBurgundy} />
      </div>
      <div className="absolute inset-y-4 right-4 w-[44%] overflow-hidden">
        <img src={clientPhoto(c)} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent" />
      </div>
      <div className="relative flex h-full flex-col justify-center py-5 pl-8 pr-[40%]">
        <p className="truncate text-[21px] font-black leading-tight" style={{ color: C.navy }}>{c.full_name}</p>
        <p className="mt-0.5 text-[16px] font-extrabold" style={{ color: C.burg }}>{c.phone || "—"}</p>
        <div className="mt-2 space-y-1 text-[13px] font-semibold" style={{ color: C.navy }}>
          <p className="flex items-center gap-1.5 truncate">
            <Home className="h-3.5 w-3.5 shrink-0" style={{ color: C.burg }} />
            {PROP_LABEL[c.search_property_type ?? ""] ?? TYPE_LABEL[c.client_type] ?? "Имот"}
          </p>
          <p className="flex items-center gap-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: C.burg }} />
            {place}
          </p>
          <p className="flex items-center gap-1.5 truncate">
            <Banknote className="h-3.5 w-3.5 shrink-0" style={{ color: C.burg }} />
            {budgetText(c)}
          </p>
        </div>
      </div>
      <span
        className="absolute bottom-4 right-5 grid h-10 w-10 place-items-center rounded-full text-white shadow-lg transition group-hover:scale-110"
        style={{ background: C.burg }}
      >
        <ArrowRight className="h-5 w-5" />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
type Tab = "info" | "props" | "deals" | "docs" | "notes" | "comm" | "more";

function ClientDetail({
  client: c,
  onClose,
  onEdit,
  onSaveNote,
}: {
  client: Client;
  onClose: () => void;
  onEdit: () => void;
  onSaveNote: (note: string) => Promise<void>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("info");
  const [fs, setFs] = useState(false);
  const [counts, setCounts] = useState<{ props: number; deals: number }>({ props: 0, deals: 0 });
  const [matches, setMatches] = useState<{ id: string; score: number; status: string; properties: { id: string; title: string; price: number; currency: string } | null }[]>([]);
  const [tasks, setTasks] = useState<{ id: string; title: string; is_completed: boolean; due_at: string | null; created_at: string }[]>([]);
  const fetchDocs = useServerFn(getClientDocuments);
  const [docs, setDocs] = useState<{ id: string; file_name: string; file_url: string; document_type: string; created_at: string }[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.fullscreenElement && onClose();
    const onFs = () => setFs(!!document.fullscreenElement);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [onClose]);

  useEffect(() => {
    let off = false;
    void (async () => {
      const [m, t] = await Promise.all([
        supabase
          .from("property_matches")
          .select("id, score, status, properties:property_id(id, title, price, currency)")
          .eq("client_id", c.id)
          .order("score", { ascending: false }),
        supabase
          .from("broker_tasks")
          .select("id, title, is_completed, due_at, created_at")
          .eq("client_id", c.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (off) return;
      const mm = (m.data ?? []) as unknown as typeof matches;
      setMatches(mm);
      setTasks((t.data ?? []) as typeof tasks);
      setCounts({ props: mm.length, deals: c.deal_stage ? 1 : 0 });
    })();
    return () => {
      off = true;
    };
  }, [c.id, c.deal_stage]);

  useEffect(() => {
    if (tab !== "docs" || docs) return;
    fetchDocs({ data: { client_id: c.id } })
      .then((r) => setDocs(r as typeof docs))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Грешка");
        setDocs([]);
      });
  }, [tab, docs, c.id, fetchDocs]);

  const toggleFs = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      toast.error("Браузърът не позволи цял екран");
    }
  };
  const close = async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    onClose();
  };

  const rent = isRent(c);
  const wa = digits(c.phone);
  const shortId = c.id.slice(0, 6).toUpperCase();
  const place = [c.cities?.name, c.quarters?.name].filter(Boolean).join(", ");

  const TABS: [Tab, string][] = [
    ["info", "Информация"],
    ["props", `Имоти (${counts.props})`],
    ["deals", `Сделки (${counts.deals})`],
    ["docs", "Документи"],
    ["notes", "Бележки"],
    ["comm", "Комуникация"],
    ["more", "Още"],
  ];

  const activity = [
    { color: C.green, text: "Регистриран в CRM", at: c.created_at },
    ...(c.updated_at !== c.created_at ? [{ color: C.gold, text: "Профилът е обновен", at: c.updated_at }] : []),
    ...tasks.map((t) => ({ color: t.is_completed ? C.green : "#2F80ED", text: `Задача: ${t.title}`, at: t.created_at })),
    ...matches.slice(0, 3).map((m) => ({ color: C.burg, text: `Съвпадение: ${m.properties?.title ?? "имот"} (${m.score}%)`, at: c.updated_at })),
  ]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 6);

  return (
    <div ref={rootRef} className="fixed inset-0 z-50 overflow-y-auto bg-[#f7f3ee]" style={{ ...COND, color: C.navy }}>
      {/* HEADER */}
      <header className="relative h-auto min-h-[280px] overflow-hidden bg-gradient-to-br from-white via-[#faf7f2] to-[#efe8df]">
        <img src={officePhoto} alt="" className="absolute inset-y-0 right-0 hidden h-full w-[42%] object-cover md:block" />
        <div className="absolute inset-y-0 right-0 hidden w-[48%] bg-gradient-to-r from-[#faf7f2] via-[#faf7f2]/50 to-transparent md:block" />
        <div className="absolute right-5 top-5 z-10 flex gap-2">
          <button type="button" onClick={toggleFs} aria-label="Цял екран" className="grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow" style={{ color: C.burg }}>
            {fs ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
          <button type="button" onClick={close} aria-label="Затвори" className="grid h-11 w-11 place-items-center rounded-full text-white shadow" style={{ background: C.burg }}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative flex min-h-[280px] w-full max-w-[900px] flex-col justify-center py-10 pl-10 pr-16 md:pl-14">
          <Brush src={brushBurgundy} />
          <p className="relative text-sm font-bold tracking-widest text-white/85">КЛИЕНТ #{shortId}</p>
          <h1 className="relative mt-1 text-4xl font-black leading-tight text-white md:text-[46px]">
            {c.full_name}
            {c.phone && <span className="font-extrabold text-white/95"> - {c.phone}</span>}
          </h1>
          <div className="relative mt-4 flex flex-wrap gap-2 text-sm font-extrabold">
            <span className="rounded-full px-4 py-1.5 text-white" style={{ background: c.status === "active" ? C.green : "#7a7a7a" }}>
              {c.status === "active" ? "Активен клиент" : STATUS_LABEL[c.status] ?? c.status}
            </span>
            {(c.budget_max ?? 0) >= 200000 && (
              <span className="rounded-full px-4 py-1.5" style={{ background: C.gold, color: "#3a2400" }}>VIP</span>
            )}
            <span className="rounded-full bg-sky-100 px-4 py-1.5 text-sky-800">{rent ? "Наема" : "Купува"}</span>
          </div>
        </div>
        <p className="absolute bottom-6 right-10 hidden text-4xl drop-shadow md:block" style={{ ...SCRIPT, color: C.burg }}>
          Доверието днес – Домът утре!
        </p>
      </header>

      {/* TABS */}
      <nav className="flex flex-wrap gap-1 border-b-2 bg-white px-6 md:px-10" style={{ borderColor: `${C.burg}33` }}>
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`relative h-[56px] px-6 text-lg font-extrabold ${tab === k ? "text-white" : "hover:text-[#980018]"}`}
          >
            {tab === k && <Brush src={brushBurgundy} />}
            <span className="relative">{label}</span>
          </button>
        ))}
      </nav>

      <div className="px-6 py-6 md:px-10">
        {tab === "info" && (
          <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr_1fr]">
            <Panel title="Основна информация">
              <div className="grid grid-cols-[1fr_auto] gap-4">
                <dl className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-2.5 text-[16px]">
                  <Row k="Тип клиент" v={TYPE_LABEL[c.client_type] ?? c.client_type} />
                  <Row k="Статус" v={STATUS_LABEL[c.status] ?? c.status} />
                  <Row k="Град" v={c.cities?.name ?? "—"} />
                  <Row k="Квартали" v={c.quarters?.name ?? "—"} />
                  <Row k="Бюджет" v={budgetText(c)} />
                  <Row k="Източник" v={c.brokers?.full_name ? `Брокер: ${c.brokers.full_name}` : "CRM"} />
                  <Row k="Дата на регистрация" v={fmtDate(c.created_at)} />
                  <Row k="Бележки" v={c.notes || "—"} />
                </dl>
                <div className="relative hidden w-[180px] overflow-hidden md:block">
                  <img src={livingRoom} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                </div>
              </div>
            </Panel>
            <Panel
              title="Предпочитания"
              action={
                <button type="button" onClick={onEdit} className="flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-extrabold text-white" style={{ background: C.burg }}>
                  <Pencil className="h-4 w-4" /> Редактирай
                </button>
              }
            >
              <ul className="space-y-2 text-[16px] font-semibold">
                {[
                  ["Апартамент", c.search_property_type === "apartment"],
                  ["Къща", c.search_property_type === "house"],
                  ["Ново строителство", /ново строителство/i.test(c.notes ?? "")],
                  ["Обзаведен", /обзаведен/i.test(c.notes ?? "")],
                  ["Паркомясто", /паркомясто|гараж/i.test(c.notes ?? "")],
                ].map(([l, on]) => (
                  <li key={l as string} className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded border-2" style={{ borderColor: C.burg, background: on ? C.burg : "transparent" }}>
                      {on && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </span>
                    {l}
                  </li>
                ))}
              </ul>
              <hr className="my-4" style={{ borderColor: `${C.burg}33` }} />
              <dl className="grid grid-cols-[90px_1fr] gap-y-2 text-[16px]">
                <Row k="Бюджет" v={budgetText(c)} />
                <Row k="Площ" v={c.area_min || c.area_max ? `${c.area_min ?? "?"} – ${c.area_max ?? "?"} м²` : "—"} />
                <Row k="Етаж" v="—" />
                <Row k="Други" v={c.rooms_min || c.rooms_max ? `Стаи: ${c.rooms_min ?? "?"}–${c.rooms_max ?? "?"}` : "—"} />
              </dl>
            </Panel>
            <div className="space-y-6">
              <Panel title="Последна активност">
                <ol className="space-y-3">
                  {activity.map((a, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: a.color }} />
                      <div>
                        <p className="text-[15px] font-bold leading-tight">{a.text}</p>
                        <p className="text-xs font-semibold text-slate-500">{fmtDate(a.at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Panel>
              <QuickNote initial={c.notes ?? ""} onSave={onSaveNote} title="Бърза бележка" />
            </div>
          </div>
        )}

        {tab === "props" && (
          <Panel title="Подходящи имоти">
            {matches.length === 0 ? (
              <EmptyAction text="Няма свързани имоти за този клиент." href="/admin/matching" label="Отвори съвпадения" />
            ) : (
              <ul className="divide-y">
                {matches.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-3 text-[16px]">
                    <span className="font-bold">{m.properties?.title ?? "Имот"}</span>
                    <span className="font-extrabold" style={{ color: C.burg }}>
                      {money(m.properties?.price, m.properties?.currency)} · {m.score}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {tab === "deals" && (
          <Panel title="Сделки">
            {c.deal_stage ? (
              <p className="text-lg font-bold">Текущ етап: <span style={{ color: C.burg }}>{c.deal_stage}</span></p>
            ) : (
              <EmptyAction text="Няма активна сделка." href="/admin/deals" label="Отвори сделки" />
            )}
          </Panel>
        )}

        {tab === "docs" && (
          <Panel title="Документи">
            {docs === null ? (
              <p>Зареждане…</p>
            ) : docs.length === 0 ? (
              <EmptyAction text="Няма качени документи." href="/admin/clients" label="Качи от картата на клиента" />
            ) : (
              <ul className="divide-y">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-3">
                    <a href={d.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-bold hover:underline">
                      <FileText className="h-4 w-4" style={{ color: C.burg }} /> {d.file_name}
                    </a>
                    <span className="text-sm text-slate-500">{d.document_type} · {fmtDate(d.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {tab === "notes" && <QuickNote initial={c.notes ?? ""} onSave={onSaveNote} title="Бележки" tall />}

        {tab === "comm" && (
          <Panel title="Комуникация">
            <div className="grid gap-3 sm:grid-cols-3">
              <ContactLink href={c.phone ? `tel:${c.phone}` : undefined} icon={Phone} label={c.phone ?? "Няма телефон"} />
              <ContactLink href={c.email ? `mailto:${c.email}` : undefined} icon={Mail} label={c.email ?? "Няма имейл"} />
              <ContactLink href={wa ? `https://wa.me/${wa}` : undefined} icon={MessageCircle} label="WhatsApp" external />
            </div>
          </Panel>
        )}

        {tab === "more" && (
          <Panel title="Още">
            <div className="flex flex-wrap gap-3">
              <a href="/admin/clients" className="rounded-full px-5 py-2.5 font-extrabold text-white" style={{ background: C.burg }}>Пълна карта на клиента</a>
              <a href="/admin/contracts" className="rounded-full border-2 px-5 py-2.5 font-extrabold" style={{ borderColor: C.burg, color: C.burg }}>Договори</a>
              <button type="button" onClick={onEdit} className="rounded-full border-2 px-5 py-2.5 font-extrabold" style={{ borderColor: C.burg, color: C.burg }}>Редактирай клиента</button>
            </div>
          </Panel>
        )}
      </div>

      {/* ACTION BAR */}
      <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t bg-white/95 px-6 py-4 backdrop-blur sm:grid-cols-3 md:px-10 xl:grid-cols-6">
        <ActionBtn href={c.phone ? `tel:${c.phone}` : undefined} icon={Phone} label="Обади се" />
        <ActionBtn href={c.email ? `mailto:${c.email}` : undefined} icon={Mail} label="Изпрати имейл" />
        <ActionBtn href={wa ? `https://wa.me/${wa}` : undefined} icon={MessageCircle} label="WhatsApp" external />
        <ActionBtn href="/admin/viewings" icon={CalendarPlus} label="Насрочи среща" />
        <ActionBtn href="/admin/properties" icon={Building2} label="Добави имот" />
        <ActionBtn href="/admin/tasks" icon={CheckSquare} label="Създай задача" />
      </div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="relative bg-white p-6 shadow-[0_10px_30px_rgba(12,45,90,0.10)]" style={{ borderTop: `4px solid ${C.burg}` }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-2xl font-black" style={{ color: C.navy }}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="font-bold text-slate-500">{k}</dt>
      <dd className="font-extrabold" style={{ color: C.navy }}>{v}</dd>
    </>
  );
}
function EmptyAction({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <p className="text-lg font-semibold text-slate-500">{text}</p>
      <a href={href} className="rounded-full px-5 py-2 font-extrabold text-white" style={{ background: C.burg }}>{label}</a>
    </div>
  );
}
function ContactLink({ href, icon: I, label, external }: { href?: string; icon: typeof Phone; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel="noreferrer"
      aria-disabled={!href}
      className={`flex items-center gap-2 border-2 px-4 py-3 font-bold ${href ? "" : "pointer-events-none opacity-50"}`}
      style={{ borderColor: `${C.burg}55` }}
    >
      <I className="h-5 w-5" style={{ color: C.burg }} /> {label}
    </a>
  );
}
function ActionBtn({ href, icon: I, label, external }: { href?: string; icon: typeof Phone; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel="noreferrer"
      aria-disabled={!href}
      className={`relative flex h-[56px] items-center justify-center gap-2 text-[16px] font-extrabold text-white transition hover:scale-[1.03] ${href ? "" : "pointer-events-none opacity-50"}`}
    >
      <Brush src={brushDeep} />
      <I className="relative h-5 w-5" />
      <span className="relative">{label}</span>
    </a>
  );
}

function QuickNote({ initial, onSave, title, tall }: { initial: string; onSave: (n: string) => Promise<void>; title: string; tall?: boolean }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => setV(initial), [initial]);
  return (
    <Panel title={title}>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        rows={tall ? 12 : 4}
        maxLength={4000}
        placeholder="Напишете бележка за клиента…"
        className="w-full resize-y border-2 p-3 text-[15px] font-semibold outline-none focus:border-[#980018]"
        style={{ borderColor: `${C.burg}33` }}
      />
      <button
        type="button"
        disabled={busy || v === initial}
        onClick={async () => {
          setBusy(true);
          try {
            await onSave(v);
            toast.success("Бележката е запазена");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Грешка при запис");
          } finally {
            setBusy(false);
          }
        }}
        className="mt-3 rounded-full px-6 py-2 font-extrabold text-white disabled:opacity-50"
        style={{ background: C.burg }}
      >
        {busy ? "Запис…" : "Запази"}
      </button>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
function ClientForm({ initial, onClose, onSaved }: { initial: Client | null; onClose: () => void; onSaved: (c: Client) => void }) {
  const save = useServerFn(upsertClient);
  const [busy, setBusy] = useState(false);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [quarters, setQuarters] = useState<{ id: string; name: string; city_id: string }[]>([]);
  const [f, setF] = useState({
    full_name: initial?.full_name ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    client_type: initial?.client_type ?? "buyer",
    status: initial?.status ?? "active",
    search_status: initial?.search_status ?? "",
    search_property_type: initial?.search_property_type ?? "",
    search_city_id: initial?.search_city_id ?? "",
    search_quarter_id: initial?.search_quarter_id ?? "",
    budget_min: initial?.budget_min?.toString() ?? "",
    budget_max: initial?.budget_max?.toString() ?? "",
    area_min: initial?.area_min?.toString() ?? "",
    area_max: initial?.area_max?.toString() ?? "",
    notes: initial?.notes ?? "",
  });
  useEffect(() => {
    void supabase.from("cities").select("id, name").order("display_order").then(({ data }) => setCities(data ?? []));
    void supabase.from("quarters").select("id, name, city_id").order("name").then(({ data }) => setQuarters(data ?? []));
  }, []);
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const row = await save({
        data: {
          ...(initial ? toPayload(initial) : {}),
          id: initial?.id ?? null,
          full_name: f.full_name.trim(),
          phone: f.phone.trim() || null,
          email: f.email.trim(),
          client_type: f.client_type as "buyer",
          status: f.status as "active",
          search_status: (f.search_status || null) as "sale" | null,
          search_property_type: f.search_property_type || null,
          search_city_id: f.search_city_id || null,
          search_quarter_id: f.search_quarter_id || null,
          budget_min: num(f.budget_min),
          budget_max: num(f.budget_max),
          area_min: num(f.area_min),
          area_max: num(f.area_max),
          currency: initial?.currency ?? "EUR",
          notes: f.notes || null,
        },
      });
      toast.success(initial ? "Клиентът е обновен" : "Клиентът е създаден");
      onSaved(row as unknown as Client);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Грешка при запис");
    } finally {
      setBusy(false);
    }
  };

  const inp = "h-11 w-full border-2 px-3 text-[15px] font-semibold outline-none focus:border-[#980018]";
  const bs = { borderColor: `${C.burg}33` };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" style={COND} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto bg-white p-8 shadow-2xl" style={{ borderTop: `6px solid ${C.burg}`, color: C.navy }}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-3xl font-black">{initial ? "Редакция на клиент" : "Нов клиент"}</h2>
          <button type="button" onClick={onClose} aria-label="Затвори"><X className="h-6 w-6" /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <L t="Име *"><input required minLength={2} value={f.full_name} onChange={set("full_name")} className={inp} style={bs} /></L>
          <L t="Телефон"><input value={f.phone} onChange={set("phone")} className={inp} style={bs} /></L>
          <L t="Имейл"><input type="email" value={f.email} onChange={set("email")} className={inp} style={bs} /></L>
          <L t="Тип клиент">
            <select value={f.client_type} onChange={set("client_type")} className={inp} style={bs}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </L>
          <L t="Статус">
            <select value={f.status} onChange={set("status")} className={inp} style={bs}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </L>
          <L t="Търси">
            <select value={f.search_status} onChange={set("search_status")} className={inp} style={bs}>
              <option value="">—</option><option value="sale">Продажба</option><option value="rent">Наем</option>
            </select>
          </L>
          <L t="Вид имот">
            <select value={f.search_property_type} onChange={set("search_property_type")} className={inp} style={bs}>
              <option value="">—</option>
              {Object.entries(PROP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </L>
          <L t="Град">
            <select value={f.search_city_id} onChange={(e) => setF((p) => ({ ...p, search_city_id: e.target.value, search_quarter_id: "" }))} className={inp} style={bs}>
              <option value="">—</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </L>
          <L t="Квартал">
            <select value={f.search_quarter_id} onChange={set("search_quarter_id")} className={inp} style={bs}>
              <option value="">—</option>
              {quarters.filter((q) => !f.search_city_id || q.city_id === f.search_city_id).map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
            </select>
          </L>
          <div className="grid grid-cols-2 gap-2">
            <L t="Бюджет от €"><input type="number" value={f.budget_min} onChange={set("budget_min")} className={inp} style={bs} /></L>
            <L t="до €"><input type="number" value={f.budget_max} onChange={set("budget_max")} className={inp} style={bs} /></L>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <L t="Площ от м²"><input type="number" value={f.area_min} onChange={set("area_min")} className={inp} style={bs} /></L>
            <L t="до м²"><input type="number" value={f.area_max} onChange={set("area_max")} className={inp} style={bs} /></L>
          </div>
          <L t="Бележки" full><textarea rows={3} value={f.notes} onChange={set("notes")} className="w-full border-2 p-3 font-semibold outline-none" style={bs} /></L>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border-2 px-6 py-2.5 font-extrabold" style={{ borderColor: C.burg, color: C.burg }}>Отказ</button>
          <button type="submit" disabled={busy} className="rounded-full px-8 py-2.5 font-extrabold text-white disabled:opacity-60" style={{ background: C.burg }}>
            {busy ? "Запис…" : "Запази"}
          </button>
        </div>
      </form>
    </div>
  );
}
function L({ t, children, full }: { t: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-sm font-bold text-slate-600">{t}</span>
      {children}
    </label>
  );
}
