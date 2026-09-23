import { go } from "../lib/router";
    import logoAsset from "../../../assets/nadezhda-brush-original.png";

    const navItems = [
    ["За продажба", "/properties?deal=sale"],
    ["Под наем", "/properties?deal=rent"],
    ["За нас", "/about"],
    ["Контакти", "/contacts"],
    ];

    export default function NavigationLayer() {
    return (
      <header className="home-header">
        <a
          href="/"
          className="home-logo"
          aria-label="Имоти Надежда — начало"
          onClick={(event) => {
            event.preventDefault();
            go("/");
          }}
        >
          <img src={logoAsset} alt="Недвижими имоти Надежда" draggable="false" />
        </a>
        <nav className="home-nav" aria-label="Основна навигация">
          {navItems.map(([label, path]) => (
            <button key={path} type="button" className="home-nav__button" onClick={() => go(path)}>
              <span className="home-nav__mark" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
          <button type="button" className="home-nav__account" onClick={() => go("/account")}>
            <span className="home-nav__account-icon" aria-hidden="true" />
            <span>Профил</span>
          </button>
        </nav>
      </header>
    );
    }
    