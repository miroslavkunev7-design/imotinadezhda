// „Балонче“ (0.1.6): the page of the small round window at a screen edge. It talks only to window.tedBubble (the bubble
// window's own preload: moves and clicks, nothing else). No React, no network, the same CSP as the main page.
//   drag anywhere (pointer capture, deltas rate-limited to one per frame) -> MAIN moves the window, snaps to an edge;
//   click -> the mini chat; double click -> the normal window; right click -> the menu (MAIN);
//   badge = unread answers (or „!“ when Real GPT waits for a decision); a soft pulse while Ted works.
import "./bubble.css";
import avatar from "../assets/avatar.webp";
import { badgeText, createGesture } from "./gesture.js";

const TIP = "Тед · клик – малкият чат · двоен клик – нормален прозорец · влачете, за да го преместите · десен бутон – меню";

async function getApi() {
  if (typeof window !== "undefined" && window.tedBubble) return window.tedBubble;
  // Mock build only (vite --mode mock): a fixture for the Playwright tests; dead code in the production build.
  if (import.meta.env.MODE === "mock") {
    const m = await import("../mock/bubble.mock.js");
    return m.createBubbleMock();
  }
  return null;
}

function mount(api) {
  const root = document.getElementById("bubble-root");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "bub";
  b.id = "bub";
  b.setAttribute("data-testid", "bubble");
  b.setAttribute("aria-label", "Тед – балонче. Клик: малкият чат. Двоен клик: нормален прозорец. Десен бутон: меню.");
  b.title = TIP;
  const img = document.createElement("img");
  img.src = avatar;
  img.alt = "";
  img.draggable = false;
  const badge = document.createElement("span");
  badge.className = "bub-n";
  badge.setAttribute("data-testid", "bubble-badge");
  badge.hidden = true;
  b.append(img, badge);
  root.append(b);

  function apply(s) {
    if (!s || typeof s !== "object") return;
    const t = badgeText(s);
    badge.textContent = t;
    badge.hidden = !t;
    badge.classList.toggle("att", t === "!");
    b.classList.toggle("working", !!s.working);
    b.dataset.side = s.side === "left" ? "left" : "right";
    b.setAttribute("aria-label", "Тед – балонче" + (t ? (t === "!" ? " (чака вашето решение)" : " (" + t + " нови отговора)") : "") + (s.working ? ", работи" : "") + ". Клик: малкият чат. Двоен клик: нормален прозорец. Десен бутон: меню.");
  }

  // One move per animation frame at most; MAIN limits it again.
  let frame = 0;
  let pending = null;
  const flush = () => { frame = 0; if (pending) { const [dx, dy] = pending; pending = null; api.dragMove(dx, dy); } };
  const g = createGesture({
    emit: (action, dx, dy) => {
      if (action === "dragStart") { b.classList.add("drag"); api.dragStart(); }
      else if (action === "dragMove") { pending = [dx, dy]; if (!frame) frame = requestAnimationFrame(flush); }
      else if (action === "dragEnd") {
        if (frame) { cancelAnimationFrame(frame); frame = 0; }
        pending = null;
        b.classList.remove("drag");
        api.dragEnd(dx, dy);
      } else if (action === "click") api.click();
      else if (action === "double") api.openNormal();
    },
  });

  let pid = null;
  b.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pid = e.pointerId;
    try { b.setPointerCapture(e.pointerId); } catch { /* the pointer is gone already */ }
    g.down(e.screenX, e.screenY);
  });
  b.addEventListener("pointermove", (e) => { if (e.pointerId === pid) g.move(e.screenX, e.screenY); });
  b.addEventListener("pointerup", (e) => { if (e.pointerId !== pid) return; pid = null; g.up(e.screenX, e.screenY); });
  b.addEventListener("pointercancel", (e) => { if (e.pointerId !== pid) return; pid = null; g.cancel(e.screenX, e.screenY); });
  b.addEventListener("lostpointercapture", (e) => { if (e.pointerId !== pid) return; pid = null; g.cancel(e.screenX, e.screenY); });
  // Keyboard: Enter/Space on the button (a click with detail 0) opens the chat; the context-menu key shows the menu.
  b.addEventListener("click", (e) => { if (e.detail === 0) api.click(); });
  b.addEventListener("contextmenu", (e) => { e.preventDefault(); api.menu(); });
  document.addEventListener("dragstart", (e) => e.preventDefault());

  if (typeof api.onState === "function") api.onState(apply);
  Promise.resolve(api.ready()).then(apply, () => {});
}

if (typeof document !== "undefined") {
  getApi().then((api) => {
    if (api) mount(api);
    else document.body.classList.add("no-bridge");
  });
}
