import { UI_GEOMETRY as G } from "../data/uiGeometry";
import { go } from "../lib/router";
export default function NavigationLayer() {
  return (
    <>
      <button
        className="hit"
        style={G.logo}
        aria-label="Начална страница"
        onClick={() => go("/")}
      />
      <nav aria-label="Основна навигация">
        <button
          className="hit"
          style={G.nav.sale}
          aria-label="За продажба"
          onClick={() => go("/properties?deal=sale")}
        />
        <button
          className="hit"
          style={G.nav.rent}
          aria-label="Под наем"
          onClick={() => go("/properties?deal=rent")}
        />
        <button
          className="hit"
          style={G.nav.about}
          aria-label="За нас"
          onClick={() => go("/about")}
        />
        <button
          className="hit"
          style={G.nav.contacts}
          aria-label="Контакти"
          onClick={() => go("/contacts")}
        />
        <button
          className="hit"
          style={G.nav.account}
          aria-label="Потребителски профил"
          onClick={() => go("/account")}
        />
      </nav>
    </>
  );
}
