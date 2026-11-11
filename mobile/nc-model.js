/* ИМОТИ НАДЕЖДА · TASK-009 · истински 3D модел на сграда – ДВИГАТЕЛ по договора на страницата „Ново строителство“ (TASK-008) + състояние на модела.
   ES модул без външни CDN. Включва се от страницата на TASK-008 (mobile/nc.html и mobile/crm/crm-nc.html) с ЕДИН ред:
       <script type="module" src="/mobile/nc-model.js"></script>
   (страницата търси window.NCModel първо; резервно – NC.ENGINE_URL = { model: "/mobile/nc-model.js" }). Без този ред страницата ползва вградения crm-nc-3d.js.
   Откъде идва моделът го решава САМАТА страница (TASK-008, от 10:28 ч.): публично – nd_public_models(slug) → защитен път /model/<сграда>
   (сървърът проверява публикуването при всяко отваряне и дава подписан адрес за 60 s); екип – models.get {preview:true} → {url, note}.
   Тук НЕ се пипа адаптерът ѝ.
   Какво прави този файл:
   1) ДВИГАТЕЛ – building(el, o) по договора в crm-nc.js (select, setFloor, onlyFloor, reset, view, rotate, zoom, fullscreen, selected, screenOf, info, destroy):
      зарежда САМО разрешена производна (проверка на адреса: /model/<сграда> или подписан адрес към private/derived/models | public/models в nd-files;
      оригинали, blob:, data:, чужди хостове – отказ), тегли GLB с напредък и твърд лимит (64 MB), проверява подписа „glTF“, после подава файла на
      ЕДИНСТВЕНИЯ визуализатор на сайта (crm-nc-3d.js – three.js r187 локално; апартамент се избира само по смислово съответствие unit_id/unit_code/floor_id).
      Състояния: зареждане (проценти + изглед от самия модел, ако е публикуван), грешка (честно, без снимка вместо модел), загубен WebGL контекст,
      прерисуване при връщане на скрит раздел; при напускане – освобождаване на всичко (blob, геометрии, материали, текстури, контекст).
      Значка в прегледа: „Версия N · публикуван / чака преглед · точен (IFC)“ – от nd_public_models (публично) или nd_models под RLS (екип).
   2) status(сграда) / stateHtml(сграда, име) – само четене (nd_public_models; за екипа nd_models + nd_jobs под RLS): „обработва се“ (ph42 – илюстрация,
      изрично обозначена), „чака преглед“, „публикуван“. Кука за страницата (1 ред в t3d(), виж OTCHET_TASK-009.md) показва „обработва се“ вместо „не е подготвен“.
   Нищо не се измисля: без модел → страницата показва честното празно състояние (ph28); без съответствие → апартамент не се избира от модела. */

const NAME = "TASK-009";
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";   /* публичният ключ на сайта (същият като в mobile/site-data.js и mobile/nc.js) */
const MAX_GLB = 64 * 1024 * 1024;                                   /* = nd_models.glb_bytes и лимитът на изпълнителя */
const ID = /^[a-z0-9]{8,64}$/;
const FID = { exact: "точен (от BIM/CAD източник)", verified: "проверен (контролни размери)", conceptual: "концептуален" };
const SRC = { ifc: "IFC", dxf: "DXF", dwg: "DWG", glb: "GLB", gltf: "glTF" };
const ST_BG = { published: "публикуван", review: "чака преглед – вижда само екипът", processing: "обработва се", none: "няма модел" };

/* ---------- състояние по сграда (попълва се от слоя „източник“ при всяко четене на проекта) ---------- */
const REG = Object.create(null);
export function status(buildingId) { return REG[buildingId] || { state: "none" }; }

/* ---------- помощни ---------- */
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const RM = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const W = () => (typeof window !== "undefined" ? window : {});
function libBase() { const NC = W().NC; return (NC && NC.libBase) || "/mobile/crm/"; }
function img(name) { const NC = W().NC; return NC && typeof NC.img === "function" ? NC.img(name) : "/mobile/crm/assets/" + name; }

export function webglOk() {
  try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; }
}

/* разрешени адреси: само защитеният път /model/<сграда> (същия произход) или подписан адрес към производна в хранилището (private/derived/models
   на TASK-009 или public/models на TASK-007). Оригинали (private/cad, private/imports…), blob:, data:, http: – отказ. */
export function allowedUrl(url) {
  if (typeof url !== "string" || !url) return false;
  let u; try { u = new URL(url, location.href); } catch (e) { return false; }
  if (u.protocol !== "https:" && !(u.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return false;
  if (u.origin === location.origin && /^\/model\/[a-z0-9]{8,64}$/.test(u.pathname)) return true;
  const trusted = u.origin === location.origin || /\.supabase\.co$/.test(u.hostname);
  return trusted && /\/storage\/v1\/object\/sign\/nd-files\/projects\/[a-z0-9]{8,64}\/(private\/derived\/models|public\/models)\/[^?]+\.glb$/i.test(u.pathname);
}

/* стил на слоя (стъкло с златен глоу – като останалите карти на сайта); веднъж */
function css() {
  if (document.getElementById("nc9-css")) return;
  const s = document.createElement("style"); s.id = "nc9-css";
  s.textContent = [
    /* същият мащаб като елементите на страницата (.tag3 – 56 px / 23 px, .st3 – 28 px); страницата сама мащабира платното за телефон */
    ".nc9-poster{position:absolute;inset:0;background-size:cover;background-position:center;filter:blur(14px) saturate(.9);opacity:.55;transform:scale(1.06);pointer-events:none}",
    ".nc9-load{position:absolute;left:50%;top:50%;z-index:6;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:16px;min-width:min(560px,86%);max-width:92%;padding:30px 36px;border-radius:30px;",
    "color:#5a0a12;background:rgba(255,243,224,.86);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:inset 0 0 0 2px rgba(237,196,122,.65),0 0 34px rgba(246,212,142,.65),0 14px 40px rgba(60,8,18,.28);font:700 28px/1.3 var(--cond,system-ui);text-align:center}",
    ".nc9-load small{font:400 23px/1.3 var(--cond,system-ui);color:#7a2a34}",
    ".nc9-bar{width:100%;height:14px;border-radius:8px;overflow:hidden;background:rgba(122,15,34,.14);box-shadow:inset 0 0 0 1.5px rgba(237,196,122,.55)}",
    ".nc9-bar i{display:block;height:100%;width:0;border-radius:8px;background:linear-gradient(90deg,#c9962b,#f6d48e,#c9962b);box-shadow:0 0 16px rgba(246,212,142,.95);transition:width .25s}",
    ".nc9-badge{position:absolute;left:18px;bottom:18px;z-index:5;display:inline-flex;align-items:center;gap:12px;height:56px;padding:0 22px;border-radius:28px;font:700 23px/1 var(--cond,system-ui);color:#3a1d00;",
    "background:rgba(255,243,224,.86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:inset 0 0 0 2px rgba(237,196,122,.8),0 0 22px rgba(246,212,142,.65)}",
    ".nc9-badge.review{color:#fff3dc;background:rgba(90,10,18,.84)}",
    ".nc9-badge i{display:inline-block;width:14px;height:14px;border-radius:50%;background:#1f9c3a;box-shadow:0 0 12px #1f9c3a}.nc9-badge.review i{background:#d99a12;box-shadow:0 0 12px #d99a12}",
    ".nc-3d.fs .nc9-badge,.nc-3d:fullscreen .nc9-badge{bottom:28px}",
    "@media (prefers-reduced-motion:reduce){.nc9-bar i{transition:none}}"
  ].join("");
  document.head.appendChild(s);
}

/* ---------- теглене на GLB с напредък и лимит (само разрешен адрес) ---------- */
async function fetchGlb(url, ac, onProgress) {
  const r = await fetch(url, { signal: ac.signal, credentials: "same-origin", cache: "no-store" }).catch((e) => { if (e && e.name === "AbortError") throw e; throw new Error("Няма връзка със сървъра на модела."); });
  if (r.status === 404) throw new Error("Няма достъпен 3D модел – проектът или моделът вече не са публикувани.");
  if (!r.ok) throw new Error("Сървърът на модела отговори с грешка " + r.status + ".");
  const total = Number(r.headers.get("content-length") || 0);
  if (total > MAX_GLB) throw new Error("Моделът е " + mb(total) + " – над допустимите " + mb(MAX_GLB) + ".");
  const chunks = []; let got = 0;
  if (r.body && r.body.getReader) {
    const rd = r.body.getReader();
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      got += value.byteLength; if (got > MAX_GLB) { try { await rd.cancel(); } catch (e) { /* */ } throw new Error("Моделът е над допустимите " + mb(MAX_GLB) + "."); }
      chunks.push(value); onProgress(got, total);
    }
  } else { const b = new Uint8Array(await r.arrayBuffer()); if (b.byteLength > MAX_GLB) throw new Error("Моделът е над допустимите " + mb(MAX_GLB) + "."); chunks.push(b); got = b.byteLength; onProgress(got, total); }
  const head = chunks.length ? chunks[0] : new Uint8Array(0);
  if (got < 20 || head.byteLength < 4 || !(head[0] === 0x67 && head[1] === 0x6c && head[2] === 0x54 && head[3] === 0x46))      /* "glTF" */
    throw new Error("Файлът не е валиден GLB модел.");
  return { blob: new Blob(chunks, { type: "model/gltf-binary" }), bytes: got };
}

/* ---------- двигател: building(el, o) ---------- */
export function building(el, o) {
  css();
  o = o || {};
  const st = { dead: false, ready: false, real: null, blob: null, sel: o.sel || null, floor: o.floor || null, only: false, ac: new AbortController(), ui: {} };
  const info = { mapped: 0, unmapped: 0, floors: 0, units: 0, bytes: 0, engine: NAME };
  const fail = (m) => { if (st.dead) return; cleanupUi(); if (o.onError) o.onError(m); };
  function cleanupUi() { Object.keys(st.ui).forEach((k) => { if (st.ui[k] && st.ui[k].remove) st.ui[k].remove(); delete st.ui[k]; }); }
  function add(tag, cls, html) { const n = document.createElement(tag); n.className = cls; if (html != null) n.innerHTML = html; el.appendChild(n); return n; }
  /* коя сграда е: от /model/<сграда>, от o.building_id или от текущия избор на страницата (при адрес за преглед на екипа) */
  const NCp = window.NC, pageS = NCp && (typeof NCp.state === "function" ? NCp.state() : NCp.state), pageB = pageS && pageS.b;
  const bid = (/^\/model\/([a-z0-9]{8,64})$/.exec(String(o.url || "")) || [])[1] || o.building_id || (ID.test(String(pageB || "")) ? pageB : null);
  let reg = bid ? status(bid) : { state: "none" };
  const ok = allowedUrl(o.url);
  let bar = null, note = null;
  if (ok) {
    /* зареждане: изглед от модела (ако е публичен) като фон + стъклена карта с напредък (над индикатора на страницата) */
    if (bid && /^\/model\//.test(o.url) && reg.poster !== false) { const p = add("div", "nc9-poster"); p.setAttribute("aria-hidden", "true"); p.style.backgroundImage = "url(/model/" + bid + "/poster)"; st.ui.poster = p; }
    const load = add("div", "nc9-load", "<span>Зареждане на 3D модела…</span><span class=\"nc9-bar\"><i></i></span><small>Свързване…</small>"); load.setAttribute("role", "status"); load.setAttribute("aria-live", "polite"); st.ui.load = load;
    bar = load.querySelector("i"); note = load.querySelector("small");
  }
  const onProgress = (got, total) => { if (st.dead || !bar) return; if (total) { bar.style.width = Math.min(100, Math.round((got / total) * 100)) + "%"; note.textContent = Math.round((got / total) * 100) + " % · " + mb(got) + " от " + mb(total); } else { bar.style.width = "35%"; note.textContent = mb(got); } };

  (ok ? fetchGlb(o.url, st.ac, onProgress) : Promise.reject(new Error("Адресът на модела не е разрешена производна – зареждане отказано."))).then(({ blob, bytes }) => {
    if (st.dead) return;
    info.bytes = bytes; note.textContent = "Подготовка на сцената…"; bar.style.width = "100%";
    return import(libBase() + "crm-nc-3d.js").then((V) => {
      if (st.dead) return;
      if (!V || typeof V.building !== "function") throw new Error("Визуализаторът не се зареди.");
      st.blob = URL.createObjectURL(blob);
      st.real = V.building(el, Object.assign({}, o, { url: st.blob, sel: st.sel, floor: st.floor,
        onReady: (v) => {
          if (st.dead) { try { v.destroy(); } catch (e) { /* */ } return; }
          st.ready = true; Object.assign(info, v.info); v.info = info;            /* страницата чете info.units / info.mapped */
          if (st.blob) { URL.revokeObjectURL(st.blob); st.blob = null; }
          cleanupUi(); badge(); v.onlyFloor(st.only); if (st.floor) v.setFloor(st.floor);
          const cv = el.querySelector("canvas"); if (cv) { cv.addEventListener("webglcontextlost", onLost, { once: true }); }
          if (o.onReady) o.onReady(out);
        },
        onError: (m) => { if (st.blob) { URL.revokeObjectURL(st.blob); st.blob = null; } fail(m || "Моделът не се зареди."); } }));
    });
  }).catch((e) => { if (e && e.name === "AbortError") return; fail((e && e.message) || "Моделът не се зареди."); });

  function badge() {
    reg = bid ? status(bid) : reg; out.model = reg;                      /* състоянието може да е дошло след старта на зареждането */
    if (!bid || reg.state === "none") return;
    const parts = ["Версия " + (reg.version || "?"), ST_BG[reg.state] || reg.state];
    if (reg.fidelity && FID[reg.fidelity]) parts.push(FID[reg.fidelity]); if (reg.source && SRC[reg.source]) parts.push(SRC[reg.source]);
    const b = add("span", "nc9-badge" + (reg.state === "review" ? " review" : ""), "<i aria-hidden=\"true\"></i>" + esc(parts.join(" · "))); b.title = "3D модел – " + parts.join(", "); st.ui.badge = b;
  }
  function onLost(e) { if (e && e.preventDefault) e.preventDefault(); if (st.dead) return; fail("Графичният контекст (WebGL) се загуби – презаредете раздела „3D Сграда“."); }
  /* пауза при скрит раздел: визуализаторът рисува само при нужда; при връщане – едно прерисуване, за да не остане празно платно */
  function onVis() { if (st.dead || !st.ready || document.hidden) return; try { st.real.setFloor(st.floor); } catch (e) { /* */ } }
  document.addEventListener("visibilitychange", onVis);

  const R = (fn, dflt) => (st.ready && st.real && typeof st.real[fn] === "function" ? st.real[fn].bind(st.real) : () => dflt);
  const out = {
    select(id, focus) { st.sel = id || null; if (st.ready) st.real.select(id, focus); },
    focus(id) { R("focus")(id); },
    setFloor(fid) { st.floor = fid || null; if (st.ready) st.real.setFloor(fid); },
    onlyFloor(on) { st.only = !!on; if (st.ready) st.real.onlyFloor(on); },
    reset() { R("reset")(); }, view(k) { R("view")(k); }, rotate(d) { R("rotate")(d); }, zoom(k) { R("zoom")(k); },
    fullscreen() { if (st.ready) st.real.fullscreen(); else if (el.requestFullscreen && document.fullscreenElement !== el) el.requestFullscreen().catch(() => {}); else if (document.fullscreenElement === el) document.exitFullscreen(); },
    screenOf(id) { return R("screenOf", null)(id); },
    selected: () => st.sel,
    info, engine: NAME, model: reg,
    destroy() {
      st.dead = true; st.ac.abort(); document.removeEventListener("visibilitychange", onVis);
      if (st.blob) { URL.revokeObjectURL(st.blob); st.blob = null; }
      cleanupUi(); if (st.real) { try { st.real.destroy(); } catch (e) { /* */ } st.real = null; }
    }
  };
  return out;
}

/* ---------- „обработва се“ / „чака преглед“ – честен текст за страницата (кука: вижте OTCHET_TASK-009.md) ---------- */
export function stateHtml(building, name) {
  const r = status(building && building.id ? building.id : building), nm = name || (building && building.name) || "сградата";
  const ph = r.state === "processing" ? "nd/ph42.webp" : "nd/ph44.webp";
  const title = r.state === "processing" ? "3D моделът на " + nm + " се обработва" : r.state === "review" ? "3D моделът на " + nm + " чака преглед" : "3D моделът на " + nm + " още не е подготвен";
  const text = r.state === "processing" ? "Изпълнителят конвертира качения CAD/BIM файл към модел за браузър" + (r.phase_bg ? " – " + esc(r.phase_bg) : "") + (r.pct ? " (" + r.pct + " %)" : "") + ". Щом е готов, версията се проверява от администратор и чак тогава става публична. Нищо не се „дорисува“ – ако файлът няма 3D геометрия, тук ще пише защо."
    : r.state === "review" ? "Версия " + r.version + " е готова и чака изрично „Да“ от администратор (models.publish). Публиката не я вижда."
    : "За тази сграда няма качен и проверен 3D модел.";
  return '<div class="nc-na deco" role="status"><div class="nc-na-img" style="background-image:url(' + esc(img(ph)) + ')" aria-hidden="true"></div><span class="nc-na-cap">Илюстрация – не е този проект</span>' +
    '<div class="nc-na-t"><span class="tag">' + esc(cap(ST_BG[r.state] || "3D модел")) + "</span><h3>" + esc(title) + "</h3><p>" + text + "</p></div></div>";
}

/* ---------- състояние на модела по сграда – САМО ЧЕТЕНЕ (страницата сама решава откъде зарежда) ---------- */
function rpcAnon(fn, body) {
  return fetch(SB_URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
    .then((r) => (r.ok ? r.json() : null)).then((j) => (j && j[fn] !== undefined ? j[fn] : j)).catch(() => null);
}
function set(bid, v) { if (ID.test(String(bid))) REG[bid] = v; }
const PENDING = {};
/* публично: една заявка на проект (slug), кеширана; екип: nd_models + nd_jobs под RLS (една двойка заявки на проект) */
export function refresh(M, A) {
  if (!M || !M.project || !Array.isArray(M.buildings)) return Promise.resolve(REG);
  const mode = (A && A.mode) || (window.ND ? "staff" : "public"), key = mode + ":" + (mode === "staff" ? M.project.id : M.project.slug);
  if (PENDING[key]) return PENDING[key];
  const ids = new Set(M.buildings.map((b) => b.id));
  const p = (async () => {
    try {
      if (mode === "staff") {
        const ND = window.ND, sb = ND && typeof ND.sb === "function" ? ND.sb() : null;
        if (!sb) return REG;
        const [mr, jr] = await Promise.all([
          sb.from("nd_models").select("building_id,version,status,fidelity,source_format,glb_bytes,stats,job_id,published_at").eq("project_id", M.project.id).in("status", ["published", "review"]).order("version", { ascending: false }).limit(500),
          sb.from("nd_jobs").select("id,status,progress,input").eq("project_id", M.project.id).eq("kind", "cad_convert").in("status", ["queued", "running"]).limit(100)]);
        const next = {};
        ((jr && jr.data) || []).forEach((j) => { const bid = j.input && j.input.building_id, pr = j.progress || {}; if (bid && ids.has(bid) && !next[bid]) next[bid] = { state: "processing", job: j.id, phase_bg: pr.phase_bg || (j.status === "queued" ? "чака изпълнител" : null), pct: Number(pr.pct) || 0 }; });
        ((mr && mr.data) || []).forEach((m) => {
          if (!ids.has(m.building_id)) return;
          const cur = next[m.building_id];
          if (cur && cur.state === "published") return;                                   /* публикуваната има предимство; иначе най-новата „чака преглед“ */
          if (m.status === "published" || !cur || cur.state === "processing") next[m.building_id] = { state: m.status, version: m.version, fidelity: m.fidelity, source: m.source_format, bytes: Number(m.glb_bytes) || 0, job: m.job_id,
            units: (m.stats && m.stats.units_mapped) || 0, floors: (m.stats && m.stats.floors_mapped) || 0, triangles: (m.stats && m.stats.triangles) || null, published_at: m.published_at || null, processing: cur && cur.state === "processing" ? cur : null };
        });
        ids.forEach((bid) => { delete REG[bid]; if (next[bid]) set(bid, next[bid]); });
      } else {
        const slug = M.project.slug; if (!slug) return REG;
        const pub = await rpcAnon("nd_public_models", { p_slug: slug });
        ids.forEach((bid) => { delete REG[bid]; });
        if (pub && typeof pub === "object" && !Array.isArray(pub)) Object.keys(pub).forEach((bid) => { const v = pub[bid] || {}; if (ids.has(bid)) set(bid, { state: "published", version: v.version, fidelity: v.fidelity, bytes: Number(v.bytes) || 0, poster: !!v.poster, units: v.units || 0, floors: v.floors || 0, triangles: v.triangles || null, published_at: v.published_at || null }); });
      }
    } catch (e) { /* без връзка → без значка/състояние; страницата работи както преди */ }
    return REG;
  })();
  PENDING[key] = p; p.then(() => { setTimeout(() => { delete PENDING[key]; }, 15000); });
  return p;
}
/* увиване на адаптера САМО за четене: след всяко прочитане на проекта – refresh(); нищо в M и в modelUrl не се променя */
function wrapAdapter(A) {
  if (!A || A._nc9 || typeof A.project !== "function") return A;
  A._nc9 = true;
  const orig = A.project.bind(A);
  /* екип: изчаква (състоянието „обработва се“ трябва да е известно преди първото рисуване); публично: без изчакване – значката чете състоянието при готовност */
  A.project = (key) => orig(key).then((M) => { if (!M) return M; const p = refresh(M, A); return A.mode === "staff" ? p.then(() => M, () => M) : M; });
  return A;
}
export function install(NC) {
  NC = NC || window.NC; if (!NC || NC._nc9) return false; NC._nc9 = true;
  if (typeof NC.boot === "function") { const boot = NC.boot; NC.boot = function (A) { return boot.call(this, wrapAdapter(A)); }; }
  if (NC.A) { wrapAdapter(NC.A); if (typeof NC.model === "function" && NC.model()) refresh(NC.model(), NC.A); }   /* вече стартирала страница: само състоянието, без презареждане */
  return true;
}

export const name = NAME;
const API = { name: NAME, webglOk, building, install, refresh, status, stateHtml, allowedUrl, version: "1.0.0" };
if (typeof window !== "undefined") { window.NCModel = API; install(window.NC); }
export default API;
