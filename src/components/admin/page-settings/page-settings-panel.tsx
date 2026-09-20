import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Brush,
  Crosshair,
  Eye,
  Image as ImageIcon,
  Loader2,
  Palette,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
  Type as TypeIcon,
  Undo2,
  Users,
  X,
  Plus,
  LayoutGrid,
} from "lucide-react";
import { useCrmPageSettings } from "@/hooks/use-crm-page-settings";
import { ShapeTransferSection } from "@/components/admin/page-settings/shape-transfer";
import {
  BRUSH_LABELS,
  FONT_CHOICES,
  type BrushIntensity,
  type CustomBlockType,
  type PageSettings,
} from "@/lib/crm-page-settings/types";
import { uploadPublicImage } from "@/lib/upload-public-image";
import crmDefaultBg from "@/assets/shumen-hero-mobile.jpeg.asset.json";
import cityBurgas from "@/assets/city-burgas.jpeg";
import cityVarna from "@/assets/city-varna.jpeg";
import cityShumen from "@/assets/city-shumen.jpeg";
import clouds from "@/assets/clouds-bg.jpg";
import { resolveAssetUrl } from "@/lib/asset-url";

const GALLERY: { label: string; url: string }[] = [
  { label: "Шумен (панорама)", url: resolveAssetUrl(crmDefaultBg) },
  { label: "Бургас", url: cityBurgas },
  { label: "Варна", url: cityVarna },
  { label: "Шумен", url: cityShumen },
  { label: "Облаци", url: clouds },
];

const COLOR_FIELDS: { key: keyof PageSettings["colors"]; label: string }[] = [
  { key: "panel", label: "Фон на прозореца / картите" },
  { key: "text", label: "Основен текст" },
  { key: "heading", label: "Заглавия" },
  { key: "border", label: "Граници" },
  { key: "accent", label: "Акцент (бутони, активни опции)" },
  { key: "accentText", label: "Текст върху акцент" },
  { key: "optionText", label: "Текст на опциите" },
];

const BLOCK_TYPES: { type: CustomBlockType; label: string }[] = [
  { type: "text", label: "Текст" },
  { type: "heading", label: "Заглавие" },
  { type: "note", label: "Бележка" },
  { type: "image", label: "Снимка" },
  { type: "button", label: "Бутон" },
  { type: "card", label: "Празна карта" },
];

type Tab = "look" | "bg" | "blocks";

export function CrmPageSettingsPanel({ onClose }: { onClose: () => void }) {
  const {
    pageKey,
    settings,
    patch,
    save,
    saveGlobal,
    reset,
    resetBlocksOnly,
    discard,
    undo,
    redo,
    canUndo,
    canRedo,
    dirty,
    editMode,
    setEditMode,
    setPreviewMode,
  } = useCrmPageSettings();
  const [tab, setTab] = useState<Tab>("look");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const bgInput = useRef<HTMLInputElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const uploadBg = async (file: File) => {
    setBusy(true);
    try {
      const url = await uploadPublicImage(file, "crm-backgrounds");
      patch((s) => ({ ...s, bg: { ...s.bg, url } }));
      toast.success("Фонът е качен");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при качване");
    } finally {
      setBusy(false);
    }
  };

  const addBlock = (type: CustomBlockType, url?: string) =>
    patch((s) => ({
      ...s,
      custom: [
        ...s.custom,
        {
          id: `c${Date.now().toString(36)}`,
          type,
          width: type === "note" || type === "button" ? "third" : "full",
          url,
        },
      ],
    }));

  return (
    <div
      className="crm-settings-panel fixed inset-y-0 right-0 z-[9997] flex w-full max-w-[380px] flex-col shadow-2xl"
      data-crm-edit-ui
    >
      <header className="flex items-center justify-between border-b border-amber-400/25 px-4 py-3">
        <div className="min-w-0">
          <div className="font-display text-lg text-amber-100">Настройки на страницата</div>
          <div className="truncate text-[11px] text-amber-200/60">{pageKey}</div>
        </div>
        <div className="flex flex-none items-center gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Върни (Ctrl+Z)"
            aria-label="Върни"
            className="rounded-md p-1.5 hover:bg-amber-400/15 disabled:opacity-35"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Повтори (Ctrl+Shift+Z)"
            aria-label="Повтори"
            className="rounded-md p-1.5 hover:bg-amber-400/15 disabled:opacity-35"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditMode(false);
              setPreviewMode(true);
              onClose();
            }}
            title="Преглед както го виждат потребителите"
            className="flex items-center gap-1 rounded-md border border-amber-400/30 px-2 py-1.5 text-[11px] hover:bg-amber-400/15"
          >
            <Eye className="h-3.5 w-3.5" /> Преглед
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Затвори"
            className="rounded-md p-1.5 hover:bg-amber-400/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <nav className="grid grid-cols-3 gap-1 border-b border-amber-400/20 p-2 text-[11.5px] font-semibold">
        {(
          [
            { id: "look", label: "Изглед", icon: Palette },
            { id: "bg", label: "Фон", icon: ImageIcon },
            { id: "blocks", label: "Компоненти", icon: LayoutGrid },
          ] as { id: Tab; label: string; icon: any }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 transition ${
              tab === t.id
                ? "bg-amber-400/20 text-amber-50"
                : "text-amber-200/70 hover:bg-amber-400/10"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {tab === "look" && (
          <>
            <section className="space-y-3">
              {COLOR_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-amber-200/75">
                    {f.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.colors[f.key]}
                      onChange={(e) =>
                        patch((s) => ({ ...s, colors: { ...s.colors, [f.key]: e.target.value } }))
                      }
                      className="h-9 w-12 cursor-pointer rounded border border-amber-400/30 bg-transparent"
                    />
                    <input
                      type="text"
                      value={settings.colors[f.key]}
                      onChange={(e) =>
                        patch((s) => ({ ...s, colors: { ...s.colors, [f.key]: e.target.value } }))
                      }
                      className="w-full rounded-lg border border-amber-400/30 bg-[rgba(20,4,8,.6)] px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </label>
              ))}
            </section>

            <section className="space-y-3 border-t border-amber-400/20 pt-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-200/75">
                <Brush className="h-3.5 w-3.5" /> Четка
              </div>
              <label className="block">
                <span className="mb-1 block text-[11px] text-amber-200/70">
                  Интензитет на четката —{" "}
                  {BRUSH_LABELS[(settings.brush?.intensity ?? 2) as BrushIntensity]}
                </span>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={settings.brush?.intensity ?? 2}
                  onChange={(e) =>
                    patch((s) => ({
                      ...s,
                      brush: { intensity: Number(e.target.value) as BrushIntensity },
                    }))
                  }
                  className="w-full accent-amber-400"
                />
                <div className="mt-1 flex justify-between text-[10px] text-amber-200/55">
                  <span>Без</span>
                  <span>Леко</span>
                  <span>Средно</span>
                  <span>Силно</span>
                </div>
              </label>
            </section>

            <section className="space-y-3 border-t border-amber-400/20 pt-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-200/75">
                <TypeIcon className="h-3.5 w-3.5" /> Шрифтове
              </div>
              <label className="block">
                <span className="mb-1 block text-[11px] text-amber-200/70">Шрифт за заглавия</span>
                <select
                  value={settings.fonts.heading}
                  onChange={(e) =>
                    patch((s) => ({ ...s, fonts: { ...s.fonts, heading: e.target.value } }))
                  }
                  className="w-full rounded-lg border border-amber-400/30 bg-[rgba(20,4,8,.6)] px-2.5 py-2 text-xs"
                >
                  {FONT_CHOICES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-amber-200/70">Шрифт за текст</span>
                <select
                  value={settings.fonts.body}
                  onChange={(e) =>
                    patch((s) => ({ ...s, fonts: { ...s.fonts, body: e.target.value } }))
                  }
                  className="w-full rounded-lg border border-amber-400/30 bg-[rgba(20,4,8,.6)] px-2.5 py-2 text-xs"
                >
                  {FONT_CHOICES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <Range
                label={`Размер на буквите — ${settings.fonts.sizeBase}px`}
                min={13}
                max={22}
                value={settings.fonts.sizeBase}
                onChange={(v) => patch((s) => ({ ...s, fonts: { ...s.fonts, sizeBase: v } }))}
              />
              <Range
                label={`Закръгление — ${settings.fonts.radius}px`}
                min={0}
                max={32}
                value={settings.fonts.radius}
                onChange={(v) => patch((s) => ({ ...s, fonts: { ...s.fonts, radius: v } }))}
              />
            </section>
          </>
        )}

        {tab === "bg" && (
          <section className="space-y-4">
            <button
              type="button"
              onClick={() => bgInput.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5 text-xs font-semibold"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              Качи снимка от телефон / компютър
            </button>
            <input
              ref={bgInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadBg(f);
                e.target.value = "";
              }}
            />

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-200/75">
                Галерия
              </div>
              <div className="grid grid-cols-3 gap-2">
                {GALLERY.map((g) => (
                  <button
                    key={g.url}
                    type="button"
                    onClick={() => patch((s) => ({ ...s, bg: { ...s.bg, url: g.url } }))}
                    className={`h-20 overflow-hidden rounded-lg border-2 ${
                      settings.bg.url === g.url ? "border-amber-300" : "border-amber-400/20"
                    }`}
                    title={g.label}
                  >
                    <img
                      src={g.url}
                      alt={g.label}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 border-t border-amber-400/20 pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/75">
                Видима част (без ефекти)
              </div>

              <div>
                <div className="mb-1 text-[11px] text-amber-200/70">Начин на напасване</div>
                <div className="flex gap-1.5">
                  {(
                    [
                      { id: "cover", label: "Запълва" },
                      { id: "contain", label: "Цялата" },
                      { id: "repeat", label: "Повторение" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        patch((s) => ({
                          ...s,
                          bg: { ...s.bg, fit: f.id, repeat: f.id === "repeat" },
                        }))
                      }
                      className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] ${
                        (settings.bg.repeat ? "repeat" : settings.bg.fit) === f.id
                          ? "border-amber-300 bg-amber-400/20 text-amber-50"
                          : "border-amber-400/25 text-amber-200/75"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <Range
                label={`Увеличение (zoom) — ${settings.bg.zoom}%`}
                min={100}
                max={300}
                value={settings.bg.zoom}
                onChange={(v) => patch((s) => ({ ...s, bg: { ...s.bg, zoom: v } }))}
              />
              <Range
                label={`Хоризонтално — ${settings.bg.posX}%`}
                min={0}
                max={100}
                value={settings.bg.posX}
                onChange={(v) => patch((s) => ({ ...s, bg: { ...s.bg, posX: v } }))}
              />
              <Range
                label={`Вертикално — ${settings.bg.posY}%`}
                min={0}
                max={100}
                value={settings.bg.posY}
                onChange={(v) => patch((s) => ({ ...s, bg: { ...s.bg, posY: v } }))}
              />

              {/* Малък визуален преглед на видимата част */}
              <div
                className="h-28 w-full overflow-hidden rounded-lg border border-amber-400/25 bg-[rgba(20,4,8,.5)]"
                style={
                  settings.bg.url
                    ? {
                        backgroundImage: `url(${settings.bg.url})`,
                        backgroundSize:
                          (settings.bg.repeat ? "repeat" : settings.bg.fit) === "repeat"
                            ? "auto"
                            : settings.bg.fit === "contain"
                              ? `${settings.bg.zoom}% auto`
                              : `${settings.bg.zoom}% ${settings.bg.zoom}%`,

                        backgroundRepeat:
                          (settings.bg.repeat ? "repeat" : settings.bg.fit) === "repeat"
                            ? "repeat"
                            : "no-repeat",
                        backgroundPosition: `${settings.bg.posX}% ${settings.bg.posY}%`,
                      }
                    : undefined
                }
              />

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    patch((s) => ({
                      ...s,
                      bg: { ...s.bg, zoom: 100, posX: 50, posY: 50, position: "center" },
                    }))
                  }
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-amber-400/30 px-2 py-1.5 text-[11px] text-amber-200/85"
                >
                  <Crosshair className="h-3.5 w-3.5" /> Центрирай
                </button>
                {(["top", "center", "bottom"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      patch((s) => ({
                        ...s,
                        bg: {
                          ...s.bg,
                          position: p,
                          posY: p === "top" ? 0 : p === "center" ? 50 : 100,
                        },
                      }))
                    }
                    className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] ${
                      settings.bg.posY === (p === "top" ? 0 : p === "center" ? 50 : 100)
                        ? "border-amber-300 bg-amber-400/20 text-amber-50"
                        : "border-amber-400/25 text-amber-200/75"
                    }`}
                  >
                    {p === "top" ? "Горе" : p === "center" ? "Център" : "Долу"}
                  </button>
                ))}
              </div>
            </div>

            <Range
              label={`Замъгляване — ${settings.bg.blur}px`}
              min={0}
              max={20}
              value={settings.bg.blur}
              onChange={(v) => patch((s) => ({ ...s, bg: { ...s.bg, blur: v } }))}
            />
            <Range
              label={`Затъмняване — ${settings.bg.dim}%`}
              min={0}
              max={80}
              value={settings.bg.dim}
              onChange={(v) => patch((s) => ({ ...s, bg: { ...s.bg, dim: v } }))}
            />

            <label className="flex items-center gap-2 text-[11.5px] text-amber-200/80">
              <input
                type="checkbox"
                checked={settings.bg.repeat}
                onChange={(e) =>
                  patch((s) => ({ ...s, bg: { ...s.bg, repeat: e.target.checked } }))
                }
                className="accent-amber-400"
              />
              Повторение вместо „cover“
            </label>
            <button
              type="button"
              onClick={() => patch((s) => ({ ...s, bg: { ...s.bg, url: null, blur: 0, dim: 0 } }))}
              className="w-full rounded-lg border border-amber-400/30 px-3 py-2 text-xs text-amber-200/80"
            >
              Без специален фон (по подразбиране)
            </button>
          </section>
        )}

        {tab === "blocks" && (
          <section className="space-y-4">
            <button
              type="button"
              onClick={() => setEditMode(!editMode)}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold ${
                editMode
                  ? "bg-amber-400 text-[#2b0210]"
                  : "border border-amber-400/40 bg-amber-400/10 text-amber-100"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              {editMode ? "Изключи режим редакция" : "Включи режим редакция"}
            </button>
            <p className="text-[11px] leading-relaxed text-amber-200/65">
              В режим редакция кликаш върху панел или карта на страницата и от менюто го местиш
              нагоре/надолу, намаляваш/увеличаваш, сменяш ширината или го скриваш.
            </p>

            <div className="border-t border-amber-400/20 pt-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-200/75">
                Добави блок
              </div>
              <div className="grid grid-cols-3 gap-2">
                {BLOCK_TYPES.map((b) => (
                  <button
                    key={b.type}
                    type="button"
                    onClick={() =>
                      b.type === "image" ? imgInput.current?.click() : addBlock(b.type)
                    }
                    className="flex flex-col items-center gap-1 rounded-lg border border-amber-400/25 px-2 py-2.5 text-[11px] text-amber-100 hover:bg-amber-400/10"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {b.label}
                  </button>
                ))}
              </div>
              <input
                ref={imgInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setBusy(true);
                  try {
                    const url = await uploadPublicImage(f, "crm-blocks");
                    addBlock("image", url);
                    toast.success("Снимката е добавена");
                  } catch (err: any) {
                    toast.error(err?.message ?? "Грешка при качване");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </div>

            {settings.custom.length > 0 && (
              <div className="text-[11px] text-amber-200/65">
                Добавени блокчета: {settings.custom.length}. Кликни върху текста им на страницата,
                за да пишеш.
              </div>
            )}

            <ShapeTransferSection />
          </section>
        )}
      </div>

      <footer className="space-y-2 border-t border-amber-400/25 p-3">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => run(save, "Настройките са запазени")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-300 px-3 py-2 text-xs font-bold text-[#2b0210] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Запази
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={discard}
            className="rounded-lg border border-amber-400/30 px-3 py-2 text-xs text-amber-200/80 disabled:opacity-40"
          >
            Отмени
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(saveGlobal, "Приложено за всички")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-400/30 px-3 py-2 text-[11px] text-amber-200/85"
          >
            <Users className="h-3.5 w-3.5" /> Приложи за всички
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmReset(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-400/30 px-3 py-2 text-[11px] text-amber-200/85"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Възстанови по подразбиране
          </button>
        </div>

        {confirmReset && (
          <div className="space-y-2 rounded-lg border border-amber-400/35 bg-[rgba(70,4,20,.85)] p-3">
            <div className="text-[11.5px] text-amber-100">
              Какво да върна по подразбиране за <b>{pageKey}</b>?
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirmReset(false);
                  void run(reset, "Всичко е върнато по подразбиране");
                }}
                className="flex-1 rounded-md bg-amber-400 px-2 py-1.5 text-[11px] font-bold text-[#2b0210]"
              >
                Всичко
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirmReset(false);
                  void run(async () => resetBlocksOnly(), "Позициите на блоковете са върнати");
                }}
                className="flex-1 rounded-md border border-amber-400/40 px-2 py-1.5 text-[11px] text-amber-100"
              >
                Само блокове/позиции
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-md border border-amber-400/25 px-2 py-1.5 text-[11px] text-amber-200/75"
              >
                Отказ
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}

function Range({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-amber-200/70">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-400"
      />
    </label>
  );
}
