import { useEffect, useMemo, useState } from "react";
import type { CmsComponent } from "../api";
import type { PartDef } from "../componentCatalog";
import { saveComponent } from "../api";

type Props = {
  pageSlug: string;
  component: CmsComponent | null;
  onLiveChange: (draft: { component_key: string; type: string; props: Record<string, unknown> }) => void;
  onClose: () => void;
  toast: (msg: string) => void;
};

const EFFECTS = [
  { id: "drop-shadow", label: "Drop shadow" },
  { id: "soft-glow", label: "Soft glow" },
  { id: "night-glow", label: "Night glow" },
  { id: "blur-glass", label: "Blur glass" },
  { id: "photo-bleed", label: "Photo bleed" },
  { id: "none", label: "None" }
];

const FONTS = [
  "Georgia, 'PT Serif', serif",
  "'Bitter', Georgia, serif",
  "'Roboto Condensed', system-ui, sans-serif",
  "'Segoe UI', system-ui, sans-serif",
  "ui-serif, Georgia, serif"
];

function getPath(obj: Record<string, unknown>, path: string): unknown {
  const bits = path.split(".");
  let cur: unknown = obj;
  for (const b of bits) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[b];
  }
  return cur;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const bits = path.split(".");
  const next = { ...obj };
  let cursor: Record<string, unknown> = next;
  for (let i = 0; i < bits.length - 1; i++) {
    const k = bits[i];
    const child = cursor[k];
    cursor[k] = child && typeof child === "object" ? { ...(child as Record<string, unknown>) } : {};
    cursor = cursor[k] as Record<string, unknown>;
  }
  cursor[bits[bits.length - 1]] = value;
  return next;
}

function defaultParts(component: CmsComponent): PartDef[] {
  const stored = component.props?._parts;
  if (Array.isArray(stored) && stored.length) return stored as PartDef[];
  const sel = typeof component.props?.selector === "string" ? String(component.props.selector) : "";
  return [
    { id: "font.family", label: "Шрифт (family)", kind: "font", propPath: "font.family", defaults: { family: "Georgia, serif", selector: sel } },
    { id: "font.size", label: "Размер", kind: "size", propPath: "font.size", defaults: { size: "24px", selector: sel } },
    { id: "font.weight", label: "Тегло", kind: "font", propPath: "font.weight", defaults: { weight: "700", selector: sel } },
    { id: "font.color", label: "Цвят на текста", kind: "color", propPath: "font.color", defaults: { color: "#fff3e2", selector: sel } },
    { id: "panel.color", label: "Цвят на head панела", kind: "color", propPath: "panel.color", defaults: { color: "#710019", selector: sel } },
    { id: "panel.effect", label: "Ефект на head панела", kind: "effect", propPath: "panel.effect", defaults: { effect: "drop-shadow", selector: sel } },
    { id: "panel.height", label: "Височина на панела", kind: "size", propPath: "panel.height", defaults: { height: "198px", selector: sel } }
  ];
}

export function DisassembleEditor({ pageSlug, component, onLiveChange, onClose, toast }: Props) {
  const [activePart, setActivePart] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [props, setProps] = useState<Record<string, unknown>>(component?.props || {});

  useEffect(() => {
    setProps(component?.props || {});
    setActivePart(null);
  }, [component?.component_key, component?.id]);

  const parts = useMemo(() => (component ? defaultParts(component) : []), [component]);

  if (!component) {
    return (
      <div className="card explode-card">
        <h3>Разглобен изглед</h3>
        <p className="muted">Двойно кликнете компонент в дървото или в превюто, за да го разглобите.</p>
        <button type="button" className="ghost" onClick={onClose}>Затвори</button>
      </div>
    );
  }

  const title = typeof props._label === "string" ? String(props._label) : component.component_key;
  const active = parts.find((p) => p.id === activePart) || parts[0];

  function emit(nextProps: Record<string, unknown>) {
    setProps(nextProps);
    onLiveChange({
      component_key: component!.component_key,
      type: component!.type,
      props: nextProps
    });
  }

  function patchPartValue(part: PartDef, leafKey: string, value: unknown) {
    const parentPath = part.propPath.includes(".")
      ? part.propPath.split(".").slice(0, -1).join(".")
      : part.propPath;
    const leaf = part.propPath.includes(".")
      ? part.propPath.split(".").slice(-1)[0]
      : leafKey;
    let next = { ...props };
    if (parentPath) {
      const existing = (getPath(next, parentPath) as Record<string, unknown>) || { ...(part.defaults || {}) };
      next = setPath(next, parentPath, { ...existing, [leaf]: value });
    } else {
      next = { ...next, [leafKey]: value };
    }
    // Keep flat aliases for previewBridge consumers
    if (part.kind === "color" && leaf === "color" && !next.value) {
      /* panel/font colors stay nested */
    }
    emit(next);
  }

  function readLeaf(part: PartDef): string {
    const v = getPath(props, part.propPath);
    if (v == null && part.defaults) {
      const last = part.propPath.split(".").pop()!;
      const d = part.defaults[last];
      return d != null ? String(d) : "";
    }
    return v != null ? String(v) : "";
  }

  async function save() {
    if (!component) return;
    const target = component;
    setBusy(true);
    try {
      const clean = { ...props };
      await saveComponent({
        page_slug: pageSlug,
        component_key: target.component_key,
        type: target.type,
        sort_order: target.sort_order ?? 0,
        rect: target.rect || {},
        props: clean
      });
      await window.imotiSettings?.previewReload?.();
      toast("Разглобените части са записани в CMS");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card explode-card">
      <div className="editor-head">
        <h3>Разглобен · {title}</h3>
        <span className="live-pill">FOCUS</span>
        <span className="spacer" />
        <button type="button" className="ghost" onClick={onClose}>Сглоби обратно</button>
      </div>
      <p className="muted">
        Компонентът е на фокус в превюто. Изберете част вляво — промените се прилагат наживо.
      </p>

      <div className="explode-grid">
        <aside className="explode-parts">
          <h4>Части</h4>
          {parts.map((p) => (
            <button
              key={p.id}
              type="button"
              className={"part-btn" + ((activePart || parts[0]?.id) === p.id ? " active" : "")}
              onClick={() => setActivePart(p.id)}
            >
              {p.label}
              <small>{p.kind}</small>
            </button>
          ))}
        </aside>

        <div className="explode-detail">
          {active && (
            <>
              <h4>{active.label}</h4>
              {(active.kind === "font" || active.propPath.endsWith("family")) && active.propPath.includes("family") && (
                <label className="field">
                  <span>Family</span>
                  <select value={readLeaf(active) || FONTS[0]} onChange={(e) => patchPartValue(active, "family", e.target.value)}>
                    {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
              )}
              {active.propPath.endsWith("size") && (
                <label className="field">
                  <span>Size</span>
                  <input value={readLeaf(active)} onChange={(e) => patchPartValue(active, "size", e.target.value)} placeholder="28px" />
                </label>
              )}
              {active.propPath.endsWith("weight") && (
                <label className="field">
                  <span>Weight</span>
                  <select value={readLeaf(active) || "700"} onChange={(e) => patchPartValue(active, "weight", e.target.value)}>
                    {["400", "500", "600", "700", "800"].map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </label>
              )}
              {(active.kind === "color" || active.propPath.endsWith("color")) && (
                <label className="field">
                  <span>Color</span>
                  <input type="color" value={/^#/.test(readLeaf(active)) ? readLeaf(active) : "#710019"} onChange={(e) => patchPartValue(active, "color", e.target.value)} />
                  <input value={readLeaf(active)} onChange={(e) => patchPartValue(active, "color", e.target.value)} />
                </label>
              )}
              {(active.kind === "effect" || active.propPath.endsWith("effect")) && (
                <label className="field">
                  <span>Head panel effect</span>
                  <select value={readLeaf(active) || "drop-shadow"} onChange={(e) => patchPartValue(active, "effect", e.target.value)}>
                    {EFFECTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </label>
              )}
              {active.propPath.endsWith("height") && (
                <label className="field">
                  <span>Height</span>
                  <input value={readLeaf(active)} onChange={(e) => patchPartValue(active, "height", e.target.value)} placeholder="198px" />
                </label>
              )}
              {active.kind === "generic" && (
                <label className="field">
                  <span>Value</span>
                  <input value={readLeaf(active)} onChange={(e) => patchPartValue(active, active.propPath, e.target.value)} />
                </label>
              )}
              <p className="muted" style={{ marginTop: 10 }}>
                path: <code>{active.propPath}</code>
              </p>
            </>
          )}
        </div>
      </div>

      <div className="actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save → CMS + preview"}
        </button>
      </div>
    </div>
  );
}
