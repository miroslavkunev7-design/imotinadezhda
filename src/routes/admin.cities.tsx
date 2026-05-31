import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/admin/cities")({
  component: CitiesAdmin,
});

type City = {
  id?: string;
  slug: string;
  name: string;
  name_en?: string | null;
  description?: string | null;
  hero_image_url?: string | null;
  region?: string | null;
  population?: number | null;
  area_km2?: number | null;
  display_order?: number | null;
  is_published?: boolean;
};

function CitiesAdmin() {
  const [rows, setRows] = useState<City[]>([]);
  const [editing, setEditing] = useState<City | null>(null);

  const load = async () => {
    const { data } = await supabase.from("cities").select("*").order("display_order");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const { id, ...payload } = editing;
    if (payload.population) payload.population = Number(payload.population);
    if (payload.area_km2) payload.area_km2 = Number(payload.area_km2);
    if (payload.display_order) payload.display_order = Number(payload.display_order);
    const op = id ? supabase.from("cities").update(payload).eq("id", id) : supabase.from("cities").insert(payload);
    const { error } = await op;
    if (error) return alert(error.message);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на града? Всички квартали и имоти, свързани с него, ще се повлияят.")) return;
    const { error } = await supabase.from("cities").delete().eq("id", id);
    if (error) return alert(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-accent-foreground">Градове</h1>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length} записа</p>
        </div>
        <Button onClick={() => setEditing({ slug: "", name: "", display_order: rows.length, is_published: true })} className="gold-cta-button"><Plus className="h-4 w-4" /> Нов град</Button>
      </header>

      <div className="overflow-hidden rounded-xl border border-primary/15 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="px-4 py-3">Име</th><th className="px-4 py-3">Slug</th><th className="px-4 py-3">Регион</th><th className="px-4 py-3">Население</th><th className="px-4 py-3">Публ.</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.slug}</td>
                <td className="px-4 py-2">{r.region ?? "—"}</td>
                <td className="px-4 py-2">{r.population ?? "—"}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl text-accent-foreground">{editing.id ? "Редакция" : "Нов град"}</h2>
              <button type="button" onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Lbl label="Име"><input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="inp" /></Lbl>
              <Lbl label="Slug"><input required value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="inp" /></Lbl>
              <Lbl label="Регион"><input value={editing.region ?? ""} onChange={(e) => setEditing({ ...editing, region: e.target.value })} className="inp" /></Lbl>
              <Lbl label="Hero снимка (URL)"><input value={editing.hero_image_url ?? ""} onChange={(e) => setEditing({ ...editing, hero_image_url: e.target.value })} className="inp" /></Lbl>
              <Lbl label="Население"><input type="number" value={editing.population ?? ""} onChange={(e) => setEditing({ ...editing, population: e.target.value ? Number(e.target.value) : null })} className="inp" /></Lbl>
              <Lbl label="Площ (км²)"><input type="number" step="0.01" value={editing.area_km2 ?? ""} onChange={(e) => setEditing({ ...editing, area_km2: e.target.value ? Number(e.target.value) : null })} className="inp" /></Lbl>
              <Lbl label="Подредба"><input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} className="inp" /></Lbl>
              <Lbl label="Публикуван"><input type="checkbox" checked={!!editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="h-5 w-5" /></Lbl>
              <Lbl label="Описание" className="md:col-span-2"><textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="inp" /></Lbl>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Отказ</Button>
              <Button type="submit" className="gold-cta-button">Запази</Button>
            </div>
          </form>
        </div>
      )}
      <style>{`.inp{width:100%;border:1px solid hsl(var(--input));background:hsl(var(--background));padding:.5rem .75rem;border-radius:.375rem}`}</style>
    </div>
  );
}

function Lbl({ label, children, className = "" }: { label: string; children: any; className?: string }) {
  return <label className={"block text-sm " + className}><div className="mb-1 text-muted-foreground">{label}</div>{children}</label>;
}
