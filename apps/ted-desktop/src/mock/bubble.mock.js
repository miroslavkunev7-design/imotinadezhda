// Mock of window.tedBubble (0.1.6 „Балонче“) for the Playwright tests of bubble.html ONLY (vite build --mode mock).
// Never in the production build (src/bubble/bubble.js imports it behind import.meta.env.MODE === "mock").
// URL flags: ?unread=<n> · ?working=1 · ?attention=1 · ?side=left|right
// Test hooks: window.__tedBubbleMock = {calls: [[fn, ...args]], push(statePatch)}
export function createBubbleMock() {
  const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
  const state = {
    mode: "bubble",
    unread: Math.max(0, Math.min(999, Number(params.get("unread")) || 0)),
    working: params.get("working") === "1",
    attention: params.get("attention") === "1",
    side: params.get("side") === "left" ? "left" : "right",
  };
  const calls = [];
  let listeners = [];
  const rec = (fn) => (...args) => { calls.push([fn, ...args]); return Promise.resolve({ ok: true }); };
  window.__tedBubbleMock = {
    calls,
    push: (patch) => { Object.assign(state, patch || {}); listeners.forEach((cb) => cb({ ...state })); },
  };
  return {
    ready: () => { calls.push(["ready"]); return Promise.resolve({ ...state }); },
    dragStart: rec("dragStart"),
    dragMove: rec("dragMove"),
    dragEnd: rec("dragEnd"),
    click: rec("click"),
    openNormal: rec("openNormal"),
    menu: rec("menu"),
    onState: (cb) => {
      if (typeof cb !== "function") return () => {};
      listeners.push(cb);
      return () => { listeners = listeners.filter((x) => x !== cb); };
    },
  };
}
