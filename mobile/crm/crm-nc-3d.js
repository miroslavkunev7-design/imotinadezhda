/* ИМОТИ НАДЕЖДА · TASK-008 · 3D сграда и 360° панорама (ES модул, зарежда се само когато се отвори таб „3D Сграда“ или „360° Разходка“).
   Договори: TASK-009 05_3D_VIEWER/VIEWER_CONTRACT.md и TASK-010 06_360_PANORAMA/PANORAMA_CONTRACT.md.
   3D: само разрешената публична производна (GLB от медия вид „model“); избор на апартамент само по реално смислово съответствие
   (glTF extras → unit_id / unit_code / floor_id / floor_level, или име на възел „unit:<код>“ / „floor:<ниво>“) – без визуално „познаване“.
   Рендериране при нужда (без постоянен цикъл), ограничен DPR, освобождаване на геометрии/материали/текстури при напускане. */
import * as T from "/mobile/vendor/three/r187/nd-three.min.js";

const COL = { free: 0x1f9c3a, reserved: 0xd99a12, sold: 0xc8102e, sel: 0xf2c14e };
const RM = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function webglOk() {
  try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; }
}
function dpr() { return Math.min(window.devicePixelRatio || 1, matchMedia("(pointer:coarse)").matches ? 1.5 : 2); }
function sizeOf(el) { return { w: Math.max(1, el.clientWidth), h: Math.max(1, el.clientHeight) }; }
function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach((m) => { Object.keys(m).forEach((k) => { if (m[k] && m[k].isTexture) m[k].dispose(); }); m.dispose(); });
  });
}
/* резервен „цял екран“ (когато браузърът откаже Fullscreen API): клас .fs, изход с Escape */
function fsFallback(el, done) {
  const on = !el.classList.contains("fs"); el.classList.toggle("fs", on); done && done();
  if (el._ncEsc) { document.removeEventListener("keydown", el._ncEsc, true); el._ncEsc = null; }
  if (on) { el._ncEsc = (e) => { if (e.key === "Escape" && el.classList.contains("fs")) { e.preventDefault(); fsFallback(el, done); } }; document.addEventListener("keydown", el._ncEsc, true); }
}
function fsToggle(el, done) {
  if (document.fullscreenElement === el) { document.exitFullscreen(); return; }
  if (el.classList.contains("fs")) { fsFallback(el, done); return; }
  if (el.requestFullscreen) el.requestFullscreen().catch(() => fsFallback(el, done));
  else fsFallback(el, done);
}
function ndc(e, el) { const r = el.getBoundingClientRect(); return new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); }

/* смислово съответствие възел → апартамент / етаж (само явни ключове; непознатото не се избира) */
function mapKey(o) {
  const d = o.userData || {}, n = String(o.name || "");
  const r = {};
  if (typeof d.unit_id === "string") r.unit_id = d.unit_id;
  if (typeof d.unit_code === "string") r.unit_code = d.unit_code;
  if (typeof d.floor_id === "string") r.floor_id = d.floor_id;
  if (d.floor_level != null && isFinite(d.floor_level)) r.floor_level = Number(d.floor_level);
  let m = /^unit:(.{1,20})$/i.exec(n); if (m && !r.unit_id && !r.unit_code) r.unit_code = m[1];
  m = /^floor:(-?\d{1,3})$/i.exec(n); if (m && !r.floor_id && r.floor_level == null) r.floor_level = Number(m[1]);
  return r;
}

/* ---------------- 3D сграда ---------------- */
export function building(el, o) {
  const st = { dead: false, sel: o.sel || null, floor: o.floor || null, only: false, anim: 0 };
  const units = o.units || [], floors = o.floors || [];
  const byId = new Map(units.map((u) => [u.id, u])), byCode = new Map(units.map((u) => [u.code, u]));
  const floorById = new Map(floors.map((f) => [f.id, f])), floorByLevel = new Map(floors.map((f) => [f.level, f]));
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(dpr()); renderer.outputColorSpace = T.SRGBColorSpace;
  const { w, h } = sizeOf(el); renderer.setSize(w, h, false);
  const cv = renderer.domElement; cv.className = "nc3d-cv"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", o.label || "3D модел на сградата");
  el.appendChild(cv);
  const scene = new T.Scene(); scene.background = new T.Color(0xf4ece3);
  scene.add(new T.HemisphereLight(0xffffff, 0xb59a86, 1.1));
  const sun = new T.DirectionalLight(0xffffff, 1.6); sun.position.set(30, 50, 40); scene.add(sun);
  const cam = new T.PerspectiveCamera(40, w / h, 0.05, 5000);
  const ctl = new T.OrbitControls(cam, cv); ctl.enableDamping = false; ctl.screenSpacePanning = true;
  const render = () => { if (!st.dead) renderer.render(scene, cam); };
  ctl.addEventListener("change", render);
  const meshUnit = new Map(), unitMeshes = new Map(), meshFloor = new Map();
  let model = null, home = null;

  function resize() { if (st.dead) return; const s = sizeOf(el); renderer.setSize(s.w, s.h, false); cam.aspect = s.w / s.h; cam.updateProjectionMatrix(); render(); }
  const ro = window.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(el);
  const onFs = () => setTimeout(resize, 60); document.addEventListener("fullscreenchange", onFs);

  function frame(box) {
    const c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3()), r = Math.max(sz.x, sz.y, sz.z) || 1;
    const d = (r / 2) / Math.tan((cam.fov * Math.PI) / 360) * 1.55;
    return { target: c, pos: c.clone().add(new T.Vector3(d * 0.62, d * 0.42, d * 0.82)), r };
  }
  function moveTo(target, pos) {
    cancelAnimationFrame(st.anim);
    if (RM()) { ctl.target.copy(target); cam.position.copy(pos); ctl.update(); render(); return; }
    const t0 = performance.now(), a = ctl.target.clone(), b = cam.position.clone();
    const step = (t) => { if (st.dead) return; const k = Math.min(1, (t - t0) / 450), e = k * (2 - k); ctl.target.lerpVectors(a, target, e); cam.position.lerpVectors(b, pos, e); ctl.update(); render(); if (k < 1) st.anim = requestAnimationFrame(step); };
    st.anim = requestAnimationFrame(step);
  }
  const mats = (x) => (x.material ? (Array.isArray(x.material) ? x.material : [x.material]) : []);
  function paint() {
    const fsel = st.only && st.floor;
    model && model.traverse((x) => {
      if (!x.isMesh) return;
      const u = meshUnit.get(x), on = u && u.id === st.sel, fade = fsel && meshFloor.get(x) !== st.floor;
      mats(x).forEach((m) => {
        const b = m.userData._nc || {};
        if (m.color && b.color) { m.color.copy(b.color); if (u) m.color.lerp(new T.Color(on ? COL.sel : COL[u.status] || 0x999999), on ? 0.85 : 0.6); }
        if (m.emissive) m.emissive.setHex(on ? 0x6a4a00 : b.emissive != null ? b.emissive : 0x000000);
        m.transparent = fade || !!b.transparent; m.opacity = fade ? 0.12 : b.opacity == null ? 1 : b.opacity; m.depthWrite = !fade; m.needsUpdate = true;
      });
    });
    render();
  }
  const out = {
    select(id, focus) { st.sel = id || null; paint(); if (focus !== false) this.focus(id); },
    focus(id) { const ms = unitMeshes.get(id); if (!ms || !ms.length) return; const b = new T.Box3(); ms.forEach((m) => b.expandByObject(m)); const f = frame(b); const dir = cam.position.clone().sub(ctl.target).normalize(); moveTo(f.target, f.target.clone().add(dir.multiplyScalar(Math.max(f.r * 3.2, (home ? home.r : 10) * 0.9)))); },
    setFloor(fid) { st.floor = fid || null; paint(); },
    onlyFloor(on) { st.only = !!on; paint(); },
    reset() { if (home) moveTo(home.target, home.pos); },
    view(k) { if (!home) return; const d = home.pos.distanceTo(home.target), t = home.target, v = { front: [0, 0.35, 1], back: [0, 0.35, -1], left: [-1, 0.35, 0], right: [1, 0.35, 0], top: [0.001, 1, 0.001] }[k]; if (!v) return; moveTo(t.clone(), t.clone().add(new T.Vector3(v[0], v[1], v[2]).normalize().multiplyScalar(d))); },
    rotate(deg) { const off = cam.position.clone().sub(ctl.target); off.applyAxisAngle(new T.Vector3(0, 1, 0), (deg * Math.PI) / 180); moveTo(ctl.target.clone(), ctl.target.clone().add(off)); },
    zoom(k) { const off = cam.position.clone().sub(ctl.target).multiplyScalar(k); const dist = off.length(); if (home && (dist < home.r * 0.15 || dist > home.r * 12)) return; moveTo(ctl.target.clone(), ctl.target.clone().add(off)); },
    fullscreen() { fsToggle(el, resize); },
    /* къде на екрана е апартаментът (за алтернативно управление и проверки) */
    screenOf(id) { const ms = unitMeshes.get(id); if (!ms || !ms.length) return null; const b = new T.Box3(); ms.forEach((m) => b.expandByObject(m)); const v = b.getCenter(new T.Vector3()).project(cam); const r = cv.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
    selected: () => st.sel,
    info: { mapped: 0, unmapped: 0, floors: 0 },
    destroy() {
      if (el._ncEsc) { document.removeEventListener("keydown", el._ncEsc, true); el._ncEsc = null; } el.classList.remove("fs");
      st.dead = true; cancelAnimationFrame(st.anim); if (ro) ro.disconnect(); document.removeEventListener("fullscreenchange", onFs);
      ctl.dispose(); cv.removeEventListener("pointerdown", pd); cv.removeEventListener("pointerup", pu);
      if (model) { scene.remove(model); disposeTree(model); } renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); cv.remove();
    }
  };
  /* избор с щракване: само ако няма плъзгане и възелът има явно съответствие */
  let down = null;
  const pd = (e) => { down = { x: e.clientX, y: e.clientY }; };
  const pu = (e) => {
    if (!down || Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 6 || !model) { down = null; return; } down = null;
    const ray = new T.Raycaster(); ray.setFromCamera(ndc(e, cv), cam);
    const hits = ray.intersectObject(model, true).filter((x) => x.object.visible && !(x.object.material && x.object.material.opacity < 0.5));
    for (const hgt of hits) { const u = meshUnit.get(hgt.object); if (u) { o.onPick && o.onPick(u.id); return; } }
    o.onMiss && o.onMiss();
  };
  cv.addEventListener("pointerdown", pd); cv.addEventListener("pointerup", pu);

  const loader = new T.GLTFLoader();
  loader.load(o.url, (g) => {
    if (st.dead) { disposeTree(g.scene); return; }
    model = g.scene; scene.add(model);
    /* съответствие: най-близкият предшественик с явен ключ */
    model.traverse((x) => {
      if (!x.isMesh) return;
      let unitRef = null, floorRef = null;
      for (let p = x; p; p = p.parent) {
        const k = mapKey(p);
        if (!unitRef && (k.unit_id || k.unit_code)) unitRef = k.unit_id ? byId.get(k.unit_id) : byCode.get(k.unit_code);
        if (!floorRef && (k.floor_id || k.floor_level != null)) floorRef = k.floor_id ? floorById.get(k.floor_id) : floorByLevel.get(k.floor_level);
        if (p === model) break;
      }
      if (x.material) { x.material = Array.isArray(x.material) ? x.material.map((m) => m.clone()) : x.material.clone(); mats(x).forEach((m) => { m.userData._nc = { color: m.color ? m.color.clone() : null, emissive: m.emissive ? m.emissive.getHex() : null, opacity: m.opacity, transparent: m.transparent }; }); }
      if (unitRef) { meshUnit.set(x, unitRef); if (!unitMeshes.has(unitRef.id)) unitMeshes.set(unitRef.id, []); unitMeshes.get(unitRef.id).push(x); out.info.mapped++; }
      else out.info.unmapped++;
      const fl = floorRef || (unitRef ? floorById.get(unitRef.floor_id) : null);
      if (fl) meshFloor.set(x, fl.id);
    });
    out.info.floors = new Set(meshFloor.values()).size; out.info.units = unitMeshes.size;
    const box = new T.Box3().setFromObject(model); home = frame(box);
    cam.near = Math.max(0.01, home.r / 500); cam.far = home.r * 60; cam.updateProjectionMatrix();
    ctl.target.copy(home.target); cam.position.copy(home.pos); ctl.minDistance = home.r * 0.15; ctl.maxDistance = home.r * 12; ctl.update();
    paint(); if (st.sel && unitMeshes.has(st.sel)) out.focus(st.sel);
    o.onReady && o.onReady(out);
  }, undefined, (err) => { if (!st.dead) o.onError && o.onError(err && err.message ? err.message : "Моделът не се зареди"); });
  return out;
}

/* ---------------- 360° панорама (еквиправоъгълно изображение върху сфера) ---------------- */
export function panorama(el, o) {
  const st = { dead: false, lon: 0, lat: 0, fov: 75, i: o.index || 0, tex: null, auto: null };
  const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(dpr()); renderer.outputColorSpace = T.SRGBColorSpace;
  const { w, h } = sizeOf(el); renderer.setSize(w, h, false);
  const cv = renderer.domElement; cv.className = "nc3d-cv"; cv.tabIndex = -1; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "360° панорама");
  el.appendChild(cv);
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(st.fov, w / h, 1, 1100);
  const geo = new T.SphereGeometry(500, 60, 40); geo.scale(-1, 1, 1);
  const mat = new T.MeshBasicMaterial({ color: 0xffffff }); const sph = new T.Mesh(geo, mat); scene.add(sph);
  function render() {
    if (st.dead) return; st.lat = Math.max(-85, Math.min(85, st.lat));
    const phi = T.MathUtils.degToRad(90 - st.lat), th = T.MathUtils.degToRad(st.lon);
    cam.fov = st.fov; cam.updateProjectionMatrix();
    cam.lookAt(500 * Math.sin(phi) * Math.cos(th), 500 * Math.cos(phi), 500 * Math.sin(phi) * Math.sin(th)); renderer.render(scene, cam);
    o.onView && o.onView({ lon: ((st.lon % 360) + 360) % 360, fov: st.fov });
  }
  function resize() { if (st.dead) return; const s = sizeOf(el); renderer.setSize(s.w, s.h, false); cam.aspect = s.w / s.h; render(); }
  const ro = window.ResizeObserver ? new ResizeObserver(resize) : null; if (ro) ro.observe(el);
  const onFs = () => setTimeout(resize, 60); document.addEventListener("fullscreenchange", onFs);
  const loader = new T.TextureLoader(); loader.setCrossOrigin("anonymous");
  function show(i) {
    const it = o.items[i]; if (!it) return; st.i = i; o.onLoading && o.onLoading(i);
    loader.load(it.url, (t) => {
      if (st.dead) { t.dispose(); return; }
      t.colorSpace = T.SRGBColorSpace; if (st.tex) st.tex.dispose(); st.tex = t; mat.map = t; mat.needsUpdate = true; st.lon = 0; st.lat = 0; render(); o.onShow && o.onShow(i);
    }, undefined, () => { if (!st.dead) o.onError && o.onError(i); });
  }
  /* поглед с плъзгане (мишка/пръст), мащаб с колелце/два пръста, клавиатура */
  const P = new Map(); let base = null;
  const pd = (e) => { cv.setPointerCapture && cv.setPointerCapture(e.pointerId); P.set(e.pointerId, { x: e.clientX, y: e.clientY }); base = { lon: st.lon, lat: st.lat, fov: st.fov, pts: [...P.values()].map((p) => ({ ...p })) }; stopAuto(); };
  const pm = (e) => {
    if (!P.has(e.pointerId)) return; P.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...P.values()], r = cv.getBoundingClientRect(), k = 100 / Math.max(200, r.width) * (st.fov / 75) * 1.6;
    if (pts.length >= 2 && base.pts.length >= 2) { const d0 = Math.hypot(base.pts[0].x - base.pts[1].x, base.pts[0].y - base.pts[1].y), d1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); st.fov = Math.max(30, Math.min(95, base.fov * (d0 / Math.max(1, d1)))); render(); return; }
    st.lon = base.lon - (pts[0].x - base.pts[0].x) * k; st.lat = base.lat + (pts[0].y - base.pts[0].y) * k; render();
  };
  const pu = (e) => { P.delete(e.pointerId); base = { lon: st.lon, lat: st.lat, fov: st.fov, pts: [...P.values()].map((p) => ({ ...p })) }; };
  const wh = (e) => { e.preventDefault(); st.fov = Math.max(30, Math.min(95, st.fov + (e.deltaY > 0 ? 4 : -4))); render(); stopAuto(); };
  cv.style.touchAction = "none"; cv.addEventListener("pointerdown", pd); cv.addEventListener("pointermove", pm); cv.addEventListener("pointerup", pu); cv.addEventListener("pointercancel", pu); cv.addEventListener("wheel", wh, { passive: false });
  function stopAuto() { if (st.auto) { clearInterval(st.auto.sw); cancelAnimationFrame(st.auto.raf); st.auto = null; o.onAuto && o.onAuto(false); } }
  const out = {
    show, look(dl, dt) { st.lon += dl; st.lat += dt || 0; render(); }, zoom(d) { st.fov = Math.max(30, Math.min(95, st.fov + d)); render(); },
    reset() { st.lon = 0; st.lat = 0; st.fov = 75; render(); }, fullscreen() { fsToggle(el, resize); }, index: () => st.i,
    auto(on) {
      stopAuto(); if (!on || o.items.length < 2) return;
      const a = { sw: setInterval(() => show((st.i + 1) % o.items.length), 12000), raf: 0 };
      if (!RM()) { let t0 = performance.now(); const spin = (t) => { if (st.dead || !st.auto) return; st.lon += (t - t0) * 0.006; t0 = t; render(); a.raf = requestAnimationFrame(spin); }; a.raf = requestAnimationFrame(spin); }
      st.auto = a; o.onAuto && o.onAuto(true);
    },
    destroy() { if (el._ncEsc) { document.removeEventListener("keydown", el._ncEsc, true); el._ncEsc = null; } el.classList.remove("fs"); st.dead = true; stopAuto(); if (ro) ro.disconnect(); document.removeEventListener("fullscreenchange", onFs); cv.removeEventListener("wheel", wh); if (st.tex) st.tex.dispose(); geo.dispose(); mat.dispose(); renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); cv.remove(); }
  };
  show(st.i);
  return out;
}
