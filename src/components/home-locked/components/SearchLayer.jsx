import { useState } from "react";
    import { FILTER_OPTIONS } from "../data/filterOptions";
    import { go } from "../lib/router";

    function FilterSelect({ name, label, value, onChange, options }) {
    return (
      <label className="search-field">
        <span className="search-field__label">{label}</span>
        <select value={value} onChange={(event) => onChange(name, event.target.value)}>
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>{optionLabel}</option>
          ))}
        </select>
      </label>
    );
    }

    export default function SearchLayer({ catalog } = {}) {
    const [filters, setFilters] = useState({ city: "", type: "", price: "", area: "" });
    const [advanced, setAdvanced] = useState(false);
    const cityOptions = [
      ["", "Избери град"],
      ...(catalog?.cities || []).flatMap((city) => [
        [city.slug, city.name],
        ...((catalog?.quartersByCity?.[city.slug] || []).map((quarter) => [
          city.slug + ":" + quarter.slug,
          city.name + " — " + quarter.name,
        ])),
      ]),
    ];
    const options = { ...FILTER_OPTIONS, city: cityOptions };
    const set = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
    const search = () => {
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      go("/properties" + (query.size ? "?" + query.toString() : ""));
    };

    return (
      <section className="search-panel" aria-label="Търсене на имот">
        <div className="search-fields">
          <FilterSelect name="city" label="Град" value={filters.city} onChange={set} options={options.city} />
          <FilterSelect name="type" label="Вид имот" value={filters.type} onChange={set} options={options.type} />
          <FilterSelect name="price" label="Цена" value={filters.price} onChange={set} options={options.price} />
          <FilterSelect name="area" label="Площ" value={filters.area} onChange={set} options={options.area} />
        </div>
        <div className="search-actions">
          <button type="button" className="brush-action brush-action--filter" aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}>
            <span className="brush-action__icon" aria-hidden="true">☷</span>
            <span>Филтри</span>
          </button>
          <button type="button" className="brush-action brush-action--search" onClick={search}>
            <span className="brush-action__icon" aria-hidden="true">⌕</span>
            <span>Търси</span>
          </button>
        </div>
        {advanced ? (
          <div className="advanced-popover" role="dialog" aria-label="Разширени филтри">
            <label><input type="checkbox" /> Само с обзавеждане</label>
            <label><input type="checkbox" /> Само ново строителство</label>
            <button type="button" onClick={() => setAdvanced(false)}>Готово</button>
          </div>
        ) : null}
      </section>
    );
    }
    