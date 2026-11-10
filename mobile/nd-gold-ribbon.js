/* Shared mobile gold ribbon — homepage header-shape.svg paint on every mobile header. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var GRAD =
    '<linearGradient id="nd-gold" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">' +
    '<stop stop-color="#9e5606"/>' +
    '<stop offset=".18" stop-color="#ffcf55"/>' +
    '<stop offset=".38" stop-color="#a55e09"/>' +
    '<stop offset=".59" stop-color="#fff0a0"/>' +
    '<stop offset=".78" stop-color="#efaa21"/>' +
    '<stop offset="1" stop-color="#8e4700"/>' +
    "</linearGradient>";

  function ensureGold(svg) {
    var defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(NS, "defs");
      svg.insertBefore(defs, svg.firstChild);
    }
    if (!defs.querySelector("#nd-gold")) defs.insertAdjacentHTML("afterbegin", GRAD);
    svg.classList.add("nd-gold-ribbon");
  }

  function shineFor(path) {
    var next = path.nextElementSibling;
    if (next && next.classList && next.classList.contains("nd-gold-shine")) return;
    var shine = path.cloneNode();
    shine.removeAttribute("fill");
    shine.removeAttribute("stroke-width");
    shine.removeAttribute("stroke");
    shine.removeAttribute("style");
    shine.setAttribute("fill", "none");
    shine.setAttribute("class", "nd-gold-shine");
    path.parentNode.insertBefore(shine, path.nextSibling);
  }

  function markStroke(path) {
    if (path.classList.contains("nd-gold-stroke")) {
      shineFor(path);
      return;
    }
    path.setAttribute("stroke", "url(#nd-gold)");
    path.classList.add("nd-gold-stroke");
    shineFor(path);
  }

  function isGoldStroke(path) {
    if (path.classList.contains("nd-gold-shine")) return false;
    if (path.classList.contains("nd-gold-stroke")) return true;
    var fill = (path.getAttribute("fill") || "").toLowerCase();
    if (fill && fill !== "none") return false;
    var s = path.getAttribute("stroke") || "";
    return s === "url(#gold)" || s === "url(#ribbon)" || s === "url(#header-gold)" || s === "url(#premium-gold)";
  }

  function upgradeSvg(svg) {
    if (!svg || svg.nodeType !== 1) return;
    if (svg.getAttribute("data-nd-gold") === "1") return;
    ensureGold(svg);
    var paths = svg.querySelectorAll("path");
    for (var i = 0; i < paths.length; i++) {
      if (isGoldStroke(paths[i])) markStroke(paths[i]);
    }
    svg.setAttribute("data-nd-gold", "1");
  }

  function run() {
    var list = document.querySelectorAll(
      "svg.swoosh, svg.brand-curve, svg.premium-header-curve, .reference-header svg, svg.nd-gold-ribbon"
    );
    for (var i = 0; i < list.length; i++) upgradeSvg(list[i]);
  }

  var t = 0;
  function schedule() {
    if (t) return;
    t = setTimeout(function () {
      t = 0;
      run();
    }, 40);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  if (window.MutationObserver) {
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
