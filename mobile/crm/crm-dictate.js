/* Диктовка навсякъде: всяко поле за бележка/описание (textarea и по-дълги текстови полета) получава микрофон.
   Докосваш → говориш → докосваш пак; записът се разпознава дословно (/api/transcribe, Gemini) и текстът се добавя там, където е курсорът. */
(function () {
  "use strict";
  if (window.NDDictate) return;
  var css = ".nd-dct{position:absolute;right:10px;bottom:10px;z-index:5;width:40px;height:40px;border-radius:50%;border:0;padding:0;cursor:pointer;display:grid;place-items:center;" +
    "background:linear-gradient(180deg,#fffbf7,#fbeee3);color:#7b1020;box-shadow:0 0 0 1.5px rgba(237,196,122,.9),0 0 12px rgba(255,214,160,.8),0 3px 6px rgba(120,50,20,.2);transition:transform .2s,box-shadow .2s}" +
    ".nd-dct svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}" +
    ".nd-dct:hover{transform:scale(1.06);box-shadow:0 0 0 2px #edc47a,0 0 16px rgba(255,214,160,.95)}" +
    ".nd-dct.rec{color:#fff3dc;background:linear-gradient(180deg,#c8233f,#7a0f22);animation:ndDctPulse 1.1s ease-in-out infinite}" +
    ".nd-dct.busy{opacity:.6;cursor:wait}.nd-dct.busy svg{animation:ndDctSpin .9s linear infinite}" +
    ".nd-dct-wrap{position:relative}.nd-dct-wrap>textarea,.nd-dct-wrap>input{padding-right:54px!important}" +
    ".ndg.view .nd-dct,.dgrid .ditem.view .nd-dct,#f-body.view .ef:not(.editing) .nd-dct{display:none}" +
    "@keyframes ndDctPulse{0%,100%{box-shadow:0 0 0 2px #edc47a,0 0 10px rgba(200,35,63,.6)}50%{box-shadow:0 0 0 4px rgba(237,196,122,.6),0 0 22px rgba(200,35,63,.9)}}" +
    "@keyframes ndDctSpin{to{transform:rotate(360deg)}}";
  var MIC = '<svg viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
  var STOP = '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  var SPIN = '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>';
  function boot() { if (document.getElementById("nd-dct-css")) return; var s = document.createElement("style"); s.id = "nd-dct-css"; s.textContent = css; document.head.appendChild(s); }
  function token() { if (window.ND && window.ND.token) return window.ND.token(); if (window.NDAsh && window.NDAsh.token) return window.NDAsh.token(); try { var s = JSON.parse(localStorage.getItem("sb-hyvwfsmjbaynozceookv-auth-token") || "null"); return Promise.resolve(s && s.access_token || ""); } catch (e) { return Promise.resolve(""); } }
  function say(t) { if (window.ND && window.ND.say) window.ND.say(t); else if (window.D && window.D.say) window.D.say(t); else console.log(t); }
  function mimeType() { var c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"]; for (var i = 0; i < c.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c[i])) return c[i]; return ""; }
  function insert(el, text) {
    var v = el.value, s = el.selectionStart != null ? el.selectionStart : v.length, e = el.selectionEnd != null ? el.selectionEnd : v.length;
    var before = v.slice(0, s), after = v.slice(e);
    var sep = before && !/[\s\n]$/.test(before) ? (el.tagName === "TEXTAREA" && /[.!?…]$/.test(before.trim()) ? "\n" : " ") : "";
    el.value = before + sep + text + after;
    var pos = (before + sep + text).length; try { el.setSelectionRange(pos, pos); } catch (x) {}
    el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
  }
  var active = null;
  function attach(el) {
    if (!el || el.dataset.dct || el.type === "password" || el.readOnly || el.disabled) return;
    if (el.tagName !== "TEXTAREA" && !el.hasAttribute("data-dictate") && !/notes|note|desc|бележ|опис|коментар|message|msg|body|zabel|comment/i.test(el.id + " " + el.name + " " + el.placeholder + " " + (el.getAttribute("aria-label") || ""))) return;
    if (el.closest(".nda-c") || el.closest(".m-notes") || el.closest(".ndv") || el.hasAttribute("data-nodictate")) return; /* чатът на Тед и бележките на клиента си имат микрофон */
    el.dataset.dct = "1";
    var wrap = el.parentNode;
    if (!wrap.classList.contains("nd-dct-wrap")) { if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative"; wrap.classList.add("nd-dct-wrap"); }
    var b = document.createElement("button"); b.type = "button"; b.className = "nd-dct"; b.innerHTML = MIC; b.title = "Диктувай – докоснете, говорете, докоснете пак"; b.setAttribute("aria-label", "Диктувай");
    if (el.tagName !== "TEXTAREA") { b.style.width = b.style.height = "32px"; b.style.bottom = "50%"; b.style.transform = "translateY(50%)"; }
    el.insertAdjacentElement("afterend", b);
    var rec = null, chunks = [], stream = null, t0 = 0;
    b.addEventListener("click", function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (rec && rec.state === "recording") { rec.stop(); return; }
      if (active && active !== b) { say("Първо спрете другия запис"); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { say("Браузърът не поддържа запис на глас"); return; }
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (s) {
        stream = s; chunks = []; var type = mimeType(); active = b;
        rec = type ? new MediaRecorder(s, { mimeType: type }) : new MediaRecorder(s);
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          b.classList.remove("rec"); b.innerHTML = MIC; stream.getTracks().forEach(function (t) { t.stop(); }); active = null;
          if (Date.now() - t0 < 600 || !chunks.length) return;
          var mime = (rec.mimeType || type || "audio/webm").split(";")[0], r = new FileReader();
          b.classList.add("busy"); b.innerHTML = SPIN;
          r.onload = function () {
            token().then(function (tok) { return fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ mime: mime, data: String(r.result).split(",")[1] }) }); })
              .then(function (x) { return x.json(); })
              .then(function (j) { if (j.ok && j.text) { el.focus({ preventScroll: true }); insert(el, j.text); } else say(j.error || "Не чух ясно – опитайте пак"); })
              .catch(function () { say("Няма връзка"); })
              .then(function () { b.classList.remove("busy"); b.innerHTML = MIC; });
          };
          r.readAsDataURL(new Blob(chunks, { type: mime }));
        };
        rec.start(); t0 = Date.now(); b.classList.add("rec"); b.innerHTML = STOP;
        setTimeout(function () { if (rec && rec.state === "recording") rec.stop(); }, 180000);
      }).catch(function () { say("Разрешете микрофона за сайта"); });
    });
  }
  function scan(root) { boot(); [].forEach.call((root || document).querySelectorAll("textarea,input[type=text],input:not([type])"), attach); }
  function start() {
    scan(document);
    new MutationObserver(function (ms) { var need = false; ms.forEach(function (m) { if (m.addedNodes && m.addedNodes.length) need = true; }); if (need) { clearTimeout(start._t); start._t = setTimeout(function () { scan(document); }, 120); } }).observe(document.documentElement, { childList: true, subtree: true });
  }
  window.NDDictate = { attach: attach, scan: scan, insert: insert };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
