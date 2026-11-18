// 0.1.7 „ChatGPT панел“: the renderer's pure helpers (src/lib/panel.js) – the overlay rule, the rectangle MAIN gets,
// and the cards „Направи снимката в ChatGPT“ of a failed server picture / a Real GPT picture request without a card.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OVERLAYS, PANEL_NARROW, boundsOf, coveredBy, intersects, localImageHandoff, promptFromText, sameBounds, serverImageHandoff } from "../../src/lib/panel.js";
import { normalize } from "../../electron/backend/assistant.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const act = (tool, ok, extra = {}) => ({ raw: tool + (ok ? "" : " ✗"), kind: "tool", tool, label: tool, ok, mutating: true, ...extra });

describe("the picture prompt", () => {
  it("is the employee's own words without the „Създай изображение: “ prefix, ≤ 4000 characters", () => {
    expect(promptFromText("Създай изображение: фасада на къща вечер")).toBe("фасада на къща вечер");
    expect(promptFromText("  създай снимка – хол в бяло ")).toBe("хол в бяло");
    expect(promptFromText("Нарисувай: кухня")).toBe("кухня");
    expect(promptFromText("Снимка на хол\r\nв бяло")).toBe("Снимка на хол\nв бяло");
    expect(Array.from(promptFromText("😀".repeat(5000)))).toHaveLength(4000);
    expect(promptFromText("")).toBe("");
  });
});

describe("serverImageHandoff (Ted's server engine)", () => {
  it("a failed images.generate -> one card from the question; the tool's own prompt when the answer carries it", () => {
    const c = serverImageHandoff([act("properties.search", true), act("images.generate", false)], "Създай изображение: фасада на къща вечер");
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ kind: "image", prompt: "фасада на къща вечер", from: "server" });
    expect(c[0].id).toMatch(/^h_/);
    expect(serverImageHandoff([act("images.generate", false, { prompt: "  точен промпт на сървъра  " })], "друго")[0].prompt).toBe("точен промпт на сървъра");
    expect(serverImageHandoff([act("images.edit", false)], "смени фона")[0].prompt).toBe("смени фона");
  });

  it("no card for a successful picture, another failed tool, an info step, or no question", () => {
    expect(serverImageHandoff([act("images.generate", true)], "x")).toBeNull();
    // The model's first call failed (e.g. a bad property code) and its retry made the picture: no „could not“ card.
    expect(serverImageHandoff([act("images.generate", false), act("images.generate", true)], "фасада вечер")).toBeNull();
    expect(serverImageHandoff([act("images.generate", true), act("images.edit", false)], "фасада вечер")).toBeNull();
    expect(serverImageHandoff([act("images.generate", false), act("properties.search", true)], "фасада вечер")).toHaveLength(1);
    expect(serverImageHandoff([act("documents.translate", false)], "x")).toBeNull();
    expect(serverImageHandoff([{ raw: "интернет: x ✗", kind: "info", label: "интернет: x", ok: false }], "x")).toBeNull();
    expect(serverImageHandoff([act("images.generate", false)], "  ")).toBeNull();
    expect(serverImageHandoff(null, "x")).toBeNull();
  });
});

describe("serverImageHandoff with what the server really sends (api/assistant.js: strings, „ ✗“ for a failed step)", () => {
  it("a failed call and a successful retry in the same answer -> no card; only failures -> the card", () => {
    const retry = normalize({ ok: true, text: "Готово – ето снимката.", actions: ["images.generate ✗", "images.generate"] });
    expect(retry.actions.map((a) => [a.tool, a.ok])).toEqual([["images.generate", false], ["images.generate", true]]);
    expect(serverImageHandoff(retry.actions, "Създай изображение: фасада вечер")).toBeNull();
    const failed = normalize({ ok: true, text: "Снимката не е генерирана.", actions: ["images.generate ✗", "images.generate ✗"] });
    expect(serverImageHandoff(failed.actions, "Създай изображение: фасада вечер")).toMatchObject([{ kind: "image", prompt: "фасада вечер", from: "server" }]);
  });
});

describe("the panel's narrow layout follows its own CSS breakpoint (finding: 641–899 px)", () => {
  it("PANEL_NARROW is the max-width of layout.css's full-area panel rule – not the phone breakpoint", () => {
    expect(PANEL_NARROW).toBe("(max-width:899px)");
    const css = fs.readFileSync(path.join(root, "src/styles/layout.css"), "utf8");
    const rule = /@media \(max-width:(\d+)px\)\{\s*\.cgp\{position:fixed;inset:0/.exec(css);
    expect(rule && rule[1]).toBe("899");
    const app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");
    // Every narrow behaviour of the panel reads the panel's own breakpoint.
    expect(app).toMatch(/<ChatGptPanel phone=\{cgpNarrow\}[^\n]*notice=\{cgpNarrow \? toastMsg : null\}/);
    expect(app).toMatch(/if \(narrowRef\.current\) closePanel\(\);/);
    expect(app).toMatch(/if \(cgpRef\.current && narrowRef\.current\) \{ closePanel\(\);/);
    expect(app).toMatch(/toastMsg && !\(cgpShown && cgpNarrow\)/);
    expect(app).not.toMatch(/phoneRef/);
  });
});

describe("localImageHandoff (Real GPT)", () => {
  it("only with the „Създай изображение“ hint and only when GPT gave no picture card", () => {
    expect(localImageHandoff(["image"], [], "уютна кухня")).toMatchObject({ kind: "image", prompt: "уютна кухня", from: "local" });
    expect(localImageHandoff(["image"], [{ id: "h1", kind: "image", prompt: "от GPT" }], "уютна кухня")).toBeNull();
    expect(localImageHandoff(["image", "video"], [{ id: "h1", kind: "video", prompt: "клип" }], "уютна кухня")).toBeNull(); // GPT's own card is enough
    expect(localImageHandoff(["search"], [], "x")).toBeNull();
    expect(localImageHandoff(null, [], "x")).toBeNull();
    expect(localImageHandoff(["image"], [], "")).toBeNull();
  });
});

describe("the rectangle and the overlays", () => {
  const box = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
  const el = (r, shown = true) => ({ getClientRects: () => (shown ? [r] : []), getBoundingClientRect: () => r });
  const doc = (list) => ({ querySelectorAll: (sel) => { expect(sel).toBe(OVERLAYS); return list; } });
  const panel = box(820, 163, 546, 605);

  it("covered when a dialog, Settings, a menu over it, the preview, the quick window or the drawer overlaps it", () => {
    expect(coveredBy(doc([el(box(0, 0, 1366, 860))]), panel)).toBe(true);       // .back of a dialog
    expect(coveredBy(doc([el(box(1100, 90, 250, 200))]), panel)).toBe(true);    // the chat „…“ menu
    expect(coveredBy(doc([el(box(300, 500, 330, 260))]), panel)).toBe(false);   // the „+“ menu beside it
    expect(coveredBy(doc([el(box(0, 0, 1366, 860), false)]), panel)).toBe(false); // display:none
    expect(coveredBy(doc([el(box(820, 100, 0, 0))]), panel)).toBe(false);
    expect(coveredBy(doc([]), panel)).toBe(false);
    for (const s of [".back", ".pop", ".lb", ".quick-back", ".voice", ".scrim", ".side.open"]) expect(OVERLAYS).toContain(s);
    expect(intersects(box(0, 0, 10, 10), box(10, 0, 10, 10))).toBe(false); // touching edges do not overlap
  });

  it("boundsOf rounds to whole pixels and reports visible only for a large enough, uncovered placeholder", () => {
    const at = (r) => ({ getBoundingClientRect: () => r });
    expect(boundsOf(at(box(820.4, 163.2, 545.6, 605.3)), false)).toEqual({ x: 820, y: 163, width: 546, height: 606, visible: true });
    expect(boundsOf(at(box(820, 163, 546, 605)), true).visible).toBe(false);
    expect(boundsOf(at(box(820, 163, 30, 605)), false).visible).toBe(false);
    expect(boundsOf(null, false)).toEqual({ x: 0, y: 0, width: 0, height: 0, visible: false });
    expect(sameBounds({ x: 1, y: 2, width: 3, height: 4, visible: true }, { x: 1, y: 2, width: 3, height: 4, visible: true })).toBe(true);
    expect(sameBounds({ x: 1, y: 2, width: 3, height: 4, visible: true }, { x: 1, y: 2, width: 3, height: 4, visible: false })).toBe(false);
    expect(sameBounds(null, { x: 1 })).toBe(false);
  });
});
