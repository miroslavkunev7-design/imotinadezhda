import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil, X, Upload, FileText, Phone, MapPin, AlertTriangle, Sparkles, Camera, Folder, ArrowLeft, Home, Building2, Trees, Store, Landmark } from "lucide-react";
import { listClients, listBrokers, upsertClient, deleteClient, getClientDocuments, addClientDocument, deleteClientDocument, updateClientDeal } from "@/lib/crm.functions";
import { MortgageStagesModal } from "@/components/admin/mortgage-stages-modal";
import { ClientDetailsSheet } from "@/components/admin/client-details-sheet";
import { LeadScoreBadge } from "@/components/admin/lead-score-badge";
import { ClientScanModal } from "@/components/admin/client-scan-modal";
import { BankMortgageDesk } from "@/components/admin/bank-mortgage-desk";
import { isStartedDeal, DEAL_SUBS, docBucket, bankFileLabel } from "@/lib/started-deals";
import dealsFolderImg from "@/assets/crm/crm-opt-mortgage.png";
import { useAuth } from "@/hooks/use-auth";
import cityBurgas from "@/assets/city-burgas.jpeg";
import cityVarna from "@/assets/city-varna.jpeg";
import cityShumen from "@/assets/city-shumen.jpeg";
import clientBuyer from "@/assets/client-buyer.jpg";
import clientSeller from "@/assets/client-seller.jpg";
import clientTenant from "@/assets/client-tenant.jpg";
import clientLandlord from "@/assets/client-landlord.jpg";


export const Route = createFileRoute("/admin/clients")({
  component: ClientsAdmin,
});

type Client = any;

const CITY_FALLBACK: Record<string, string> = { burgas: cityBurgas, varna: cityVarna, shumen: cityShumen };

const TYPE_META: Record<string, { label: string; desc: string; image: string }> = {
  seller:   { label: "Продавачи",  desc: "Собственици, продаващи имот",  image: clientSeller },
  landlord: { label: "Наемодатели", desc: "Отдават под наем",             image: clientLandlord },
  tenant:   { label: "Наематели",   desc: "Търсят имот под наем",         image: clientTenant },
  buyer:    { label: "Купувачи",    desc: "Търсят имот за покупка",       image: clientBuyer },
};
const TYPE_ORDER = ["seller", "landlord", "tenant", "buyer"] as const;

type PropKey = "apt1" | "apt2" | "apt3" | "apt4plus" | "house" | "office" | "land" | "commercial";
const PROP_META: { key: PropKey; label: string; icon: any }[] = [
  { key: "apt1",       label: "1-стаен",     icon: Home },
  { key: "apt2",       label: "2-стаен",     icon: Home },
  { key: "apt3",       label: "3-стаен",     icon: Home },
  { key: "apt4plus",   label: "4+ стаен",    icon: Home },
  { key: "house",      label: "Къща",        icon: Trees },
  { key: "office",     label: "Офис",        icon: Building2 },
  { key: "land",       label: "Парцел",      icon: Landmark },
  { key: "commercial", label: "Търговски",   icon: Store },
];

function matchesPropKey(r: any, pt: PropKey | null): boolean {
  if (!pt) return true;
  if (pt === "house" || pt === "office" || pt === "land" || pt === "commercial") {
    return r.search_property_type === pt;
  }
  // apartment buckets
  if (r.search_property_type && r.search_property_type !== "apartment") return false;
  const mn = r.rooms_min ?? null;
  const mx = r.rooms_max ?? null;
  if (mn == null && mx == null) return true;
  if (pt === "apt4plus") {
    return (mx == null ? true : mx >= 4) && (mn == null ? true : true);
  }
  const n = Number(pt.replace("apt", ""));
  return (mn == null || mn <= n) && (mx == null || mx >= n);
}

type SortKey = "newest" | "name" | "score" | "stage";

function clientHaystack(r: { full_name?: string; phone?: string | null; email?: string | null }) {
  return `${r.full_name ?? ""} ${r.phone ?? ""} ${r.email ?? ""}`.toLowerCase();
}

function stageWeight(r: { deal_stage?: string | null }) {
  if (r.deal_stage === "mortgage") return 0;
  if (r.deal_stage === "started") return 1;
  if (r.deal_stage === "closed") return 3;
  return 2;
}

function sortClients(list: any[], sortBy: SortKey) {
  const copy = [...list];
  copy.sort((a, b) => {
    if (sortBy === "name") return String(a.full_name ?? "").localeCompare(String(b.full_name ?? ""), "bg");
    if (sortBy === "score") return (Number(b.lead_score) || -1) - (Number(a.lead_score) || -1);
    if (sortBy === "stage") return stageWeight(a) - stageWeight(b);
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });
  return copy;
}

function ClientsAdmin() {
  const [rows, setRows] = useState<Client[]>([]);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [quarters, setQuarters] = useState<{ id: string; name: string; slug?: string; city_id: string; image_url?: string | null }[]>([]);
  const [citiesFull, setCitiesFull] = useState<Array<{ id: string; name: string; slug: string; hero_image_url: string | null }>>([]);
  const [brokers, setBrokers] = useState<{ id: string; full_name: string; user_id: string | null }[]>([]);
  const [editing, setEditing] = useState<Partial<Client> | null>(null);
  const [docsFor, setDocsFor] = useState<Client | null>(null);
  const [mortgageFor, setMortgageFor] = useState<Client | null>(null);
  const [mortgageStagesFor, setMortgageStagesFor] = useState<Client | null>(null);
  const [detailsFor, setDetailsFor] = useState<Client | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBroker, setFilterBroker] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [filterTier, setFilterTier] = useState("");
  const [filterNoBroker, setFilterNoBroker] = useState(false);
  const [filterDealChip, setFilterDealChip] = useState<"started" | "mortgage" | "">("");

  // Access control: brokers can only open clients assigned to them.
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [myBrokerId, setMyBrokerId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setMyBrokerId(null); return; }
    (async () => {
      const [{ data: roles }, { data: bk }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("brokers").select("id").eq("user_id", user.id).maybeSingle(),
      ]);
      const admin = (roles ?? []).some((r: any) => ["admin", "boss", "head_broker"].includes(r.role));
      setIsAdmin(admin);
      setMyBrokerId((bk as any)?.id ?? null);
    })();
  }, [user?.id]);

  const canAccessClient = (r: any) => isAdmin || (r.assigned_broker_id && r.assigned_broker_id === myBrokerId);
  const guard = (r: any, action: () => void) => {
    if (!canAccessClient(r)) { toast.error("Нямате достъп до този модул!"); return; }
    action();
  };

  const newClient = () => {
    if (!isAdmin) { toast.error("Нямате достъп до този модул!"); return; }
    setEditing({
      full_name: "", phone: "", email: "", client_type: "buyer", status: "active", currency: "EUR",
    });
  };

  // Folder navigation
  const [navCityId, setNavCityId] = useState<string | null>(null);
  const [navUnassigned, setNavUnassigned] = useState(false);
  const [navType, setNavType] = useState<string | null>(null);
  const [navQuarterId, setNavQuarterId] = useState<string | null>(null);
  const [navProp, setNavProp] = useState<PropKey | null>(null);
  const [navDeals, setNavDeals] = useState(false);
  const [dealClientId, setDealClientId] = useState<string | null>(null);
  const [dealSub, setDealSub] = useState<string | null>(null);
  const [dealDocs, setDealDocs] = useState<any[]>([]);
  const [bankDraft, setBankDraft] = useState({ worker: "", sent: "", progress: "" });

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoadError(null);
    const citiesQ = supabase.from("cities").select("id, name, slug, hero_image_url").order("display_order");
    const quartersQ = supabase.from("quarters").select("id, name, slug, city_id, image_url").order("name");

    const [clientsRes, citiesRes, quartersRes, brokersRes] = await Promise.allSettled([
      listClients(),
      citiesQ,
      quartersQ,
      listBrokers(),
    ]);

    if (clientsRes.status === "fulfilled") {
      setRows(clientsRes.value ?? []);
    } else {
      setRows([]);
      const msg = clientsRes.reason?.message ?? "Клиентите не се заредиха.";
      setLoadError(msg);
      toast.error(msg);
    }

    if (citiesRes.status === "fulfilled") {
      let cs = (citiesRes.value.data as any) ?? [];
      if (citiesRes.value.error || cs.length === 0) {
        const retry = await supabase.from("cities").select("id, name, slug, hero_image_url").order("name");
        if (!retry.error && retry.data?.length) cs = retry.data;
      }
      setCitiesFull(cs);
      setCities(cs.map((c: any) => ({ id: c.id, name: c.name })));
    } else {
      const retry = await supabase.from("cities").select("id, name, slug, hero_image_url").order("name");
      const cs = (retry.data as any) ?? [];
      setCitiesFull(cs);
      setCities(cs.map((c: any) => ({ id: c.id, name: c.name })));
    }

    if (quartersRes.status === "fulfilled") {
      setQuarters(((quartersRes.value.data as any) ?? []));
    }

    if (brokersRes.status === "fulfilled") {
      setBrokers((brokersRes.value ?? []).map((b: any) => ({ id: b.id, full_name: b.full_name, user_id: b.user_id ?? null })));
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const { cities: _c, quarters: _q, brokers: _b, created_at, updated_at, created_by, ...rest } = editing as any;
      await upsertClient({ data: rest });
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на клиента?")) return;
    try { await deleteClient({ data: { id } }); await load(); } catch (e: any) { toast.error(e.message); }
  };

  const filteredQuarters = editing?.search_city_id ? quarters.filter((q) => q.city_id === editing.search_city_id) : [];

  // Scoped rows by current folder level
  const scopedByCity     = rows.filter((r) => !navCityId  || r.search_city_id === navCityId);
  const scopedByType     = scopedByCity.filter((r) => !navType || r.client_type === navType);
  const scopedByQuarter  = scopedByType.filter((r) => !navQuarterId || r.search_quarter_id === navQuarterId);
  const scopedByProp     = scopedByQuarter.filter((r) => matchesPropKey(r, navProp));
  const unassignedRows   = rows.filter((r) => !r.search_city_id);
  const searchQ = search.trim().toLowerCase();
  const isSearching = searchQ.length > 0;

  const listSource = isSearching
    ? rows.filter((r) => clientHaystack(r).includes(searchQ))
    : navUnassigned
      ? unassignedRows
      : scopedByProp;

  const filtered = listSource.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterBroker && (r.assigned_broker_id ?? "") !== filterBroker) return false;
    if (filterTier && String(r.lead_tier ?? "") !== filterTier) return false;
    if (filterNoBroker && r.assigned_broker_id) return false;
    if (filterDealChip === "started" && r.deal_stage !== "started" && r.deal_stage !== "mortgage") return false;
    if (filterDealChip === "mortgage" && r.deal_stage !== "mortgage") return false;
    return true;
  });
  const sorted = sortClients(filtered, sortBy);

  const countCity     = (id: string) => rows.filter((r) => r.search_city_id === id).length;
  const countType     = (t: string)  => scopedByCity.filter((r) => r.client_type === t).length;
  const countQuarter  = (id: string) => scopedByType.filter((r) => r.search_quarter_id === id).length;
  const countProp     = (pk: PropKey) => scopedByQuarter.filter((r) => matchesPropKey(r, pk)).length;
  const countUnassigned = unassignedRows.length;

  const currentCity    = citiesFull.find((c) => c.id === navCityId) || null;
  const currentQuarter = quarters.find((q) => q.id === navQuarterId) || null;
  const cityImage = (c: { slug: string; hero_image_url: string | null }) => c.hero_image_url || CITY_FALLBACK[c.slug] || cityBurgas;

  const goHome     = () => { setNavCityId(null); setNavUnassigned(false); setNavType(null); setNavQuarterId(null); setNavProp(null); setNavDeals(false); setDealClientId(null); setDealSub(null); };
  const goCity     = () => { setNavType(null); setNavQuarterId(null); setNavProp(null); };
  const goType     = () => { setNavQuarterId(null); setNavProp(null); };
  const goQuarter  = () => { setNavProp(null); };

  const startedRows = rows.filter(isStartedDeal);
  const dealClient = rows.find((r) => r.id === dealClientId) ?? null;

  useEffect(() => {
    if (!dealClientId) { setDealDocs([]); return; }
    getClientDocuments({ data: { client_id: dealClientId } }).then(setDealDocs).catch(() => setDealDocs([]));
    const bc = (dealClient?.mortgage_data?.bank_case ?? {}) as any;
    setBankDraft({
      worker: bc.worker ?? "",
      sent: bc.sent ?? "",
      progress: bc.progress ?? "",
    });
  }, [dealClientId, dealClient?.mortgage_data]);

  const atLeaf = Boolean(navCityId && navType && navQuarterId && navProp);
  const showList = isSearching || navUnassigned || (atLeaf && !navDeals);
  const showFolders = !isSearching && !navUnassigned;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-200">
            Клиенти · папки
          </div>
          <h1 className="mt-2 font-display text-4xl text-amber-100">
            {isSearching ? "Търсене"
              : navDeals && dealClient && dealSub ? (DEAL_SUBS.find((s) => s.id === dealSub)?.label ?? dealSub)
              : navDeals && dealClient ? dealClient.full_name
              : navDeals ? "Започнати сделки"
              : navUnassigned ? "Без град"
              : atLeaf ? PROP_META.find(p => p.key === navProp)?.label
              : navQuarterId ? currentQuarter?.name
              : navType ? TYPE_META[navType]?.label
              : navCityId ? currentCity?.name
              : "Клиенти"}
          </h1>
          <p className="mt-1 text-sm text-amber-100/60">
            {isSearching ? `${sorted.length} резултат${sorted.length === 1 ? "" : "а"} за „${search.trim()}“`
              : navDeals ? `${startedRows.length} започнати сделки`
              : navUnassigned ? `${sorted.length} клиента без град`
              : atLeaf ? `${sorted.length} клиента в тази папка`
              : `${rows.length} записа общо`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Търси..." className="w-full sm:w-auto rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-100/40" />
          <Button onClick={() => setScanOpen(true)} variant="outline" className="border-amber-500/50 text-amber-100 hover:bg-amber-500/15">
            <Camera className="h-4 w-4" /> Сканирай
          </Button>
          <Link
            to="/admin/qualify"
            className="inline-flex items-center gap-2 rounded-md border border-amber-500/50 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/15"
          >
            <Sparkles className="h-4 w-4" /> Квалификация
          </Link>
          <Button onClick={newClient} className="gold-cta-button"><Plus className="h-4 w-4" /> Нов клиент</Button>
        </div>
      </header>

      {/* Breadcrumbs */}
      {!isSearching && (navCityId || navUnassigned || navType || navQuarterId || navProp || navDeals) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button onClick={goHome} className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-3 py-1.5 text-amber-100 hover:bg-amber-500/25">
            <ArrowLeft className="h-3.5 w-3.5" /> Назад
          </button>
          {navDeals ? (
            <>
              <button onClick={goHome} className="rounded-md px-2 py-1 text-amber-300 hover:text-amber-100">Клиенти</button>
              <span className="text-amber-100/40">›</span>
              <button onClick={() => { setDealClientId(null); setDealSub(null); }} className={`rounded-md px-2 py-1 ${!dealClientId ? "font-semibold text-amber-100" : "text-amber-300 hover:text-amber-100"}`}>Започнати сделки</button>
              {dealClient && (
                <>
                  <span className="text-amber-100/40">›</span>
                  <button onClick={() => setDealSub(null)} className={`rounded-md px-2 py-1 ${!dealSub ? "font-semibold text-amber-100" : "text-amber-300 hover:text-amber-100"}`}>{dealClient.full_name}</button>
                </>
              )}
              {dealSub && (
                <>
                  <span className="text-amber-100/40">›</span>
                  <span className="rounded-md px-2 py-1 font-semibold text-amber-100">{DEAL_SUBS.find((s) => s.id === dealSub)?.label}</span>
                </>
              )}
            </>
          ) : navUnassigned ? (
            <>
              <button onClick={goHome} className="rounded-md px-2 py-1 text-amber-300 hover:text-amber-100">Градове</button>
              <span className="text-amber-100/40">›</span>
              <span className="rounded-md px-2 py-1 font-semibold text-amber-100">Без град</span>
            </>
          ) : (
            <>
          <button onClick={goHome} className={`rounded-md px-2 py-1 ${!navCityId ? "font-semibold text-amber-100" : "text-amber-300 hover:text-amber-100"}`}>Градове</button>
          {currentCity && (<><span className="text-amber-100/40">›</span>
            <button onClick={goCity} className={`rounded-md px-2 py-1 ${!navType ? "font-semibold text-amber-100" : "text-amber-300 hover:text-amber-100"}`}>{currentCity.name}</button></>)}
          {navType && (<><span className="text-amber-100/40">›</span>
            <button onClick={goType} className={`rounded-md px-2 py-1 ${!navQuarterId ? "font-semibold text-amber-100" : "text-amber-300 hover:text-amber-100"}`}>{TYPE_META[navType]?.label}</button></>)}
          {currentQuarter && (<><span className="text-amber-100/40">›</span>
            <button onClick={goQuarter} className={`rounded-md px-2 py-1 ${!navProp ? "font-semibold text-amber-100" : "text-amber-300 hover:text-amber-100"}`}>{currentQuarter.name}</button></>)}
          {navProp && (<><span className="text-amber-100/40">›</span>
            <span className="rounded-md px-2 py-1 font-semibold text-amber-100">{PROP_META.find(p => p.key === navProp)?.label}</span></>)}
            </>
          )}
        </div>
      )}

      {/* Level 0: Cities + Започнати сделки */}
      {showFolders && !navCityId && !navDeals && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {loadError && (
            <div className="col-span-full rounded-2xl border border-rose-300 bg-white p-4 text-sm text-[#8B1A2B]">
              {loadError} Папките на градовете остават видими — отвори отново след малко, ако списъкът е празен.
            </div>
          )}
          {citiesFull.length === 0 && !loadError && (
            <div className="col-span-full rounded-2xl border border-amber-400/40 bg-white p-6 text-sm text-[#31020c]">
              Няма заредени градове. Провери връзката към базата или отвори „Градове“ в менюто.
            </div>
          )}
          {citiesFull.map((c) => (
            <button key={c.id} onClick={() => { setNavUnassigned(false); setNavCityId(c.id); }}
              className="crm-folder-card group relative block text-left transition hover:-translate-y-0.5 hover:shadow-2xl">
              <div className="relative h-48 overflow-hidden rounded-[4px_18px_18px_18px] ring-1 ring-black/10">
                <img src={cityImage(c)} alt={c.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="font-display text-2xl text-white drop-shadow">{c.name}</div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    {countCity(c.id)} клиент{countCity(c.id) === 1 ? "" : "а"}
                  </div>
                </div>
              </div>
            </button>
          ))}
          <button
            onClick={() => { goHome(); setNavUnassigned(true); }}
            className="crm-folder-card group relative block text-left transition hover:-translate-y-0.5 hover:shadow-2xl"
          >
            <div className="relative flex h-48 flex-col justify-end overflow-hidden rounded-[4px_18px_18px_18px] bg-[#31020c] ring-1 ring-black/10">
              <Folder className="absolute right-4 top-6 h-20 w-20 text-amber-300/25 transition group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="relative p-4">
                <div className="font-display text-2xl text-white drop-shadow">Без град</div>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {countUnassigned} клиент{countUnassigned === 1 ? "" : "а"}
                </div>
              </div>
            </div>
          </button>
          <button
            onClick={() => { setNavDeals(true); setNavUnassigned(false); setDealClientId(null); setDealSub(null); }}
            className="crm-folder-card group relative block text-left transition hover:-translate-y-0.5 hover:shadow-2xl"
          >
            <div className="relative h-48 overflow-hidden rounded-[4px_18px_18px_18px] ring-1 ring-black/10">
              <img src={dealsFolderImg} alt="" className="h-full w-full object-cover brightness-110 transition group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#31020c]/90 via-[#8B1A2B]/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="font-display text-2xl text-white drop-shadow">Започнати сделки</div>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {startedRows.length} папк{startedRows.length === 1 ? "а" : "и"}
                </div>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Започнати сделки — клиентски папки */}
      {showFolders && navDeals && !dealClientId && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {startedRows.map((r) => (
            <button
              key={r.id}
              onClick={() => guard(r, () => { setDealClientId(r.id); setDealSub(null); })}
              className="group relative overflow-hidden rounded-2xl border border-amber-500/25 bg-black/40 text-left shadow-lg transition hover:border-amber-400"
            >
              <div className="relative h-40 bg-primary/30">
                <Folder className="absolute right-4 top-4 h-16 w-16 text-amber-300/40" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="font-display text-2xl text-white">{r.full_name}</div>
                  <div className="text-xs text-white/70">
                    Капаро {r.deposit_amount ?? "—"} {r.deposit_currency ?? "EUR"} · {r.deposit_status}
                  </div>
                </div>
              </div>
            </button>
          ))}
          {startedRows.length === 0 && (
            <div className="col-span-full rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.95)] p-10 text-center text-primary/70">
              Още няма папки. Запиши сума и статус „Оставен“ в депозита на клиента.
            </div>
          )}
        </div>
      )}

      {showFolders && navDeals && dealClient && !dealSub && (
        <div className="space-y-4">
          {(dealClient.notes || dealClient.interest_note) && (
            <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.95)] p-4 text-sm text-primary">
              {dealClient.notes ? <p className="whitespace-pre-wrap">{dealClient.notes}</p> : null}
              {dealClient.interest_note ? <p className="mt-2 text-xs text-muted-foreground">Имот: {dealClient.interest_note}</p> : null}
            </div>
          )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEAL_SUBS.map((s) => (
            <button
              key={s.id}
              onClick={() => setDealSub(s.id)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-[#C9A84C]/50 bg-[rgba(255,255,255,0.04)] p-6 text-center transition hover:border-[#C9A84C]"
            >
              <Folder className="h-14 w-14 text-[#C9A84C]" />
              <div className="font-display text-lg font-bold text-amber-100">{s.label}</div>
              {s.id === "banka" && (
                <span className="text-[11px] text-amber-200/80">{dealClient.mortgage_data?.bank_case?.bankName ?? "няма избрана банка"}</span>
              )}
            </button>
          ))}
          <button
            onClick={() => guard(dealClient, () => setDetailsFor(dealClient))}
            className="flex flex-col items-center gap-2 rounded-2xl border border-amber-400/40 p-6 text-amber-100"
          >
            Отвори картата на клиента
          </button>
        </div>
        </div>
      )}

      {showFolders && navDeals && dealClient && dealSub && (
        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.95)] p-5 text-primary">
          {dealSub === "banka" ? (
            <div className="space-y-3">
              <div className="font-display text-2xl">
                Файл: {bankFileLabel(dealClient)}
              </div>
              <p className="text-xs text-muted-foreground">Кой от банката го работи, какво е изпратено и докъде са стигнали.</p>
              <input placeholder="Кой от банката го работи" value={bankDraft.worker} onChange={(e) => setBankDraft({ ...bankDraft, worker: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
              <textarea placeholder="Какво съм изпратил" rows={3} value={bankDraft.sent} onChange={(e) => setBankDraft({ ...bankDraft, sent: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
              <textarea placeholder="До къде са стигнали" rows={3} value={bankDraft.progress} onChange={(e) => setBankDraft({ ...bankDraft, progress: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
              <Button className="gold-cta-button" onClick={async () => {
                const prev = dealClient.mortgage_data?.bank_case ?? {};
                await updateClientDeal({
                  data: {
                    id: dealClient.id,
                    mortgage_data: {
                      ...(dealClient.mortgage_data ?? {}),
                      started_deal: true,
                      bank_case: { ...prev, ...bankDraft },
                    },
                  },
                });
                toast.success("Банковият файл е обновен.");
                await load();
              }}>Запази файла на банката</Button>
            </div>
          ) : dealSub === "imot" ? (
            <div className="space-y-2">
              <div className="font-display text-xl">За имота</div>
              {dealClient.interest_property_id || dealClient.interest_note ? (
                <p className="mt-2 text-sm">{dealClient.interest_note || `Свързан имот: ${dealClient.interest_property_id}`}</p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Все още няма добавен имот към картата.</p>
              )}
              {dealDocs.filter((d) => docBucket(d.document_type) === "imot").map((d) => (
                <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-amber-50">
                  <FileText className="h-4 w-4" /> {d.file_name}
                </a>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="font-display text-xl">{DEAL_SUBS.find((s) => s.id === dealSub)?.label}</div>
              {dealDocs.filter((d) => docBucket(d.document_type) === dealSub).map((d) => (
                <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-amber-50">
                  <FileText className="h-4 w-4" /> {d.file_name}
                </a>
              ))}
              {dealDocs.filter((d) => docBucket(d.document_type) === dealSub).length === 0 && (
                <p className="text-sm text-muted-foreground">Няма качени файлове в тази подпапка — прикачи ги от картата на клиента и ще се появят тук.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Level 1: Client type folders */}
      {showFolders && navCityId && !navType && !navDeals && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TYPE_ORDER.map((t) => {
            const meta = TYPE_META[t];
            const cnt = countType(t);
            return (
              <button key={t} onClick={() => setNavType(t)}
                className="group relative overflow-hidden rounded-2xl border border-amber-500/25 bg-black/40 shadow-lg transition hover:border-amber-400 hover:shadow-xl">
                <div className="relative h-56 overflow-hidden">
                  <img src={meta.image} alt={meta.label} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                  <div className="font-display text-2xl text-white">{meta.label}</div>
                  <div className="text-xs text-white/70">{meta.desc}</div>
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    {cnt} клиент{cnt === 1 ? "" : "а"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Level 2: Quarters in selected city */}
      {showFolders && navCityId && navType && !navQuarterId && !navDeals && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {quarters.filter(q => q.city_id === navCityId).map((q) => {
            const cnt = countQuarter(q.id);
            return (
              <button key={q.id} onClick={() => setNavQuarterId(q.id)}
                className="group relative overflow-hidden rounded-2xl border border-amber-500/25 bg-black/40 shadow-lg transition hover:border-amber-400 hover:shadow-xl">
                <div className="relative h-40 overflow-hidden bg-primary/20">
                  {q.image_url ? (
                    <img src={q.image_url} alt={q.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-amber-300/50">
                      <Folder className="h-14 w-14" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3.5 text-left">
                  <div className="flex items-center gap-1.5 text-lg font-semibold text-white">
                    <Folder className="h-4 w-4 text-amber-300" /> {q.name}
                  </div>
                  <div className="text-[11px] text-white/80">Квартал / село</div>
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {cnt} клиент{cnt === 1 ? "" : "а"}
                  </div>
                </div>
              </button>
            );
          })}
          {quarters.filter(q => q.city_id === navCityId).length === 0 && (
            <div className="col-span-full rounded-2xl border border-amber-500/20 bg-[rgba(255,251,243,0.95)] p-10 text-center text-primary/60">
              Няма квартали за този град.
            </div>
          )}
        </div>
      )}

      {/* Level 3: Property type folders */}
      {showFolders && navCityId && navType && navQuarterId && !navProp && !navDeals && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROP_META.map((p) => {
            const cnt = countProp(p.key);
            const Icon = p.icon;
            return (
              <button key={p.key} onClick={() => setNavProp(p.key)}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#C9A84C]/50 bg-[rgba(255,255,255,0.04)] p-6 text-center transition hover:border-[#C9A84C] hover:bg-[rgba(201,168,76,0.10)]">
                <Icon className="h-14 w-14 text-[#C9A84C] transition group-hover:scale-105" strokeWidth={1.5} />
                <div className="font-display text-lg font-bold text-amber-100">{p.label}</div>
                <span className="mt-1 rounded-full border border-[#C9A84C]/50 px-3 py-0.5 text-[11px] font-semibold text-[#C9A84C]">
                  {cnt} клиент{cnt === 1 ? "" : "а"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Level 4 + Без град + глобално търсене: карти */}
      {showList && (
        <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.08)] p-3">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="rounded-full border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-1.5 text-sm text-amber-100">
          <option value="newest">Най-нови</option>
          <option value="name">Име А–Я</option>
          <option value="score">Оценка</option>
          <option value="stage">Етап</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-full border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-1.5 text-sm text-amber-100">
          <option value="">Статус: всички</option>
          <option value="active">Активен</option>
          <option value="inactive">Неактивен</option>
          <option value="closed">Затворен</option>
        </select>
        <select value={filterBroker} onChange={(e) => setFilterBroker(e.target.value)} className="rounded-full border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-1.5 text-sm text-amber-100">
          <option value="">Брокер: всички</option>
          {brokers.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
        </select>
        <Chip active={filterTier === "hot"} onClick={() => setFilterTier(filterTier === "hot" ? "" : "hot")}>Горещ</Chip>
        <Chip active={filterTier === "warm"} onClick={() => setFilterTier(filterTier === "warm" ? "" : "warm")}>Топъл</Chip>
        <Chip active={filterTier === "cold"} onClick={() => setFilterTier(filterTier === "cold" ? "" : "cold")}>Студен</Chip>
        <Chip active={filterNoBroker} onClick={() => setFilterNoBroker(!filterNoBroker)}>Без брокер</Chip>
        <Chip active={filterDealChip === "started"} onClick={() => setFilterDealChip(filterDealChip === "started" ? "" : "started")}>Започната сделка</Chip>
        <Chip active={filterDealChip === "mortgage"} onClick={() => setFilterDealChip(filterDealChip === "mortgage" ? "" : "mortgage")}>Ипотека</Chip>
        {(filterStatus || filterBroker || filterTier || filterNoBroker || filterDealChip) && (
          <button onClick={() => { setFilterStatus(""); setFilterBroker(""); setFilterTier(""); setFilterNoBroker(false); setFilterDealChip(""); }} className="text-xs text-amber-100/60 underline">Изчисти</button>
        )}
        <span className="ml-auto self-center text-xs text-amber-100/50">{sorted.length} / {listSource.length}</span>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-amber-500/20 bg-[#faf6ee] px-6 py-12 text-center text-sm text-[#8B1A2B]/60">
          {isSearching ? "Няма клиенти по това търсене." : "Няма клиенти. Добави нов."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((r) => {
            const budget = r.budget_min || r.budget_max
              ? `${r.budget_min ?? "?"} – ${r.budget_max ?? "?"} ${r.currency ?? "EUR"}`
              : "без бюджет";
            return (
              <div
                key={r.id}
                className="client-card flex flex-col rounded-2xl border border-[#C9A84C]/70 bg-[#f7efe0] p-4 text-left text-[#31020c] shadow-sm transition hover:border-[#C9A84C] hover:shadow-md"
              >
                <button type="button" className="min-w-0 flex-1 text-left text-[#31020c]" onClick={() => guard(r, () => setDetailsFor(r))}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="client-card-badge rounded-full bg-[#8B1A2B] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#fffaf2]">
                      {labelType(r.client_type)}
                    </span>
                    <LeadScoreBadge score={r.lead_score} tier={r.lead_tier} compact tone="light" />
                  </div>
                  <div className="mt-2 font-display text-xl leading-tight text-[#31020c]">{r.full_name}</div>
                  {r.phone ? (
                    <div className="client-card-muted mt-1 flex items-center gap-1.5 text-sm text-[#5c2a32]">
                      <Phone className="h-3.5 w-3.5 shrink-0" />{r.phone}
                    </div>
                  ) : (
                    <div className="client-card-muted mt-1 text-sm text-[#5c2a32]">Няма телефон</div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {r.deal_stage === "mortgage" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">ипотека</span>
                    )}
                    {r.deal_stage === "started" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-950">сделка</span>
                    )}
                    {r.cities?.name && (
                      <span className="client-card-muted inline-flex items-center gap-1 text-[11px] text-[#5c2a32]">
                        <MapPin className="h-3 w-3" />{r.cities.name}{r.quarters?.name ? `, ${r.quarters.name}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="client-card-muted mt-2 text-xs text-[#5c2a32]">
                    {budget} · {r.brokers?.full_name ?? "без брокер"}
                  </div>
                </button>
                <div className="mt-3 flex justify-end gap-1 border-t border-[#C9A84C]/40 pt-2">
                  <button type="button" className="rounded-lg p-1.5 text-[#31020c] hover:bg-[#efe2c4]" title="Документи" onClick={() => guard(r, () => setDocsFor(r))}><FileText className="h-4 w-4" /></button>
                  <button type="button" className="rounded-lg p-1.5 text-[#31020c] hover:bg-[#efe2c4]" title="Редакция" onClick={() => guard(r, () => setEditing(r))}><Pencil className="h-4 w-4" /></button>
                  <button type="button" className="client-card-danger rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" title="Изтриване" onClick={() => guard(r, () => remove(r.id))}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-accent-foreground">{editing.id ? "Редакция" : "Нов клиент"}</h2>
              <button type="button" onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
            </div>

            <Section title="Контакти">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Име *"><input required value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} className={iC} /></Field>
                <Field label="Тип клиент"><select value={editing.client_type ?? "buyer"} onChange={(e) => setEditing({ ...editing, client_type: e.target.value })} className={iC}>
                  <option value="buyer">Купувач</option><option value="seller">Продавач</option><option value="tenant">Наемател</option><option value="landlord">Наемодател</option>
                </select></Field>
                <Field label="Телефон"><input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className={iC} /></Field>
                <Field label="Имейл"><input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className={iC} /></Field>
                <Field label="Статус"><select value={editing.status ?? "active"} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className={iC}>
                  <option value="active">Активен</option><option value="inactive">Неактивен</option><option value="closed">Затворен</option>
                </select></Field>
                <Field label="Брокер"><select value={editing.assigned_broker_id ?? ""} onChange={(e) => setEditing({ ...editing, assigned_broker_id: e.target.value || null })} className={iC}>
                  <option value="">—</option>
                  {brokers.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
                </select></Field>
              </div>
            </Section>

            <Section title="Критерии за търсене (за автоматичен matching)">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Град"><select value={editing.search_city_id ?? ""} onChange={(e) => setEditing({ ...editing, search_city_id: e.target.value || null, search_quarter_id: null })} className={iC}>
                  <option value="">—</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></Field>
                <Field label="Квартал"><select value={editing.search_quarter_id ?? ""} onChange={(e) => setEditing({ ...editing, search_quarter_id: e.target.value || null })} className={iC}>
                  <option value="">—</option>
                  {filteredQuarters.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                </select></Field>
                <Field label="Тип имот"><select value={editing.search_property_type ?? ""} onChange={(e) => setEditing({ ...editing, search_property_type: e.target.value || null })} className={iC}>
                  <option value="">—</option>
                  <option value="apartment">Апартамент</option><option value="house">Къща</option><option value="office">Офис</option><option value="land">Парцел</option><option value="commercial">Търговски</option>
                </select></Field>
                <Field label="Продажба/Наем"><select value={editing.search_status ?? ""} onChange={(e) => setEditing({ ...editing, search_status: e.target.value || null })} className={iC}>
                  <option value="">—</option><option value="sale">Продажба</option><option value="rent">Наем</option>
                </select></Field>
                <Field label="Бюджет от"><input type="number" value={editing.budget_min ?? ""} onChange={(e) => setEditing({ ...editing, budget_min: e.target.value ? Number(e.target.value) : null })} className={iC} /></Field>
                <Field label="Бюджет до"><input type="number" value={editing.budget_max ?? ""} onChange={(e) => setEditing({ ...editing, budget_max: e.target.value ? Number(e.target.value) : null })} className={iC} /></Field>
                <Field label="Валута"><select value={editing.currency ?? "EUR"} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} className={iC}>
                  <option value="EUR">EUR</option><option value="BGN">BGN</option>
                </select></Field>
                <Field label="Стаи мин."><input type="number" value={editing.rooms_min ?? ""} onChange={(e) => setEditing({ ...editing, rooms_min: e.target.value ? Number(e.target.value) : null })} className={iC} /></Field>
                <Field label="Стаи макс."><input type="number" value={editing.rooms_max ?? ""} onChange={(e) => setEditing({ ...editing, rooms_max: e.target.value ? Number(e.target.value) : null })} className={iC} /></Field>
                <Field label="Площ мин. (m²)"><input type="number" value={editing.area_min ?? ""} onChange={(e) => setEditing({ ...editing, area_min: e.target.value ? Number(e.target.value) : null })} className={iC} /></Field>
                <Field label="Площ макс. (m²)"><input type="number" value={editing.area_max ?? ""} onChange={(e) => setEditing({ ...editing, area_max: e.target.value ? Number(e.target.value) : null })} className={iC} /></Field>
              </div>
            </Section>

            <Field label="Бележки"><textarea rows={3} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className={iC} /></Field>

            <div className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2">
              <Sparkles className="h-4 w-4 mt-0.5 flex-none" />
              При записване системата автоматично проверява за съвпадащи имоти и генерира алерти.
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Отказ</Button>
              <Button type="submit" disabled={busy} className="gold-cta-button">{busy ? "Запис..." : "Запази"}</Button>
            </div>
          </form>
        </Modal>
      )}

      {docsFor && <DocumentsModal client={docsFor} onClose={() => setDocsFor(null)} />}
      {mortgageFor ? (
        <BankMortgageDesk
          client={mortgageFor}
          open
          onClose={() => setMortgageFor(null)}
          onSaved={load}
        />
      ) : null}
      {mortgageStagesFor && <MortgageStagesModal client={mortgageStagesFor} onClose={() => setMortgageStagesFor(null)} onSaved={load} />}
      <ClientDetailsSheet
        client={detailsFor}
        open={!!detailsFor}
        onClose={() => setDetailsFor(null)}
        onChanged={load}
        onEdit={(c) => { setDetailsFor(null); setEditing(c); }}
        onMortgageSend={(c) => setMortgageFor(c)}
        onMortgageStages={(c) => { setDetailsFor(null); setMortgageStagesFor(c); }}
      />
      <ClientScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onExtracted={(prefill) => setEditing(prefill)}
        cities={cities}
        quarters={quarters}
      />
    </div>
  );
}

const iC = "w-full rounded border border-input bg-background px-3 py-2";

function labelType(t: string) { return ({ buyer: "Купувач", seller: "Продавач", tenant: "Наемател", landlord: "Наемодател" } as any)[t] ?? t; }

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
        active
          ? "border-amber-400 bg-amber-400 text-primary"
          : "border-amber-500/30 bg-[rgba(20,4,8,0.45)] text-amber-100 hover:border-amber-400/60"
      }`}
    >
      {children}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#8B1A2B]/55 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-card p-6 shadow-2xl">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 font-display text-base text-primary">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function DocumentsModal({ client, onClose }: { client: any; onClose: () => void }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [type, setType] = useState("id_card");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setDocs(await getClientDocuments({ data: { client_id: client.id } })); } catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, [client.id]);

  const onUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${client.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("client-documents").upload(path, file, { contentType: file.type });
        if (upErr) { toast.error(upErr.message); continue; }
        const { data: signed } = await supabase.storage.from("client-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
        await addClientDocument({ data: {
          client_id: client.id,
          document_type: type,
          file_url: signed?.signedUrl ?? path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        } });
      }
      await load();
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване?")) return;
    try { await deleteClientDocument({ data: { id } }); await load(); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Modal onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-accent-foreground">Документи</h2>
          <p className="text-sm text-muted-foreground">{client.full_name}</p>
        </div>
        <button onClick={onClose}><X className="h-5 w-5" /></button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border border-input bg-background px-3 py-2 text-sm">
          <option value="id_card">Лична карта</option>
          <option value="bank_statement">Банково извлечение</option>
          <option value="contract">Договор</option>
          <option value="other">Друго</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-primary/30 bg-muted/30 px-4 py-2 text-primary hover:bg-muted/50">
          <Upload className="h-4 w-4" /> <span className="text-sm">{busy ? "Качване…" : "Качи файл"}</span>
          <input type="file" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} disabled={busy} />
        </label>
      </div>

      <div className="space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 flex-none text-primary" />
              <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">{d.file_name}</a>
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">{labelDoc(d.document_type)}</span>
            </div>
            <button onClick={() => remove(d.id)} className="text-rose-500"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {!docs.length && <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><AlertTriangle className="h-4 w-4" />Все още няма качени документи.</div>}
      </div>
    </Modal>
  );
}

function labelDoc(t: string) { return ({ id_card: "Лична карта", bank_statement: "Банково", contract: "Договор", other: "Друго" } as any)[t] ?? t; }
