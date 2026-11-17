// The bubble's pointer gesture and badge text (0.1.6 „Балонче“), pure and unit-tested (tests/unit/bubble-gesture.test.js):
//   press + move ≥ 4 px  -> a drag: dragStart, dragMove(dx, dy)…, dragEnd(dx, dy)   (screen deltas from the press)
//   press + release < 4 px -> a click, sent DOUBLE_MS after the release (a single click stays quick)
//   a second press while that click still waits -> "double" on its release instead of two clicks (a drag: the click is
//     dropped; the pointer lost: still "double")
//   a second press after the click was sent, within Windows' double-click time of the first press (SYSTEM_DOUBLE_MS,
//     press to press like Windows) -> "double" at once: the mini chat is just opening, the normal window follows (when the
//     press lands on the mini chat instead, its own guard takes it – createMiniGuard below)
//   cancel (pointer lost) -> a running drag still ends (the bubble snaps); a first click is dropped
// emit(action, ...args) receives "dragStart" | "dragMove" | "dragEnd" | "click" | "double".
export const DRAG_SLOP = 4;
export const DOUBLE_MS = 240;
export const SYSTEM_DOUBLE_MS = 500;                     // Windows' default double-click time (GetDoubleClickTime)
export const MINI_GUARD_MS = SYSTEM_DOUBLE_MS - DOUBLE_MS; // the rest of it once the single click has opened the mini chat

export const isDrag = (dx, dy, slop = DRAG_SLOP) => Math.hypot(dx, dy) >= slop;

const clock = () => (typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now());

// The badge: „!“ when Real GPT waits for the employee's decision (Ted is blocked until then – it goes first), else the
// unread answers (99+), else nothing.
export function badgeText(s) {
  if (s && s.attention === true) return "!";
  const n = Math.max(0, Math.floor(Number(s && s.unread) || 0));
  return n ? (n > 99 ? "99+" : String(n)) : "";
}

export function createGesture({ emit, slop = DRAG_SLOP, doubleMs = DOUBLE_MS, systemDoubleMs = SYSTEM_DOUBLE_MS, now = clock, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let down = null;         // {x, y} of the press
  let dragging = false;
  let second = false;      // this press is the second click of a double click (its first click still waited)
  let clickTimer = null;
  let pressAt = -Infinity; // when the press of the last single click began
  let sentAt = -Infinity;  // the same, once that click was sent (until the next gesture)

  const delta = (x, y) => [Math.round(x - down.x), Math.round(y - down.y)];

  function click() {
    clickTimer = setTimer(() => { clickTimer = null; sentAt = pressAt; emit("click"); }, doubleMs);
  }
  function double() {
    sentAt = -Infinity;
    emit("double");
  }

  return {
    down(x, y) {
      const t = now();
      dragging = false;
      second = false;
      if (clickTimer) { clearTimer(clickTimer); clickTimer = null; second = true; down = { x, y }; return; }
      if (t - sentAt < systemDoubleMs) { down = null; double(); return; } // the rest of this press is ignored
      sentAt = -Infinity;
      pressAt = t;
      down = { x, y };
    },
    move(x, y) {
      if (!down) return;
      const [dx, dy] = delta(x, y);
      if (!dragging) {
        if (!isDrag(dx, dy, slop)) return;
        dragging = true;
        second = false; // a drag after a click is not a double click (and the click is dropped)
        emit("dragStart");
      }
      emit("dragMove", dx, dy);
    },
    up(x, y) {
      if (!down) return;
      const [dx, dy] = delta(x, y);
      const was = dragging;
      const sec = second;
      down = null;
      dragging = false;
      second = false;
      if (was) emit("dragEnd", dx, dy);
      else if (isDrag(dx, dy, slop)) { emit("dragStart"); emit("dragEnd", dx, dy); } // a fast flick without moves
      else if (sec) double();
      else click();
    },
    cancel(x, y) {
      if (!down) return;
      const was = dragging;
      const sec = second;
      const [dx, dy] = Number.isFinite(x) && Number.isFinite(y) ? delta(x, y) : [0, 0];
      down = null;
      dragging = false;
      second = false;
      if (was) emit("dragEnd", dx, dy);
      else if (sec) double();
    },
    dragging: () => dragging,
  };
}

// The mini chat's guard (src/App.jsx, docs/CONTRACT.md §22). The single click opens the mini chat over the bubble's place
// (its bottom corner: „Изпрати“ / „Гласов режим“ / „Спри“, on the left edge „Добави“), so the second press of a slower
// double click – still a double click for Windows – would press one of them. For MINI_GUARD_MS after MAIN reports
// "bubble" -> "mini" the main window takes no pointer input: every press, release and click is swallowed (a press taken
// here also up to its release and that release's click, however long it is held and also when the normal window has
// come meanwhile; a touch tap's mouse events and click, which Chromium sends only after the release, up to TAP_MS later or
// until the next press). The first left press taken is that double click: onDouble() (the normal window) while it is still
// the mini chat – so is a left release whose press never came here (it hit the bubble just as MAIN hid it).
// The main window is hidden in "bubble" mode: pointer input it gets in that mode means MAIN has just shown it and the mode
// push is still on the way (input and IPC are not ordered) – held the same way, at most guardMs from the first such event;
// a double click taken then is done when "mini" arrives. Pointer moves, keys and keyboard/script clicks (detail 0) always
// go through.
// mode(m): every mode MAIN reports; swallow(event) -> true: the caller cancels the event before any handler sees it.
// regionsOff() -> ms (Infinity in "bubble" mode, 0 = none): the title bar must not be a drag region meanwhile – a press
// there would be Windows' (moving the window), never reaching swallow(); App.jsx turns it into client area.
export const TAP_MS = SYSTEM_DOUBLE_MS;
const RELEASE = new Set(["pointerup", "pointercancel", "mouseup"]);
const CLICKS = new Set(["click", "dblclick", "auxclick", "contextmenu"]);

export function createMiniGuard({ onDouble = () => {}, guardMs = MINI_GUARD_MS, tapMs = TAP_MS, now = clock } = {}) {
  let mode = null;
  let until = -Infinity;
  let hidden = null;          // end of the hold for input that came in "bubble" mode (null: no such input yet)
  let held = false;           // a press taken here is still down
  let after = -Infinity;      // its release was taken: so are its mouse events and click until then (or the next press)
  let doubled = true;         // the double click of this opening was handled already
  let pending = false;        // a double click taken in "bubble" mode, done on "mini"

  function active(t) {
    if (t < until) return true;
    if (mode !== "bubble") return false;
    if (hidden === null) hidden = t + guardMs;
    return t < hidden;
  }
  function double() {
    if (doubled) return;
    doubled = true;
    if (mode === "mini") onDouble();
    else if (mode === "bubble") pending = true;
  }

  return {
    mode(m) {
      if (m === mode) return; // the first state() answer may repeat a push
      const was = mode;
      const take = pending;
      mode = m;
      hidden = null;
      pending = false;
      if (m === "bubble" && was !== "bubble") { doubled = false; held = false; after = -Infinity; } // the main window hides
      else if (m === "mini" && was === "bubble") { until = now() + guardMs; after = -Infinity; if (take) onDouble(); }
      else if (was === "bubble") doubled = true; // bubble -> normal: nothing left to do
    },
    swallow(e) {
      const type = e && e.type;
      const t = now();
      const on = active(t);
      const tail = t < after;
      if (type === "pointerdown") {
        after = -Infinity;
        if (!on) { held = false; return false; } // after the guard every press is the employee's own (a lost release is forgotten)
        held = true;
        if (e.button === 0) double();
        return true;
      }
      if (type === "mousedown") return on || held || tail; // the press's own mouse event, a tap's, or another button while held
      if (RELEASE.has(type)) {
        if (held && type !== "mouseup") { held = false; after = t + tapMs; return true; }
        if (on && !held && !tail) {
          after = t + tapMs;
          if (e.button === 0 && type !== "pointercancel") double(); // its press went to the bubble as MAIN hid it
          return true;
        }
        return on || held || tail;
      }
      if (CLICKS.has(type)) {
        if (type === "contextmenu") return on || held || (tail && e.button === 2);
        return (on || held || tail) && Number(e.detail) > 0;
      }
      return false;
    },
    regionsOff() {
      if (mode === "bubble") return Infinity;
      return Math.max(0, until - now());
    },
  };
}
