// SVG charts/diagrams that the model draws into Canvas, shown read-only in „Преглед“ (docs/CONTRACT.md §16).
// Whitelist re-serializer, no DOM needed: only known drawing elements and attributes survive; everything else
// (script, style, foreignObject, image, links, animation, event handlers, external or data: references) is
// dropped together with its content. The result is shown as <img src="data:image/svg+xml;base64,…">, where an
// SVG never runs script or loads anything – the sanitising is a second wall, not the only one.

const MAX_IN = 400000;

// Drawing elements that cannot run code or fetch anything by themselves.
const ELEMENTS = new Set([
  "svg", "g", "defs", "title", "desc", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan",
  "lineargradient", "radialgradient", "stop", "clippath", "mask", "pattern", "marker", "symbol", "use",
  "filter", "fegaussianblur", "feoffset", "feblend", "fecolormatrix", "femerge", "femergenode", "feflood", "fecomposite", "fedropshadow",
]);
// Canonical (case-sensitive) SVG names for the camelCase elements.
const CANON = { lineargradient: "linearGradient", radialgradient: "radialGradient", clippath: "clipPath", fegaussianblur: "feGaussianBlur", feoffset: "feOffset", feblend: "feBlend", fecolormatrix: "feColorMatrix", femerge: "feMerge", femergenode: "feMergeNode", feflood: "feFlood", fecomposite: "feComposite", fedropshadow: "feDropShadow" };

const ATTRS = new Set([
  "id", "class", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "dx", "dy", "width", "height", "d", "points",
  "transform", "viewbox", "preserveaspectratio", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap",
  "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "stroke-miterlimit", "opacity", "clip-rule", "clip-path", "mask",
  "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline", "alignment-baseline", "letter-spacing",
  "word-spacing", "text-decoration", "rotate", "textlength", "lengthadjust", "offset", "stop-color", "stop-opacity", "gradientunits",
  "gradienttransform", "spreadmethod", "patternunits", "patterncontentunits", "patterntransform", "clippathunits", "maskunits", "maskcontentunits",
  "marker-start", "marker-mid", "marker-end", "markerwidth", "markerheight", "markerunits", "refx", "refy", "orient", "vector-effect",
  "filter", "filterunits", "stddeviation", "in", "in2", "result", "mode", "values", "type", "flood-color", "flood-opacity", "operator",
  "k1", "k2", "k3", "k4", "xmlns", "version", "visibility", "display", "shape-rendering", "text-rendering", "paint-order",
]);
const CANON_ATTR = { viewbox: "viewBox", preserveaspectratio: "preserveAspectRatio", textlength: "textLength", lengthadjust: "lengthAdjust", gradientunits: "gradientUnits", gradienttransform: "gradientTransform", spreadmethod: "spreadMethod", patternunits: "patternUnits", patterncontentunits: "patternContentUnits", patterntransform: "patternTransform", clippathunits: "clipPathUnits", maskunits: "maskUnits", maskcontentunits: "maskContentUnits", markerwidth: "markerWidth", markerheight: "markerHeight", markerunits: "markerUnits", refx: "refX", refy: "refY", filterunits: "filterUnits", stddeviation: "stdDeviation" };
const VOID_OK = /^#[A-Za-z_][\w.-]{0,80}$/; // href of <use>: only a fragment inside this SVG

const decode = (s) => String(s)
  .replace(/&#x([0-9a-f]{1,6});/gi, (_, h) => { const n = parseInt(h, 16); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; })
  .replace(/&#(\d{1,7});/g, (_, d) => { const n = Number(d); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; })
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A value is kept only if it cannot reach outside the SVG or carry code.
function safeValue(name, raw) {
  const v = decode(raw).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
  const flat = v.replace(/\s+/g, "").toLowerCase();
  if (/javascript:|vbscript:|data:|expression\(|@import|<|>/.test(flat)) return null;
  // url(…) only as a reference to an element of this SVG: url(#id)
  const urls = flat.match(/url\(([^)]*)\)/g) || [];
  if (urls.some((u) => !/^url\(['"]?#[a-z_][\w.-]*['"]?\)$/.test(u))) return null;
  if (v.length > 20000) return null;
  if (name === "xmlns" && v !== "http://www.w3.org/2000/svg") return null;
  return v;
}

function parseAttrs(src) {
  const out = [];
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
  let m;
  while ((m = re.exec(src))) out.push([m[1], m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] != null ? m[4] : ""]);
  return out;
}

// -> the cleaned SVG markup, or null when there is no <svg> root or nothing drawable is left.
export function safeSvg(text) {
  const src = String(text == null ? "" : text).slice(0, MAX_IN);
  const start = src.search(/<svg[\s>]/i);
  if (start < 0) return null;
  const body = src.slice(start);
  // Comments, CDATA, processing instructions and doctypes go first (they may hide markup).
  const clean = body.replace(/<!--[\s\S]*?(-->|$)/g, "").replace(/<!\[CDATA\[[\s\S]*?(\]\]>|$)/g, "").replace(/<\?[\s\S]*?(\?>|$)/g, "").replace(/<!(?!--)[^>]*>/g, "");
  const tokens = /<\/?([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|(<)/g;
  const out = [];
  const stack = [];     // open kept elements
  let skip = 0;         // depth inside a dropped element
  let drawn = 0;
  let rootClosed = false;
  let m;
  while (!rootClosed && (m = tokens.exec(clean))) {
    if (m[3] != null || m[4] != null) { // text
      if (skip || !stack.length) continue;
      const parent = stack[stack.length - 1];
      if (["text", "tspan", "title", "desc"].includes(parent)) out.push(m[3] != null ? esc(decode(m[3])) : "&lt;");
      continue;
    }
    const raw = m[0];
    const name = m[1].toLowerCase();
    const closing = raw.startsWith("</");
    const selfClose = /\/\s*>$/.test(raw);
    if (closing) {
      if (skip) { if (name === stack.skipName) { skip--; if (!skip) stack.skipName = null; } continue; }
      const i = stack.lastIndexOf(name);
      if (i < 0) continue;
      while (stack.length > i) { const el = stack.pop(); out.push("</" + (CANON[el] || el) + ">"); }
      if (!stack.length) rootClosed = true;
      continue;
    }
    if (skip) { if (name === stack.skipName && !selfClose) skip++; continue; }
    if (!stack.length && name !== "svg") continue;
    if (!ELEMENTS.has(name)) {
      if (!selfClose) { skip = 1; stack.skipName = name; }
      continue;
    }
    const attrs = [];
    let useOk = name !== "use";
    for (const [an, av] of parseAttrs(m[2] || "")) {
      const low = an.toLowerCase();
      if (low === "href" || low === "xlink:href") {
        if (name === "use" && VOID_OK.test(decode(av).trim())) { attrs.push('href="' + esc(decode(av).trim()) + '"'); useOk = true; }
        continue;
      }
      if (!ATTRS.has(low) || low.startsWith("on")) continue;
      const val = safeValue(low, av);
      if (val == null) continue;
      attrs.push((CANON_ATTR[low] || low) + '="' + esc(val) + '"');
    }
    if (!useOk) continue; // <use> without an internal reference draws nothing
    if (!stack.length && !attrs.some((a) => a.startsWith("xmlns="))) attrs.unshift('xmlns="http://www.w3.org/2000/svg"');
    if (name !== "svg" && !["defs", "title", "desc", "stop", "lineargradient", "radialgradient", "clippath", "mask", "pattern", "marker", "symbol", "filter"].includes(name) && !name.startsWith("fe")) drawn++;
    const tag = CANON[name] || name;
    if (selfClose) out.push("<" + tag + (attrs.length ? " " + attrs.join(" ") : "") + "/>");
    else { out.push("<" + tag + (attrs.length ? " " + attrs.join(" ") : "") + ">"); stack.push(name); }
  }
  while (stack.length) { const el = stack.pop(); out.push("</" + (CANON[el] || el) + ">"); }
  if (!out.length || !drawn) return null;
  return out.join("");
}

// data: URL for <img src>. UTF-8 safe (Cyrillic labels).
export function svgDataUrl(svg) {
  const bytes = new TextEncoder().encode(String(svg));
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return "data:image/svg+xml;base64," + btoa(bin);
}

// Splits a canvas text into Markdown parts and SVG drawings: ```svg fences and bare <svg>…</svg> blocks.
export function splitSvg(text) {
  const src = String(text || "");
  const re = /```svg[^\n]*\n([\s\S]*?)```|(<svg[\s>][\s\S]*?<\/svg>)/gi;
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m.index > last) parts.push({ type: "md", text: src.slice(last, m.index) });
    parts.push({ type: "svg", text: m[1] != null ? m[1] : m[2] });
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ type: "md", text: src.slice(last) });
  return parts.filter((p) => p.type === "svg" || p.text.trim());
}
