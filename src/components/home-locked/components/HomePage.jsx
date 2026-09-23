import NavigationLayer from "./NavigationLayer";
    import SearchLayer from "./SearchLayer";
    import BulgariaMapLayer from "./BulgariaMapLayer";
    import CityCardsLayer from "./CityCardsLayer";
    import heroBackground from "../../../assets/home-hero-bkg.jpeg";
    import brushPanelMask from "../../../assets/brush-panel-mask.png";

    export default function HomePage({ catalog = null } = {}) {
    return (
      <main
        className="home-artboard"
        aria-label="Недвижими имоти Надежда"
        style={{
          "--hero-image": "url(" + heroBackground + ")",
          "--panel-mask": "url(" + brushPanelMask + ")",
        }}
      >
        <div className="home-hero__backdrop" aria-hidden="true" />
        <NavigationLayer />
        <section className="hero-grid" aria-labelledby="home-hero-title">
          <BulgariaMapLayer catalog={catalog} />
          <section className="hero-copy" aria-labelledby="home-hero-title">
            <p className="hero-copy__eyebrow">Имоти в Шумен • Варна • Бургас</p>
            <h1 id="home-hero-title">
              Намери своя
              <strong>НОВ ДОМ</strong>
            </h1>
            <p className="hero-copy__body">
              Ние от Имоти Надежда Ви предлагаме най-добрите оферти за продажба и под наем на имоти в трите най-динамични града на България.
            </p>
            <div className="hero-stats" aria-label="Предимства">
              <div><strong>73 000</strong><span>доволни клиенти</span></div>
              <div><strong>6 291 km²</strong><span>площ</span></div>
              <div><strong>3</strong><span>града</span></div>
              <div><strong>14+</strong><span>активни имота</span></div>
            </div>
          </section>
        </section>
        <SearchLayer catalog={catalog} />
        <section className="city-picker-heading" aria-label="Избор на град">
          <span>Избери град</span>
        </section>
        <CityCardsLayer catalog={catalog} />
      </main>
    );
    }
    