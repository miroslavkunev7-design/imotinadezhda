/* Apply optional CMS overrides from /api/cms. If none (or fetch fails), keep hardcoded UI. */
(function () {
  "use strict";
  var SLUG = document.documentElement.getAttribute("data-cms-slug") ||
    (location.pathname.indexOf("/bank") === 0 ? "/bank/" :
      (location.pathname.indexOf("/mobile") === 0 ? "/mobile/" : "/"));

  function applyComponent(c) {
    if (!c || !c.props) return;
    var p = c.props;
    if (c.type === "color" || c.component_key === "theme.wine") {
      var cssVar = p.cssVar || "--wine";
      var value = p.value;
      if (value) {
        try { document.documentElement.style.setProperty(cssVar, value); } catch (e) {}
        if (cssVar === "--wine") {
          try { document.documentElement.style.setProperty("--wine-d", shade(value, -0.18)); } catch (e2) {}
        }
      }
    }
    if (c.type === "section_height" && p.selector && p.height) {
      var nodes = document.querySelectorAll(p.selector);
      for (var i = 0; i < nodes.length; i++) nodes[i].style.minHeight = p.height;
    }
    if ((c.type === "image" || c.type === "melt") && p.selector && p.url) {
      var els = document.querySelectorAll(p.selector);
      for (var j = 0; j < els.length; j++) {
        if (els[j].tagName === "IMG") els[j].src = p.url;
        else els[j].style.backgroundImage = "url(" + JSON.stringify(p.url).slice(1, -1) + ")";
      }
    }
    if (c.type === "shape" && p.selector && p.radius != null) {
      var sh = document.querySelectorAll(p.selector);
      for (var k = 0; k < sh.length; k++) sh[k].style.borderRadius = p.radius;
    }
  }

  function shade(hex, amt) {
    hex = String(hex).replace("#", "");
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var num = parseInt(hex, 16);
    if (!isFinite(num)) return "#" + hex;
    var r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    r = Math.max(0, Math.min(255, Math.round(r * (1 + amt))));
    g = Math.max(0, Math.min(255, Math.round(g * (1 + amt))));
    b = Math.max(0, Math.min(255, Math.round(b * (1 + amt))));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function run() {
    var bust = "";
    try { bust = sessionStorage.getItem("cms-bust") || ""; } catch (e) {}
    var q = "/api/cms?action=page&slug=" + encodeURIComponent(SLUG) + (bust ? "&_=" + encodeURIComponent(bust) : "");
    fetch(q, { credentials: "omit", cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok || !j.components || !j.components.length) return;
        j.components.forEach(applyComponent);
        try { window.dispatchEvent(new CustomEvent("cms-overrides-applied", { detail: j })); } catch (e2) {}
      })
      .catch(function () { /* keep default UI */ });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
