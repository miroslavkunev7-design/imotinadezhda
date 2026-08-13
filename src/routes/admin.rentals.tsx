import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Upload, FileText, Phone, ArrowLeft, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  listRentals, upsertRental, deleteRental,
  listRentalPayments, upsertRentalPayment, deleteRentalPayment,
} from "@/lib/rentals.functions";
import { listClients } from "@/lib/crm.functions";

export const Route = createFileRoute("/admin/rentals")({ component: RentalsAdmin });

type Rental = any;
type Payment = any;

function RentalsAdmin() {
  const [rows, setRows] = useState<Rental[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [editing, setEditing] = useState<Rental | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [missingTable, setMissingTable] = useState<string | null>(null);

  const load = async () => {
    try {
      const [rs, cs] = await Promise.all([listRentals(), listClients()]);
      setRows(rs as any[]);
      setClients(cs as any[]);
      setMissingTable(null);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const m = msg.match(/table ['"]?public\.(\w+)['"]?/i) || msg.match(/relation ['"]?(\w+)['"]? does not exist/i);
      if (m || /schema cache/i.test(msg)) {
        setMissingTable(m?.[1] ?? "rentals");
      } else {
        toast.error(msg || "Грешка");
      }
    }
  };
  useEffect(() => { load(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!editing) return;
    setBusy(true);
    try {
      const { cities: _c, quarters: _q, tenant: _t, landlord: _l, created_at, updated_at, created_by, ...rest } = editing as any;
      await upsertRental({ data: rest });
      setEditing(null); await load();
    } catch (e: any) { toast.error(e?.message ?? "Грешка"); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на този наем и всичките му плащания?")) return;
    try { await deleteRental({ data: { id } }); await load(); } catch (e: any) { toast.error(e.message); }
  };

  const newRental = () => setEditing({
    tenant_name: "", landlord_name: "", monthly_rent: null, management_fee: 35, currency: "EUR",
    payment_day: 5, status: "active",
  });

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (r.tenant_name ?? r.tenant?.full_name ?? "").toLowerCase().includes(s)
      || (r.landlord_name ?? r.landlord?.full_name ?? "").toLowerCase().includes(s)
      || (r.address ?? "").toLowerCase().includes(s);
  });

  const tenantOptions = clients.filter((c: any) => c.client_type === "tenant");
  const landlordOptions = clients.filter((c: any) => c.client_type === "landlord");

  return (
    <div className="space-y-6" data-crm-themed>
      {missingTable && (
        <div className="rounded-xl border border-amber-500/40 bg-[rgba(139,26,43,0.95)] p-5 text-amber-50 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" />
            <div className="space-y-2 text-sm">
              <div className="font-display text-lg text-amber-100">Липсва таблица <code className="rounded bg-black/30 px-1.5 py-0.5">public.{missingTable}</code></div>
              <p className="text-amber-100/90">
                Базата данни още няма нужните таблици за модул „Наеми“. За да заработи, пусни SQL миграциите в Supabase Dashboard → SQL Editor:
              </p>
              <ol className="ml-5 list-decimal space-y-1 text-amber-100/85">
                <li><code>db/migrations/20260713120000_rentals_and_payments.sql</code></li>
                <li><code>db/migrations/20260713130000_rentals_management_fee.sql</code></li>
              </ol>
              <a href="https://supabase.com/dashboard/project/_/sql/new" target="_blank" rel="noreferrer"
                 className="inline-block rounded-lg border border-amber-300/60 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-500/30">
                Отвори Supabase SQL Editor →
              </a>
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-200">
            Наеми · месечни плащания
          </div>
          <h1 className="mt-2 font-display text-4xl text-amber-100">Наеми & плащания</h1>
          <p className="mt-1 text-sm text-amber-100/60">{rows.length} активни договора</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Търси наемател / собственик / адрес..."
            className="w-full sm:w-auto rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-100/40" />
          <Button onClick={newRental} className="gold-cta-button"><Plus className="h-4 w-4" /> Нов наем</Button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.9)]">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-[rgba(40,8,16,0.85)] text-left text-amber-100">
            <tr>
              <th className="px-4 py-3">Наемател</th>
              <th className="px-4 py-3">Собственик</th>
              <th className="px-4 py-3">Адрес</th>
              <th className="px-4 py-3">Период</th>
              <th className="px-4 py-3">Наем · комисиона · за собственика</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="text-[#3a0f18]">
            {filtered.map((r) => {
              const tName = r.tenant?.full_name ?? r.tenant_name ?? "—";
              const tPhone = r.tenant?.phone ?? r.tenant_phone;
              const lName = r.landlord?.full_name ?? r.landlord_name ?? "—";
              const lPhone = r.landlord?.phone ?? r.landlord_phone;
              return (
                <tr key={r.id} className="border-t border-amber-500/10 hover:bg-amber-500/5">
                  <td className="px-4 py-2 font-semibold">
                    <div>{tName}</div>
                    {tPhone && <div className="flex items-center gap-1 text-xs text-[#6b1626]"><Phone className="h-3 w-3" />{tPhone}</div>}
                  </td>
                  <td className="px-4 py-2">
                    <div>{lName}</div>
                    {lPhone && <div className="flex items-center gap-1 text-xs text-[#6b1626]"><Phone className="h-3 w-3" />{lPhone}</div>}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.cities?.name && <div>{r.cities.name}{r.quarters?.name ? `, ${r.quarters.name}` : ""}</div>}
                    {r.address && <div>{r.address}</div>}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <div>{r.start_date ?? "—"} → {r.end_date ?? "—"}</div>
                    {r.payment_day && <div className="text-[#6b1626]">ден на плащане: {r.payment_day}</div>}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.monthly_rent ? (
                      <>
                        <div className="font-semibold">Наем: {Number(r.monthly_rent).toFixed(2)} {r.currency}</div>
                        <div className="text-[#6b1626]">Наша комисиона: {Number(r.management_fee ?? 0).toFixed(2)} {r.currency}</div>
                        <div className="font-semibold text-emerald-800">За собственика: {(Number(r.monthly_rent) - Number(r.management_fee ?? 0)).toFixed(2)} {r.currency}</div>
                      </>
                    ) : "—"}
                    {r.deposit ? <div className="mt-1 text-[#6b1626]">депозит: {r.deposit}</div> : null}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-700"}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Button size="sm" onClick={() => setOpenId(r.id)} className="gold-cta-button mr-2">Плащания</Button>
                    <button className="mr-2 text-[#8B1A2B]" title="Редакция" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></button>
                    <button className="text-rose-600" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-[#8B1A2B]/60">Няма договори за наем. Добави нов.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <RentalModal
          rental={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSubmit={save}
          busy={busy}
          tenants={tenantOptions}
          landlords={landlordOptions}
        />
      )}

      {openId && (
        <PaymentsModal
          rental={rows.find((r) => r.id === openId)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

// ============ RENTAL EDIT MODAL ============

function RentalModal({ rental, onChange, onClose, onSubmit, busy, tenants, landlords }: any) {
  return (
    <Modal onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-primary">{rental.id ? "Редакция на наем" : "Нов договор за наем"}</h2>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <Section title="Наемател">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="От клиенти (незадължително)">
              <select value={rental.tenant_client_id ?? ""} onChange={(e) => onChange({ ...rental, tenant_client_id: e.target.value || null })} className={iC}>
                <option value="">— свободен текст —</option>
                {tenants.map((c: any) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </Field>
            <Field label="Име"><input value={rental.tenant_name ?? ""} onChange={(e) => onChange({ ...rental, tenant_name: e.target.value })} className={iC} /></Field>
            <Field label="Телефон"><input value={rental.tenant_phone ?? ""} onChange={(e) => onChange({ ...rental, tenant_phone: e.target.value })} className={iC} /></Field>
          </div>
        </Section>

        <Section title="Собственик / Наемодател">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="От клиенти (незадължително)">
              <select value={rental.landlord_client_id ?? ""} onChange={(e) => onChange({ ...rental, landlord_client_id: e.target.value || null })} className={iC}>
                <option value="">— свободен текст —</option>
                {landlords.map((c: any) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </Field>
            <Field label="Име"><input value={rental.landlord_name ?? ""} onChange={(e) => onChange({ ...rental, landlord_name: e.target.value })} className={iC} /></Field>
            <Field label="Телефон"><input value={rental.landlord_phone ?? ""} onChange={(e) => onChange({ ...rental, landlord_phone: e.target.value })} className={iC} /></Field>
          </div>
        </Section>

        <Section title="Имот и договор">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Адрес / улица"><input value={rental.address ?? ""} onChange={(e) => onChange({ ...rental, address: e.target.value })} className={iC} /></Field>
            <Field label="Статус"><select value={rental.status ?? "active"} onChange={(e) => onChange({ ...rental, status: e.target.value })} className={iC}>
              <option value="active">Активен</option><option value="ended">Прекратен</option><option value="paused">Пауза</option>
            </select></Field>
            <Field label="Начална дата"><input type="date" value={rental.start_date ?? ""} onChange={(e) => onChange({ ...rental, start_date: e.target.value || null })} className={iC} /></Field>
            <Field label="Крайна дата"><input type="date" value={rental.end_date ?? ""} onChange={(e) => onChange({ ...rental, end_date: e.target.value || null })} className={iC} /></Field>
            <Field label="Месечен наем"><input type="number" step="0.01" value={rental.monthly_rent ?? ""} onChange={(e) => onChange({ ...rental, monthly_rent: e.target.value ? Number(e.target.value) : null })} className={iC} /></Field>
            <Field label="Валута"><select value={rental.currency ?? "EUR"} onChange={(e) => onChange({ ...rental, currency: e.target.value })} className={iC}>
              <option value="EUR">EUR</option><option value="BGN">BGN</option>
            </select></Field>
            <Field label="Наша комисиона / месец"><input type="number" step="0.01" value={rental.management_fee ?? ""} onChange={(e) => onChange({ ...rental, management_fee: e.target.value ? Number(e.target.value) : 0 })} className={iC} /></Field>
            <Field label="За собственика (авт.)"><input readOnly value={rental.monthly_rent ? (Number(rental.monthly_rent) - Number(rental.management_fee ?? 0)).toFixed(2) : ""} className={iC + " bg-emerald-50 font-semibold"} /></Field>
            <Field label="Ден на плащане (1–31)"><input type="number" min={1} max={31} value={rental.payment_day ?? ""} onChange={(e) => onChange({ ...rental, payment_day: e.target.value ? Number(e.target.value) : null })} className={iC} /></Field>
            <Field label="Депозит"><input type="number" step="0.01" value={rental.deposit ?? ""} onChange={(e) => onChange({ ...rental, deposit: e.target.value ? Number(e.target.value) : null })} className={iC} /></Field>
          </div>
        </Section>

        <Field label="Опис на движими вещи"><textarea rows={3} value={rental.inventory ?? ""} onChange={(e) => onChange({ ...rental, inventory: e.target.value })} className={iC} /></Field>
        <Field label="Бележки"><textarea rows={2} value={rental.notes ?? ""} onChange={(e) => onChange({ ...rental, notes: e.target.value })} className={iC} /></Field>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Отказ</Button>
          <Button type="submit" disabled={busy} className="gold-cta-button">{busy ? "Запис..." : "Запази"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ============ PAYMENTS MODAL ============

function PaymentsModal({ rental, onClose }: { rental: any; onClose: () => void }) {
  const [rows, setRows] = useState<Payment[]>([]);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setRows(await listRentalPayments({ data: { rental_id: rental.id } }) as any[]); }
    catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { load(); }, [rental?.id]);

  const newPayment = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    setEditing({
      rental_id: rental.id,
      period_month: `${yyyy}-${mm}`,
      due_date: rental.payment_day ? `${yyyy}-${mm}-${String(rental.payment_day).padStart(2, "0")}` : null,
      paid_date: null,
      amount: rental.monthly_rent ?? null,
      currency: rental.currency ?? "EUR",
      status: "unpaid",
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!editing) return;
    setBusy(true);
    try {
      const { created_at, updated_at, ...rest } = editing;
      await upsertRentalPayment({ data: rest });
      setEditing(null); await load();
      toast.success("Записано");
    } catch (e: any) { toast.error(e?.message ?? "Грешка"); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на плащането?")) return;
    try { await deleteRentalPayment({ data: { id } }); await load(); } catch (e: any) { toast.error(e.message); }
  };

  const onUpload = async (file: File) => {
    if (!editing) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${rental.id}/${editing.period_month}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("rental-documents").upload(path, file, { contentType: file.type });
      if (upErr) { toast.error(upErr.message); return; }
      const { data: signed } = await supabase.storage.from("rental-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
      setEditing({ ...editing, document_url: signed?.signedUrl ?? path, document_name: file.name, document_mime: file.type });
      toast.success("Файлът е качен");
    } finally { setBusy(false); }
  };

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.status === "paid").reduce((a, r) => a + Number(r.amount ?? 0), 0);
    const unpaid = rows.filter((r) => r.status !== "paid").reduce((a, r) => a + Number(r.amount ?? 0), 0);
    const fee = Number(rental?.management_fee ?? 0);
    const paidCount = rows.filter((r) => r.status === "paid").length;
    const commissionPaid = fee * paidCount;
    const netPaid = paid - commissionPaid;
    return { paid, unpaid, commissionPaid, netPaid };
  }, [rows, rental?.management_fee]);

  return (
    <Modal onClose={onClose} wide>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-[#8B1A2B]/70">Месечни плащания</div>
          <h2 className="font-display text-2xl text-primary">
            {rental?.tenant?.full_name ?? rental?.tenant_name ?? "Наемател"} · {rental?.address ?? ""}
          </h2>
          <div className="mt-1 text-xs text-[#3a0f18]">
            Наем: {rental?.monthly_rent ?? "—"} {rental?.currency} · Наша комисиона: {rental?.management_fee ?? 0} {rental?.currency} · За собственика: {rental?.monthly_rent ? (Number(rental.monthly_rent) - Number(rental.management_fee ?? 0)).toFixed(2) : "—"} {rental?.currency} · Ден на плащане: {rental?.payment_day ?? "—"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={newPayment} className="gold-cta-button"><Plus className="h-4 w-4" /> Ново плащане</Button>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="mb-3 grid gap-3 md:grid-cols-4">
        <StatBox label="Платени" value={`${totals.paid.toFixed(2)} ${rental?.currency ?? ""}`} color="emerald" />
        <StatBox label="Неплатени / очаквани" value={`${totals.unpaid.toFixed(2)} ${rental?.currency ?? ""}`} color="rose" />
        <StatBox label="Наши комисиони (платени)" value={`${totals.commissionPaid.toFixed(2)} ${rental?.currency ?? ""}`} color="neutral" />
        <StatBox label="За собственика (нето)" value={`${totals.netPaid.toFixed(2)} ${rental?.currency ?? ""}`} color="emerald" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-amber-500/20 bg-[rgba(255,251,243,0.98)]">
        <table className="w-full min-w-[720px] text-sm text-[#3a0f18]">
          <thead className="bg-[rgba(40,8,16,0.9)] text-left text-amber-100">
            <tr>
              <th className="px-4 py-3">Месец</th>
              <th className="px-4 py-3">Падеж</th>
              <th className="px-4 py-3">Платено на</th>
              <th className="px-4 py-3">Сума</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Документ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-amber-500/10 hover:bg-amber-500/5">
                <td className="px-4 py-2 font-semibold">{formatMonth(p.period_month)}</td>
                <td className="px-4 py-2 text-xs">{p.due_date ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{p.paid_date ?? "—"}</td>
                <td className="px-4 py-2 text-xs">{p.amount ? `${p.amount} ${p.currency}` : "—"}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-2 text-xs">
                  {p.document_url ? (
                    <a href={p.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#8B1A2B] hover:underline">
                      <Download className="h-3 w-3" />{p.document_name ?? "файл"}
                    </a>
                  ) : "—"}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button className="mr-2 text-[#8B1A2B]" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></button>
                  <button className="text-rose-600" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#8B1A2B]/60">Няма записани плащания. Добави ново.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="mt-4 rounded-xl border-2 border-[#C9A84C]/60 bg-[rgba(255,251,243,0.98)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-primary">{editing.id ? "Редакция на плащане" : "Ново плащане"}</h3>
            <button onClick={() => setEditing(null)}><X className="h-5 w-5 text-[#8B1A2B]" /></button>
          </div>
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Месец (YYYY-MM)"><input required value={editing.period_month?.slice(0, 7) ?? ""} onChange={(e) => setEditing({ ...editing, period_month: e.target.value })} placeholder="2026-07" className={iC} /></Field>
              <Field label="Падеж"><input type="date" value={editing.due_date ?? ""} onChange={(e) => setEditing({ ...editing, due_date: e.target.value || null })} className={iC} /></Field>
              <Field label="Платено на"><input type="date" value={editing.paid_date ?? ""} onChange={(e) => setEditing({ ...editing, paid_date: e.target.value || null })} className={iC} /></Field>
              <Field label="Сума"><input type="number" step="0.01" value={editing.amount ?? ""} onChange={(e) => setEditing({ ...editing, amount: e.target.value ? Number(e.target.value) : null })} className={iC} /></Field>
              <Field label="Валута"><select value={editing.currency ?? "EUR"} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} className={iC}>
                <option value="EUR">EUR</option><option value="BGN">BGN</option>
              </select></Field>
              <Field label="Статус"><select value={editing.status ?? "unpaid"} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className={iC}>
                <option value="paid">Платено</option>
                <option value="unpaid">Неплатено</option>
                <option value="late">Закъсняло</option>
                <option value="partial">Частично</option>
              </select></Field>
            </div>
            <Field label="Бележки"><textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className={iC} /></Field>

            <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-dashed border-[#C9A84C]/50 bg-[rgba(201,168,76,0.08)] p-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#8B1A2B] px-4 py-2 text-white hover:bg-[#6b1626]">
                <Upload className="h-4 w-4" /> <span className="text-sm">{busy ? "Качване…" : "Прикачи снимка / PDF"}</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} disabled={busy} />
              </label>
              {editing.document_url ? (
                <a href={editing.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#8B1A2B] hover:underline">
                  <FileText className="h-4 w-4" />{editing.document_name ?? "прикачен файл"}
                </a>
              ) : <span className="text-xs text-[#8B1A2B]/60">Няма прикачен документ</span>}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Отказ</Button>
              <Button type="submit" disabled={busy} className="gold-cta-button">{busy ? "Запис..." : "Запази"}</Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}

// ============ Helpers ============

function formatMonth(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = iso.slice(0, 7);
  const [y, m] = d.split("-");
  const names = ["Ян", "Фев", "Мар", "Апр", "Май", "Юни", "Юли", "Авг", "Сеп", "Окт", "Ное", "Дек"];
  return `${names[Number(m) - 1] ?? m} ${y}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; icon: any }> = {
    paid:    { cls: "bg-emerald-100 text-emerald-800", label: "Платено",   icon: CheckCircle2 },
    unpaid:  { cls: "bg-rose-100 text-rose-800",       label: "Неплатено", icon: AlertCircle },
    late:    { cls: "bg-amber-100 text-amber-900",     label: "Закъсняло", icon: AlertCircle },
    partial: { cls: "bg-sky-100 text-sky-800",         label: "Частично",  icon: AlertCircle },
  };
  const s = map[status] ?? map.unpaid;
  const Icon = s.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}><Icon className="h-3 w-3" />{s.label}</span>;
}

function StatBox({ label, value, color }: { label: string; value: string; color: "emerald" | "rose" | "neutral" }) {
  const cls = color === "emerald" ? "border-emerald-400/40 bg-emerald-50 text-emerald-900"
    : color === "rose" ? "border-rose-400/40 bg-rose-50 text-rose-900"
    : "border-amber-500/30 bg-[rgba(255,251,243,0.95)] text-[#3a0f18]";
  return (
    <div className={`rounded-xl border-2 ${cls} p-3`}>
      <div className="text-[10px] uppercase tracking-widest opacity-70">{label}</div>
      <div className="mt-1 font-display text-xl">{value}</div>
    </div>
  );
}

const iC = "w-full rounded border border-[#8B1A2B]/30 bg-white px-3 py-2 text-[#3a0f18]";

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#8B1A2B]/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`max-h-[94vh] w-full ${wide ? "max-w-5xl" : "max-w-3xl"} overflow-auto rounded-2xl bg-[rgba(255,251,243,0.98)] p-6 shadow-2xl`}>{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#8B1A2B]/25 bg-white/60 p-4">
      <div className="mb-3 font-display text-base text-primary">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#8B1A2B]/80">{label}</span>
      {children}
    </label>
  );
}