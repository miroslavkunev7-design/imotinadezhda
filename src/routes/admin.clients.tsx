import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil, X, Upload, FileText, Phone, Mail, MapPin, AlertTriangle, Sparkles, CreditCard, Camera } from "lucide-react";
import { listClients, upsertClient, deleteClient, getClientDocuments, addClientDocument, deleteClientDocument } from "@/lib/crm.functions";
import { MortgageSendModal } from "@/components/admin/mortgage-send-modal";
import { MortgageStagesModal } from "@/components/admin/mortgage-stages-modal";
import { ClientDetailsSheet } from "@/components/admin/client-details-sheet";
import { ClientScanModal } from "@/components/admin/client-scan-modal";


export const Route = createFileRoute("/admin/clients")({
  component: ClientsAdmin,
});

type Client = any;

function ClientsAdmin() {
  const [rows, setRows] = useState<Client[]>([]);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [quarters, setQuarters] = useState<{ id: string; name: string; city_id: string }[]>([]);
  const [brokers, setBrokers] = useState<{ id: string; full_name: string; user_id: string | null }[]>([]);
  const [editing, setEditing] = useState<Partial<Client> | null>(null);
  const [docsFor, setDocsFor] = useState<Client | null>(null);
  const [mortgageFor, setMortgageFor] = useState<Client | null>(null);
  const [mortgageStagesFor, setMortgageStagesFor] = useState<Client | null>(null);
  const [detailsFor, setDetailsFor] = useState<Client | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBroker, setFilterBroker] = useState("");

  const load = async () => {
    const [clientsData, { data: cs }, { data: qs }, { data: bs }] = await Promise.all([
      listClients(),
      supabase.from("cities").select("id, name").order("display_order"),
      supabase.from("quarters").select("id, name, city_id").order("display_order"),
      supabase.from("brokers").select("id, full_name, user_id").order("full_name"),
    ]);
    setRows(clientsData ?? []);
    setCities(cs ?? []);
    setQuarters(qs ?? []);
    setBrokers(bs ?? []);
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

  const newClient = () => setEditing({
    full_name: "", phone: "", email: "", client_type: "buyer", status: "active", currency: "EUR",
  });

  const filteredQuarters = editing?.search_city_id ? quarters.filter((q) => q.city_id === editing.search_city_id) : [];
  const filtered = rows.filter((r) => {
    if (search.trim() && !(r.full_name + " " + (r.phone ?? "") + " " + (r.email ?? "")).toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && r.client_type !== filterType) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterBroker && (r.assigned_broker_id ?? "") !== filterBroker) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-amber-100">Клиенти</h1>
          <p className="mt-1 text-sm text-amber-100/60">{rows.length} записа</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Търси..." className="w-full sm:w-auto rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-100/40" />
          <Button onClick={() => setScanOpen(true)} variant="outline" className="border-amber-500/50 text-amber-100 hover:bg-amber-500/15">
            <Camera className="h-4 w-4" /> Сканирай
          </Button>
          <Button onClick={newClient} className="gold-cta-button"><Plus className="h-4 w-4" /> Нов клиент</Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.6)] p-3">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-1.5 text-sm text-amber-100">
          <option value="">Тип: всички</option>
          <option value="buyer">Купувач</option>
          <option value="seller">Продавач</option>
          <option value="tenant">Наемател</option>
          <option value="landlord">Наемодател</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-1.5 text-sm text-amber-100">
          <option value="">Статус: всички</option>
          <option value="active">Активен</option>
          <option value="paused">Пауза</option>
          <option value="closed">Затворен</option>
        </select>
        <select value={filterBroker} onChange={(e) => setFilterBroker(e.target.value)} className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-1.5 text-sm text-amber-100">
          <option value="">Брокер: всички</option>
          {brokers.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
        </select>
        {(filterType || filterStatus || filterBroker) && (
          <button onClick={() => { setFilterType(""); setFilterStatus(""); setFilterBroker(""); }} className="text-xs text-amber-100/60 underline">Изчисти</button>
        )}
        <span className="ml-auto text-xs text-amber-100/50 self-center">{filtered.length} / {rows.length}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255, 255, 255,0.85)]">
        <table className="w-full min-w-[760px] text-sm text-amber-100">
          <thead className="bg-[rgba(40,8,16,0.7)] text-left text-amber-100/80">
            <tr>
              <th className="px-4 py-3">Име</th>
              <th className="px-4 py-3">Контакт</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Търси</th>
              <th className="px-4 py-3">Бюджет</th>
              <th className="px-4 py-3">Брокер</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-amber-500/10 hover:bg-amber-500/5">
                <td className="px-4 py-2 font-semibold">
                  <button
                    onClick={() => setDetailsFor(r)}
                    className="flex items-center gap-2 text-left hover:text-amber-300"
                  >
                    {r.full_name}
                    {r.deal_stage === "mortgage" && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">ипотека</span>
                    )}
                    {r.deal_stage === "started" && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-300">сделка</span>
                    )}
                  </button>
                </td>

                <td className="px-4 py-2 text-xs">
                  {r.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</div>}
                  {r.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</div>}
                </td>
                <td className="px-4 py-2"><span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs">{labelType(r.client_type)}</span></td>
                <td className="px-4 py-2 text-xs">
                  {r.cities?.name && <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.cities.name}{r.quarters?.name ? `, ${r.quarters.name}` : ""}</div>}
                  {r.search_property_type && <div>{r.search_property_type}</div>}
                </td>
                <td className="px-4 py-2 text-xs">
                  {r.budget_min || r.budget_max ? `${r.budget_min ?? "?"} – ${r.budget_max ?? "?"} ${r.currency}` : "—"}
                </td>
                <td className="px-4 py-2 text-xs">{r.brokers?.full_name ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <button className="mr-2 text-amber-300" title="Кандидатура за ипотечен кредит" onClick={() => setMortgageFor(r)}><CreditCard className="h-4 w-4" /></button>
                  <button className="mr-2 text-amber-300" title="Документи" onClick={() => setDocsFor(r)}><FileText className="h-4 w-4" /></button>
                  <button className="mr-2 text-amber-300" title="Редакция" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></button>
                  <button className="text-rose-400" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-amber-100/40">Няма клиенти. Добави нов.</td></tr>}
          </tbody>
        </table>
      </div>

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
      {mortgageFor && <MortgageSendModal client={mortgageFor} onClose={() => setMortgageFor(null)} />}
      {mortgageStagesFor && <MortgageStagesModal client={mortgageStagesFor} onClose={() => setMortgageStagesFor(null)} onSaved={load} />}
      <ClientDetailsSheet
        client={detailsFor}
        open={!!detailsFor}
        onClose={() => setDetailsFor(null)}
        onChanged={load}
        onEdit={(c) => { setDetailsFor(null); setEditing(c); }}
        onMortgageSend={(c) => { setDetailsFor(null); setMortgageFor(c); }}
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
