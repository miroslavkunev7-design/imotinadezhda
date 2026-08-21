import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import clientBuyer from "@/assets/client-buyer.jpg";
import clientSeller from "@/assets/client-seller.jpg";
import clientTenant from "@/assets/client-tenant.jpg";
import clientLandlord from "@/assets/client-landlord.jpg";
import homeLiving from "@/assets/crm/crm-opt-search.png";
import scheduleCover from "@/assets/crm/crm-opt-notes.png";
import terraceHero from "@/assets/crm/crm-opt-deposit.png";
import loginHero from "@/assets/crm/crm-opt-documents.png";
import filesPhoto from "@/assets/crm/crm-opt-files.png";
import guarantorsPhoto from "@/assets/crm/crm-opt-guarantors.png";
import mortgagePhoto from "@/assets/crm/crm-opt-mortgage.png";
import cityBurgas from "@/assets/city-burgas.jpeg";
import cityVarna from "@/assets/city-varna.jpeg";
import cityShumen from "@/assets/city-shumen.jpeg";
import cityNoviPazar from "@/assets/city-novi-pazar.jpeg";
import {
  getClientDocuments,
  addClientDocument,
  deleteClientDocument,
  upsertClient,
  updateClientDeal,
  updateClientDepositInterest,
  searchPropertiesForLink,
} from "@/lib/crm.functions";
import { BankMortgageDesk } from "@/components/admin/bank-mortgage-desk";
import { LeadScoreBadge } from "@/components/admin/lead-score-badge";
import { qualifyClient } from "@/lib/qualify.functions";
import { ScheduleViewingDialog } from "@/components/admin/schedule-viewing-dialog";
import {
  Phone, Mail, MapPin, FileText, Upload, Trash2, Pencil,
  Download, Copy, CalendarPlus, ClipboardList, MessageSquare,
  CreditCard, Handshake, XCircle, Sparkles, Save,
  Check, AlertCircle, Loader2, IdCard, Briefcase, FileSignature, ChevronDown,
  Users, UserPlus, MessageCircle, Home, KeyRound, MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type LinkableProperty = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  area_sqm: number | null;
  rooms: number | null;
  is_published: boolean | null;
  cities?: { name: string } | null;
};

function phoneTel(raw: string | null | undefined) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("359")) return `+${digits}`;
  if (digits.startsWith("0")) return `+359${digits.slice(1)}`;
  return `+${digits}`;
}

async function copyText(text: string, ok: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error("Не можа да се копира. Разреши достъп до клипборда.");
  }
}

const BG_MONTHS = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];

function lastTwelveMonths(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: `${BG_MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }
  return out;
}

const MONTHLY_CATS = [
  { id: "bank_statement", label: "Банкови извлечения (12 месеца)", icon: CreditCard },
  { id: "payslip", label: "Фишове за заплата (12 месеца)", icon: FileText },
] as const;

const SINGLE_CATS = [
  { id: "id_front", label: "Лична карта (лице)", icon: IdCard },
  { id: "id_back", label: "Лична карта (гръб)", icon: IdCard },
  { id: "contract", label: "Трудов договор", icon: FileSignature },
  { id: "employer_note", label: "Служебна бележка", icon: Briefcase },
] as const;

type Client = any;
type Guarantor = { id: string; name: string };

const STAGES = [
  { key: null, label: "Активен", pct: 10 },
  { key: "started", label: "Започната сделка", pct: 45 },
  { key: "mortgage", label: "Ипотечен кредит", pct: 80 },
  { key: "closed", label: "Завършена", pct: 100 },
] as const;

const TYPE_PHOTO: Record<string, string> = {
  buyer: clientBuyer,
  seller: clientSeller,
  tenant: clientTenant,
  landlord: clientLandlord,
};

const CITY_PHOTO: Record<string, string> = {
  burgas: cityBurgas,
  varna: cityVarna,
  shumen: cityShumen,
  "novi-pazar": cityNoviPazar,
  "novi pazar": cityNoviPazar,
};

const CHAPTER_PHOTO: Record<string, string> = {
  info: homeLiving,
  notes: scheduleCover,
  docs: loginHero,
  deposit: terraceHero,
  files: filesPhoto,
  guarantors: guarantorsPhoto,
  mortgage: mortgagePhoto,
};

export function ClientDetailsSheet({
  client,
  open,
  onClose,
  onChanged,
  onEdit,
  onMortgageSend: _onMortgageSend,
  onMortgageStages,
}: {
  client: Client | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onEdit: (c: Client) => void;
  onMortgageSend: (c: Client) => void;
  onMortgageStages: (c: Client) => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const months = lastTwelveMonths();

  // ==== Депозит + харесан имот ====
  const [dep, setDep] = useState({
    amount: "", currency: "EUR", date: "", method: "", status: "", note: "",
  });
  const [interestNote, setInterestNote] = useState("");
  const [interestPropertyId, setInterestPropertyId] = useState<string | null>(null);
  const [propQuery, setPropQuery] = useState("");
  const [propResults, setPropResults] = useState<LinkableProperty[]>([]);
  const [propSearching, setPropSearching] = useState(false);
  const [savingDep, setSavingDep] = useState(false);
  const [viewingOpen, setViewingOpen] = useState(false);
  const [banksOpen, setBanksOpen] = useState(false);
  const banksOpenRef = useRef(false);
  banksOpenRef.current = banksOpen;
  const cardScrollRef = useRef<HTMLDivElement>(null);
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({
    info: true,
  });

  const toggleChapter = (id: string) =>
    setOpenChapters({ [id]: true });

  const jumpTo = (id: string) => {
    if (id === "mortgage") {
      setBanksOpen(true);
      return;
    }
    setOpenChapters({ [id]: true });
  };

  useEffect(() => {
    if (!client) return;
    setNotes(client.notes ?? "");
    setGuarantors((client.mortgage_data?.guarantors as Guarantor[]) ?? []);
    setDep({
      amount: client.deposit_amount != null ? String(client.deposit_amount) : "",
      currency: client.deposit_currency ?? "EUR",
      date: client.deposit_date ?? "",
      method: client.deposit_method ?? "",
      status: client.deposit_status ?? "",
      note: client.deposit_note ?? "",
    });
    setInterestNote(client.interest_note ?? "");
    setInterestPropertyId(client.interest_property_id ?? null);
    setPropQuery("");
    setPropResults([]);
    getClientDocuments({ data: { client_id: client.id } }).then(setDocs).catch(() => setDocs([]));
    setBanksOpen(false);
    setOpenChapters({ info: true });
  }, [client?.id]);

  if (!client) return null;

  const stage = STAGES.find((s) => s.key === (client.deal_stage ?? null)) ?? STAGES[0];

  const saveNotes = async () => {
    setBusy(true);
    try {
      const { id, full_name, phone, email, client_type, status, currency } = client;
      await upsertClient({ data: { id, full_name, phone, email, client_type, status, currency, notes } });
      await onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Грешка"); }
    finally { setBusy(false); }
  };

  const setStage = async (key: string | null) => {
    setBusy(true);
    try {
      await updateClientDeal({
        data: { id: client.id, deal_stage: key, deal_started_at: key ? new Date().toISOString() : null },
      });
      await onChanged();
      if (key === "mortgage") setBanksOpen(true);
    } catch (e: any) { toast.error(e?.message ?? "Грешка"); }
    finally { setBusy(false); }
  };

  const searchProps = async (q: string) => {
    setPropSearching(true);
    try {
      const rows = await searchPropertiesForLink({ data: { q } });
      setPropResults(rows as LinkableProperty[]);
    } catch (e: any) { toast.error(e?.message ?? "Грешка при търсене"); }
    finally { setPropSearching(false); }
  };

  const saveDeposit = async () => {
    setSavingDep(true);
    try {
      await updateClientDepositInterest({
        data: {
          id: client.id,
          deposit_amount: dep.amount.trim() ? Number(dep.amount) : null,
          deposit_currency: dep.currency || "EUR",
          deposit_date: dep.date || null,
          deposit_method: dep.method || null,
          deposit_status: dep.status || null,
          deposit_note: dep.note || null,
          interest_property_id: interestPropertyId,
          interest_note: interestNote || null,
        },
      });
      toast.success("Записано");
      const left = String(dep.status).toLowerCase().includes("остав") && dep.amount.trim();
      if (left) {
        await updateClientDeal({
          data: {
            id: client.id,
            deal_stage: client.deal_stage || "started",
            mortgage_data: { ...(client.mortgage_data ?? {}), started_deal: true },
          },
        });
        toast.success(`Папка „${client.full_name}“ е в „Започнати сделки“.`);
      }
      await onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Грешка"); }
    finally { setSavingDep(false); }
  };

  const depositReceipt = () => {
    const amount = dep.amount.trim() ? `${dep.amount} ${dep.currency || "EUR"}` : "____";
    const date = dep.date || new Date().toISOString().slice(0, 10);
    const linked = propResults.find((p) => p.id === interestPropertyId);
    const propLine = linked?.title ?? interestNote ?? "____";
    const text = `РАЗПИСКА ЗА ПОЛУЧЕН ДЕПОЗИТ\n\nДата: ${date}\nПолучател: „Имоти Надежда“\nПлатец: ${client.full_name}\nТелефон: ${client.phone ?? "—"}\n\nСума: ${amount}\nНачин на плащане: ${dep.method || "—"}\nСтатус: ${dep.status || "оставен"}\nИмот: ${propLine}\n\nЗабележка: ${dep.note || "—"}\n\nПодпис получател: ..................    Подпис платец: ..................`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `razpiska-depozit-${client.full_name.replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveGuarantors = async (next: Guarantor[]) => {
    setGuarantors(next);
    try {
      await updateClientDeal({
        data: {
          id: client.id,
          mortgage_data: { ...(client.mortgage_data ?? {}), guarantors: next },
        },
      });
      await onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Грешка при запис на поръчителите"); }
  };

  const addGuarantor = () => {
    const name = prompt("Име на поръчителя:");
    if (!name) return;
    const g: Guarantor = { id: Math.random().toString(36).slice(2, 10), name: name.trim() };
    saveGuarantors([...guarantors, g]);
  };

  const renameGuarantor = (id: string) => {
    const g = guarantors.find((x) => x.id === id);
    if (!g) return;
    const name = prompt("Ново име:", g.name);
    if (!name) return;
    saveGuarantors(guarantors.map((x) => x.id === id ? { ...x, name: name.trim() } : x));
  };

  const removeGuarantor = (id: string) => {
    if (!confirm("Премахване на поръчителя? Документите му ще останат, но няма да са видими.")) return;
    saveGuarantors(guarantors.filter((x) => x.id !== id));
  };

  const reload = async () =>
    setDocs(await getClientDocuments({ data: { client_id: client.id } }));

  const uploadFile = async (file: File, subject: string, category: string, month?: string) => {
    const docType = `${subject}${category}${month ? `:${month}` : ""}`;
    const key = `${subject}${category}-${month ?? "single"}`;
    setUploading(key);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${client.id}/${docType.replace(/:/g, "_")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("client-documents").upload(path, file, { contentType: file.type });
      if (upErr) { toast.error(upErr.message); return; }
      const { data: signed } = await supabase.storage.from("client-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
      await addClientDocument({ data: {
        client_id: client.id,
        document_type: docType,
        file_url: signed?.signedUrl ?? path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      } });
      await reload();
    } finally { setUploading(null); }
  };

  const docsFor = (subject: string, category: string, month?: string) =>
    docs.filter((d) => d.document_type === `${subject}${category}${month ? `:${month}` : ""}`);
  const monthsCompleted = (subject: string, category: string) =>
    months.filter((m) => docsFor(subject, category, m.key).length > 0).length;

  const openDoc = (doc: { file_url?: string | null }) => {
    if (!doc?.file_url) return;
    window.open(doc.file_url, "_blank", "noopener,noreferrer");
  };

  const removeDoc = async (id: string) => {
    if (!confirm("Изтриване на този файл?")) return;
    await deleteClientDocument({ data: { id } });
    await reload();
  };

  /** Заменя файл: качва новия под същия тип и изтрива стария запис. */
  const replaceDoc = async (doc: any, file: File) => {
    setUploading(`replace-${doc.id}`);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${client.id}/${String(doc.document_type).replace(/:/g, "_")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("client-documents").upload(path, file, { contentType: file.type });
      if (upErr) { toast.error(upErr.message); return; }
      const { data: signed } = await supabase.storage.from("client-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
      await addClientDocument({ data: {
        client_id: client.id,
        document_type: String(doc.document_type),
        file_url: signed?.signedUrl ?? path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      } });
      await deleteClientDocument({ data: { id: doc.id } });
      await reload();
      toast.success("Файлът е заменен.");
    } finally { setUploading(null); }
  };

  const missingDocLines = (subject: string) => {
    const lines: string[] = [];
    for (const cat of MONTHLY_CATS) {
      const missing = months.filter((m) => docsFor(subject, cat.id, m.key).length === 0);
      if (missing.length === 12) lines.push(`${cat.label}: липсват всички 12 месеца`);
      else if (missing.length) lines.push(`${cat.label}: липсват ${missing.map((m) => m.label).join(", ")}`);
    }
    for (const cat of SINGLE_CATS) {
      if (docsFor(subject, cat.id).length === 0) lines.push(cat.label);
    }
    return lines;
  };

  const clientBrief = () => {
    const budget = client.budget_min || client.budget_max
      ? `${client.budget_min ?? "?"} – ${client.budget_max ?? "?"} ${client.currency}`
      : null;
    const rooms = client.rooms_min || client.rooms_max
      ? `${client.rooms_min ?? "?"} – ${client.rooms_max ?? "?"} стаи`
      : null;
    const area = client.area_min || client.area_max
      ? `${client.area_min ?? "?"} – ${client.area_max ?? "?"} m²`
      : null;
    const stageLabel = (STAGES.find((s) => s.key === (client.deal_stage ?? null)) ?? STAGES[0]).label;
    const bits = [
      client.full_name,
      client.phone ? `тел. ${client.phone}` : null,
      client.email ? `имейл ${client.email}` : null,
      client.cities?.name
        ? `${client.cities.name}${client.quarters?.name ? `, ${client.quarters.name}` : ""}`
        : null,
      client.search_property_type || client.search_status
        ? `търси: ${[client.search_property_type, client.search_status].filter(Boolean).join(" · ")}`
        : null,
      budget ? `бюджет: ${budget}` : null,
      rooms,
      area,
      `етап: ${stageLabel}`,
    ].filter(Boolean);
    return bits.join("\n");
  };

  const copyMissingDocs = () => {
    const missing = missingDocLines("");
    if (!missing.length) {
      toast.success("Документите за кредита са попълнени.");
      return;
    }
    copyText(
      `Липсващи документи за ${client.full_name}:\n${missing.map((l) => `• ${l}`).join("\n")}`,
      "Списъкът с липсващи документи е копиран.",
    );
  };

  const scheduleViewing = () => setViewingOpen(true);

  const downloadDoc = async (doc: any) => {
    try {
      const res = await fetch(doc.file_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name || "file";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(doc.file_url, "_blank", "noopener");
    }
  };

  const isImageDoc = (d: any) =>
    String(d.mime_type ?? "").startsWith("image/") || /\.(jpe?g|png|webp|heic|gif)$/i.test(String(d.file_name ?? ""));

  const renderFileLibrary = () => (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-background px-3 py-3 text-xs font-medium text-primary hover:border-primary/60">
        {uploading === "other-single" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Добави снимка или документ
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            for (const f of files) await uploadFile(f, "", "other");
          }}
        />
      </label>

      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Още няма качени файлове.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {docs.map((d) => (
            <div key={d.id} className="flex gap-2 rounded-xl border border-border bg-background p-2">
              {isImageDoc(d) ? (
                <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="flex-none">
                  <img src={d.file_url} alt={d.file_name} className="h-16 w-16 rounded-lg object-cover" />
                </a>
              ) : (
                <div className="flex h-16 w-16 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs font-medium text-primary hover:underline">
                  {d.file_name}
                </a>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {String(d.document_type)}
                  {d.file_size ? ` · ${Math.max(1, Math.round(Number(d.file_size) / 1024))} KB` : ""}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => downloadDoc(d)} className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/20">
                    <Download className="h-3 w-3" /> Свали
                  </button>
                  <label className="flex cursor-pointer items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-800 hover:bg-amber-500/25">
                    {uploading === `replace-${d.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Замени
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) replaceDoc(d, f);
                      }}
                    />
                  </label>
                  <button type="button" onClick={() => removeDoc(d.id)} className="flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-700 hover:bg-rose-500/25">
                    <Trash2 className="h-3 w-3" /> Изтрий
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderDocsSubject = (subject: string) => (
    <div className="space-y-2">
      {/* 12-month checklists */}
      {MONTHLY_CATS.map((cat) => {
        const completed = monthsCompleted(subject, cat.id);
        const allDone = completed === 12;
        const expKey = `${subject}${cat.id}`;
        const isOpen = expanded === expKey;
        return (
          <div key={expKey} className="rounded-xl border border-border bg-background">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : expKey)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <div className="flex min-w-0 items-center gap-2">
                <cat.icon className="h-4 w-4 flex-none text-primary" />
                <span className="truncate text-sm font-medium">{cat.label}</span>
              </div>
              <div className="flex flex-none items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${allDone ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                  {completed}/12
                </span>
                {allDone && <Check className="h-4 w-4 text-emerald-600" />}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`} />
              </div>
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 gap-1.5 border-t border-border p-2 sm:grid-cols-3">
                {months.map((m) => {
                  const items = docsFor(subject, cat.id, m.key);
                  const ok = items.length > 0;
                  const isUp = uploading === `${subject}${cat.id}-${m.key}`;
                  const first = items[0];
                  if (ok) {
                    return (
                      <div
                        key={m.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => openDoc(first)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDoc(first); } }}
                        className="group flex cursor-pointer flex-col gap-1 rounded-lg border border-emerald-400/60 bg-emerald-50 p-2 text-[11px] transition hover:border-emerald-500 hover:bg-emerald-100/80"
                        title="Отвори документа"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-medium text-emerald-800">{m.label}</span>
                          <Check className="h-3.5 w-3.5 flex-none text-emerald-600" />
                        </div>
                        <div className="space-y-0.5">
                          {items.map((f) => (
                            <div key={f.id} className="flex items-center justify-between gap-1 text-[10px] text-emerald-700/90">
                              <span className="truncate underline-offset-2 group-hover:underline">{f.file_name}</span>
                              <button
                                type="button"
                                title="Изтрий"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeDoc(f.id); }}
                                className="rounded p-0.5 text-rose-500 hover:bg-rose-100 hover:text-rose-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <label
                          className="mt-0.5 inline-flex w-fit cursor-pointer items-center gap-1 text-[10px] text-emerald-800/70 hover:text-emerald-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isUp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          Добави още
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadFile(file, subject, cat.id, m.key);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    );
                  }
                  return (
                    <label
                      key={m.key}
                      className="group flex cursor-pointer flex-col gap-1 rounded-lg border border-dashed border-rose-300/60 bg-rose-50/40 p-2 text-[11px] transition hover:border-rose-400"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-medium text-rose-700">{m.label}</span>
                        <AlertCircle className="h-3.5 w-3.5 flex-none text-rose-500" />
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-rose-600/80">
                        {isUp ? <><Loader2 className="h-3 w-3 animate-spin" /> Качване…</> : <><Upload className="h-3 w-3" /> Добави</>}
                      </div>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadFile(file, subject, cat.id, m.key);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Single docs */}
      <div className="grid gap-1.5 sm:grid-cols-2">
        {SINGLE_CATS.map((cat) => {
          const items = docsFor(subject, cat.id);
          const ok = items.length > 0;
          const isUp = uploading === `${subject}${cat.id}-single`;
          const first = items[0];
          if (ok) {
            return (
              <div
                key={`${subject}${cat.id}`}
                role="button"
                tabIndex={0}
                onClick={() => openDoc(first)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDoc(first); } }}
                className="flex cursor-pointer flex-col gap-1 rounded-xl border-2 border-emerald-400 bg-emerald-50 p-2.5 text-xs transition hover:border-emerald-500 hover:bg-emerald-100/80"
                title="Отвори документа"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <cat.icon className="h-3.5 w-3.5 flex-none text-primary" />
                    <span className="truncate font-medium text-primary">{cat.label}</span>
                  </div>
                  <Check className="h-4 w-4 flex-none text-emerald-600" />
                </div>
                <div className="space-y-0.5 text-[10px] text-emerald-800">
                  {items.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-1">
                      <span className="truncate underline-offset-2 hover:underline">{f.file_name}</span>
                      <button
                        type="button"
                        title="Изтрий"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeDoc(f.id); }}
                        className="rounded p-0.5 text-rose-500 hover:bg-rose-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <label
                  className="mt-0.5 inline-flex w-fit cursor-pointer items-center gap-1 text-[10px] text-emerald-800/70 hover:text-emerald-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isUp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Добави / замени
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile(file, subject, cat.id);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            );
          }
          return (
            <label
              key={`${subject}${cat.id}`}
              className="flex cursor-pointer flex-col gap-1 rounded-xl border-2 border-dashed border-primary/25 bg-background p-2.5 text-xs transition hover:border-primary/50"
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <cat.icon className="h-3.5 w-3.5 flex-none text-primary" />
                  <span className="truncate font-medium text-primary">{cat.label}</span>
                </div>
                <AlertCircle className="h-4 w-4 flex-none text-rose-500" />
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {isUp ? <><Loader2 className="h-3 w-3 animate-spin" /> Качване…</> : <><Upload className="h-3 w-3" /> Добави документ</>}
              </div>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file, subject, cat.id);
                  e.target.value = "";
                }}
              />
            </label>
          );
        })}
      </div>
    </div>
  );

  const tel = phoneTel(client.phone);
  const waDigits = tel.replace(/\D/g, "");
  const greet = `Здравейте, ${client.full_name?.split(" ")[0] ?? ""}!`;
  const clientDocCount = docs.filter((d) => !String(d.document_type).startsWith("guarantor:")).length;
  const budgetLine = client.budget_min || client.budget_max
    ? `${client.budget_min ?? "?"} – ${client.budget_max ?? "?"} ${client.currency}`
    : null;
  const roomsLine = client.rooms_min || client.rooms_max
    ? `${client.rooms_min ?? "?"} – ${client.rooms_max ?? "?"} стаи`
    : null;
  const areaLine = client.area_min || client.area_max
    ? `${client.area_min ?? "?"} – ${client.area_max ?? "?"} m²`
    : null;
  const currentStageIdx = STAGES.findIndex((s) => s.key === (client.deal_stage ?? null));
  const typePhoto = TYPE_PHOTO[client.client_type] ?? clientBuyer;
  const cityPhoto = CITY_PHOTO[String(client.cities?.slug ?? "").toLowerCase()]
    ?? CITY_PHOTO[String(client.cities?.name ?? "").toLowerCase()];
  const chapterNav = [
    { id: "info", label: "Търси" },
    { id: "notes", label: "Бележки" },
    { id: "docs", label: "Документи" },
    { id: "deposit", label: "Депозит" },
    { id: "files", label: "Файлове" },
    { id: "guarantors", label: "Поръчители" },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && banksOpenRef.current) {
          setBanksOpen(false);
          return;
        }
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="flex h-[92vh] w-[min(96vw,920px)] max-w-none flex-col gap-0 overflow-hidden rounded-[28px] border-2 border-[#C9A84C]/55 bg-[#faf6ee] p-0 shadow-[0_28px_80px_rgba(49,2,12,0.45)] sm:rounded-[28px]"
        onInteractOutside={(e) => { if (banksOpenRef.current) e.preventDefault(); }}
        onPointerDownOutside={(e) => { if (banksOpenRef.current) e.preventDefault(); }}
        onFocusOutside={(e) => { if (banksOpenRef.current) e.preventDefault(); }}
      >
        <div className="shrink-0">
          <div className="relative h-[88px] overflow-hidden">
            <img src={typePhoto} alt="" className="h-full w-full object-cover object-center" />
            {cityPhoto ? (
              <img
                src={cityPhoto}
                alt=""
                className="absolute right-14 top-3 h-12 w-12 rounded-2xl object-cover ring-2 ring-[#C9A84C]/80"
              />
            ) : null}
          </div>
          <div className="bg-[#faf6ee] px-6 pb-2 pt-2 pr-14">
            <DialogHeader className="space-y-0.5 text-left">
              <DialogTitle className="font-display text-3xl font-semibold leading-tight text-[#8B1A2B] sm:text-[2.05rem]">
                {client.full_name}
              </DialogTitle>
              <div className="pt-1">
                <LeadScoreBadge score={client.lead_score} tier={client.lead_tier} tone="light" />
              </div>
              {client.phone ? (
                <a
                  href={`tel:${tel}`}
                  className="font-display text-2xl font-semibold leading-tight text-[#8B1A2B] hover:underline sm:text-[1.85rem]"
                >
                  {client.phone}
                </a>
              ) : (
                <p className="font-display text-2xl font-semibold text-muted-foreground">Няма телефон</p>
              )}
            </DialogHeader>
            {(client.email || client.cities?.name) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#8B1A2B]/80">
                {client.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-4 w-4 text-[#8B1A2B]" />{client.email}</span>}
                {client.cities?.name && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-[#8B1A2B]" />
                    {client.cities.name}{client.quarters?.name ? `, ${client.quarters.name}` : ""}
                  </span>
                )}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {client.phone && (
                <a href={`tel:${tel}`} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-accent/40 bg-background px-3 py-2 text-xs font-semibold text-primary transition hover:bg-accent/20">
                  <Phone className="h-3.5 w-3.5" /> Позвъни
                </a>
              )}
              {client.phone && (
                <a href={`https://wa.me/${waDigits}?text=${encodeURIComponent(greet)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#25D366]/50 bg-[#25D366]/10 px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#25D366]/20">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              )}
              {client.phone && (
                <a href={`viber://chat?number=%2B${waDigits}`} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#7360f2]/50 bg-[#7360f2]/10 px-3 py-2 text-xs font-semibold text-[#5b46d6] transition hover:bg-[#7360f2]/20">
                  <MessageCircle className="h-3.5 w-3.5" /> Viber
                </a>
              )}
              <button
                type="button"
                onClick={scheduleViewing}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-primary/30 bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
              >
                <CalendarPlus className="h-3.5 w-3.5" /> Оглед
              </button>
              <button
                type="button"
                onClick={() => onEdit(client)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-accent/40 bg-background px-3 py-2 text-xs font-semibold text-primary hover:bg-accent/20"
              >
                <Pencil className="h-3.5 w-3.5" /> Редакция
              </button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-1.5 rounded-full border border-accent/40 bg-background px-3 py-2 text-xs font-semibold text-primary hover:bg-accent/20"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" /> Още
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[80] min-w-[200px]">
                  {client.phone && (
                    <DropdownMenuItem onSelect={() => copyText(client.phone, "Телефонът е копиран.")}>
                      <Copy className="h-3.5 w-3.5" /> Копирай тел.
                    </DropdownMenuItem>
                  )}
                  {client.phone && (
                    <DropdownMenuItem asChild>
                      <a href={`sms:${tel}?&body=${encodeURIComponent(greet)}`}>
                        <MessageSquare className="h-3.5 w-3.5" /> SMS
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => copyText(clientBrief(), "Краткият профил е копиран — залепи го във WhatsApp или бележка.")}>
                    <ClipboardList className="h-3.5 w-3.5" /> Копирай досие
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={copyMissingDocs}>
                    <FileText className="h-3.5 w-3.5" /> Какво липсва
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div
          ref={cardScrollRef}
          data-client-card-scroll
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-3 [overflow-anchor:none]"
        >
          <div className="overflow-hidden rounded-[22px] border border-accent/35 bg-background/85 p-4">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <div className="font-display text-lg text-primary">Пътят на сделката</div>
                <div className="text-xs text-muted-foreground">{stage.label} · {stage.pct}%</div>
              </div>
            </div>
            <Progress value={stage.pct} className="mb-4 h-1.5" />
            <div className="flex items-start">
              {STAGES.map((s, i) => {
                const active = s.key === (client.deal_stage ?? null);
                const done = currentStageIdx >= 0 && i <= currentStageIdx;
                return (
                  <div key={s.label} className="flex min-w-0 flex-1 items-start">
                    <button
                      type="button"
                      onClick={() => setStage(s.key)}
                      disabled={busy}
                      className="flex min-w-0 flex-col items-center gap-1.5"
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : done
                            ? "border-accent bg-accent/30 text-primary"
                            : "border-border bg-background text-muted-foreground"
                      }`}>
                        {i + 1}
                      </span>
                      <span className={`max-w-[4.6rem] text-center text-[10px] leading-tight ${active ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                        {s.label}
                      </span>
                    </button>
                    {i < STAGES.length - 1 && (
                      <div className={`mx-1 mt-4 h-px min-w-[8px] flex-1 ${done && i < currentStageIdx ? "bg-accent" : "bg-border"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-accent/20 pt-3">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await qualifyClient({ data: { clientId: client.id, useAi: true, applyFields: true } });
                    toast.success(`Оценка ${r.lead_score}/100`);
                    await onChanged();
                  } catch (e: any) {
                    toast.error(e?.message ?? "Квалификацията не успя");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Sparkles className="h-3.5 w-3.5" /> Оцени с AI
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" asChild>
                <Link to="/admin/contracts" search={{ client: client.id }}>
                  <FileSignature className="h-3.5 w-3.5" /> Генерирай договор
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setBanksOpen(true)}>
                <CreditCard className="h-3.5 w-3.5" /> Кандидатура кредит
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => onMortgageStages(client)}>
                <Handshake className="h-3.5 w-3.5" /> Етапи на ипотека
              </Button>
              {client.deal_stage && (
                <Button variant="outline" size="sm" className="rounded-full text-rose-600" onClick={() => setStage(null)}>
                  <XCircle className="h-3.5 w-3.5" /> Откажи сделката
                </Button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setBanksOpen(true)}
            className="mt-4 flex w-full items-center gap-3 overflow-hidden rounded-2xl border-2 border-primary/40 bg-primary text-left text-primary-foreground shadow-sm"
          >
            <img src={CHAPTER_PHOTO.mortgage} alt="" className="h-20 w-28 flex-none object-cover object-center" />
            <span className="py-2 pr-3">
              <span className="block font-display text-lg leading-tight">Банки в Шумен</span>
              <span className="block text-[11px] opacity-90">Натисни тук — отваря се прозорец за избор на банка (ДСК, ОББ…)</span>
            </span>
          </button>

          <nav className="sticky top-0 z-10 -mx-5 mt-4 flex gap-1 overflow-x-auto bg-[#faf6ee] px-5 py-2">
            {chapterNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => jumpTo(item.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  openChapters[item.id]
                    ? "bg-primary text-primary-foreground"
                    : "border border-accent/40 bg-background text-primary hover:bg-accent/20"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="[overflow-anchor:none]">
            <Chapter
              id="info"
              icon={Sparkles}
              title="Какво търси"
              hint={client.search_property_type || client.search_status || "критерии"}
              thumb={CHAPTER_PHOTO.info}
              open={!!openChapters.info}
              onToggle={() => toggleChapter("info")}
            >
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <Info label="Тип имот" value={client.search_property_type ?? "—"} icon={Home} />
                <Info label="Продажба/Наем" value={client.search_status ?? "—"} icon={KeyRound} />
                <Info label="Бюджет" value={budgetLine ?? "—"} icon={CreditCard} />
                <Info label="Стаи" value={roomsLine ?? "—"} icon={Home} />
                <Info label="Площ" value={areaLine ?? "—"} icon={Sparkles} />
                <Info label="Брокер" value={client.brokers?.full_name ?? "—"} icon={Users} />
                <Info
                  label="Квалификация"
                  value={
                    client.lead_score != null
                      ? `${client.lead_score}/100 · ${client.qualification_source === "ai" ? "AI" : "евристика"}`
                      : "няма оценка"
                  }
                  icon={Sparkles}
                />
              </dl>
            </Chapter>

            <Chapter
              id="notes"
              icon={FileText}
              title="История и бележки"
              hint={notes.trim() ? "има текст" : "празно"}
              thumb={CHAPTER_PHOTO.notes}
              open={!!openChapters.notes}
              onToggle={() => toggleChapter("notes")}
            >
              <textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Опиши клиента, предпочитания, договорки, обаждания..."
                className="w-full rounded-xl border border-accent/25 bg-[#fffdf8] px-3 py-2.5 text-sm leading-relaxed"
              />
              <Button size="sm" className="mt-2 rounded-full" onClick={saveNotes} disabled={busy}>
                <Save className="h-3.5 w-3.5" /> {busy ? "Запис..." : "Запази бележки"}
              </Button>
            </Chapter>

            <Chapter
              id="docs"
              icon={Upload}
              title="Документи за кредита"
              hint={`${clientDocCount}`}
              thumb={CHAPTER_PHOTO.docs}
              open={!!openChapters.docs}
              onToggle={() => toggleChapter("docs")}
            >
              {missingDocLines("").length > 0 && (
                <button
                  type="button"
                  onClick={copyMissingDocs}
                  className="mb-3 w-full rounded-xl border border-amber-400/50 bg-amber-50 px-3 py-2 text-left text-xs text-amber-950 hover:bg-amber-100"
                >
                  Липсват {missingDocLines("").length} неща за кредита. Натисни, за да копираш списъка и да го пратиш на клиента.
                </button>
              )}
              <a
                href={`/admin/documents?client=${client.id}`}
                className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-amber-800 underline-offset-2 hover:underline"
              >
                Към бюрото за документи
              </a>
              {renderDocsSubject("")}
            </Chapter>

            <Chapter
              id="deposit"
              icon={CreditCard}
              title="Депозит и харесан имот"
              hint={dep.amount ? `${dep.amount} ${dep.currency}` : "няма сума"}
              thumb={CHAPTER_PHOTO.deposit}
              open={!!openChapters.deposit}
              onToggle={() => toggleChapter("deposit")}
            >
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="mb-1 block text-muted-foreground">Сума</span>
                  <input
                    type="number" inputMode="decimal" value={dep.amount}
                    onChange={(e) => setDep({ ...dep, amount: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-muted-foreground">Валута</span>
                  <select
                    value={dep.currency}
                    onChange={(e) => setDep({ ...dep, currency: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  >
                    <option value="EUR">EUR</option>
                    <option value="BGN">BGN</option>
                  </select>
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-muted-foreground">Дата</span>
                  <input
                    type="date" value={dep.date}
                    onChange={(e) => setDep({ ...dep, date: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-muted-foreground">Начин на плащане</span>
                  <select
                    value={dep.method}
                    onChange={(e) => setDep({ ...dep, method: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    <option value="В брой">В брой</option>
                    <option value="Банков превод">Банков превод</option>
                    <option value="Карта">Карта</option>
                  </select>
                </label>
                <label className="col-span-2 text-xs">
                  <span className="mb-1 block text-muted-foreground">Статус на депозита</span>
                  <select
                    value={dep.status}
                    onChange={(e) => setDep({ ...dep, status: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  >
                    <option value="">—</option>
                    <option value="Оставен">Оставен</option>
                    <option value="Върнат">Върнат</option>
                    <option value="Приспаднат">Приспаднат от цената</option>
                  </select>
                </label>
                <label className="col-span-2 text-xs">
                  <span className="mb-1 block text-muted-foreground">Бележка за депозита</span>
                  <textarea
                    rows={2} value={dep.note}
                    onChange={(e) => setDep({ ...dep, note: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  />
                </label>
              </div>

              <div className="mt-4 rounded-xl border border-accent/25 bg-[#fffdf8] p-3">
                <div className="mb-2 font-display text-base text-primary">Харесан имот</div>
                {interestPropertyId ? (
                  <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs">
                    <span className="truncate">
                      {propResults.find((p) => p.id === interestPropertyId)?.title ?? `Свързан имот: ${interestPropertyId.slice(0, 8)}…`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setInterestPropertyId(null)}
                      className="shrink-0 text-primary/70 hover:text-destructive"
                      aria-label="Премахни връзката"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <input
                    value={propQuery}
                    onChange={(e) => setPropQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchProps(propQuery); } }}
                    placeholder="Търси имот от сайта по заглавие…"
                    className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={() => searchProps(propQuery)} disabled={propSearching}>
                    {propSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Търси"}
                  </Button>
                </div>
                {propResults.length > 0 ? (
                  <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                    {propResults.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setInterestPropertyId(p.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs hover:border-primary/30 hover:bg-primary/5"
                        >
                          <span className="truncate">
                            {p.title}
                            <span className="ml-1 text-muted-foreground">{p.cities?.name ? `· ${p.cities.name}` : ""}</span>
                          </span>
                          <span className="shrink-0 font-semibold">
                            {p.price != null ? `${Number(p.price).toLocaleString("bg-BG")} ${p.currency ?? "EUR"}` : "—"}
                            {p.is_published ? "" : " (чернова)"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <label className="mt-2 block text-xs">
                  <span className="mb-1 block text-muted-foreground">Или опиши имота свободно</span>
                  <textarea
                    rows={2} value={interestNote}
                    onChange={(e) => setInterestNote(e.target.value)}
                    placeholder="Напр. тристаен в кв. Тракия, ет. 4, гараж…"
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" className="rounded-full" onClick={saveDeposit} disabled={savingDep}>
                  <Save className="h-3.5 w-3.5" /> {savingDep ? "Запис..." : "Запази"}
                </Button>
                <Button size="sm" variant="outline" className="rounded-full" onClick={depositReceipt}>
                  <FileSignature className="h-3.5 w-3.5" /> Разписка за депозит
                </Button>
              </div>
            </Chapter>

            <Chapter
              id="files"
              icon={FileText}
              title="Всички файлове и снимки"
              hint={`${docs.length}`}
              thumb={CHAPTER_PHOTO.files}
              open={!!openChapters.files}
              onToggle={() => toggleChapter("files")}
            >
              {renderFileLibrary()}
            </Chapter>

            <Chapter
              id="guarantors"
              icon={Users}
              title="Поръчители"
              hint={`${guarantors.length}`}
              thumb={CHAPTER_PHOTO.guarantors}
              last
              open={!!openChapters.guarantors}
              onToggle={() => toggleChapter("guarantors")}
            >
              <div className="space-y-3">
                {guarantors.length === 0 && (
                  <div className="rounded-lg border border-dashed border-accent/40 bg-background/60 p-3 text-center text-xs text-muted-foreground">
                    Все още няма добавени поръчители.
                  </div>
                )}
                {guarantors.map((g, idx) => {
                  const subject = `guarantor:${g.id}:`;
                  return (
                    <div key={g.id} className="rounded-xl border border-accent/30 bg-background p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Поръчител {idx + 1}</span>
                          <span className="truncate font-display text-base text-primary">{g.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => renameGuarantor(g.id)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" title="Преименувай">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => removeGuarantor(g.id)} className="rounded p-1 text-rose-500 hover:bg-rose-50" title="Премахни">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {renderDocsSubject(subject)}
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addGuarantor}
                  className="w-full rounded-full border-dashed border-primary/40 text-primary hover:bg-primary/5"
                >
                  <UserPlus className="h-4 w-4" /> Добави поръчител
                </Button>
              </div>
            </Chapter>
          </div>
        </div>
        <BankMortgageDesk
          client={client}
          open={banksOpen}
          onClose={() => setBanksOpen(false)}
          onSaved={() => onChanged()}
        />
        <ScheduleViewingDialog
          open={viewingOpen}
          onClose={() => setViewingOpen(false)}
          defaults={{
            client_id: client.id,
            broker_id: client.assigned_broker_id,
            property_id: interestPropertyId,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function Chapter({
  title,
  open,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  hint?: string;
  thumb?: string;
  open: boolean;
  onToggle: () => void;
  last?: boolean;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <section className="mt-4 rounded-2xl border border-accent/35 bg-background/90 p-4 [overflow-anchor:none]">
      <div className="mb-3 font-display text-xl text-primary">{title}</div>
      {children}
    </section>
  );
}

function Info({ label, value, icon: Icon }: { label: string; value: any; icon?: LucideIcon }) {
  return (
    <div className="rounded-xl border border-accent/25 bg-background px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3 text-primary" /> : null}
        {label}
      </div>
      <div className="truncate text-sm text-foreground">{String(value)}</div>
    </div>
  );
}
