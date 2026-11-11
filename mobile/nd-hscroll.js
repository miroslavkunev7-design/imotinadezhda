/* Два кръгли бутона ‹ › вместо хоризонтална скрол линия за редовете с карти
   (градове, квартали, курорти). Бутоните живеят в <body> и следят реда, така че
   не пипат React дървото. Ред се включва автоматично, ако е хоризонтален скролер
   и съвпада със SEL (или има атрибут data-nd-hs). */
(function () {
  if (window.__ndHS) return; window.__ndHS = 1;
  var SEL = '.neighborhood-panel,.neighborhood-modal-grid,[data-nd-hs]';
  var css =
    SEL.split(',').map(function (s) { return s + '{scrollbar-width:none!important;-ms-overflow-style:none}' + s + '::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}'; }).join('') +
    '#nd-hs{position:fixed;inset:0;pointer-events:none;z-index:2147482000}' +
    '#nd-hs.probe .nd-hs-b{pointer-events:none!important}' +
    '.nd-hs-b{position:fixed;left:0;top:0;width:48px;height:48px;margin:0;padding:0;border-radius:50%;display:grid;place-items:center;cursor:pointer;pointer-events:auto;' +
      'color:#f8d777;border:1.5px solid #e6bf5b;' +
      'background:radial-gradient(120% 90% at 30% 18%,rgba(255,236,190,.34),rgba(255,236,190,0) 46%),linear-gradient(145deg,rgba(140,14,38,.9),rgba(84,5,22,.94) 58%,rgba(54,3,14,.96));' +
      '-webkit-backdrop-filter:blur(10px) saturate(1.3);backdrop-filter:blur(10px) saturate(1.3);' +
      'box-shadow:inset 0 1px 0 rgba(255,240,205,.5),inset 0 -6px 12px rgba(30,0,8,.45),0 6px 18px rgba(45,4,14,.5),0 0 16px rgba(230,191,91,.5);' +
      'transition:opacity .25s,transform .2s,box-shadow .25s;opacity:0;visibility:hidden;-webkit-tap-highlight-color:transparent}' +
    '.nd-hs-b.on{opacity:1;visibility:visible}' +
    '.nd-hs-b:hover{transform:scale(1.08);box-shadow:inset 0 1px 0 rgba(255,240,205,.6),inset 0 -6px 12px rgba(30,0,8,.45),0 8px 22px rgba(45,4,14,.55),0 0 26px rgba(248,215,119,.8)}' +
    '.nd-hs-b:active{transform:scale(.95)}' +
    '.nd-hs-b svg{width:24px;height:24px;filter:drop-shadow(0 0 4px rgba(248,215,119,.55))}' +
    '@media(max-width:768px){.nd-hs-b{width:42px;height:42px}.nd-hs-b svg{width:21px;height:21px}}';
  var st = document.createElement('style'); st.id = 'nd-hs-css'; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  var layer, items = [], raf = 0;
  var ICON = { l: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
               r: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>' };

  function mk(side, it) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'nd-hs-b'; b.innerHTML = ICON[side];
    b.setAttribute('aria-label', side === 'l' ? 'Назад' : 'Напред');
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var el = it.el, step = Math.max(160, el.clientWidth * 0.8);
      el.scrollBy({ left: side === 'l' ? -step : step, behavior: 'smooth' });
    });
    layer.appendChild(b); return b;
  }
  function bindInteract(el) {
    if (el.__ndhsIx) return; el.__ndhsIx = 1;
    el.addEventListener("wheel", function (e) {
      if (e.ctrlKey) return;
      if (el.scrollWidth <= el.clientWidth + 4) return;
      var dx = e.deltaX, dy = e.deltaY;
      if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return;
      var d = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      if (e.deltaMode === 1) d *= 40;
      if (e.deltaMode === 2) d *= el.clientWidth;
      var max = el.scrollWidth - el.clientWidth;
      if ((d < 0 && el.scrollLeft <= 0) || (d > 0 && el.scrollLeft >= max - 1)) return;
      e.preventDefault();
      el.scrollLeft += d;
    }, { passive: false });
    var pid = null, x0 = 0, sl0 = 0, moved = false;
    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest && e.target.closest("input,textarea,select,a[href]")) return;
      pid = e.pointerId; x0 = e.clientX; sl0 = el.scrollLeft; moved = false;
      /* 11.11: показалецът се „хваща“ чак когато започне влачене – иначе обикновеното щракване върху карта отиваше към лентата и картата не се отваряше */
    });
    el.addEventListener("pointermove", function (e) {
      if (pid == null || e.pointerId !== pid) return;
      var dx = e.clientX - x0;
      if (!moved && Math.abs(dx) < 10) return;
      if (!moved) { try { el.setPointerCapture(pid); } catch (err) {} }
      moved = true; el.__ndhsMoved = 1;
      el.scrollLeft = sl0 - dx;
    });
    function end(e) {
      if (pid == null || (e && e.pointerId !== pid)) return;
      try { if (moved && el.hasPointerCapture && el.hasPointerCapture(pid)) el.releasePointerCapture(pid); } catch (err) {}
      pid = null;
      if (moved) setTimeout(function () { el.__ndhsMoved = 0; }, 80);
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("click", function (e) {
      if (el.__ndhsMoved) { e.preventDefault(); e.stopPropagation(); el.__ndhsMoved = 0; }
    }, true);
    el.addEventListener("pointerenter", function () { layer.__act = el; });
  }
  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    if (t && t.closest && t.closest(".ndmenu,.pm-smenu,.o-pop,.mwin,[role=dialog],[role=listbox],[role=menu],#nd-fwin,#nd-cal")) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    var el = (layer && layer.__act) || null;
    if (!el || !document.contains(el) || el.scrollWidth <= el.clientWidth + 4) {
      el = null;
      for (var i = 0; i < items.length; i++) {
        var x = items[i].el, s = getComputedStyle(x);
        if (s.display === "none" || x.hidden) continue;
        if (x.scrollWidth > x.clientWidth + 4) { el = x; break; }
      }
    }
    if (!el) return;
    e.preventDefault();
    var step = Math.max(160, el.clientWidth * 0.8);
    if (e.key === "Home") el.scrollTo({ left: 0, behavior: "smooth" });
    else if (e.key === "End") el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    else el.scrollBy({ left: e.key === "ArrowRight" ? step : -step, behavior: "smooth" });
  });
  function clipRect(el) {
    var r = el.getBoundingClientRect();
    var L = Math.max(r.left, 0), T = Math.max(r.top, 0), R = Math.min(r.right, innerWidth), B = Math.min(r.bottom, innerHeight);
    for (var p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      var s = getComputedStyle(p);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
        var q = p.getBoundingClientRect();
        L = Math.max(L, q.left); T = Math.max(T, q.top); R = Math.min(R, q.right); B = Math.min(B, q.bottom);
      }
    }
    return { r: r, L: L, T: T, R: R, B: B };
  }
  function scan() {
    var found = document.querySelectorAll(SEL);
    for (var i = 0; i < found.length; i++) {
      var el = found[i];
      if (el.__ndhs) continue;
      var it = { el: el }; el.__ndhs = it;
      it.l = mk('l', it); it.r = mk('r', it);
      el.addEventListener('scroll', kick, { passive: true });
      bindInteract(el);
      items.push(it);
    }
    items = items.filter(function (it) {
      if (document.contains(it.el)) return true;
      it.l.remove(); it.r.remove(); it.el.__ndhs = null; return false;
    });
  }
  function hit(x, y, el) {
    var t = document.elementFromPoint(x, y);
    return !!t && (t === el || el.contains(t));
  }
  function place() {
    raf = 0;
    if (!layer) return;
    layer.classList.add('probe');
    for (var i = 0; i < items.length; i++) {
      var it = items[i], el = it.el, s = getComputedStyle(el);
      var scrollable = (s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 4 && s.display !== 'none' && s.visibility !== 'hidden';
      var c = scrollable ? clipRect(el) : null;
      if (!c || c.B - c.T < 70 || c.R - c.L < 140) { it.l.classList.remove('on'); it.r.classList.remove('on'); continue; }
      var sz = it.l.offsetWidth || 48, h = sz / 2, cy = (c.T + c.B) / 2;
      // центърът на бутона е върху ръба на реда, но винаги вътре във видимата рамка
      var lx = Math.max(c.r.left, c.L + h + 4), rx = Math.min(c.r.right, c.R - h - 4);
      var parentClip = c.r.left <= c.L + 1; // няма място отвън -> леко навътре
      if (parentClip) lx = c.L + h + 8;
      if (c.r.right >= c.R - 1) rx = c.R - h - 8;
      it.l.style.left = (lx - h) + 'px'; it.l.style.top = (cy - h) + 'px';
      it.r.style.left = (rx - h) + 'px'; it.r.style.top = (cy - h) + 'px';
      var sl = Math.abs(el.scrollLeft), max = el.scrollWidth - el.clientWidth;
      // скриваме бутона, ако редът е покрит от друг прозорец/меню в тази точка
      var probeL = Math.min(Math.max(lx + h + 6, c.L + 2), c.R - 2), probeR = Math.min(Math.max(rx - h - 6, c.L + 2), c.R - 2);
      it.l.classList.toggle('on', sl > 4 && hit(probeL, cy, el));
      it.r.classList.toggle('on', sl < max - 4 && hit(probeR, cy, el));
    }
    layer.classList.remove('probe');
  }
  function kick() { if (!raf) raf = requestAnimationFrame(place); }
  function init() {
    layer = document.createElement('div'); layer.id = 'nd-hs'; document.body.appendChild(layer);
    scan(); kick();
    new MutationObserver(function () { scan(); kick(); }).observe(document.body, { childList: true, subtree: true });
    addEventListener('scroll', kick, { passive: true, capture: true });
    addEventListener('resize', kick, { passive: true });
    setInterval(kick, 400);
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
