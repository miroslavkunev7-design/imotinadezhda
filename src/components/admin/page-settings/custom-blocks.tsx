import { useState } from "react";
import { Code2, Copy, Download, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { useCrmPageSettings } from "@/hooks/use-crm-page-settings";
import { WIDTH_CSS, type BlockChild, type CustomBlock } from "@/lib/crm-page-settings/types";
import { SHAPES_BY_ID } from "@/lib/crm-shapes";
import { FreeTransform } from "@/components/admin/page-settings/free-transform";
import { blockToReact, downloadTsx } from "@/lib/crm-page-settings/to-react";

/**
 * Рендер на блокчетата, които потребителят е добавил от „Настройки → Компоненти“.
 * Пазят се като данни (jsonb), не се генерира код.
 *
 * Поставените форми (`type: "shape"`) са свободни елементи: местят се,
 * оразмеряват се и се завъртат с ръка, и могат да съдържат компонент в компонента.
 */
export function CrmCustomBlocks() {
  const { settings, patch, editMode } = useCrmPageSettings();
  const blocks = settings.custom;
  const [code, setCode] = useState<{ name: string; text: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const update = (id: string, next: Partial<CustomBlock>) =>
    patch((s) => ({ ...s, custom: s.custom.map((b) => (b.id === id ? { ...b, ...next } : b)) }));
  const remove = (id: string) =>
    patch((s) => ({ ...s, custom: s.custom.filter((b) => b.id !== id) }));

  const flow = blocks.filter((b) => b.type !== "shape");
  const free = blocks.filter((b) => b.type === "shape");

  const makeReact = (b: CustomBlock) => {
    const name = SHAPES_BY_ID[b.shapeId ?? ""]?.name ?? "ShapeBlock";
    setCode({ name, text: blockToReact(b, name) });
  };

  return (
    <>
      {flow.length > 0 && (
        <div data-crm-custom className="mt-4 flex flex-wrap gap-3">
          {flow.map((b) => (
            <div
              key={b.id}
              className="relative min-w-[220px] grow"
              style={{ flexBasis: WIDTH_CSS[b.width ?? "full"], maxWidth: "100%" }}
            >
              {editMode && (
                <button
                  type="button"
                  data-crm-edit-ui
                  onClick={() => remove(b.id)}
                  className="absolute -right-2 -top-2 z-10 rounded-full bg-[#8B1A2B] p-1 text-amber-100 shadow"
                  aria-label="Изтрий блока"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <BlockBody block={b} editable={editMode} onChange={(n) => update(b.id, n)} />
            </div>
          ))}
        </div>
      )}

      {free.length > 0 && (
        <div data-crm-custom className="pointer-events-none absolute inset-0 z-20">
          {free.map((b) => (
            <FreeTransform
              key={b.id}
              active={editMode}
              value={{
                x: b.x ?? 20,
                y: b.y ?? 20,
                w: b.w ?? 40,
                h: b.h ?? 240,
                rotate: b.rotate ?? 0,
              }}
              onChange={(t) => update(b.id, t)}
              onSelect={() => setSelected(b.id)}
            >
              <ShapeBody block={b} editable={editMode} onChange={(n) => update(b.id, n)} />
              {editMode && selected === b.id && (
                <ShapeToolbar
                  block={b}
                  onChange={(n) => update(b.id, n)}
                  onRemove={() => {
                    setSelected(null);
                    remove(b.id);
                  }}
                  onReact={() => makeReact(b)}
                />
              )}
            </FreeTransform>
          ))}
        </div>
      )}

      {code && <CodeModal name={code.name} text={code.text} onClose={() => setCode(null)} />}
    </>
  );
}

function ShapeBody({
  block,
  editable,
  onChange,
}: {
  block: CustomBlock;
  editable: boolean;
  onChange: (next: Partial<CustomBlock>) => void;
}) {
  const shape = block.shapeId ? SHAPES_BY_ID[block.shapeId] : undefined;
  const keepImage = !!block.keepImage && !!shape?.imageUrl;

  const style: React.CSSProperties = {
    borderRadius: shape?.borderRadius,
    clipPath: shape?.clipPath,
    backgroundColor: keepImage ? undefined : (block.fill ?? "#8B1A2B"),
  };
  if (shape?.maskImage) {
    Object.assign(style, {
      WebkitMaskImage: `url(${shape.maskImage})`,
      maskImage: `url(${shape.maskImage})`,
      WebkitMaskSize: "100% 100%",
      maskSize: "100% 100%",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
    });
  }

  return (
    <div className="relative h-full w-full overflow-hidden" style={style}>
      {keepImage && (
        <img src={shape!.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-white">
        {(block.children ?? []).map((c) => (
          <ChildBody
            key={c.id}
            child={c}
            editable={editable}
            onChange={(text) =>
              onChange({
                children: (block.children ?? []).map((x) => (x.id === c.id ? { ...x, text } : x)),
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function ChildBody({
  child,
  editable,
  onChange,
}: {
  child: BlockChild;
  editable: boolean;
  onChange: (text: string) => void;
}) {
  const editProps = editable
    ? {
        contentEditable: true,
        suppressContentEditableWarning: true,
        onBlur: (e: React.FocusEvent<HTMLElement>) => onChange(e.currentTarget.textContent ?? ""),
      }
    : {};
  if (child.type === "image")
    return child.url ? (
      <img
        src={child.url}
        alt={child.text ?? ""}
        className="max-h-24 w-auto object-contain"
        loading="lazy"
      />
    ) : null;
  if (child.type === "heading")
    return (
      <h3 {...editProps} className="font-display text-xl font-bold" style={{ color: child.color }}>
        {child.text || "Заглавие"}
      </h3>
    );
  if (child.type === "button")
    return (
      <a
        href={child.href || "#"}
        onClick={(e) => editable && e.preventDefault()}
        className="inline-flex items-center justify-center rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-[#8B1A2B]"
      >
        <span {...editProps}>{child.text || "Бутон"}</span>
      </a>
    );
  return (
    <p {...editProps} className="text-sm leading-relaxed" style={{ color: child.color }}>
      {child.text || "Текст…"}
    </p>
  );
}

function ShapeToolbar({
  block,
  onChange,
  onRemove,
  onReact,
}: {
  block: CustomBlock;
  onChange: (next: Partial<CustomBlock>) => void;
  onRemove: () => void;
  onReact: () => void;
}) {
  const addChild = (type: BlockChild["type"]) =>
    onChange({
      children: [
        ...(block.children ?? []),
        {
          id: `c${Date.now().toString(36)}`,
          type,
          text: type === "button" ? "Бутон" : "Нов текст",
        },
      ],
    });

  return (
    <div
      data-crm-edit-ui
      className="absolute -bottom-11 left-0 z-30 flex flex-wrap items-center gap-1 rounded-xl border border-amber-400/50 bg-[#3a0210] px-2 py-1.5 text-[10.5px] text-amber-100 shadow-2xl"
      style={{ transform: `rotate(${-(block.rotate ?? 0)}deg)` }}
    >
      {(["heading", "text", "button"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => addChild(t)}
          className="flex items-center gap-1 rounded-md border border-amber-400/30 px-1.5 py-1 font-semibold"
        >
          <Plus className="h-3 w-3" />
          {t === "heading" ? "Заглавие" : t === "text" ? "Текст" : "Бутон"}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange({ keepImage: !block.keepImage })}
        className="rounded-md border border-amber-400/30 px-1.5 py-1 font-semibold"
      >
        {block.keepImage ? "Със снимка" : "Само форма"}
      </button>
      <button
        type="button"
        onClick={onReact}
        className="flex items-center gap-1 rounded-md border border-emerald-300/60 bg-emerald-400/20 px-1.5 py-1 font-bold text-emerald-50"
      >
        <Code2 className="h-3 w-3" /> Направи React
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md border border-red-300/50 px-1.5 py-1 font-semibold text-red-200"
      >
        Изтрий
      </button>
    </div>
  );
}

function CodeModal({ name, text, onClose }: { name: string; text: string; onClose: () => void }) {
  return (
    <div
      data-crm-edit-ui
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-amber-400/40 bg-[#2b0210] p-4 text-amber-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-2 flex items-center gap-2">
          <div className="text-sm font-bold uppercase tracking-wide text-amber-300">
            React компонент · {name}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(text).then(() => toast.success("Копирано"));
              }}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 px-2.5 py-1.5 text-[11px] font-semibold"
            >
              <Copy className="h-3.5 w-3.5" /> Копирай
            </button>
            <button
              type="button"
              onClick={() => downloadTsx(name.replace(/\s+/g, "-").toLowerCase(), text)}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 px-2.5 py-1.5 text-[11px] font-semibold"
            >
              <Download className="h-3.5 w-3.5" /> Свали .tsx
            </button>
            <button type="button" onClick={onClose} aria-label="Затвори">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <pre className="max-h-[60vh] overflow-auto rounded-xl bg-black/40 p-3 text-[11px] leading-relaxed text-amber-50">
          {text}
        </pre>
      </div>
    </div>
  );
}

function BlockBody({
  block,
  editable,
  onChange,
}: {
  block: CustomBlock;
  editable: boolean;
  onChange: (next: Partial<CustomBlock>) => void;
}) {
  const editProps = editable
    ? {
        contentEditable: true,
        suppressContentEditableWarning: true,
        onBlur: (e: React.FocusEvent<HTMLElement>) =>
          onChange({ text: e.currentTarget.textContent ?? "" }),
      }
    : {};

  switch (block.type) {
    case "heading":
      return (
        <h2
          {...editProps}
          className="font-display text-2xl font-bold"
          style={{ color: "var(--crm-readable-header)" }}
        >
          {block.text || "Ново заглавие"}
        </h2>
      );
    case "note":
      return (
        <div
          {...editProps}
          className="rounded-xl p-4 text-sm shadow-md"
          style={{ background: "#fdf3b8", color: "#3a2a08", transform: "rotate(-1deg)" }}
        >
          {block.text || "Бележка…"}
        </div>
      );
    case "image":
      return block.url ? (
        <img
          src={block.url}
          alt={block.text || "Снимка"}
          className="w-full rounded-xl object-cover shadow"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="crm-readable rounded-xl p-6 text-center text-sm">Няма избрана снимка</div>
      );
    case "button":
      return (
        <a
          href={block.href || "#"}
          className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: "var(--crm-accent)", color: "var(--crm-readable-header-text)" }}
          onClick={(e) => {
            if (editable) e.preventDefault();
          }}
        >
          <span {...editProps}>{block.text || "Бутон"}</span>
        </a>
      );
    case "card":
      return (
        <div className="crm-readable rounded-2xl p-5">
          <div {...editProps} className="text-sm">
            {block.text || "Празна карта — кликни и пиши…"}
          </div>
        </div>
      );
    case "text":
    default:
      return (
        <div {...editProps} className="crm-readable rounded-xl p-4 text-sm">
          {block.text || "Текстово блокче — кликни и пиши…"}
        </div>
      );
  }
}
