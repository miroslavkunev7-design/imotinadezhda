import { useState } from "react";
    import { go } from "../lib/router";
    import brushCardMask from "../../../assets/brush-card-mask.png";
    import cityShumen from "../../../assets/city-shumen.jpeg";
    import cityVarna from "../../../assets/city-varna.jpeg";
    import cityBurgas from "../../../assets/city-burgas.jpeg";
    import cityNoviPazar from "../../../assets/city-novi-pazar.jpeg";

    const CITY_IMAGES = {
    shumen: cityShumen,
    varna: cityVarna,
    burgas: cityBurgas,
    "novi-pazar": cityNoviPazar,
    };

    export default function CityCardsLayer({ catalog } = {}) {
    const [openSlug, setOpenSlug] = useState(null);
    const cities = Array.isArray(catalog?.cities) ? catalog.cities : [];
    return (
      <section className="city-cards-layer" aria-label="Избери град">
        <div className="city-cards-grid">
          {cities.map((city) => {
            const quarters = catalog?.quartersByCity?.[city.slug] || [];
            const isOpen = openSlug === city.slug;
            const image = CITY_IMAGES[city.slug] || cityShumen;
            return (
              <article className="city-card" key={city.slug}>
                <button
                  type="button"
                  className="city-card__trigger"
                  aria-expanded={isOpen}
                  aria-controls={"city-card-menu-" + city.slug}
                  onClick={() => setOpenSlug(isOpen ? null : city.slug)}
                >
                  <span
                    className="city-card__art"
                    style={{ backgroundImage: "url(" + image + ")", maskImage: "url(" + brushCardMask + ")", WebkitMaskImage: "url(" + brushCardMask + ")" }}
                    aria-hidden="true"
                  />
                  <span className="city-card__shade" aria-hidden="true" />
                  <span className="city-card__content">
                    <strong>{city.name}</strong>
                    <small>{quarters.length ? quarters.length + " квартала" : "Отвори града"}</small>
                    <span className="city-card__link">Разгледай →</span>
                  </span>
                </button>
                {isOpen ? (
                  <div id={"city-card-menu-" + city.slug} className="city-card__menu" role="dialog" aria-label={"Град " + city.name}>
                    <strong>{city.name}</strong>
                    <button type="button" onClick={() => go("/cities/" + city.slug)}>Страница на града</button>
                    <button type="button" onClick={() => go("/properties?city=" + city.slug)}>Всички имоти</button>
                    {quarters.map((quarter) => (
                      <button type="button" key={quarter.slug} onClick={() => go("/cities/" + city.slug + "/districts/" + quarter.slug)}>{quarter.name}</button>
                    ))}
                    <button type="button" className="city-card__close" onClick={() => setOpenSlug(null)}>Затвори</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    );
    }
    