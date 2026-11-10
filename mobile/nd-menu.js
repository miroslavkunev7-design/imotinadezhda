/* Premium drop-down menus for the public site and the bank module: every <select> opens the agency's glass list.
   Scroll inside the list does not close it (only outside click, Esc, or a pick). Keyboard: focus in the list, ↑↓ Home/End, Enter, Esc. */
(function(){
  if (window.NDMenuClose) return;
  var st=document.createElement('style');st.textContent="/* ===== Premium drop-down menus (replaces the browser list) ===== */\n.ndmenu{position:fixed;z-index:9000;min-width:220px;max-width:min(420px,92vw);max-height:min(60vh,520px);overflow:auto;padding:8px;border-radius:22px;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;\n  background:linear-gradient(180deg,rgba(255,252,248,.98),rgba(251,238,227,.97));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);\n  box-shadow:0 0 0 1.5px rgba(227,178,94,.75),0 0 22px rgba(255,226,190,.95),0 14px 34px rgba(60,10,10,.3);font-family:var(--cond,'Roboto Condensed',Arial,sans-serif);\n  transform-origin:top center;animation:ndmIn .18s cubic-bezier(.2,.7,.2,1)}\n@keyframes ndmIn{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}\n.ndmenu.up{transform-origin:bottom center}\n.ndmenu .ndm-q{position:sticky;top:0;margin:0 0 6px;padding:0 0 6px;background:inherit;z-index:1}\n.ndmenu .ndm-q input{width:100%;height:42px;border-radius:14px;border:1.5px solid rgba(227,178,94,.8);background:#fffdfa;padding:0 14px 0 40px;font:400 17px/1 var(--cond,Arial);color:#2b1414;outline:0;\n  background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a0f22' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5'/%3E%3Cpath d='m15.5 15.5 6 6'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-size:18px;background-position:12px center}\n.ndmenu .ndm-q input:focus{box-shadow:0 0 0 2px #edc47a}\n.ndmenu button{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:8px 14px;border:0;border-radius:14px;background:none;text-align:left;cursor:pointer;font:400 18px/1.2 var(--cond,Arial);color:#2b1414;transition:background .15s,color .15s,transform .15s}\n.ndmenu button:hover,.ndmenu button.hl{background:linear-gradient(90deg,rgba(237,196,122,.38),rgba(255,255,255,0));color:#5a0a18;transform:translateX(2px)}\n.ndmenu button.on{background:linear-gradient(180deg,#a3213a,#55071a);color:#fff3dc;box-shadow:0 0 0 1px #edc47a,0 0 12px rgba(255,190,120,.55)}\n.ndmenu button.on::after{content:\"✓\";margin-left:auto;font-weight:700;color:#f5d58f}\n.ndmenu .ndm-g{padding:10px 14px 4px;font:700 13px/1 var(--cond,Arial);letter-spacing:.8px;text-transform:uppercase;color:#9a6a3a}\n.ndmenu button[disabled]{opacity:.45;cursor:default}";document.head.appendChild(st);

  function inside(root, t) {
    if (!root || !t) return false;
    if (t === root) return true;
    if (t.nodeType === 3) t = t.parentElement;
    return t && t.nodeType === 1 && root.contains(t);
  }

  /* Keyboard for any open pop list (status menu, .o-pop, VAT menu, glass select). */
  function bindPopKeys(box, opts) {
    opts = opts || {};
    var sel = opts.itemSel || "button:not([disabled]), [role=option]:not([aria-disabled=true])";
    function list() { return box ? box.querySelectorAll(sel) : []; }
    function idx() {
      var bs = list(), i = 0;
      for (; i < bs.length; i++) if (bs[i].classList.contains("hl") || bs[i].classList.contains("on") || bs[i].getAttribute("aria-selected") === "true") return i;
      return 0;
    }
    function go(n) {
      var bs = list(); if (!bs.length) return;
      n = Math.max(0, Math.min(bs.length - 1, n));
      [].forEach.call(bs, function (b) { b.classList.remove("hl"); b.setAttribute("aria-selected", "false"); });
      bs[n].classList.add("hl"); bs[n].setAttribute("aria-selected", "true");
      if (bs[n].scrollIntoView) bs[n].scrollIntoView({ block: "nearest" });
      try { bs[n].focus({ preventScroll: true }); } catch (e) { try { bs[n].focus(); } catch (e2) {} }
    }
    function onKey(e) {
      if (!box || box.hidden || (box.getAttribute && box.getAttribute("hidden") != null && box.hidden !== false && !box.offsetParent && box.style.display === "none")) return;
      if (box.hidden) return;
      if (!document.body.contains(box)) { drop(); return; }
      var k = e.key;
      if (k !== "ArrowDown" && k !== "ArrowUp" && k !== "Enter" && k !== " " && k !== "Escape" && k !== "Home" && k !== "End") return;
      if (k === " " && e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      e.preventDefault(); e.stopPropagation();
      if (k === "Escape") { if (opts.close) opts.close(); return; }
      var bs = list(); if (!bs.length) return;
      var cur = idx();
      if (k === "ArrowDown") go(cur + 1);
      else if (k === "ArrowUp") go(cur - 1);
      else if (k === "Home") go(0);
      else if (k === "End") go(bs.length - 1);
      else if (k === "Enter" || k === " ") {
        var b = bs[Math.max(0, cur)];
        if (opts.activate) opts.activate(b);
        else if (b) b.click();
      }
    }
    function drop() {
      document.removeEventListener("keydown", onKey, true);
    }
    document.addEventListener("keydown", onKey, true);
    setTimeout(function () {
      var bs = list(), on = box.querySelector(".on, [aria-selected=true], .hl") || bs[0];
      if (on) {
        var n = [].indexOf.call(bs, on);
        go(n < 0 ? 0 : n);
      } else if (box && !opts.keepFocus) {
        box.tabIndex = -1;
        try { box.focus({ preventScroll: true }); } catch (e) {}
      }
    }, 0);
    return { go: go, drop: drop };
  }
  window.NDPopNav = bindPopKeys;

  (function () {
    var box = null, sel = null, items = [], hl = -1, anchor = null, pop = null;
    /* Phones used to keep the native sheet; the same glass list now opens everywhere so scroll/keyboard behave identically. data-native keeps the OS picker. */
    function skipNative(s) { return s.multiple || s.size > 1 || s.disabled || s.dataset.native != null; }
    function unbind() {
      document.removeEventListener("pointerdown", onDoc, true);
      window.removeEventListener("keydown", keys, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      if (window.visualViewport) {
        visualViewport.removeEventListener("resize", onMove);
        visualViewport.removeEventListener("scroll", onMove);
      }
      if (pop) { pop.drop(); pop = null; }
    }
    function closeMenu() {
      unbind();
      if (box) { box.remove(); box = null; }
      if (sel) { sel.classList.remove("ndm-open"); }
      sel = null; items = []; hl = -1; anchor = null;
    }
    function onDoc(e) { if (box && !inside(box, e.target) && e.target !== sel && !(sel && sel.contains(e.target))) closeMenu(); }
    /* Page moved: keep the list attached to the field. Scroll inside the list is ignored and does not close it. */
    function onMove(e) {
      if (!box) return;
      if (e && e.target && inside(box, e.target)) return;
      if (anchor) place(anchor);
    }
    function place(a) {
      var r = a.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, w = Math.max(220, Math.min(r.width, 420)), h = box.offsetHeight;
      var left = Math.min(Math.max(8, r.left), vw - w - 8), below = vh - r.bottom - 10, top;
      if (h <= below || below >= r.top - 10) { top = r.bottom + 6; box.style.maxHeight = Math.min(520, Math.max(120, below)) + "px"; box.classList.remove("up"); }
      else { top = Math.max(8, r.top - 6 - Math.min(h, r.top - 16)); box.style.maxHeight = Math.min(520, Math.max(120, r.top - 16)) + "px"; box.classList.add("up"); }
      box.style.left = left + "px"; box.style.top = top + "px"; box.style.width = w + "px";
    }
    function pick(i) {
      var o = items[i], s0 = sel;
      if (!o || o.disabled || !s0) return;
      var v = o.value, changed = s0.value !== v;
      s0.value = v; closeMenu();
      if (changed) { s0.dispatchEvent(new Event("input", { bubbles: true })); s0.dispatchEvent(new Event("change", { bubbles: true })); }
    }
    function render(q) {
      var list = box.querySelector(".ndm-l"); list.innerHTML = ""; items = []; hl = -1;
      var ql = (q || "").toLowerCase(), groups = sel.querySelectorAll("optgroup"), any = false;
      function add(o) {
        if (o.hidden) return;
        var t = o.textContent.trim();
        if (ql && t.toLowerCase().indexOf(ql) < 0) return;
        var b = document.createElement("button"); b.type = "button"; b.textContent = t || "—";
        if (o.disabled) b.disabled = true;
        if (o.selected) b.classList.add("on");
        b.setAttribute("data-i", items.length); b.setAttribute("role", "option");
        items.push(o); list.appendChild(b); any = true;
      }
      if (groups.length) { [].forEach.call(sel.children, function (c) { if (c.tagName === "OPTGROUP") { var g = document.createElement("div"); g.className = "ndm-g"; g.textContent = c.label; list.appendChild(g); [].forEach.call(c.children, add); } else add(c); }); }
      else [].forEach.call(sel.options, add);
      if (!any) { var e = document.createElement("div"); e.className = "ndm-g"; e.textContent = "Няма съвпадения"; list.appendChild(e); }
      var on = list.querySelector("button.on"); if (on) hl = +on.getAttribute("data-i");
    }
    function mark(n) {
      var bs = box.querySelectorAll("button[data-i]"); if (!bs.length) return;
      n = Math.max(0, Math.min(bs.length - 1, n));
      [].forEach.call(bs, function (b) { b.classList.remove("hl"); });
      bs[n].classList.add("hl"); hl = n;
      bs[n].scrollIntoView({ block: "nearest" });
      var typing = document.activeElement && document.activeElement.closest && document.activeElement.closest(".ndm-q");
      if (!typing) try { bs[n].focus({ preventScroll: true }); } catch (e) {}
    }
    function keys(e) {
      if (!box) return;
      var k = e.key;
      var typing = e.target && e.target.closest && e.target.closest(".ndm-q");
      if (typing && k !== "ArrowDown" && k !== "ArrowUp" && k !== "Enter" && k !== "Escape" && k !== "Home" && k !== "End") return;
      if (k !== "ArrowDown" && k !== "ArrowUp" && k !== "Enter" && k !== "Escape" && k !== "Home" && k !== "End") return;
      var bs = box.querySelectorAll("button[data-i]"); if (!bs.length && k !== "Escape") return;
      e.preventDefault(); e.stopPropagation();
      if (k === "Escape") { e.stopImmediatePropagation(); var s0 = sel; closeMenu(); if (s0) s0.focus(); return; }
      var cur = hl; if (cur < 0) cur = [].findIndex.call(bs, function (b) { return b.classList.contains("on"); }); if (cur < 0) cur = 0;
      if (k === "ArrowDown") mark(cur + 1);
      else if (k === "ArrowUp") mark(cur - 1);
      else if (k === "Home") mark(0);
      else if (k === "End") mark(bs.length - 1);
      else if (k === "Enter") pick(+bs[Math.max(0, cur)].getAttribute("data-i"));
    }
    function openMenu(s, a) {
      closeMenu(); sel = s; sel.classList.add("ndm-open"); anchor = a;
      box = document.createElement("div"); box.className = "ndmenu"; box.setAttribute("role", "listbox"); box.tabIndex = -1;
      var many = sel.options.length > 8;
      box.innerHTML = (many ? '<div class="ndm-q"><input type="text" placeholder="Търси…" aria-label="Търси в списъка"></div>' : "") + '<div class="ndm-l"></div>';
      document.body.appendChild(box); render("");
      box.addEventListener("click", function (e) { var b = e.target.closest("button[data-i]"); if (b) pick(+b.getAttribute("data-i")); });
      box.addEventListener("wheel", function (e) { e.stopPropagation(); }, { passive: true });
      box.addEventListener("touchmove", function (e) { e.stopPropagation(); }, { passive: true });
      var qi = box.querySelector(".ndm-q input"); if (qi) { qi.addEventListener("input", function () { render(qi.value); mark(hl >= 0 ? hl : 0); }); }
      place(anchor);
      var on = box.querySelector("button.on"); if (on) { hl = +on.getAttribute("data-i"); on.classList.add("hl"); on.scrollIntoView({ block: "center" }); }
      setTimeout(function () {
        var focusEl = qi || box.querySelector("button.hl, button.on, button");
        if (focusEl) try { focusEl.focus({ preventScroll: true }); } catch (err) { try { box.focus(); } catch (e2) {} }
        else try { box.focus({ preventScroll: true }); } catch (e3) {}
      }, 0);
      document.addEventListener("pointerdown", onDoc, true);
      window.addEventListener("keydown", keys, true);
      window.addEventListener("resize", onMove);
      window.addEventListener("scroll", onMove, true);
      if (window.visualViewport) {
        visualViewport.addEventListener("resize", onMove);
        visualViewport.addEventListener("scroll", onMove);
      }
    }
    var ANCH = ".fld, .selw, .dsw, .w, .ef, .ndl-sel > div, .input-wrap, .city-select, .chip, .v3-sel, .r-sel, .o-city, .fs, .f, .search-field, .has-display, .sort-control, .landing-search";
    document.addEventListener("pointerdown", function (e) {
      var s = e.target.closest && e.target.closest("select"); if (!s || skipNative(s)) return;
      e.preventDefault();
      var a = s.closest(ANCH) || s;
      if (box && sel === s) { closeMenu(); return; }
      openMenu(s, a);
    }, true);
    document.addEventListener("keydown", function (e) {
      var s = document.activeElement;
      if (s && s.tagName === "SELECT" && !skipNative(s) && (e.key === "Enter" || e.key === " " || (e.altKey && e.key === "ArrowDown") || e.key === "ArrowDown")) {
        e.preventDefault();
        openMenu(s, s.closest(ANCH) || s);
      }
    });
    window.NDMenuClose = closeMenu;
  })();
})();
