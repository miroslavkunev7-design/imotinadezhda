import { useEffect, useState } from "react";
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
} from "lucide-react";

type Client = any;

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
  const [docType, setDocType] = useState("id_card");

  useEffect(() => {
    if (!client) return;
    setNotes(client.notes ?? "");
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
    } catch (e: any) { alert(e?.message ?? "Грешка"); }
    finally { setBusy(false); }
  };

  const setStage = async (key: string | null) => {
    setBusy(true);
    try {
      await updateClientDeal({
        data: { id: client.id, deal_stage: key, deal_started_at: key ? new Date().toISOString() : null },
      });
      await onChanged();
    } catch (e: any) { alert(e?.message ?? "Грешка"); }
    finally { setBusy(false); }
  };

  const uploadDocs = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${client.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("client-documents").upload(path, file, { contentType: file.type });
        if (upErr) { alert(upErr.message); continue; }
        const { data: signed } = await supabase.storage.from("client-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
        await addClientDocument({ data: {
          client_id: client.id,
          document_type: docType,
          file_url: signed?.signedUrl ?? path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        } });
      }
      setDocs(await getClientDocuments({ data: { client_id: client.id } }));
    } finally { setBusy(false); }
  };

  const removeDoc = async (id: string) => {
    if (!confirm("Изтриване?")) return;
    await deleteClientDocument({ data: { id } });
    setDocs(await getClientDocuments({ data: { client_id: client.id } }));
  };

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
            <AccordionTrigger className="text-sm"><Upload className="mr-2 h-3.5 w-3.5 text-primary" />Документи ({docs.length})</AccordionTrigger>
            <AccordionContent>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded border border-input bg-background px-2 py-1.5 text-xs">
                  <option value="id_card">Лична карта</option>
                  <option value="bank_statement">Банково извлечение</option>
                  <option value="contract">Договор</option>
                  <option value="other">Друго</option>
                </select>
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs text-primary hover:bg-primary/10">
                  <Upload className="h-3.5 w-3.5" /> {busy ? "Качване…" : "Качи файл"}
                  <input type="file" multiple className="hidden" onChange={(e) => uploadDocs(e.target.files)} disabled={busy} />
                </label>
              </div>
              <div className="space-y-1.5">
                {docs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs">
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 truncate hover:underline">
                      <FileText className="h-3.5 w-3.5 flex-none text-primary" />
                      <span className="truncate">{d.file_name}</span>
                    </a>
                    <button onClick={() => removeDoc(d.id)} className="text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {!docs.length && <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">Няма качени документи.</div>}
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
