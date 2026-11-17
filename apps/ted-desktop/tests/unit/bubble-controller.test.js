// „Балонче“ (0.1.6, docs/CONTRACT.md §22): the geometry and the controller of electron/bubble.js with plain-object
// stand-ins for screen and BrowserWindow (the real "electron" module is never imported).
import { describe, it, expect } from "vitest";
import { SYSTEM_DOUBLE_MS } from "../../src/bubble/gesture.js";
import {
  BUBBLE_SIZE, EDGE_GAP, MINI_SIZE, PANEL_GAP, MOVE_MIN_MS, DELTA_MAX, BUBBLE_URL, DOUBLE_CLICK_MS,
  cleanDelta, displayFor, clampToArea, defaultPosition, snapToEdge, placeBubble, miniBounds,
  createBubbleController, registerBubbleIpc,
} from "../../electron/bubble.js";

const S = BUBBLE_SIZE;
// A laptop with the taskbar at the bottom, a 1440p monitor to its right with the taskbar on the LEFT, a monitor to the
// left at negative coordinates with the taskbar on TOP and one above with the taskbar on the RIGHT.
const LAPTOP = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1.25 };
const RIGHT = { id: 2, bounds: { x: 1920, y: 0, width: 2560, height: 1440 }, workArea: { x: 1968, y: 0, width: 2512, height: 1440 }, scaleFactor: 1.5 };
const LEFT = { id: 3, bounds: { x: -1280, y: 200, width: 1280, height: 1024 }, workArea: { x: -1280, y: 240, width: 1280, height: 984 }, scaleFactor: 1 };
const ABOVE = { id: 4, bounds: { x: 0, y: -900, width: 1600, height: 900 }, workArea: { x: 0, y: -900, width: 1552, height: 900 }, scaleFactor: 1 };
const ALL = [LAPTOP, RIGHT, LEFT, ABOVE];
const right = (a) => a.x + a.width - S - EDGE_GAP;

describe("geometry", () => {
  it("cleanDelta: finite numbers only, rounded and clamped", () => {
    expect(cleanDelta(12.6)).toBe(13);
    expect(cleanDelta(-4.4)).toBe(-4);
    expect(cleanDelta(1e9)).toBe(DELTA_MAX);
    expect(cleanDelta(-1e9)).toBe(-DELTA_MAX);
    for (const v of [NaN, Infinity, -Infinity, "50", null, undefined, {}, [3]]) expect(cleanDelta(v)).toBe(0);
  });

  it("displayFor: the display with most of the rect, else the nearest one", () => {
    expect(displayFor({ x: 100, y: 100, width: 64, height: 64 }, ALL)).toBe(LAPTOP);
    expect(displayFor({ x: 1900, y: 100, width: 64, height: 64 }, ALL)).toBe(LAPTOP); // the right monitor's work area starts after its taskbar
    expect(displayFor({ x: 1990, y: 100, width: 64, height: 64 }, ALL)).toBe(RIGHT);
    expect(displayFor({ x: 1950, y: 100, width: 40, height: 64 }, ALL)).toBe(RIGHT); // more of it on the right monitor
    expect(displayFor({ x: -600, y: 500, width: 64, height: 64 }, ALL)).toBe(LEFT);
    expect(displayFor({ x: 200, y: -400, width: 64, height: 64 }, ALL)).toBe(ABOVE);
    expect(displayFor({ x: -900, y: -500, width: 64, height: 64 }, ALL)).toBe(LEFT); // on no display: the nearest work area (708 px below vs 868 px aside)
    expect(displayFor({ x: -200, y: -800, width: 64, height: 64 }, ALL)).toBe(ABOVE);
    expect(displayFor({ x: 0, y: 1046, width: 64, height: 64 }, ALL)).toBe(LAPTOP); // over the laptop's taskbar
    expect(displayFor({ x: 1890, y: 1020, width: 64, height: 64 }, ALL)).toBe(LAPTOP); // over the taskbar, next to the right monitor
    expect(displayFor({ x: 1930, y: 600, width: 20, height: 20 }, ALL)).toBe(RIGHT); // over the right monitor's taskbar (left side)
    expect(displayFor({ x: 0, y: 0, width: 1, height: 1 }, [])).toBeNull();
  });

  it("clampToArea keeps the box completely inside the work area", () => {
    const a = LAPTOP.workArea;
    expect(clampToArea({ x: -50, y: 2000 }, { width: S, height: S }, a)).toEqual({ x: 0, y: 1040 - S });
    expect(clampToArea({ x: 5000, y: -5 }, { width: S, height: S }, a)).toEqual({ x: 1920 - S, y: 0 });
    expect(clampToArea({ x: 10.4, y: 20.6 }, { width: S, height: S }, a)).toEqual({ x: 10, y: 21 });
  });

  it("default: the right edge at 75 % of the work area of the main window's display", () => {
    expect(defaultPosition(LAPTOP)).toEqual({ x: right(LAPTOP.workArea), y: Math.round(1040 * 0.75 - S / 2), side: "right" });
    expect(defaultPosition(RIGHT)).toEqual({ x: 1968 + 2512 - S - EDGE_GAP, y: Math.round(1440 * 0.75 - S / 2), side: "right" });
    expect(defaultPosition(LEFT)).toEqual({ x: -S - EDGE_GAP, y: Math.round(240 + 984 * 0.75 - S / 2), side: "right" });
  });

  it("snap: the nearest left/right edge of the display it is on, keeping the height, never under a taskbar", () => {
    expect(snapToEdge({ x: 300, y: 500 }, ALL)).toEqual({ x: EDGE_GAP, y: 500, side: "left" });
    expect(snapToEdge({ x: 1500, y: 500 }, ALL)).toEqual({ x: right(LAPTOP.workArea), y: 500, side: "right" });
    // The right monitor's taskbar is on its left: the left edge is the work area's, 48 px in.
    expect(snapToEdge({ x: 2100, y: 700 }, ALL)).toEqual({ x: 1968 + EDGE_GAP, y: 700, side: "left" });
    expect(snapToEdge({ x: 4300, y: 1400 }, ALL)).toEqual({ x: 1968 + 2512 - S - EDGE_GAP, y: 1440 - S - EDGE_GAP, side: "right" });
    // Negative coordinates, taskbar on top: the height stays inside the work area.
    expect(snapToEdge({ x: -1200, y: 210 }, ALL)).toEqual({ x: -1280 + EDGE_GAP, y: 240 + EDGE_GAP, side: "left" });
    // The monitor above has its taskbar on the right.
    expect(snapToEdge({ x: 1400, y: -300 }, ALL)).toEqual({ x: 1552 - S - EDGE_GAP, y: -300, side: "right" });
    // Dropped on the laptop's taskbar: back into the work area.
    expect(snapToEdge({ x: 1500, y: 1060 }, ALL)).toEqual({ x: right(LAPTOP.workArea), y: 1040 - S - EDGE_GAP, side: "right" });
    expect(snapToEdge({ x: 300, y: 1060 }, ALL)).toEqual({ x: EDGE_GAP, y: 1040 - S - EDGE_GAP, side: "left" });
  });

  it("remembered position: used (snapped again) while it is on a display, else the default on the main window's display", () => {
    expect(placeBubble({ x: EDGE_GAP, y: 300 }, ALL, LAPTOP)).toEqual({ x: EDGE_GAP, y: 300, side: "left" });
    // The right monitor was unplugged: its old position is on no display -> default on the main window's display.
    expect(placeBubble({ x: 4400, y: 900 }, [LAPTOP], LAPTOP)).toEqual(defaultPosition(LAPTOP));
    // The resolution got smaller (or the taskbar moved): still on the display, back to its edge and work area.
    const small = { id: 1, workArea: { x: 0, y: 0, width: 1366, height: 728 } };
    expect(placeBubble({ x: 1850, y: 900 }, [small], small)).toEqual(defaultPosition(small)); // completely outside now
    expect(placeBubble({ x: 1340, y: 700 }, [small], small)).toEqual({ x: 1366 - S - EDGE_GAP, y: 728 - S - EDGE_GAP, side: "right" });
    for (const bad of [null, {}, { x: "1", y: 2 }, { x: NaN, y: 2 }]) expect(placeBubble(bad, ALL, RIGHT)).toEqual(defaultPosition(RIGHT));
  });

  it("mini chat: on the bubble's side, outer edge at the screen edge, bottom level with the bubble, inside the work area", () => {
    const b = defaultPosition(LAPTOP);
    expect(miniBounds(b, ALL)).toEqual({ x: 1920 - MINI_SIZE.width - PANEL_GAP, y: b.y + S - MINI_SIZE.height, ...MINI_SIZE });
    expect(miniBounds({ x: EDGE_GAP, y: 100, side: "left" }, ALL)).toEqual({ x: PANEL_GAP, y: PANEL_GAP, ...MINI_SIZE }); // near the top: clamped
    expect(miniBounds({ x: 1968 + EDGE_GAP, y: 1000, side: "left" }, ALL)).toEqual({ x: 1968 + PANEL_GAP, y: 1000 + S - 640, ...MINI_SIZE });
    // A small screen: the panel shrinks to the work area.
    const tiny = { id: 9, workArea: { x: 0, y: 0, width: 1024, height: 560 } };
    expect(miniBounds({ x: 954, y: 400, side: "right" }, [tiny])).toEqual({ x: 1024 - 400 - PANEL_GAP, y: PANEL_GAP, width: 400, height: 560 - 2 * PANEL_GAP });
  });
});

// ---- fakes ----
function fakeWindow(bounds, extra = {}) {
  const ev = {};
  let id = 0;
  const w = {
    bounds: { ...bounds }, visible: true, maximized: false, fullScreen: false, minimized: false, top: null, destroyed: false, focused: false,
    log: [], sent: [],
    webContents: { id: (id = Math.floor(Math.random() * 1e6)), send: (c, p) => w.sent.push([c, p]), isDestroyed: () => w.destroyed },
    on: (e, fn) => { (ev[e] ||= []).push(fn); },
    emit: (e, arg) => (ev[e] || []).forEach((fn) => fn(arg)),
    isDestroyed: () => w.destroyed,
    getBounds: () => ({ ...w.bounds }),
    getNormalBounds: () => ({ ...(w.normal || w.bounds) }),
    setBounds: (b) => { w.bounds = { ...b }; w.log.push(["bounds", { ...b }]); },
    isMaximized: () => w.maximized,
    isFullScreen: () => w.fullScreen,
    isMinimized: () => w.minimized,
    maximize: () => { w.normal = { ...w.bounds }; w.maximized = true; w.bounds = { x: 0, y: 0, width: 1920, height: 1040 }; w.log.push(["maximize"]); },
    unmaximize: () => { w.maximized = false; if (w.normal) w.bounds = { ...w.normal }; w.log.push(["unmaximize"]); },
    setFullScreen: (on) => { if (on && !w.fullScreen) w.normal = { ...w.bounds }; w.fullScreen = !!on; w.log.push(["fullScreen", !!on]); },
    restore: () => { w.minimized = false; w.visible = true; w.log.push(["restore"]); },
    setAlwaysOnTop: (on, level) => { w.top = on ? level || "normal" : null; },
    show: () => { w.visible = true; w.log.push(["show"]); },
    showInactive: () => { w.visible = true; w.inactive = true; w.log.push(["showInactive"]); },
    hide: () => { w.visible = false; w.log.push(["hide"]); },
    focus: () => { w.focused = true; },
    destroy: () => { w.destroyed = true; w.emit("closed"); },
    ...extra,
  };
  void id;
  return w;
}

function rig({ displays = [LAPTOP], store: initial = {}, mainBounds = { x: 200, y: 100, width: 1366, height: 860 }, snapMs = 0, ready = true } = {}) {
  let t = 1000;
  const timers = [];
  const screenEvents = {};
  const screen = { getAllDisplays: () => rig.displays, getPrimaryDisplay: () => rig.displays[0], on: (e, fn) => { (screenEvents[e] ||= []).push(fn); } };
  rig.displays = displays;
  let saved = { ...initial };
  const store = { get: () => ({ ...saved }), set: (p) => { saved = { ...saved, ...p }; return saved; } };
  const main = fakeWindow(mainBounds);
  const floating = [];
  const bubbles = [];
  const modes = [];
  const menus = [];
  const quits = [];
  let resolveReady;
  const c = createBubbleController({
    screen, main, store, setFloating: (on) => floating.push(on),
    makeBubbleWindow: () => {
      const w = fakeWindow({ x: 0, y: 0, width: S, height: S });
      w.visible = false;
      bubbles.push(w);
      return { win: w, ready: ready ? Promise.resolve(true) : new Promise((r) => { resolveReady = r; }) };
    },
    popupMenu: (win, items) => menus.push({ win, items }),
    quit: () => quits.push(true),
    onMode: (m) => modes.push(m),
    log: { warn() {}, error() {}, info() {} },
    now: () => t,
    timers: { set: (fn, ms) => { const h = { fn, at: t + ms }; timers.push(h); return h; }, clear: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); } },
    snapMs,
    readyMs: 4000,
  });
  const advance = (ms) => {
    const end = t + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const h = timers[0];
      if (!h || h.at > end) break;
      timers.shift();
      t = h.at;
      h.fn();
    }
    t = end;
  };
  return { c, main, store, saved: () => saved, floating, bubbles, modes, menus, quits, screenEvents, advance, tick: (ms) => { t += ms; }, resolveReady: () => resolveReady && resolveReady(true) };
}

describe("controller: modes", () => {
  it("Балонче: the main window hides (remembered), the bubble appears inactive at the right edge, always on top", async () => {
    const r = rig();
    expect(r.c.mode()).toBe("normal");
    expect(await r.c.toBubble()).toEqual({ ok: true, mode: "bubble" });
    const b = r.bubbles[0];
    expect(r.main.visible).toBe(false);
    expect(r.floating).toEqual([true]);
    expect(b.visible).toBe(true);
    expect(b.inactive).toBe(true);
    expect(b.top).toBe("floating");
    expect(b.bounds).toEqual({ ...defaultPosition(LAPTOP), side: undefined, width: S, height: S, x: right(LAPTOP.workArea), y: Math.round(1040 * 0.75 - S / 2) });
    expect(r.modes).toEqual(["bubble"]);
    expect(r.c.state()).toEqual({ mode: "bubble", unread: 0, working: false, attention: false, side: "right" });
    expect(b.sent.at(-1)).toEqual(["ted-bubble:state", r.c.state()]);
    // Asking again changes nothing and makes no second window.
    expect(await r.c.toBubble()).toEqual({ ok: true, mode: "bubble" });
    expect(r.bubbles).toHaveLength(1);
  });

  it("the default position is on the display the main window is on", async () => {
    const r = rig({ displays: ALL, mainBounds: { x: 2400, y: 200, width: 1366, height: 860 } });
    await r.c.toBubble();
    expect(r.bubbles[0].bounds).toMatchObject({ x: 1968 + 2512 - S - EDGE_GAP, y: Math.round(1440 * 0.75 - S / 2) });
  });

  it("the main window hides only once the bubble page is ready (no moment without Ted on screen)", async () => {
    const r = rig({ ready: false });
    const p = r.c.toBubble();
    await Promise.resolve();
    expect(r.main.visible).toBe(true);
    r.resolveReady();
    expect(await p).toEqual({ ok: true, mode: "bubble" });
    expect(r.main.visible).toBe(false);
  });

  it("click -> the mini chat next to the bubble, always on top; the bubble hides; „Нормален прозорец“ restores everything", async () => {
    const r = rig({ mainBounds: { x: 240, y: 90, width: 1200, height: 800 } });
    await r.c.toBubble();
    expect(await r.c.click()).toEqual({ ok: true, mode: "mini" });
    const p = defaultPosition(LAPTOP);
    expect(r.main.bounds).toEqual(miniBounds(p, [LAPTOP]));
    expect(r.main.top).toBe("floating");
    expect(r.main.visible && r.main.focused).toBe(true);
    expect(r.bubbles[0].visible).toBe(false);
    expect(r.modes).toEqual(["bubble", "mini"]);
    expect(await r.c.restore()).toEqual({ ok: true, mode: "normal" });
    expect(r.main.bounds).toEqual({ x: 240, y: 90, width: 1200, height: 800 });
    expect(r.main.top).toBe(null);
    expect(r.floating).toEqual([true, false]);
    expect(r.modes).toEqual(["bubble", "mini", "normal"]);
    // A click while not in the bubble does nothing.
    expect(await r.c.click()).toEqual({ ok: false, mode: "normal" });
  });

  it("a slower double click (release gate 0.1.6): the click and the double click sent right after it end in the normal window", async () => {
    // The bubble page sends "click" 240 ms after the first release and "double" at once when the second press comes
    // within Windows' 500 ms (src/bubble/gesture.js): both arrive back to back, the mini chat may be just opening.
    const r = rig({ mainBounds: { x: 240, y: 90, width: 1200, height: 800 } });
    await r.c.toBubble();
    const a = r.c.click();
    const b = r.c.openNormal();
    expect(await a).toEqual({ ok: true, mode: "mini" });
    expect(await b).toEqual({ ok: true, mode: "normal" });
    // "mini" is pushed first – the renderer's guard (App.jsx useMiniGuard) arms on it –, then "normal".
    expect(r.modes).toEqual(["bubble", "mini", "normal"]);
    expect(r.main.bounds).toEqual({ x: 240, y: 90, width: 1200, height: 800 });
    expect(r.main.top).toBe(null);
    expect(r.main.visible).toBe(true);
    expect(r.bubbles[0].visible).toBe(false);
  });

  it("a maximised window comes back maximised (with its normal bounds underneath), a full-screen one full screen", async () => {
    const r = rig({ mainBounds: { x: 300, y: 120, width: 1100, height: 700 } });
    r.main.maximize();
    await r.c.toBubble();
    await r.c.miniChat();
    expect(r.main.maximized).toBe(false);
    expect(r.main.bounds.width).toBe(400);
    await r.c.restore();
    expect(r.main.maximized).toBe(true);
    expect(r.main.getNormalBounds()).toEqual({ x: 300, y: 120, width: 1100, height: 700 });

    const f = rig({ mainBounds: { x: 10, y: 10, width: 1000, height: 700 } });
    f.main.setFullScreen(true);
    await f.c.toBubble();
    await f.c.miniChat();
    expect(f.main.fullScreen).toBe(false);
    await f.c.restore();
    expect(f.main.fullScreen).toBe(true);
    expect(f.main.log.filter((x) => x[0] === "bounds").at(-1)[1]).toEqual({ x: 10, y: 10, width: 1000, height: 700 });
  });

  it("restore after the main window's monitor was unplugged centres it on the bubble's display", async () => {
    const r = rig({ displays: [LAPTOP, RIGHT], mainBounds: { x: 2500, y: 300, width: 1366, height: 860 } });
    await r.c.toBubble();
    rig.displays = [LAPTOP];
    r.screenEvents["display-removed"].forEach((fn) => fn());
    expect(r.bubbles[0].bounds).toMatchObject({ x: right(LAPTOP.workArea) }); // re-placed on a visible edge
    await r.c.restore();
    expect(r.main.bounds).toEqual({ x: Math.round((1920 - 1366) / 2), y: Math.round((1040 - 860) / 2), width: 1366, height: 860 });
  });

  it("miniChat straight from the normal window takes the snapshot too", async () => {
    const r = rig({ mainBounds: { x: 50, y: 60, width: 1000, height: 700 } });
    await r.c.miniChat();
    expect(r.c.mode()).toBe("mini");
    expect(r.floating).toEqual([true]);
    await r.c.restore();
    expect(r.main.bounds).toEqual({ x: 50, y: 60, width: 1000, height: 700 });
  });
});

describe("controller: dragging", () => {
  it("moves with the pointer inside the work area, at most one move per 8 ms, deltas clamped", async () => {
    const r = rig({ displays: ALL });
    await r.c.toBubble();
    const b = r.bubbles[0];
    const start = b.getBounds();
    expect(r.c.dragMove(10, 10)).toEqual({ ok: false }); // no drag started
    expect(r.c.dragStart()).toEqual({ ok: true });
    expect(r.c.dragMove(-300, -200)).toEqual({ ok: true });
    expect(b.bounds).toEqual({ x: start.x - 300, y: start.y - 200, width: S, height: S });
    expect(r.c.dragMove(-310, -210)).toEqual({ ok: true, skipped: true }); // too soon
    r.tick(MOVE_MIN_MS);
    r.c.dragMove(-310, -210);
    expect(b.bounds).toMatchObject({ x: start.x - 310, y: start.y - 210 });
    r.tick(MOVE_MIN_MS);
    r.c.dragMove(0, 290); // over the laptop's taskbar: stays inside the work area
    expect(b.bounds.y).toBe(1040 - S);
    r.tick(MOVE_MIN_MS);
    r.c.dragMove(1e9, 0); // absurd delta: cut to ±20000, then kept on the display under it
    expect(b.bounds.x).toBeLessThanOrEqual(1968 + 2512 - S);
  });

  it("release snaps to the nearest edge (animated), saves the position and tells the page its side", async () => {
    const r = rig({ displays: ALL, snapMs: 160 });
    await r.c.toBubble();
    const b = r.bubbles[0];
    const start = b.getBounds();
    r.c.dragStart();
    r.c.dragMove(-1200, -300);
    expect(r.c.dragEnd(-1200, -300)).toEqual({ ok: true, side: "left" });
    // Animated: not there yet, then there.
    r.advance(16);
    expect(b.bounds.x).toBeGreaterThan(EDGE_GAP);
    r.advance(400);
    expect(b.bounds).toEqual({ x: EDGE_GAP, y: start.y - 300, width: S, height: S });
    expect(r.saved().bubble).toEqual({ x: EDGE_GAP, y: start.y - 300 });
    expect(r.c.state().side).toBe("left");
    expect(b.sent.at(-1)[1]).toMatchObject({ side: "left" });
    // Dragged onto the right monitor: snaps to ITS edge.
    r.c.dragStart();
    r.c.dragEnd(2600, 100);
    r.advance(400);
    expect(b.bounds.x).toBe(1968 + EDGE_GAP); // left half of the right monitor -> its left edge (taskbar side)
    // A new drag cancels a running snap.
    r.c.dragStart();
    r.c.dragEnd(1500, 0);
    r.advance(16);
    r.c.dragStart();
    const mid = b.getBounds();
    r.advance(400);
    expect(b.getBounds()).toEqual(mid);
  });

  it("position memory: the next bubble (also after a restart) appears where it was left", async () => {
    const r = rig({ displays: ALL });
    await r.c.toBubble();
    r.c.dragStart();
    r.c.dragEnd(-1500, -200);
    const where = r.bubbles[0].getBounds();
    await r.c.restore();
    await r.c.toBubble();
    expect(r.bubbles[0].getBounds()).toEqual(where);
    // A new program run with the same window-state file.
    const again = rig({ displays: ALL, store: r.saved() });
    await again.c.toBubble();
    expect(again.bubbles[0].getBounds()).toEqual(where);
    expect(again.c.state().side).toBe("left");
  });

  it("drag messages are ignored outside the bubble mode", async () => {
    const r = rig();
    expect(r.c.dragStart()).toEqual({ ok: false });
    expect(r.c.dragEnd(1, 1)).toEqual({ ok: false });
    await r.c.toBubble();
    await r.c.miniChat();
    expect(r.c.dragStart()).toEqual({ ok: false });
  });
});

describe("controller: the mini chat's caption buttons, quitting, dialogs", () => {
  it("× and – of Windows go back to the bubble (× never quits from there), □ is the normal window", async () => {
    const r = rig();
    await r.c.toBubble();
    await r.c.miniChat();
    let prevented = false;
    r.main.emit("close", { preventDefault: () => { prevented = true; } });
    expect(prevented).toBe(true);
    await r.c.state(); await new Promise((x) => setTimeout(x, 0));
    expect(r.c.mode()).toBe("bubble");
    await r.c.miniChat();
    r.main.minimized = true;
    r.main.emit("minimize");
    await new Promise((x) => setTimeout(x, 0));
    expect(r.c.mode()).toBe("bubble");
    await r.c.miniChat();
    expect(r.main.minimized).toBe(false); // un-minimised before it is shown as the mini chat
    r.main.emit("maximize");
    await new Promise((x) => setTimeout(x, 0));
    expect(r.c.mode()).toBe("normal");
    // In the normal window × is a normal close.
    prevented = false;
    r.main.emit("close", { preventDefault: () => { prevented = true; } });
    expect(prevented).toBe(false);
  });

  // Release gate 0.1.6, attack on the first fix: a bubble dragged to the top of the screen. The mini chat is clamped to
  // the work area, so the bubble's face lies over its title bar – on the right edge over Windows' own ✕ (and ☐), which
  // only MAIN sees (the renderer's guard never gets a press there). The second click of a slower double click pressed
  // ✕ and Ted went back into the bubble instead of the normal window.
  it("a bubble parked at the top: the second click of a slower double click on the mini chat's ✕ / — / ☐ is the normal window", async () => {
    const OVERLAY_H = 36;   // electron/window.js titleBarOverlay height
    const CAPTION_W = 46;   // one Windows caption button
    const geo = rig({ store: { bubble: { x: 1900, y: -50 } } });
    await geo.c.toBubble();
    const b = geo.bubbles[0].bounds;
    expect(b).toMatchObject({ x: right(LAPTOP.workArea), y: EDGE_GAP });
    await geo.c.click();
    const m = geo.main.bounds;
    expect(m).toEqual(miniBounds({ x: b.x, y: b.y, side: "right" }, [LAPTOP]));
    const cx = b.x + S / 2 - m.x;
    const cy = b.y + S / 2 - m.y;
    expect(cx >= m.width - CAPTION_W && cx < m.width && cy >= 0 && cy < OVERLAY_H).toBe(true); // the face's centre is on ✕
    expect(DOUBLE_CLICK_MS).toBe(SYSTEM_DOUBLE_MS);

    const mainBounds = { x: 240, y: 90, width: 1200, height: 800 };
    for (const how of ["close", "minimize", "maximize"]) {
      for (const after of [0, 260, DOUBLE_CLICK_MS - 1]) { // a press inside the renderer's 260 ms guard, released up to 240 ms later
        const r = rig({ store: { bubble: { x: 1900, y: -50 } }, mainBounds });
        await r.c.toBubble();
        await r.c.click();
        r.tick(after);
        let prevented = false;
        if (how === "minimize") r.main.minimized = true;
        r.main.emit(how, { preventDefault: () => { prevented = true; } });
        await new Promise((x) => setTimeout(x, 0));
        expect(r.c.mode(), how + " " + after).toBe("normal");
        expect(r.modes).toEqual(["bubble", "mini", "normal"]);
        if (how === "close") expect(prevented).toBe(true); // ✕ never closes Ted from here
        expect(r.main.bounds).toEqual(mainBounds);
        expect(r.main.minimized).toBe(false);
        expect(r.main.visible).toBe(true);
      }
    }
    // Later than Windows' double-click time: ✕ and — are back to the bubble as always.
    for (const how of ["close", "minimize"]) {
      const r = rig({ store: { bubble: { x: 1900, y: -50 } } });
      await r.c.toBubble();
      await r.c.click();
      r.tick(DOUBLE_CLICK_MS);
      let prevented = false;
      r.main.emit(how, { preventDefault: () => { prevented = true; } });
      await new Promise((x) => setTimeout(x, 0));
      expect(r.c.mode(), how).toBe("bubble");
      if (how === "close") expect(prevented).toBe(true);
    }
    // Only the bubble's click: the mini chat from the bubble's menu („Отвори чата“) or a dialog, ✕ at once = the bubble.
    const r = rig();
    await r.c.toBubble();
    r.c.menu();
    r.menus[0].items[0].click();
    await new Promise((x) => setTimeout(x, 0));
    expect(r.c.mode()).toBe("mini");
    r.main.emit("close", { preventDefault() {} });
    await new Promise((x) => setTimeout(x, 0));
    expect(r.c.mode()).toBe("bubble");
    await r.c.beforeDialog();
    r.main.emit("close", { preventDefault() {} });
    await new Promise((x) => setTimeout(x, 0));
    expect(r.c.mode()).toBe("bubble");
    // A click, then back to the bubble (Esc) and the menu's „Отвори чата“ – still within 500 ms of the click: the bubble.
    await r.c.click();
    await r.c.toBubble();
    await r.c.miniChat();
    r.main.emit("close", { preventDefault() {} });
    await new Promise((x) => setTimeout(x, 0));
    expect(r.c.mode()).toBe("bubble");
  });

  it("a real quit (app before-quit, Windows log-off) is never held back by the mini chat", async () => {
    for (const how of ["quit", "session-end", "query-session-end"]) {
      const r = rig();
      await r.c.miniChat();
      if (how === "quit") r.c.setQuitting(); else r.main.emit(how);
      let prevented = false;
      r.main.emit("close", { preventDefault: () => { prevented = true; } });
      expect(prevented, how).toBe(false);
    }
  });

  it("the bubble's menu: Отвори чата · Нормален прозорец · Затвори Тед (a real quit)", async () => {
    const r = rig();
    expect(r.c.menu()).toEqual({ ok: false });
    await r.c.toBubble();
    expect(r.c.menu()).toEqual({ ok: true });
    const { win, items } = r.menus[0];
    expect(win).toBe(r.bubbles[0]);
    expect(items.map((i) => i.label || i.type)).toEqual(["Отвори чата", "Нормален прозорец", "separator", "Затвори Тед"]);
    items[0].click();
    await new Promise((x) => setTimeout(x, 0));
    expect(r.c.mode()).toBe("mini");
    await r.c.toBubble();
    r.c.menu();
    r.menus[1].items[1].click();
    await new Promise((x) => setTimeout(x, 0));
    expect(r.c.mode()).toBe("normal");
    await r.c.miniChat();
    await r.c.toBubble();
    r.c.menu();
    r.menus[2].items[3].click();
    expect(r.quits).toEqual([true]);
    let prevented = false;
    r.main.emit("close", { preventDefault: () => { prevented = true; } });
    expect(prevented).toBe(false);
  });

  it("a native dialog asked while only the bubble is on screen opens the mini chat first", async () => {
    const r = rig();
    expect(await r.c.beforeDialog()).toEqual({ ok: true, mode: "normal" });
    await r.c.toBubble();
    await r.c.beforeDialog();
    expect(r.c.mode()).toBe("mini");
    expect(r.main.visible).toBe(true);
  });

  it("if the bubble window dies while it is the only thing on screen, the normal window comes back", async () => {
    const r = rig();
    await r.c.toBubble();
    r.bubbles[0].destroy();
    await new Promise((x) => setTimeout(x, 0));
    expect(r.c.mode()).toBe("normal");
    expect(r.main.visible).toBe(true);
    // The next „Балонче“ makes a new bubble window.
    await r.c.toBubble();
    expect(r.bubbles).toHaveLength(2);
    expect(r.bubbles[1].visible).toBe(true);
  });
});

describe("controller: pulse, unread badge, attention", () => {
  it("answers in flight pulse; finished ones while only the bubble is shown count as unread; opening clears", async () => {
    const r = rig();
    const before = r.c.track();
    before({ ok: true }); // finished in the normal window: not unread
    await r.c.toBubble();
    const a = r.c.track();
    const b = r.c.track();
    expect(r.c.state()).toMatchObject({ working: true, unread: 0 });
    a({ ok: true, text: "x" });
    expect(r.c.state()).toMatchObject({ working: true, unread: 1 });
    a({ ok: true }); // the same call cannot count twice
    b({ ok: false, code: "network", maybeExecuted: true }); // an error is something to look at too
    expect(r.c.state()).toMatchObject({ working: false, unread: 2 });
    r.c.track()({ ok: false, code: "aborted" }); // stopped by the employee
    r.c.track()({ ok: false, code: "invalid" }); // refused before sending
    expect(r.c.state().unread).toBe(2);
    expect(r.bubbles[0].sent.at(-1)[1]).toMatchObject({ unread: 2, working: false });
    const rg = r.c.track(); // a Real GPT answer that stops at an approval card
    r.c.attention();
    expect(r.c.state().attention).toBe(true);
    await r.c.click();
    expect(r.c.state()).toMatchObject({ unread: 0 });
    // Back to the bubble without deciding: Real GPT still waits – „!“ again (review).
    await r.c.toBubble();
    expect(r.c.state().attention).toBe(true);
    expect(r.bubbles[0].sent.at(-1)[1]).toMatchObject({ attention: true });
    r.c.decided(); // „Разреши“/„Откажи“ (ted:realgpt.approve)
    expect(r.c.state().attention).toBe(false);
    r.c.attention();
    rg({ ok: true }); // the request ended (also a timeout or a stop): nothing waits any more
    expect(r.c.state().attention).toBe(false);
    await r.c.click();
    for (let i = 0; i < 1200; i++) r.c.track()({ ok: true }); // in the mini chat: never unread
    expect(r.c.state().unread).toBe(0);
  });
});

describe("bubble IPC", () => {
  function setup() {
    const handlers = new Map();
    const warned = [];
    const r = rig();
    const channels = registerBubbleIpc({ ipcMain: { handle: (c, fn) => handlers.set(c, fn) }, controller: r.c, isBubbleUrl: (u) => u === BUBBLE_URL, log: { warn: (e, f) => warned.push([e, f]), error() {} } });
    return { r, handlers, channels, warned };
  }

  it("fixed channels; accepted only from the bubble page's top frame in the bubble window", async () => {
    const { r, handlers, channels, warned } = setup();
    expect(channels.sort()).toEqual(["ted-bubble:click", "ted-bubble:dragEnd", "ted-bubble:dragMove", "ted-bubble:dragStart", "ted-bubble:menu", "ted-bubble:openNormal", "ted-bubble:ready"]);
    await r.c.toBubble();
    const bw = r.bubbles[0];
    const ok = { senderFrame: { url: BUBBLE_URL, parent: null }, sender: bw.webContents };
    const bad = [
      { senderFrame: { url: "app://ted/index.html", parent: null }, sender: bw.webContents }, // the main page
      { senderFrame: { url: BUBBLE_URL, parent: null }, sender: r.main.webContents },        // the main window
      { senderFrame: { url: BUBBLE_URL, parent: { url: BUBBLE_URL } }, sender: bw.webContents }, // a sub-frame
      { senderFrame: { url: "https://evil.example/bubble.html", parent: null }, sender: bw.webContents },
      { senderFrame: null, sender: bw.webContents }, {},
    ];
    for (const [c, fn] of handlers) for (const e of bad) await expect(fn(e), c).rejects.toThrow("forbidden");
    expect(warned.every(([e]) => e === "ipc.rejected")).toBe(true);
    expect(await handlers.get("ted-bubble:ready")(ok)).toEqual({ mode: "bubble", unread: 0, working: false, attention: false, side: "right" });
    expect(await handlers.get("ted-bubble:dragStart")(ok)).toEqual({ ok: true });
    // Non-numbers become 0; extra arguments are dropped.
    const before = bw.getBounds();
    r.tick(20);
    expect(await handlers.get("ted-bubble:dragMove")(ok, "-500", { x: 1 }, "extra")).toEqual({ ok: true });
    expect(bw.getBounds()).toEqual(before);
    expect(await handlers.get("ted-bubble:dragEnd")(ok, -2000, 0)).toEqual({ ok: true, side: "left" });
    expect(await handlers.get("ted-bubble:click")(ok)).toEqual({ ok: true, mode: "mini" });
    // The bubble is hidden now but still the bubble window: its double click asks for the normal window.
    expect(await handlers.get("ted-bubble:openNormal")(ok)).toEqual({ ok: true, mode: "normal" });
    expect(await handlers.get("ted-bubble:menu")(ok)).toEqual({ ok: false });
  });

  it("before the first „Балонче“ there is no bubble window, so every bubble channel is refused", async () => {
    const { handlers } = setup();
    for (const [c, fn] of handlers) await expect(fn({ senderFrame: { url: BUBBLE_URL, parent: null }, sender: { id: 1 } }), c).rejects.toThrow("forbidden");
  });
});

// Review of 0.1.6 (fix pass): no state in which Ted runs without anything visible on screen.
describe("controller: never an invisible Ted (review)", () => {
  it("✕ of the NORMAL window after a bubble was made once: the hidden bubble window is destroyed too (the app can quit)", async () => {
    const r = rig();
    await r.c.toBubble();
    await r.c.restore();
    expect(r.bubbles[0].visible).toBe(false);   // hidden, still alive – it alone would keep Electron running
    let prevented = false;
    r.main.emit("close", { preventDefault: () => { prevented = true; } });
    expect(prevented).toBe(false);              // a normal close
    r.main.destroyed = true;
    r.main.emit("closed");
    expect(r.bubbles[0].destroyed).toBe(true);
    expect(r.c.bubbleWindow()).toBe(null);
    expect(r.c.mode()).toBe("normal");          // the bubble's own "closed" never tries to bring a dead window back
  });

  it("the bubble page does not load in time: the window stays as it was, nothing floats, the next „Балонче“ starts afresh", async () => {
    const r = rig({ ready: false, mainBounds: { x: 120, y: 80, width: 1200, height: 780 } });
    const p = r.c.toBubble();
    await new Promise((x) => setTimeout(x, 0));
    r.advance(4000);
    expect(await p).toEqual({ ok: false, mode: "normal" });
    expect(r.main.visible).toBe(true);
    expect(r.main.top).toBe(null);
    expect(r.bubbles[0].destroyed).toBe(true);
    expect(r.floating).toEqual([true, false]);  // window.js remembers the normal bounds again
    expect(r.modes).toEqual([]);
    // From the mini chat the mini chat stays (its snapshot is kept for „Нормален прозорец“).
    const m = rig({ ready: false, mainBounds: { x: 120, y: 80, width: 1200, height: 780 } });
    await m.c.miniChat();
    const q = m.c.toBubble();
    await new Promise((x) => setTimeout(x, 0));
    m.advance(4000);
    expect(await q).toEqual({ ok: false, mode: "mini" });
    expect(m.main.visible).toBe(true);
    expect(m.floating).toEqual([true]);
    await m.c.restore();
    expect(m.main.bounds).toEqual({ x: 120, y: 80, width: 1200, height: 780 });
  });

  it("a minimised window's snapshot is its normal bounds, not the icon's place", async () => {
    const r = rig({ mainBounds: { x: 300, y: 200, width: 1000, height: 700 } });
    r.main.normal = { x: 300, y: 200, width: 1000, height: 700 };
    r.main.minimized = true;
    r.main.bounds = { x: -32000, y: -32000, width: 160, height: 28 };
    await r.c.miniChat();
    expect(r.main.minimized).toBe(false);
    await r.c.restore();
    expect(r.main.bounds).toEqual({ x: 300, y: 200, width: 1000, height: 700 });
  });

  it("a mini chat on a monitor that is unplugged comes back next to the bubble on a connected display", async () => {
    const r = rig({ displays: [LAPTOP, RIGHT], store: { bubble: { x: 1968 + 2512 - S - EDGE_GAP, y: 900 } } });
    await r.c.toBubble();
    await r.c.click();
    expect(r.main.bounds.x).toBeGreaterThan(1920);
    rig.displays = [LAPTOP];
    r.screenEvents["display-removed"].forEach((fn) => fn());
    expect(r.c.mode()).toBe("mini");
    expect(r.main.bounds).toEqual(miniBounds(defaultPosition(LAPTOP), [LAPTOP]));
    // Still on a connected display: left where the employee put it.
    r.main.bounds = { x: 500, y: 200, width: 400, height: 640 };
    r.screenEvents["display-metrics-changed"].forEach((fn) => fn());
    expect(r.main.bounds).toEqual({ x: 500, y: 200, width: 400, height: 640 });
  });
});
