/* „Запитвания“ – на мястото на бутона „Отчети“ в навигацията (три линии). На телефон менюто се вдига нагоре над дока,
   на десктоп се отваря като панел до страничната лента. Вътре: кандидатурите за ипотечен кредит от сайта (nd_inquiries,
   с документите по месеци и резултата от проверката), запитванията от сайта и самите „Отчети“ (нищо не се губи).
   Карта на кандидатура → документите се отварят вътре; „Запази карта на клиента“ създава клиент + документите му. */
(function () {
  "use strict";
  var D = window.ND, U = window.NDUI;
  if (!D || !U) return;
  var esc = U.esc, ic = U.ic, money = U.money;
  var css =
    "#ndq{position:fixed;z-index:70;display:flex;flex-direction:column;border-radius:26px;border:1.5px solid rgba(237,196,122,.9);background:linear-gradient(165deg,rgba(255,250,244,.97),rgba(251,236,224,.96));box-shadow:0 0 0 1px rgba(255,255,255,.5) inset,0 0 26px rgba(255,214,150,.55),0 18px 44px rgba(60,8,18,.35);color:#3a0c12;font:400 15px/1.35 var(--cond,'Roboto Condensed',Arial,sans-serif);overflow:hidden;isolation:isolate;opacity:0;pointer-events:none;transition:opacity .22s ease,transform .26s cubic-bezier(.2,.8,.2,1)}" +
    "#ndq::after{content:'';position:absolute;right:0;top:0;bottom:0;width:48%;background:url(/mobile/crm/assets/nd/ph09.jpg) center/cover;opacity:.16;z-index:-1;-webkit-mask-image:linear-gradient(270deg,#000 15%,transparent);mask-image:linear-gradient(270deg,#000 15%,transparent)}" +
    "#ndq.show{opacity:1;pointer-events:auto;transform:none}" +
    "#ndq{left:12px;right:12px;bottom:calc(128px + env(safe-area-inset-bottom,0px));max-height:min(68vh,640px);transform:translateY(26px)}" +
    "html.rail #ndq{left:calc(var(--rail,112px) + 14px);right:auto;top:14px;bottom:14px;width:400px;max-height:none;transform:translateX(-26px)}" +
    "#ndq .ndq-h{display:flex;align-items:center;gap:10px;padding:14px 16px 12px;border-bottom:1px solid rgba(227,178,94,.55);background:linear-gradient(180deg,rgba(163,33,58,.08),transparent)}" +
    "#ndq .ndq-h h3{margin:0;font:700 20px/1 var(--cond,'Roboto Condensed',Arial,sans-serif);color:#6b0a1c;display:flex;align-items:center;gap:8px}#ndq .ndq-h h3 svg{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round}" +
    "#ndq .ndq-h .n{padding:2px 9px;border-radius:10px;background:linear-gradient(180deg,#b42446,#7a0f22);color:#fff3dc;font-size:12.5px;font-weight:700}#ndq .ndq-h .x{margin-left:auto;width:34px;height:34px;border-radius:50%;border:1.5px solid #e3b25e;background:#fffaf4;color:#6b0a1c;font-size:18px;cursor:pointer}" +
    "#ndq .ndq-l{overflow:auto;padding:10px 12px 14px;display:grid;gap:8px;align-content:start}" +
    "#ndq .ndq-g{font:700 12.5px var(--cond,'Roboto Condensed',Arial,sans-serif);color:#8d6a50;letter-spacing:.3px;text-transform:uppercase;margin:6px 2px 0}" +
    "#ndq .ndq-i{display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;padding:9px 10px;border-radius:16px;border:1px solid rgba(227,178,94,.7);background:linear-gradient(180deg,#fffdf9,#fbefe5);box-shadow:0 0 8px rgba(255,214,150,.4);cursor:pointer;text-align:left;color:inherit;transition:transform .2s,box-shadow .2s}" +
    "#ndq .ndq-i:hover{transform:translateY(-1px);box-shadow:0 0 0 1px rgba(237,196,122,.9),0 0 16px rgba(255,214,150,.7)}" +
    "#ndq .ndq-i .ib{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:#fff3dc;background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);box-shadow:0 0 0 1.5px #edc47a,0 0 8px rgba(255,190,120,.55)}#ndq .ndq-i .ib svg{width:20px;height:20px}" +
    "#ndq .ndq-i b{display:block;font-size:15.5px;color:#4e0912}#ndq .ndq-i span.s{display:block;font-size:13px;color:#6b4a40}#ndq .ndq-i .st{justify-self:end;display:grid;gap:4px;justify-items:end}#ndq .ndq-i .st em{font-style:normal;padding:2px 8px;border-radius:9px;font-size:11.5px;font-weight:700;color:#fff3dc;background:linear-gradient(180deg,#e0a02c,#b0730e)}#ndq .ndq-i .st em.ok{background:linear-gradient(180deg,#4f9a2a,#2b6a10)}#ndq .ndq-i .st small{font-size:11.5px;color:#8d6a50}" +
    "#ndq .ndq-empty{padding:18px 10px;color:#6b4a40;font-size:15px}" +
    ".nv .nvq{position:absolute;top:10px;right:16px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:linear-gradient(180deg,#f2c56a,#d6a447);color:#4a2015;font:700 12px/20px var(--sans,Arial);text-align:center;box-shadow:0 0 0 1.5px #fff6ea}#ndside .nv .nvq{top:6px;right:8px}" +
    "#nd-fwin .ndq-doc{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;padding:8px 10px;border-radius:14px;border:1px solid rgba(227,178,94,.6);background:rgba(255,255,255,.55);cursor:pointer;margin-top:6px}#nd-fwin .ndq-doc .k{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;background:linear-gradient(180deg,#4f9a2a,#2b6a10)}#nd-fwin .ndq-doc.bad .k{background:linear-gradient(180deg,#c8233f,#7a0f22)}#nd-fwin .ndq-doc b{display:block;font-size:15px;color:#4e0912}#nd-fwin .ndq-doc small{display:block;font-size:12.5px;color:#6b4a40}#nd-fwin .ndq-doc.bad small{color:#a1122c}#nd-fwin .ndq-doc .v{font-size:13px;color:#6b0a1c;font-weight:700}" +
    "#nd-fwin .ndq-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}#nd-fwin .ndq-acts button{flex:1;min-width:150px;height:42px;border-radius:14px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;font:700 15px var(--cond,'Roboto Condensed',Arial,sans-serif);cursor:pointer}#nd-fwin .ndq-acts .pr{background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);color:#fff3dc;border-color:#edc47a;box-shadow:0 0 12px rgba(255,190,120,.55)}#nd-fwin .ndq-acts button:disabled{opacity:.55}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var MENU = '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  var box = null, items = [], site = [], mailN = 0, chatN = 0, loadedAt = 0, loading = null;

  function load(force) {
    if (loading) return loading;
    if (!force && Date.now() - loadedAt < 20000) return Promise.resolve();
    loading = D.ready().then(function () { return Promise.all([D.load("inquiries").catch(function () { return []; }), D.load("activities").catch(function () { return []; }), D.load("mail").catch(function () { return []; }), D.load("chats").catch(function () { return []; })]); }).then(function (r) {
      mailN = (r[2] || []).filter(function (m) { return m.folder === "in" && !m.read; }).length;
      chatN = (r[3] || []).reduce(function (a, c) { return a + (+c.unread || 0); }, 0);
      items = r[0].sort(function (a, b) { return String(b.at || b._created).localeCompare(String(a.at || a._created)); });
      site = r[1].filter(function (a) { return a.source === "site" && !a.inquiry_id; }).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).slice(0, 30);
      loadedAt = Date.now(); loading = null; badge();
    }).catch(function () { loading = null; });
    return loading;
  }
  function badge() {
    var n = items.filter(function (i) { return i.status === "Ново"; }).length + mailN + chatN;
    [].forEach.call(document.querySelectorAll('[data-nav="Запитвания"]'), function (b) { var q = b.querySelector(".nvq"); if (!q) { q = document.createElement("b"); q.className = "nvq"; b.appendChild(q); } q.textContent = n || ""; q.hidden = !n; });
  }
  function when(t) { return t ? U.bgDateTime(t) : ""; }
  function render() {
    if (!box) return;
    var h = '<div class="ndq-h"><h3>' + MENU + "Запитвания</h3>" + (items.length ? '<span class="n">' + items.filter(function (i) { return i.status === "Ново"; }).length + " нови</span>" : "") + '<button type="button" class="x" aria-label="Затвори">✕</button></div><div class="ndq-l">';
    h += '<div class="ndq-g">Поща</div><button type="button" class="ndq-i" data-mail><span class="ib">' + ic("mail") + '</span><span><b>Поща</b><span class="s">office@imotinadezhda.bg – входящи и изпратени</span></span><span class="st">' + (mailN ? '<em>' + mailN + (mailN === 1 ? " ново" : " нови") + "</em>" : ic("chev-r")) + "</span></button>";
    h += '<button type="button" class="ndq-i" data-chat><span class="ib">' + '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' + '</span><span><b>Чат</b><span class="s">WhatsApp · Messenger · Instagram – отговаряте ръчно</span></span><span class="st">' + (chatN ? "<em>" + chatN + (chatN === 1 ? " ново" : " нови") + "</em>" : ic("chev-r")) + "</span></button>";
    h += '<div class="ndq-g">Кандидатури за ипотечен кредит</div>';
    if (!items.length) h += '<div class="ndq-empty">Още няма кандидатури. Клиентите кандидатстват от бутона „Кандидатствай за ипотечен кредит“ под описанието на всяка обява.</div>';
    h += items.map(function (i, k) {
      var n = (i.docs || []).length, ok = (i.docs || []).filter(function (d) { return d.status === "ok"; }).length;
      return '<button type="button" class="ndq-i" data-q="' + k + '"><span class="ib">' + ic("landmark") + "</span><span><b>" + esc(i.name || "Без име") + "</b><span class=\"s\">" + esc((i.typeLabel || "") + (i.property && (i.property.code || i.property.title) ? " · " + (i.property.code ? "обява " + i.property.code : i.property.title) : "")) + '</span></span><span class="st"><em class="' + (i.status === "Записан" ? "ok" : "") + '">' + esc(i.status || "Ново") + "</em><small>" + ok + "/" + n + " док. · " + esc(when(i.at || i._created)) + "</small></span></button>";
    }).join("");
    if (site.length) h += '<div class="ndq-g">Запитвания и огледи от сайта</div>' + site.map(function (a) { return '<button type="button" class="ndq-i" data-c="' + esc(a.client_id || "") + '"><span class="ib">' + ic(a.icon || "mail") + "</span><span><b>" + esc(a.client || "Посетител") + '</b><span class="s">' + esc(String(a.text || "").slice(0, 90)) + '</span></span><span class="st"><small>' + esc(when(a.at)) + "</small></span></button>"; }).join("");
    h += '<div class="ndq-g">Още</div><button type="button" class="ndq-i" data-rep><span class="ib">' + ic("chart") + '</span><span><b>Отчети</b><span class="s">Обобщение, сделки, имоти, активност</span></span><span class="st">' + ic("chev-r") + "</span></button>";
    h += "</div>";
    box.innerHTML = h;
  }
  function build() {
    if (box) return box;
    box = document.createElement("section"); box.id = "ndq"; box.setAttribute("role", "menu"); box.setAttribute("aria-label", "Запитвания");
    document.body.appendChild(box);
    box.addEventListener("click", function (e) {
      if (e.target.closest(".x")) { hide(); return; }
      var q = e.target.closest("[data-q]"); if (q) { hide(); card(items[+q.getAttribute("data-q")]); return; }
      var c = e.target.closest("[data-c]"); if (c) { hide(); var id = c.getAttribute("data-c"); if (id) { if (window.goTo) goTo("crm-klienti.html#" + id); else location.href = "crm-klienti.html#" + id; } return; }
      if (e.target.closest("[data-rep]")) { hide(); if (window.NDGlobal) NDGlobal.reports(); return; }
      if (e.target.closest("[data-chat]")) { hide(); if (window.goTo) goTo("crm-chat.html"); else location.href = "crm-chat.html"; return; }
      if (e.target.closest("[data-mail]")) { hide(); if (window.goTo) goTo("crm-poshta.html"); else location.href = "crm-poshta.html"; }
    });
    document.addEventListener("click", function (e) { if (box && box.classList.contains("show") && !box.contains(e.target) && !e.target.closest('[data-nav="Запитвания"]')) hide(); }, true);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
    return box;
  }
  function show() { build(); render(); requestAnimationFrame(function () { box.classList.add("show"); }); load(true).then(render); }
  function hide() { if (box) box.classList.remove("show"); }
  function toggle() { if (box && box.classList.contains("show")) hide(); else show(); }

  /* ---------- карта на кандидатура ---------- */
  function card(i) {
    if (!i) return;
    var docs = (i.docs || []).map(function (d) { return Object.assign({}, d, { name: d.label || d.name || d.key, mime: d.mime || "" }); });
    var pay = i.payment && (i.payment.from || i.payment.to) ? "от € " + money(i.payment.from) + " до € " + money(i.payment.to) + " / месец (кредит € " + money(i.payment.loan) + ", " + (i.payment.years || "") + " г., " + (i.payment.rate || "") + ")" : "";
    var info = [["Име", i.name], ["Телефон", i.phone], ["Имейл", i.email], ["Кандидатства като", i.typeLabel], ["Обява", i.property ? [i.property.code, i.property.title, i.property.city, i.property.price ? "€ " + money(i.property.price) : ""].filter(Boolean).join(" · ") : ""], ["Вноска", pay], ["Период на извлеченията", i.months ? "последните " + i.months + " месеца" : ""], ["Подадено", when(i.at || i._created)], ["Статус", i.status || "Ново"]].filter(function (x) { return x[1]; });
    var okN = docs.filter(function (d) { return d.status === "ok"; }).length;
    var html = '<div class="ndg noimg one"><div class="ndg-h">' + ic("landmark") + 'Кандидатура за ипотечен кредит</div><div class="ndg-f"><table class="ndq-t" style="width:100%;border-collapse:collapse;font-size:16px">' + info.map(function (x) { return "<tr><td style=\"padding:5px 10px 5px 0;color:#8d1530;font-weight:700;white-space:nowrap;vertical-align:top\">" + esc(x[0]) + "</td><td style=\"padding:5px 0\"><b>" + esc(x[1]) + "</b></td></tr>"; }).join("") + "</table></div></div>" +
      '<div class="ndg noimg one"><div class="ndg-h">' + ic("file-text") + "Документи (" + okN + " приети от " + docs.length + ')</div><div class="ndg-f" id="ndq-docs">' + (docs.length ? docs.map(function (d, k) { return '<div class="ndq-doc ' + (d.status === "ok" ? "ok" : "bad") + '" data-d="' + k + '"><span class="k">' + (d.status === "ok" ? "✔" : "✖") + "</span><span><b>" + esc(d.name) + "</b><small>" + esc(d.status === "ok" ? (d.summary || "Приет") : ("Грешен документ" + (d.summary ? " – " + d.summary : ""))) + '</small></span><span class="v">Отвори</span></div>'; }).join("") : '<div class="ndempty">Няма прикачени документи.</div>') + "</div></div>" +
      (i.client_id ? '<div class="ndq-acts"><button type="button" data-open>Отвори клиента</button></div>' : "");
    var x = U.open({ title: "Кандидатура – " + (i.name || ""), icon: "landmark", photo: "nd/ph13.jpg", html: html, view: true, noSave: !!i.client_id, saveText: "Запази карта на клиента", cancelText: "Затвори",
      onSave: function () { return saveClient(i).then(function () { D.say("Клиентът е записан с " + docs.length + " документа"); try { window.dispatchEvent(new CustomEvent("nd-data-changed")); } catch (z) {} setTimeout(function () { card(i); }, 300); }); },
      onDelete: function () { if (!confirm("Да изтрия ли кандидатурата?")) return false; return D.del("inquiries", i.id).then(function () { items = items.filter(function (z) { return z !== i; }); badge(); D.say("Изтрито"); }); } });
    var body = x.q("nd-f-body");
    body.onclick = function (e) {
      var d = e.target.closest("[data-d]"); if (d) { window.NDDocs ? NDDocs.view(x.q("ndq-docs"), docs.map(function (z) { return { name: z.name, path: z.path, mime: z.mime }; }), +d.getAttribute("data-d")) : D.fileUrl(docs[+d.getAttribute("data-d")].path).then(function (u) { if (u) window.open(u, "_blank"); }); return; }
      if (e.target.closest("[data-open]")) { U.close(); if (window.goTo) goTo("crm-klienti.html#" + i.client_id); else location.href = "crm-klienti.html#" + i.client_id; return; }
    };
  }
  function saveClient(i) {
    var now = new Date().toISOString(), p = i.property || {};
    var c = { name: i.name || "Кандидат", phone: i.phone || "", email: i.email || "", cat: "sales", status: "Потенциален", source: "Сайт / Ипотечен кредит", city: p.city || "", hood: p.hood || "", type: "", budget: p.price || null, payment: "Банков кредит", priority: "Горещ", contact_at: now,
      notes: "Кандидатстване за ипотечен кредит" + (i.typeLabel ? " – " + i.typeLabel : "") + (p.code || p.title ? ". Обява: " + [p.code, p.title].filter(Boolean).join(" ") : "") + (i.payment && i.payment.from ? ". Вноска от € " + money(i.payment.from) + " до € " + money(i.payment.to) + " / месец" : "") + ". Документи: " + (i.docs || []).filter(function (d) { return d.status === "ok"; }).length + " приети от " + (i.docs || []).length + ".",
      prop: p.code || "", interests: p.code ? [p.code] : [], log: [{ icon: "landmark", text: "Кандидатура за ипотечен кредит от сайта", at: now }] };
    return D.put("clients", c).then(function (saved) {
      var cid = saved.id;
      return Promise.all((i.docs || []).map(function (d) { return D.put("documents", { client_id: cid, client: c.name, name: (d.label || d.name || d.key) + (d.status === "ok" ? "" : " (грешен документ)"), folder: "Ипотечен кредит", path: d.path, mime: d.mime || "", size: d.size || 0, at: now, month: d.month || null, verified: d.status === "ok", summary: d.summary || "" }).catch(function () {}); })).then(function () {
        i.status = "Записан"; i.client_id = cid; i.saved_at = now;
        return D.put("inquiries", i).then(function () { badge(); return D.put("activities", { icon: "user-round", client_id: cid, client: c.name, text: "Записан клиент от кандидатура за ипотечен кредит", at: now }).catch(function () {}); });
      }).then(function () { return { id: cid }; });
    });
  }

  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest('[data-nav="Запитвания"]'); if (b) { e.preventDefault(); e.stopImmediatePropagation(); toggle(); } }, true);
  window.NDInquiries = { open: show, close: hide, card: card, reload: function () { return load(true).then(render); }, mailBadge: function (n) { mailN = n || 0; badge(); render(); }, chatBadge: function (n) { chatN = n || 0; badge(); render(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { load(); }); else load();
  window.addEventListener("nd-data-changed", function () { loadedAt = 0; });
})();
