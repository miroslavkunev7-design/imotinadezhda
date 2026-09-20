/**
 * „Форми: прехвърляне“ — експорт/импорт на настройките за форми между
 * страници и админ-табла + качване на собствена форма от снимка (постоянно).
 */
import { useEffect, useRef, useState } from "react";
import { Download, Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { useCrmPageSettings } from "@/hooks/use-crm-page-settings";
import {
  applyShapePreset,
  buildShapePreset,
  downloadShapePreset,
  parseShapePreset,
  readFileAsText,
} from "@/lib/crm-page-settings/shape-transfer";
import {
  createCustomShapeFromFile,
  createCustomShapeFromMask,
  deleteCustomShape,
  loadCustomShapes,
  type CustomShapeRow,
} from "@/lib/crm-custom-shapes";
import { SHAPES_BY_ID, shapeStyle } from "@/lib/crm-shapes";

export function ShapeTransferSection() {
  const { pageKey, settings, patch, save } = useCrmPageSettings();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<CustomShapeRow[]>([]);
  const [name, setName] = useState("");
  const fileIn = useRef<HTMLInputElement>(null);
  const presetIn = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadCustomShapes().then(setRows);
  }, []);

  const shapeCount = Object.values(settings.blocks ?? {}).filter((b) => b?.shape).length;

  async function handleExport() {
    const preset = buildShapePreset(pageKey, settings);
    if (Object.keys(preset.blocks).length === 0) {
      toast.error("Няма форми за експорт на тази страница");
      return;
    }
    downloadShapePreset(preset);
    toast.success("Формите са експортирани във файл");
  }

  async function handleCopy() {
    const preset = buildShapePreset(pageKey, settings);
    await navigator.clipboard.writeText(JSON.stringify(preset));
    toast.success("Формите са копирани — постави ги на другата страница");
  }

  async function applyPresetRaw(raw: string) {
    setBusy(true);
    try {
      const preset = parseShapePreset(raw);
      // Собствените форми (маски) се записват локално, ако липсват.
      const remap: Record<string, string> = {};
      for (const cs of preset.customShapes) {
        if (SHAPES_BY_ID[cs.id]) continue;
        const { shapeId } = await createCustomShapeFromMask(cs.name, cs.maskImage);
        remap[cs.id] = shapeId;
      }
      if (preset.customShapes.length > 0) setRows(await loadCustomShapes());
      patch((s) => applyShapePreset(s, preset, remap));
      await save();
      toast.success(`Формите са импортирани от „${preset.pageKey || "друга страница"}“ и запазени`);
    } catch (err: any) {
      toast.error(err?.message ?? "Грешка при импорт");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-amber-400/20 pt-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/75">
        Форми — прехвърляне между страници
      </div>
      <p className="text-[11px] leading-relaxed text-amber-200/65">
        Тази страница използва {shapeCount} форми. Експортирай ги във файл и ги импортирай на друга
        страница или табло.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleExport()}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/30 px-2 py-2 text-[11px] text-amber-100 hover:bg-amber-400/10"
        >
          <Download className="h-3.5 w-3.5" /> Експорт (файл)
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => presetIn.current?.click()}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/30 px-2 py-2 text-[11px] text-amber-100 hover:bg-amber-400/10"
        >
          <Upload className="h-3.5 w-3.5" /> Импорт (файл)
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleCopy()}
          className="rounded-lg border border-amber-400/25 px-2 py-2 text-[11px] text-amber-200/85"
        >
          Копирай
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            try {
              const raw = await navigator.clipboard.readText();
              await applyPresetRaw(raw);
            } catch {
              toast.error("Клипбордът е празен или недостъпен");
            }
          }}
          className="rounded-lg border border-amber-400/25 px-2 py-2 text-[11px] text-amber-200/85"
        >
          Постави
        </button>
      </div>
      <input
        ref={presetIn}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          await applyPresetRaw(await readFileAsText(f));
        }}
      />

      <div className="space-y-2 border-t border-amber-400/20 pt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/75">
          Моя форма от снимка (пази се постоянно)
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Име на формата, напр. „Петно бордо“"
          aria-label="Име на формата"
          className="w-full rounded-lg border border-amber-400/25 bg-[rgba(0,0,0,.2)] px-2 py-1.5 text-[11px] text-amber-50 outline-none placeholder:text-amber-200/45"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileIn.current?.click()}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-2 text-[11px] font-semibold text-amber-100 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5" />
          )}
          Качи снимка на форма
        </button>
        <input
          ref={fileIn}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            try {
              await createCustomShapeFromFile(f, name);
              setRows(await loadCustomShapes());
              setName("");
              toast.success("Формата е записана — намери я в „Мои форми“ при избор на форма");
            } catch (err: any) {
              toast.error(err?.message ?? "Грешка при качване");
            } finally {
              setBusy(false);
            }
          }}
        />

        {rows.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {rows.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-amber-400/20 p-1.5 text-[9px] text-amber-200/80"
              >
                <span
                  aria-hidden="true"
                  className="mb-1 block h-8 w-full bg-amber-200"
                  style={shapeStyle({ shape: `custom-${r.id}` })}
                />
                <div className="flex items-center justify-between gap-1">
                  <span className="line-clamp-1">{r.name}</span>
                  <button
                    type="button"
                    aria-label={`Изтрий ${r.name}`}
                    onClick={async () => {
                      try {
                        await deleteCustomShape(r);
                        setRows((prev) => prev.filter((x) => x.id !== r.id));
                        toast.success("Формата е изтрита");
                      } catch (err: any) {
                        toast.error(err?.message ?? "Грешка при изтриване");
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-amber-300/80" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ShapeTransferSection;
