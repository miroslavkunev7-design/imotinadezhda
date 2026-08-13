import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getArchiveDetail, updateArchive } from "@/lib/archive.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload, FileText, Loader2, Send, CheckCircle2, Download, Trash2, Folder } from "lucide-react";
import { downloadPropertyZip } from "@/lib/download-archive";

type Props = { id: string; onClose: () => void; onDeleted?: (id: string) => void; onChanged?: () => void };

const DOC_SLOTS = [
  { key: "skica", label: "Скица" },
  { key: "tax_evaluation", label: "Данъчна оценка" },
  { key: "encumbrance", label: "Проверка за тежести" },
  { key: "notary_deed", label: "Нотариален акт" },
  { key: "other", label: "Друг документ" },
] as const;

export function PropertyDetailModal({ id, onClose, onDeleted, onChanged }: Props) {
  const load = useServerFn(getArchiveDetail);
  const save = useServerFn(updateArchive);

  const [row, setRow] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchRow = async () => {
    try {
      const data = await load({ data: { id } });
      setRow(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    }
    setLoading(false);
  };
  useEffect(() => { fetchRow(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = async (p: any, silent = false) => {
    setSaving(true);
    try {
      await save({ data: { id, patch: p } });
      setRow((r: any) => ({ ...r, ...p }));
      if (!silent) toast.success("Запазено");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при запис");
    }
    setSaving(false);
  };

  const uploadDoc = async (key: string, file: File) => {
    setUploadingKey(key);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${id}/docs/${key}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("archive-docs").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("archive-docs").createSignedUrl(path, 60 * 60 * 24 * 365);
      const docs = { ...(row?.documents ?? {}), [key]: { path, name: file.name, url: signed?.signedUrl ?? null } };
      await patch({ documents: docs }, true);
      toast.success("Качено");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при качване");
    }
    setUploadingKey(null);
  };

  const uploadImages = async (files: FileList) => {
    setUploadingImages(true);
    try {
      const uploaded: string[] = [];
      for (const f of Array.from(files)) {
        const ext = f.name.split(".").pop() ?? "jpg";
        const path = `${id}/images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("archive-docs").upload(path, f);
        if (error) throw error;
        const { data: signed } = await supabase.storage.from("archive-docs").createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) uploaded.push(signed.signedUrl);
      }
      const images = [...(row?.images ?? []), ...uploaded];
      await patch({ images }, true);
      toast.success(`Качени ${uploaded.length} снимки`);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при качване");
    }
    setUploadingImages(false);
  };

  const onZip = async () => {
    if (!row) return;
    setDownloading(true);
    try { await downloadPropertyZip(row); toast.success("Готово"); }
    catch (e: any) { toast.error(e?.message ?? "Грешка"); }
    setDownloading(false);
  };

  const [officialPrice, setOfficialPrice] = useState<string>("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [area, setArea] = useState<string>("");
  const [personalPrice, setPersonalPrice] = useState<string>("");
  const [personalDesc, setPersonalDesc] = useState<string>("");
  const [siteDesc, setSiteDesc] = useState<string>("");
  const initRef = useRef(false);
  useEffect(() => {
    if (!row || initRef.current) return;
    initRef.current = true;
    setOfficialPrice(row.price != null ? String(row.price) : "");
    setCurrency(row.currency ?? "EUR");
    setArea(row.area_sqm != null ? String(row.area_sqm) : "");
    setPersonalPrice(row.personal_price != null ? String(row.personal_price) : "");
    setPersonalDesc(row.personal_description ?? "");
    setSiteDesc(row.description ?? "");
  }, [row]);

  const saveAll = async () => {
    await patch({
      price: officialPrice ? Number(officialPrice) : null,
      currency: currency || "EUR",
      area_sqm: area ? Number(area) : null,
      personal_price: personalPrice ? Number(personalPrice) : null,
      personal_description: personalDesc || null,
      description: siteDesc || null,
    });
  };

  const togglePublish = async () => {
    await saveAll();
    await patch({ is_published: !row?.is_published });
  };

  const onDelete = async () => {
    if (!confirm("Изтриване от архива?")) return;
    try {
      const { error } = await supabase.from("archived_properties").delete().eq("id", id);
      if (error) throw error;
      onDeleted?.(id);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8" onClick={onClose}>
      <div
        data-crm-light-modal
        className="relative w-full max-w-5xl rounded-2xl bg-[#fffbf3] p-6 text-[#2a0a12] shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-primary/60 hover:bg-primary/10" aria-label="Затвори">
          <X className="h-5 w-5" />
        </button>

        {loading || !row ? (
          <div className="flex items-center justify-center py-24 text-primary/60">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 font-display text-3xl text-[#31020c]">
                <Folder className="h-6 w-6 text-amber-700" />
                {row.price ? `${Number(row.price).toLocaleString()} ${row.currency ?? "EUR"}` : row.title}
              </div>
              <div className="mt-1 text-sm text-[#5a3a3f]">
                {row.cities?.name ?? "—"} · {row.quarters?.name ?? "—"}
                {row.is_published && <span className="ml-2 text-emerald-700"> ✓ Публикуван</span>}
              </div>
            </div>

            {/* Images */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold uppercase tracking-wider text-[#5a3a3f]">Снимки</div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#8B1A2B]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#8B1A2B] hover:bg-[#8B1A2B]/5">
                  {uploadingImages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Добави снимки
                  <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => e.target.files && uploadImages(e.target.files)} />
                </label>
              </div>
              {(row.images ?? []).length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {(row.images as string[]).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg border border-primary/10 bg-primary/5">
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[#8B1A2B]/25 p-6 text-center text-sm text-[#5a3a3f]">Няма снимки</div>
              )}
            </section>

            {/* Documents */}
            <section>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#5a3a3f]">
                <FileText className="h-4 w-4" /> Документи към папката
              </div>
              <div className="divide-y divide-primary/10 rounded-xl border border-primary/15 bg-white">
                {DOC_SLOTS.map((slot) => {
                  const doc = row.documents?.[slot.key];
                  const busy = uploadingKey === slot.key;
                  return (
                    <div key={slot.key} className="flex items-center justify-between gap-3 p-3.5">
                      <div>
                        <div className="text-sm font-semibold text-[#31020c]">{slot.label}</div>
                        {doc?.url ? (
                          <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs text-amber-800 underline">{doc.name ?? "Виж файла"}</a>
                        ) : (
                          <div className="text-xs text-[#5a3a3f]">Липсва</div>
                        )}
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#8B1A2B]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#8B1A2B] hover:bg-[#8B1A2B]/5">
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Качи
                        <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadDoc(slot.key, e.target.files[0])} />
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Price / area row */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Официална цена", val: officialPrice, set: setOfficialPrice, type: "number" },
                { label: "Валута", val: currency, set: setCurrency, type: "text" },
                { label: "Площ м²", val: area, set: setArea, type: "number" },
                { label: "Лична цена", val: personalPrice, set: setPersonalPrice, type: "number" },
              ].map((f) => (
                <label key={f.label} className="block">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#5a3a3f]">{f.label}</div>
                  <input
                    type={f.type}
                    value={f.val}
                    onChange={(e) => f.set(e.target.value)}
                    className="w-full rounded-lg border border-[#8B1A2B]/25 bg-white px-3 py-2 text-sm text-[#2a0a12]"
                  />
                </label>
              ))}
            </section>

            {/* Descriptions */}
            <section className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-sm font-semibold text-[#31020c]">Лично описание</div>
                <div className="mb-2 text-[11px] text-[#5a3a3f]">Не се публикува.</div>
                <textarea
                  value={personalDesc}
                  onChange={(e) => setPersonalDesc(e.target.value)}
                  rows={9}
                  className="w-full rounded-lg border border-[#8B1A2B]/25 bg-white p-3 text-sm text-[#2a0a12]"
                  placeholder="Договорки, телефони, вътрешни бележки…"
                />
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold text-[#31020c]">Описание за сайта *</div>
                <div className="mb-2 text-[11px] text-[#5a3a3f]">Публикува се на сайта.</div>
                <textarea
                  value={siteDesc}
                  onChange={(e) => setSiteDesc(e.target.value)}
                  rows={9}
                  className="w-full rounded-lg border border-[#8B1A2B]/25 bg-white p-3 text-sm text-[#2a0a12]"
                  placeholder="Публично описание на обявата…"
                />
              </div>
            </section>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 border-t border-primary/10 pt-4">
              <button
                onClick={saveAll}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow hover:brightness-110 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Запази
              </button>
              <button
                onClick={togglePublish}
                disabled={saving}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow disabled:opacity-50 ${row.is_published ? "bg-emerald-600 text-white" : "bg-amber-500 text-primary hover:bg-amber-400"}`}
              >
                {row.is_published ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {row.is_published ? "Вече публикуван" : "Публикувай във всички сайтове"}
              </button>
              <button
                onClick={onZip}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-xl border border-[#8B1A2B]/25 bg-white px-4 py-2.5 text-sm font-semibold text-[#8B1A2B] hover:bg-[#8B1A2B]/5 disabled:opacity-50"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                ZIP
              </button>
              <div className="ml-auto" />
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Изтрий
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}