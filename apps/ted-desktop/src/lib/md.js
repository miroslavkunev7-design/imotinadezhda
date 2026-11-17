// Markdown like ChatGPT (GFM subset) as a plain tree – no HTML is ever produced or accepted (docs/CONTRACT.md §16
// „Markdown“). src/components/Md.jsx turns the tree into React elements. Pure functions, unit-tested.
//
// Blocks: paragraphs (single newlines are line breaks), # … #### headings, ``` / ~~~ code, > quotes (nested Markdown),
//   bullet / numbered / nested / task lists, GFM tables (alignment, inline Markdown in cells), --- rules,
//   a paragraph of images only = a gallery.
// Inline: `code`, **bold** / __bold__, *italic* / _italic_, ~~strike~~, [text](https://… "title"), <https://…>,
//   bare https:// addresses (= source chips), ![alt](https://… | file:<id>) images, \-escapes.
// Links: only https: and mailto: are links; an http: link keeps its text and shows the address as plain text.

const SAFE_HREF = /^(https:\/\/|mailto:)/i;
const MAX_TEXT = 400_000;
const MAX_DEPTH = 6;

export const safeHref = (href) => typeof href === "string" && SAFE_HREF.test(href) && !/[\s<>"]/.test(href) && href.length <= 4096;
// Domain shown on a source chip: the host without „www.“ (mailto: → the address).
export function domainOf(href) {
  const s = String(href || "");
  if (/^mailto:/i.test(s)) return s.slice(7).split("?")[0];
  try { return new URL(s).hostname.replace(/^www\./i, ""); } catch { return s.replace(/^[a-z]+:\/\//i, "").split(/[/?#]/)[0]; }
}

/* ============================== inline ============================== */
const PUNCT = /[!-/:-@[-`{-~]/;
const isSpace = (c) => c === undefined || /\s/.test(c);
const isAlnum = (c) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
const TRAIL_CH = /[.,;:!?…»“”"'’\]}*_~]/;
const count = (s, ch) => s.split(ch).length - 1;

// A bare https address from position i: sentence punctuation after it is not part of it; a ")" stays only when it
// closes a "(" of the address itself (Wikipedia-style links).
export function bareUrl(s, i = 0) {
  const m = /^https:\/\/[^\s<>"'`„“”«»|]+/i.exec(String(s).slice(i, i + 4100));
  if (!m) return null;
  let u = m[0];
  while (u.length > 8) {
    const last = u[u.length - 1];
    if (last === ")" && count(u, ")") > count(u, "(")) { u = u.slice(0, -1); continue; }
    if (TRAIL_CH.test(last)) { u = u.slice(0, -1); continue; }
    break;
  }
  return u.length > 8 ? u : null;
}

// Matching closing bracket for every "[" of a string (escapes and code spans skipped), found in ONE pass with a stack
// (0.1.5 review F2: the old per-opener rescan was quadratic on "[[[[…"). Unmatched openers map to -1.
function bracketPairs(s) {
  const pairs = new Map();
  const stack = [];
  for (let j = 0; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") { j++; continue; }
    if (c === "`") { const k = s.indexOf("`", j + 1); if (k > 0) { j = k; continue; } }
    if (c === "[") stack.push(j);
    else if (c === "]" && stack.length) pairs.set(stack.pop(), j);
  }
  return pairs;
}

// Lazy one-pass indexes of a string (review F2: every lookup below is O(1) after one O(n) pass, so a wall of
// "[a](b[a](b…" or "[a](<…" cannot make the parser quadratic).
function nextIndex(s, test) {
  const a = new Int32Array(s.length + 1);
  let nx = -1;
  a[s.length] = -1;
  for (let k = s.length - 1; k >= 0; k--) { if (test(s[k])) nx = k; a[k] = nx; }
  return a;
}
function parenPairs(s) {
  const pairs = new Map();
  const stack = [];
  for (let j = 0; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") { j++; continue; }
    if (c === "(") stack.push(j);
    else if (c === ")" && stack.length) pairs.set(stack.pop(), j);
  }
  return pairs;
}
function indexes(s) {
  const memo = {};
  const get = (k, f) => (memo[k] || (memo[k] = f()));
  return {
    ws: () => get("ws", () => nextIndex(s, (c) => /\s/.test(c))),
    ch: (ch) => get("c" + ch, () => nextIndex(s, (c) => c === ch)),
    paren: () => get("p", () => parenPairs(s)),
  };
}

// "(dest "title")" right at position i -> {href, title, end} | null. A destination longer than a link may be
// (4096) is not one.
const DEST_MAX = 4200;
function destination(s, i, X) {
  if (s[i] !== "(") return null;
  let j = i + 1;
  while (s[j] === " ") j++;
  let href = "";
  if (s[j] === "<") {
    const k = X.ch(">")[j];
    if (k < 0 || k - j > DEST_MAX) return null;
    href = s.slice(j + 1, k); j = k + 1;
  } else {
    // The address ends at the first whitespace or at the ")" that closes this "(" (nested pairs allowed).
    const st = j;
    const w = X.ws()[st];
    const close = X.paren().has(i) ? X.paren().get(i) : -1;
    const end = w < 0 ? close : close < 0 ? w : Math.min(w, close);
    if (end < 0 || end - st > DEST_MAX) return null;
    j = end;
    href = s.slice(st, j);
  }
  while (s[j] === " ") j++;
  let title = "";
  if (s[j] === '"' || s[j] === "'") {
    const q = s[j];
    const k = X.ch(q)[j + 1];
    if (k < 0 || k - j > DEST_MAX) return null;
    title = s.slice(j + 1, k); j = k + 1;
    while (s[j] === " ") j++;
  }
  if (s[j] !== ")") return null;
  return { href: href.replace(/\\([()])/g, "$1"), title, end: j + 1 };
}

// Closing delimiter `d` for an emphasis opened at i (content non-empty, no space next to the delimiters).
// `miss` (per string): the first position from which a full scan for `d` found no closer – a later opener of the
// same delimiter cannot find one either, so it is not scanned again (review F2: "*a *a *a…" was quadratic).
function closeDelim(s, i, d, miss) {
  const from = i + d.length;
  if (isSpace(s[from])) return -1;
  if (miss && miss.has(d) && i >= miss.get(d)) return -1;
  const r = scanDelim(s, from, d);
  if (r < 0 && miss) miss.set(d, Math.min(i, miss.has(d) ? miss.get(d) : Infinity));
  return r;
}
function scanDelim(s, from, d) {
  for (let j = from + 1; j <= s.length - d.length; j++) {
    const c = s[j];
    if (c === "\\") { j++; continue; }
    if (c === "`") { const k = s.indexOf("`", j + 1); if (k > 0) { j = k; continue; } }
    if (s.startsWith(d, j) && !isSpace(s[j - 1])) {
      if (d === "*" && (s[j + 1] === "*" || s[j - 1] === "*")) continue;
      if (d === "_" && isAlnum(s[j + 1])) continue;
      return j;
    }
  }
  return -1;
}

// Does a link text read like an address („olx.bg“, „www.olx.bg/d/…“, „https://…“, „office@x.bg“)? Such a text
// is never shown for a link: the employee would read it as the destination.
const HOSTISH = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^\s@/]+@)?(?:[\p{L}\p{N}_-]+\.)+\p{L}[\p{L}\p{N}-]*\.?(?::\d+)?(?:[/?#]\S*)?$/iu;
export function looksLikeAddress(text) {
  const t = String(text || "").trim().replace(/[›»]$/, "").trim();
  if (!t || /\s/.test(t) || t.length > 2048) return false;
  return HOSTISH.test(t) || /^mailto:/i.test(t);
}

const plainOf = (nodes) => nodes.map((n) => (n.t === "text" ? n.v : n.t === "code" ? n.v : n.c ? plainOf(n.c) : n.label || "")).join("");

// One inline run longer than this (a line, a table cell) is shown as plain text: no answer needs it, and it bounds
// the work of a prompt-injected wall of delimiters (review F2).
const INLINE_MAX = 20_000;

export function parseInline(src, depth = 0, noLinks = false) {
  const s = String(src == null ? "" : src);
  if (s.length > INLINE_MAX) return [{ t: "text", v: s }];
  const out = [];
  const miss = new Map();
  let pairs = null;
  const closeBracket = (str, i) => { if (!pairs) pairs = bracketPairs(str); return pairs.has(i) ? pairs.get(i) : -1; };
  const X = indexes(s);
  let buf = "";
  const flush = () => { if (buf) { out.push({ t: "text", v: buf }); buf = ""; } };
  const push = (n) => { flush(); out.push(n); };
  const deeper = (x, nl = noLinks) => (depth >= MAX_DEPTH ? [{ t: "text", v: x }] : parseInline(x, depth + 1, nl));
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === "\\" && PUNCT.test(s[i + 1] || "")) { buf += s[i + 1]; i += 2; continue; }
    if (c === "`") {
      let n = 1; while (s[i + n] === "`") n++;
      const fence = "`".repeat(n);
      let k = miss.has("`" + n) && i >= miss.get("`" + n) ? -1 : s.indexOf(fence, i + n);
      while (k > 0 && s[k + n] === "`") k = s.indexOf(fence, k + n + 1);
      if (k > 0) { push({ t: "code", v: s.slice(i + n, k).replace(/^ (.+) $/, "$1") }); i = k + n; continue; }
      if (!miss.has("`" + n)) miss.set("`" + n, i);
      buf += fence; i += n; continue;
    }
    if (c === "!" && s[i + 1] === "[") {
      const e = closeBracket(s, i + 1);
      const d = e > 0 ? destination(s, e + 1, X) : null;
      if (d) {
        const alt = s.slice(i + 2, e).replace(/\\(.)/g, "$1");
        if (/^https:\/\//i.test(d.href) && safeHref(d.href)) push({ t: "img", src: d.href, alt });
        else if (/^file:[a-z0-9_-]{8,64}$/.test(d.href)) push({ t: "img", src: d.href, alt });
        else push({ t: "text", v: alt ? "[снимка: " + alt + "]" : "[снимка]" });
        i = d.end; continue;
      }
    }
    if (c === "[" && !noLinks) {
      const e = closeBracket(s, i);
      const d = e > 0 ? destination(s, e + 1, X) : null;
      if (d) {
        const label = s.slice(i + 1, e);
        const kids = deeper(label, true);
        const text = plainOf(kids).trim();
        if (safeHref(d.href)) {
          const dom = domainOf(d.href);
          const norm = text.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
          // Link text can never hide where a link goes (0.1.5 review F1): a text that looks like an address or a domain
          // („olx.bg“, „https://www.olx.bg/…“, a look-alike „оlx.bg“) is replaced by the REAL domain chip; any other
          // text keeps its words and always shows the real domain next to them (ChatGPT-style citation), and the hover
          // title is always the real address (a model-supplied "title" is ignored).
          if (!text || norm === dom.toLowerCase() || text === d.href || looksLikeAddress(text)) push({ t: "chip", href: d.href, label: dom });
          else push({ t: "a", href: d.href, title: d.href, dom, c: kids });
        } else if (/^http:\/\//i.test(d.href)) push({ t: "nolink", href: d.href.slice(0, 300), c: kids });
        else push({ t: "text", v: text || label });
        i = d.end; continue;
      }
    }
    if (c === "<" && /^<(https:\/\/|mailto:)[^\s<>]+>/i.test(s.slice(i, i + 4100))) {
      const k = s.indexOf(">", i);
      const href = s.slice(i + 1, k);
      if (safeHref(href) && !noLinks) { push({ t: "chip", href, label: domainOf(href) }); i = k + 1; continue; }
    }
    if ((c === "h" || c === "H") && !isAlnum(s[i - 1]) && /^https:\/\//i.test(s.slice(i, i + 8))) {
      const u = bareUrl(s, i);
      if (u && !noLinks && safeHref(u)) { push({ t: "chip", href: u, label: domainOf(u) }); i += u.length; continue; }
      if (u) { buf += u; i += u.length; continue; }
    }
    if (c === "*" || c === "_" || c === "~") {
      const d3 = s.slice(i, i + 3), d2 = s.slice(i, i + 2);
      const leftOk = c !== "_" || !isAlnum(s[i - 1]);
      if (leftOk && (d3 === "***" || d3 === "___")) {
        const k = closeDelim(s, i, d3, miss);
        if (k > 0) { push({ t: "b", c: [{ t: "i", c: deeper(s.slice(i + 3, k)) }] }); i = k + 3; continue; }
      }
      if (leftOk && (d2 === "**" || d2 === "__" || d2 === "~~")) {
        const k = closeDelim(s, i, d2, miss);
        if (k > 0) { push({ t: d2 === "~~" ? "s" : "b", c: deeper(s.slice(i + 2, k)) }); i = k + 2; continue; }
      }
      if (leftOk && c !== "~" && d2 !== "**" && d2 !== "__") {
        const k = closeDelim(s, i, c, miss);
        if (k > 0) { push({ t: "i", c: deeper(s.slice(i + 1, k)) }); i = k + 1; continue; }
      }
      // A run of the same delimiter that opens nothing stays literal.
      let n = 1; while (s[i + n] === c) n++;
      buf += s.slice(i, i + n); i += n; continue;
    }
    buf += c; i++;
  }
  flush();
  return out;
}

/* ============================== blocks ============================== */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})[ \t]*([^`\s]*)[^`]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*#*[ \t]*$/;
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}> ?/;
const ITEM = /^( *)([-*+•]|\d{1,9}[.)])(?:([ \t]+)(.*))?$/;
const DELIM_CELL = /^\s*:?-+:?\s*$/;

const indentOf = (l) => /^ */.exec(l)[0].length;
const blank = (l) => !l || !l.trim();
const expandTabs = (l) => l.replace(/^\t+/, (t) => "    ".repeat(t.length));

// Table cells: split on | outside code spans and escapes; \| is a literal pipe.
export function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "", code = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "|") { cur += "|"; i++; continue; }
    if (c === "`") code = !code;
    if (c === "|" && !code) { cells.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}
const isDelimRow = (l) => typeof l === "string" && l.includes("-") && /^[\s|:-]+$/.test(l) && splitRow(l).every((c) => DELIM_CELL.test(c));
const tableStart = (lines, i) => lines[i].includes("|") && isDelimRow(lines[i + 1]) && splitRow(lines[i]).length >= 1 && (splitRow(lines[i + 1]).length > 1 || /\|/.test(lines[i + 1]));

function itemOf(line) {
  const m = ITEM.exec(line);
  if (!m) return null;
  if (m[3] === undefined && m[4] === undefined && line.trim().length !== m[2].length) return null;
  return { indent: m[1].length, marker: m[2], ordered: /\d/.test(m[2]), num: /\d/.test(m[2]) ? parseInt(m[2], 10) : null, gap: m[3] ? m[3].length : 1, text: m[4] || "" };
}
// Does this line start a block that ends a paragraph? (A numbered item interrupts a paragraph only when it is 1.)
function startsBlock(lines, i) {
  const l = lines[i];
  if (FENCE_OPEN.test(l) || HEADING.test(l) || HR.test(l) || QUOTE.test(l)) return true;
  const it = itemOf(l);
  if (it && it.indent < 4 && it.text.trim() && (!it.ordered || it.num === 1)) return true;
  return i + 1 < lines.length && tableStart(lines, i);
}

function onlyImages(nodes) {
  let imgs = 0;
  for (const n of nodes) {
    if (n.t === "img") imgs++;
    else if (n.t === "br") continue;
    else if (n.t === "text" && !n.v.trim()) continue;
    else return false;
  }
  return imgs > 0;
}

function paragraph(lines, depth) {
  const c = [];
  lines.forEach((l, k) => {
    if (k) c.push({ t: "br" });
    c.push(...parseInline(l.trim(), depth));
  });
  if (onlyImages(c)) return { t: "gallery", c: c.filter((n) => n.t === "img") };
  return { t: "p", c };
}

function parseList(lines, i, depth) {
  const first = itemOf(lines[i]);
  const base = first.indent;
  const list = { t: "list", ordered: first.ordered, start: first.num || 1, items: [], loose: false };
  while (i < lines.length) {
    const it = itemOf(lines[i]);
    if (!it || it.indent !== base || it.ordered !== list.ordered) break;
    const content = base + it.marker.length + Math.min(4, it.gap);
    const body = [it.text];
    let sawBlank = false;
    i++;
    while (i < lines.length) {
      const l = lines[i];
      if (blank(l)) {
        let j = i + 1;
        while (j < lines.length && blank(lines[j])) j++;
        if (j < lines.length && indentOf(lines[j]) > base && !(itemOf(lines[j]) && itemOf(lines[j]).indent === base)) {
          for (let k = i; k < j; k++) body.push("");
          sawBlank = true; i = j; continue;
        }
        break;
      }
      const ind = indentOf(l);
      const sub = itemOf(l);
      if (ind > base && !(sub && sub.indent <= base)) { body.push(l.slice(Math.min(ind, content))); i++; continue; }
      if (sub && sub.indent <= base) break;
      // Lazy continuation of the item's paragraph (CommonMark): a plain line right after text.
      if (!blank(body[body.length - 1]) && !startsBlock(lines, i) && ind <= base) { body.push(l.trim()); i++; continue; }
      break;
    }
    let task = null;
    const tm = /^\[( |x|X)\][ \t]+/.exec(body[0]);
    if (tm) { task = tm[1] !== " "; body[0] = body[0].slice(tm[0].length); }
    const blocks = parseBlocks(body, depth + 1);
    list.items.push({ task, c: blocks, tight: !sawBlank });
    // Blank lines between items of the same list make it loose; anything else ends the list.
    let j = i;
    while (j < lines.length && blank(lines[j])) j++;
    if (j > i) {
      const nx = j < lines.length ? itemOf(lines[j]) : null;
      if (nx && nx.indent === base && nx.ordered === list.ordered) { list.loose = true; i = j; continue; }
      break;
    }
  }
  return { node: list, next: i };
}

export function parseBlocks(input, depth = 0) {
  const lines = (Array.isArray(input) ? input : String(input == null ? "" : input).slice(0, MAX_TEXT).replace(/\r\n?/g, "\n").split("\n")).map(expandTabs);
  const out = [];
  if (depth > MAX_DEPTH) { out.push({ t: "p", c: [{ t: "text", v: lines.join("\n") }] }); return out; }
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (blank(l)) { i++; continue; }
    const f = FENCE_OPEN.exec(l);
    if (f) {
      const ch = f[1][0], len = f[1].length;
      const code = [];
      i++;
      while (i < lines.length && !new RegExp("^ {0,3}" + (ch === "`" ? "`" : "~") + "{" + len + ",}[ \\t]*$").test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++; // the closing fence (a fence still open while streaming runs to the end)
      out.push({ t: "code", lang: (f[2] || "").slice(0, 30), code: code.join("\n") });
      continue;
    }
    const h = HEADING.exec(l);
    if (h) { out.push({ t: "h", level: Math.min(4, h[1].length), c: parseInline(h[2] || "", depth) }); i++; continue; }
    if (HR.test(l)) { out.push({ t: "hr" }); i++; continue; }
    if (i + 1 < lines.length && tableStart(lines, i)) {
      const head = splitRow(l);
      const align = splitRow(lines[i + 1]).map((c) => (/^\s*:-+:\s*$/.test(c) ? "center" : /^\s*-+:\s*$/.test(c) ? "right" : /^\s*:-+\s*$/.test(c) ? "left" : ""));
      const cols = Math.max(1, head.length);
      i += 2;
      const rows = [];
      while (i < lines.length && !blank(lines[i]) && lines[i].includes("|") && rows.length < 500) {
        const r = splitRow(lines[i]);
        rows.push(Array.from({ length: cols }, (_, k) => parseInline(r[k] || "", depth)));
        i++;
      }
      out.push({ t: "table", align: Array.from({ length: cols }, (_, k) => align[k] || ""), head: head.slice(0, cols).map((c) => parseInline(c, depth)), rows });
      continue;
    }
    if (QUOTE.test(l)) {
      const q = [];
      while (i < lines.length && QUOTE.test(lines[i])) q.push(lines[i++].replace(QUOTE, ""));
      out.push({ t: "quote", c: parseBlocks(q, depth + 1) });
      continue;
    }
    const it = itemOf(l);
    if (it && (it.text.trim() || (i + 1 < lines.length && indentOf(lines[i + 1]) > it.indent))) {
      const r = parseList(lines, i, depth);
      out.push(r.node); i = r.next;
      continue;
    }
    const para = [l];
    i++;
    while (i < lines.length && !blank(lines[i]) && !startsBlock(lines, i)) para.push(lines[i++]);
    out.push(paragraph(para, depth));
  }
  return out;
}

// Every image address of a tree (for tests and for preloading).
export function imagesOf(nodes, acc = []) {
  for (const n of Array.isArray(nodes) ? nodes : []) {
    if (!n || typeof n !== "object") continue;
    if (n.t === "img") acc.push(n.src);
    if (n.c) imagesOf(n.c, acc);
    if (n.items) n.items.forEach((it) => imagesOf(it.c, acc));
    if (n.head) n.head.forEach((c) => imagesOf(c, acc));
    if (n.rows) n.rows.forEach((r) => r.forEach((c) => imagesOf(c, acc)));
  }
  return acc;
}
