import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, X, Phone, Mail, Crown, MapPin } from "lucide-react";

export const Route = createFileRoute("/admin/owners")({
  component: OwnersAdmin,
});

type City = { id: string; name: string };
type Owner = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
  address: string | null;
  notes: string | null;
  city_id: string | null;
  created_at?: string;
};

function OwnersAdmin() {
  const [rows, setRows] = useState<(Owner & { cities?: { name: string } | null })[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [editing, setEditing] = useState<Partial<Owner> | null>(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data, error }, { data: cs }] = await Promise.all([
      supabase.from("owners").select("*, cities:city_id(name)").order("created_at", { ascending: false }),
      supabase.from("cities").select("id, name").order("display_order"),
    ]);
    if (error) { toast.error(error.message); return; }
    setRows((data as any) ?? []);
    setCities((cs as City[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    const { id, created_at, cities: _c, ...payload } = editing as any;
    const op = id
      ? supabase.from("owners").update(payload).eq("id", id)
      : supabase.from("owners").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на собственика?")) return;
    const { error } = await supabase.from("owners").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const newOwner = () => setEditing({ full_name: "", phone: "", email: "", city_id: null });

  const groupedByCity = useMemo(() => {
    const filtered = rows.filter((r) => {
      const matchSearch = !search.trim() ||
        (r.full_name + " " + (r.phone ?? "") + " " + (r.email ?? "") + " " + (r.id_number ?? ""))
          .toLowerCase().includes(search.toLowerCase());
      const matchCity = cityFilter === "all" || (cityFilter === "none" ? !r.city_id : r.city_id === cityFilter);
      return matchSearch && matchCity;
    });
    const groups = new Map<string, { name: string; rows: typeof rows }>();
    for (const r of filtered) {
      const key = r.city_id ?? "none";
      const name = r.cities?.name ?? "Без град";
      if (!groups.has(key)) groups.set(key, { name, rows: [] });
      groups.get(key)!.rows.push(r);
    }
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, search, cityFilter]);

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
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-2 text-sm text-amber-100">
            <option value="all">Всички градове</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">Без град</option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Търси..."
            className="rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.5)] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-100/40"
          />
          <Button onClick={newOwner} className="gold-cta-button"><Plus className="h-4 w-4" /> Нов собственик</Button>
        </div>
      </header>

      <div className="space-y-6">
        {groupedByCity.map((g) => (
          <div key={g.name} className="overflow-hidden rounded-xl border border-amber-500/15 bg-[rgba(255, 255, 255,0.85)]">
            <div className="flex items-center justify-between border-b border-amber-500/15 bg-[rgba(40,8,16,0.7)] px-4 py-2 text-amber-100">
              <div className="font-display text-lg flex items-center gap-2"><MapPin className="h-4 w-4 text-amber-300" />{g.name}</div>
              <span className="text-xs text-amber-100/60">{g.rows.length}</span>
            </div>
            <table className="w-full text-sm text-amber-100">
              <thead className="text-left text-amber-100/70">
                <tr>
                  <th className="px-4 py-2">Име</th>
                  <th className="px-4 py-2">Контакт</th>
                  <th className="px-4 py-2">ЕГН</th>
                  <th className="px-4 py-2">Адрес</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.id} className="border-t border-amber-500/10 hover:bg-amber-500/5">
                    <td className="px-4 py-2 font-semibold">{r.full_name}</td>
                    <td className="px-4 py-2 text-xs">
                      {r.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</div>}
                      {r.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</div>}
                    </td>
                    <td className="px-4 py-2 text-xs">{r.id_number ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{r.address ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <button className="mr-2 text-amber-300" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></button>
                      <button className="text-rose-400" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {!groupedByCity.length && (
          <div className="rounded-2xl border border-dashed border-amber-500/30 p-10 text-center text-amber-100/50">Няма собственици.</div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#8B1A2B]/55 p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-accent-foreground">{editing.id ? "Редакция" : "Нов собственик"}</h2>
              <button type="button" onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block md:col-span-2"><span className="text-xs uppercase text-muted-foreground">Име *</span>
                <input required value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} className={iC} />
              </label>
              <label className="block"><span className="text-xs uppercase text-muted-foreground">Град</span>
                <select value={editing.city_id ?? ""} onChange={(e) => setEditing({ ...editing, city_id: e.target.value || null })} className={iC}>
                  <option value="">—</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block"><span className="text-xs uppercase text-muted-foreground">Телефон</span>
                <input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className={iC} />
              </label>
              <label className="block"><span className="text-xs uppercase text-muted-foreground">Имейл</span>
                <input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className={iC} />
              </label>
              <label className="block"><span className="text-xs uppercase text-muted-foreground">ЕГН / ЕИК</span>
                <input value={editing.id_number ?? ""} onChange={(e) => setEditing({ ...editing, id_number: e.target.value })} className={iC} />
              </label>
              <label className="block md:col-span-2"><span className="text-xs uppercase text-muted-foreground">Адрес</span>
                <input value={editing.address ?? ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} className={iC} />
              </label>
              <label className="block md:col-span-2"><span className="text-xs uppercase text-muted-foreground">Бележки</span>
                <textarea rows={4} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className={iC} />
              </label>
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
