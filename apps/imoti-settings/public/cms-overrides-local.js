/* Apply optional CMS overrides from /api/cms (or Supabase REST fallback).
   Also listens for Settings live postMessage / __imotiCmsApply inject. */
(function () {
  "use strict";
  var SLUG = document.documentElement.getAttribute("data-cms-slug") ||
    (location.pathname.indexOf("/bank") === 0 ? "/bank/" :
      (location.pathname.indexOf("/mobile") === 0 ? "/mobile/" : "/"));

  var SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
  var SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
  var STYLE_ID = "imoti-cms-live-style";

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

  function ensureStyle() {
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.documentElement.appendChild(style);
    }
    return style;
  }

  function applyComponent(c, rules) {
    if (!c || !c.props) return;
    var p = c.props;
    if (c.type === "color" || c.component_key === "theme.wine" || (p.cssVar && p.value)) {
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
      rules.push(p.selector + "{min-height:" + p.height + " !important;}");
      var nodes = document.querySelectorAll(p.selector);
      for (var i = 0; i < nodes.length; i++) nodes[i].style.minHeight = p.height;
    }
    if (c.type === "size" && p.selector) {
      var bits = [];
      if (p.width) bits.push("width:" + p.width);
      if (p.height) bits.push("min-height:" + p.height);
      if (p.padding) bits.push("padding:" + p.padding);
      if (p.scale) bits.push("transform:scale(" + p.scale + ");transform-origin:top left");
      if (bits.length) rules.push(p.selector + "{" + bits.join(";") + " !important;}");
    }
    if ((c.type === "image" || c.type === "melt") && p.selector && p.url) {
      var els = document.querySelectorAll(p.selector);
      for (var j = 0; j < els.length; j++) {
        if (els[j].tagName === "IMG") els[j].src = p.url;
        else {
          els[j].style.backgroundImage = "url(" + JSON.stringify(p.url).slice(1, -1) + ")";
          els[j].style.backgroundSize = p.fit || "cover";
        }
      }
    }
    if ((c.type === "melt" || p.melt) && p.selector) {
      var intensity = Number(p.intensity != null ? p.intensity : 0.65);
      var meltEls = document.querySelectorAll(p.selector);
      for (var m = 0; m < meltEls.length; m++) {
        meltEls[m].style.opacity = String(Math.max(0.15, Math.min(1, intensity)));
        if (p.mode === "vignette") meltEls[m].style.boxShadow = "inset 0 0 80px rgba(40,0,10," + intensity + ")";
        if (p.blend) meltEls[m].style.mixBlendMode = String(p.blend);
      }
    }
    if (c.type === "shape" && p.selector && p.radius != null) {
      rules.push(p.selector + "{border-radius:" + p.radius + " !important;}");
      var sh = document.querySelectorAll(p.selector);
      for (var k = 0; k < sh.length; k++) sh[k].style.borderRadius = p.radius;
    }
    if (c.type === "graphics" && p.selector) {
      rules.push(p.selector + "{color:" + (p.color || "#c9922e") + ";width:" + (p.size || "44px") + ";height:" + (p.size || "44px") + ";}");
    }
    if (c.type === "dropdown" && p.selector && Array.isArray(p.items) && p.items.length) {
      var host = document.querySelector(p.selector);
      if (host && !host.getAttribute("data-cms-dropdown")) {
        host.setAttribute("data-cms-dropdown", "1");
        p.items.forEach(function (item) {
          var a = document.createElement("a");
          a.href = "#";
          a.textContent = item.label || "";
          a.setAttribute("data-cms-target", item.target || "");
          host.appendChild(a);
        });
      }
    }
  }

  function applyAll(components, highlightKey) {
    var rules = [];
    (components || []).forEach(function (c) { applyComponent(c, rules); });
    var outline = "";
    if (highlightKey) {
      var hl = (components || []).find(function (x) { return x.component_key === highlightKey; });
      if (hl && hl.props && hl.props.selector) {
        outline = String(hl.props.selector) + "{outline:3px solid #f0d4a0 !important;outline-offset:4px !important;box-shadow:0 0 0 4px rgba(201,146,46,.35)!important;}";
        try {
          var first = document.querySelector(String(hl.props.selector));
          if (first && first.scrollIntoView) first.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (e) {}
      }
    }
    ensureStyle().textContent = rules.join("\n") + "\n" + outline;
    try { window.dispatchEvent(new CustomEvent("cms-overrides-applied", { detail: { components: components, highlightKey: highlightKey } })); } catch (e2) {}
  }

  window.__imotiCmsNativeApply = applyAll;
  window.__imotiCmsApply = function (list, highlightKey) { applyAll(list, highlightKey); };

  window.addEventListener("message", function (ev) {
    var d = ev && ev.data;
    if (!d || d.source !== "imoti-settings" || d.type !== "cms-apply") return;
    applyAll(d.components || [], d.highlightKey || null);
  });

  function fetchFromApi() {
    var bust = "";
    try { bust = sessionStorage.getItem("cms-bust") || ""; } catch (e) {}
    var q = "/api/cms?action=page&slug=" + encodeURIComponent(SLUG) + (bust ? "&_=" + encodeURIComponent(bust) : "");
    return fetch(q, { credentials: "omit", cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("cms api " + r.status);
        return r.json();
      });
  }

  function fetchFromSupabase() {
    var headers = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY };
    return fetch(SB_URL + "/rest/v1/cms_pages?slug=eq." + encodeURIComponent(SLUG) + "&select=*", { headers: headers, cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (pages) {
        var page = Array.isArray(pages) && pages[0] ? pages[0] : null;
        if (!page) return { ok: true, components: [] };
        return fetch(SB_URL + "/rest/v1/cms_components?page_id=eq." + encodeURIComponent(page.id) + "&select=*&order=sort_order.asc", { headers: headers, cache: "no-store" })
          .then(function (r2) { return r2.json(); })
          .then(function (components) { return { ok: true, page: page, components: components || [] }; });
      });
  }

  function run() {
    fetchFromApi()
      .catch(function () { return fetchFromSupabase(); })
      .then(function (j) {
        if (!j || !j.ok || !j.components || !j.components.length) return;
        applyAll(j.components, null);
      })
      .catch(function () { /* keep default UI */ });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
