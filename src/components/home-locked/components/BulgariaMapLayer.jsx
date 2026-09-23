import { useState } from "react";
import { CITIES } from "../data/cities";
import { go } from "../lib/router";

export default function BulgariaMapLayer({ catalog } = {}) {
  const [open, setOpen] = useState(null);
  const published = new Map((catalog?.cities || []).map((city) => [city.slug, city]));
  const cities = CITIES
    .filter((city) => published.has(city.id))
    .map((city) => ({ ...city, name: published.get(city.id).name }));
  const city = cities.find((item) => item.id === open) || null;
  const quarters = city ? catalog?.quartersByCity?.[city.id] || [] : [];

  return (
    <>
      <section className="map-layer" aria-label="Карта на България">
        {cities.map((item) => (
          <button
            key={item.id}
            className="hit map-hit"
            style={{
              left: item.hitBox.leftPct + "%",
              top: item.hitBox.topPct + "%",
              width: item.hitBox.widthPct + "%",
              height: item.hitBox.heightPct + "%",
            }}
            aria-label={"Избери " + item.name}
            aria-expanded={open === item.id}
            onClick={() => setOpen(open === item.id ? null : item.id)}
          />
        ))}
      </section>
      {city && (
        <div className="city-menu" role="dialog" aria-label={"Имоти в " + city.name}>
          <strong>{city.name}</strong>
          <button type="button" onClick={() => go("/cities/" + city.id)}>
            Страница на града
          </button>
          <button type="button" onClick={() => go("/properties?city=" + city.id)}>
            Всички имоти
          </button>
          {quarters.map((quarter) => (
            <button
              type="button"
              key={quarter.slug}
              onClick={() => go("/cities/" + city.id + "/districts/" + quarter.slug)}
            >
              {quarter.name}
            </button>
          ))}
          <button type="button" className="menu-close" onClick={() => setOpen(null)}>
            Затвори
          </button>
        </div>
      )}
    </>
  );
}
