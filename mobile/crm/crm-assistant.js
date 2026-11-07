/* CRM skill for Тед Асистент (mobile/ash.js): "АИ Качване на имот" – вградено в „Чат с Тед“ (бутон „Умения“, 📎 → „Папка на имота“ или по команда „качи имот“).
   Attach a property folder / photos + опис / a photo -> real AI analysis (/api/scan) -> the "Нов имот" card opens
   with the fields filled in -> on "Запази" the property is stored as a draft. Same code as "Нов имот → Сканиране → Прикачи папка". */
(function () {
  "use strict";
  var D = window.ND, A = window.NDAsh;
  if (!D || !A) return;
  var esc = A.esc;
  var I = {
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6M9 13h6"/></svg>',
    files: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3"/></svg>'
  };
  function loadScript(src) { return new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error(src)); }; document.head.appendChild(s); }); }
  var depsP = null;
  function deps() {
    if (depsP) return depsP;
    var p = Promise.resolve();
    if (!window.NDPlaces) p = p.then(function () { return loadScript("../places.js"); });
    if (!window.NDProps) p = p.then(function () { return loadScript("crm-imoti-tabs.js"); });
    if (!window.NDScan) p = p.then(function () { return loadScript("crm-scan.js"); });
    depsP = p.then(function () {
      if (window.NDProps.ready()) return;
      /* outside the Имоти page: minimal hooks so the same "Нов имот" card works here */
      return D.ready().then(function () { return D.load("properties"); }).catch(function () { return []; }).then(function (props) {
        var cl = []; D.load("clients").then(function (c) { cl = (c || []).map(function (x) { return x.name; }).filter(Boolean); }).catch(function () {});
        window.NDProps.init({ say: D.say, list: function () { return props || []; }, clientNames: function () { return cl; },
          refresh: function () { return D.load("properties").then(function (x) { props = x; }).catch(function () {}); }, reopen: function () {}, closeCard: function () {} });
      });
    });
    depsP.catch(function () { depsP = null; });
    return depsP;
  }
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function n(v) { return v == null || v === "" ? "" : new Intl.NumberFormat("bg-BG").format(v); }
  var foot = null;
  function lock(on) { if (foot) [].forEach.call(foot.querySelectorAll("button"), function (b) { b.disabled = on; }); }

  function run(api, files) {
    var rel = files[0].webkitRelativePath || "", folder = rel.indexOf("/") > 0 ? rel.split("/")[0] : "";
    var ni = files.filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name); }).length;
    var nv = files.filter(function (f) { return /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name); }).length;
    api.add("u", (folder ? "📁 " + esc(folder) + "\n" : "") + files.length + " файла · " + ni + " снимки" + (nv ? " · " + nv + " видеа" : "") + (files.length - ni - nv > 0 ? " · опис" : ""));
    var wait = api.add("a", "Анализирам", "wait"); lock(true);
    var timer = setTimeout(function () { lock(false); }, 120000);
    deps().then(function () {
      window.NDScan.folder(files, {
        manual: function () {},
        scanned: function (f, file, bundle) {
          clearTimeout(timer); lock(false); wait.remove();
          var PL = window.NDPlaces;
          var rows = [["Заглавие", f.title], ["Официална цена", f.price ? n(f.price) + " €" : ""], ["Цена към собственика", f.ownerPrice ? n(f.ownerPrice) + " €" : ""],
            ["Тип", f.type], ["Град", PL ? PL.city(f.city) : f.city], ["Квартал", PL ? PL.hood(f.city, f.hood) : f.hood],
            ["Площ", f.area ? f.area + " м²" : ""], ["Стаи", f.rooms], ["Етаж", f.floor], ["Собственик", f.client], ["Телефон", f.ownerPhone],
            ["Снимки", (bundle.pics || []).length], ["Видеа", (bundle.videos || []).length || ""]].filter(function (r) { return r[1] !== "" && r[1] != null; });
          api.add("a", "Готово – попълних картата „Нов имот“. Прегледайте и натиснете „Запази“.<table>" + rows.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td></tr>"; }).join("") + "</table>");
          A.hide();
          window.NDProps.edit(null, f, null, bundle, function (saved, p) {
            A.show();
            api.add("a", "✔ Имотът " + esc(p.code) + " е записан като „" + esc(p.status || "Чернова") + "“ – " + esc([p.city, p.hood].filter(Boolean).join(", ")) + (p.price ? ", " + n(p.price) + " €" : "") +
              ". " + (p.pics || []).length + " снимки" + ((p.videos || []).length ? ", " + p.videos.length + " видеа" : "") + "." +
              (/crm-imoti\.html/.test(location.pathname) ? "" : '\n<a class="go" href="crm-imoti.html">Отвори в Имоти</a>'));
          });
        }
      });
      var seen = false, t0 = Date.now(), poll = setInterval(function () {
        if (!wait.isConnected) return clearInterval(poll);
        if (document.querySelector(".nds-ov:not([hidden])")) { seen = true; return; }
        if (seen || Date.now() - t0 > 6000) { clearInterval(poll); clearTimeout(timer); lock(false); wait.classList.remove("wait"); wait.textContent = seen ? "Анализът е прекъснат. Опитайте отново." : "Не открих снимки или опис в избраното. Опитайте отново."; }
      }, 700);
    }).catch(function (e) { clearTimeout(timer); lock(false); wait.classList.remove("wait"); wait.textContent = "Грешка: " + ((e && e.message) || e); });
  }
  function pick(api, mode) {
    var inp = document.createElement("input"); inp.type = "file";
    if (mode === "camera") { inp.accept = "image/*"; inp.setAttribute("capture", "environment"); }
    else { inp.multiple = true; if (mode === "folder" && "webkitdirectory" in inp) { inp.webkitdirectory = true; inp.setAttribute("webkitdirectory", ""); inp.setAttribute("directory", ""); } else inp.accept = "image/*,video/*,.zip,.txt,.md,.rtf,.doc,.docx,.pdf,text/plain,application/pdf,application/zip"; }
    inp.style.cssText = "position:fixed;left:-999px;top:0;opacity:0"; document.body.appendChild(inp);
    inp.onchange = function () { var fs = [].slice.call(inp.files || []); inp.remove(); if (fs.length) run(api, fs); };
    inp.click();
  }

  A.addSkill({
    id: "upload", name: "АИ Качване на имот", sub: "Папка, снимки и опис → попълнена карта на имот", embed: true, icon: "🏠", order: 1,
    pick: function (api, mode) { deps().catch(function () {}); pick(api, mode); },
    open: function () { deps().catch(function () {}); },
    intro: function (api) {
      deps().catch(function () {});
      api.add("a", "<b>АИ Качване на имот</b>\nПрикачете папката на имота (снимки, видеа и опис) или отделно снимки и опис. Анализирам всичко и попълвам картата „Нов имот“:\n" +
        "• цена от името на папката → „Официална цена“\n• цена към собственика, собственик и телефон → само в личните данни\n• целият опис → „Лично описание“\n• ново публично описание без точен адрес, с телефон 0898977370\n• град и квартал точно според сайта\n• до 100 снимки с лого и до 10 видеа\nАко телефонът не позволява избор на папка: във „Файлове“ задръжте папката → „Компресирай“ и изберете .zip файла през „Снимки и опис“.\nНищо не се публикува – имотът се записва като „Чернова“.");
    },
    footer: function () {
      return '<div class="nda-f"><button type="button" data-a="folder"><span class="ib">' + I.folder + '</span>Прикачи папка</button><button type="button" data-a="files"><span class="ib">' + I.files + '</span>Снимки и опис</button><button type="button" data-a="camera"><span class="ib">' + I.cam + "</span>Снимай</button></div>";
    },
    bind: function (api, el) { foot = el; el.querySelector(".nda-f").onclick = function (e) { var b = e.target.closest("[data-a]"); if (b && !b.disabled) pick(api, b.getAttribute("data-a")); }; }
  });
})();
