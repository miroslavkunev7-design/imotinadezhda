/* ИМОТИ НАДЕЖДА · TASK-010 · CRM – интериор, 3D разходка и 360° панорами (служебна част). Класически скрипт → window.NCTourStaff.
   Всичко минава през /api/tools (Bearer токенът на служителя; правата се пазят от сървъра и базата):
     геометрия (interior.geometry_save / _verify) → стил (interior.style_save) → сцена (interior.prepare / validate / approve)
     → панорами: рендер от СЪЩАТА сцена в този браузър или качване на ИСТИНСКИ равноправоъгълни панорами (tour.render + tour.report)
     → подредба, посока и преходи (tour.edit) → проверка (tour.validate) → публикуване / връщане / сваляне (tour.publish / tour.unpublish).
   Напредък и отмяна – jobs.status / jobs.cancel. Файловете отиват само в частната папка projects/<проект>/private/tours/…;
   публиката вижда производните (без EXIF) само докато апартаментът е Свободен. Токен и пътища никога не влизат в адреса. */
(function () {
  "use strict";
  var LIB = null;
  function lib() { if (!LIB) LIB = import((window.NC_TOUR_LIB || "/mobile/nc-tour.js")); return LIB; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function key() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }
  var STYLES = [["modern_classic", "Модерна класика"], ["minimalist", "Минимализъм"], ["scandinavian", "Скандинавски"], ["japandi", "Джапанди"], ["mediterranean", "Средиземноморски"], ["custom", "Собствена палитра"]];
  var GST = { draft: "чернова", verified: "проверена", superseded: "заменена", stale: "остаряла" };
  var SST = { draft: "чернова (има проблеми)", review: "за преглед", approved: "одобрена", rejected: "отхвърлена", published: "публикувана", superseded: "заменена", stale: "остаряла" };
  var PST = { rendering: "в работа", review: "за преглед", published: "публикуван", superseded: "в историята", cancelled: "отменен", failed: "неуспешен", stale: "остарял" };
  var SRC = { scene_render: "рендер от 3D сцената", photo: "реални снимки 360°", designer_render: "визуализации 360° от дизайнер" };

  /* ---------- сървър ---------- */
  function tool(name, input, o) {
    if (o && o.tool) return o.tool(name, input);
    return window.ND.token().then(function (t) {
      if (!t) throw new Error("Влезте отново в CRM.");
      return fetch("/api/tools", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify({ tool: name, input: input || {} }) });
    }).then(function (r) { return r.json().catch(function () { return { ok: false, error: "Сървърът върна " + r.status }; }).then(function (j) { if (r.ok && j.ok) return j.result; var e = new Error((j && j.error) || "Грешка " + r.status); e.status = r.status; e.issues = j && j.issues; throw e; }); });
  }
  function upload(path, blob, o) {
    if (o && o.upload) return o.upload(path, blob);
    return window.ND.sb().storage.from("nd-files").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false, cacheControl: "no-store" }).then(function (r) { if (r && r.error) throw new Error(r.error.message || "Качването не успя"); return true; });
  }

  /* ---------- източник за прегледа (екип: и чернови, и капарирани/продадени) ---------- */
  function pickSet(st, setId) {
    var sets = st.sets || [];
    if (setId) return sets.filter(function (x) { return x.id === setId; })[0] || null;
    var pub = st.published && sets.filter(function (x) { return x.id === st.published.pano_set_id; })[0];
    return pub || sets.filter(function (x) { return x.status === "review" || x.status === "rendering"; })[0] || null;
  }
  function source(unitId, o) {
    o = o || {}; var cur = { set: null };
    return {
      load: function () {
        return tool("tour.get", { unit_id: unitId, view: "full" }, o).then(function (st) {
          var set = pickSet(st, o.setId); cur.set = set;
          var g = (st.geometry || []).filter(function (x) { return x.status === "verified"; })[0];
          var scRow = st.published && st.published.scene_version_id ? { id: st.published.scene_version_id } : (st.scenes || []).filter(function (s) { return g && s.geometry_id === g.id && ["approved", "review", "published"].indexOf(s.status) >= 0; })[0];
          var rooms = set ? set.rooms.filter(function (r) { return set.items[r] && set.items[r].status === "ready"; }).map(function (r, i) { var it = set.items[r]; return { n: i, room_id: r, name: it.name, type: it.type, thumb: it.thumb, yaw_offset: it.yaw_offset || 0, start_yaw: it.start_yaw, hotspots: it.hotspots || [], node: it.node }; }) : [];
          var sceneP = scRow ? tool("interior.get_scene", { scene_version_id: scRow.id }, o).then(function (s) { return s.scene; }).catch(function () { return null; }) : Promise.resolve(null);
          return sceneP.then(function (scene) {
            var u = st.unit || {};
            return { unit: { id: u.id, code: u.code, status: u.status, area_total: u.area_total, area_net: u.area_net, terrace_area: u.terrace_area, exposure: u.exposure, rooms: u.rooms }, staff: true,
              rooms: rooms, scene: scene, minimap: g && g.geometry ? { north_deg: g.geometry.north_deg, rooms: g.geometry.rooms.map(function (r) { return { id: r.id, name: r.name, type: r.type, polygon: r.polygon }; }) } : null,
              label: set ? (set.source === "photo" ? "Реална снимка 360°." : set.source === "designer_render" ? "Визуализация 360° от дизайнер – примерно обзавеждане." : "Рендер 360° от 3D сцената – примерно обзавеждане.") + (set.status !== "published" ? " Чернова (" + (PST[set.status] || set.status) + ") – вижда се само от екипа." : "") : "" };
          });
        });
      },
      panoUrl: function (room) { return tool("tour.get_authorized_asset", { panorama_set_id: cur.set.id, room_id: room.room_id }, o).then(function (r) { return r.url; }); }
    };
  }

  /* ---------- панел за екипа ---------- */
  function panel(el, unitId, o) {
    o = o || {};
    var S = { st: null, busy: false, admin: o.admin, job: null, abort: null, msg: null };
    el.classList.add("ntr", "ntrs");
    /* шрифтът следва мащаба на платното (CSS zoom на страницата на TASK-008), както прегледа */
    function pfit() { var r = el.getBoundingClientRect(), z = el.offsetWidth && r.width ? r.width / el.offsetWidth : 1, vw = window.innerWidth, f = (vw < 600 ? 13 : Math.max(13, Math.min(18, vw / 92))) / (z || 1); el.style.setProperty("--ntr-fs", Math.max(8, Math.min(90, f)).toFixed(2) + "px"); }
    window.addEventListener("resize", pfit);
    function say(m, bad) { S.msg = m ? { t: m, bad: !!bad } : null; var x = el.querySelector(".ntrs-msg"); if (x) { x.textContent = m || ""; x.className = "ntrs-msg" + (bad ? " bad" : ""); x.hidden = !m; } if (o.say && m) o.say(m); }
    function err(e) { say(e && e.message ? e.message.replace(/ \[[A-Z_]+ · [^\]]+\]$/, "") : String(e), true); S.busy = false; render(); }
    function reload() { return tool("tour.get", { unit_id: unitId, view: "full" }, o).then(function (st) { S.st = st; render(); return st; }).catch(err); }
    function adminP() { if (S.admin != null) return Promise.resolve(S.admin); try { return window.ND.sb().rpc("nd_is_admin").then(function (r) { S.admin = !!(r && r.data === true); return S.admin; }); } catch (e) { S.admin = false; return Promise.resolve(false); } }
    function vg() { return S.st && (S.st.geometry || []).filter(function (g) { return g.status === "verified"; })[0]; }
    function dg() { return S.st && (S.st.geometry || []).filter(function (g) { return g.status === "draft"; })[0]; }
    function scenes() { var g = vg(); return g ? (S.st.scenes || []).filter(function (s) { return s.geometry_id === g.id && ["stale", "superseded", "rejected"].indexOf(s.status) < 0; }) : []; }
    function sets() { var g = vg(); return g ? (S.st.sets || []).filter(function (x) { return x.geometry_id === g.id; }) : []; }
    function btn(act, text, o2) { o2 = o2 || {}; var dis = o2.admin && !S.admin ? ' disabled title="Само администратор"' : o2.dis ? ' disabled title="' + esc(o2.dis) + '"' : ""; return '<button type="button" class="ntr-btn ntrs-b' + (o2.cls ? " " + o2.cls : "") + '" data-a="' + act + '"' + (o2.data || "") + dis + ">" + esc(text) + "</button>"; }
    function chip(t, k) { return '<span class="ntrs-chip ' + (k || "") + '">' + esc(t) + "</span>"; }
    function list(a, k) { return a && a.length ? '<ul class="ntrs-l ' + (k || "") + '">' + a.slice(0, 12).map(function (x) { return "<li>" + esc(typeof x === "string" ? x : x.message || x.code) + "</li>"; }).join("") + (a.length > 12 ? "<li>… още " + (a.length - 12) + "</li>" : "") + "</ul>" : ""; }
    function sec(title, img, body) { return '<section class="ntrs-sec">' + (img ? '<div class="ntrs-img" style="background-image:url(&quot;' + esc((window.NC && NC.img ? NC.img(img) : "/mobile/crm/assets/" + img)) + '&quot;)" aria-hidden="true"><span>Илюстрация</span></div>' : "") + "<h4>" + esc(title) + "</h4>" + body + "</section>"; }

    function render() {
      var st = S.st; if (!st) { el.innerHTML = '<div class="ntrs-wait"><span class="ntr-spin"></span> Зареждане…</div>'; pfit(); return; }
      var g = vg(), d = dg(), sc = scenes(), ss = sets(), pub = st.published, h = "";
      h += '<div class="ntrs-head"><h3>Интериор и 360° разходка – за екипа</h3><span>' + chip("Апартамент " + (st.unit && st.unit.code || "")) + chip(st.unit && ({ free: "Свободен", reserved: "Капариран", sold: "Продаден" })[st.unit.status] || "", st.unit && st.unit.status) + (pub ? chip("Публикувана версия " + pub.version, "ok") : chip("Няма публикувана разходка")) + "</span></div>";
      h += '<p class="ntrs-msg' + (S.msg && S.msg.bad ? " bad" : "") + '"' + (S.msg ? "" : " hidden") + ">" + esc(S.msg ? S.msg.t : "") + "</p>";
      if (!S.admin) h += '<p class="ntrs-note">Подготовката, рендерът и публикуването са само за администратор. Стилът може да се записва от всеки служител.</p>';
      /* 1. геометрия */
      var gb = "";
      if (g) gb += "<p>" + chip("Проверена версия " + g.version, "ok") + " " + esc((g.validation && g.validation.stats ? g.validation.stats.rooms + " помещения, " + g.validation.stats.area_m2 + " м²" : "")) + " · източник: " + esc(g.source + (g.source_ref ? " – " + g.source_ref : "")) + "</p>";
      else gb += '<p class="ntrs-warn">Няма проверена геометрия – точен интериор и разходка не се правят. Въведете стаите, стените, отворите и височините от плана с размери (или от IFC/DXF).</p>';
      if (d) gb += "<p>" + chip("Чернова версия " + d.version) + " " + (d.validation && d.validation.blocked && d.validation.blocked.length ? "" : btn("gverify", "Потвърди геометрията", { admin: true, data: ' data-id="' + esc(d.id) + '" data-sha="' + esc(d.sha256) + '"' })) + "</p>" + list(d.validation && d.validation.blocked, "bad");
      gb += '<details class="ntrs-det"><summary>Въведи / смени геометрията (JSON nd.unit_geometry.v1)</summary><label class="ntrs-f">Източник <select id="ntrs-gsrc"><option value="plan_manual">план с размери (ръчно)</option><option value="ifc">IFC</option><option value="dxf">DXF</option><option value="task009">TASK-009</option></select></label>' +
        '<label class="ntrs-f">Препратка към източника <input id="ntrs-gref" maxlength="300" placeholder="напр. план от архитекта, ревизия"></label><textarea id="ntrs-gjson" rows="6" spellcheck="false" placeholder="{ &quot;schema&quot;: &quot;nd.unit_geometry.v1&quot;, … }">' + esc(g && g.geometry ? JSON.stringify(g.geometry) : d && d.geometry ? JSON.stringify(d.geometry) : "") + "</textarea>" + btn("gsave", "Провери и запиши черновата", { admin: true }) + "</details>";
      h += sec("1. Геометрия на апартамента", null, gb);
      /* 2. стил */
      var cs = (st.styles || [])[0], cb = cs && cs.brief || {};
      h += sec("2. Стил на интериора", "nd/ph40.webp", "<p>" + (cs ? "Текущ: " + chip((STYLES.filter(function (x) { return x[0] === cb.style_system; })[0] || ["", cb.style_system])[1] + " (" + ({ unit: "за апартамента", building: "за сградата", project: "за проекта" })[cs.scope] + ", v" + cs.version + ")", "ok") : "Няма зададен стил – по подразбиране „Минимализъм“.") + "</p>" +
        '<div class="ntrs-row"><label class="ntrs-f">Стил <select id="ntrs-style">' + STYLES.map(function (x) { return '<option value="' + x[0] + '"' + (cb.style_system === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + '</select></label><label class="ntrs-f">Светлина <select id="ntrs-light"><option value="warm">топла</option><option value="neutral">неутрална</option><option value="cool">студена</option></select></label>' +
        '<label class="ntrs-f">За <select id="ntrs-scope"><option value="unit">този апартамент</option><option value="building">цялата сграда</option></select></label></div>' + btn("style", "Запиши стила") + '<p class="ntrs-note">Стилът сменя само материали, мебели и светлина – никога стени, отвори, височини или площи. Мебелите са „примерно обзавеждане“.</p>');
      /* 3. сцена */
      var s0 = sc[0], sb = "";
      if (!g) sb += '<p class="ntrs-note">Чака проверена геометрия.</p>';
      else {
        sb += s0 ? "<p>" + chip("Сцена v" + s0.version + " – " + (SST[s0.status] || s0.status), s0.status === "approved" || s0.status === "published" ? "ok" : s0.status === "draft" ? "bad" : "") + " " + esc(s0.style_name || "") + (s0.stats ? " · " + s0.stats.furniture + " мебели · " + s0.stats.triangles + " триъгълника" : "") + "</p>" + list(s0.issues, "bad") : "<p>Сцената още не е подготвена.</p>";
        sb += '<div class="ntrs-acts">' + btn("prepare", s0 ? "Подготви наново" : "Подготви 3D сцена", { admin: true }) + (s0 ? btn("svalidate", "Провери", { admin: true, data: ' data-id="' + esc(s0.id) + '"' }) : "") +
          (s0 && s0.status === "review" ? btn("approve", "Одобри", { admin: true, cls: "gold", data: ' data-id="' + esc(s0.id) + '"' }) + btn("reject", "Отхвърли", { admin: true, data: ' data-id="' + esc(s0.id) + '"' }) : "") + (s0 && o.onPreview ? btn("pwalk", "Виж 3D разходката") : "") + "</div>";
      }
      h += sec("3. 3D сцена (архитектура + примерно обзавеждане)", !s0 ? "nd/ph28.webp" : null, sb);
      /* 4. панорами */
      var cur = ss.filter(function (x) { return x.status === "rendering" || x.status === "review"; })[0], pb = "";
      if (!g) pb += '<p class="ntrs-note">Чака проверена геометрия – панорамите се връзват със стаите и вратите от нея.</p>';
      else {
        pb += '<div class="ntrs-acts">' + btn("rprev", "Рендер от 3D сцената – предварителен (2048)", { admin: true, dis: !s0 || ["review", "approved", "published"].indexOf(s0.status) < 0 ? "Нужна е сцена за преглед или одобрена" : null }) +
          btn("rfinal", "Рендер – окончателен (4096)", { admin: true, dis: !s0 || ["approved", "published"].indexOf(s0.status) < 0 ? "Нужна е одобрена сцена" : null }) + btn("photo", "Качи реални панорами 360°", { admin: true }) + "</div>";
        if (S.job) pb += '<div class="ntrs-prog"><div class="ntrs-bar"><i style="width:' + Math.round(100 * S.job.done / Math.max(1, S.job.total)) + '%"></i></div><span>' + esc(S.job.text) + "</span>" + btn("cancel", "Отмени", { cls: "sm" }) + "</div>";
        if (cur) pb += setEditor(cur);
        else if (!ss.length) pb += '<p class="ntrs-note">Още няма качени панорами.</p>';
      }
      h += sec("4. 360° панорами по стаи", !cur && !ss.length ? "nd/ph36.webp" : null, pb);
      /* 5. публикуване и история */
      var hist = (st.tours || []).map(function (t) { var setOk = ss.some(function (x) { return x.id === t.pano_set_id; }); return "<li>" + chip("v" + t.version + " – " + ({ published: "публикувана", superseded: "в историята", unpublished: "свалена", stale: "остаряла" })[t.status], t.status === "published" ? "ok" : t.status === "stale" ? "bad" : "") + " " + esc(new Date(t.created_at).toLocaleString("bg-BG")) + " · " + esc(t.created_email || "") +
        (t.status !== "published" && t.pano_set_id && setOk ? " " + btn("rollback", "Върни тази версия", { admin: true, cls: "sm", data: ' data-set="' + esc(t.pano_set_id) + '" data-scene="' + esc(t.scene_version_id || "") + '"' }) : "") + "</li>"; }).join("");
      h += sec("5. Публикуване и история", null, (pub ? btn("unpublish", "Свали от сайта", { admin: true }) : "") + (hist ? '<ul class="ntrs-l">' + hist + "</ul>" : '<p class="ntrs-note">Няма публикувани версии.</p>') + '<p class="ntrs-note">Публиката вижда разходката само докато апартаментът е Свободен и проектът е публикуван. При капариран/продаден – само червен печат.</p>');
      el.innerHTML = '<div class="ntrs-box">' + h + "</div>"; pfit();
    }
    function setEditor(x) {
      var rows = x.rooms.map(function (r, i) { var it = x.items[r] || {}; var hs = (it.hotspots || []).length;
        return '<li class="ntrs-room" data-room="' + esc(r) + '"><span class="ntrs-th">' + (it.thumb ? '<img src="' + esc(it.thumb) + '" alt="">' : "") + "</span><b>" + esc(it.name || r) + "</b>" +
          chip(it.status === "ready" ? "готов " + it.w + "×" + it.h : it.status === "rejected" ? "отказан" : "чака файл", it.status === "ready" ? "ok" : it.status === "rejected" ? "bad" : "") + (it.message ? '<em class="ntrs-bad">' + esc(it.message) + "</em>" : "") +
          (x.source !== "scene_render" && x.status === "rendering" ? '<label class="ntrs-file">' + (it.status === "ready" ? "Смени" : "Избери файл") + '<input type="file" accept="image/jpeg,image/png" data-up="' + esc(r) + '" data-rev="' + ((it.rev || 0) + 1) + '"></label>' : "") +
          '<label class="ntrs-yaw" title="Накъде гледа средата на снимката спрямо плана (север на плана = 0°)">Посока <input type="range" min="0" max="359" step="1" value="' + Math.round(it.yaw_offset || 0) + '" data-yaw="' + esc(r) + '"' + (x.source === "scene_render" ? " disabled" : "") + "><output>" + Math.round(it.yaw_offset || 0) + "°</output></label>" +
          "<span>" + hs + " прехода</span>" + '<span class="ntrs-ord"><button type="button" data-a="up" data-i="' + i + '" aria-label="Нагоре">▲</button><button type="button" data-a="down" data-i="' + i + '" aria-label="Надолу">▼</button></span></li>'; }).join("");
      return '<div class="ntrs-set" data-set="' + esc(x.id) + '" data-ev="' + x.edit_version + '"><p>' + chip("Набор v" + x.version + " – " + (PST[x.status] || x.status), x.status === "review" ? "ok" : "") + " " + esc(SRC[x.source] + " · " + (x.quality === "final" ? "окончателен" : "предварителен")) +
        " · готови " + x.rooms.filter(function (r) { return x.items[r] && x.items[r].status === "ready"; }).length + " от " + x.rooms.length + "</p>" + list(x.issues, "bad") + '<ol class="ntrs-rooms">' + rows + "</ol>" +
        '<div class="ntrs-acts">' + btn("save", "Запази подредбата и посоките", { admin: true }) + btn("tvalidate", "Провери набора", { admin: true }) + (x.status === "review" ? btn("publish", "Публикувай", { admin: true, cls: "gold" }) : "") + (o.onPreview && x.rooms.some(function (r) { return x.items[r] && x.items[r].status === "ready"; }) ? btn("ppano", "Виж панорамите") : "") +
        (x.job_id && x.status === "rendering" ? btn("jcancel", "Отмени набора", { admin: true, data: ' data-job="' + esc(x.job_id) + '"' }) : "") + "</div></div>";
    }
    /* рендер от сцената в този браузър + отчитане на всяка стая */
    function renderFromScene(quality) {
      var s0 = scenes()[0]; if (!s0) return;
      S.busy = true; say("Подготовка на рендера…");
      var ctl = { aborted: false }; S.abort = ctl;
      tool("tour.render", { unit_id: unitId, source: "scene_render", quality: quality, scene_version_id: s0.id, idempotency_key: "crm-" + key(), want_uploads: true }, o).then(function (r) {
        if (!r.ok) throw new Error((r.blocked || []).join(" ") || "Рендерът не стартира");
        S.job = { id: r.job_id, set: r.panorama_set_id, done: 0, total: r.rooms.length, text: "Рендер 0 от " + r.rooms.length }; render();
        return Promise.all([lib(), tool("interior.get_scene", { scene_version_id: s0.id }, o)]).then(function (x) {
          var L = x[0], scene = x[1].scene;
          return L.renderPanoramas(scene, { width: r.out_width, rooms: r.rooms.map(function (q) { return q.room_id; }), signal: ctl, onRoom: function (item, n, total) {
            if (ctl.aborted) return;
            var path = r.uploads.prefix + "/" + item.room_id + "-r1.jpg";
            S.job.text = "Качване " + n + " от " + total; render();
            return upload(path, item.blob, o).then(function () { return tool("tour.report", { job_id: r.job_id, panorama_set_id: r.panorama_set_id, room_id: item.room_id, rev: 1, upload_path: path }, o); }).then(function (rep) {
              if (rep.state === "cancelled") { ctl.aborted = true; throw new Error("Задачата е отменена"); }
              S.job.done = n; S.job.text = "Готови " + n + " от " + total + (rep.state === "needs_review" ? " – наборът чака преглед" : ""); render();
            });
          } });
        });
      }).then(function () { S.busy = false; S.job = null; say(ctl.aborted ? "Рендерът е отменен." : "Панорамите са рендерирани от сцената и проверени – прегледайте ги и публикувайте."); return reload(); }).catch(function (e) { S.job = null; err(e); reload(); });
    }
    function bind() {
      el.onclick = function (e) {
        var b = e.target.closest("[data-a]"); if (!b || b.disabled) return; var a = b.getAttribute("data-a");
        var run = function (p, ok) { S.busy = true; say("Изпълнява се…"); p.then(function (r) { S.busy = false; say(typeof ok === "function" ? ok(r) : ok); return reload(); }).catch(err); };
        if (a === "gsave") { var txt = el.querySelector("#ntrs-gjson").value, gj; try { gj = JSON.parse(txt); } catch (x) { say("Геометрията не е валиден JSON.", true); return; }
          run(tool("interior.geometry_save", { unit_id: unitId, geometry: gj, source: el.querySelector("#ntrs-gsrc").value, source_ref: el.querySelector("#ntrs-gref").value || undefined }, o), function (r) { return r.ok ? (r.blocked && r.blocked.length ? "Записана чернова с липси: " + r.blocked.length + " – точна сцена не се прави, докато не се попълнят." : "Черновата е записана – прегледайте и потвърдете.") : "Грешки: " + r.errors.slice(0, 3).join("; "); }); }
        else if (a === "gverify") { if (!confirm("Потвърждавате ли, че геометрията отговаря на плана? След това е неизменяема.")) return; run(tool("interior.geometry_verify", { geometry_id: b.dataset.id, expected_sha256: b.dataset.sha, confirm: true }, o), "Геометрията е потвърдена."); }
        else if (a === "style") { var sc = el.querySelector("#ntrs-scope").value, inp = { project_id: S.st.unit.project_id, brief: { style_system: el.querySelector("#ntrs-style").value, lighting: el.querySelector("#ntrs-light").value } }; if (sc === "unit") inp.unit_id = unitId; else inp.building_id = S.st.unit.building_id; run(tool("interior.style_save", inp, o), function (r) { return r.ok ? "Стилът е записан (v" + r.version + ")." : r.errors.join("; "); }); }
        else if (a === "prepare") run(tool("interior.prepare", { unit_id: unitId, idempotency_key: "crm-" + key() }, o), function (r) { return r.ok ? "Сцената е подготвена: " + (r.state === "needs_review" ? "чака преглед." : "има проблеми за поправка.") : (r.blocked || r.errors || []).join(" "); });
        else if (a === "svalidate") run(tool("interior.validate", { scene_version_id: b.dataset.id }, o), function (r) { return r.ok ? "Сцената е проверена – чака преглед." : "Проблеми: " + r.issues.length; });
        else if (a === "approve" || a === "reject") { if (!confirm(a === "approve" ? "Одобрявате ли сцената?" : "Отхвърляте ли сцената?")) return; run(tool("interior.approve", { scene_version_id: b.dataset.id, decision: a, confirm: true }, o), a === "approve" ? "Сцената е одобрена." : "Сцената е отхвърлена."); }
        else if (a === "rprev" || a === "rfinal") renderFromScene(a === "rfinal" ? "final" : "preview");
        else if (a === "photo") { var q = confirm("Окончателно качество (4096×2048)? „Отказ“ = предварително (2048×1024).") ? "final" : "preview", sr = confirm("Реални снимки 360° от апартамента? „Отказ“ = визуализации от дизайнер.") ? "photo" : "designer_render";
          run(tool("tour.render", { unit_id: unitId, source: sr, quality: q, idempotency_key: "crm-" + key(), want_uploads: true }, o).then(function (r) { S.prefix = r.uploads && r.uploads.prefix; return r; }), "Изберете файл за всяко помещение (равноправоъгълна панорама 2:1)."); }
        else if (a === "up" || a === "down") { var box = b.closest(".ntrs-set"), li = [].slice.call(box.querySelectorAll(".ntrs-room")), i = +b.dataset.i, j = a === "up" ? i - 1 : i + 1; if (j < 0 || j >= li.length) return; var ol = box.querySelector(".ntrs-rooms"); if (a === "up") ol.insertBefore(li[i], li[j]); else ol.insertBefore(li[j], li[i]); [].slice.call(ol.children).forEach(function (n, k) { n.querySelectorAll("[data-i]").forEach(function (x) { x.dataset.i = k; }); }); say("Подредбата е сменена – запазете."); }
        else if (a === "save") { var bx = el.querySelector(".ntrs-set"), order = [].slice.call(bx.querySelectorAll(".ntrs-room")).map(function (n) { return n.dataset.room; }), items = [];
          var setRow = (S.st.sets || []).filter(function (x) { return x.id === bx.dataset.set; })[0];
          bx.querySelectorAll("input[data-yaw]").forEach(function (inp) { var r = inp.dataset.yaw, it = setRow.items[r] || {}, ny = +inp.value, d = ny - (it.yaw_offset || 0); if (d) items.push({ room_id: r, yaw_offset: ny }); });
          run(tool("tour.edit", { panorama_set_id: bx.dataset.set, expected_version: +bx.dataset.ev, order: order, items: items.length ? items : undefined }, o), "Запазено – проверете набора."); }
        else if (a === "tvalidate") run(tool("tour.validate", { panorama_set_id: el.querySelector(".ntrs-set").dataset.set }, o), function (r) { return r.ok ? "Наборът е проверен – готов за публикуване." : "Проблеми: " + r.issues.map(function (x) { return x.message; }).slice(0, 3).join("; "); });
        else if (a === "publish" || a === "rollback") {
          var setId = a === "publish" ? el.querySelector(".ntrs-set").dataset.set : b.dataset.set, s0 = scenes()[0], pv = S.st.published ? S.st.published.version : 0;
          var scId = a === "rollback" ? b.dataset.scene || undefined : s0 && ["approved", "published"].indexOf(s0.status) >= 0 ? s0.id : undefined;
          if (!confirm(a === "publish" ? "Публикуване на разходката? Публиката ще я вижда, докато апартаментът е Свободен." : "Връщане на тази версия на сайта?")) return;
          run(tool("tour.publish", { unit_id: unitId, panorama_set_id: setId, scene_version_id: scId, expected_version: pv, confirm: true }, o), function (r) { return "Публикувана версия " + r.version + "."; });
        }
        else if (a === "unpublish") { var why = prompt("Причина за сваляне от сайта:"); if (!why || why.length < 3) return; run(tool("tour.unpublish", { unit_id: unitId, expected_version: S.st.published.version, reason: why, confirm: true }, o), "Разходката е свалена от сайта (остава в историята)."); }
        else if (a === "jcancel") run(tool("jobs.cancel", { id: b.dataset.job }, o), "Отменено.");
        else if (a === "cancel") { if (S.abort) S.abort.aborted = true; if (S.job) tool("jobs.cancel", { id: S.job.id }, o).catch(function () {}); say("Отменя се…"); }
        else if (a === "pwalk" && o.onPreview) o.onPreview({ mode: "walk" });
        else if (a === "ppano" && o.onPreview) o.onPreview({ mode: "pano", setId: el.querySelector(".ntrs-set").dataset.set });
      };
      el.oninput = function (e) { var r = e.target.closest("input[data-yaw]"); if (r) r.nextElementSibling.textContent = r.value + "°"; };
      el.onchange = function (e) {
        var inp = e.target.closest("input[data-up]"); if (!inp || !inp.files || !inp.files[0]) return;
        var f = inp.files[0], room = inp.dataset.up, rev = +inp.dataset.rev, box = inp.closest(".ntrs-set"), setId = box.dataset.set, setRow = (S.st.sets || []).filter(function (x) { return x.id === setId; })[0];
        var ext = /png$/i.test(f.type) ? "png" : "jpg", prefix = "projects/" + S.st.unit.project_id + "/private/tours/" + unitId + "/" + setId + "/src", path = prefix + "/" + room + "-r" + rev + "." + ext;
        if (f.size > 25 * 1048576) { say("Файлът е над 25 MB.", true); return; }
        say("Качване на " + f.name + "…");
        upload(path, f, o).then(function () { return tool("tour.report", { job_id: setRow.job_id, panorama_set_id: setId, room_id: room, rev: rev, upload_path: path }, o); })
          .then(function (r) { say(r.ok ? "Файлът за " + room + " е проверен" + (r.state === "needs_review" ? " – наборът е готов за преглед." : ".") : (r.message || r.error_code), !r.ok); return reload(); }).catch(err);
      };
    }
    bind(); render();
    adminP().then(function () { return reload(); });
    return { reload: reload, destroy: function () { if (S.abort) S.abort.aborted = true; window.removeEventListener("resize", pfit); el.style.removeProperty("--ntr-fs"); el.onclick = el.onchange = el.oninput = null; el.innerHTML = ""; el.classList.remove("ntrs"); } };
  }

  window.NCTourStaff = { source: source, panel: panel, lib: lib, version: "crm-nc-tour@1" };
})();
