/* Premium drop-down menus for the public site and the bank module: every <select> opens the agency's glass list on desktop; phones keep the native sheet. */
(function(){
  if (window.NDMenuClose) return;
  var st=document.createElement('style');st.textContent="/* ===== Premium drop-down menus (replaces the browser list on desktop) ===== */\n.ndmenu{position:fixed;z-index:9000;min-width:220px;max-width:min(420px,92vw);max-height:min(60vh,520px);overflow:auto;padding:8px;border-radius:22px;\n  background:linear-gradient(180deg,rgba(255,252,248,.98),rgba(251,238,227,.97));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);\n  box-shadow:0 0 0 1.5px rgba(227,178,94,.75),0 0 22px rgba(255,226,190,.95),0 14px 34px rgba(60,10,10,.3);font-family:var(--cond,'Roboto Condensed',Arial,sans-serif);\n  transform-origin:top center;animation:ndmIn .18s cubic-bezier(.2,.7,.2,1)}\n@keyframes ndmIn{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}\n.ndmenu.up{transform-origin:bottom center}\n.ndmenu .ndm-q{position:sticky;top:0;margin:0 0 6px;padding:0 0 6px;background:inherit}\n.ndmenu .ndm-q input{width:100%;height:42px;border-radius:14px;border:1.5px solid rgba(227,178,94,.8);background:#fffdfa;padding:0 14px 0 40px;font:400 17px/1 var(--cond,Arial);color:#2b1414;outline:0;\n  background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a0f22' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5'/%3E%3Cpath d='m15.5 15.5 6 6'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-size:18px;background-position:12px center}\n.ndmenu .ndm-q input:focus{box-shadow:0 0 0 2px #edc47a}\n.ndmenu button{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:8px 14px;border:0;border-radius:14px;background:none;text-align:left;cursor:pointer;font:400 18px/1.2 var(--cond,Arial);color:#2b1414;transition:background .15s,color .15s,transform .15s}\n.ndmenu button:hover,.ndmenu button.hl{background:linear-gradient(90deg,rgba(237,196,122,.38),rgba(255,255,255,0));color:#5a0a18;transform:translateX(2px)}\n.ndmenu button.on{background:linear-gradient(180deg,#a3213a,#55071a);color:#fff3dc;box-shadow:0 0 0 1px #edc47a,0 0 12px rgba(255,190,120,.55)}\n.ndmenu button.on::after{content:\"✓\";margin-left:auto;font-weight:700;color:#f5d58f}\n.ndmenu .ndm-g{padding:10px 14px 4px;font:700 13px/1 var(--cond,Arial);letter-spacing:.8px;text-transform:uppercase;color:#9a6a3a}\n.ndmenu button[disabled]{opacity:.45;cursor:default}";document.head.appendChild(st);
  /* ---------- premium drop-down menus: every <select> opens our own glass list on desktop (phones keep the native sheet) ---------- */
  (function () {
    var box = null, sel = null, items = [], hl = -1;
    function fine() { return matchMedia("(pointer:fine)").matches && !matchMedia("(max-width:768px)").matches; }
    function closeMenu() { if (box) { box.remove(); box = null; } if (sel) { sel.classList.remove("ndm-open"); } sel = null; items = []; hl = -1; document.removeEventListener("pointerdown", onDoc, true); window.removeEventListener("resize", closeMenu); window.removeEventListener("scroll", closeMenu, true); }
    function onDoc(e) { if (box && !box.contains(e.target) && e.target !== sel) closeMenu(); }
    function place(anchor) {
      var r = anchor.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, w = Math.max(220, Math.min(r.width, 420)), h = box.offsetHeight;
      var left = Math.min(Math.max(8, r.left), vw - w - 8), below = vh - r.bottom - 10, top;
      if (h <= below || below >= r.top - 10) { top = r.bottom + 6; box.style.maxHeight = Math.min(520, below) + "px"; box.classList.remove("up"); }
      else { top = Math.max(8, r.top - 6 - Math.min(h, r.top - 16)); box.style.maxHeight = Math.min(520, r.top - 16) + "px"; box.classList.add("up"); }
      box.style.left = left + "px"; box.style.top = top + "px"; box.style.width = w + "px";
    }
    function pick(i) { var o = items[i], s0 = sel; if (!o || o.disabled || !s0) return; var v = o.value, changed = s0.value !== v; s0.value = v; closeMenu(); if (changed) { s0.dispatchEvent(new Event("input", { bubbles: true })); s0.dispatchEvent(new Event("change", { bubbles: true })); } }
    function render(q) {
      var list = box.querySelector(".ndm-l"); list.innerHTML = ""; items = []; hl = -1;
      var ql = (q || "").toLowerCase(), groups = sel.querySelectorAll("optgroup"), any = false;
      function add(o) { if (o.hidden) return; var t = o.textContent.trim(); if (ql && t.toLowerCase().indexOf(ql) < 0) return; var b = document.createElement("button"); b.type = "button"; b.textContent = t || "—"; if (o.disabled) b.disabled = true; if (o.selected) { b.classList.add("on"); } b.setAttribute("data-i", items.length); items.push(o); list.appendChild(b); any = true; }
      if (groups.length) { [].forEach.call(sel.children, function (c) { if (c.tagName === "OPTGROUP") { var g = document.createElement("div"); g.className = "ndm-g"; g.textContent = c.label; list.appendChild(g); [].forEach.call(c.children, add); } else add(c); }); }
      else [].forEach.call(sel.options, add);
      if (!any) { var e = document.createElement("div"); e.className = "ndm-g"; e.textContent = "Няма съвпадения"; list.appendChild(e); }
      var on = list.querySelector("button.on"); if (on) hl = +on.getAttribute("data-i");
    }
    function openMenu(s, anchor) {
      closeMenu(); sel = s; sel.classList.add("ndm-open");
      box = document.createElement("div"); box.className = "ndmenu"; box.setAttribute("role", "listbox");
      var many = sel.options.length > 8;
      box.innerHTML = (many ? '<div class="ndm-q"><input type="text" placeholder="Търси…" aria-label="Търси в списъка"></div>' : "") + '<div class="ndm-l"></div>';
      document.body.appendChild(box); render("");
      box.addEventListener("click", function (e) { var b = e.target.closest("button[data-i]"); if (b) pick(+b.getAttribute("data-i")); });
      box.addEventListener("keydown", keys);
      var qi = box.querySelector(".ndm-q input"); if (qi) { qi.addEventListener("input", function () { render(qi.value); }); }
      place(anchor); var on = box.querySelector("button.on"); if (on) on.scrollIntoView({ block: "center" });
      setTimeout(function () { (qi || box.querySelector("button")) && (qi || box.querySelector("button")).focus({ preventScroll: true }); }, 0);
      document.addEventListener("pointerdown", onDoc, true); window.addEventListener("resize", closeMenu); window.addEventListener("scroll", closeMenu, true);
    }
    function keys(e) {
      var bs = box.querySelectorAll("button[data-i]"); if (!bs.length) return;
      var cur = [].findIndex.call(bs, function (b) { return b.classList.contains("hl"); }); if (cur < 0) cur = [].findIndex.call(bs, function (b) { return b.classList.contains("on"); });
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); var n = e.key === "ArrowDown" ? Math.min(bs.length - 1, cur + 1) : Math.max(0, cur - 1); bs.forEach(function (b) { b.classList.remove("hl"); }); bs[n].classList.add("hl"); bs[n].scrollIntoView({ block: "nearest" }); }
      else if (e.key === "Enter") { e.preventDefault(); if (cur >= 0) pick(+bs[cur].getAttribute("data-i")); }
      else if (e.key === "Escape") { e.preventDefault(); var s0 = sel; closeMenu(); s0 && s0.focus(); }
    }
    document.addEventListener("mousedown", function (e) {
      if (!fine()) return;
      var s = e.target.closest && e.target.closest("select"); if (!s || s.multiple || s.size > 1 || s.disabled || s.dataset.native != null) return;
      e.preventDefault();
      var anchor = s.closest(".fld, .selw, .dsw, .w, .ef, .ndl-sel > div, .input-wrap, .city-select") || s;
      if (box && sel === s) { closeMenu(); return; }
      openMenu(s, anchor);
    }, true);
    document.addEventListener("keydown", function (e) { if (!fine()) return; var s = document.activeElement; if (s && s.tagName === "SELECT" && (e.key === "Enter" || e.key === " " || e.altKey && e.key === "ArrowDown")) { e.preventDefault(); openMenu(s, s.closest(".fld, .selw, .dsw, .w, .ef, .ndl-sel > div, .input-wrap, .city-select") || s); } });
    window.NDMenuClose = closeMenu;
  })();
})();
