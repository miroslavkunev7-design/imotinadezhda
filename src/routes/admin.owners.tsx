import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, X, Phone, Mail, Crown, MapPin } from "lucide-react";

export const Route = createFileRoute("/admin/owners")({
  component: OwnersAdmin,
});

type Owner = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  address: string | null;
  notes: string | null;
  created_at?: string;
};

function OwnersAdmin() {
  const [rows, setRows] = useState<Owner[]>([]);
  const [editing, setEditing] = useState<Partial<Owner> | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("owners")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { alert(error.message); return; }
    setRows((data as Owner[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    const { id, created_at, ...payload } = editing as any;
    const op = id
      ? supabase.from("owners").update(payload).eq("id", id)
      : supabase.from("owners").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) { alert(error.message); return; }
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на собственика?")) return;
    const { error } = await supabase.from("owners").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    load();
  };

  const newOwner = () =>
    setEditing({ full_name: "", phone: "", email: "" });

  const filtered = rows.filter((r) =>
    !search.trim() ||
    (r.full_name + " " + (r.phone ?? "") + " " + (r.email ?? "") + " " + (r.id_number ?? ""))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-amber-100 flex items-center gap-2">
            <Crown className="h-7 w-7 text-amber-300" /> Собственици
          </h1>
          <p className="mt-1 text-sm text-amber-100/60">{rows.length} записа</p>
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Търси по име, тел., имейл, ЕГН..."
            className="rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-100/40"
          />
          <Button onClick={newOwner} className="gold-cta-button">
            <Plus className="h-4 w-4" /> Нов собственик
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-amber-500/15 bg-[rgba(15,3,6,0.85)]">
        <table className="w-full text-sm text-amber-100">
          <thead className="bg-[rgba(40,8,16,0.7)] text-left text-amber-100/80">
            <tr>
              <th className="px-4 py-3">Име</th>
              <th className="px-4 py-3">Контакт</th>
              <th className="px-4 py-3">ЕГН</th>
              <th className="px-4 py-3">Адрес</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-amber-500/10 hover:bg-amber-500/5">
                <td className="px-4 py-2 font-semibold">{r.full_name}</td>
                <td className="px-4 py-2 text-xs">
                  {r.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</div>}
                  {r.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</div>}
                </td>
                <td className="px-4 py-2 text-xs">{r.id_number ?? "—"}</td>
                <td className="px-4 py-2 text-xs">
                  {r.address ? <div className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.address}</div> : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <button className="mr-2 text-amber-300" title="Редакция" onClick={() => setEditing(r)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button className="text-rose-400" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-amber-100/40">Няма собственици. Добави нов.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-accent-foreground">
                {editing.id ? "Редакция" : "Нов собственик"}
              </h2>
              <button type="button" onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-xs uppercase text-muted-foreground">Име *</span>
                <input required value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} className={iC} />
              </label>
              <label className="block">
                <span className="text-xs uppercase text-muted-foreground">Телефон</span>
                <input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className={iC} />
              </label>
              <label className="block">
                <span className="text-xs uppercase text-muted-foreground">Имейл</span>
                <input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className={iC} />
              </label>
              <label className="block">
                <span className="text-xs uppercase text-muted-foreground">ЕГН / ЕИК</span>
                <input value={editing.id_number ?? ""} onChange={(e) => setEditing({ ...editing, id_number: e.target.value })} className={iC} />
              </label>
              <label className="block">
                <span className="text-xs uppercase text-muted-foreground">Адрес</span>
                <input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} className={iC} />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs uppercase text-muted-foreground">Бележки</span>
                <textarea rows={4} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className={iC} />
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Отказ</Button>
              <Button type="submit" disabled={busy} className="gold-cta-button">
                {busy ? "Запис..." : "Запази"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const iC = "w-full rounded border border-input bg-background px-3 py-2";
