// 0.1.8 · Тед за Mac: white with red elements, a Mac edit menu, the window buttons on the left, and a universal
// disk image for macOS 13 Ventura and newer – while Windows stays exactly as it was.
import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMainWindow, macMenuTemplate } from "../../electron/window.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

function fakeWindow() {
  const made = [];
  class BrowserWindow {
    constructor(options) { this.options = options; this.events = {}; this.bounds = { x: 0, y: 0, width: options.width, height: options.height }; this.webContents = { on: () => {} }; made.push(this); }
    on(e, fn) { this.events[e] = fn; } once() {} loadURL() { return Promise.resolve(); }
    getBounds() { return { ...this.bounds }; } isDestroyed() { return false; } isMinimized() { return false; } isFullScreen() { return false; }
    isMaximized() { return false; } show() {}
  }
  const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  const screen = { getAllDisplays: () => [display], getDisplayMatching: () => display };
  const state = { get: () => ({}), set: (p) => p };
  return { BrowserWindow, screen, state, made, Menu: { buildFromTemplate: () => ({ popup: () => {} }) } };
}

describe("main window per platform", () => {
  it("Windows (and Linux) keep the burgundy window exactly as before", () => {
    for (const platform of ["win32", "linux"]) {
      const f = fakeWindow();
      createMainWindow({ ...f, preload: "p", url: "u", packaged: true, platform });
      const o = f.made[0].options;
      expect(o.backgroundColor).toBe("#22030b");
      expect(o.titleBarOverlay).toEqual({ color: "#22030b", symbolColor: "#f3cf86", height: 36 });
      expect(o.trafficLightPosition).toBeUndefined();
    }
  });
  it("a Mac starts white and centres the window buttons in the 36 px title bar", () => {
    const f = fakeWindow();
    createMainWindow({ ...f, preload: "p", url: "u", packaged: true, platform: "darwin" });
    const o = f.made[0].options;
    expect(o.backgroundColor).toBe("#ffffff");
    expect(o.titleBarStyle).toBe("hidden");
    expect(o.trafficLightPosition).toEqual({ x: 14, y: 12 });
    expect(o.webPreferences).toMatchObject({ contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: false });
  });
});

describe("Mac menu", () => {
  it("has only standard roles: copy/paste/quit work, no reload or developer tools", () => {
    const t = macMenuTemplate("Тед");
    const roles = JSON.stringify(t);
    expect(t.map((m) => m.role || m.label)).toEqual(["Тед", "editMenu", "windowMenu"]);
    expect(t[0].submenu.map((i) => i.role).filter(Boolean)).toEqual(["about", "hide", "hideOthers", "unhide", "quit"]);
    expect(roles).not.toMatch(/reload|toggleDevTools|forceReload|viewMenu|click/);
  });
  it("main.js uses it only on a Mac and keeps no menu on Windows", () => {
    const src = read("electron/main.js");
    expect(src).toMatch(/if \(process\.platform === "darwin"\) Menu\.setApplicationMenu\(Menu\.buildFromTemplate\(macMenuTemplate\("Тед"\)\)\);\s*else if \(app\.isPackaged\) Menu\.setApplicationMenu\(null\);/);
  });
});

describe("Mac look in the page", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
  it("src/lib/os.js marks a Mac and leaves Windows alone", async () => {
    const cls = new Set();
    vi.stubGlobal("document", { documentElement: { classList: { add: (c) => cls.add(c) } } });
    vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "" });
    let m = await import("../../src/lib/os.js?mac");
    expect([m.IS_MAC, m.OS, m.PRODUCT, m.kb("Ctrl + K")]).toEqual([true, "macOS", "Тед за Mac", "⌘ + K"]);
    expect(cls.has("os-mac")).toBe(true);
    cls.clear(); vi.resetModules();
    vi.stubGlobal("navigator", { platform: "Win32", userAgent: "" });
    m = await import("../../src/lib/os.js?win");
    expect([m.IS_MAC, m.OS, m.PRODUCT, m.kb("Ctrl + K")]).toEqual([false, "Windows", "Тед за Windows", "Ctrl + K"]);
    expect(cls.size).toBe(0);
  });
  it("mac.css is loaded last and every rule is scoped to html.os-mac", () => {
    const main = read("src/main.jsx");
    expect(main.indexOf('import "./styles/mac.css"')).toBeGreaterThan(main.indexOf('import "./styles/premium.css"'));
    expect(main.indexOf('from "./lib/os.js"')).toBeLessThan(main.indexOf('import App from'));
    const css = read("src/styles/mac.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [];
    css.replace(/(^|})\s*([^{}@]+)\{/g, (_, __, sel) => { selectors.push(...sel.split(",").map((x) => x.trim()).filter(Boolean)); return ""; });
    expect(selectors.length).toBeGreaterThan(40);
    for (const s of selectors) expect(s, s).toMatch(/^html\.os-mac\b/);
  });
});

describe("Mac packaging", () => {
  const yml = read("electron-builder.yml");
  const wf = read("../../.github/workflows/ted-desktop.yml");
  it("one universal disk image for macOS 13 Ventura and newer, ad hoc signed, with the microphone sentence", () => {
    expect(yml).toMatch(/mac:\n  target:\n    - target: dmg\n      arch:\n        - universal/);
    expect(yml).toMatch(/minimumSystemVersion: "13\.0"/);
    expect(yml).toMatch(/identity: "-"/);
    expect(yml).toMatch(/hardenedRuntime: false/);
    expect(yml).toMatch(/NSMicrophoneUsageDescription:/);
    expect(yml).toMatch(/artifactName: "Ted-Mac-\$\{version\}-universal\.\$\{ext\}"/);
    expect(fs.existsSync(path.join(root, "build/icon.icns"))).toBe(true);
    expect(JSON.parse(read("package.json")).scripts["dist:mac"]).toBe("npm run build:renderer && electron-builder --mac dmg --universal --publish never");
  });
  it("the workflow builds and smoke-tests it on macOS and ships it with the Windows installer", () => {
    expect(wf).toMatch(/build-mac:\n    name: Инсталатор \(macOS – Intel и Apple Silicon\)\n    needs: test\n    runs-on: macos-15/);
    expect(wf).toMatch(/lipo -archs/);
    expect(wf).toMatch(/codesign --verify --deep --strict/);
    expect(wf).toMatch(/smoke arm64 env/);
    expect(wf).toMatch(/smoke x86_64 arch -x86_64/);
    expect(wf).toMatch(/needs: \[build-windows, build-mac\]/);
    expect(wf).toMatch(/name: Ted-za-Mac-\$\{\{ github\.run_number \}\}/);
  });
});
