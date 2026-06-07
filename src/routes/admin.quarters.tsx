import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/admin/quarters")({
  component: QuartersAdmin,
});

type Q = {
  id?: string;
  city_id: string;
  slug: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  avg_price_per_sqm?: number | null;
  display_order?: number | null;
  is_published?: boolean;
};
type CityOpt = { id: string; name: string };

function QuartersAdmin() {
  const [rows, setRows] = useState<(Q & { cities?: { name: string } | null })[]>([]);
  const [cities, setCities] = useState<CityOpt[]>([]);
  const [editing, setEditing] = useState<Q | null>(null);

  const load = async () => {
    const [{ data: qs }, { data: cs }] = await Promise.all([
      supabase.from("quarters").select("*, cities:city_id(name)").order("display_order"),
      supabase.from("cities").select("id, name").order("display_order"),
    ]);
    setRows((qs as any) ?? []);
    setCities(cs ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const { id, ...p } = editing as any;
    delete p.cities;
    if (p.avg_price_per_sqm) p.avg_price_per_sqm = Number(p.avg_price_per_sqm);
    if (p.display_order) p.display_order = Number(p.display_order);
    const op = id ? supabase.from("quarters").update(p).eq("id", id) : supabase.from("quarters").insert(p);
    const { error } = await op;
    if (error) return toast.error(error.message);
    setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на квартала?")) return;
    const { error } = await supabase.from("quarters").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-accent-foreground">Квартали</h1>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length} записа</p>
        </div>
        <Button onClick={() => setEditing({ slug: "", name: "", city_id: cities[0]?.id ?? "", display_order: rows.length, is_published: true })} className="gold-cta-button"><Plus className="h-4 w-4" /> Нов квартал</Button>
      </header>

      <div className="overflow-hidden rounded-xl border border-primary/15 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="px-4 py-3">Име</th><th className="px-4 py-3">Град</th><th className="px-4 py-3">Slug</th><th className="px-4 py-3">€/м²</th><th className="px-4 py-3">Публ.</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2">{r.cities?.name ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.slug}</td>
                <td className="px-4 py-2">{r.avg_price_per_sqm ?? "—"}</td>
                <td className="px-4 py-2">{r.is_published ? "✓" : "—"}</td>
                <td className="px-4 py-2 text-right">
                  <button className="mr-2 text-primary" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></button>
                  <button className="text-destructive" onClick={() => remove(r.id!)}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#8B1A2B]/50 p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl text-accent-foreground">{editing.id ? "Редакция" : "Нов квартал"}</h2>
              <button type="button" onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm"><div className="mb-1 text-muted-foreground">Град</div>
                <select required value={editing.city_id} onChange={(e) => setEditing({ ...editing, city_id: e.target.value })} className="w-full rounded border border-input bg-background px-3 py-2">
                  <option value="">Избери</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-sm"><div className="mb-1 text-muted-foreground">Slug</div><input required value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="w-full rounded border border-input bg-background px-3 py-2" /></label>
              <label className="text-sm md:col-span-2"><div className="mb-1 text-muted-foreground">Име</div><input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full rounded border border-input bg-background px-3 py-2" /></label>
              <label className="text-sm"><div className="mb-1 text-muted-foreground">Снимка (URL)</div><input value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} className="w-full rounded border border-input bg-background px-3 py-2" /></label>
              <label className="text-sm"><div className="mb-1 text-muted-foreground">Средна цена €/м²</div><input type="number" step="0.01" value={editing.avg_price_per_sqm ?? ""} onChange={(e) => setEditing({ ...editing, avg_price_per_sqm: e.target.value ? Number(e.target.value) : null })} className="w-full rounded border border-input bg-background px-3 py-2" /></label>
              <label className="text-sm"><div className="mb-1 text-muted-foreground">Подредба</div><input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} className="w-full rounded border border-input bg-background px-3 py-2" /></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="h-5 w-5" />Публикуван</label>
              <label className="text-sm md:col-span-2"><div className="mb-1 text-muted-foreground">Описание</div><textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full rounded border border-input bg-background px-3 py-2" /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Отказ</Button>
              <Button type="submit" className="gold-cta-button">Запази</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
