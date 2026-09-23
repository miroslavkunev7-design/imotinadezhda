import { useEffect, useMemo, useState } from "react";
    import { CITIES } from "../data/cities";
    import { go } from "../lib/router";
    import mapCardArt from "../../../assets/map-card-reference.jpeg";
    import brushPanelMask from "../../../assets/brush-panel-mask.png";

    export default function BulgariaMapLayer({ catalog } = {}) {
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const published = useMemo(() => new Map((catalog?.cities || []).map((city) => [city.slug, city])), [catalog]);
    const cities = useMemo(() => CITIES.filter((city) => published.has(city.id)).map((city) => ({ ...city, name: published.get(city.id).name })), [published]);
    const selected = cities.find((city) => city.id === selectedId) || null;
    const quarters = selected ? catalog?.quartersByCity?.[selected.id] || [] : [];

    useEffect(() => {
      if (!open) return undefined;
      const onKeyDown = (event) => {
        if (event.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }, [open]);

    return (
      <section className="map-module" aria-label="Карта на България">
        <button type="button" className="map-card" onClick={() => setOpen(true)} aria-label="Отвори карта на България">
          <span className="map-card__art" aria-hidden="true"><img src={mapCardArt} alt="" /></span>
          <span className="map-card__button-copy"><span>Карта на България</span><small>Отвори бързи филтри</small></span>
        </button>
        <span className="map-card__hint">Избери град и разгледай имоти</span>
        {open ? (
          <div className="map-dialog-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
            <section
              className="map-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="map-dialog-title"
              onMouseDown={(event) => event.stopPropagation()}
              style={{ "--panel-mask": "url(" + brushPanelMask + ")" }}
            >
              <header className="map-dialog__header">
                <div><span className="map-dialog__eyebrow">Карта на България</span><h2 id="map-dialog-title">Избери град, за да разгледаш имоти</h2></div>
                <button type="button" className="map-dialog__close" onClick={() => setOpen(false)} aria-label="Затвори картата">×</button>
              </header>
              <div className="map-dialog__map">
                <img src={mapCardArt} alt="Карта на България с градове" />
                <div className="map-dialog__pins">
                  {cities.map((city) => (
                    <button
                      type="button"
                      key={city.id}
                      className={"map-pin" + (selectedId === city.id ? " is-selected" : "")}
                      style={{ left: city.visualAnchor.xPct + "%", top: city.visualAnchor.yPct + "%" }}
                      aria-pressed={selectedId === city.id}
                      onClick={() => setSelectedId(city.id)}
                    >
                      <span className="map-pin__dot" aria-hidden="true" />
                      <span>{city.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="map-dialog__info">
                <span className="map-dialog__info-icon" aria-hidden="true">i</span>
                <p>Тук виждаш картата на България с градовете. В страницата на град се отварят кварталите.</p>
              </div>
              {selected ? (
                <div className="map-dialog__selected">
                  <div><strong>{selected.name}</strong><span>{quarters.length ? quarters.length + " квартала" : "Няма публикувани квартали"}</span></div>
                  <div className="map-dialog__selected-actions">
                    <button type="button" onClick={() => go("/cities/" + selected.id)}>Страница на града</button>
                    <button type="button" onClick={() => go("/properties?city=" + selected.id)}>Разгледай имоти</button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </section>
    );
    }
    