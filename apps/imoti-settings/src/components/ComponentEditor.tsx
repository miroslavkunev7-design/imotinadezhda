import { useEffect, useState } from "react";
import { CmsComponent, saveComponent } from "../api";

const SHAPES = [
  { id: "circle", radius: "999px", label: "Circle" },
  { id: "square", radius: "0px", label: "Square" },
  { id: "rounded", radius: "16px", label: "Rounded 16" },
  { id: "rounded-sm", radius: "8px", label: "Rounded 8" },
  { id: "rounded-lg", radius: "24px", label: "Rounded 24" },
  { id: "soft", radius: "28px", label: "Soft card 28" },
  { id: "pill", radius: "999px", label: "Pill" },
  { id: "ticket", radius: "4px 28px 4px 28px", label: "Ticket" },
  { id: "blob", radius: "40% 60% 55% 45% / 50% 40% 60% 50%", label: "Organic blob" },
  { id: "hex-cut", radius: "18px 18px 4px 18px", label: "Hex cut" }
];

const COLOR_PRESETS = [
  { id: "wine", value: "#710019", label: "Wine" },
  { id: "wine-deep", value: "#3a0610", label: "Wine deep" },
  { id: "gold", value: "#bb7b16", label: "Gold" },
  { id: "gold-bright", value: "#f0d4a0", label: "Gold bright" },
  { id: "cream", value: "#fff9f2", label: "Cream" },
  { id: "ink", value: "#6a001b", label: "Ink" },
  { id: "forest", value: "#1f4d3a", label: "Forest" },
  { id: "night", value: "#0e1a2b", label: "Night" },
  { id: "rose", value: "#a12b4a", label: "Rose" },
  { id: "sand", value: "#e8d5b5", label: "Sand" }
];

const CSS_VARS = ["--wine", "--wine-d", "--gold", "--gold-l", "--cream", "--ink", "--bank-accent", "--surface"];

const GRAPHICS = [
  { id: "none", label: "None" },
  { id: "logo", label: "Brand logo slot" },
  { id: "photo", label: "Photo fill" },
  { id: "gold-satin", label: "Gold satin icon" },
  { id: "outline-gold", label: "Gold outline map" },
  { id: "line-art", label: "Line-art glyph" },
  { id: "watermark", label: "Pale watermark" }
];

const MELT_MODES = [
  { id: "gradient", label: "Gradient melt" },
  { id: "vignette", label: "Vignette" },
  { id: "soft-edge", label: "Soft edge dissolve" },
  { id: "photo-bleed", label: "Photo bleed" }
];

const BLENDS = ["normal", "multiply", "soft-light", "overlay", "darken", "screen"];

const SIZE_PRESETS = [
  { id: "xs", height: "48px", scale: 0.85, label: "XS" },
  { id: "sm", height: "72px", scale: 0.92, label: "S" },
  { id: "md", height: "120px", scale: 1, label: "M" },
  { id: "lg", height: "220px", scale: 1.05, label: "L" },
  { id: "xl", height: "360px", scale: 1.12, label: "XL" },
  { id: "hero", height: "520px", scale: 1.2, label: "Hero" }
];

type Draft = {
  key: string;
  type: string;
  color: string;
  cssVar: string;
  shape: string;
  selector: string;
  height: string;
  width: string;
  scale: number;
  padding: string;
  imageUrl: string;
  melt: boolean;
  intensity: number;
  meltMode: string;
  blend: string;
  fit: string;
  graphics: string;
  graphicSize: string;
  graphicColor: string;
  menuItems: { label: string; target: string }[];
};

type Props = {
  pageSlug: string;
  component: CmsComponent | null;
  creating?: boolean;
  onSaved: () => void;
  onLiveChange: (draft: { component_key: string; type: string; props: Record<string, unknown> }) => void;
  toast: (msg: string) => void;
};

function propsFromDraft(d: Draft): Record<string, unknown> {
  const shapeMeta = SHAPES.find((s) => s.id === d.shape) || SHAPES[2];
  if (d.type === "color") return { cssVar: d.cssVar, value: d.color, label: "Color" };
  if (d.type === "shape") return { shape: d.shape, radius: shapeMeta.radius, selector: d.selector, label: shapeMeta.label };
  if (d.type === "image" || d.type === "melt") {
    return {
      url: d.imageUrl,
      selector: d.selector,
      melt: d.type === "melt" || d.melt,
      intensity: d.intensity,
      mode: d.meltMode,
      blend: d.blend,
      fit: d.fit,
      graphics: d.graphics
    };
  }
  if (d.type === "section_height") return { selector: d.selector, height: d.height };
  if (d.type === "size") return { selector: d.selector, width: d.width, height: d.height, scale: d.scale, padding: d.padding };
  if (d.type === "graphics") {
    return { selector: d.selector, preset: d.graphics, size: d.graphicSize, color: d.graphicColor };
  }
  if (d.type === "dropdown") return { items: d.menuItems, selector: d.selector };
  return { cssVar: d.cssVar, value: d.color, selector: d.selector };
}

const emptyDraft = (): Draft => ({
  key: "theme.wine",
  type: "color",
  color: "#710019",
  cssVar: "--wine",
  shape: "rounded",
  selector: ".card",
  height: "286px",
  width: "100%",
  scale: 1,
  padding: "12px",
  imageUrl: "",
  melt: false,
  intensity: 0.7,
  meltMode: "gradient",
  blend: "multiply",
  fit: "cover",
  graphics: "none",
  graphicSize: "44px",
  graphicColor: "#c9922e",
  menuItems: []
});

export function ComponentEditor({ pageSlug, component, creating, onSaved, onLiveChange, toast }: Props) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [dropdownLabel, setDropdownLabel] = useState("");
  const [dropdownTarget, setDropdownTarget] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!component && !creating) return;
    const next = emptyDraft();
    if (component) {
      next.key = component.component_key;
      next.type = component.type || "color";
      const p = component.props || {};
      if (typeof p.value === "string") next.color = p.value;
      if (typeof p.cssVar === "string") next.cssVar = p.cssVar;
      if (typeof p.shape === "string") next.shape = p.shape;
      if (typeof p.selector === "string") next.selector = p.selector;
      if (typeof p.height === "string") next.height = p.height;
      if (typeof p.width === "string") next.width = p.width;
      if (typeof p.scale === "number") next.scale = p.scale;
      if (typeof p.padding === "string") next.padding = p.padding;
      if (typeof p.url === "string") next.imageUrl = p.url;
      if (typeof p.melt === "boolean") next.melt = p.melt;
      if (typeof p.intensity === "number") next.intensity = p.intensity;
      if (typeof p.mode === "string") next.meltMode = p.mode;
      if (typeof p.blend === "string") next.blend = p.blend;
      if (typeof p.fit === "string") next.fit = p.fit;
      if (typeof p.graphics === "string") next.graphics = p.graphics;
      if (typeof p.preset === "string") next.graphics = p.preset;
      if (typeof p.size === "string") next.graphicSize = p.size;
      if (typeof p.color === "string" && next.type === "graphics") next.graphicColor = p.color;
      if (Array.isArray(p.items)) next.menuItems = p.items as { label: string; target: string }[];
    }
    setDraft(next);
  }, [component, creating]);

  useEffect(() => {
    if (!draft.key) return;
    onLiveChange({
      component_key: draft.key,
      type: draft.type,
      props: propsFromDraft(draft)
    });
  }, [draft, onLiveChange]);

  function patch(partial: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...partial }));
  }

  async function pickImage() {
    const file = await window.imotiSettings?.openImage();
    if (!file) {
      // Walkthrough / browser: use file input fallback
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = () => {
        const f = input.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          patch({ imageUrl: String(reader.result || ""), type: draft.melt ? "melt" : draft.type === "melt" ? "melt" : "image" });
        };
        reader.readAsDataURL(f);
      };
      input.click();
      return;
    }
    patch({ imageUrl: file.dataUrl, type: draft.melt || draft.type === "melt" ? "melt" : "image" });
  }

  function addMenuItem() {
    if (!dropdownLabel.trim()) return;
    patch({
      menuItems: [...draft.menuItems, { label: dropdownLabel.trim(), target: dropdownTarget.trim() || "card" }]
    });
    setDropdownLabel("");
    setDropdownTarget("");
  }

  async function save() {
    setBusy(true);
    try {
      await saveComponent({
        page_slug: pageSlug,
        component_key: draft.key,
        type: draft.type,
        sort_order: component?.sort_order ?? 0,
        rect: component?.rect || {},
        props: propsFromDraft(draft)
      });
      await window.imotiSettings?.previewReload?.();
      toast("Saved to CMS — preview cache-busted");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!component && !creating) {
    return <div className="empty">Select a component below the preview, or create a new override.</div>;
  }

  const title = typeof component?.props?._label === "string"
    ? String(component.props._label)
    : component
      ? component.component_key
      : "New component override";

  return (
    <div className="card editor-card">
      <div className="editor-head">
        <h3>{creating ? "New override" : `Edit · ${title}`}</h3>
        <span className="live-pill" title="Changes paint in preview as you edit">LIVE</span>
      </div>
      {typeof component?.props?._hint === "string" && (
        <p className="muted">{String(component.props._hint)}</p>
      )}

      <div className="grid2">
        <label className="field">
          <span>Component key</span>
          <input value={draft.key} onChange={(e) => patch({ key: e.target.value })} placeholder="theme.wine" />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={draft.type} onChange={(e) => patch({ type: e.target.value })}>
            <option value="color">Color</option>
            <option value="shape">Shape</option>
            <option value="image">Image</option>
            <option value="melt">Melt photo</option>
            <option value="section_height">Section height</option>
            <option value="size">Size / scale</option>
            <option value="graphics">Graphics / icons</option>
            <option value="dropdown">Dropdown builder</option>
          </select>
        </label>
      </div>

      {draft.type === "color" && (
        <div style={{ marginTop: 12 }}>
          <div className="grid2">
            <label className="field">
              <span>CSS variable</span>
              <select value={draft.cssVar} onChange={(e) => patch({ cssVar: e.target.value })}>
                {CSS_VARS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Color</span>
              <input type="color" value={draft.color} onChange={(e) => patch({ color: e.target.value })} />
            </label>
          </div>
          <div className="swatch-row" role="list">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={"swatch" + (draft.color.toLowerCase() === c.value.toLowerCase() ? " active" : "")}
                style={{ background: c.value }}
                title={c.label}
                onClick={() => patch({ color: c.value })}
              />
            ))}
          </div>
          <label className="field" style={{ marginTop: 10 }}>
            <span>Hex</span>
            <input value={draft.color} onChange={(e) => patch({ color: e.target.value })} />
          </label>
        </div>
      )}

      {draft.type === "shape" && (
        <div style={{ marginTop: 12 }}>
          <div className="shape-grid">
            {SHAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={"shape-chip" + (draft.shape === s.id ? " active" : "")}
                onClick={() => patch({ shape: s.id })}
              >
                <i style={{ borderRadius: s.radius }} />
                {s.label}
              </button>
            ))}
          </div>
          <label className="field" style={{ marginTop: 10 }}>
            <span>CSS selector</span>
            <input value={draft.selector} onChange={(e) => patch({ selector: e.target.value })} />
          </label>
        </div>
      )}

      {(draft.type === "image" || draft.type === "melt") && (
        <div style={{ marginTop: 12 }}>
          <label className="field">
            <span>Selector</span>
            <input value={draft.selector} onChange={(e) => patch({ selector: e.target.value })} />
          </label>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">
              <span>Object fit</span>
              <select value={draft.fit} onChange={(e) => patch({ fit: e.target.value })}>
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="fill">Fill</option>
              </select>
            </label>
            <label className="field">
              <span>Graphics role</span>
              <select value={draft.graphics} onChange={(e) => patch({ graphics: e.target.value })}>
                {GRAPHICS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </label>
          </div>
          {(draft.type === "melt" || draft.melt) && (
            <>
              <div className="grid2" style={{ marginTop: 10 }}>
                <label className="field">
                  <span>Melt mode</span>
                  <select value={draft.meltMode} onChange={(e) => patch({ meltMode: e.target.value, melt: true, type: "melt" })}>
                    {MELT_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Blend</span>
                  <select value={draft.blend} onChange={(e) => patch({ blend: e.target.value })}>
                    {BLENDS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
              </div>
              <label className="field" style={{ marginTop: 10 }}>
                <span>Intensity {Math.round(draft.intensity * 100)}%</span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.01}
                  value={draft.intensity}
                  onChange={(e) => patch({ intensity: Number(e.target.value), melt: true })}
                />
              </label>
            </>
          )}
          <label className="field" style={{ marginTop: 10 }}>
            <span>Image URL or data</span>
            <textarea value={draft.imageUrl} onChange={(e) => patch({ imageUrl: e.target.value })} />
          </label>
          {draft.imageUrl && (
            <div className="img-preview" style={{ backgroundImage: `url(${JSON.stringify(draft.imageUrl).slice(1, -1)})` }} />
          )}
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input
              type="checkbox"
              checked={draft.melt || draft.type === "melt"}
              onChange={(e) => patch({ melt: e.target.checked, type: e.target.checked ? "melt" : "image" })}
            />
            Melt overlay photo
          </label>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => void pickImage()}>Upload / replace from disk</button>
          </div>
        </div>
      )}

      {draft.type === "section_height" && (
        <div style={{ marginTop: 12 }}>
          <div className="chip-row">
            {SIZE_PRESETS.map((s) => (
              <button key={s.id} type="button" className={"chip" + (draft.height === s.height ? " active" : "")} onClick={() => patch({ height: s.height })}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">
              <span>Selector</span>
              <input value={draft.selector} onChange={(e) => patch({ selector: e.target.value })} />
            </label>
            <label className="field">
              <span>Min height</span>
              <input value={draft.height} onChange={(e) => patch({ height: e.target.value })} placeholder="286px" />
            </label>
          </div>
        </div>
      )}

      {draft.type === "size" && (
        <div style={{ marginTop: 12 }}>
          <div className="chip-row">
            {SIZE_PRESETS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={"chip" + (draft.height === s.height ? " active" : "")}
                onClick={() => patch({ height: s.height, scale: s.scale })}
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="field" style={{ marginTop: 10 }}>
            <span>Selector</span>
            <input value={draft.selector} onChange={(e) => patch({ selector: e.target.value })} />
          </label>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">
              <span>Width</span>
              <input value={draft.width} onChange={(e) => patch({ width: e.target.value })} />
            </label>
            <label className="field">
              <span>Height</span>
              <input value={draft.height} onChange={(e) => patch({ height: e.target.value })} />
            </label>
            <label className="field">
              <span>Padding</span>
              <input value={draft.padding} onChange={(e) => patch({ padding: e.target.value })} />
            </label>
            <label className="field">
              <span>Scale {draft.scale.toFixed(2)}</span>
              <input type="range" min={0.5} max={1.6} step={0.01} value={draft.scale} onChange={(e) => patch({ scale: Number(e.target.value) })} />
            </label>
          </div>
        </div>
      )}

      {draft.type === "graphics" && (
        <div style={{ marginTop: 12 }}>
          <label className="field">
            <span>Selector</span>
            <input value={draft.selector} onChange={(e) => patch({ selector: e.target.value })} />
          </label>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">
              <span>Preset</span>
              <select value={draft.graphics} onChange={(e) => patch({ graphics: e.target.value })}>
                {GRAPHICS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Size</span>
              <input value={draft.graphicSize} onChange={(e) => patch({ graphicSize: e.target.value })} />
            </label>
          </div>
          <label className="field" style={{ marginTop: 10 }}>
            <span>Tint</span>
            <input type="color" value={draft.graphicColor} onChange={(e) => patch({ graphicColor: e.target.value })} />
          </label>
        </div>
      )}

      {draft.type === "dropdown" && (
        <div style={{ marginTop: 12 }}>
          <p className="muted">Add menu option → opens target card / route key</p>
          <label className="field">
            <span>Optional host selector</span>
            <input value={draft.selector} onChange={(e) => patch({ selector: e.target.value })} placeholder=".nav, .menu" />
          </label>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">
              <span>Menu label</span>
              <input value={dropdownLabel} onChange={(e) => setDropdownLabel(e.target.value)} />
            </label>
            <label className="field">
              <span>Target card key</span>
              <input value={dropdownTarget} onChange={(e) => setDropdownTarget(e.target.value)} />
            </label>
          </div>
          <div className="actions">
            <button type="button" className="ghost" onClick={addMenuItem}>Add option</button>
          </div>
          <ul className="menu-list">
            {draft.menuItems.map((m, i) => (
              <li key={i}>
                <span>{m.label} → {m.target}</span>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => patch({ menuItems: draft.menuItems.filter((_, j) => j !== i) })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="actions">
        <button type="button" className="primary" disabled={busy || !draft.key} onClick={() => void save()}>
          {busy ? "Saving…" : "Save → CMS + cache-bust preview"}
        </button>
      </div>
    </div>
  );
}
