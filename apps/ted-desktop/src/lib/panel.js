// „ChatGPT панел“ (0.1.7, docs/CONTRACT.md §23) – the renderer's pure helpers. The page itself is MAIN's native view;
// the renderer only reports where its placeholder is and whether anything of the window would be covered by it.
import { uid } from "./format.js";

// Everything that draws OVER the window: dialogs and Settings (.back), menus (.pop), the picture preview (.lb), the quick
// window, the voice mode, the phone drawer and its scrim. A native view is always above the page, so it hides while one
// of these overlaps it (approval cards wait in the thread, which the panel covers only in the phone layout – App.jsx
// closes the panel there when one arrives).
export const OVERLAYS = ".back, .pop, .lb, .quick-back, .voice, .scrim, .side.open, .cv-menu";
// The width at which the panel takes the whole content area (layout.css, as Canvas): its narrow behaviour – „Назад“,
// messages in its own footer, back to the chat after „Добави в чата“, closed for an approval card – follows the SAME
// breakpoint, never the phone one (≤ 640 px), so nothing waits behind the page at 641–899 px either.
export const PANEL_NARROW = "(max-width:899px)";

export const intersects = (a, b) => !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Is the rectangle r covered by an overlay of the document?
export function coveredBy(doc, r, selector = OVERLAYS) {
  if (!doc || !r) return false;
  for (const el of doc.querySelectorAll(selector)) {
    const rects = el.getClientRects();
    if (!rects.length) continue; // display:none
    const b = el.getBoundingClientRect();
    if (b.width > 0 && b.height > 0 && intersects(b, r)) return true;
  }
  return false;
}

// The rectangle MAIN receives (CSS px of the main window). visible:false hides the native view.
export function boundsOf(el, covered) {
  if (!el) return { x: 0, y: 0, width: 0, height: 0, visible: false };
  const r = el.getBoundingClientRect();
  const x = Math.round(r.left);
  const y = Math.round(r.top);
  return { x, y, width: Math.max(0, Math.round(r.right) - x), height: Math.max(0, Math.round(r.bottom) - y), visible: !covered && r.width >= 40 && r.height >= 40 };
}
export const sameBounds = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.visible === b.visible;

// Server tools that make a picture (images.generate on Ted's server: Gemini, then Vercel AI Gateway).
export const IMAGE_TOOL = /^images?\.(generate|edit|create)$/;
// The „+ → Създай изображение“ prefix of the server engine (lib/consts.js HINTS) and similar openings.
const PREFIXES = /^\s*(създай изображение|създай снимка|направи снимка|нарисувай|генерирай снимка)\s*[:\-–—]\s*/i;
export const PROMPT_MAX = 4000;

// The prompt for ChatGPT: the employee's own words, without the „Създай изображение: “ prefix, ≤ 4000 characters.
export function promptFromText(text) {
  const t = String(text || "").replace(/\r\n?/g, "\n").trim().replace(PREFIXES, "").trim();
  return Array.from(t).slice(0, PROMPT_MAX).join("");
}

// A server answer whose image tool failed (free limit, no credits, any error) -> the card „Направи снимката в ChatGPT“:
// [{id, kind:"image", prompt, from:"server"}] with the tool's own prompt when the answer carries it, else the question.
// Not when another image action of the same answer succeeded (the model's retry made the picture after all).
export function serverImageHandoff(actions, userText) {
  const list = Array.isArray(actions) ? actions : [];
  const image = list.filter((a) => a && a.kind === "tool" && IMAGE_TOOL.test(String(a.tool || "")));
  if (image.some((a) => a.ok === true)) return null;
  const failed = image.find((a) => a.ok === false);
  if (!failed) return null;
  const prompt = (typeof failed.prompt === "string" && failed.prompt.trim() ? failed.prompt.trim().slice(0, PROMPT_MAX) : "") || promptFromText(userText);
  return prompt ? [{ id: uid("h_"), kind: "image", prompt, from: "server" }] : null;
}

// Real GPT was asked for a picture („+ → Създай изображение“) but cannot make it and gave no card at all (text only, or
// GPT answered without one): the same card with the employee's own question. A card GPT made (picture or video) is enough.
export function localImageHandoff(hints, handoffs, userText) {
  if (!Array.isArray(hints) || !hints.includes("image")) return null;
  if (Array.isArray(handoffs) && handoffs.length) return null;
  const prompt = promptFromText(userText);
  return prompt ? { id: uid("h_"), kind: "image", prompt, from: "local" } : null;
}

// ArrayBuffer of the clipboard picture -> a File for the composer (the same path as an attached file).
export function clipFile(r) {
  if (!r || !r.ok || !r.data) return null;
  const name = String(r.name || "Снимка от ChatGPT.png").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 120) || "Снимка от ChatGPT.png";
  return new File([r.data], /\.png$/i.test(name) ? name : name + ".png", { type: "image/png" });
}
