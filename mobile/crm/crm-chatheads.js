/* CRM Чат – плаващи балончета (като „chat heads“ на Messenger за Android) на всички CRM страници.
   Показва разговорите с непрочетени съобщения: аватар с инициали, знак на платформата и номерирана точка.
   Докосване → отваря малък прозорец с целия разговор (отговор направо оттам); ⤢ го отваря в CRM Чат. Балончетата се местят с плъзгане и залепват за ръба;
   пуснати върху ✕ долу се скриват до следващото ново съобщение. Тед не отговаря – служителите пишат ръчно. */
(function () {
  "use strict";
  if (/crm-chat\.html$/.test(location.pathname)) return;
  var D = window.ND; if (!D || !D.sb) return;

  var LOGO = {
    whatsapp: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#25D366"/><path fill="#fff" d="M17.4 14.6c-.3-.1-1.7-.8-1.9-.9-.3-.1-.4-.1-.6.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.4.1-.5l.4-.5.3-.5v-.5l-.9-2c-.2-.5-.5-.5-.6-.5h-.5c-.2 0-.5.1-.7.3-.3.3-1 .9-1 2.3s1 2.7 1.2 2.9c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3z"/></svg>',
    messenger: '<svg viewBox="0 0 24 24"><path fill="url(#nch-mg)" d="M12 1C5.9 1 1 5.6 1 11.3c0 3 1.3 5.6 3.5 7.5v3.7l3.4-1.9c1.3.4 2.6.6 4.1.6 6.1 0 11-4.6 11-10.2S18.1 1 12 1z"/><path fill="#fff" d="m5.6 14.6 3.3-5.2c.5-.8 1.6-1 2.4-.4l2.6 2c.2.2.6.2.8 0l3.6-2.7c.5-.4 1.1.2.8.7l-3.3 5.2c-.5.8-1.6 1-2.4.4l-2.6-2c-.2-.2-.6-.2-.8 0l-3.6 2.7c-.5.4-1.1-.2-.8-.7z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="6.5" fill="url(#nch-ig)"/><rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="2.9" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="16.6" cy="7.4" r="1" fill="#fff"/></svg>'
  };
  var css =
    "#nch{position:fixed;z-index:70;display:flex;flex-direction:column;gap:12px;touch-action:none;user-select:none;-webkit-user-select:none;transition:left .25s cubic-bezier(.2,.9,.3,1.2),top .25s}" +
    "#nch.drag{transition:none}#nch[hidden]{display:none}" +
    ".nch-h{position:relative;width:58px;height:58px;border-radius:50%;display:grid;place-items:center;cursor:pointer;border:2px solid #edc47a;" +
    "background:radial-gradient(circle at 35% 30%,#b42446,#7a0f22 60%,#4f0716);color:#fff3dc;font:400 21px/1 Georgia,'PT Serif',serif;text-shadow:0 1px 2px rgba(30,0,8,.6);" +
    "box-shadow:0 0 0 1px rgba(255,236,190,.55),0 0 18px rgba(255,190,120,.85),0 6px 14px rgba(60,5,15,.45),inset 0 2px 3px rgba(255,170,180,.45);animation:nchIn .35s cubic-bezier(.2,.9,.3,1.3)}" +
    ".nch-h:active{transform:scale(.94)}" +
    ".nch-h .pl{position:absolute;right:-4px;bottom:-4px;width:24px;height:24px;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 0 0 2px #fff6ea,0 2px 5px rgba(0,0,0,.35)}" +
    ".nch-h .pl svg{width:18px;height:18px}" +
    ".nch-h .n{position:absolute;right:-6px;top:-6px;min-width:24px;height:24px;padding:0 6px;border-radius:12px;display:grid;place-items:center;font:700 13px/1 'Roboto Condensed',Arial,sans-serif;color:#fff;text-shadow:none;" +
    "background:radial-gradient(circle at 35% 30%,#e0405f,#a3132f 60%,#6a0a1d);border:1.5px solid #f6d993;box-shadow:0 0 10px rgba(255,120,140,.9)}" +
    ".nch-h .tip{position:absolute;top:50%;transform:translateY(-50%);max-width:220px;padding:8px 12px;border-radius:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;opacity:0;transition:opacity .2s;" +
    "font:400 14px/1.25 'Roboto Condensed',Arial,sans-serif;color:#1f1111;text-shadow:none;background:linear-gradient(180deg,rgba(255,252,248,.97),rgba(252,238,226,.97));box-shadow:0 0 0 1.5px rgba(226,176,120,.7),0 0 14px rgba(255,214,160,.85)}" +
    ".nch-h .tip b{display:block;color:#6b0a1c;font-weight:700}" +
    "#nch.r .tip{right:70px}#nch.l .tip{left:70px}" +
    "@media (hover:hover){.nch-h:hover .tip{opacity:1}}" +
    "#nch.peek .nch-h:first-child .tip{opacity:1}" +
    "#nch-x{position:fixed;left:50%;bottom:calc(var(--dockH,90px) + 26px);width:64px;height:64px;margin-left:-32px;border-radius:50%;z-index:69;display:grid;place-items:center;font:700 26px/1 Arial,sans-serif;color:#fff3dc;" +
    "background:radial-gradient(circle at 35% 30%,#8d1a30,#4f0716 70%);border:2px solid #edc47a;box-shadow:0 0 18px rgba(255,190,120,.7);opacity:0;transform:scale(.6);transition:opacity .2s,transform .2s;pointer-events:none}" +
    "#nch-x.show{opacity:1;transform:scale(1)}#nch-x.hot{transform:scale(1.18);box-shadow:0 0 26px rgba(255,120,140,.95)}" +
    "#nch-win{position:fixed;z-index:71;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,#fff7ef,#fbe8d7);border:2px solid #edc47a;" +
    "box-shadow:0 0 0 1px rgba(255,236,190,.55),0 0 26px rgba(255,190,120,.85),0 18px 40px rgba(60,5,15,.45);opacity:0;transform:scale(.85);transition:opacity .2s,transform .22s cubic-bezier(.2,.9,.3,1.2)}" +
    "#nch-win.show{opacity:1;transform:scale(1)}#nch-win[hidden]{display:none}" +
    "#nch-win iframe{display:block;width:100%;height:100%;border:0;background:transparent}" +
    ".nch-h.open{box-shadow:0 0 0 3px #f6d993,0 0 24px rgba(255,200,120,1),0 6px 14px rgba(60,5,15,.45)}" +
    "@keyframes nchIn{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var box, xz, win, frame, openId = null, chats = [], pos;
  var KEY = "nd-chatheads-pos", HID = "nd-chatheads-hidden";
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); }
  function initials(n) { var w = String(n || "?").trim().split(/\s+/).filter(Boolean); return ((w[0] || "?").charAt(0) + (w[1] ? w[1].charAt(0) : "")).toUpperCase(); }
  function nameOf(c) { var d = c.data || {}; return d.client || d.name || d.phone || "Клиент"; }
  function dockH() { var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dockH")); return isNaN(v) ? 90 : v; }

  function build() {
    if (box) return;
    box = document.createElement("div"); box.id = "nch"; box.hidden = true; box.setAttribute("aria-label", "Нови съобщения в Чат");
    xz = document.createElement("div"); xz.id = "nch-x"; xz.textContent = "✕"; xz.setAttribute("aria-hidden", "true");
    var gd = document.createElement("div"); gd.setAttribute("aria-hidden", "true"); gd.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    gd.innerHTML = '<svg width="0" height="0"><defs><linearGradient id="nch-mg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0866FF"/><stop offset=".6" stop-color="#A033FF"/><stop offset="1" stop-color="#FF5C87"/></linearGradient><linearGradient id="nch-ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset=".35" stop-color="#FA7E1E"/><stop offset=".6" stop-color="#D62976"/><stop offset=".85" stop-color="#962FBF"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs></svg>';
    document.body.appendChild(gd);
    document.body.appendChild(xz); document.body.appendChild(box);
    pos = ls(KEY) || { side: "r", y: 0.42 };
    drag();
  }
  function place() {
    if (!box || box.hidden) return;
    var w = innerWidth, h = innerHeight, bh = box.offsetHeight || 60, minY = 70, maxY = h - dockH() - bh - 16;
    var y = Math.max(minY, Math.min(maxY, pos.y * h));
    box.style.top = y + "px"; box.style.left = (pos.side === "l" ? 10 : w - 58 - 10 - (window.NDRAIL ? 0 : 0)) + "px";
    box.className = pos.side === "l" ? "l" : "r";
    placeWin();
  }
  function render() {
    build();
    var hid = ls(HID) || {};
    var list = chats.filter(function (c) { var d = c.data || {}; return c.id === openId || ((+d.unread || 0) > 0 && hid[c.id] !== (c.last_at || d.last_at)); }).slice(0, 4);
    if (!list.length) { box.hidden = true; box.innerHTML = ""; return; }
    var wasHidden = box.hidden;
    box.innerHTML = list.map(function (c) {
      var d = c.data || {}, n = +d.unread || 0, p = c.platform === "whatsapp" || c.platform === "instagram" ? c.platform : "messenger";
      return '<button type="button" class="nch-h' + (c.id === openId ? " open" : "") + '" data-id="' + esc(c.id) + '" data-at="' + esc(c.last_at || d.last_at || "") + '" aria-label="' + esc(nameOf(c)) + " – " + n + ' нови съобщения">' + esc(initials(nameOf(c))) +
        '<span class="pl">' + LOGO[p] + '</span>' + (n ? '<span class="n">' + (n > 99 ? "99+" : n) + '</span>' : "") + '<span class="tip"><b>' + esc(nameOf(c)) + "</b>" + esc(String(d.last_text || "📎 Файл").slice(0, 80)) + "</span></button>";
    }).join("");
    box.hidden = false; place(); placeWin();
    if (wasHidden) { box.classList.add("peek"); setTimeout(function () { box.classList.remove("peek"); }, 3500); }
  }

  /* плъзгане: местене на целия куп, залепване за ляв/десен ръб, ✕ за скриване */
  function drag() {
    var sx, sy, ox, oy, moved = false, target = null, pid = null;
    box.addEventListener("pointerdown", function (e) {
      var h = e.target.closest(".nch-h"); if (!h) return;
      target = h; pid = e.pointerId; moved = false; sx = e.clientX; sy = e.clientY; ox = box.offsetLeft; oy = box.offsetTop;
      try { box.setPointerCapture(pid); } catch (x) {}
    });
    box.addEventListener("pointermove", function (e) {
      if (pid !== e.pointerId || !target) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 8) return;
      moved = true; box.classList.add("drag"); xz.classList.add("show");
      box.style.left = (ox + dx) + "px"; box.style.top = (oy + dy) + "px";
      xz.classList.toggle("hot", near(e));
    });
    function near(e) { var r = xz.getBoundingClientRect(); return Math.abs(e.clientX - (r.left + r.width / 2)) < 70 && Math.abs(e.clientY - (r.top + r.height / 2)) < 70; }
    function end(e) {
      if (pid !== e.pointerId || !target) return;
      var t = target; target = null; pid = null; box.classList.remove("drag");
      if (!moved) { open(t.getAttribute("data-id")); return; }
      var hot = near(e); xz.classList.remove("show", "hot");
      if (hot) { var hid = ls(HID) || {}; [].forEach.call(box.querySelectorAll(".nch-h"), function (b) { hid[b.getAttribute("data-id")] = b.getAttribute("data-at"); }); ls(HID, hid); box.hidden = true; return; }
      pos = { side: e.clientX < innerWidth / 2 ? "l" : "r", y: Math.max(0, Math.min(1, box.offsetTop / innerHeight)) }; ls(KEY, pos); place();
    }
    box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
    box.addEventListener("keydown", function (e) { var h = e.target.closest(".nch-h"); if (h && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(h.getAttribute("data-id")); } });
    addEventListener("resize", place);
  }
  function full(id) { var u = "crm-chat.html" + (id ? "#" + id : ""); if (window.goTo) window.goTo(u); else location.href = u; }
  /* малкият прозорец: целият разговор от съответната платформа, отговорът се пише направо в него */
  function placeWin() {
    if (!win || win.hidden) return;
    var w = innerWidth, h = innerHeight, dh = dockH(), phone = w < 640;
    if (phone) { win.style.left = "8px"; win.style.right = "8px"; win.style.width = "auto"; win.style.top = "58px"; win.style.height = Math.max(320, h - dh - 58 - 12) + "px"; win.style.transformOrigin = (pos.side === "l" ? "0" : "100%") + " 30%"; return; }
    var W = Math.min(420, w - 100), H = Math.min(680, h - dh - 40);
    win.style.right = "auto"; win.style.width = W + "px"; win.style.height = H + "px"; win.style.top = Math.max(12, h - dh - 18 - H) + "px";
    win.style.left = (pos.side === "l" ? 80 : w - W - 80) + "px"; win.style.transformOrigin = pos.side === "l" ? "0 50%" : "100% 50%";
  }
  function open(id) {
    if (win && !win.hidden && openId === id) { closeWin(); return; }
    openId = id;
    if (!win) {
      win = document.createElement("section"); win.id = "nch-win"; win.hidden = true; win.setAttribute("role", "dialog"); win.setAttribute("aria-label", "Разговор");
      frame = document.createElement("iframe"); frame.title = "Разговор"; frame.src = "crm-chat.html?mini=1&inframe=1#" + id;
      win.appendChild(frame); document.body.appendChild(win);
    } else if (frame.contentWindow) {
      try { frame.contentWindow.postMessage({ nch: 1, act: "open", id: id }, location.origin); } catch (x) {}
    }
    win.hidden = false; placeWin(); requestAnimationFrame(function () { win.classList.add("show"); });
    render();
  }
  function closeWin() {
    if (!win) return; openId = null; win.classList.remove("show");
    setTimeout(function () { if (!openId) win.hidden = true; }, 220); render();
  }
  addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || !e.data.nch) return;
    if (e.data.act === "close") closeWin();
    if (e.data.act === "full") full(e.data.id);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && win && !win.hidden) closeWin(); });
  addEventListener("resize", placeWin);

  function load() {
    return D.sb().from("nd_chats").select("id,platform,data,last_at").order("last_at", { ascending: false, nullsFirst: false }).limit(60).then(function (r) {
      if (r.error) return; chats = r.data || []; render();
      var tot = chats.reduce(function (a, c) { return a + (+(c.data || {}).unread || 0); }, 0);
      try { if (window.NDInquiries && NDInquiries.chatBadge) NDInquiries.chatBadge(tot); } catch (x) {}
    });
  }
  var deb = null;
  D.ready().then(function () {
    load();
    try {
      D.sb().channel("nd-chatheads").on("postgres_changes", { event: "*", schema: "public", table: "nd_chats" }, function () { clearTimeout(deb); deb = setTimeout(load, 300); }).subscribe();
    } catch (x) {}
    setInterval(function () { if (!document.hidden) load(); }, 45000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); });
  }).catch(function () {});
})();
