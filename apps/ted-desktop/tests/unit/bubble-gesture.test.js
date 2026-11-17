// „Балонче“ (0.1.6): the bubble page's pointer gesture (src/bubble/gesture.js) – click vs drag, double click, cancel –
// and the mini chat's guard against the second click of a slower (Windows) double click (release gate 0.1.6, C4/C6).
import { describe, it, expect } from "vitest";
import { DRAG_SLOP, DOUBLE_MS, MINI_GUARD_MS, SYSTEM_DOUBLE_MS, TAP_MS, badgeText, createGesture, createMiniGuard, isDrag } from "../../src/bubble/gesture.js";

function make() {
  const out = [];
  const timers = [];
  const clock = { t: 0 };
  const g = createGesture({
    emit: (...a) => out.push(a),
    now: () => clock.t,
    setTimer: (fn, ms) => { const h = { fn, ms }; timers.push(h); return h; },
    clearTimer: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); },
  });
  const fire = () => { const t = timers.splice(0); t.forEach((h) => h.fn()); };
  return { g, out, timers, fire, clock };
}

// A fake time line: timers run in order when the clock is moved past them.
function timeline() {
  const q = [];
  const tl = {
    t: 0,
    now: () => tl.t,
    set: (fn, ms) => { const h = { at: tl.t + ms, fn }; q.push(h); return h; },
    clear: (h) => { const i = q.indexOf(h); if (i >= 0) q.splice(i, 1); },
    to(ms) {
      for (;;) {
        q.sort((a, b) => a.at - b.at);
        const h = q[0];
        if (!h || h.at > ms) break;
        q.shift();
        tl.t = h.at;
        h.fn();
      }
      tl.t = ms;
    },
  };
  return tl;
}

const ev = (type, extra = {}) => ({ type, button: 0, detail: 1, ...extra });

describe("bubble gesture", () => {
  it("the threshold: less than 4 px is a click, 4 px or more a drag", () => {
    expect(DRAG_SLOP).toBe(4);
    expect(isDrag(0, 0)).toBe(false);
    expect(isDrag(3, 0)).toBe(false);
    expect(isDrag(2, 2)).toBe(false);   // 2.83 px
    expect(isDrag(2.9, 2.9)).toBe(true); // 4.1 px
    expect(isDrag(0, -4)).toBe(true);
    expect(isDrag(-3, 3)).toBe(true);    // 4.24 px
  });

  it("press + small wobble + release = one click, after the double-click wait", () => {
    const { g, out, timers, fire } = make();
    g.down(500, 300);
    g.move(502, 301);
    g.move(501, 302);
    g.up(502, 302);
    expect(out).toEqual([]);
    expect(timers.map((t) => t.ms)).toEqual([DOUBLE_MS]);
    fire();
    expect(out).toEqual([["click"]]);
  });

  it("two clicks in a row = a double click (the normal window), never two clicks", () => {
    const { g, out, fire } = make();
    g.down(10, 10); g.up(10, 10);
    g.down(11, 10); g.up(11, 11);
    fire();
    expect(out).toEqual([["double"]]);
  });

  it("a drag: dragStart once, moves with deltas from the press, dragEnd with the final delta; no click", () => {
    const { g, out, timers } = make();
    g.down(1800, 700);
    g.move(1798, 699);   // still inside the slop
    g.move(1790, 690);   // now a drag
    g.move(1500, 650);
    g.up(1400, 640);
    expect(out).toEqual([["dragStart"], ["dragMove", -10, -10], ["dragMove", -300, -50], ["dragEnd", -400, -60]]);
    expect(timers).toHaveLength(0);
  });

  it("a fast flick without move events is still a drag (the bubble snaps), not a click", () => {
    const { g, out, timers } = make();
    g.down(100, 100);
    g.up(160, 100);
    expect(out).toEqual([["dragStart"], ["dragEnd", 60, 0]]);
    expect(timers).toHaveLength(0);
  });

  it("a lost pointer ends a running drag (snap) and drops a click; stray events without a press do nothing", () => {
    const a = make();
    a.g.down(0, 0); a.g.move(20, 0); a.g.cancel(30, 5);
    expect(a.out).toEqual([["dragStart"], ["dragMove", 20, 0], ["dragEnd", 30, 5]]);
    const b = make();
    b.g.down(0, 0); b.g.cancel(1, 1);
    b.g.move(50, 50); b.g.up(50, 50); b.g.cancel();
    b.fire();
    expect(b.out).toEqual([]);
    const c = make();
    c.g.down(0, 0); c.g.move(9, 0); c.g.cancel(NaN, undefined);
    expect(c.out.at(-1)).toEqual(["dragEnd", 0, 0]);
  });

  it("a click followed by a drag is not a double click", () => {
    const { g, out, fire } = make();
    g.down(0, 0); g.up(0, 0);
    g.down(0, 0); g.move(30, 0); g.up(30, 0);
    fire();
    expect(out).toEqual([["dragStart"], ["dragMove", 30, 0], ["dragEnd", 30, 0]]);
  });

  it("Windows' double-click time: 500 ms press to press; the single click still waits only 240 ms; the mini chat's guard is the rest", () => {
    expect(DOUBLE_MS).toBe(240);
    expect(SYSTEM_DOUBLE_MS).toBe(500);
    expect(MINI_GUARD_MS).toBe(260);
  });

  it("a second press while the click still waits is the double click, even when it is released after the click would have been sent", () => {
    const { g, out, timers, clock } = make();
    g.down(10, 10); clock.t = 90; g.up(10, 10);
    clock.t = 319; g.down(10, 10);   // the gate's 319 ms (press to press): the click was due at 330
    expect(timers).toHaveLength(0);  // the waiting click is gone – never sent while the button is down again
    clock.t = 409; g.up(10, 10);
    expect(out).toEqual([["double"]]);
    // A lost pointer during that second press is still the double click (before: the click was sent, the double lost).
    const b = make();
    b.g.down(0, 0); b.g.up(0, 0); b.g.down(0, 0); b.g.cancel(0, 0);
    b.fire();
    expect(b.out).toEqual([["double"]]);
  });

  it("a slower double click (Windows: within 500 ms of the first press) after the click was sent is still the double click – at once", () => {
    for (const gap of [368, 417, 499]) {   // the gate's real-Electron sweep (press to press)
      const { g, out, fire, timers, clock } = make();
      g.down(32, 32); clock.t = 90; g.up(32, 32);
      clock.t = 330; fire();               // the single click is sent: MAIN opens the mini chat
      clock.t = gap; g.down(32, 32);
      expect(out).toEqual([["click"], ["double"]]); // the normal window follows the mini chat
      clock.t = gap + 90; g.up(32, 32);    // the rest of that press is nothing
      g.move(80, 32);
      fire();
      expect(out).toEqual([["click"], ["double"]]);
      expect(timers).toHaveLength(0);
    }
  });

  it("after Windows' double-click time a press is a new click; after a double click the next press starts afresh (no triple)", () => {
    const a = make();
    a.g.down(0, 0); a.clock.t = 90; a.g.up(0, 0);
    a.clock.t = 330; a.fire();
    a.clock.t = 500; a.g.down(0, 0); a.clock.t = 590; a.g.up(0, 0);
    a.clock.t = 830; a.fire();
    expect(a.out).toEqual([["click"], ["click"]]);
    const b = make();
    b.g.down(0, 0); b.g.up(0, 0); b.g.down(0, 0); b.g.up(0, 0); // double
    b.clock.t = 100; b.g.down(0, 0); b.g.up(0, 0);              // a third press within 500 ms: a fresh first click
    expect(b.timers.map((t) => t.ms)).toEqual([DOUBLE_MS]);
    b.fire();
    expect(b.out).toEqual([["double"], ["click"]]);
    // A drag between a sent click and the next press: the next press is a fresh click.
    const c = make();
    c.g.down(0, 0); c.g.up(0, 0); c.fire();
    c.clock.t = 600; c.g.down(0, 0); c.g.move(30, 0); c.g.up(30, 0);
    c.clock.t = 700; c.g.down(30, 0); c.g.up(30, 0); c.fire();
    expect(c.out.map((x) => x[0])).toEqual(["click", "dragStart", "dragMove", "dragEnd", "click"]);
  });

  it("the badge: unread count (99+), „!“ when Real GPT waits for a decision, nothing otherwise", () => {
    expect(badgeText({ unread: 0 })).toBe("");
    expect(badgeText({ unread: 3 })).toBe("3");
    expect(badgeText({ unread: 120 })).toBe("99+");
    expect(badgeText({ unread: 0, attention: true })).toBe("!");
    expect(badgeText({ unread: 2, attention: true })).toBe("!"); // a decision Ted waits for goes first
    expect(badgeText({ unread: 2, attention: "yes" })).toBe("2");
    expect(badgeText(null)).toBe("");
    expect(badgeText({ unread: "x" })).toBe("");
  });
});

// The mini chat's guard (src/App.jsx useMiniGuard): what the main window does with pointer input right after MAIN has
// turned the bubble into the mini chat.
describe("mini chat guard (the second click of a double click on the bubble)", () => {
  function makeGuard() {
    const tl = timeline();
    const doubles = [];
    const guard = createMiniGuard({ onDouble: () => doubles.push(tl.t), now: tl.now });
    return { guard, doubles, tl, sw: (type, extra) => guard.swallow(ev(type, extra)) };
  }

  it("only bubble -> mini arms it: the program started as a mini chat, or the normal window, takes every click", () => {
    const { guard, doubles, sw } = makeGuard();
    for (const m of ["normal", "mini"]) {
      guard.mode(m);
      expect(["pointerdown", "mousedown", "pointerup", "mouseup", "click", "contextmenu"].map((t) => sw(t))).toEqual([false, false, false, false, false, false]);
    }
    guard.mode("bubble"); guard.mode("normal"); // the bubble's double click / „Нормален прозорец“: not armed either
    expect(sw("pointerdown")).toBe(false);
    expect(doubles).toEqual([]);
  });

  it("for 260 ms after bubble -> mini every press, release and click is swallowed; the first left press is the double click (normal window)", () => {
    const { guard, doubles, sw, tl } = makeGuard();
    guard.mode("bubble");
    tl.to(1000);
    guard.mode("mini");                 // MAIN has just shown the mini chat over the bubble's place
    tl.to(1030);
    expect([sw("pointerdown"), sw("mousedown"), sw("pointerup"), sw("mouseup"), sw("click"), sw("dblclick", { detail: 2 })]).toEqual([true, true, true, true, true, true]);
    expect(doubles).toEqual([1030]);    // -> ted.window.restore()
    tl.to(1100);
    expect(sw("pointerdown")).toBe(true); // a further press inside the guard: swallowed, not a second restore
    expect(sw("pointerup")).toBe(true);
    expect(sw("click")).toBe(true);
    expect(sw("contextmenu", { button: 2 })).toBe(true);
    expect(doubles).toEqual([1030]);
    // Moves, keys and keyboard/script clicks are not pointer presses: never swallowed.
    expect([sw("pointermove"), sw("keydown"), sw("click", { detail: 0 })]).toEqual([false, false, false]);
    // After the guard a click works as always (a single click never waits).
    tl.to(1000 + MINI_GUARD_MS);
    expect([sw("pointerdown"), sw("mousedown"), sw("pointerup"), sw("mouseup"), sw("click")]).toEqual([false, false, false, false, false]);
  });

  it("a press taken by the guard stays taken up to its release and that release's click, however long it is held", () => {
    const { guard, doubles, sw, tl } = makeGuard();
    guard.mode("bubble"); guard.mode("mini");
    tl.to(200);
    expect(sw("pointerdown")).toBe(true);
    guard.mode("normal");               // the double click brought the normal window back meanwhile
    tl.to(900);                         // the button is still down long after the guard
    expect(sw("pointerup")).toBe(true);
    expect(sw("mouseup")).toBe(true);
    expect(sw("click")).toBe(true);     // „Изпрати“ / „Спри“ under the pointer is never clicked
    expect(sw("click", { detail: 0 })).toBe(false);
    tl.to(901);                         // a later task (a touch tap's click comes only then): still nothing
    expect(sw("click")).toBe(true);
    expect(sw("pointerdown")).toBe(false); // the employee's next press is their own, at once
    expect(sw("mousedown")).toBe(false);
    expect(sw("pointerup")).toBe(false);
    expect(sw("click")).toBe(false);
    expect(doubles).toEqual([200]);
  });

  // Release gate 0.1.6, attack on the first fix: a touch double tap. Chromium sends a tap's mousedown/mouseup/click only
  // after the touch has ended (GestureTap, a later task than pointerup) – the guard had already let go by then.
  it("a touch tap pressed inside the guard and released after it: its mouse events and click, sent later, press nothing", () => {
    for (const hold of [MINI_GUARD_MS + 40, 150]) {
      const { guard, doubles, sw, tl } = makeGuard();
      guard.mode("bubble"); guard.mode("mini");   // MAIN: the single tap on the bubble opened the mini chat
      tl.to(MINI_GUARD_MS - 20);
      expect(sw("pointerdown", { pointerType: "touch" })).toBe(true);
      tl.to(MINI_GUARD_MS - 20 + hold);           // released after the guard
      expect(sw("pointerup", { pointerType: "touch" })).toBe(true);
      tl.to(MINI_GUARD_MS - 20 + hold + 3);       // the GestureTap: compat mouse events + click, all after the guard
      expect(["mousedown", "mouseup", "click"].filter((t) => !sw(t))).toEqual([]);
      expect(doubles).toEqual([MINI_GUARD_MS - 20]);
      // A tap that never became a click (moved / cancelled) holds nothing back for long: TAP_MS, or the next press.
      tl.to(MINI_GUARD_MS - 20 + hold + TAP_MS);
      expect(sw("click")).toBe(false);
      expect(sw("contextmenu", { button: 0, detail: 0 })).toBe(false); // the context-menu key
    }
    expect(TAP_MS).toBe(SYSTEM_DOUBLE_MS);
  });

  // Release gate 0.1.6, attack on the first fix: the second press hit the bubble just as MAIN hid it (the click IPC →
  // hide round trip, ~5–10 ms) – the hidden bubble dropped it and only its release reached the mini chat.
  it("a left release whose press never came here (it was lost to the bubble as MAIN hid it) is the double click", () => {
    const { guard, doubles, sw, tl } = makeGuard();
    guard.mode("bubble"); guard.mode("mini");
    tl.to(10);
    expect(sw("pointerup")).toBe(true);
    expect(sw("mouseup")).toBe(true);
    expect(sw("click")).toBe(true);
    expect(doubles).toEqual([10]);               // -> ted.window.restore(), not left in the mini chat
    tl.to(40);
    expect(sw("pointerup")).toBe(true);          // nothing twice
    expect(doubles).toEqual([10]);
    // A right release, a cancelled one or one after the guard is not the double click.
    for (const [type, extra, at] of [["pointerup", { button: 2 }, 10], ["mouseup", { button: 2 }, 10], ["pointercancel", {}, 10], ["pointerup", {}, MINI_GUARD_MS + 1]]) {
      const b = makeGuard();
      b.guard.mode("bubble"); b.guard.mode("mini");
      b.tl.to(at);
      b.sw(type, extra);
      expect(b.doubles, type + " " + at).toEqual([]);
    }
  });

  // Release gate 0.1.6, residual risk: input and the mode push are not ordered – the second press can be dispatched
  // before the renderer has the "mini" push. The main window is hidden in "bubble" mode, so input then means it was
  // just shown.
  it("input that comes before the mini push (renderer still in bubble mode) is held too; the double click is done on „mini“", () => {
    const { guard, doubles, sw, tl } = makeGuard();
    guard.mode("normal"); guard.mode("bubble");
    tl.to(2633);
    expect(sw("pointerdown")).toBe(true);
    expect(doubles).toEqual([]);                 // still "bubble": not yet
    tl.to(2642);
    guard.mode("mini");                          // the push arrives
    expect(doubles).toEqual([2642]);
    tl.to(2700);
    expect([sw("pointerup"), sw("mouseup"), sw("click")]).toEqual([true, true, true]);
    expect(doubles).toEqual([2642]);
    // The whole click before the push: nothing reaches a control either.
    const b = makeGuard();
    b.guard.mode("normal"); b.guard.mode("bubble");
    b.tl.to(100);
    expect(["pointerdown", "mousedown", "pointerup", "mouseup", "click"].map((t) => b.sw(t))).toEqual([true, true, true, true, true]);
    b.tl.to(130); b.guard.mode("mini");
    expect(b.doubles).toEqual([130]);
    // A lost press's release before the push: the same.
    const c = makeGuard();
    c.guard.mode("normal"); c.guard.mode("bubble");
    c.tl.to(100); expect(c.sw("pointerup")).toBe(true);
    c.tl.to(104); c.guard.mode("mini");
    expect(c.doubles).toEqual([104]);
    // bubble -> normal (the bubble's double click / „Нормален прозорец“): held until the push, then nothing to do.
    const d = makeGuard();
    d.guard.mode("normal"); d.guard.mode("bubble");
    d.tl.to(100); expect(d.sw("pointerdown")).toBe(true);
    d.tl.to(110); d.guard.mode("normal");
    expect(d.sw("pointerup")).toBe(true);        // its own release
    expect(d.sw("pointerdown")).toBe(false);
    expect(d.doubles).toEqual([]);
    // Never stuck: a window shown in bubble mode without a push takes clicks again after 260 ms of the first one.
    const e = makeGuard();
    e.guard.mode("normal"); e.guard.mode("bubble");
    e.tl.to(5000); expect(e.sw("pointerdown")).toBe(true); e.sw("pointerup");
    e.tl.to(5000 + MINI_GUARD_MS);
    expect([e.sw("pointerdown"), e.sw("mousedown"), e.sw("pointerup"), e.sw("mouseup"), e.sw("click")]).toEqual([false, false, false, false, false]);
  });

  // Release gate 0.1.6, attack on the first fix: a bubble parked at the top puts the mini chat's header under it – its
  // drag region is Windows' (a press there moves the window and never reaches the page). While the guard holds (and while
  // hidden behind the bubble) App.jsx makes the header client area: html.mini-guard.
  it("regionsOff: the whole bubble mode and the 260 ms after bubble -> mini; never otherwise", () => {
    const { guard, tl } = makeGuard();
    expect(guard.regionsOff()).toBe(0);
    guard.mode("normal");
    expect(guard.regionsOff()).toBe(0);
    guard.mode("bubble");
    expect(guard.regionsOff()).toBe(Infinity);
    tl.to(1000); guard.mode("mini");
    expect(guard.regionsOff()).toBe(MINI_GUARD_MS);
    tl.to(1100); guard.mode("normal");           // the double click: the normal window, still inside the guard
    expect(guard.regionsOff()).toBe(MINI_GUARD_MS - 100);
    tl.to(1000 + MINI_GUARD_MS);
    expect(guard.regionsOff()).toBe(0);
    guard.mode("bubble"); guard.mode("normal");  // bubble -> normal: nothing held
    expect(guard.regionsOff()).toBe(0);
    guard.mode("mini");                          // a mini chat not from the bubble: nothing held
    expect(guard.regionsOff()).toBe(0);
  });

  it("a release that never came (pointer lost outside the window) does not eat the employee's next click after the guard", () => {
    const { guard, sw, tl } = makeGuard();
    guard.mode("bubble"); guard.mode("mini");
    tl.to(100);
    expect(sw("pointerdown")).toBe(true);
    tl.to(3000);                        // no pointerup ever arrived
    expect(sw("pointerdown")).toBe(false);
    expect(sw("mousedown")).toBe(false);
    expect(sw("pointerup")).toBe(false);
    expect(sw("mouseup")).toBe(false);
    expect(sw("click")).toBe(false);
  });

  it("a right press or a press when the mode is no longer the mini chat is swallowed but is not the double click", () => {
    const a = makeGuard();
    a.guard.mode("bubble"); a.guard.mode("mini");
    expect(a.sw("pointerdown", { button: 2 })).toBe(true);
    expect(a.sw("pointerup", { button: 2 })).toBe(true);
    expect(a.sw("contextmenu", { button: 2 })).toBe(true);
    expect(a.doubles).toEqual([]);
    const b = makeGuard();
    b.guard.mode("bubble"); b.guard.mode("mini"); b.guard.mode("normal"); // the bubble's own double click came first
    expect(b.sw("pointerdown")).toBe(true);
    expect(b.sw("pointerup")).toBe(true);
    expect(b.doubles).toEqual([]);
    // Every new opening from the bubble arms it again.
    b.tl.to(5000);
    expect(b.sw("pointerdown")).toBe(false);
    b.sw("pointerup");
    b.tl.to(5001);
    b.guard.mode("bubble"); b.guard.mode("mini");
    b.tl.to(5100);
    expect(b.sw("pointerdown")).toBe(true);
    expect(b.doubles).toEqual([5100]);
  });
});

// The release gate's real-Electron sweep (C4/C6) in unit form: two presses of 90 ms on the bubble's spot, measured press to
// press like Windows. MAIN shows the mini chat (always on top, over the bubble's place) 5 ms after the bubble's click and
// hides the bubble, so a later press lands on the mini chat's „Изпрати“ / „Гласов режим“ / „Спри“. Every double click
// Windows would count (≤ 500 ms) ends in the normal window and no press, release or click reaches a control.
describe("a slower double click on the bubble (the gate's timing sweep)", () => {
  function sweep(gap, { hold = 90, lag = 5 } = {}) {
    const tl = timeline();
    const log = [];
    const reached = [];
    let mode = "bubble";
    let bubbleShown = true;
    const guard = createMiniGuard({ onDouble: () => toMain("restore"), now: tl.now });
    guard.mode("bubble");
    const setMode = (m) => { mode = m; guard.mode(m); };
    function toMain(what) {
      tl.set(() => {
        log.push(what);
        if (what === "click" && mode === "bubble") { setMode("mini"); bubbleShown = false; }
        if (what === "openNormal" || what === "restore") { setMode("normal"); bubbleShown = false; }
      }, lag);
    }
    const g = createGesture({ emit: (a) => { if (a === "click") toMain("click"); else if (a === "double") toMain("openNormal"); }, now: tl.now, setTimer: tl.set, clearTimer: tl.clear });
    const where = [];
    function press(at) {
      tl.to(at);
      if (bubbleShown) {
        where.push("bubble");
        g.down(32, 32);
        tl.to(at + hold);
        if (bubbleShown) g.up(32, 32); else g.cancel(32, 32);
      } else {
        where.push("mini");
        const fire = (type) => { if (!guard.swallow(ev(type))) reached.push(type); };
        fire("pointerdown");
        tl.to(at + hold);
        fire("pointerup");
        fire("click");
      }
    }
    press(0);
    press(gap);
    tl.to(gap + 2000);
    return { log, reached, mode, where };
  }

  it.each([
    [236, "bubble", ["openNormal"]],
    [319, "bubble", ["openNormal"]],          // before: the click while the button was down again – the mini chat
    [333, "bubble", ["click", "openNormal"]], // the click was just sent, the bubble not hidden yet
    [368, "mini", ["click", "restore"]],      // before: „Изпрати“ sent the draft / voice mode / „Спри“
    [417, "mini", ["click", "restore"]],
    [470, "mini", ["click", "restore"]],
    [499, "mini", ["click", "restore"]],
  ])("press to press %i ms: the second press lands on the %s; the normal window, nothing pressed", (gap, on, log) => {
    const r = sweep(gap);
    expect(r.where).toEqual(["bubble", on]);
    expect(r.log).toEqual(log);
    expect(r.mode).toBe("normal");
    expect(r.reached).toEqual([]);
  });

  it("the second press lost to the bubble as MAIN hides it (real Electron: ~343–363 ms): its release on the mini chat is the double click", () => {
    // The first press 0–90 ms, the click sent at 330, MAIN shows the mini chat and hides the bubble at 335. A press at
    // 332 hits the bubble, which is hidden before its page sees it; only pointerup + mouseup reach the mini chat.
    for (const lag of [5, 10]) {
      const tl = timeline();
      const log = [];
      let mode = "bubble";
      const guard = createMiniGuard({ onDouble: () => log.push("restore"), now: tl.now });
      guard.mode("bubble");
      const g = createGesture({ emit: (a) => { if (a === "click") tl.set(() => { log.push("click"); mode = "mini"; guard.mode("mini"); }, lag); }, now: tl.now, setTimer: tl.set, clearTimer: tl.clear });
      g.down(32, 32); tl.to(90); g.up(32, 32);
      tl.to(332);                                 // the press: dropped by the hidden bubble
      tl.to(422);
      const reached = ["pointerup", "mouseup"].filter((t) => !guard.swallow(ev(t)));
      tl.to(2000);
      expect(log).toEqual(["click", "restore"]);  // before: ["click"] – Ted stayed in the mini chat
      expect(reached).toEqual([]);
      expect(mode).toBe("mini");                  // (MAIN turns it into the normal window on restore)
    }
  });

  it("two clicks further apart than Windows' double-click time are two clicks: the second one is the mini chat's own", () => {
    const r = sweep(600);
    expect(r.where).toEqual(["bubble", "mini"]);
    expect(r.log).toEqual(["click"]);
    expect(r.mode).toBe("mini");
    expect(r.reached).toEqual(["pointerdown", "pointerup", "click"]);
  });
});
