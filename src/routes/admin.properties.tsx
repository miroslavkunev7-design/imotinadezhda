import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, X, Images, Upload, Star } from "lucide-react";

export const Route = createFileRoute("/admin/properties")({
  component: PropertiesAdmin,
});

type Row = {
  id: string;
  title: string;
  price: number;
  currency: string;
  property_type: string;
  status: string;
  is_published: boolean;
  is_featured: boolean;
  city_id: string;
  quarter_id: string | null;
  cities?: { name: string } | null;
};

type CityOpt = { id: string; name: string };
type QuarterOpt = { id: string; name: string; city_id: string };

function PropertiesAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cities, setCities] = useState<CityOpt[]>([]);
  const [quarters, setQuarters] = useState<QuarterOpt[]>([]);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [imagesFor, setImagesFor] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: ps }, { data: cs }, { data: qs }] = await Promise.all([
      supabase.from("properties").select("id, title, price, currency, property_type, status, is_published, is_featured, city_id, quarter_id, cities:city_id(name)").order("created_at", { ascending: false }),
      supabase.from("cities").select("id, name").order("display_order"),
      supabase.from("quarters").select("id, name, city_id").order("display_order"),
    ]);
    setRows((ps as Row[]) ?? []);
    setCities(cs ?? []);
    setQuarters(qs ?? []);
  };

  useEffect(() => { load(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    const { id, cities: _c, ...payload } = editing as any;
    payload.price = Number(payload.price);
    if (payload.area_sqm) payload.area_sqm = Number(payload.area_sqm);
    if (payload.bedrooms) payload.bedrooms = Number(payload.bedrooms);
    if (payload.bathrooms) payload.bathrooms = Number(payload.bathrooms);
    if (payload.rooms) payload.rooms = Number(payload.rooms);
    if (!payload.quarter_id) payload.quarter_id = null;
    const op = id
      ? supabase.from("properties").update(payload).eq("id", id)
      : supabase.from("properties").insert(payload);
    const { error } = await op;
    setBusy(false);
    if (error) { alert(error.message); return; }
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на имота?")) return;
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    load();
  };

  const newProperty = () => setEditing({
    title: "", price: 0, currency: "EUR", property_type: "apartment", status: "sale",
    is_published: true, is_featured: false, city_id: cities[0]?.id ?? "",
  });

  const filteredQuarters = editing?.city_id ? quarters.filter((q) => q.city_id === editing.city_id) : [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-accent-foreground">Имоти</h1>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length} записа</p>
        </div>
        <Button onClick={newProperty} className="gold-cta-button"><Plus className="h-4 w-4" /> Нов имот</Button>
      </header>

      <div className="overflow-hidden rounded-xl border border-primary/15 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3">Заглавие</th>
              <th className="px-4 py-3">Град</th>
              <th className="px-4 py-3">Цена</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Публ.</th>
              <th className="px-4 py-3">Топ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2">{r.title}</td>
                <td className="px-4 py-2">{r.cities?.name ?? "—"}</td>
                <td className="px-4 py-2">{new Intl.NumberFormat("bg-BG").format(r.price)} {r.currency}</td>
                <td className="px-4 py-2">{r.property_type}</td>
                <td className="px-4 py-2">{r.status === "sale" ? "Продажба" : "Наем"}</td>
                <td className="px-4 py-2">{r.is_published ? "✓" : "—"}</td>
                <td className="px-4 py-2">{r.is_featured ? "★" : "—"}</td>
                <td className="px-4 py-2 text-right">
                  <button className="mr-2 text-primary" title="Снимки" onClick={() => setImagesFor(r)}><Images className="h-4 w-4" /></button>
                  <button className="mr-2 text-primary" title="Редакция" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></button>
                  <button className="text-destructive" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Няма имоти</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl text-accent-foreground">{editing.id ? "Редакция" : "Нов имот"}</h2>
              <button type="button" onClick={() => setEditing(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Заглавие" className="md:col-span-2">
                <input required value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded border border-input bg-background px-3 py-2" />
              </Field>
              <Field label="Цена">
                <input required type="number" min="0" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="w-full rounded border border-input bg-background px-3 py-2" />
              </Field>
              <Field label="Валута">
                <select value={editing.currency ?? "EUR"} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} className="w-full rounded border border-input bg-background px-3 py-2">
                  <option value="EUR">EUR</option><option value="BGN">BGN</option><option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Град">
                <select required value={editing.city_id ?? ""} onChange={(e) => setEditing({ ...editing, city_id: e.target.value, quarter_id: null })} className="w-full rounded border border-input bg-background px-3 py-2">
                  <option value="">Избери</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Квартал">
                <select value={editing.quarter_id ?? ""} onChange={(e) => setEditing({ ...editing, quarter_id: e.target.value || null })} className="w-full rounded border border-input bg-background px-3 py-2">
                  <option value="">—</option>
                  {filteredQuarters.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                </select>
              </Field>
              <Field label="Тип">
                <select value={editing.property_type ?? "apartment"} onChange={(e) => setEditing({ ...editing, property_type: e.target.value })} className="w-full rounded border border-input bg-background px-3 py-2">
                  <option value="apartment">Апартамент</option><option value="house">Къща</option><option value="office">Офис</option><option value="land">Парцел</option><option value="commercial">Търговски</option>
                </select>
              </Field>
              <Field label="Статус">
                <select value={editing.status ?? "sale"} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className="w-full rounded border border-input bg-background px-3 py-2">
                  <option value="sale">Продажба</option><option value="rent">Наем</option>
                </select>
              </Field>
              <Field label="Площ (m²)"><input type="number" value={(editing as any).area_sqm ?? ""} onChange={(e) => setEditing({ ...editing, area_sqm: e.target.value ? Number(e.target.value) : null } as any)} className="w-full rounded border border-input bg-background px-3 py-2" /></Field>
              <Field label="Стаи"><input type="number" value={(editing as any).rooms ?? ""} onChange={(e) => setEditing({ ...editing, rooms: e.target.value ? Number(e.target.value) : null } as any)} className="w-full rounded border border-input bg-background px-3 py-2" /></Field>
              <Field label="Спални"><input type="number" value={(editing as any).bedrooms ?? ""} onChange={(e) => setEditing({ ...editing, bedrooms: e.target.value ? Number(e.target.value) : null } as any)} className="w-full rounded border border-input bg-background px-3 py-2" /></Field>
              <Field label="Бани"><input type="number" value={(editing as any).bathrooms ?? ""} onChange={(e) => setEditing({ ...editing, bathrooms: e.target.value ? Number(e.target.value) : null } as any)} className="w-full rounded border border-input bg-background px-3 py-2" /></Field>
              <Field label="Cover image URL" className="md:col-span-2">
                <input type="url" value={(editing as any).cover_image_url ?? ""} onChange={(e) => setEditing({ ...editing, cover_image_url: e.target.value } as any)} className="w-full rounded border border-input bg-background px-3 py-2" />
              </Field>
              <Field label="Описание" className="md:col-span-2">
                <textarea rows={4} value={(editing as any).description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value } as any)} className="w-full rounded border border-input bg-background px-3 py-2" />
              </Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} /> Публикуван</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_featured} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} /> Препоръчан</label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Отказ</Button>
              <Button type="submit" disabled={busy} className="gold-cta-button">{busy ? "Запис..." : "Запази"}</Button>
            </div>
          </form>
        </div>
      )}
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
