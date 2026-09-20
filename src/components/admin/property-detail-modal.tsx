import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { getArchiveDetail, updateArchive, publishArchive } from "@/lib/archive.functions";
import { analyzeProperty } from "@/lib/property-ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  X,
  Upload,
  FileText,
  Loader2,
  Send,
  CheckCircle2,
  Download,
  Trash2,
  Folder,
  FolderOpen,
  Sparkles,
} from "lucide-react";
import { downloadPropertyZip } from "@/lib/download-archive";

type Props = {
  id: string;
  onClose: () => void;
  onDeleted?: (id: string) => void;
  onChanged?: () => void;
};

type AiResult = {
  site_description: string;
  city: string | null;
  quarter: string | null;
  property_type: string | null;
  area_sqm: number | null;
  rooms: number | null;
  floor: number | null;
  condition: string | null;
  highlights: string[];
  our_price: number | null;
};

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
  const doPublish = useServerFn(publishArchive);

  const [row, setRow] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [ai, setAi] = useState<AiResult | null>(null);
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
  useEffect(() => {
    fetchRow(); /* eslint-disable-next-line */
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
      const { error } = await supabase.storage
        .from("archive-docs")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("archive-docs")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const docs = {
        ...(row?.documents ?? {}),
        [key]: { path, name: file.name, url: signed?.signedUrl ?? null },
      };
      await patch({ documents: docs }, true);
      toast.success("Качено");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при качване");
    }
    setUploadingKey(null);
  };

  /**
   * Качва снимки и документи. Използва се и за „Прикачи папка“ —
   * с брояч на напредъка, защото папките често са с десетки файлове.
   */
  const uploadImages = async (files: FileList) => {
    const all = Array.from(files);
    const images = all.filter((f) => f.type.startsWith("image/"));
    const docs = all.filter((f) => !f.type.startsWith("image/"));
    setUploadingImages(true);
    setProgress({ done: 0, total: all.length });
    try {
      const uploaded: string[] = [];
      const extraDocs: Record<string, any> = {};
      let done = 0;
      for (const f of images) {
        const ext = f.name.split(".").pop() ?? "jpg";
        const path = `${id}/images/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("archive-docs").upload(path, f);
        if (error) throw error;
        const { data: signed } = await supabase.storage
          .from("archive-docs")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (signed?.signedUrl) uploaded.push(signed.signedUrl);
        done += 1;
        setProgress({ done, total: all.length });
      }
      for (const f of docs) {
        const ext = f.name.split(".").pop() ?? "bin";
        const key = `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const path = `${id}/docs/${key}.${ext}`;
        const { error } = await supabase.storage
          .from("archive-docs")
          .upload(path, f, { upsert: true });
        if (error) throw error;
        const { data: signed } = await supabase.storage
          .from("archive-docs")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        extraDocs[key] = { path, name: f.name, url: signed?.signedUrl ?? null };
        done += 1;
        setProgress({ done, total: all.length });
      }
      const nextImages = [...(row?.images ?? []), ...uploaded];
      const nextDocs = { ...(row?.documents ?? {}), ...extraDocs };
      await patch({ images: nextImages, documents: nextDocs }, true);
      toast.success(
        `Качени ${uploaded.length} снимки${docs.length ? ` и ${docs.length} документа` : ""}`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при качване");
    }
    setUploadingImages(false);
    setProgress(null);
  };

  const onZip = async () => {
    if (!row) return;
    setDownloading(true);
    try {
      await downloadPropertyZip(row);
      toast.success("Готово");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    }
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

  const runAi = useServerFn(analyzeProperty);

  /** AI анализ по снимките + личното описание. Само предлага — записва при „Приеми“. */
  const onAnalyze = async () => {
    if (!row) return;
    setAiBusy(true);
    setAi(null);
    try {
      const res = await runAi({
        data: {
          image_urls: ((row.images ?? []) as string[]).slice(0, 8),
          personal_description: personalDesc || undefined,
          city: row.cities?.name ?? undefined,
          quarter: row.quarters?.name ?? undefined,
          property_type: row.property_type ?? undefined,
          area_sqm: area ? Number(area) : null,
          personal_price: personalPrice ? Number(personalPrice) : null,
          currency: currency || "EUR",
        },
      });
      setAi(res as AiResult);
    } catch (e: any) {
      toast.error(e?.message ?? "AI грешка");
    }
    setAiBusy(false);
  };

  /** Попълва само празните полета — никога не изтрива вече въведено. */
  const acceptAi = () => {
    if (!ai) return;
    if (ai.site_description) setSiteDesc(ai.site_description);

    if (ai.area_sqm != null && !area.trim()) setArea(String(ai.area_sqm));
    if (ai.our_price != null && !officialPrice.trim()) setOfficialPrice(String(ai.our_price));
    setAi(null);
    toast.success("Приложено — прегледай и натисни „Запази“");
  };

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

  /**
   * Публикува/скрива имота на сайта. Първо записва въведеното,
   * после синхронизира публичната обява (описание за сайта + наша цена).
   */
  const togglePublish = async () => {
    await saveAll();
    const next = !row?.is_published;
    setSaving(true);
    try {
      const res: any = await doPublish({ data: { id, publish: next } });
      setRow((r: any) => ({ ...r, is_published: next }));
      onChanged?.();
      const publicId: string | null = res?.property_id ?? null;
      if (next && publicId) {
        const path = `/properties/${publicId}`;
        const fullUrl = typeof window !== "undefined" ? window.location.origin + path : path;
        toast.success(`Публикувано на сайта: ${fullUrl}`);
        onClose();
        await navigate({ to: "/properties/$propertyId", params: { propertyId: publicId } });
        return;
      }
      toast.success(next ? "Публикувано на сайта" : "Скрито от сайта");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при публикуване");
    }
    setSaving(false);
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
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl rounded-2xl bg-[rgb(255,251,243)] p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-primary/60 hover:bg-primary/10"
          aria-label="Затвори"
        >
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
              <div className="flex items-center gap-2 font-display text-3xl text-primary">
                <Folder className="h-6 w-6 text-amber-600" />
                {row.price
                  ? `${Number(row.price).toLocaleString()} ${row.currency ?? "EUR"}`
                  : row.title}
              </div>
              <div className="mt-1 text-sm text-primary/70">
                {row.cities?.name ?? "—"} · {row.quarters?.name ?? "—"}
                {row.is_published && <span className="ml-2 text-emerald-700"> ✓ Публикуван</span>}
              </div>
            </div>

            {/* Images */}
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold uppercase tracking-wider text-primary/70">
                  Снимки
                  {progress && (
                    <span className="ml-2 text-[11px] font-bold text-amber-800">
                      {progress.done} / {progress.total}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5">
                    {uploadingImages ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Добави снимки
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files && uploadImages(e.target.files)}
                    />
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5">
                    <FolderOpen className="h-3.5 w-3.5" />
                    Прикачи папка
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      // @ts-expect-error — нестандартни атрибути за избор на цяла директория
                      webkitdirectory=""
                      directory=""
                      onChange={(e) => e.target.files?.length && uploadImages(e.target.files)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={onAnalyze}
                    disabled={aiBusy || !(row.images ?? []).length}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-[#4a0d1a] hover:bg-amber-400 disabled:opacity-50"
                    title={
                      (row.images ?? []).length ? "AI анализ по снимките" : "Първо прикачи снимки"
                    }
                  >
                    {aiBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    AI анализ
                  </button>
                </div>
              </div>
              {(row.images ?? []).length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {(row.images as string[]).map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-square overflow-hidden rounded-lg border border-primary/10 bg-primary/5"
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-primary/20 p-6 text-center text-sm text-primary/50">
                  Няма снимки
                </div>
              )}

              {ai && (
                <div className="mt-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#4a0d1a]">
                    <Sparkles className="h-4 w-4" /> Предложение от AI
                  </div>
                  <div className="mb-2 grid gap-1 text-xs text-primary/80 sm:grid-cols-2">
                    <div>Град: {ai.city ?? "—"}</div>
                    <div>Квартал: {ai.quarter ?? "—"}</div>
                    <div>Тип: {ai.property_type ?? "—"}</div>
                    <div>Площ: {ai.area_sqm ?? "—"} м²</div>
                    <div>Стаи: {ai.rooms ?? "—"}</div>
                    <div>Етаж: {ai.floor ?? "—"}</div>
                    <div>Състояние: {ai.condition ?? "—"}</div>
                    <div className="font-semibold text-emerald-800">
                      Наша цена: {ai.our_price != null ? `${ai.our_price} ${currency}` : "—"} (лична
                      + 5)
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-amber-300 bg-white p-3 text-xs text-primary">
                    {ai.site_description || "(няма текст)"}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={acceptAi}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"
                    >
                      Приеми
                    </button>
                    <button
                      type="button"
                      onClick={() => setAi(null)}
                      className="rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-xs font-semibold text-primary"
                    >
                      Отмени
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Documents */}
            <section>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary/70">
                <FileText className="h-4 w-4" /> Документи към папката
              </div>
              <div className="divide-y divide-primary/10 rounded-xl border border-primary/15 bg-white">
                {DOC_SLOTS.map((slot) => {
                  const doc = row.documents?.[slot.key];
                  const busy = uploadingKey === slot.key;
                  return (
                    <div key={slot.key} className="flex items-center justify-between gap-3 p-3.5">
                      <div>
                        <div className="text-sm font-semibold text-primary">{slot.label}</div>
                        {doc?.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-amber-800 underline"
                          >
                            {doc.name ?? "Виж файла"}
                          </a>
                        ) : (
                          <div className="text-xs text-primary/50">Липсва</div>
                        )}
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5">
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        Качи
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) =>
                            e.target.files?.[0] && uploadDoc(slot.key, e.target.files[0])
                          }
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Цени и площ — ясно разделени: публично (зелено) и лично (бордо) */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Наша цена (за сайта)",
                  note: "отива на сайта",
                  tone: "site",
                  val: officialPrice,
                  set: setOfficialPrice,
                  type: "number",
                },
                {
                  label: "Валута",
                  note: "",
                  tone: "plain",
                  val: currency,
                  set: setCurrency,
                  type: "text",
                },
                {
                  label: "Площ м²",
                  note: "",
                  tone: "plain",
                  val: area,
                  set: setArea,
                  type: "number",
                },
                {
                  label: "Лична цена",
                  note: "само в CRM",
                  tone: "private",
                  val: personalPrice,
                  set: setPersonalPrice,
                  type: "number",
                },
              ].map((f) => (
                <label key={f.label} className="block">
                  <div
                    className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${
                      f.tone === "site"
                        ? "text-emerald-800"
                        : f.tone === "private"
                          ? "text-[#8B1A2B]"
                          : "text-primary/60"
                    }`}
                  >
                    {f.label}
                    {f.note && (
                      <span className="ml-1 font-semibold normal-case opacity-80">· {f.note}</span>
                    )}
                  </div>
                  <input
                    type={f.type}
                    value={f.val}
                    onChange={(e) => f.set(e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-primary ${
                      f.tone === "site"
                        ? "border-emerald-500/60 bg-emerald-50/60"
                        : f.tone === "private"
                          ? "border-[#8B1A2B]/50 bg-[#8B1A2B]/5"
                          : "border-primary/20 bg-white"
                    }`}
                  />
                </label>
              ))}
            </section>

            {/* Descriptions */}
            <section className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-sm font-semibold text-[#8B1A2B]">
                  Лично описание · само в CRM
                </div>
                <div className="mb-2 text-[11px] text-primary/50">
                  Не се публикува. AI не го променя.
                </div>
                <textarea
                  value={personalDesc}
                  onChange={(e) => setPersonalDesc(e.target.value)}
                  rows={9}
                  className="w-full rounded-lg border border-[#8B1A2B]/50 bg-[#8B1A2B]/5 p-3 text-sm text-primary"
                  placeholder="Договорки, телефони, вътрешни бележки…"
                />
              </div>
              <div>
                <div className="mb-1 text-sm font-semibold text-emerald-800">
                  Описание за сайта * · публично
                </div>
                <div className="mb-2 text-[11px] text-primary/50">
                  Публикува се на сайта. Попълва се и от „AI анализ“.
                </div>
                <textarea
                  value={siteDesc}
                  onChange={(e) => setSiteDesc(e.target.value)}
                  rows={9}
                  className="w-full rounded-lg border border-emerald-500/60 bg-emerald-50/60 p-3 text-sm text-primary"
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
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Запази
              </button>
              <button
                onClick={togglePublish}
                disabled={saving}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow disabled:opacity-50 ${row.is_published ? "bg-emerald-600 text-white" : "bg-amber-500 text-primary hover:bg-amber-400"}`}
              >
                {row.is_published ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {row.is_published ? "Вече публикуван" : "Публикувай във всички сайтове"}
              </button>
              <button
                onClick={onZip}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-white px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
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
