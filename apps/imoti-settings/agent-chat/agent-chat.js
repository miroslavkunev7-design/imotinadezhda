/* Settings Electron TED-style chat — skill property_cinematic_video lives HERE only.
   Never loaded by mobile/ash.js / imotinadezhda.bg. */
(function () {
  "use strict";
  var SKILL_VIDEO = "property_cinematic_video";
  var STORE_JOBS = "imoti-settings-video-jobs";
  var cfg = Object.assign({
    apiBase: (typeof window !== "undefined" && window.IMOTI_SETTINGS_API) || "https://imotinadezhda.bg",
    getToken: function () {
      if (window.IMOTI_SETTINGS_TOKEN) return Promise.resolve(window.IMOTI_SETTINGS_TOKEN);
      try {
        var s = JSON.parse(localStorage.getItem("nd-crm-auth") || "null");
        return Promise.resolve((s && s.access_token) || "");
      } catch (e) { return Promise.resolve(""); }
    }
  }, window.ImotiSettingsAgentConfig || {});

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  var list = document.getElementById("sac-list");
  var foot = document.getElementById("sac-foot");
  var menu = document.getElementById("sac-menu");
  var skillBtn = document.getElementById("sac-skill");
  var skillLabel = document.getElementById("sac-skill-label");
  var skill = null;
  var skills = [];

  function add(role, html, cls) {
    var m = document.createElement("div");
    m.className = "sac-m " + role + (cls ? " " + cls : "");
    m.innerHTML = html;
    list.appendChild(m);
    list.scrollTop = list.scrollHeight;
    return m;
  }

  function apiHeaders(json) {
    return cfg.getToken().then(function (tok) {
      var h = { "x-imoti-client": "settings" };
      if (json) h["Content-Type"] = "application/json";
      if (tok) h.Authorization = "Bearer " + tok;
      return h;
    });
  }

  function videoFetch(qs, opts) {
    opts = opts || {};
    return apiHeaders(!!opts.body).then(function (h) {
      return fetch(cfg.apiBase + "/api/video" + (qs ? "?" + qs : ""), Object.assign({}, opts, { headers: Object.assign(h, opts.headers || {}) }));
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); });
  }

  function readJobs() {
    try { return JSON.parse(localStorage.getItem(STORE_JOBS) || "[]") || []; } catch (e) { return []; }
  }
  function saveJob(id) {
    var a = readJobs().filter(function (x) { return x !== id; });
    a.unshift(id);
    try { localStorage.setItem(STORE_JOBS, JSON.stringify(a.slice(0, 20))); } catch (e) {}
  }

  function progressCard(el, view) {
    var pct = (view.progress && view.progress.pct) || (view.status === "ready" ? 100 : 5);
    var label = (view.progress && view.progress.label) || view.label || view.status;
    var msg = (view.progress && view.progress.message) || "";
    var html = '<div class="sac-progress" data-job="' + esc(view.job_id) + '">' +
      "<b>Видео задача</b> · " + esc(label) +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="sac-note">' + esc(msg || ("status: " + view.status)) + "</div>";
    if (view.status === "ready" && view.play_url) {
      html += '<video class="sac-player" controls playsinline src="' + esc(view.play_url) + '"></video>';
      html += '<a class="sac-dl" href="' + esc(view.download_url || view.play_url) + '" download="property-video.mp4" target="_blank" rel="noopener">Изтегли MP4</a>';
    }
    if (view.error) html += '<div class="sac-note">' + esc(view.error) + "</div>";
    html += "</div>";
    el.innerHTML = html;
  }

  function pollJob(el, jobId, n) {
    n = n || 0;
    videoFetch("action=status&job_id=" + encodeURIComponent(jobId)).then(function (r) {
      if (!r.body || !r.body.ok) {
        el.innerHTML = esc((r.body && r.body.error) || "Грешка при статус");
        return;
      }
      progressCard(el, r.body);
      if (r.body.status === "ready" || r.body.status === "failed" || r.body.status === "cancelled") return;
      if (n > 240) return;
      setTimeout(function () { pollJob(el, jobId, n + 1); }, 4000);
    });
  }

  function fileToB64(f) {
    return new Promise(function (ok, bad) {
      var r = new FileReader();
      r.onload = function () {
        var data = String(r.result).split(",")[1] || "";
        ok({ mime: f.type || "image/jpeg", data: data, name: f.name });
      };
      r.onerror = bad;
      r.readAsDataURL(f);
    });
  }

  /* ---- skills ---- */
  var chatSkill = {
    id: "chat",
    name: "Чат",
    sub: "Settings помощник (без видео биллинг)",
    intro: function () {
      add("a", "Това е <b>Тед в Settings</b> (Electron). Официалният сайт TED не е променен.\nИзберете skill <b>Видео за имот</b> за кинематографично видео — само тук.");
    },
    footer: function () {
      return '<div class="sac-c"><textarea rows="1" placeholder="Съобщение…"></textarea><button type="button" class="snd">➤</button></div>';
    },
    bind: function (el) {
      var ta = el.querySelector("textarea");
      el.querySelector(".snd").onclick = function () {
        var t = ta.value.trim(); if (!t) return;
        ta.value = "";
        add("u", esc(t));
        add("a", "За CRM действия ползвайте сайта. Тук skill „Видео за имот“ създава MP4 от снимки.");
      };
    }
  };

  var videoSkill = {
    id: SKILL_VIDEO,
    name: "Видео за имот",
    sub: "4–10 снимки → едно MP4 (REAL_PROPERTY). Изборът не таксува.",
    intro: function () {
      add("a", "<b>Видео за имот</b> (skill <code>" + SKILL_VIDEO + "</code>)\n" +
        "Прикачете <b>4–10 снимки</b> на реален имот. Ще видите една progress карта в този чат и готово MP4 за гледане/изтегляне.\n" +
        "По подразбиране: <b>REAL_PROPERTY</b>. PROJECT_VISUALIZATION — само ако изрично го поискате.\n" +
        "<span class=\"sac-note\">Само Settings app · отделни n8n TED Settings Video workflows · сайтът imotinadezhda.bg не показва този skill.</span>");
      // Reload restore
      var ids = readJobs();
      if (!ids.length) return;
      videoFetch("action=list&limit=5").then(function (r) {
        (r.body && r.body.jobs || []).forEach(function (j) {
          if (j.status === "ready" || j.status === "queued" || j.status === "planning" || j.status === "prep" || j.status === "clipping" || j.status === "assembling" || j.status === "qa") {
            var el = add("a", "");
            progressCard(el, j);
            if (j.status !== "ready" && j.status !== "failed") pollJob(el, j.job_id);
          }
        });
      }).catch(function () {});
    },
    footer: function () {
      return '<div class="sac-files" id="sac-files"></div><div class="sac-c">' +
        '<button type="button" class="att" title="Снимки">📎</button>' +
        '<textarea rows="1" placeholder="По желание: бележка (изборът на skill не таксува)…"></textarea>' +
        '<button type="button" class="snd">Старт</button></div>';
    },
    bind: function (el) {
      var files = [], fl = el.querySelector("#sac-files"), ta = el.querySelector("textarea"), busy = false;
      function show() { fl.innerHTML = files.map(function (f) { return "<span>" + esc(f.name) + "</span>"; }).join(""); }
      el.querySelector(".att").onclick = function () {
        var i = document.createElement("input");
        i.type = "file"; i.multiple = true; i.accept = "image/*,.heic,.heif";
        i.onchange = function () {
          files = files.concat([].slice.call(i.files || [])).slice(0, 10);
          show();
        };
        i.click();
      };
      el.querySelector(".snd").onclick = function () {
        if (busy) return;
        if (files.length < 4) { add("a", "Нужни са поне 4 снимки (сега: " + files.length + "). Изборът на skill без изпращане не таксува."); return; }
        if (files.length > 10) { add("a", "Максимум 10 снимки."); return; }
        busy = true;
        var note = ta.value.trim();
        ta.value = "";
        add("u", "📷 " + files.length + " снимки" + (note ? "\n" + esc(note) : ""));
        var card = add("a", "Качвам и създавам задача…", "wait");
        var batch = files.slice(); files = []; show();
        Promise.all(batch.map(fileToB64)).then(function (photos) {
          var idem = (crypto.randomUUID && crypto.randomUUID()) || (Date.now() + "-" + Math.random());
          return videoFetch("action=create", {
            method: "POST",
            body: JSON.stringify({
              photos: photos,
              idempotency_key: idem,
              mode: /project|визуализ/i.test(note) ? "PROJECT_VISUALIZATION" : "REAL_PROPERTY",
              explicit_project_viz: /project|визуализ/i.test(note),
              session_id: "settings-agent-chat"
            })
          });
        }).then(function (r) {
          busy = false;
          card.classList.remove("wait");
          if (!r.body || !r.body.ok) {
            card.textContent = (r.body && r.body.error) || ("HTTP " + r.status);
            return;
          }
          saveJob(r.body.job_id);
          progressCard(card, r.body);
          if (r.body.status !== "ready") pollJob(card, r.body.job_id);
        }).catch(function (e) {
          busy = false;
          card.classList.remove("wait");
          card.textContent = String(e && e.message || e);
        });
      };
    }
  };

  skills = [chatSkill, videoSkill];

  function setSkill(s) {
    skill = s;
    skillLabel.textContent = s.name;
    list.innerHTML = "";
    foot.innerHTML = s.footer ? s.footer() : "";
    s.intro();
    if (s.bind) s.bind(foot);
  }

  function renderMenu() {
    menu.innerHTML = skills.map(function (s, i) {
      return '<button type="button" role="option" data-i="' + i + '" class="' + (s === skill ? "on" : "") + '">' +
        esc(s.name) + "<small>" + esc(s.sub || "") + "</small></button>";
    }).join("");
  }

  skillBtn.onclick = function (e) {
    e.stopPropagation();
    renderMenu();
    menu.hidden = !menu.hidden;
    skillBtn.setAttribute("aria-expanded", String(!menu.hidden));
  };
  menu.onclick = function (e) {
    var b = e.target.closest("[data-i]");
    if (!b) return;
    menu.hidden = true;
    setSkill(skills[+b.getAttribute("data-i")]);
  };
  document.addEventListener("click", function () { menu.hidden = true; });

  // Selecting video skill does not bill — only create/job after photos.
  setSkill(chatSkill);

  window.ImotiSettingsAgentChat = {
    openSkill: function (id) {
      var s = skills.filter(function (x) { return x.id === id; })[0];
      if (s) setSkill(s);
    },
    skillId: SKILL_VIDEO
  };
})();
