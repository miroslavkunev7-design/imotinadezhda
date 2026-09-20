import { useState } from "react";
import { CITIES } from "../data/cities";
import { go } from "../lib/router";
export default function BulgariaMapLayer() {
  const [open, setOpen] = useState(null);
  const city = CITIES.find((c) => c.id === open) || null;
  return (
    <>
      <section className="map-layer" aria-label="Карта на България">
        {CITIES.map((c) => (
          <button
            key={c.id}
            className="hit map-hit"
            style={{
              left: `${c.hitBox.leftPct}%`,
              top: `${c.hitBox.topPct}%`,
              width: `${c.hitBox.widthPct}%`,
              height: `${c.hitBox.heightPct}%`,
            }}
            aria-label={`Избери ${c.name}`}
            aria-expanded={open === c.id}
            onClick={() => setOpen(open === c.id ? null : c.id)}
          />
        ))}
      </section>
      {city && (
        <div className="city-menu" role="dialog" aria-label={`Имоти в ${city.name}`}>
          <strong>{city.name}</strong>
          <button onClick={() => go(`/properties?city=${city.id}`)}>Всички имоти</button>
          <button onClick={() => go(`/properties?city=${city.id}&type=apartment`)}>
            Апартаменти
          </button>
          <button onClick={() => go(`/properties?city=${city.id}&type=house`)}>Къщи</button>
          <button onClick={() => go(`/properties?city=${city.id}&type=plot`)}>Парцели</button>
          <button className="menu-close" onClick={() => setOpen(null)}>
            Затвори
          </button>
        </div>
      )}
    </>
  );
}
