import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  getClientDocuments,
  addClientDocument,
  deleteClientDocument,
  upsertClient,
  updateClientDeal,
  updateClientDepositInterest,
  searchPropertiesForLink,
} from "@/lib/crm.functions";
import {
  Phone,
  Mail,
  MapPin,
  FileText,
  Upload,
  Trash2,
  Pencil,
  Download,
  CreditCard,
  Handshake,
  XCircle,
  Sparkles,
  Save,
  Check,
  AlertCircle,
  Loader2,
  IdCard,
  Briefcase,
  FileSignature,
  ChevronDown,
  Users,
  UserPlus,
  MessageCircle,
} from "lucide-react";

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

const BG_MONTHS = [
  "Януари",
  "Февруари",
  "Март",
  "Април",
  "Май",
  "Юни",
  "Юли",
  "Август",
  "Септември",
  "Октомври",
  "Ноември",
  "Декември",
];

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

export function ClientDetailsSheet({
  client,
  open,
  onClose,
  onChanged,
  onEdit,
  onMortgageSend,
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
    amount: "",
    currency: "EUR",
    date: "",
    method: "",
    status: "",
    note: "",
  });
  const [interestNote, setInterestNote] = useState("");
  const [interestPropertyId, setInterestPropertyId] = useState<string | null>(null);
  const [propQuery, setPropQuery] = useState("");
  const [propResults, setPropResults] = useState<LinkableProperty[]>([]);
  const [propSearching, setPropSearching] = useState(false);
  const [savingDep, setSavingDep] = useState(false);

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
    getClientDocuments({ data: { client_id: client.id } })
      .then(setDocs)
      .catch(() => setDocs([]));
  }, [client?.id]);

  if (!client) return null;

  const stage = STAGES.find((s) => s.key === (client.deal_stage ?? null)) ?? STAGES[0];

  const saveNotes = async () => {
    setBusy(true);
    try {
      const { id, full_name, phone, email, client_type, status, currency } = client;
      await upsertClient({
        data: { id, full_name, phone, email, client_type, status, currency, notes },
      });
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const setStage = async (key: string | null) => {
    setBusy(true);
    try {
      await updateClientDeal({
        data: {
          id: client.id,
          deal_stage: key,
          deal_started_at: key ? new Date().toISOString() : null,
        },
      });
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const searchProps = async (q: string) => {
    setPropSearching(true);
    try {
      const rows = await searchPropertiesForLink({ data: { q } });
      setPropResults(rows as LinkableProperty[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при търсене");
    } finally {
      setPropSearching(false);
    }
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
      await onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    } finally {
      setSavingDep(false);
    }
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
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при запис на поръчителите");
    }
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
    saveGuarantors(guarantors.map((x) => (x.id === id ? { ...x, name: name.trim() } : x)));
  };

  const removeGuarantor = (id: string) => {
    if (!confirm("Премахване на поръчителя? Документите му ще останат, но няма да са видими."))
      return;
    saveGuarantors(guarantors.filter((x) => x.id !== id));
  };

  const reload = async () => setDocs(await getClientDocuments({ data: { client_id: client.id } }));

  const uploadFile = async (file: File, subject: string, category: string, month?: string) => {
    const docType = `${subject}${category}${month ? `:${month}` : ""}`;
    const key = `${subject}${category}-${month ?? "single"}`;
    setUploading(key);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${client.id}/${docType.replace(/:/g, "_")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("client-documents")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { data: signed } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      await addClientDocument({
        data: {
          client_id: client.id,
          document_type: docType,
          file_url: signed?.signedUrl ?? path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        },
      });
      await reload();
    } finally {
      setUploading(null);
    }
  };

  const docsFor = (subject: string, category: string, month?: string) =>
    docs.filter((d) => d.document_type === `${subject}${category}${month ? `:${month}` : ""}`);
  const monthsCompleted = (subject: string, category: string) =>
    months.filter((m) => docsFor(subject, category, m.key).length > 0).length;

  const removeDoc = async (id: string) => {
    if (!confirm("Изтриване?")) return;
    await deleteClientDocument({ data: { id } });
    await reload();
  };

  /** Заменя файл: качва новия под същия тип и изтрива стария запис. */
  const replaceDoc = async (doc: any, file: File) => {
    setUploading(`replace-${doc.id}`);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${client.id}/${String(doc.document_type).replace(/:/g, "_")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("client-documents")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { data: signed } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      await addClientDocument({
        data: {
          client_id: client.id,
          document_type: String(doc.document_type),
          file_url: signed?.signedUrl ?? path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        },
      });
      await deleteClientDocument({ data: { id: doc.id } });
      await reload();
      toast.success("Файлът е заменен.");
    } finally {
      setUploading(null);
    }
  };

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
    String(d.mime_type ?? "").startsWith("image/") ||
    /\.(jpe?g|png|webp|heic|gif)$/i.test(String(d.file_name ?? ""));

  const renderFileLibrary = () => (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-background px-3 py-3 text-xs font-medium text-primary hover:border-primary/60">
        {uploading === "other-single" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
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
            <div
              key={d.id}
              className="flex gap-2 rounded-xl border border-border bg-background p-2"
            >
              {isImageDoc(d) ? (
                <a
                  href={d.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-none"
                >
                  <img
                    src={d.file_url}
                    alt={d.file_name}
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                </a>
              ) : (
                <div className="flex h-16 w-16 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <a
                  href={d.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs font-medium text-primary hover:underline"
                >
                  {d.file_name}
                </a>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {String(d.document_type)}
                  {d.file_size
                    ? ` · ${Math.max(1, Math.round(Number(d.file_size) / 1024))} KB`
                    : ""}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => downloadDoc(d)}
                    className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/20"
                  >
                    <Download className="h-3 w-3" /> Свали
                  </button>
                  <label className="flex cursor-pointer items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-800 hover:bg-amber-500/25">
                    {uploading === `replace-${d.id}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}{" "}
                    Замени
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
                  <button
                    type="button"
                    onClick={() => removeDoc(d.id)}
                    className="flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-700 hover:bg-rose-500/25"
                  >
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
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${allDone ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}
                >
                  {completed}/12
                </span>
                {allDone && <Check className="h-4 w-4 text-emerald-600" />}
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition ${isOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 gap-1.5 border-t border-border p-2 sm:grid-cols-3">
                {months.map((m) => {
                  const items = docsFor(subject, cat.id, m.key);
                  const ok = items.length > 0;
                  const isUp = uploading === `${subject}${cat.id}-${m.key}`;
                  return (
                    <label
                      key={m.key}
                      className={`group flex cursor-pointer flex-col gap-1 rounded-lg border p-2 text-[11px] transition ${
                        ok
                          ? "border-emerald-400/60 bg-emerald-50"
                          : "border-dashed border-rose-300/60 bg-rose-50/40 hover:border-rose-400"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`truncate font-medium ${ok ? "text-emerald-800" : "text-rose-700"}`}
                        >
                          {m.label}
                        </span>
                        {ok ? (
                          <Check className="h-3.5 w-3.5 flex-none text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 flex-none text-rose-500" />
                        )}
                      </div>
                      {items.length > 0 ? (
                        <div className="space-y-0.5">
                          {items.map((f) => (
                            <div
                              key={f.id}
                              className="flex items-center justify-between gap-1 text-[10px] text-emerald-700/90"
                            >
                              <a
                                href={f.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="truncate hover:underline"
                              >
                                {f.file_name}
                              </a>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  removeDoc(f.id);
                                }}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-rose-600/80">
                          {isUp ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" /> Качване…
                            </>
                          ) : (
                            <>
                              <Upload className="h-3 w-3" /> Добави
                            </>
                          )}
                        </div>
                      )}
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
          return (
            <label
              key={`${subject}${cat.id}`}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 border-dashed p-2.5 text-xs transition ${
                ok
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-primary/25 bg-background hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <cat.icon className="h-3.5 w-3.5 flex-none text-primary" />
                  <span className="truncate font-medium text-primary">{cat.label}</span>
                </div>
                {ok ? (
                  <Check className="h-4 w-4 flex-none text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 flex-none text-rose-500" />
                )}
              </div>
              {items.length > 0 ? (
                <div className="space-y-0.5 text-[10px] text-emerald-800">
                  {items.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-1">
                      <a
                        href={f.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:underline"
                      >
                        {f.file_name}
                      </a>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          removeDoc(f.id);
                        }}
                        className="text-rose-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {isUp ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Качване…
                    </>
                  ) : (
                    <>
                      <Upload className="h-3 w-3" /> Добави документ
                    </>
                  )}
                </div>
              )}
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

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-2xl text-primary">{client.full_name}</SheetTitle>
        </SheetHeader>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {client.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {client.phone}
            </span>
          )}
          {client.email && (
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {client.email}
            </span>
          )}
          {client.cities?.name && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {client.cities.name}
              {client.quarters?.name ? `, ${client.quarters.name}` : ""}
            </span>
          )}
        </div>

        {client.phone &&
          (() => {
            const tel = phoneTel(client.phone);
            const waDigits = tel.replace(/\D/g, "");
            const greet = `Здравейте, ${client.full_name?.split(" ")[0] ?? ""}!`;
            return (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <a
                  href={`tel:${tel}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold text-primary transition hover:bg-accent"
                >
                  <Phone className="h-3.5 w-3.5" /> Позвъни
                </a>
                <a
                  href={`https://wa.me/${waDigits}?text=${encodeURIComponent(greet)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#25D366]/60 bg-[#25D366]/10 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#25D366]/20"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
                <a
                  href={`viber://chat?number=%2B${waDigits}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#7360f2]/60 bg-[#7360f2]/10 py-2 text-xs font-semibold text-[#5b46d6] transition hover:bg-[#7360f2]/20"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Viber
                </a>
              </div>
            );
          })()}

        {/* Deal progress */}
        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-primary">Етап на сделка</div>
            <div className="text-xs font-medium text-primary">
              {stage.label} · {stage.pct}%
            </div>
          </div>
          <Progress value={stage.pct} className="h-2" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <button
                key={s.label}
                onClick={() => setStage(s.key)}
                disabled={busy}
                className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                  s.key === (client.deal_stage ?? null)
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(client)}>
            <Pencil className="h-3.5 w-3.5" /> Редакция
          </Button>
          <Button variant="outline" size="sm" onClick={() => onMortgageSend(client)}>
            <CreditCard className="h-3.5 w-3.5" /> Кандидатура кредит
          </Button>
          <Button variant="outline" size="sm" onClick={() => onMortgageStages(client)}>
            <Handshake className="h-3.5 w-3.5" /> Етапи на ипотека
          </Button>
          {client.deal_stage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStage(null)}
              className="text-rose-500"
            >
              <XCircle className="h-3.5 w-3.5" /> Откажи сделката
            </Button>
          )}
        </div>

        {/* Sections */}
        <Accordion type="multiple" defaultValue={["notes", "docs"]} className="mt-4">
          <AccordionItem value="info">
            <AccordionTrigger className="text-sm">
              <Sparkles className="mr-2 h-3.5 w-3.5 text-primary" />
              Критерии за търсене
            </AccordionTrigger>
            <AccordionContent>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <Info label="Тип имот" value={client.search_property_type ?? "—"} />
                <Info label="Продажба/Наем" value={client.search_status ?? "—"} />
                <Info
                  label="Бюджет"
                  value={
                    client.budget_min || client.budget_max
                      ? `${client.budget_min ?? "?"} – ${client.budget_max ?? "?"} ${client.currency}`
                      : "—"
                  }
                />
                <Info
                  label="Стаи"
                  value={
                    client.rooms_min || client.rooms_max
                      ? `${client.rooms_min ?? "?"} – ${client.rooms_max ?? "?"}`
                      : "—"
                  }
                />
                <Info
                  label="Площ (m²)"
                  value={
                    client.area_min || client.area_max
                      ? `${client.area_min ?? "?"} – ${client.area_max ?? "?"}`
                      : "—"
                  }
                />
                <Info label="Брокер" value={client.brokers?.full_name ?? "—"} />
              </dl>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notes">
            <AccordionTrigger className="text-sm">
              <FileText className="mr-2 h-3.5 w-3.5 text-primary" />
              Описание / Бележки
            </AccordionTrigger>
            <AccordionContent>
              <textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Опиши клиента, предпочитания, договорки, обаждания..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <Button size="sm" className="mt-2" onClick={saveNotes} disabled={busy}>
                <Save className="h-3.5 w-3.5" /> {busy ? "Запис..." : "Запази бележки"}
              </Button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="docs">
            <AccordionTrigger className="text-sm">
              <Upload className="mr-2 h-3.5 w-3.5 text-primary" />
              Документи на клиента (
              {docs.filter((d) => !String(d.document_type).startsWith("guarantor:")).length})
            </AccordionTrigger>
            <AccordionContent>{renderDocsSubject("")}</AccordionContent>
          </AccordionItem>

          <AccordionItem value="files">
            <AccordionTrigger className="text-sm">
              <FileText className="mr-2 h-3.5 w-3.5 text-primary" />
              Всички файлове и снимки ({docs.length})
            </AccordionTrigger>
            <AccordionContent>{renderFileLibrary()}</AccordionContent>
          </AccordionItem>

          <AccordionItem value="deposit">
            <AccordionTrigger className="text-sm">
              <CreditCard className="mr-2 h-3.5 w-3.5 text-primary" />
              Депозит и харесан имот
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="mb-1 block text-muted-foreground">Сума</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={dep.amount}
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
                    type="date"
                    value={dep.date}
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
                    rows={2}
                    value={dep.note}
                    onChange={(e) => setDep({ ...dep, note: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  />
                </label>
              </div>

              <div className="mt-4 rounded-xl border border-primary/15 bg-background/60 p-2.5">
                <div className="mb-2 text-xs font-semibold text-primary">Харесан имот</div>
                {interestPropertyId ? (
                  <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs">
                    <span className="truncate">
                      {propResults.find((p) => p.id === interestPropertyId)?.title ??
                        `Свързан имот: ${interestPropertyId.slice(0, 8)}…`}
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        searchProps(propQuery);
                      }
                    }}
                    placeholder="Търси имот от сайта по заглавие…"
                    className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => searchProps(propQuery)}
                    disabled={propSearching}
                  >
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
                            <span className="ml-1 text-muted-foreground">
                              {p.cities?.name ? `· ${p.cities.name}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold">
                            {p.price != null
                              ? `${Number(p.price).toLocaleString("bg-BG")} ${p.currency ?? "EUR"}`
                              : "—"}
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
                    rows={2}
                    value={interestNote}
                    onChange={(e) => setInterestNote(e.target.value)}
                    placeholder="Напр. тристаен в кв. Тракия, ет. 4, гараж…"
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={saveDeposit} disabled={savingDep}>
                  <Save className="h-3.5 w-3.5" /> {savingDep ? "Запис..." : "Запази"}
                </Button>
                <Button size="sm" variant="outline" onClick={depositReceipt}>
                  <FileSignature className="h-3.5 w-3.5" /> Разписка за депозит
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="guarantors">
            <AccordionTrigger className="text-sm">
              <Users className="mr-2 h-3.5 w-3.5 text-primary" />
              Поръчители ({guarantors.length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {guarantors.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
                    Все още няма добавени поръчители.
                  </div>
                )}
                {guarantors.map((g, idx) => {
                  const subject = `guarantor:${g.id}:`;
                  return (
                    <div key={g.id} className="rounded-xl border border-primary/20 bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Поръчител {idx + 1}
                          </span>
                          <span className="truncate text-sm font-medium text-primary">
                            {g.name}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => renameGuarantor(g.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                            title="Преименувай"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeGuarantor(g.id)}
                            className="rounded p-1 text-rose-500 hover:bg-rose-50"
                            title="Премахни"
                          >
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
                  className="w-full border-dashed border-primary/40 text-primary hover:bg-primary/5"
                >
                  <UserPlus className="h-4 w-4" /> Добави поръчител
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-foreground">{String(value)}</div>
    </div>
  );
}
