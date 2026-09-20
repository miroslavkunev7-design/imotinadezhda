/**
 * Избор на форма за маркирания блок: над 200 форми, търсачка, категории,
 * мини предварителни изгледи и таб „От сайта“ (копиране на четковите форми).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { createCustomShapeFromFile, loadCustomShapes } from "@/lib/crm-custom-shapes";

import {
  CRM_SHAPES,
  SHAPE_CATEGORY_LABELS,
  SHAPE_RATIOS,
  filterShapes,
  shapeStyle,
  type CrmShape,
  type ShapeCategory,
} from "@/lib/crm-shapes";
import type { BlockOverride } from "@/lib/crm-page-settings/types";

type Props = {
  current?: BlockOverride;
  /** Включен ли е режим „преглед преди запазване“ */
  previewOn: boolean;
  /** Има ли непотвърдена пробна форма */
  hasTrial: boolean;
  onTogglePreview: () => void;
  onPick: (next: Partial<BlockOverride>, scope?: "block" | "all") => void;
  /** Поставя формата като свободен елемент на текущата страница. */
  onPlace?: (shapeId: string, opts: { keepImage: boolean }) => void;
  onApplyTrial: () => void;
  onCancelTrial: () => void;
  onClose: () => void;
};

const TABS: Array<{ key: ShapeCategory | "all" | "site"; label: string }> = [
  { key: "all", label: "Всички" },
  { key: "rect", label: "Правоъгълни" },
  { key: "round", label: "Заоблени" },
  { key: "clip", label: "Изрязани" },
  { key: "site", label: "От сайта" },
  { key: "custom", label: "Мои форми" },
];

export function ShapePicker({
  current,
  previewOn,
  hasTrial,
  onTogglePreview,
  onPick,
  onPlace,
  onApplyTrial,
  onCancelTrial,
  onClose,
}: Props) {
  const [tab, setTab] = useState<ShapeCategory | "all" | "site">("all");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [keepImage, setKeepImage] = useState(true);
  const [customVersion, setCustomVersion] = useState(0);
  const shapeFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadCustomShapes().then(() => setCustomVersion((v) => v + 1));
  }, []);

  const shapes = useMemo<CrmShape[]>(
    () => filterShapes(query, tab === "site" ? "brush" : tab),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, tab, customVersion],
  );

  return (
    <div
      data-crm-edit-ui
      className="fixed bottom-4 left-1/2 z-[9999] w-[min(96vw,720px)] -translate-x-1/2 rounded-2xl border border-amber-400/50 bg-[#3a0210] p-3 text-amber-100 shadow-2xl"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-amber-300">
          Форма на блока · {CRM_SHAPES.length} форми
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePreview}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              previewOn
                ? "border-emerald-300 bg-emerald-400/25 text-emerald-50"
                : "border-amber-400/30 text-amber-200/80"
            }`}
          >
            {previewOn ? "Преглед: вкл." : "Преглед: изкл."}
          </button>
          <button type="button" onClick={onClose} aria-label="Затвори избора на форма">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              tab === t.key
                ? "border-amber-300 bg-amber-400/25 text-amber-50"
                : "border-amber-400/30 text-amber-200/80"
            }`}
          >
            {t.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 rounded-full border border-amber-400/30 px-2 py-1">
          <Search className="h-3.5 w-3.5 text-amber-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Търси форма…"
            aria-label="Търси форма"
            className="w-32 bg-transparent text-[11px] text-amber-50 outline-none placeholder:text-amber-200/50"
          />
        </label>
      </div>

      {tab === "custom" && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => shapeFile.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
            Качи снимка на форма
          </button>
          <button
            type="button"
            onClick={() => setKeepImage((v) => !v)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              keepImage
                ? "border-emerald-300 bg-emerald-400/25 text-emerald-50"
                : "border-amber-400/30 text-amber-200/80"
            }`}
          >
            {keepImage ? "Пази снимката" : "Само формата (маска)"}
          </button>
          <span className="text-[10.5px] text-amber-200/65">
            Пази се постоянно и е налична на всяка страница.
          </span>
          <input
            ref={shapeFile}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setUploading(true);
              try {
                const { shapeId } = await createCustomShapeFromFile(
                  f,
                  f.name.replace(/\.[^.]+$/, ""),
                  {
                    keepImage,
                  },
                );
                setCustomVersion((v) => v + 1);
                onPick({ shape: shapeId });
                toast.success("Формата е записана");
              } catch (err: any) {
                toast.error(err?.message ?? "Грешка при качване");
              } finally {
                setUploading(false);
              }
            }}
          />
        </div>
      )}

      <div className="max-h-[210px] overflow-y-auto pr-1">
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {shapes.map((s) => (
            <div key={s.id} className="flex flex-col gap-1">
              <button
                type="button"
                title={`${s.name} · ${SHAPE_CATEGORY_LABELS[s.category]}`}
                onClick={() => onPick({ shape: s.id })}
                onMouseEnter={() => previewOn && onPick({ shape: s.id })}
                className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[9px] leading-tight ${
                  current?.shape === s.id
                    ? "border-amber-300 bg-amber-400/20 text-amber-50"
                    : "border-amber-400/25 text-amber-200/75 hover:bg-amber-400/10"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-8 w-full bg-amber-200"
                  style={shapeStyle({ shape: s.id })}
                />
                <span className="line-clamp-2 w-full text-center">{s.name}</span>
              </button>
              {onPlace && (
                <button
                  type="button"
                  onClick={() => onPlace(s.id, { keepImage: keepImage && !!s.imageUrl })}
                  className="rounded-md border border-emerald-300/50 bg-emerald-400/15 px-1 py-0.5 text-[9px] font-bold text-emerald-50"
                >
                  Постави
                </button>
              )}
            </div>
          ))}
          {shapes.length === 0 && (
            <div className="col-span-full py-4 text-center text-[11px] text-amber-200/70">
              Няма форма с това име.
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-amber-400/20 pt-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] uppercase tracking-wide text-amber-300/80">Пропорция</span>
          {SHAPE_RATIOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onPick({ ratio: r })}
              className={`rounded-md border px-1.5 py-0.5 text-[10.5px] ${
                (current?.ratio ?? "auto") === r
                  ? "border-amber-300 bg-amber-400/25 text-amber-50"
                  : "border-amber-400/30 text-amber-200/80"
              }`}
            >
              {r === "auto" ? "Авто" : r.replace("/", ":")}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-[10.5px] text-amber-300/80">
          Радиус {current?.radius ?? 0}px
          <input
            type="range"
            min={0}
            max={64}
            step={1}
            value={current?.radius ?? 0}
            onChange={(e) => onPick({ radius: Number(e.target.value) })}
            className="w-28 accent-amber-400"
            aria-label="Радиус на формата"
          />
        </label>

        <button
          type="button"
          onClick={() =>
            onPick({ shape: current?.shape, radius: current?.radius, ratio: current?.ratio }, "all")
          }
          className="rounded-md border border-amber-400/40 px-2 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-400/15"
        >
          Приложи към всички блокове
        </button>
        <button
          type="button"
          onClick={() => onPick({ shape: undefined, radius: undefined, ratio: undefined })}
          className="rounded-md border border-amber-400/30 px-2 py-1 text-[11px] text-amber-200/80"
        >
          Без форма
        </button>
      </div>

      {previewOn && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2 py-1.5">
          <span className="text-[10.5px] font-semibold text-emerald-100">
            {hasTrial
              ? "Виждаш пробна форма — още не е запазена."
              : "Посочи или избери форма, за да я видиш живо преди запазване."}
          </span>
          <button
            type="button"
            disabled={!hasTrial}
            onClick={onApplyTrial}
            className="ml-auto rounded-md border border-emerald-300 bg-emerald-400/25 px-2.5 py-1 text-[11px] font-bold text-emerald-50 disabled:opacity-40"
          >
            Приложи
          </button>
          <button
            type="button"
            disabled={!hasTrial}
            onClick={onCancelTrial}
            className="rounded-md border border-amber-400/30 px-2.5 py-1 text-[11px] text-amber-100 disabled:opacity-40"
          >
            Отмени
          </button>
        </div>
      )}
    </div>
  );
}

export default ShapePicker;
