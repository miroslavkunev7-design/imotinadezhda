import { useEffect, useState } from "react";
import { CmsComponent, saveComponent } from "../api";

const SHAPES = [
  { id: "circle", radius: "999px", label: "Circle" },
  { id: "square", radius: "0px", label: "Square" },
  { id: "rounded", radius: "16px", label: "Rounded" },
  { id: "pill", radius: "999px", label: "Pill" },
  { id: "soft", radius: "28px", label: "Soft card" }
];

type Props = {
  pageSlug: string;
  component: CmsComponent | null;
  onSaved: () => void;
  toast: (msg: string) => void;
};

export function ComponentEditor({ pageSlug, component, onSaved, toast }: Props) {
  const [key, setKey] = useState("theme.wine");
  const [type, setType] = useState("color");
  const [color, setColor] = useState("#710019");
  const [cssVar, setCssVar] = useState("--wine");
  const [shape, setShape] = useState("rounded");
  const [selector, setSelector] = useState(".card");
  const [height, setHeight] = useState("286px");
  const [imageUrl, setImageUrl] = useState("");
  const [melt, setMelt] = useState(false);
  const [dropdownLabel, setDropdownLabel] = useState("");
  const [dropdownTarget, setDropdownTarget] = useState("");
  const [menuItems, setMenuItems] = useState<{ label: string; target: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!component) return;
    setKey(component.component_key);
    setType(component.type || "color");
    const p = component.props || {};
    if (typeof p.value === "string") setColor(p.value);
    if (typeof p.cssVar === "string") setCssVar(p.cssVar);
    if (typeof p.shape === "string") setShape(p.shape);
    if (typeof p.selector === "string") setSelector(p.selector);
    if (typeof p.height === "string") setHeight(p.height);
    if (typeof p.url === "string") setImageUrl(p.url);
    if (typeof p.melt === "boolean") setMelt(p.melt);
    if (Array.isArray(p.items)) setMenuItems(p.items as { label: string; target: string }[]);
  }, [component]);

  async function pickImage() {
    const file = await window.imotiSettings?.openImage();
    if (!file) return;
    setImageUrl(file.dataUrl);
    setType(melt ? "melt" : "image");
  }

  function addMenuItem() {
    if (!dropdownLabel.trim()) return;
    setMenuItems((m) => [...m, { label: dropdownLabel.trim(), target: dropdownTarget.trim() || "card" }]);
    setDropdownLabel("");
    setDropdownTarget("");
  }

  async function save() {
    setBusy(true);
    try {
      const shapeMeta = SHAPES.find((s) => s.id === shape) || SHAPES[2];
      let props: Record<string, unknown> = {};
      if (type === "color") props = { cssVar, value: color, label: "Color" };
      else if (type === "shape") props = { shape, radius: shapeMeta.radius, selector, label: shapeMeta.label };
      else if (type === "image" || type === "melt") props = { url: imageUrl, selector, melt: type === "melt" || melt };
      else if (type === "section_height") props = { selector, height };
      else if (type === "dropdown") props = { items: menuItems };
      else props = { ...((component && component.props) || {}), value: color };

      await saveComponent({
        page_slug: pageSlug,
        component_key: key,
        type,
        sort_order: component?.sort_order ?? 0,
        rect: component?.rect || {},
        props
      });
      await window.imotiSettings?.previewReload();
      toast("Saved — preview & live within seconds");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!component && !pageSlug) {
    return <div className="empty">Select a page and component, or create a new override below.</div>;
  }

  return (
    <div className="card">
      <h3>{component ? `Edit · ${component.component_key}` : "New component override"}</h3>
      <div className="grid2">
        <label className="field">
          <span>Component key</span>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="theme.wine" />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="color">Color</option>
            <option value="shape">Shape</option>
            <option value="image">Image</option>
            <option value="melt">Melt photo</option>
            <option value="section_height">Section height</option>
            <option value="dropdown">Dropdown builder</option>
          </select>
        </label>
      </div>

      {type === "color" && (
        <div className="grid2" style={{ marginTop: 12 }}>
          <label className="field">
            <span>CSS variable</span>
            <input value={cssVar} onChange={(e) => setCssVar(e.target.value)} />
          </label>
          <label className="field">
            <span>Color</span>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
        </div>
      )}

      {type === "shape" && (
        <div className="grid2" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Shape</span>
            <select value={shape} onChange={(e) => setShape(e.target.value)}>
              {SHAPES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>CSS selector</span>
            <input value={selector} onChange={(e) => setSelector(e.target.value)} />
          </label>
        </div>
      )}

      {(type === "image" || type === "melt") && (
        <div style={{ marginTop: 12 }}>
          <label className="field">
            <span>Selector</span>
            <input value={selector} onChange={(e) => setSelector(e.target.value)} />
          </label>
          <label className="field" style={{ marginTop: 10 }}>
            <span>Image URL or data</span>
            <textarea value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input type="checkbox" checked={melt || type === "melt"} onChange={(e) => { setMelt(e.target.checked); if (e.target.checked) setType("melt"); }} />
            Melt overlay photo
          </label>
          <div className="actions">
            <button type="button" className="ghost" onClick={pickImage}>Upload / replace from disk</button>
          </div>
        </div>
      )}

      {type === "section_height" && (
        <div className="grid2" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Selector</span>
            <input value={selector} onChange={(e) => setSelector(e.target.value)} />
          </label>
          <label className="field">
            <span>Min height</span>
            <input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="286px" />
          </label>
        </div>
      )}

      {type === "dropdown" && (
        <div style={{ marginTop: 12 }}>
          <p className="muted">Add menu → opens target card</p>
          <div className="grid2">
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
          <ul>
            {menuItems.map((m, i) => (
              <li key={i}>{m.label} → {m.target}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="actions">
        <button type="button" className="primary" disabled={busy || !key} onClick={save}>
          {busy ? "Saving…" : "Save → preview + live"}
        </button>
      </div>
    </div>
  );
}
