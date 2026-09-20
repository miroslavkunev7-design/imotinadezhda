// Адаптация за роутера на проекта: пътищата се отварят реално през TanStack Router.
// Логиката на компонентите остава непроменена — извиква се същият go(path).

// Преобразува пътищата от заключения макет към реалните route-ове на сайта.
function translate(path) {
  const [rawPath, rawQuery = ""] = String(path).split("?");

  if (rawPath === "/account") return "/login";
  if (rawPath !== "/properties") return path;

  const src = new URLSearchParams(rawQuery);
  const out = new URLSearchParams();

  const deal = src.get("deal");
  if (deal === "sale" || deal === "rent") out.set("status", deal);

  // "city" може да е само град ("shumen") или град:квартал ("shumen:tsentar")
  const city = src.get("city");
  if (city) {
    const [citySlug, quarterSlug] = city.split(":");
    if (citySlug) out.set("city_slug", citySlug);
    if (quarterSlug) out.set("quarter_slug", quarterSlug);
  }

  const type = src.get("type");
  // DB enum използва "land", а старите връзки ползват "plot"
  if (type) out.set("property_type", type === "plot" ? "land" : type);

  const range = (value, minKey, maxKey) => {
    if (!value) return;
    const [min, max] = value.split("-");
    if (min && min !== "0") out.set(minKey, min);
    if (max && max !== "plus") out.set(maxKey, max);
  };
  range(src.get("price"), "price_min", "price_max");
  range(src.get("area"), "area_min", "area_max");

  const query = out.toString();
  return "/search" + (query ? "?" + query : "");
}

export function go(path) {
  const target = translate(path);
  const nav = typeof window !== "undefined" ? window.__lockedHomeNavigate : null;
  if (typeof nav === "function") {
    nav(target);
    return;
  }
  history.pushState({}, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function currentPath() {
  return location.pathname + location.search;
}
