import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, X, Images, Upload, Star, Send, FileText, Check, Download, Layers, Mail, Loader2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { MORTGAGE_PARTNERS } from "@/lib/contact-config";
import { toast } from "sonner";

const CROSSPOST_SITES = [
  { key: "imot_bg", label: "Imot.bg" },
  { key: "imoti_net", label: "Imoti.net" },
  { key: "olx_bg", label: "OLX.bg" },
  { key: "bazar_bg", label: "Bazar.bg" },
  { key: "alo_bg", label: "Alo.bg" },
  { key: "home_bg", label: "Home.bg" },
  { key: "facebook", label: "Facebook Marketplace" },
];


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
  village_id: string | null;
  cities?: { name: string; slug: string } | null;
};

type CityOpt = { id: string; name: string; slug: string };
type QuarterOpt = { id: string; name: string; city_id: string };
type VillageOpt = { id: string; name: string; oblast_slug: string; municipality_slug: string | null };

// City slug → which oblast (+ optional municipality) its villages belong to.
const CITY_OBLAST: Record<string, { oblast: string; municipality?: string }> = {
  shumen: { oblast: "shumen" },
  varna: { oblast: "varna" },
  burgas: { oblast: "burgas" },
  "novi-pazar": { oblast: "shumen", municipality: "novi-pazar" },
};

function PropertiesAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cities, setCities] = useState<CityOpt[]>([]);
  const [quarters, setQuarters] = useState<QuarterOpt[]>([]);
  const [villages, setVillages] = useState<VillageOpt[]>([]);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [imagesFor, setImagesFor] = useState<Row | null>(null);
  const [docsFor, setDocsFor] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [uploadingNew, setUploadingNew] = useState(false);

  const load = async () => {
    const [{ data: ps }, { data: cs }, { data: qs }, { data: vs }] = await Promise.all([
      supabase.from("properties").select("id, title, price, currency, property_type, status, is_published, is_featured, city_id, quarter_id, village_id, cities:city_id(name, slug)").order("created_at", { ascending: false }),
      supabase.from("cities").select("id, name, slug").order("display_order"),
      supabase.from("quarters").select("id, name, city_id").order("display_order"),
      supabase.from("villages").select("id, name, oblast_slug, municipality_slug").order("name"),
    ]);
    setRows((ps as Row[]) ?? []);
    setCities(cs ?? []);
    setQuarters(qs ?? []);
    setVillages(vs ?? []);
  };

  useEffect(() => { load(); }, []);

  const uploadImagesForProperty = async (propertyId: string, files: File[]) => {
    let coverSet = false;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${propertyId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("property-images").upload(path, file, { contentType: file.type });
      if (upErr) { toast.error(upErr.message); continue; }
      const { data: pub } = supabase.storage.from("property-images").getPublicUrl(path);
      const isCover = !coverSet && i === 0;
      await supabase.from("property_images").insert({
        property_id: propertyId,
        url: pub.publicUrl,
        is_cover: isCover,
        display_order: i,
      });
      if (isCover) {
        await supabase.from("properties").update({ cover_image_url: pub.publicUrl }).eq("id", propertyId);
        coverSet = true;
      }
    }
  };

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
    let propertyId = id;
    try {
      if (id) {
        const { error } = await supabase.from("properties").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
        if (error) throw error;
        propertyId = data!.id;
      }
      if (pendingImages.length && propertyId) {
        setUploadingNew(true);
        await uploadImagesForProperty(propertyId, pendingImages);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Грешка");
      setBusy(false); setUploadingNew(false);
      return;
    }
    setBusy(false); setUploadingNew(false);
    setPendingImages([]);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на имота?")) return;
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const publishAll = async (r: Row) => {
    if (!confirm(`Публикуване на "${r.title}" във всички сайтове (${CROSSPOST_SITES.map((s) => s.label).join(", ")})?`)) return;
    const rows = CROSSPOST_SITES.map((s) => ({ property_id: r.id, site: s.key, status: "queued" }));
    const { error } = await supabase.from("cross_post_queue" as any).insert(rows);
    if (error) { toast.error(error.message); return; }
    if (!r.is_published) {
      await supabase.from("properties").update({ is_published: true }).eq("id", r.id);
    }
    toast.success(`Заявени са ${rows.length} публикации. Опашката се обработва от автоматизацията.`);
    load();
  };


  const newProperty = async () => {
    // Re-load cities to avoid empty dropdown if user opens before initial load finished
    if (!cities.length) {
      const { data: cs } = await supabase.from("cities").select("id, name, slug").order("display_order");
      if (cs) setCities(cs);
    }
    setPendingImages([]);
    setEditing({
      title: "", price: 0, currency: "EUR", property_type: "apartment", status: "sale",
      is_published: true, is_featured: false, city_id: "",
    });
  };

  const startEdit = (r: Row) => {
    setPendingImages([]);
    setEditing(r);
  };

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
                  <button className="mr-2 text-amber-600" title="Публикувай във всички сайтове" onClick={() => publishAll(r)}><Send className="h-4 w-4" /></button>
                  <button className="mr-2 text-primary" title="Снимки" onClick={() => setImagesFor(r)}><Images className="h-4 w-4" /></button>
                  <button className="mr-2 text-primary" title="Документи" onClick={() => setDocsFor(r)}><FileText className="h-4 w-4" /></button>
                  <button className="mr-2 text-primary" title="Редакция" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></button>
                  <button className="text-destructive" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></button>
                </td>

              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Няма имоти</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#8B1A2B]/55 backdrop-blur-sm p-0 sm:items-center sm:p-4" onClick={() => setEditing(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={save}
            className="marble-light-panel relative flex w-full max-w-2xl flex-col text-slate-800 h-[100dvh] max-h-[100dvh] sm:rounded-2xl sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)]"
          >
            <div className="shrink-0 flex items-center justify-between border-b border-amber-300/40 px-6 py-4">
              <h2 className="font-display text-2xl text-[#5a3a14]">{editing.id ? "Редакция" : "Нов имот"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-[#5a3a14]/70 hover:text-[#5a3a14]"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4">
              <div className="grid gap-3 md:grid-cols-2">
              <Field label="Заглавие" className="md:col-span-2">
                <input required value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2" />
              </Field>
              <Field label="Цена">
                <input required type="number" min="0" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="w-full rounded border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2" />
              </Field>
              <Field label="Валута">
                <select value={editing.currency ?? "EUR"} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} className="w-full rounded border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2">
                  <option value="EUR">EUR</option><option value="BGN">BGN</option><option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Град">
                <select required value={editing.city_id ?? ""} onChange={(e) => setEditing({ ...editing, city_id: e.target.value, quarter_id: null })} className="w-full rounded border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2">
                  <option value="">{cities.length ? "Избери град" : "Зареждане..."}</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!cities.length && (
                  <p className="mt-1 text-[11px] text-rose-600">Няма градове в базата. Добави от меню „Градове" в админа.</p>
                )}
              </Field>
              <Field label="Квартал">
                <select value={editing.quarter_id ?? ""} onChange={(e) => setEditing({ ...editing, quarter_id: e.target.value || null })} className="w-full rounded border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2">
                  <option value="">—</option>
                  {filteredQuarters.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
                </select>
              </Field>
              <Field label="Тип">
                <select value={editing.property_type ?? "apartment"} onChange={(e) => setEditing({ ...editing, property_type: e.target.value })} className="w-full rounded border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2">
                  <option value="apartment">Апартамент</option><option value="house">Къща</option><option value="office">Офис</option><option value="land">Парцел</option><option value="commercial">Търговски</option>
                </select>
              </Field>
              <Field label="Статус">
                <select value={editing.status ?? "sale"} onChange={(e) => setEditing({ ...editing, status: e.target.value })} className="w-full rounded border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2">
                  <option value="sale">Продажба</option><option value="rent">Наем</option>
                </select>
              </Field>
              <Field label="Площ (m²)"><input type="number" value={(editing as any).area_sqm ?? ""} onChange={(e) => setEditing({ ...editing, area_sqm: e.target.value ? Number(e.target.value) : null } as any)} className="w-full rounded border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2" /></Field>
              <Field label="Стаи"><input type="number" value={(editing as any).rooms ?? ""} onChange={(e) => setEditing({ ...editing, rooms: e.target.value ? Number(e.target.value) : null } as any)} className="w-full rounded border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2" /></Field>
              <Field label="Спални"><input type="number" value={(editing as any).bedrooms ?? ""} onChange={(e) => setEditing({ ...editing, bedrooms: e.target.value ? Number(e.target.value) : null } as any)} className="w-full rounded border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2" /></Field>
              <Field label="Бани"><input type="number" value={(editing as any).bathrooms ?? ""} onChange={(e) => setEditing({ ...editing, bathrooms: e.target.value ? Number(e.target.value) : null } as any)} className="w-full rounded border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2" /></Field>
              <Field label="Снимки от галерия" className="md:col-span-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-amber-700/40 bg-white/70 px-4 py-4 text-sm text-[#5a3a14] hover:bg-white">
                  <Upload className="h-4 w-4" />
                  <span>
                    {uploadingNew
                      ? "Качване…"
                      : pendingImages.length
                        ? `Избрани ${pendingImages.length} файла — добави още`
                        : "Избери снимки (можеш да маркираш много наведнъж)"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length) setPendingImages((prev) => [...prev, ...files]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {!!pendingImages.length && (
                  <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                    {pendingImages.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="group relative overflow-hidden rounded-md border border-amber-700/30">
                        <img src={URL.createObjectURL(f)} alt={f.name} className="aspect-square w-full object-cover" loading="lazy" decoding="async" />
                        <button
                          type="button"
                          onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute right-0.5 top-0.5 rounded-full bg-rose-500/90 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                          title="Премахни"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-[#5a3a14]/70">
                  Първата снимка става корица. След запис можеш да добавиш още от иконата „Снимки".
                </p>
              </Field>
              <Field label="Описание" className="md:col-span-2">
                <textarea rows={4} value={(editing as any).description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value } as any)} className="w-full rounded border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2" />
              </Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} /> Публикуван</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!editing.is_featured} onChange={(e) => setEditing({ ...editing, is_featured: e.target.checked })} /> Препоръчан</label>
              </div>
            </div>
            <div className="shrink-0 flex justify-end gap-2 border-t border-amber-300/40 bg-white/85 px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
              <Button type="button" variant="outline" onClick={() => setEditing(null)} className="border-amber-700/40 bg-white/80 text-[#5a3a14] hover:bg-white">Отказ</Button>
              <Button type="submit" disabled={busy || uploadingNew} className="gold-cta-button">{busy || uploadingNew ? (pendingImages.length ? `Качване ${pendingImages.length} снимки…` : "Запис...") : (editing.id ? "Запази" : "Добави имота в сайта")}</Button>
            </div>
          </form>
        </div>
      )}

      {imagesFor && <ImagesModal property={imagesFor} onClose={() => { setImagesFor(null); load(); }} />}
      {docsFor && <DocumentsModal property={docsFor} onClose={() => setDocsFor(null)} />}
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

type ImgRow = { id: string; url: string; is_cover: boolean; display_order: number | null };

function ImagesModal({ property, onClose }: { property: Row; onClose: () => void }) {
  const [imgs, setImgs] = useState<ImgRow[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("property_images").select("id, url, is_cover, display_order").eq("property_id", property.id).order("display_order");
    setImgs((data as ImgRow[]) ?? []);
  };
  useEffect(() => { load(); }, [property.id]);

  const onUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${property.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("property-images").upload(path, file, { contentType: file.type });
        if (upErr) { toast.error(upErr.message); continue; }
        const { data: pub } = supabase.storage.from("property-images").getPublicUrl(path);
        const isFirst = imgs.length === 0;
        await supabase.from("property_images").insert({
          property_id: property.id,
          url: pub.publicUrl,
          is_cover: isFirst,
          display_order: imgs.length,
        });
        if (isFirst) await supabase.from("properties").update({ cover_image_url: pub.publicUrl }).eq("id", property.id);
      }
      await load();
    } finally { setUploading(false); }
  };

  const setCover = async (img: ImgRow) => {
    await supabase.from("property_images").update({ is_cover: false }).eq("property_id", property.id);
    await supabase.from("property_images").update({ is_cover: true }).eq("id", img.id);
    await supabase.from("properties").update({ cover_image_url: img.url }).eq("id", property.id);
    load();
  };

  const remove = async (img: ImgRow) => {
    if (!confirm("Изтриване на снимката?")) return;
    await supabase.from("property_images").delete().eq("id", img.id);
    // Best-effort delete from storage
    const path = img.url.split("/property-images/")[1];
    if (path) await supabase.storage.from("property-images").remove([path]);
    load();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#8B1A2B]/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl overflow-y-auto overscroll-contain bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl h-[100dvh] max-h-[100dvh] sm:rounded-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl text-accent-foreground">Снимки</h2>
            <p className="text-sm text-muted-foreground">{property.title}</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <label className="mb-5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-muted/30 px-6 py-8 text-primary hover:bg-muted/50">
          <Upload className="h-5 w-5" />
          <span>{uploading ? "Качване…" : "Качи снимки (избери файлове)"}</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} disabled={uploading} />
        </label>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {imgs.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-xl border border-border">
              <img src={img.url} alt="" className="aspect-square w-full object-cover" loading="lazy" decoding="async" />
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-[#8B1A2B]/55 p-2">
                <button onClick={() => setCover(img)} className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${img.is_cover ? "bg-primary text-primary-foreground" : "bg-white/10 text-white"}`}>
                  <Star className="h-3 w-3" /> {img.is_cover ? "Корица" : "Постави"}
                </button>
                <button onClick={() => remove(img)} className="rounded bg-destructive/80 px-2 py-1 text-xs text-destructive-foreground"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
          {!imgs.length && <div className="col-span-full py-10 text-center text-muted-foreground">Все още няма снимки.</div>}
        </div>
      </div>
    </div>
  );
}

type DocType = "skica" | "tax_assessment" | "encumbrance_check" | "other";
type DocRow = { id: string; doc_type: DocType; file_name: string; file_url: string; file_path: string; mime_type?: string | null; created_at: string };

const DOC_TYPES: { key: DocType; label: string }[] = [
  { key: "skica", label: "Скица" },
  { key: "tax_assessment", label: "Данъчна оценка" },
  { key: "encumbrance_check", label: "Проверка за тежести" },
  { key: "other", label: "Друг документ" },
];

function DocumentsModal({ property, onClose }: { property: Row; onClose: () => void }) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [uploadingType, setUploadingType] = useState<DocType | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("property_documents")
      .select("id, doc_type, file_name, file_url, file_path, created_at")
      .eq("property_id", property.id);
    setDocs((data as DocRow[]) ?? []);
  };
  useEffect(() => { load(); }, [property.id]);

  const byType = (t: DocType) => docs.find((d) => d.doc_type === t);

  const onUpload = async (type: DocType, file: File | null) => {
    if (!file) return;
    setUploadingType(type);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${property.id}/${type}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("property-documents")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) { toast.error(upErr.message); return; }

      const existing = byType(type);
      if (existing) {
        await supabase.storage.from("property-documents").remove([existing.file_path]).catch(() => {});
        await supabase.from("property_documents").delete().eq("id", existing.id);
      }

      const { data: signed } = await supabase.storage.from("property-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
      const { error: insErr } = await supabase.from("property_documents").insert({
        property_id: property.id,
        doc_type: type,
        file_name: file.name,
        file_url: signed?.signedUrl ?? "",
        file_path: path,
        mime_type: file.type,
        file_size: file.size,
      });
      if (insErr) { toast.error(insErr.message); return; }
      await load();
    } finally { setUploadingType(null); }
  };

  const openDoc = async (d: DocRow) => {
    const { data, error } = await supabase.storage.from("property-documents").createSignedUrl(d.file_path, 60 * 10);
    if (error || !data) { toast.error(error?.message ?? "Грешка"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (d: DocRow) => {
    if (!confirm(`Изтриване на "${d.file_name}"?`)) return;
    await supabase.storage.from("property-documents").remove([d.file_path]).catch(() => {});
    await supabase.from("property_documents").delete().eq("id", d.id);
    load();
  };

  const mergeAndUpload = async (): Promise<{ url: string; path: string } | null> => {
    const pdfDocs = docs.filter((d) => (d.mime_type ?? "").includes("pdf") || d.file_name.toLowerCase().endsWith(".pdf"));
    if (!pdfDocs.length) { toast.error("Няма PDF документи за обединяване"); return null; }
    setMerging(true);
    try {
      const merged = await PDFDocument.create();
      for (const d of pdfDocs) {
        const { data, error } = await supabase.storage.from("property-documents").download(d.file_path);
        if (error || !data) throw new Error(error?.message ?? `Грешка при ${d.file_name}`);
        const bytes = new Uint8Array(await data.arrayBuffer());
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      const out = await merged.save();
      const path = `${property.id}/merged-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("property-documents")
        .upload(path, new Blob([out as BlobPart], { type: "application/pdf" }), { contentType: "application/pdf", upsert: true });
      if (upErr) throw new Error(upErr.message);
      const { data: signed } = await supabase.storage.from("property-documents").createSignedUrl(path, 60 * 60 * 24 * 30);
      const url = signed?.signedUrl ?? "";
      setMergedUrl(url);
      toast.success(`Обединени ${pdfDocs.length} файла`);
      return { url, path };
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при обединяване");
      return null;
    } finally { setMerging(false); }
  };

  const sendToPartner = async (partner: (typeof MORTGAGE_PARTNERS)[number]) => {
    if (!partner.email) { toast.error(`Имейлът на ${partner.name} още не е добавен`); return; }
    let link = mergedUrl;
    if (!link) {
      const res = await mergeAndUpload();
      if (!res) return;
      link = res.url;
    }
    const subject = `Документи за имот — ${property.title ?? ""}`;
    const body = [
      `Здравей, ${partner.name},`,
      "",
      `Изпращам Ви документите за имот: ${property.title ?? ""}`,
      "",
      "Обединен PDF (валиден 30 дни):",
      link,
      "",
      "Поздрави,",
      "Имоти Надежда",
    ].join("\n");
    window.location.href = `mailto:${partner.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success(`Отворено е писмо до ${partner.name}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#8B1A2B]/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl overflow-y-auto overscroll-contain bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl h-[100dvh] max-h-[100dvh] sm:rounded-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl text-accent-foreground">Документи</h2>
            <p className="text-sm text-muted-foreground">{property.title}</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <ul className="space-y-3">
          {DOC_TYPES.map(({ key, label }) => {
            const doc = byType(key);
            const isUploading = uploadingType === key;
            return (
              <li key={key} className="flex items-center gap-3 rounded-xl border border-border bg-background p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${doc ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                  {doc ? <Check className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{label}</div>
                  {doc ? (
                    <button onClick={() => openDoc(doc)} className="block max-w-full truncate text-left text-xs text-primary hover:underline">
                      {doc.file_name}
                    </button>
                  ) : (
                    <div className="text-xs text-muted-foreground">Няма прикачен файл</div>
                  )}
                </div>
                {doc && (
                  <button onClick={() => openDoc(doc)} title="Изтегли" className="text-primary"><Download className="h-4 w-4" /></button>
                )}
                <label className="cursor-pointer rounded-lg border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2 text-xs hover:bg-muted">
                  {isUploading ? "Качване…" : doc ? "Замени" : "Прикачи"}
                  <input type="file" className="hidden" disabled={isUploading} onChange={(e) => onUpload(key, e.target.files?.[0] ?? null)} />
                </label>
                {doc && (
                  <button onClick={() => remove(doc)} className="text-destructive" title="Изтрий"><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-5 space-y-2 border-t border-border pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Действия</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              onClick={() => mergeAndUpload()}
              disabled={merging}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-700/30 bg-white/90 text-slate-800 px-3 py-2.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
              Обедини PDF файлове
            </button>
            {MORTGAGE_PARTNERS.map((p) => (
              <button
                key={p.id}
                onClick={() => sendToPartner(p)}
                disabled={merging || !p.email}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-[#7a0d22] px-3 py-2.5 text-xs font-semibold text-amber-100 hover:opacity-90 disabled:opacity-50"
                title={p.email || "Имейлът ще бъде добавен"}
              >
                <Mail className="h-4 w-4" />
                Изпрати на {p.name}
              </button>
            ))}
          </div>
          {mergedUrl && (
            <a href={mergedUrl} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-primary hover:underline">
              ✓ Обединен PDF — отвори
            </a>
          )}
          <p className="text-[11px] text-muted-foreground">
            * „Обедини" слива всички PDF документи в един файл и го качва защитено. Бутоните за изпращане отварят имейл клиента с линк към обединения PDF.
          </p>
        </div>
      </div>
    </div>
  );
}

