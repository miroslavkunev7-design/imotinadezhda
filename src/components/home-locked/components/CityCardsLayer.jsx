import { UI_GEOMETRY as G } from "../data/uiGeometry";
import { go } from "../lib/router";
export default function CityCardsLayer() {
  return (
    <section aria-label="Избери град">
      <button
        className="hit"
        style={G.bottomCityCtas.shumen}
        aria-label="Разгледай Шумен"
        onClick={() => go("/properties?city=shumen")}
      />
      <button
        className="hit"
        style={G.bottomCityCtas.varna}
        aria-label="Разгледай Варна"
        onClick={() => go("/properties?city=varna")}
      />
      <button
        className="hit"
        style={G.bottomCityCtas.burgas}
        aria-label="Разгледай Бургас"
        onClick={() => go("/properties?city=burgas")}
      />
    </section>
  );
}
