import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil, X, Upload, UserCog, Phone, Mail } from "lucide-react";
import { listBrokers, upsertBroker, deleteBroker } from "@/lib/crm.functions";

export const Route = createFileRoute("/admin/brokers")({
  component: BrokersAdmin,
});

function BrokersAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setRows(await listBrokers()); } catch (e: any) { alert(e.message); }
  };
  useEffect(() => { load(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      const { created_at, updated_at, properties_count, clients_count, ...payload } = editing;
      await upsertBroker({ data: payload });
      setEditing(null);
      await load();
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на брокера?")) return;
    try { await deleteBroker({ data: { id } }); await load(); } catch (e: any) { alert(e.message); }
  };

  const newBroker = () => setEditing({ full_name: "", phone: "", email: "", is_active: true });

  const onUploadPhoto = async (file: File | null) => {
    if (!file || !editing) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("broker-photos").upload(path, file, { contentType: file.type });
    if (error) { alert(error.message); return; }
    const { data: pub } = supabase.storage.from("broker-photos").getPublicUrl(path);
    setEditing({ ...editing, photo_url: pub.publicUrl });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-amber-100">Брокери</h1>
          <p className="mt-1 text-sm text-amber-100/60">{rows.length} брокера</p>
        </div>
        <Button onClick={newBroker} className="gold-cta-button"><Plus className="h-4 w-4" /> Нов брокер</Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((b) => (
          <div key={b.id} className="rounded-2xl border border-amber-500/20 bg-[rgba(15,3,6,0.85)] p-5 text-amber-100">
            <div className="flex items-center gap-4">
              {b.photo_url ? (
                <img src={b.photo_url} alt={b.full_name} className="h-16 w-16 rounded-full object-cover border border-amber-500/30" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-300"><UserCog className="h-7 w-7" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-display text-xl truncate">{b.full_name}</div>
                {b.license_number && <div className="text-xs text-amber-100/60">Лиценз: {b.license_number}</div>}
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase ${b.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>{b.is_active ? "Активен" : "Неактивен"}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              {b.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{b.phone}</div>}
              {b.email && <div className="flex items-center gap-2 break-all"><Mail className="h-3.5 w-3.5" />{b.email}</div>}
            </div>
            {b.bio && <p className="mt-3 line-clamp-3 text-xs text-amber-100/70">{b.bio}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setEditing(b)} className="flex-1 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs hover:bg-amber-500/10"><Pencil className="inline h-3.5 w-3.5 mr-1" />Редакция</button>
              <button onClick={() => remove(b.id)} className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10"><Trash2 className="inline h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {!rows.length && <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-amber-500/30 p-10 text-center text-amber-100/50">Няма брокери. Добави първия.</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-accent-foreground">{editing.id ? "Редакция" : "Нов брокер"}</h2>
              <button type="button" onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
            </div>

            <div className="flex items-center gap-4">
              {editing.photo_url ? <img src={editing.photo_url} alt="" className="h-20 w-20 rounded-full object-cover" /> : <div className="h-20 w-20 rounded-full bg-muted" />}
              <label className="cursor-pointer rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted">
                <Upload className="inline h-4 w-4 mr-1" /> Качи снимка
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onUploadPhoto(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block"><span className="text-xs uppercase text-muted-foreground">Име *</span><input required value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} className={iC} /></label>
              <label className="block"><span className="text-xs uppercase text-muted-foreground">Лиценз №</span><input value={editing.license_number ?? ""} onChange={(e) => setEditing({ ...editing, license_number: e.target.value })} className={iC} /></label>
              <label className="block"><span className="text-xs uppercase text-muted-foreground">Телефон</span><input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className={iC} /></label>
              <label className="block"><span className="text-xs uppercase text-muted-foreground">Имейл</span><input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className={iC} /></label>
              <label className="block md:col-span-2"><span className="text-xs uppercase text-muted-foreground">User ID (за достъп до системата)</span><input value={editing.user_id ?? ""} onChange={(e) => setEditing({ ...editing, user_id: e.target.value || null })} placeholder="UUID на регистриран потребител" className={iC} /></label>
              <label className="block md:col-span-2"><span className="text-xs uppercase text-muted-foreground">Био</span><textarea rows={3} value={editing.bio ?? ""} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} className={iC} /></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Активен</label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Отказ</Button>
              <Button type="submit" disabled={busy} className="gold-cta-button">{busy ? "Запис..." : "Запази"}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const iC = "w-full rounded border border-input bg-background px-3 py-2";
