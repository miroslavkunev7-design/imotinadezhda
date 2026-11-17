// „Балонче“ (0.1.6, owner: „бутон до минимизирането … програмата да се лепне в някой край на лаптопа като балонче,
// както е на сайта … щом го кликна, да се отваря като малък чат … и бутон за връщане към нормалното положение“).
//
// Three window modes, never remembered across restarts (the program always starts in the normal window):
//   normal – the usual window;
//   bubble – the main window is hidden (its renderer keeps the chat, the draft and everything else in memory) and a
//            small round always-on-top window with Ted's avatar sits at a screen edge;
//   mini   – the main window itself becomes a compact always-on-top chat panel next to where the bubble was.
// „Нормален прозорец“ puts the main window back exactly as it was (bounds, maximised, full screen).
//
// Pure geometry + a controller with every Electron object injected (no electron import), unit-tested with fakes
// (tests/unit/bubble-controller.test.js). Coordinates are Electron DIPs, the same space as screen.workArea.
import { APP_ORIGIN } from "./protocol.js";

export const BUBBLE_URL = `${APP_ORIGIN}/bubble.html`;
export const BUBBLE_SIZE = 64;                       // the bubble window (the round bubble is drawn inside it)
export const MINI_SIZE = { width: 400, height: 640 }; // the mini chat (the app's phone layout)
export const EDGE_GAP = 6;                           // bubble ↔ edge of the work area
export const PANEL_GAP = 10;                         // mini chat ↔ edge of the work area
export const MOVE_MIN_MS = 8;                        // ≤ 125 window moves per second while dragging
export const SNAP_MS = 160;                          // the snap to the nearest edge after a drag
export const DELTA_MAX = 20000;                      // |dx|, |dy| of a drag (DIP) – anything bigger is cut
export const BUBBLE_STATE = "ted-bubble:state";      // MAIN → bubble window push channel
export const DOUBLE_CLICK_MS = 500;                  // Windows' default double-click time (src/bubble/gesture.js SYSTEM_DOUBLE_MS)

const fin = (v) => typeof v === "number" && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const square = (size) => ({ width: size, height: size });

// A drag delta from the bubble renderer: a finite number, rounded, within ±DELTA_MAX; anything else is 0.
export function cleanDelta(v) {
  return fin(v) ? Math.round(clamp(v, -DELTA_MAX, DELTA_MAX)) : 0;
}

export const areaOf = (d) => (d && d.workArea) || (d && d.bounds) || null;

function overlap(r, a) {
  if (!r || !a) return 0;
  const w = Math.min(r.x + r.width, a.x + a.width) - Math.max(r.x, a.x);
  const h = Math.min(r.y + r.height, a.y + a.height) - Math.max(r.y, a.y);
  return w > 0 && h > 0 ? w * h : 0;
}

// The display whose work area holds most of rect; else the display whose full bounds hold the rect's centre (e.g. over
// its taskbar); else the one whose work area is nearest to that centre.
export function displayFor(rect, displays) {
  const list = (Array.isArray(displays) ? displays : []).filter((d) => areaOf(d));
  if (!list.length) return null;
  let best = null;
  let most = 0;
  for (const d of list) {
    const o = overlap(rect, areaOf(d));
    if (o > most) { best = d; most = o; }
  }
  if (best) return best;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const under = list.find((d) => d.bounds && cx >= d.bounds.x && cx < d.bounds.x + d.bounds.width && cy >= d.bounds.y && cy < d.bounds.y + d.bounds.height);
  if (under) return under;
  let near = Infinity;
  for (const d of list) {
    const a = areaOf(d);
    const dx = Math.max(a.x - cx, 0, cx - (a.x + a.width));
    const dy = Math.max(a.y - cy, 0, cy - (a.y + a.height));
    if (dx * dx + dy * dy < near) { near = dx * dx + dy * dy; best = d; }
  }
  return best;
}

// Keeps a box of `size` completely inside the work area `area`.
export function clampToArea(pos, size, area) {
  return {
    x: Math.round(clamp(pos.x, area.x, area.x + area.width - size.width)),
    y: Math.round(clamp(pos.y, area.y, area.y + area.height - size.height)),
  };
}

export const sideOf = (x, size, area) => (x + size / 2 < area.x + area.width / 2 ? "left" : "right");

// First time: the right edge of the work area at about 75 % of its height (like the site's bubble, bottom-right).
export function defaultPosition(display, size = BUBBLE_SIZE) {
  const a = areaOf(display) || { x: 0, y: 0, width: 1366, height: 728 };
  return {
    x: a.x + a.width - size - EDGE_GAP,
    y: Math.round(clamp(a.y + a.height * 0.75 - size / 2, a.y + EDGE_GAP, a.y + a.height - size - EDGE_GAP)),
    side: "right",
  };
}

// After a drag: the nearest left/right edge of the display the bubble is on, keeping its height (inside the work
// area – a taskbar on any side is outside the work area, so the bubble never hides under it).
export function snapToEdge(pos, displays, size = BUBBLE_SIZE) {
  const d = displayFor({ x: pos.x, y: pos.y, ...square(size) }, displays);
  const a = areaOf(d) || { x: 0, y: 0, width: 1366, height: 728 };
  const side = sideOf(pos.x, size, a);
  return {
    x: side === "left" ? a.x + EDGE_GAP : a.x + a.width - size - EDGE_GAP,
    y: Math.round(clamp(pos.y, a.y + EDGE_GAP, a.y + a.height - size - EDGE_GAP)),
    side,
  };
}

// The remembered position when it is still on a connected display (snapped again: displays, scaling and the taskbar
// may have changed), else the default position on `fallback` (the display the main window is on).
export function placeBubble(saved, displays, fallback, size = BUBBLE_SIZE) {
  if (saved && fin(saved.x) && fin(saved.y)) {
    const r = { x: saved.x, y: saved.y, ...square(size) };
    if ((Array.isArray(displays) ? displays : []).some((d) => overlap(r, areaOf(d)) > 0)) return snapToEdge(saved, displays, size);
  }
  return defaultPosition(fallback || (Array.isArray(displays) ? displays[0] : null), size);
}

// The mini chat on the bubble's side of its display, its outer edge at the screen edge and its bottom level with the
// bubble's bottom (the site's panel grows from the corner of its bubble), always inside the work area.
export function miniBounds(bubble, displays, size = MINI_SIZE, bsize = BUBBLE_SIZE) {
  const d = displayFor({ x: bubble.x, y: bubble.y, ...square(bsize) }, displays);
  const a = areaOf(d) || { x: 0, y: 0, width: 1366, height: 728 };
  const side = bubble.side === "left" || bubble.side === "right" ? bubble.side : sideOf(bubble.x, bsize, a);
  const width = Math.max(1, Math.min(size.width, a.width - 2 * PANEL_GAP));
  const height = Math.max(1, Math.min(size.height, a.height - 2 * PANEL_GAP));
  return {
    x: side === "left" ? a.x + PANEL_GAP : a.x + a.width - width - PANEL_GAP,
    y: Math.round(clamp(bubble.y + bsize - height, a.y + PANEL_GAP, a.y + a.height - height - PANEL_GAP)),
    width,
    height,
  };
}

// Saved normal bounds that no longer touch any display (a monitor was unplugged while Ted floated) are centred on
// the display of the bubble instead.
function visibleBounds(b, displays, fallback) {
  if ((Array.isArray(displays) ? displays : []).some((d) => overlap(b, areaOf(d)) >= 120 * 80)) return b;
  const a = areaOf(fallback) || areaOf((displays || [])[0]);
  if (!a) return b;
  const width = Math.min(b.width, a.width);
  const height = Math.min(b.height, a.height);
  return { x: Math.round(a.x + (a.width - width) / 2), y: Math.round(a.y + (a.height - height) / 2), width, height };
}

// main: the main BrowserWindow. setFloating(on): window.js stops remembering the floating bounds as the normal ones.
// makeBubbleWindow() -> {win, ready:Promise}. store: window-state settings ({bubble:{x,y}} is kept there).
// popupMenu(win, items), quit(), onMode(mode) are Electron glue from main.js.
export function createBubbleController({
  screen, main, setFloating = () => {}, makeBubbleWindow, store, popupMenu, quit, log, onMode,
  now = Date.now, timers = { set: setTimeout, clear: clearTimeout }, snapMs = SNAP_MS, readyMs = 4000,
}) {
  let mode = "normal";
  let snap = null;      // the normal window before it floated: {bounds, maximized, fullScreen}
  let bub = null;       // {win, ready}
  let pos = null;       // {x, y, side} of the bubble
  let drag = null;      // {x, y, at}: bubble position when the drag started, time of the last move
  let anim = null;
  let quitting = false;
  let clickedAt = -Infinity; // when the bubble's click opened the mini chat
  const st = { unread: 0, working: 0, attention: false };
  const S = BUBBLE_SIZE;

  const warn = (event, fields) => { if (log) log.warn(event, fields); };
  const alive = (w) => !!w && !(typeof w.isDestroyed === "function" && w.isDestroyed());
  const bwin = () => (bub && alive(bub.win) ? bub.win : null);
  const displays = () => { try { return screen.getAllDisplays() || []; } catch { return []; } };
  const primary = () => { try { return typeof screen.getPrimaryDisplay === "function" ? screen.getPrimaryDisplay() : null; } catch { return null; } };

  const state = () => ({ mode, unread: st.unread, working: st.working > 0, attention: st.attention, side: (pos && pos.side) || "right" });
  function sendState() {
    const w = bwin();
    const wc = w && w.webContents;
    if (wc && !(typeof wc.isDestroyed === "function" && wc.isDestroyed())) wc.send(BUBBLE_STATE, state());
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    if (onMode) { try { onMode(m); } catch (e) { warn("bubble.mode_push_failed", { message: String(e && e.message) }); } }
    sendState();
  }
  // Opening the mini chat or the normal window: the new answers are seen. A decision Real GPT still waits for is not
  // („!“ comes back if the employee returns to the bubble without „Разреши“/„Откажи“).
  function seen() {
    st.unread = 0;
  }

  // Transitions run one after another (the bubble window may still be loading when the next one is asked for).
  let chain = Promise.resolve();
  const serial = (fn) => {
    const p = chain.then(() => fn());
    chain = p.catch(() => {});
    return p;
  };

  function cancelAnim() {
    if (anim) { timers.clear(anim); anim = null; }
  }

  function ensureBubble() {
    if (bwin()) return bub;
    const made = makeBubbleWindow();
    bub = made;
    made.win.on("closed", () => {
      if (bub !== made) return;
      bub = null;
      drag = null;
      cancelAnim();
      // The bubble was the only thing on screen: never leave Ted running without a visible window.
      if (mode === "bubble" && !quitting) serial(doRestore);
    });
    return made;
  }

  function waitReady(b) {
    return new Promise((resolve) => {
      let done = false;
      const t = timers.set(() => { if (!done) { done = true; resolve(false); } }, readyMs);
      Promise.resolve(b.ready).then(() => { if (!done) { done = true; timers.clear(t); resolve(true); } }, () => { if (!done) { done = true; timers.clear(t); resolve(false); } });
    });
  }

  function takeSnapshot() {
    if (snap || !alive(main)) return;
    const maximized = !!main.isMaximized();
    const fullScreen = !!main.isFullScreen();
    // A minimised window's getBounds() is its icon's place (Windows: -32000), never the window the employee had.
    const normalBounds = maximized || fullScreen || (typeof main.isMinimized === "function" && main.isMinimized());
    snap = { bounds: normalBounds ? main.getNormalBounds() : main.getBounds(), maximized, fullScreen };
    setFloating(true);
  }

  function placeNow() {
    const ds = displays();
    const from = pos || ((store && store.get && store.get()) || {}).bubble;
    const mainDisplay = displayFor(snap ? snap.bounds : main.getBounds(), ds) || primary();
    pos = placeBubble(from, ds, mainDisplay, S);
    return pos;
  }

  async function doToBubble() {
    clickedAt = -Infinity;
    if (!alive(main)) return { ok: false, mode };
    if (mode === "bubble" && bwin()) return { ok: true, mode };
    const hadSnap = !!snap;
    takeSnapshot();
    const b = ensureBubble();
    const p = placeNow();
    b.win.setBounds({ x: p.x, y: p.y, ...square(S) });
    const ok = await waitReady(b);
    if (!alive(main)) return { ok: false, mode };
    if (!ok || !bwin()) {
      // The bubble page did not load (or not in time): hiding the window now would leave Ted with nothing visible on
      // screen (an empty transparent window). The window stays as it is; the next „Балонче“ makes a fresh bubble.
      warn("bubble.not_ready", {});
      if (bub === b) { bub = null; try { if (alive(b.win)) b.win.destroy(); } catch { /* already gone */ } }
      if (!hadSnap && mode === "normal") { snap = null; setFloating(false); }
      return { ok: false, mode };
    }
    main.setAlwaysOnTop(false);
    main.hide();
    b.win.setAlwaysOnTop(true, "floating");
    b.win.setBounds({ x: p.x, y: p.y, ...square(S) });
    b.win.showInactive();
    setMode("bubble");
    return { ok: true, mode };
  }

  function doMiniChat() {
    if (!alive(main)) return { ok: false, mode };
    takeSnapshot();
    const p = pos || placeNow();
    const bounds = miniBounds(p, displays(), MINI_SIZE, S);
    if (main.isFullScreen()) main.setFullScreen(false);
    if (main.isMaximized()) main.unmaximize();
    if (main.isMinimized()) main.restore();
    main.setAlwaysOnTop(true, "floating");
    main.setBounds(bounds);
    main.show();
    main.focus();
    const w = bwin();
    if (w) w.hide();
    drag = null;
    cancelAnim();
    seen();
    // The mini chat now lies over the bubble's place: on this push the renderer takes no pointer input for the rest of
    // Windows' double-click time – the second click of a slower double click is the normal window, never „Изпрати“
    // (src/bubble/gesture.js createMiniGuard, App.jsx useMiniGuard; its title bar is client area meanwhile; Windows'
    // own caption buttons: doubleClicked() below). Sent in the same task as show(), before any input.
    setMode("mini");
    return { ok: true, mode };
  }

  function doRestore() {
    clickedAt = -Infinity;
    if (!alive(main)) return { ok: false, mode };
    const w = bwin();
    if (w) w.hide();
    drag = null;
    cancelAnim();
    main.setAlwaysOnTop(false);
    if (snap) {
      if (main.isMinimized()) main.restore();
      if (main.isFullScreen()) main.setFullScreen(false);
      if (main.isMaximized()) main.unmaximize();
      const ds = displays();
      main.setBounds(visibleBounds(snap.bounds, ds, displayFor(pos ? { x: pos.x, y: pos.y, ...square(S) } : snap.bounds, ds)));
      if (snap.maximized) main.maximize();
      if (snap.fullScreen) main.setFullScreen(true);
    } else if (main.isMinimized()) main.restore();
    snap = null;
    setFloating(false);
    main.show();
    main.focus();
    seen();
    setMode("normal");
    return { ok: true, mode };
  }

  // ---- dragging (the bubble renderer captures the pointer and reports screen deltas from the press) ----
  function dragStart() {
    const w = bwin();
    if (!w || mode !== "bubble") return { ok: false };
    cancelAnim();
    const b = w.getBounds();
    drag = { x: b.x, y: b.y, at: -Infinity };
    return { ok: true };
  }

  function dragMove(dx, dy) {
    const w = bwin();
    if (!w || !drag || mode !== "bubble") return { ok: false };
    const t = now();
    if (t - drag.at < MOVE_MIN_MS) return { ok: true, skipped: true };
    drag.at = t;
    const raw = { x: drag.x + cleanDelta(dx), y: drag.y + cleanDelta(dy) };
    const d = displayFor({ ...raw, ...square(S) }, displays());
    const p = d ? clampToArea(raw, square(S), areaOf(d)) : raw;
    w.setBounds({ x: p.x, y: p.y, ...square(S) });
    return { ok: true };
  }

  function animateTo(w, target) {
    cancelAnim();
    const from = w.getBounds();
    const put = (x, y) => w.setBounds({ x: Math.round(x), y: Math.round(y), ...square(S) });
    if (!snapMs || snapMs <= 0) { put(target.x, target.y); return; }
    const t0 = now();
    const step = () => {
      anim = null;
      if (!alive(w)) return;
      const k = Math.min(1, (now() - t0) / snapMs);
      const e = 1 - Math.pow(1 - k, 3); // ease-out
      put(from.x + (target.x - from.x) * e, from.y + (target.y - from.y) * e);
      if (k < 1) anim = timers.set(step, 16);
    };
    anim = timers.set(step, 16);
  }

  function dragEnd(dx, dy) {
    const w = bwin();
    if (!w || !drag || mode !== "bubble") { drag = null; return { ok: false }; }
    const raw = { x: drag.x + cleanDelta(dx), y: drag.y + cleanDelta(dy) };
    drag = null;
    const target = snapToEdge(raw, displays(), S);
    pos = target;
    try { if (store && store.set) store.set({ bubble: { x: target.x, y: target.y } }); } catch (e) { warn("bubble.position_not_saved", { message: String(e && e.message) }); }
    animateTo(w, target);
    sendState();
    return { ok: true, side: target.side };
  }

  function menu() {
    const w = bwin();
    if (!w || mode !== "bubble" || !popupMenu) return { ok: false };
    popupMenu(w, [
      { label: "Отвори чата", click: () => { serial(doMiniChat); } },
      { label: "Нормален прозорец", click: () => { serial(doRestore); } },
      { type: "separator" },
      { label: "Затвори Тед", click: () => { quitting = true; if (quit) quit(); } },
    ]);
    return { ok: true };
  }

  // A Ted / Real GPT answer in flight (ipc.js observe): the bubble pulses; a finished answer while only the bubble is
  // on screen raises the unread badge (a refused-before-sending or user-stopped request does not).
  function track() {
    st.working += 1;
    sendState();
    let done = false;
    return (result) => {
      if (done) return;
      done = true;
      st.working = Math.max(0, st.working - 1);
      if (!st.working) st.attention = false; // no request in flight: nothing can be waiting for a decision
      const code = result && typeof result === "object" ? result.code : undefined;
      if (mode === "bubble" && code !== "aborted" && code !== "invalid") st.unread = Math.min(999, st.unread + 1);
      sendState();
    };
  }

  // Real GPT waits for the employee's decision on an approval card (shown as „!“ whenever only the bubble is on screen,
  // also when the card came in the mini chat and the employee went back to the bubble without deciding) …
  function attention() {
    st.attention = true;
    sendState();
  }
  // … until the employee decides (ted:realgpt.approve) or the request ends.
  function decided() {
    if (!st.attention) return;
    st.attention = false;
    sendState();
  }

  // A native Windows dialog needs a visible owner: from the bubble, the mini chat opens first.
  function beforeDialog() {
    return mode === "bubble" ? serial(doMiniChat) : Promise.resolve({ ok: true, mode });
  }

  // Displays added/removed/rescaled, the taskbar moved: the bubble stays on a visible edge, and a mini chat left on a
  // display that is gone comes back next to the bubble's (new) place.
  const onDisplays = () => {
    if (mode === "mini" && alive(main)) {
      const ds = displays();
      if (ds.length && !ds.some((d) => overlap(main.getBounds(), areaOf(d)) >= 120 * 80)) {
        main.setBounds(miniBounds(placeNow(), ds, MINI_SIZE, S));
      }
      return;
    }
    const w = bwin();
    if (!w || mode !== "bubble" || drag) return;
    cancelAnim();
    placeNow();
    w.setBounds({ x: pos.x, y: pos.y, ...square(S) });
    sendState();
  };
  if (screen && typeof screen.on === "function") {
    for (const ev of ["display-added", "display-removed", "display-metrics-changed"]) screen.on(ev, onDisplays);
  }

  // The bubble's click opens the mini chat over the bubble's place; when the bubble sits at the top of the screen that is
  // the mini chat's title bar, i.e. Windows' own caption buttons (✕ / ☐ / —), which the renderer's guard never sees. The
  // second click of a slower double click pressing one of them (released up to Windows' double-click time after the
  // opening: a press within the guard plus its hold) is that double click – the normal window, never back to the bubble.
  function doubleClicked() {
    return now() - clickedAt < DOUBLE_CLICK_MS;
  }
  function doClick() {
    const r = doMiniChat();
    if (r.ok) clickedAt = now();
    return r;
  }

  // The main window's own caption buttons while it is the mini chat: – and × go back to the bubble (× never quits
  // from there), □ is the normal window. A real quit (bubble menu, update install, Windows log-off) is never held back.
  if (alive(main)) {
    main.on("close", (e) => {
      if (quitting || mode !== "mini") return;
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      serial(doubleClicked() ? doRestore : doToBubble);
    });
    main.on("minimize", () => { if (mode === "mini" && !quitting) serial(doubleClicked() ? doRestore : doToBubble); });
    main.on("maximize", () => { if (mode === "mini" && !quitting) serial(doRestore); });
    for (const ev of ["session-end", "query-session-end"]) main.on(ev, () => { quitting = true; });
    // The main window is gone (✕ in the normal window, a real quit): a hidden bubble window made earlier must not keep
    // Ted running without any visible window (window-all-closed would never come, a second launch would find nothing).
    main.on("closed", () => {
      quitting = true;
      drag = null;
      cancelAnim();
      const w = bwin();
      bub = null;
      if (w) { try { w.destroy(); } catch { /* already gone */ } }
    });
  }

  return {
    mode: () => mode,
    state,
    toBubble: () => serial(doToBubble),
    miniChat: () => serial(doMiniChat),
    restore: () => serial(doRestore),
    click: () => (mode === "bubble" ? serial(doClick) : Promise.resolve({ ok: false, mode })),
    openNormal: () => serial(doRestore),
    dragStart, dragMove, dragEnd, menu, track, attention, decided, beforeDialog,
    setQuitting: () => { quitting = true; },
    bubbleWindow: bwin,
    isBubbleSender: (event) => {
      const w = bwin();
      const s = event && event.sender;
      return !!w && !!s && !!w.webContents && (s === w.webContents || (s.id != null && s.id === w.webContents.id));
    },
  };
}

// The bubble window's own IPC (preload-bubble.cjs): fixed channels "ted-bubble:<fn>", accepted only from the top frame
// of the bubble page in the bubble window – never from the main window, never with anything but two numbers.
export function registerBubbleIpc({ ipcMain, controller, isBubbleUrl, log }) {
  const handlers = {
    "ted-bubble:ready": () => controller.state(),
    "ted-bubble:dragStart": () => controller.dragStart(),
    "ted-bubble:dragMove": (dx, dy) => controller.dragMove(cleanDelta(dx), cleanDelta(dy)),
    "ted-bubble:dragEnd": (dx, dy) => controller.dragEnd(cleanDelta(dx), cleanDelta(dy)),
    "ted-bubble:click": () => controller.click(),
    "ted-bubble:openNormal": () => controller.openNormal(),
    "ted-bubble:menu": () => controller.menu(),
  };
  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, ...args) => {
      const frame = event && event.senderFrame;
      if (!frame || frame.parent || !isBubbleUrl(frame.url) || !controller.isBubbleSender(event)) {
        if (log) log.warn("ipc.rejected", { channel });
        throw new Error("ted: forbidden sender");
      }
      try {
        const r = await fn(...args.slice(0, 2));
        return r && typeof r === "object" ? { ...r } : { ok: true };
      } catch (e) {
        if (log) log.error("ipc.failed", { channel, message: String((e && e.message) || e) });
        return { ok: false, code: "internal" };
      }
    });
  }
  return Object.keys(handlers);
}
