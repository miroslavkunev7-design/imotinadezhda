import { useState } from "react";
import { UI_GEOMETRY as G } from "../data/uiGeometry";
import { FILTER_OPTIONS } from "../data/filterOptions";
import { go } from "../lib/router";
function InvisibleSelect({ name, label, value, onChange, box }) {
  return (
    <select
      className="native-select"
      style={box}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
    >
      {FILTER_OPTIONS[name].map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
export default function SearchLayer() {
  const [filters, setFilters] = useState({ city: "", type: "", price: "", area: "" });
  const [advanced, setAdvanced] = useState(false);
  const set = (k, v) => setFilters((x) => ({ ...x, [k]: v }));
  const search = () => {
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    go("/properties" + (q.size ? "?" + q.toString() : ""));
  };
  return (
    <>
      <InvisibleSelect
        name="city"
        label="Град"
        value={filters.city}
        onChange={set}
        box={G.filters.city}
      />
      <InvisibleSelect
        name="type"
        label="Вид имот"
        value={filters.type}
        onChange={set}
        box={G.filters.type}
      />
      <InvisibleSelect
        name="price"
        label="Цена"
        value={filters.price}
        onChange={set}
        box={G.filters.price}
      />
      <InvisibleSelect
        name="area"
        label="Площ"
        value={filters.area}
        onChange={set}
        box={G.filters.area}
      />
      <button
        className="hit"
        style={G.filters.advanced}
        aria-label="Филтри"
        aria-expanded={advanced}
        onClick={() => setAdvanced((v) => !v)}
      />
      <button className="hit" style={G.filters.search} aria-label="Търси" onClick={search} />
      {advanced && (
        <div className="advanced-popover" role="dialog" aria-label="Разширени филтри">
          <label>
            <input type="checkbox" /> Само с обзавеждане
          </label>
          <label>
            <input type="checkbox" /> Само ново строителство
          </label>
          <button type="button" onClick={() => setAdvanced(false)}>
            Готово
          </button>
        </div>
      )}
    </>
  );
}
