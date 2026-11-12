/* ИМОТИ НАДЕЖДА · TASK-008 · публична страница „Ново строителство“ (без вход).
   Данни: само публичните RPC nd_public_projects() и nd_public_project(slug) с публичния ключ (както mobile/site-data.js).
   Те връщат изброени полета: продаден обект е без цена; няма пътища към планове – само has_plan / plan_kind / tour_count.
   Планове: само /plan/unit/<id> и /plan/floor/<id>; панорами: само /pano/<id>/<n> (сървърът проверява статуса при всяко отваряне).
   Запитване и оглед: съществуващата публична функция nd_public_inquiry (същата като за обявите на сайта). */
(function () {
  "use strict";
  var NC = window.NC; if (!NC) return;
  var U = NC.util, esc = U.esc, F = NC.find;
  var URL = "https://hyvwfsmjbaynozceookv.supabase.co";
  var KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";   /* публичният ключ на сайта (същият като в mobile/site-data.js) */
  var H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
  var SLUG = /^[a-z0-9][a-z0-9-]{2,60}$/, SIG = {}, MODELS = {};
  /* 12.11: проектът в Шумен има собствена страница; „Ново строителство ▾“ → „В проект“ / „Завършено“ (?t=plan|done) */
  var OWN = { "shumen-kv-366": "/mobile/nc-shumen.html" }, Q0 = new URLSearchParams(location.search), T = Q0.get("t") === "done" ? "done" : Q0.get("t") === "plan" ? "plan" : "";
  function ownUrl(slug, uid) { return OWN[slug] ? OWN[slug] + (uid && /^[a-z0-9-]{3,64}$/.test(uid) ? "?uid=" + encodeURIComponent(uid) : "") : null; }
  if (ownUrl(Q0.get("p"))) { location.replace(ownUrl(Q0.get("p"), Q0.get("u"))); return; }
  function isDone(r) { return /^act16$|завърш|акт\s*16|въведен/i.test(String((r && r.stage) || "").trim()); }   /* етапите в CRM са кодове: start … act16 */
  document.addEventListener("click", function (e) { var c = e.target && e.target.closest && e.target.closest(".nc-pcard[data-key]"), u = c && ownUrl(c.getAttribute("data-key")); if (u) { e.preventDefault(); e.stopPropagation(); location.href = u; } }, true);
  function rpc(name, body) {
    return fetch(URL + "/rest/v1/rpc/" + name, { method: "POST", headers: H, body: JSON.stringify(body || {}) }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) { if (!r.ok) { var e = new Error(r.status >= 500 ? "Услугата временно не отговаря – опитайте по-късно." : (j && j.message) || "Грешка " + r.status); e.status = r.status; throw e; } return j; });
    }, function () { throw new Error("Няма връзка – проверете интернета."); });
  }
  function sign(paths) {
    paths = paths.filter(function (p) { return p && !SIG[p]; }); if (!paths.length) return Promise.resolve(SIG);
    return fetch(URL + "/storage/v1/object/sign/nd-files", { method: "POST", headers: H, body: JSON.stringify({ expiresIn: 3600, paths: paths }) })
      .then(function (r) { return r.ok ? r.json() : []; }).then(function (a) { (a || []).forEach(function (x) { if (x && x.signedURL) SIG[x.path] = URL + "/storage/v1" + x.signedURL; }); return SIG; }).catch(function () { return SIG; });
  }
  function unwrap(rows, k) { return (rows || []).map(function (r) { return r && r[k] ? r[k] : r; }); }
  function kindOf(p) { return /\.(mp4|webm|mov)$/i.test(p || "") ? "video" : "image"; }

  function build(P, m009) {
    var M = { project: { id: P.id, key: P.slug, slug: P.slug, title: P.title, city: P.city, hood: P.hood, address: P.address, description: P.description, stage: P.stage, expected_completion: P.expected_completion,
        advantages: P.advantages || [], status: "published", updated_at: P.updated_at, location: null },
      buildings: [], floors: [], units: P.units || [], cover: null, gallery: [], files: [], models: {}, tours: {} };
    MODELS = {};
    (P.buildings || []).forEach(function (b, i) {
      M.buildings.push({ id: b.id, name: b.name, sort: i });
      (b.floors || []).forEach(function (f) { M.floors.push({ id: f.id, building_id: b.id, level: f.level, label: f.label, has_plan: !!f.has_plan, polygons: f.polygons || [] }); });
      /* TASK-009: публикуван модел в nd_models → само защитеният път /model/<сграда> (сървърът проверява публикуването и дава 60-секунден адрес);
         иначе – по-старата медия вид „model“ (подписан публичен файл) */
      if (m009 && m009[b.id]) { M.models[b.id] = 1; MODELS[b.id] = { route: "/model/" + encodeURIComponent(b.id) }; }
      else if (b.model && b.model.length) { M.models[b.id] = b.model.length; MODELS[b.id] = b.model[0]; }
    });
    M.units.forEach(function (u) { if (u.tour_count) M.tours[u.id] = u.tour_count; });
    if (P.cover && SIG[P.cover]) M.cover = { path: P.cover, url: SIG[P.cover], title: "Корица на проекта" };
    (P.gallery || []).forEach(function (p, i) { if (SIG[p]) M.gallery.push({ path: p, url: SIG[p], title: "Медия " + (i + 1), type: kindOf(p) }); });
    (P.files || []).forEach(function (f) { if (f && f.path) M.files.push({ path: f.path, title: f.title, access: "public" }); });
    return M;
  }
  var A = {
    mode: "public",
    list: function () {
      return rpc("nd_public_projects").then(function (rows) {
        rows = unwrap(rows, "nd_public_projects");
        if (T) rows = rows.filter(function (r) { return isDone(r) === (T === "done"); });
        return sign(rows.map(function (r) { return r.cover; })).then(function () {
          return rows.filter(function (r) { return r && r.slug; }).map(function (r) { return { key: r.slug, slug: r.slug, title: r.title, city: r.city, hood: r.hood, status: "published", cover_url: r.cover ? SIG[r.cover] || null : null, counts: { units: r.units_total, free: r.units_free } }; });
        });
      });
    },
    project: function (key) {
      if (!SLUG.test(String(key))) return Promise.resolve(null);
      return rpc("nd_public_project", { p_slug: key }).then(function (P) {
        if (P && P.nd_public_project !== undefined) P = P.nd_public_project;
        if (!P || !P.id) return null;
        /* nd_public_models (TASK-009, nc_005): ако функцията още я няма (404) – просто няма модели от новия път */
        var m9 = rpc("nd_public_models", { p_slug: key }).then(function (r) { if (r && r.nd_public_models !== undefined) r = r.nd_public_models; return r && typeof r === "object" && !Array.isArray(r) ? r : {}; }, function () { return {}; });
        return Promise.all([sign([P.cover].concat(P.gallery || [])), m9]).then(function (x) { return build(P, x[1]); });
      });
    },
    unitPlan: function (u) { return Promise.resolve(u.has_plan && u.status === "free" ? { url: "/plan/unit/" + encodeURIComponent(u.id), label: "План с воден знак" } : { url: null, why: "Планът още не е публикуван." }); },
    floorPlan: function (f) { return Promise.resolve(f.has_plan ? { url: "/plan/floor/" + encodeURIComponent(f.id), label: "Етажен план – заетите апартаменти са закрити" } : { url: null }); },
    fileUrl: function (f) { return sign([f.path]).then(function () { return SIG[f.path] || null; }); },
    modelUrl: function (b) { var p = MODELS[b.id]; if (p && p.route) return Promise.resolve(p.route); return p ? sign([p]).then(function () { return SIG[p] || null; }) : Promise.resolve(null); },
    tourItems: function (u) { var n = u.status === "free" ? u.tour_count || 0 : 0, a = []; for (var i = 0; i < n && i < 30; i++) a.push({ url: "/pano/" + encodeURIComponent(u.id) + "/" + i, title: "Панорама " + (i + 1) }); return Promise.resolve(a); },
    /* TASK-010: публичният източник на компонента (nd_public_tour + /pano/<обект>/<n>); rpc е същата функция с публичния ключ */
    tour10Source: function (L, u) { return typeof L.publicSource === "function" ? L.publicSource({ rpc: rpc, unitId: u.id, unit: { id: u.id, code: u.code, status: u.status, area_total: u.area_total, area_net: u.area_net, terrace_area: u.terrace_area, exposure: u.exposure, rooms: u.rooms } }) : null; },
    shareUrl: function (M, u) { return location.origin + "/mobile/nc.html?p=" + encodeURIComponent(M.project.slug) + (u ? "&u=" + encodeURIComponent(u.id) : ""); },
    listTitle: T === "done" ? "Завършени проекти – ново строителство" : T === "plan" ? "В проект – ново строителство" : "",
    emptyTitle: T === "done" ? "Няма завършени проекти" : T === "plan" ? "Няма проекти в проект" : "",
    emptyText: T === "done" ? "В момента няма завършени проекти ново строителство. Вижте проектите „В проект“." : T === "plan" ? "В момента няма проекти в проект." : "",
    listQuery: function (q) { if (T) q.set("t", T); },
    canMortgage: function () { return false; },
    acts: {}
  };
  /* формите: запитване и оглед → nd_public_inquiry (сървърът валидира телефон/имейл, свързва клиента и пази от наводняване) */
  A.contactForms = function (M, u) {
    var today = U.today(), opts = [["", "— целият проект —"]].concat(M.units.map(function (x) { return [x.id, x.code + " – " + NC.dict.ST[x.status]]; }));
    var priv = 'С изпращането приемате <a href="/privacy.html" target="_blank" rel="noopener">Политиката за поверителност</a>. Нужен е телефон или имейл.';
    return NC.formHtml("nc-inquiry", "Изпрати запитване", "mail",
      NC.input("q-name", "Име и фамилия", "text", { req: true, ac: "name", max: 200 }) + NC.input("q-phone", "Телефон", "tel", { ac: "tel", max: 40, ph: "+359" }) + NC.input("q-email", "Имейл", "email", { ac: "email", max: 200 }) +
      NC.input("q-unit", "Апартамент", "select", { value: u ? u.id : "", options: opts }) + NC.input("q-msg", "Съобщение", "ta", { wide: true, max: 1500 }), "Изпрати запитването", priv, NC.PH.inquiry) +
      NC.formHtml("nc-viewing", "Запази оглед", "calendar-check",
      NC.input("w-name", "Име и фамилия", "text", { req: true, ac: "name", max: 200 }) + NC.input("w-phone", "Телефон", "tel", { ac: "tel", max: 40, ph: "+359" }) + NC.input("w-email", "Имейл", "email", { ac: "email", max: 200 }) +
      NC.input("w-date", "Желана дата", "date", { req: true, min: today }) + NC.input("w-unit", "Апартамент", "select", { value: u ? u.id : "", options: opts, wide: true }), "Запази час за оглед", priv + " Консултант ще потвърди часа.", NC.PH.viewing);
  };
  function check(f, p) {
    var n = f.querySelector("#" + p + "-name"), ph = f.querySelector("#" + p + "-phone"), em = f.querySelector("#" + p + "-email");
    if (n.value.trim().length < 2) return { msg: "Въведете име и фамилия.", el: n };
    if (em.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.value.trim())) return { msg: "Имейлът не е валиден.", el: em };
    if (ph.value.trim() && ph.value.replace(/\D/g, "").length < 6) return { msg: "Телефонът е твърде кратък.", el: ph };
    if (!NC.validPhoneOrMail(ph.value, em.value)) return { msg: "Въведете телефон или имейл, за да се свържем с вас.", el: ph };
    if (p === "w") { var d = f.querySelector("#w-date"); if (!d.value) return { msg: "Изберете дата за огледа.", el: d }; if (d.value < U.today()) return { msg: "Датата не може да е в миналото.", el: d }; }
  }
  function send(f, p, kind) {
    var m = NC.model(), u = F.unit(f.querySelector("#" + p + "-unit").value), prop = (m.project.title || "Ново строителство") + (u ? " · " + u.code : "");
    var msg = kind === "viewing" ? "Дата за оглед: " + f.querySelector("#w-date").value.split("-").reverse().join(".") : (f.querySelector("#q-msg").value || "").trim();
    return rpc("nd_public_inquiry", { p: { kind: kind, name: f.querySelector("#" + p + "-name").value.trim().slice(0, 200), phone: f.querySelector("#" + p + "-phone").value.trim().slice(0, 40), email: f.querySelector("#" + p + "-email").value.trim().slice(0, 200),
      property: ("Ново строителство: " + prop).slice(0, 300), message: msg.slice(0, 1800), city: m.project.city || "", hood: m.project.hood || "", deal: "sale", type: "Апартамент" } })
      .then(function () { return kind === "viewing" ? "Заявката за оглед е изпратена. Наш консултант ще се свърже с вас за потвърждение." : "Запитването е изпратено. Наш консултант ще се свърже с вас."; },
        function (e) { throw new Error(/Твърде много/.test(e.message) ? "Твърде много запитвания в момента – опитайте след няколко минути." : /телефон или имейл/.test(e.message) ? "Въведете телефон или имейл." : e.message || "Неуспешно изпращане – опитайте отново."); });
  }
  A.afterPanel = function (tab) {
    if (tab !== "contacts") return;
    NC.bindForm(document.getElementById("nc-inquiry"), function (f) { return check(f, "q"); }, function (f) { return send(f, "q", "inquiry"); });
    NC.bindForm(document.getElementById("nc-viewing"), function (f) { return check(f, "w"); }, function (f) { return send(f, "w", "viewing"); });
  };
  function go() { NC.assetBase = "/mobile/crm/assets/"; NC.libBase = "/mobile/crm/"; NC.boot(A); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
