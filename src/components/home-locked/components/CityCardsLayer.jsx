import { useState } from "react";
import { go } from "../lib/router";

/**
 * Реални city/quarter действия за homepage-а. Данните идват от published
 * catalog loader-а, а не от фиксиран списък или невидими click zones.
 */
export default function CityCardsLayer({ catalog } = {}) {
  const [openSlug, setOpenSlug] = useState(null);
  const cities = Array.isArray(catalog?.cities) ? catalog.cities : [];

  return (
    <section className="city-cards-layer" aria-label="Избери град">
      <div className="city-cards-grid">
        {cities.map((city) => {
          const quarters = catalog?.quartersByCity?.[city.slug] || [];
          const isOpen = openSlug === city.slug;
          return (
            <article className="city-card" key={city.slug}>
              <button
                type="button"
                className="city-card__trigger"
                aria-expanded={isOpen}
                aria-controls={"city-card-menu-" + city.slug}
                onClick={() => setOpenSlug(isOpen ? null : city.slug)}
              >
                <span className="city-card__name">{city.name}</span>
                <span className="city-card__count">
                  {quarters.length ? quarters.length + " квартала" : "Отвори града"}
                </span>
              </button>
              {isOpen ? (
                <div
                  id={"city-card-menu-" + city.slug}
                  className="city-card__menu"
                  role="dialog"
                  aria-label={"Град " + city.name}
                >
                  <strong>{city.name}</strong>
                  <button type="button" onClick={() => go("/cities/" + city.slug)}>
                    Страница на града
                  </button>
                  <button type="button" onClick={() => go("/properties?city=" + city.slug)}>
                    Всички имоти
                  </button>
                  {quarters.map((quarter) => (
                    <button
                      type="button"
                      key={quarter.slug}
                      onClick={() => go("/cities/" + city.slug + "/districts/" + quarter.slug)}
                    >
                      {quarter.name}
                    </button>
                  ))}
                  <button type="button" className="city-card__close" onClick={() => setOpenSlug(null)}>
                    Затвори
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
