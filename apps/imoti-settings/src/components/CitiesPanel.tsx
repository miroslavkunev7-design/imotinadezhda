import { useEffect, useState } from "react";
import { fetchSetting, saveSetting } from "../api";

type CityRow = { name: string; slug: string; neighborhoods: string[] };

const DEFAULTS: CityRow[] = [
  { name: "Шумен", slug: "shumen", neighborhoods: ["Център", "Тракия", "Боян Българанов 1", "Боян Българанов 2", "Добруджански", "Еверест"] },
  { name: "Варна", slug: "varna", neighborhoods: ["Център", "Бриз", "Чайка", "Левски", "Аспарухово"] },
  { name: "Бургас", slug: "burgas", neighborhoods: ["Лазур", "Славейков", "Изгрев", "Възраждане", "Център"] },
  { name: "Нови пазар", slug: "novi-pazar", neighborhoods: ["Изток", "Запад", "Север", "Юг"] }
];

export function CitiesPanel({ toast }: { toast: (m: string) => void }) {
  const [cities, setCities] = useState<CityRow[]>(DEFAULTS);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [hood, setHood] = useState("");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchSetting<{ enabled?: boolean; cities?: CityRow[] }>("cities_override");
        if (data?.cities?.length) setCities(data.cities);
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  async function persist(next: CityRow[]) {
    setCities(next);
    try {
      await saveSetting("cities_override", { enabled: true, cities: next });
      toast("Cities/neighborhoods saved to cms_settings");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }

  function addCity() {
    if (!name.trim() || !slug.trim()) return;
    void persist([...cities, { name: name.trim(), slug: slug.trim(), neighborhoods: [] }]);
    setName("");
    setSlug("");
  }

  function addHood() {
    if (!hood.trim()) return;
    const next = cities.map((c, i) => i === selected ? { ...c, neighborhoods: [...c.neighborhoods, hood.trim()] } : c);
    setHood("");
    void persist(next);
  }

  function removeHood(hi: number) {
    const next = cities.map((c, i) =>
      i === selected ? { ...c, neighborhoods: c.neighborhoods.filter((_, j) => j !== hi) } : c
    );
    void persist(next);
  }

  const cur = cities[selected];

  return (
    <div className="card">
      <h3>Cities / neighborhoods CRUD</h3>
      <p className="muted">Writes cms_settings.cities_override — wires to neighborhood photo map on site when enabled.</p>
      <div className="grid2">
        <div>
          {cities.map((c, i) => (
            <button key={c.slug} type="button" className={"page-btn" + (i === selected ? " active" : "")} onClick={() => setSelected(i)}>
              {c.name}<small>{c.slug}</small>
            </button>
          ))}
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field"><span>City name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="field"><span>Slug</span><input value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
          </div>
          <div className="actions"><button type="button" className="primary" onClick={addCity}>Add city</button></div>
        </div>
        <div>
          <h3 style={{ marginTop: 0 }}>{cur?.name || "—"}</h3>
          <ul>
            {(cur?.neighborhoods || []).map((h, i) => (
              <li key={h + i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>{h}</span>
                <button type="button" className="ghost" onClick={() => removeHood(i)}>Remove</button>
              </li>
            ))}
          </ul>
          <label className="field"><span>Neighborhood</span><input value={hood} onChange={(e) => setHood(e.target.value)} /></label>
          <div className="actions"><button type="button" className="primary" onClick={addHood}>Add neighborhood</button></div>
        </div>
      </div>
    </div>
  );
}
