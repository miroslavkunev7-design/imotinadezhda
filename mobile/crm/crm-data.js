/* Imoti Nadezhda CRM — shared data layer.
   Real data lives in Supabase (project hyvwfsmjbaynozceookv). Every CRM page loads this file,
   waits for ND.ready() (sign-in), loads its records with ND.load(kind) and writes changes with
   ND.sync(kind, array) / ND.put / ND.del. Row Level Security allows CRM staff only. */
(function () {
  "use strict";
  var URL = "https://hyvwfsmjbaynozceookv.supabase.co";
  var KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
  var TABLE = {
    clients: "nd_clients", properties: "nd_properties", brokers: "nd_brokers", events: "nd_events",
    companies: "nd_companies", deals: "nd_deals", activities: "nd_activities", documents: "nd_documents"
  };
  var sb = null, session = null, readyP = null, snap = {};

  function lib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise(function (ok, bad) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
      s.onload = ok;
      s.onerror = function () { bad(new Error("Няма връзка с базата. Проверете интернета.")); };
      document.head.appendChild(s);
    });
  }
  function client() {
    if (!sb) sb = window.supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "nd-crm-auth" } });
    return sb;
  }

  /* ---------- toast (uses the page's own #toast when present) ---------- */
  var tTimer;
  function say(msg) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "nd-toast"; t.className = "nd-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(tTimer); tTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---------- sign-in window (same wine / gold / cream glass look) ---------- */
  var css =
    ".nd-auth{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(120% 90% at 50% 0%,rgba(154,26,51,.55),rgba(40,4,12,.82));-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font-family:'Roboto Condensed',system-ui,sans-serif}" +
    ".nd-auth[hidden]{display:none}" +
    ".nd-card{width:min(420px,100%);border-radius:28px;padding:26px 22px 22px;background:linear-gradient(160deg,rgba(255,250,246,.96),rgba(251,236,224,.92));border:1.5px solid #e3b25e;box-shadow:0 0 0 1px rgba(243,207,134,.55) inset,0 0 26px rgba(227,178,94,.55),0 24px 60px rgba(30,0,8,.55);color:#1f1111}" +
    ".nd-card img{display:block;height:58px;margin:0 auto 10px}" +
    ".nd-card h2{margin:0 0 4px;text-align:center;font:700 26px/1.15 Georgia,'PT Serif',serif;color:#6b0a1c}" +
    ".nd-card p.s{margin:0 0 16px;text-align:center;font-size:15px;color:#6b4a40}" +
    ".nd-card label{display:block;font-weight:700;font-size:14px;color:#6b0a1c;margin:10px 2px 5px}" +
    ".nd-card input{width:100%;box-sizing:border-box;height:46px;border-radius:14px;border:1.5px solid rgba(227,178,94,.85);background:rgba(255,255,255,.8);padding:0 14px;font:16px 'Roboto Condensed',system-ui,sans-serif;color:#1f1111;outline:none;box-shadow:0 0 0 0 rgba(227,178,94,0);transition:box-shadow .2s}" +
    ".nd-card input:focus{box-shadow:0 0 0 3px rgba(227,178,94,.45)}" +
    ".nd-card button{margin-top:18px;width:100%;height:50px;border-radius:16px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#b42446,#9a1a33 45%,#4f0716);color:#fff3dc;font:700 18px 'Roboto Condensed',system-ui,sans-serif;letter-spacing:.3px;cursor:pointer;box-shadow:0 0 18px rgba(227,178,94,.55),inset 0 1px 0 rgba(255,255,255,.35)}" +
    ".nd-card button:disabled{opacity:.6}" +
    ".nd-card .err{min-height:20px;margin:10px 2px 0;color:#b4142e;font-weight:700;font-size:14px}" +
    ".nd-card .lnk{display:block;margin:12px auto 0;background:none;border:0;box-shadow:none;height:auto;width:auto;color:#6b0a1c;font:700 14px 'Roboto Condensed',sans-serif;text-decoration:underline;cursor:pointer}" +
    ".nd-toast{position:fixed;left:50%;bottom:110px;transform:translateX(-50%) translateY(20px);z-index:210;max-width:90vw;padding:12px 18px;border-radius:16px;background:linear-gradient(180deg,#9a1a33,#4f0716);color:#fff3dc;border:1px solid #e3b25e;box-shadow:0 0 16px rgba(227,178,94,.5);font:700 15px 'Roboto Condensed',sans-serif;opacity:0;transition:.25s;pointer-events:none}" +
    ".nd-toast.show{opacity:1;transform:translateX(-50%)}" +
    ".nd-loading{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:190;padding:6px 14px;border-radius:12px;background:rgba(79,7,22,.85);color:#f3cf86;font:700 13px 'Roboto Condensed',sans-serif;border:1px solid rgba(227,178,94,.7)}";
  function injectCss() {
    if (document.getElementById("nd-css")) return;
    var s = document.createElement("style"); s.id = "nd-css"; s.textContent = css; document.head.appendChild(s);
  }
  var box;
  function authBox(msg) {
    injectCss();
    if (!box) {
      box = document.createElement("div");
      box.className = "nd-auth"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Вход в CRM");
      box.innerHTML =
        '<form class="nd-card" novalidate><img src="assets/logo.png" alt="Недвижими имоти Надежда"><h2>Вход в CRM</h2><p class="s">Влезте с акаунта си на брокер</p>' +
        '<label for="nd-em">Имейл</label><input id="nd-em" type="email" autocomplete="username" required>' +
        '<label for="nd-pw">Парола</label><input id="nd-pw" type="password" autocomplete="current-password" required>' +
        '<div class="err" role="alert"></div><button type="submit">Вход</button><button type="button" class="lnk" data-reset>Забравена парола</button></form>';
      document.body.appendChild(box);
    }
    box.hidden = false;
    box.querySelector(".err").textContent = msg || "";
    setTimeout(function () { var e = box.querySelector("#nd-em"); if (e) e.focus(); }, 50);
    return box;
  }
  function waitLogin(msg) {
    return new Promise(function (ok) {
      var b = authBox(msg), f = b.querySelector("form"), err = b.querySelector(".err"), btn = b.querySelector('button[type="submit"]');
      f.onsubmit = function (e) {
        e.preventDefault();
        var em = b.querySelector("#nd-em").value.trim(), pw = b.querySelector("#nd-pw").value;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { err.textContent = "Въведете валиден имейл."; return; }
        if (!pw) { err.textContent = "Въведете парола."; return; }
        btn.disabled = true; err.textContent = "";
        client().auth.signInWithPassword({ email: em, password: pw }).then(function (r) {
          btn.disabled = false;
          if (r.error) { err.textContent = /invalid/i.test(r.error.message) ? "Грешен имейл или парола." : r.error.message; return; }
          session = r.data.session; b.hidden = true; ok(session);
        });
      };
      b.querySelector("[data-reset]").onclick = function () {
        var em = b.querySelector("#nd-em").value.trim();
        if (!em) { err.textContent = "Въведете имейла си и натиснете отново."; return; }
        client().auth.resetPasswordForEmail(em, { redirectTo: location.origin + "/mobile/crm/crm-nachalo.html" }).then(function (r) {
          err.textContent = r.error ? r.error.message : "Изпратихме ви имейл за нова парола.";
        });
      };
    });
  }
  function newPassword() {
    var b = authBox(""), f = b.querySelector("form"), err = b.querySelector(".err");
    b.querySelector("h2").textContent = "Нова парола";
    b.querySelector("p.s").textContent = "Въведете новата си парола";
    b.querySelector('label[for="nd-em"]').hidden = true; b.querySelector("#nd-em").hidden = true;
    b.querySelector("[data-reset]").hidden = true;
    var pw = b.querySelector("#nd-pw"); pw.autocomplete = "new-password";
    f.onsubmit = function (e) {
      e.preventDefault();
      if (pw.value.length < 8) { err.textContent = "Паролата трябва да е поне 8 символа."; return; }
      client().auth.updateUser({ password: pw.value }).then(function (r) {
        if (r.error) { err.textContent = r.error.message; return; }
        b.hidden = true; say("Паролата е сменена");
        try { history.replaceState(null, "", location.pathname); } catch (x) {}
      });
    };
  }
  function checkStaff() {
    return client().rpc("nd_is_staff").then(function (r) {
      if (r.error) throw r.error;
      if (!r.data) {
        return client().auth.signOut().then(function () { return waitLogin("Този акаунт няма достъп до CRM."); }).then(checkStaff);
      }
      return session;
    });
  }

  var ND = (window.ND = {
    say: say,
    ready: function () {
      if (readyP) return readyP;
      readyP = lib().then(function () {
        client().auth.onAuthStateChange(function (ev) { if (ev === "PASSWORD_RECOVERY") newPassword(); });
        return client().auth.getSession();
      }).then(function (r) {
        session = r.data && r.data.session;
        return session || waitLogin();
      }).then(checkStaff).then(function (s) {
        ND.user = s && s.user;
        return s;
      });
      readyP.catch(function (e) { say(e.message || "Грешка при връзка с базата"); });
      return readyP;
    },
    signOut: function () {
      return client().auth.signOut().then(function () { location.reload(); });
    },
    resetPassword: function (email) {
      return client().auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/mobile/crm/crm-nachalo.html" }).then(function (r) {
        return r.error ? r.error.message : "Изпратихме ви имейл за нова парола.";
      });
    },
    token: function () {
      return client().auth.getSession().then(function (r) { return r.data.session ? r.data.session.access_token : null; });
    },
    /* rows -> page objects ({...data, id}) */
    load: function (kind, opts) {
      var q = client().from(TABLE[kind]).select("id,data,created_at,updated_at").order("created_at", { ascending: true }).limit(5000);
      if (opts && opts.client_id) q = q.eq("client_id", opts.client_id);
      return q.then(function (r) {
        if (r.error) throw r.error;
        var list = r.data.map(function (row) {
          var o = Object.assign({}, row.data, { id: row.id });
          o._created = row.created_at; o._updated = row.updated_at;
          return o;
        });
        snap[kind] = {};
        list.forEach(function (o) { snap[kind][o.id] = clean(o); });
        return list;
      });
    },
    put: function (kind, obj) {
      var data = JSON.parse(clean(obj));
      var row = { data: data };
      if (obj.id) row.id = String(obj.id);
      return client().from(TABLE[kind]).upsert(row).select("id,created_at").single().then(function (r) {
        if (r.error) { say("Не е записано: " + r.error.message); throw r.error; }
        obj.id = r.data.id;
        (snap[kind] = snap[kind] || {})[obj.id] = clean(obj);
        return obj;
      });
    },
    del: function (kind, id) {
      return client().from(TABLE[kind]).delete().eq("id", String(id)).then(function (r) {
        if (r.error) { say("Не е изтрито: " + r.error.message); throw r.error; }
        if (snap[kind]) delete snap[kind][id];
      });
    },
    /* write only what changed in a page array since the last load/sync */
    sync: function (kind, arr) {
      var prev = snap[kind] || {}, seen = {}, jobs = [];
      arr.forEach(function (o) {
        if (!o.id) o.id = newId();
        seen[o.id] = 1;
        var c = clean(o);
        if (prev[o.id] !== c) jobs.push(ND.put(kind, o));
      });
      Object.keys(prev).forEach(function (id) { if (!seen[id]) jobs.push(ND.del(kind, id)); });
      return Promise.all(jobs);
    },
    upload: function (path, file) {
      return client().storage.from("nd-files").upload(path, file, { upsert: true, contentType: file.type || undefined }).then(function (r) {
        if (r.error) { say("Файлът не е качен: " + r.error.message); throw r.error; }
        return r.data.path;
      });
    },
    fileUrl: function (path) {
      return client().storage.from("nd-files").createSignedUrl(path, 3600).then(function (r) { return r.data && r.data.signedUrl; });
    },
    fileUrls: function (paths) {
      if (!paths.length) return Promise.resolve({});
      return client().storage.from("nd-files").createSignedUrls(paths, 3600).then(function (r) {
        var m = {};
        (r.data || []).forEach(function (x) { if (x.signedUrl) m[x.path] = x.signedUrl; });
        return m;
      });
    },
    removeFile: function (path) {
      return client().storage.from("nd-files").remove([path]);
    },
    newId: function () { return newId(); },
    busy: function (on) {
      injectCss();
      var el = document.getElementById("nd-loading");
      if (on && !el) { el = document.createElement("div"); el.id = "nd-loading"; el.className = "nd-loading"; el.textContent = "Зареждане…"; document.body.appendChild(el); }
      if (!on && el) el.remove();
    }
  });
  function newId() { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)); }
  function clean(o) {
    return JSON.stringify(o, function (k, v) { return k === "id" || k.charAt(0) === "_" ? undefined : v; });
  }

  /* "Моят профил" on every page: shows the signed-in account and offers sign-out */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest('[data-msg="Моят профил"]');
    if (!b || !ND.user) return;
    e.stopImmediatePropagation(); e.preventDefault();
    if (window.NDGlobal) window.NDGlobal.settings();
  }, true);
})();
