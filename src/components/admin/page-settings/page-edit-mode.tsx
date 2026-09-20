import { useCallback, useEffect, useRef, useState } from "react";
import { useCrmPageSettings } from "@/hooks/use-crm-page-settings";
import { WIDTH_CSS, type BlockOverride, type BlockWidth } from "@/lib/crm-page-settings/types";
import { shapeStyle } from "@/lib/crm-shapes";
import { ShapePicker } from "@/components/admin/page-settings/shape-picker";
import {
  ArrowDown,
  ArrowUp,
  Clipboard,
  ClipboardCheck,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Redo2,
  Shapes,
  Undo2,
  X,
} from "lucide-react";

const EDIT_STYLE_ID = "crm-page-edit-style";

function findContainer(root: HTMLElement): HTMLElement {
  let el = root;
  let depth = 0;
  while (depth < 3 && el.children.length === 1 && el.children[0] instanceof HTMLElement) {
    el = el.children[0];
    depth += 1;
  }
  return el;
}

function blockElements(): HTMLElement[] {
  const root = document.querySelector<HTMLElement>("[data-crm-page-root]");
  if (!root) return [];
  const container = findContainer(root);
  return Array.from(container.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && !c.hasAttribute("data-crm-custom"),
  );
}

/**
 * Слой за редакция на подредбата: маркиране с клик, местене нагоре/надолу,
 * промяна на ширина/размер и скриване на блокове — без писане на код.
 */
export function CrmPageEditLayer() {
  const { settings, patch, editMode, setEditMode, previewMode, undo, redo, canUndo, canRedo } =
    useCrmPageSettings();
  const active = editMode && !previewMode;
  const [selected, setSelected] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [shapeOpen, setShapeOpen] = useState(false);
  // Преглед преди запазване: пробна форма, която се показва живо, но още не е записана
  const [previewOn, setPreviewOn] = useState(true);
  const [trial, setTrial] = useState<{ key: string; override: Partial<BlockOverride> } | null>(
    null,
  );
  const [copiedShape, setCopiedShape] = useState<Partial<BlockOverride> | null>(null);
  const applyTick = useRef(0);

  // 1) Етикетиране на блоковете + прилагане на записаните настройки
  const applyOverrides = useCallback(() => {
    const els = blockElements();
    els.forEach((el, i) => {
      if (!el.dataset.crmBlock) el.dataset.crmBlock = `b${i}`;
    });
    // подредба (реално разместване в DOM, за да работи навсякъде)
    const withOrder = els
      .map((el, i) => ({
        el,
        key: el.dataset.crmBlock!,
        order: settings.blocks[el.dataset.crmBlock!]?.order ?? i,
      }))
      .sort((a, b) => a.order - b.order);
    const parent = els[0]?.parentElement;
    if (parent) withOrder.forEach(({ el }) => parent.appendChild(el));

    els.forEach((el) => {
      const key = el.dataset.crmBlock!;
      const saved = settings.blocks[key];
      const isTrial = !!trial && (trial.key === "*" || trial.key === key);
      const o = isTrial ? { ...(saved ?? {}), ...trial!.override } : saved;
      el.classList.toggle("crm-block-preview", isTrial);
      el.style.removeProperty("display");
      el.style.removeProperty("width");
      el.style.removeProperty("height");
      el.style.removeProperty("zoom");
      el.style.removeProperty("border-radius");
      el.style.removeProperty("clip-path");
      el.style.removeProperty("-webkit-mask-image");
      el.style.removeProperty("mask-image");
      el.style.removeProperty("aspect-ratio");
      if (!o) return;
      if (o.hidden) el.style.display = "none";
      if (o.width) {
        el.style.width = WIDTH_CSS[o.width];
        el.style.maxWidth = "100%";
      }
      if (o.height) el.style.height = `${o.height}px`;
      if (o.scale && o.scale !== 1) el.style.zoom = String(o.scale);
      // форма от каталога (>200 форми)
      const shape = shapeStyle(o) as Record<string, string | undefined>;
      Object.entries(shape).forEach(([prop, value]) => {
        if (!value) return;
        const cssProp = prop.startsWith("Webkit")
          ? `-webkit-${prop.slice(6).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`
          : prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        el.style.setProperty(cssProp, value);
      });
    });
  }, [settings.blocks, trial]);

  useEffect(() => {
    applyOverrides();
    const t = setTimeout(applyOverrides, 350); // след като страницата дозареди данните
    applyTick.current += 1;
    return () => clearTimeout(t);
  }, [applyOverrides]);

  // 2) Стилове за режима на редакция
  useEffect(() => {
    if (!active) {
      document.getElementById(EDIT_STYLE_ID)?.remove();
      document
        .querySelectorAll("[data-crm-block]")
        .forEach((el) => el.classList.remove("crm-block-selected"));
      setSelected(null);
      setMenuPos(null);
      return;
    }
    const style = document.createElement("style");
    style.id = EDIT_STYLE_ID;
    style.textContent = `
      [data-crm-block] { outline: 2px dashed rgba(201,168,76,.55); outline-offset: -2px; cursor: pointer; }
      [data-crm-block]:hover { outline-color: rgba(201,168,76,.9); }
      [data-crm-block].crm-block-selected { outline: 3px solid #C9A84C !important; box-shadow: 0 0 0 4px rgba(201,168,76,.2); }
      [data-crm-block].crm-block-preview { outline: 3px dashed #2f9e63 !important; }
      [data-crm-block].crm-block-preview::after {
        content: "ПРЕГЛЕД";
        position: absolute; top: 4px; right: 6px; z-index: 40;
        font-size: 9px; font-weight: 800; letter-spacing: .06em;
        padding: 2px 6px; border-radius: 999px;
        background: #2f9e63; color: #fff; pointer-events: none;
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, [active]);

  // 3) Избор с клик
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest("[data-crm-edit-ui]")) return;
      const root = document.querySelector<HTMLElement>("[data-crm-page-root]");
      if (!root || !root.contains(target)) return;
      const block = target.closest<HTMLElement>("[data-crm-block]");
      if (!block) return;
      e.preventDefault();
      e.stopPropagation();
      document
        .querySelectorAll("[data-crm-block]")
        .forEach((el) => el.classList.remove("crm-block-selected"));
      block.classList.add("crm-block-selected");
      setSelected(block.dataset.crmBlock ?? null);
      const r = block.getBoundingClientRect();
      setMenuPos({
        top: Math.max(8, r.top + 8),
        left: Math.min(window.innerWidth - 240, r.left + 8),
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active]);

  // 4) Клавиши Ctrl/Cmd+Z и Ctrl/Cmd+Shift+Z в режим редакция
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, redo, undo]);

  if (!active) return null;

  const setOverride = (key: string, next: Partial<BlockOverride>) =>
    patch((s) => ({ ...s, blocks: { ...s.blocks, [key]: { ...(s.blocks[key] ?? {}), ...next } } }));

  const applyToAll = (next: Partial<BlockOverride>) =>
    patch((s) => {
      const keys = new Set([
        ...Object.keys(s.blocks),
        ...blockElements().map((el, i) => el.dataset.crmBlock ?? `b${i}`),
      ]);
      const blocks = { ...s.blocks };
      keys.forEach((k) => {
        blocks[k] = { ...(blocks[k] ?? {}), ...next };
      });
      return { ...s, blocks };
    });

  const move = (key: string, dir: -1 | 1) => {
    const els = blockElements();
    const keys = els.map((el, i) => el.dataset.crmBlock ?? `b${i}`);
    const ordered = [...keys].sort(
      (a, b) =>
        (settings.blocks[a]?.order ?? keys.indexOf(a)) -
        (settings.blocks[b]?.order ?? keys.indexOf(b)),
    );
    const idx = ordered.indexOf(key);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= ordered.length) return;
    const swapped = [...ordered];
    [swapped[idx], swapped[target]] = [swapped[target], swapped[idx]];
    patch((s) => {
      const blocks = { ...s.blocks };
      swapped.forEach((k, i) => {
        blocks[k] = { ...(blocks[k] ?? {}), order: i };
      });
      return { ...s, blocks };
    });
  };

  /** Поставя избраната форма като свободен елемент на текущата страница. */
  const placeShape = (shapeId: string, opts: { keepImage: boolean }) => {
    patch((s) => ({
      ...s,
      custom: [
        ...s.custom,
        {
          id: `s${Date.now().toString(36)}`,
          type: "shape" as const,
          shapeId,
          keepImage: opts.keepImage,
          fill: "#8B1A2B",
          x: 15,
          y: 12,
          w: 45,
          h: 260,
          rotate: 0,
          z: 20,
          children: [],
        },
      ],
    }));
  };

  const current = selected ? settings.blocks[selected] : undefined;

  return (
    <>
      {/* Лента с указание */}
      <div
        data-crm-edit-ui
        className="fixed left-1/2 top-3 z-[9998] flex max-w-[95vw] -translate-x-1/2 items-center gap-2 rounded-full border border-amber-400/50 bg-[#4f0314] px-4 py-2 text-xs font-semibold text-amber-200 shadow-lg"
      >
        <span className="hidden sm:inline">
          Режим редакция — кликни върху блок, за да го местиш или намалиш
        </span>
        <span className="sm:hidden">Режим редакция</span>
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          title="Върни (Ctrl+Z)"
          aria-label="Върни"
          className="rounded-full bg-amber-400/20 p-1 text-amber-100 disabled:opacity-35"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo}
          title="Повтори (Ctrl+Shift+Z)"
          aria-label="Повтори"
          className="rounded-full bg-amber-400/20 p-1 text-amber-100 disabled:opacity-35"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setShapeOpen((v) => !v)}
          className="rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-100"
        >
          Форми
        </button>
        <button
          type="button"
          onClick={() => setEditMode(false)}
          className="rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-100"
        >
          Изход
        </button>
      </div>

      {selected && menuPos && (
        <div
          data-crm-edit-ui
          className="fixed z-[9999] w-[228px] rounded-xl border border-amber-400/50 bg-[#3a0210] p-2 text-amber-100 shadow-2xl"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wide text-amber-300">
            Блок {selected}
            <button type="button" onClick={() => setSelected(null)} aria-label="Затвори">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <MiniBtn onClick={() => move(selected, -1)} icon={ArrowUp} label="Нагоре" />
            <MiniBtn onClick={() => move(selected, 1)} icon={ArrowDown} label="Надолу" />
            <MiniBtn
              onClick={() =>
                setOverride(selected, { scale: Math.max(0.6, (current?.scale ?? 1) - 0.1) })
              }
              icon={Minimize2}
              label="Намали"
            />
            <MiniBtn
              onClick={() =>
                setOverride(selected, { scale: Math.min(1.6, (current?.scale ?? 1) + 0.1) })
              }
              icon={Maximize2}
              label="Увеличи"
            />
            <MiniBtn
              onClick={() => setOverride(selected, { hidden: !current?.hidden })}
              icon={current?.hidden ? Eye : EyeOff}
              label={current?.hidden ? "Покажи" : "Скрий"}
            />
            <MiniBtn onClick={() => setShapeOpen((v) => !v)} icon={Shapes} label="Форма" />
            <MiniBtn
              onClick={() =>
                setCopiedShape({
                  shape: current?.shape,
                  radius: current?.radius,
                  ratio: current?.ratio,
                })
              }
              icon={Clipboard}
              label="Копирай форма"
            />
            <MiniBtn
              onClick={() => copiedShape && setOverride(selected, copiedShape)}
              icon={ClipboardCheck}
              label="Постави форма"
            />
            <MiniBtn
              onClick={() =>
                setOverride(selected, {
                  width: undefined,
                  height: null,
                  scale: 1,
                  hidden: false,
                  shape: undefined,
                  radius: undefined,
                  ratio: undefined,
                })
              }
              icon={X}
              label="Изчисти"
            />
          </div>

          <div className="mt-2 px-1">
            <div className="mb-1 text-[10.5px] uppercase tracking-wide text-amber-300/80">
              Ширина
            </div>
            <div className="flex gap-1.5">
              {(["third", "half", "full"] as BlockWidth[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setOverride(selected, { width: w })}
                  className={`flex-1 rounded-md border px-1.5 py-1 text-[11px] ${
                    current?.width === w
                      ? "border-amber-300 bg-amber-400/25 text-amber-50"
                      : "border-amber-400/30 text-amber-200/80"
                  }`}
                >
                  {w === "third" ? "1/3" : w === "half" ? "1/2" : "Цяла"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 px-1 pb-1">
            <div className="mb-1 text-[10.5px] uppercase tracking-wide text-amber-300/80">
              Височина {current?.height ? `${current.height}px` : "авто"}
            </div>
            <input
              type="range"
              min={120}
              max={900}
              step={10}
              value={current?.height ?? 320}
              onChange={(e) => setOverride(selected, { height: Number(e.target.value) })}
              className="w-full accent-amber-400"
            />
            <button
              type="button"
              onClick={() => setOverride(selected, { height: null })}
              className="mt-1 w-full rounded-md border border-amber-400/30 px-2 py-1 text-[11px] text-amber-200/80"
            >
              Авто височина
            </button>
          </div>
        </div>
      )}

      {shapeOpen && (
        <ShapePicker
          current={trial ? { ...(current ?? {}), ...trial.override } : current}
          previewOn={previewOn}
          hasTrial={!!trial}
          onTogglePreview={() => {
            setPreviewOn((v) => {
              if (v) setTrial(null);
              return !v;
            });
          }}
          onPlace={placeShape}
          onPick={(next, scope) => {
            if (!selected && scope !== "all") return;
            if (previewOn) {
              setTrial((t) => ({
                key: scope === "all" ? "*" : selected!,
                override: { ...(t?.override ?? {}), ...next },
              }));
              return;
            }
            if (scope === "all") applyToAll(next);
            else setOverride(selected!, next);
          }}
          onApplyTrial={() => {
            if (!trial) return;
            if (trial.key === "*") applyToAll(trial.override);
            else setOverride(trial.key, trial.override);
            setTrial(null);
          }}
          onCancelTrial={() => setTrial(null)}
          onClose={() => {
            setTrial(null);
            setShapeOpen(false);
          }}
        />
      )}
    </>
  );
}

function MiniBtn({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-amber-400/30 px-2 py-1.5 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-400/15"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
