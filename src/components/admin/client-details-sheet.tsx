import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  getClientDocuments,
  addClientDocument,
  deleteClientDocument,
  upsertClient,
  updateClientDeal,
} from "@/lib/crm.functions";
import {
  Phone, Mail, MapPin, FileText, Upload, Trash2, Pencil,
  CreditCard, Handshake, XCircle, Sparkles, Save,
  Check, AlertCircle, Loader2, IdCard, Briefcase, FileSignature, ChevronDown,
  Users, UserPlus, MessageCircle,
} from "lucide-react";

function phoneTel(raw: string | null | undefined) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("359")) return `+${digits}`;
  if (digits.startsWith("0")) return `+359${digits.slice(1)}`;
  return `+${digits}`;
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

  useEffect(() => {
    if (!client) return;
    setNotes(client.notes ?? "");
    setGuarantors((client.mortgage_data?.guarantors as Guarantor[]) ?? []);
    getClientDocuments({ data: { client_id: client.id } }).then(setDocs).catch(() => setDocs([]));
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
    } catch (e: any) { toast.error(e?.message ?? "Грешка"); }
    finally { setBusy(false); }
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

  const removeDoc = async (id: string) => {
    if (!confirm("Изтриване?")) return;
    await deleteClientDocument({ data: { id } });
    await reload();
  };

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
                  return (
                    <label
                      key={m.key}
                      className={`group flex cursor-pointer flex-col gap-1 rounded-lg border p-2 text-[11px] transition ${
                        ok ? "border-emerald-400/60 bg-emerald-50" : "border-dashed border-rose-300/60 bg-rose-50/40 hover:border-rose-400"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className={`truncate font-medium ${ok ? "text-emerald-800" : "text-rose-700"}`}>{m.label}</span>
                        {ok ? <Check className="h-3.5 w-3.5 flex-none text-emerald-600" /> : <AlertCircle className="h-3.5 w-3.5 flex-none text-rose-500" />}
                      </div>
                      {items.length > 0 ? (
                        <div className="space-y-0.5">
                          {items.map((f) => (
                            <div key={f.id} className="flex items-center justify-between gap-1 text-[10px] text-emerald-700/90">
                              <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">{f.file_name}</a>
                              <button type="button" onClick={(e) => { e.preventDefault(); removeDoc(f.id); }} className="text-rose-500 hover:text-rose-700"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-rose-600/80">
                          {isUp ? <><Loader2 className="h-3 w-3 animate-spin" /> Качване…</> : <><Upload className="h-3 w-3" /> Добави</>}
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
                ok ? "border-emerald-400 bg-emerald-50" : "border-primary/25 bg-background hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <cat.icon className="h-3.5 w-3.5 flex-none text-primary" />
                  <span className="truncate font-medium text-primary">{cat.label}</span>
                </div>
                {ok ? <Check className="h-4 w-4 flex-none text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-none text-rose-500" />}
              </div>
              {items.length > 0 ? (
                <div className="space-y-0.5 text-[10px] text-emerald-800">
                  {items.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-1">
                      <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">{f.file_name}</a>
                      <button type="button" onClick={(e) => { e.preventDefault(); removeDoc(f.id); }} className="text-rose-500"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {isUp ? <><Loader2 className="h-3 w-3 animate-spin" /> Качване…</> : <><Upload className="h-3 w-3" /> Добави документ</>}
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
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl text-primary">{client.full_name}</SheetTitle>
        </SheetHeader>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {client.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>}
          {client.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</span>}
          {client.cities?.name && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{client.cities.name}{client.quarters?.name ? `, ${client.quarters.name}` : ""}</span>}
        </div>

        {/* Deal progress */}
        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-primary">Етап на сделка</div>
            <div className="text-xs font-medium text-primary">{stage.label} · {stage.pct}%</div>
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
            <Button variant="outline" size="sm" onClick={() => setStage(null)} className="text-rose-500">
              <XCircle className="h-3.5 w-3.5" /> Откажи сделката
            </Button>
          )}
        </div>

        {/* Sections */}
        <Accordion type="multiple" defaultValue={["notes", "docs"]} className="mt-4">
          <AccordionItem value="info">
            <AccordionTrigger className="text-sm"><Sparkles className="mr-2 h-3.5 w-3.5 text-primary" />Критерии за търсене</AccordionTrigger>
            <AccordionContent>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <Info label="Тип имот" value={client.search_property_type ?? "—"} />
                <Info label="Продажба/Наем" value={client.search_status ?? "—"} />
                <Info label="Бюджет" value={client.budget_min || client.budget_max ? `${client.budget_min ?? "?"} – ${client.budget_max ?? "?"} ${client.currency}` : "—"} />
                <Info label="Стаи" value={client.rooms_min || client.rooms_max ? `${client.rooms_min ?? "?"} – ${client.rooms_max ?? "?"}` : "—"} />
                <Info label="Площ (m²)" value={client.area_min || client.area_max ? `${client.area_min ?? "?"} – ${client.area_max ?? "?"}` : "—"} />
                <Info label="Брокер" value={client.brokers?.full_name ?? "—"} />
              </dl>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notes">
            <AccordionTrigger className="text-sm"><FileText className="mr-2 h-3.5 w-3.5 text-primary" />Описание / Бележки</AccordionTrigger>
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
              <Upload className="mr-2 h-3.5 w-3.5 text-primary" />Документи на клиента ({docs.filter((d) => !String(d.document_type).startsWith("guarantor:")).length})
            </AccordionTrigger>
            <AccordionContent>
              {renderDocsSubject("")}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="guarantors">
            <AccordionTrigger className="text-sm">
              <Users className="mr-2 h-3.5 w-3.5 text-primary" />Поръчители ({guarantors.length})
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
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Поръчител {idx + 1}</span>
                          <span className="truncate text-sm font-medium text-primary">{g.name}</span>
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
