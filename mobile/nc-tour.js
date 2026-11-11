/* ИМОТИ НАДЕЖДА · TASK-010 · 360° панорама и реална 3D разходка на апартамент (ES модул; зарежда се само при отваряне на раздела).
   Два ОТДЕЛНИ режима с ясни надписи:
     • „360° панорама“ – истински равноправоъгълни панорами (2:1) по стаи: поглед с мишка/пръст/стрелки, мащаб с колелото/два пръста,
       преходи само през реални врати (от геометрията), миниатюри, мини-карта с текущата точка и посока, цял екран, автоматична разходка.
     • „3D разходка“ – истинска 3D сцена (стени, отвори, височини от проверената геометрия + примерно обзавеждане): свободно ходене
       с колизия по проверената решетка, клавиатура (стрелки/WASD), мишка (поглед, колело – напред/назад, двоен клик – „отиди дотук“),
       пръст (джойстик + поглед + докосване на пода), смяна на стая, начална точка, цял екран, щадящо движение при „reduced motion“.
   Не е видео и не е набор от снимки. Илюстрации (ph28/ph36/ph38/ph40) се показват само в празни състояния и инфо панели – никога в прегледа.
   Рендериране при нужда (без постоянен цикъл), пауза при скрит раздел, освобождаване на GPU ресурсите при напускане.
   Публичен адрес на панорамата: /pano/<обект>/<n> (подписан за 60 s; за капариран/продаден няма файл). Без външни CDN – three.js е локален. */
import * as T from "/mobile/vendor/three/r187/nd-three-tour.min.js";

export const VERSION = "nc-tour@1";
const RM = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const COARSE = () => !!(window.matchMedia && matchMedia("(pointer:coarse)").matches);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const wrap360 = (d) => ((d % 360) + 360) % 360;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nf = (n, d) => (n == null || !isFinite(Number(n)) ? null : new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n)).replace(/[  ]/g, " "));
const m2 = (n) => (nf(n, 2) ? nf(n, 2) + " м²" : "—");
const ST = { free: "Свободен", reserved: "Капариран", sold: "Продаден" };
const ROOM_BG = { living: "Дневна", living_kitchen: "Дневна с кухня", kitchen: "Кухня", dining: "Трапезария", bedroom: "Спалня", child: "Детска стая", office: "Кабинет", bathroom: "Баня", wc: "Тоалетна", hall: "Входно антре", corridor: "Коридор", storage: "Килер", laundry: "Мокро помещение", terrace: "Тераса", other: "Помещение" };
const ICON = {
  r360: '<path d="M4 12c0-2.5 3.6-4.5 8-4.5s8 2 8 4.5-3.6 4.5-8 4.5"/><path d="M9.5 14.5 12 16.5 9.5 18.5"/><path d="M12 3.5v2M5 5.5l1.2 1.2M19 5.5l-1.2 1.2"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="m9 21 2-6 3 3v5"/><path d="M7 12l3-4 4 1 3 4"/><path d="m10 8-2 6"/>',
  fs: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  plan: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h7v9M10 3v6h11M15 12v9"/>', up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>', play: '<path d="M7 4v16l13-8z"/>', pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  arrow: '<path d="M4 15 12 7l8 8"/><path d="M4 20l8-8 8 8"/>', zin: '<circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M20 20l-4-4"/>', zout: '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-4-4"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  umbrella: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v7a2 2 0 0 0 4 0"/>', grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'
};
const ic = (n) => '<svg class="ntr-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICON[n] || "") + "</svg>";

export function webglOk() { try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; } }
const dpr = () => Math.min(window.devicePixelRatio || 1, COARSE() ? 1.5 : 2);
/* посока по плана (bearing от +y на плана, по часовника) → свят на three.js: X = x на плана, -Z = y на плана, Y = нагоре */
function dir3(yawDeg, pitchDeg) { const y = rad(yawDeg), p = rad(pitchDeg); return new T.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)); }
function pip(pt, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function unrle(runs, n) { const g = new Uint8Array(n); let k = 0, v = 0; for (const r of runs) { if (v) g.fill(1, k, Math.min(n, k + r)); k += r; v ^= 1; } return g; }
function disposeTree(o) { o.traverse((x) => { if (x.geometry) x.geometry.dispose(); const ms = x.material ? (Array.isArray(x.material) ? x.material : [x.material]) : []; ms.forEach((m) => { Object.keys(m).forEach((k) => { if (m[k] && m[k].isTexture) m[k].dispose(); }); if (m.uniforms) Object.values(m.uniforms).forEach((u) => { if (u && u.value && u.value.isTexture) u.value.dispose(); }); m.dispose(); }); }); }
function fsToggle(el, after) {
  const on = () => { el.classList.add("ntr-fs"); after && after(); }, off = () => { el.classList.remove("ntr-fs"); after && after(); };
  if (document.fullscreenElement === el) { document.exitFullscreen().catch(() => {}); return; }
  if (el.classList.contains("ntr-fs")) { off(); return; }
  if (el.requestFullscreen) el.requestFullscreen().then(() => after && setTimeout(after, 60)).catch(on); else on();
}

/* ---------------- 1. 3D сцена от nd.scene.v1 (обща за разходката и за рендера на панорами) ---------------- */
function patternCanvas(m) {
  const px = m.tex_px || 0; if (!px || m.pattern === "plain") return null;
  const c = document.createElement("canvas"); c.width = c.height = px; const g = c.getContext("2d");
  const base = new T.Color(m.color), hex = (k) => "#" + base.clone().multiplyScalar(k).getHexString();
  g.fillStyle = m.color; g.fillRect(0, 0, px, px);
  if (m.pattern === "planks") { const rows = 4; for (let r = 0; r < rows; r++) { g.fillStyle = hex(0.92 + ((r * 37) % 9) / 80); g.fillRect(0, (r * px) / rows, px, px / rows - 1); g.fillStyle = hex(0.7); g.fillRect(0, ((r + 1) * px) / rows - 1, px, 1); const off = ((r * 53) % 7) / 7 * px; g.fillRect(off, (r * px) / rows, 1, px / rows); } }
  else if (m.pattern === "herringbone") { g.strokeStyle = hex(0.72); g.lineWidth = Math.max(1, px / 128); for (let k = -px; k < px * 2; k += px / 4) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + px, px); g.stroke(); g.beginPath(); g.moveTo(k + px / 8, px); g.lineTo(k + px / 8 + px, 0); g.stroke(); } }
  else if (m.pattern === "tiles") { g.fillStyle = hex(0.78); g.fillRect(0, 0, px, Math.max(1, px / 64)); g.fillRect(0, 0, Math.max(1, px / 64), px); }
  else if (m.pattern === "grain" || m.pattern === "fabric") { const step = m.pattern === "fabric" ? 2 : 4; for (let y = 0; y < px; y += step) { g.fillStyle = hex(0.93 + (((y * 131) % 17) / 170)); g.fillRect(0, y, px, step / 2); } }
  return c;
}
function makeMaterials(scene) {
  const defs = (scene.materials && scene.materials.defs) || {}, cache = {}, texs = [];
  const get = (id, rep) => {
    const key = id + "|" + (rep || 1); if (cache[key]) return cache[key];
    const m = defs[id] || { color: "#cccccc", roughness: 0.9, metalness: 0 };
    const mat = new T.MeshStandardMaterial({ color: new T.Color(m.color), roughness: m.roughness == null ? 0.85 : m.roughness, metalness: m.metalness || 0, transparent: m.opacity != null, opacity: m.opacity == null ? 1 : m.opacity });
    const cv = patternCanvas(m);
    if (cv) { const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; const s = 1 / (m.scale_m || 1); t.repeat.set(s, s); mat.map = t; mat.color.set(0xffffff); texs.push(t); }
    if (m.opacity != null) mat.depthWrite = false;
    return (cache[key] = mat);
  };
  return { get, slot: (slot) => get((scene.materials.slots || {})[slot] || "plaster_white"), texs };
}
/* строи групата на апартамента; връща { group, floors[], rooms } */
export function buildScene3D(scene) {
  const A = scene.architecture, group = new T.Group(), M = makeMaterials(scene), floors = [];
  const H = (room) => (room && isFinite(room.height_m) ? room.height_m : isFinite(A.default_height_m) ? A.default_height_m : 2.7);
  const surf = (k, fb) => M.get((scene.materials.surfaces || {})[k] || fb);
  /* под и таван по стаи */
  A.rooms.forEach((r) => {
    const sh = new T.Shape(r.polygon.map((p) => new T.Vector2(p[0], p[1])));
    const g = new T.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
    const f = new T.Mesh(g, surf("room:" + r.id + ":floor", "oak_planks")); f.userData.room = r.id; f.userData.floor = true; group.add(f); floors.push(f);
    if (r.type !== "terrace") { const c = new T.Mesh(g.clone(), surf("room:" + r.id + ":ceiling", "ceiling_white").clone()); c.material.side = T.BackSide; c.position.y = H(r); group.add(c); }
  });
  const roomAt = (x, y) => A.rooms.find((r) => pip([x, y], r.polygon));
  const wallMat = (room) => (room ? surf("room:" + room.id + ":wall", "plaster_white") : M.get("plaster_white"));
  const glass = M.get("glass");
  /* стени на парчета около отворите (врати – празни, прозорци – стъкло, над и под тях – зид) */
  A.walls.forEach((w) => {
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]); if (L < 0.01) return;
    const ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L, nx = -uy, ny = ux, t = w.thickness_m;
    const near = A.rooms.filter((r) => { for (const s of [1, -1]) { const m = [(w.a[0] + w.b[0]) / 2 + nx * s * (t / 2 + 0.15), (w.a[1] + w.b[1]) / 2 + ny * s * (t / 2 + 0.15)]; if (pip(m, r.polygon)) return true; } return false; });
    const wh = isFinite(w.height_m) ? w.height_m : Math.max(2.0, ...near.filter((r) => r.type !== "terrace").map(H), near.length ? 0 : H(null));
    const os = A.openings.filter((o) => o.wall === w.id).sort((a, b) => a.offset_m - b.offset_m);
    const piece = (s0, s1, z0, z1) => {
      if (s1 - s0 < 0.005 || z1 - z0 < 0.005) return;
      const cx = w.a[0] + ux * (s0 + s1) / 2, cy = w.a[1] + uy * (s0 + s1) / 2;
      const ra = roomAt(cx + nx * (t / 2 + 0.05), cy + ny * (t / 2 + 0.05)), rb = roomAt(cx - nx * (t / 2 + 0.05), cy - ny * (t / 2 + 0.05));
      const edge = wallMat(ra || rb);
      /* страните на кутията: +x/-x (краищата), +y/-y (горе/долу), +z/-z (двете лица на стената) */
      const mats = [edge, edge, edge, edge, wallMat(rb), wallMat(ra)];
      const g = new T.BoxGeometry(s1 - s0, z1 - z0, t);
      const mesh = new T.Mesh(g, mats);
      mesh.position.set(cx, (z0 + z1) / 2, -cy); mesh.rotation.y = Math.atan2(uy, ux);
      mesh.userData.wall = w.id; group.add(mesh);
    };
    let s = 0;
    os.forEach((o) => {
      piece(s, o.offset_m, 0, wh);
      const sill = o.sill_m || 0, top = Math.min(wh, sill + o.height_m);
      piece(o.offset_m, o.offset_m + o.width_m, top, wh);
      if (sill > 0) piece(o.offset_m, o.offset_m + o.width_m, 0, sill);
      if (o.type === "window" || o.type === "balcony_door") {
        const cx = w.a[0] + ux * (o.offset_m + o.width_m / 2), cy = w.a[1] + uy * (o.offset_m + o.width_m / 2);
        if (o.type === "window") { const pg = new T.Mesh(new T.PlaneGeometry(o.width_m, top - sill), glass); pg.position.set(cx, (sill + top) / 2, -cy); pg.rotation.y = Math.atan2(uy, ux); pg.material.side = T.DoubleSide; group.add(pg); }
        const fr = M.get("metal_black"), bar = new T.Mesh(new T.BoxGeometry(o.width_m, 0.05, t * 0.6), fr); bar.position.set(cx, top - 0.025, -cy); bar.rotation.y = Math.atan2(uy, ux); group.add(bar);
      }
      s = Math.max(s, o.offset_m + o.width_m);
    });
    piece(s, L, 0, wh);
  });
  /* примерни мебели – кутии в реален мащаб от библиотеката (части в локални координати) */
  const box = new T.BoxGeometry(1, 1, 1);
  (scene.furniture || []).forEach((f) => {
    const parts = scene.assets && scene.assets[f.asset];
    const gr = new T.Group(); gr.position.set(f.x, 0, -f.y); gr.rotation.y = -rad(f.rot);
    (parts || [[0, 0, 0, f.w, f.d, f.h, "wood"]]).forEach((p) => { const m = new T.Mesh(box, M.slot(p[6])); m.scale.set(p[3], Math.max(0.005, p[5]), p[4]); m.position.set(p[0], p[2] + p[5] / 2, -p[1]); gr.add(m); });
    gr.userData.furniture = f.id; group.add(gr);
  });
  /* неутрален фон: небе-градиент около апартамента и земя (не е реалната гледка) */
  const bd = scene.backdrop || {}, cols = bd.colors || { top: "#dfe7ee", horizon: "#f3efe9", ground: "#cfc6ba" };
  const cv = document.createElement("canvas"); cv.width = 4; cv.height = 256; const g2 = cv.getContext("2d"), gr2 = g2.createLinearGradient(0, 0, 0, 256);
  gr2.addColorStop(0, cols.top); gr2.addColorStop(0.55, cols.horizon); gr2.addColorStop(0.62, cols.ground); gr2.addColorStop(1, cols.ground); g2.fillStyle = gr2; g2.fillRect(0, 0, 4, 256);
  const st = new T.CanvasTexture(cv); st.colorSpace = T.SRGBColorSpace;
  const xs = A.rooms.flatMap((r) => r.polygon.map((p) => p[0])), ys = A.rooms.flatMap((r) => r.polygon.map((p) => p[1]));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const sky = new T.Mesh(new T.SphereGeometry(80, 32, 16), new T.MeshBasicMaterial({ map: st, side: T.BackSide, depthWrite: false }));
  sky.position.set(cx, 0, -cy); group.add(sky);
  const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshBasicMaterial({ color: new T.Color(cols.ground) })); ground.rotation.x = -Math.PI / 2; ground.position.set(cx, -0.06, -cy); group.add(ground);
  /* светлина */
  /* физически светлини (three r155+): разсеяната светлина се дели на π – множителят K я връща към замисленото ниво на сцената */
  const L = scene.lighting || {}, lights = [], K = 2.6;
  const amb = new T.AmbientLight(0xffffff, K * 0.55 * ((L.ambient && L.ambient.intensity) || 0.35)); group.add(amb); lights.push(amb);
  const hemi = new T.HemisphereLight(new T.Color((L.hemisphere && L.hemisphere.sky) || "#fffaf2"), new T.Color((L.hemisphere && L.hemisphere.ground) || "#b9a58f"), K * 0.6 * ((L.hemisphere && L.hemisphere.intensity) || 0.75)); group.add(hemi);
  if (L.sun) { const s = new T.DirectionalLight(new T.Color(L.sun.color || "#fff1dc"), K * 0.5 * (L.sun.intensity || 1.2)), d = dir3(L.sun.bearing_plan || 180, L.sun.elevation_deg || 38); s.position.set(cx + d.x * 30, d.y * 30, -cy + d.z * 30); s.target.position.set(cx, 0, -cy); group.add(s); group.add(s.target); }
  const point = new T.PointLight(0xfff0dc, 0, 9, 1.6); group.add(point);
  const setRoomLight = (roomId) => { const l = (L.rooms || []).find((x) => x.room_id === roomId); if (!l) { point.intensity = 0; return; } point.color.set(l.color || "#fff0dc"); point.intensity = 2.4 * (l.intensity || 1); point.position.set(l.x, l.z, -l.y); };
  return { group, floors, setRoomLight, center: [cx, cy], textures: M.texs };
}
/* ---------------- 2. Рендер на 360° панорами от СЪЩАТА сцена (в браузъра на администратора) ----------------
   За всяка гледна точка: CubeCamera (6 лица) → шейдър cube→равноправоъгълна (u = 0.5 е север на плана, yaw_offset = 0) → JPEG.
   Отказва се при липса на WebGL. Ресурсите се освобождават след всяка стая; отмяната е между стаите. */
export async function renderPanoramas(scene, o) {
  const opt = o || {}, W = opt.width || 2048, Hh = W / 2, face = Math.max(256, Math.min(2048, W / 4));
  const nodes = (scene.navigation.nodes || []).filter((n) => !opt.rooms || opt.rooms.includes(n.room_id));
  const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: false, alpha: false });
  renderer.setPixelRatio(1); renderer.setSize(8, 8, false); renderer.toneMapping = T.NoToneMapping;
  const max = renderer.capabilities.maxTextureSize; if (max < W) { renderer.dispose(); throw new Error("Устройството поддържа до " + max + " px текстура – изберете по-малък размер"); }
  const sc = new T.Scene(), built = buildScene3D(scene); sc.add(built.group);
  const cubeRT = new T.WebGLCubeRenderTarget(face, { type: T.UnsignedByteType, generateMipmaps: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
  const cubeCam = new T.CubeCamera(0.05, 200, cubeRT); sc.add(cubeCam);
  const rt = new T.WebGLRenderTarget(W, Hh, { type: T.UnsignedByteType, format: T.RGBAFormat, depthBuffer: false });
  const quadMat = new T.ShaderMaterial({ uniforms: { cube: { value: cubeRT.texture }, yaw0: { value: 0 } }, depthTest: false, depthWrite: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: "uniform samplerCube cube; uniform float yaw0; varying vec2 vUv; const float PI = 3.141592653589793;" +
      "vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }" +
      "void main(){ float yaw = yaw0 + (vUv.x - 0.5) * 2.0 * PI; float pitch = (vUv.y - 0.5) * PI; vec3 d = vec3(sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch)); gl_FragColor = vec4(toSRGB(textureCube(cube, d).rgb), 1.0); }" });
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), quadMat), qs = new T.Scene(), qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1); qs.add(quad);
  /* платно в паметта (willReadFrequently – без копие в GPU) и асинхронно четене на пикселите (WebGL2), за да не спира графичния процесор */
  const px = new Uint8Array(W * Hh * 4), canvas = document.createElement("canvas"); canvas.width = W; canvas.height = Hh; const g = canvas.getContext("2d", { willReadFrequently: true }), img = g.createImageData(W, Hh);
  const readPx = (r) => (renderer.capabilities.isWebGL2 && renderer.readRenderTargetPixelsAsync ? renderer.readRenderTargetPixelsAsync(r, 0, 0, W, Hh, px) : Promise.resolve(renderer.readRenderTargetPixels(r, 0, 0, W, Hh, px)));
  const out = [];
  try {
    for (const n of nodes) {
      if (opt.signal && opt.signal.aborted) break;
      built.setRoomLight(n.room_id);
      cubeCam.position.set(n.x, n.eye_h || 1.6, -n.y); cubeCam.update(renderer, sc);
      renderer.setRenderTarget(rt); renderer.render(qs, qc); renderer.setRenderTarget(null); await readPx(rt);
      for (let y = 0; y < Hh; y++) img.data.set(px.subarray((Hh - 1 - y) * W * 4, (Hh - y) * W * 4), y * W * 4);
      g.putImageData(img, 0, 0);
      const blob = await new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("JPEG не се създаде"))), "image/jpeg", opt.quality || 0.9));
      const item = { room_id: n.room_id, node: n.id, blob, width: W, height: Hh };
      out.push(item); if (opt.onRoom) await opt.onRoom(item, out.length, nodes.length);
    }
  } finally {
    disposeTree(built.group); built.textures.forEach((t) => t.dispose()); cubeRT.dispose(); rt.dispose(); quad.geometry.dispose(); quadMat.dispose(); renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
  }
  return out;
}

/* ---------------- 3. Мини-карта (SVG от геометрията; за заключен обект не съществува) ---------------- */
function minimapSvg(mm, rooms, cur) {
  if (!mm || !mm.rooms || !mm.rooms.length) return "";
  const xs = mm.rooms.flatMap((r) => r.polygon.map((p) => p[0])), ys = mm.rooms.flatMap((r) => r.polygon.map((p) => p[1]));
  const x0 = Math.min(...xs) - 0.4, x1 = Math.max(...xs) + 0.4, y0 = Math.min(...ys) - 0.4, y1 = Math.max(...ys) + 0.4;
  const has = new Set(rooms.map((r) => r.room_id));
  const path = (p) => "M" + p.map((q) => q[0].toFixed(2) + " " + (y1 + y0 - q[1]).toFixed(2)).join("L") + "Z";
  return '<svg class="ntr-mm-svg" viewBox="' + [x0, y0, x1 - x0, y1 - y0].map((v) => v.toFixed(2)).join(" ") + '" role="img" aria-label="Мини-карта на апартамента">' +
    mm.rooms.map((r) => '<path class="ntr-mm-r' + (r.id === cur ? " cur" : "") + (has.has(r.id) ? " go" : "") + '" data-room="' + esc(r.id) + '" d="' + path(r.polygon) + '"><title>' + esc(r.name || ROOM_BG[r.type] || r.id) + "</title></path>").join("") +
    '<g class="ntr-mm-me" transform="translate(0 0)"><path class="ntr-mm-cone" d="M0 0 L-1.6 -2.8 A3.2 3.2 0 0 1 1.6 -2.8 Z"/><circle r="0.32"/></g></svg>';
}
function mmPlace(root, mm, x, y, yaw) {
  const g = root.querySelector(".ntr-mm-me"); if (!g || !mm) return;
  const ys = mm.rooms.flatMap((r) => r.polygon.map((p) => p[1])), y0 = Math.min(...ys) - 0.4, y1 = Math.max(...ys) + 0.4;
  g.setAttribute("transform", "translate(" + x.toFixed(2) + " " + (y1 + y0 - y).toFixed(2) + ") rotate(" + wrap360(yaw).toFixed(1) + ")");
}

/* ---------------- 4. 360° панорама ---------------- */
function panoViewer(stage, ctx) {
  const st = { dead: false, lon: 0, lat: 0, fov: 75, yaw0: 0, raf: 0, tex: null, anim: null, auto: null, loadTok: 0 };
  const renderer = new T.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(dpr());
  const cv = renderer.domElement; cv.className = "ntr-cv"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "360° панорама"); stage.prepend(cv);
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(st.fov, 1, 0.1, 100);
  const mat = new T.ShaderMaterial({ uniforms: { map: { value: null }, yaw0: { value: 0 }, fade: { value: 1 } }, side: T.BackSide, depthWrite: false,
    vertexShader: "varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform sampler2D map; uniform float yaw0; uniform float fade; varying vec3 vDir; const float PI = 3.141592653589793;" +
      "void main(){ vec3 d = normalize(vDir); float yaw = atan(d.x, -d.z); float pitch = asin(clamp(d.y, -1.0, 1.0)); vec2 uv = vec2(fract(0.5 + (yaw - yaw0) / (2.0 * PI)), 0.5 + pitch / PI);" +
      "vec3 c = texture2D(map, uv).rgb; gl_FragColor = vec4(c * fade, 1.0); }" });
  const sph = new T.Mesh(new T.SphereGeometry(10, 64, 32), mat); scene.add(sph);
  const maxTex = renderer.capabilities.maxTextureSize;
  function size() { const r = stage.getBoundingClientRect(), w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); return r; }
  function draw() {
    st.raf = 0; if (st.dead || !mat.uniforms.map.value) return;
    st.lat = clamp(st.lat, -85, 85); cam.fov = st.fov; cam.updateProjectionMatrix();
    cam.lookAt(dir3(st.lon, st.lat)); renderer.render(scene, cam);
    placeHotspots(); ctx.onView && ctx.onView(wrap360(st.lon), st.lat, st.fov);
  }
  const req = () => { if (!st.raf && !st.dead) st.raf = requestAnimationFrame(draw); };
  /* горещи точки: HTML бутони, позиционирани по посоката (yaw/pitch по плана) */
  const hsLayer = stage.querySelector(".ntr-hs");
  function placeHotspots() {
    const w = stage.clientWidth, h = stage.clientHeight;
    hsLayer.querySelectorAll("[data-hs]").forEach((b) => {
      const v = dir3(+b.dataset.yaw, +b.dataset.pitch).project(cam), behind = dir3(+b.dataset.yaw, +b.dataset.pitch).dot(dir3(st.lon, st.lat)) < 0.15;
      if (behind || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { b.style.display = "none"; return; }
      b.style.display = ""; b.style.transform = "translate(" + ((v.x + 1) / 2 * w).toFixed(1) + "px," + ((1 - v.y) / 2 * h).toFixed(1) + "px) translate(-50%,-50%)";
    });
  }
  function setHotspots(list, room) {
    hsLayer.innerHTML = (list || []).map((x) => '<button type="button" class="ntr-hsb' + (x.enabled === false ? " off" : "") + '" data-hs="' + esc(x.to_room) + '" data-yaw="' + (+x.yaw) + '" data-pitch="' + (+x.pitch) + '"' + (x.enabled === false ? ' aria-disabled="true" title="Няма панорама на това помещение"' : "") +
      ' aria-label="' + esc("Към " + x.label) + '"><span class="ntr-hs-arrow">' + ic("arrow") + "</span><span class=\"ntr-hs-lab\">" + esc(x.label) + "</span></button>").join("");
  }
  async function loadTexture(url) {
    const r = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
    if (!r.ok) throw new Error(r.status === 404 ? "Панорамата не е достъпна (може статусът да се е сменил)" : "Грешка " + r.status);
    const blob = await r.blob();
    /* ориентация: за ImageBitmap браузърите може да пренебрегнат UNPACK_FLIP_Y (по спецификация) – затова картината се обръща още при
       декодирането (imageOrientation: "flipY") и текстурата е с flipY = false. Така небето е горе във всеки браузър (Chrome, Chromium, Safari, Firefox). */
    let src = null, flipped = false;
    if (window.createImageBitmap) { try { src = await createImageBitmap(blob, { imageOrientation: "flipY" }); flipped = true; } catch (e) { src = null; } }
    if (!src) src = await new Promise((ok, no) => { const u = URL.createObjectURL(blob), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); ok(im); }; im.onerror = () => { URL.revokeObjectURL(u); no(new Error("Файлът не е изображение")); }; im.src = u; });
    if (Math.abs(src.width - 2 * src.height) > 2) { if (src.close) src.close(); throw new Error("Файлът не е равноправоъгълна панорама 2:1"); }
    if (src.width > maxTex) { const c = document.createElement("canvas"); c.width = maxTex; c.height = maxTex / 2; c.getContext("2d").drawImage(src, 0, 0, c.width, c.height); if (src.close) src.close(); src = c; }
    const t = new T.Texture(src); t.flipY = !flipped; t.colorSpace = T.NoColorSpace; t.wrapS = T.RepeatWrapping; t.wrapT = T.ClampToEdgeWrapping; t.minFilter = T.LinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  }
  /* смяна на помещение: запазва посоката на погледа (непрекъсната ориентация, панорамите са подравнени по плана) */
  async function show(room, url, keepLook) {
    const tok = ++st.loadTok; ctx.onLoading && ctx.onLoading(room);
    let t; try { t = await loadTexture(url); } catch (e) { if (tok === st.loadTok && !st.dead) ctx.onError && ctx.onError(e.message || String(e), room); return false; }
    if (st.dead || tok !== st.loadTok) { t.dispose(); return false; }
    const old = st.tex; st.tex = t; mat.uniforms.map.value = t; mat.uniforms.yaw0.value = rad(room.yaw_offset || 0); st.yaw0 = room.yaw_offset || 0;
    if (old) old.dispose();
    if (!keepLook) { st.lon = room.start_yaw != null ? room.start_yaw : room.yaw_offset || 0; st.lat = 0; }
    setHotspots(room.hotspots, room);
    if (!RM()) { const t0 = performance.now(); cancelAnimationFrame(st.anim); const step = (n) => { if (st.dead) return; const k = Math.min(1, (n - t0) / 380); mat.uniforms.fade.value = 0.25 + 0.75 * k; draw(); if (k < 1) st.anim = requestAnimationFrame(step); }; st.anim = requestAnimationFrame(step); }
    else { mat.uniforms.fade.value = 1; req(); }
    ctx.onShow && ctx.onShow(room); return true;
  }
  /* управление: мишка/пръст (плъзгане), колело и два пръста (мащаб), клавиатура */
  const P = new Map(); let base = null, moved = 0;
  const pd = (e) => { cv.setPointerCapture && cv.setPointerCapture(e.pointerId); P.set(e.pointerId, { x: e.clientX, y: e.clientY }); base = { lon: st.lon, lat: st.lat, fov: st.fov, pts: [...P.values()].map((p) => ({ ...p })) }; moved = 0; stopAuto(); ctx.onInteract && ctx.onInteract(); };
  const pm = (e) => {
    if (!P.has(e.pointerId)) return; P.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...P.values()], k = (st.fov / Math.max(200, stage.clientHeight));
    if (pts.length >= 2 && base.pts.length >= 2) { const d0 = Math.hypot(base.pts[0].x - base.pts[1].x, base.pts[0].y - base.pts[1].y), d1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); st.fov = clamp(base.fov * (d0 / Math.max(1, d1)), 30, 95); req(); return; }
    const dx = pts[0].x - base.pts[0].x, dy = pts[0].y - base.pts[0].y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
    st.lon = base.lon - dx * k; st.lat = base.lat + dy * k; req();
  };
  const pu = (e) => { P.delete(e.pointerId); base = { lon: st.lon, lat: st.lat, fov: st.fov, pts: [...P.values()].map((p) => ({ ...p })) }; };
  const wh = (e) => { e.preventDefault(); st.fov = clamp(st.fov + (e.deltaY > 0 ? 4 : -4), 30, 95); req(); stopAuto(); ctx.onInteract && ctx.onInteract(); };
  cv.style.touchAction = "none"; cv.addEventListener("pointerdown", pd); cv.addEventListener("pointermove", pm); cv.addEventListener("pointerup", pu); cv.addEventListener("pointercancel", pu); cv.addEventListener("wheel", wh, { passive: false });
  function stopAuto() { if (st.auto) { clearTimeout(st.auto.t); cancelAnimationFrame(st.auto.raf); st.auto = null; ctx.onAuto && ctx.onAuto(false); } }
  const ro = window.ResizeObserver ? new ResizeObserver(() => { size(); req(); }) : null; if (ro) ro.observe(stage);
  size();
  return {
    show, req, stopAuto,
    look(dl, dt) { st.lon += dl; st.lat += dt || 0; req(); }, zoom(d) { st.fov = clamp(st.fov + d, 30, 95); req(); },
    reset(room) { st.lon = room && room.start_yaw != null ? room.start_yaw : st.yaw0; st.lat = 0; st.fov = 75; req(); },
    view: () => ({ lon: wrap360(st.lon), lat: st.lat, fov: st.fov }),
    auto(on, next) {
      stopAuto(); if (!on) return;
      const a = { t: 0, raf: 0 }; st.auto = a; ctx.onAuto && ctx.onAuto(true);
      const cycle = () => { if (st.auto !== a || st.dead) return; a.t = setTimeout(() => { if (st.auto !== a) return; Promise.resolve(next()).then(cycle); }, RM() ? 6000 : 9000); };
      if (!RM()) { let t0 = performance.now(); const spin = (n) => { if (st.auto !== a || st.dead) return; st.lon += (n - t0) * 0.008; t0 = n; draw(); a.raf = requestAnimationFrame(spin); }; a.raf = requestAnimationFrame(spin); }
      cycle();
    },
    info: () => ({ textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, maxTex }),
    destroy() { st.dead = true; stopAuto(); cancelAnimationFrame(st.raf); cancelAnimationFrame(st.anim); if (ro) ro.disconnect(); cv.removeEventListener("wheel", wh); if (st.tex) st.tex.dispose(); sph.geometry.dispose(); mat.dispose(); renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); cv.remove(); hsLayer.innerHTML = ""; }
  };
}

/* ---------------- 5. 3D разходка ---------------- */
function walkViewer(stage, scene, ctx) {
  const st = { dead: false, raf: 0, x: 0, y: 0, yaw: 0, pitch: -4, fov: 70, keys: new Set(), joy: null, path: null, room: null, last: 0, moving: false };
  const nav = scene.navigation, grid = unrle(nav.rle, nav.w * nav.h), A = scene.architecture;
  const free = (x, y) => { const i = Math.floor((x - nav.x0) / nav.cell), j = Math.floor((y - nav.y0) / nav.cell); return i >= 0 && j >= 0 && i < nav.w && j < nav.h && grid[j * nav.w + i] === 1; };
  const renderer = new T.WebGLRenderer({ antialias: !COARSE(), powerPreference: "high-performance" }); renderer.setPixelRatio(dpr()); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NoToneMapping;
  const cv = renderer.domElement; cv.className = "ntr-cv"; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "3D разходка из апартамента"); stage.prepend(cv);
  const sc = new T.Scene(), built = buildScene3D(scene); sc.add(built.group);
  const cam = new T.PerspectiveCamera(st.fov, 1, 0.05, 300);
  const ray = new T.Raycaster();
  function size() { const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  const roomAt = (x, y) => A.rooms.find((r) => pip([x, y], r.polygon));
  function draw() {
    st.raf = 0; if (st.dead) return;
    const now = performance.now(), dt = Math.min(0.05, (now - (st.last || now)) / 1000); st.last = now;
    let fw = 0, sd = 0, turn = 0;
    if (st.keys.has("f")) fw += 1; if (st.keys.has("b")) fw -= 1; if (st.keys.has("sl")) sd -= 1; if (st.keys.has("sr")) sd += 1; if (st.keys.has("tl")) turn -= 1; if (st.keys.has("tr")) turn += 1;
    if (st.joy) { fw += -st.joy.y; sd += st.joy.x; }
    st.yaw = wrap360(st.yaw + turn * 90 * dt);
    if (st.path && st.path.length) { const p = st.path[0], dx = p[0] - st.x, dy = p[1] - st.y, d = Math.hypot(dx, dy); if (d < 0.06) st.path.shift(); else { const s = Math.min(d, 1.3 * dt); tryMove(dx / d * s, dy / d * s); st.yaw = wrap360(st.yaw + clamp((((deg(Math.atan2(dx, dy)) - st.yaw) % 360 + 540) % 360 - 180), -180 * dt, 180 * dt)); } }
    if (fw || sd) { const L = Math.hypot(fw, sd), sp = 1.4 * dt / Math.max(1, L), f = [Math.sin(rad(st.yaw)), Math.cos(rad(st.yaw))], r = [Math.cos(rad(st.yaw)), -Math.sin(rad(st.yaw))]; tryMove((f[0] * fw + r[0] * sd) * sp, (f[1] * fw + r[1] * sd) * sp); }
    cam.fov = st.fov; cam.updateProjectionMatrix(); cam.position.set(st.x, 1.6, -st.y); cam.lookAt(cam.position.clone().add(dir3(st.yaw, st.pitch)));
    renderer.render(sc, cam);
    const rm = roomAt(st.x, st.y); if (rm && rm.id !== st.room) { st.room = rm.id; built.setRoomLight(rm.id); ctx.onRoom && ctx.onRoom(rm.id); renderer.render(sc, cam); }
    ctx.onView && ctx.onView(st.x, st.y, st.yaw);
    st.moving = !!(fw || sd || turn || (st.path && st.path.length));
    if (st.moving) st.raf = requestAnimationFrame(draw); else st.last = 0;
  }
  const req = () => { if (!st.raf && !st.dead) st.raf = requestAnimationFrame(draw); };
  /* колизия: стъпки ≤ 4 см, плъзгане покрай стени (само проверени проходими клетки) */
  function tryMove(dx, dy) {
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.04)), sx = dx / n, sy = dy / n;
    for (let k = 0; k < n; k++) { if (free(st.x + sx, st.y + sy)) { st.x += sx; st.y += sy; } else if (free(st.x + sx, st.y)) st.x += sx; else if (free(st.x, st.y + sy)) st.y += sy; else { if (st.path) st.path = null; break; } }
  }
  function bfsPath(tx, ty) {
    const c = (x, y) => [Math.floor((x - nav.x0) / nav.cell), Math.floor((y - nav.y0) / nav.cell)], [si, sj] = c(st.x, st.y); let [ti, tj] = c(tx, ty);
    const ok = (i, j) => i >= 0 && j >= 0 && i < nav.w && j < nav.h && grid[j * nav.w + i] === 1;
    if (!ok(ti, tj)) { let best = null, bd = 1e9; for (let j = tj - 6; j <= tj + 6; j++) for (let i = ti - 6; i <= ti + 6; i++) if (ok(i, j)) { const d = Math.hypot(i - ti, j - tj); if (d < bd) { bd = d; best = [i, j]; } } if (!best) return null; [ti, tj] = best; }
    const prev = new Int32Array(nav.w * nav.h).fill(-1), q = [sj * nav.w + si]; prev[q[0]] = q[0];
    for (let k = 0; k < q.length; k++) { const cc = q[k], i = cc % nav.w, j = (cc - i) / nav.w; if (i === ti && j === tj) break; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ok(ii, jj) && prev[jj * nav.w + ii] < 0) { prev[jj * nav.w + ii] = cc; q.push(jj * nav.w + ii); } } }
    const end = tj * nav.w + ti; if (prev[end] < 0) return null;
    const out = []; for (let cc = end; cc !== prev[cc]; cc = prev[cc]) { const i = cc % nav.w, j = (cc - i) / nav.w; out.push([nav.x0 + (i + 0.5) * nav.cell, nav.y0 + (j + 0.5) * nav.cell]); }
    out.reverse(); return out.filter((p, k) => k % 3 === 2 || k === out.length - 1);
  }
  function go(x, y, yaw, instant) {
    if (instant || RM()) { st.x = x; st.y = y; if (yaw != null) st.yaw = yaw; st.path = null; st.last = 0; req(); return true; }
    const p = bfsPath(x, y); if (!p) return false; st.path = p; if (yaw != null) st._endYaw = yaw; req(); return true;
  }
  /* мишка: плъзгане – поглед; колело – напред/назад; двоен клик по пода – отиди дотук. Пръст: джойстик (вляво долу), плъзгане – поглед, докосване на пода – отиди. */
  const P = new Map(); let base = null, moved = 0, downAt = 0;
  const pd = (e) => { if (e.target !== cv) return; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); P.set(e.pointerId, { x: e.clientX, y: e.clientY }); base = { yaw: st.yaw, pitch: st.pitch, fov: st.fov, pts: [...P.values()].map((p) => ({ ...p })) }; moved = 0; downAt = performance.now(); ctx.onInteract && ctx.onInteract(); };
  const pm = (e) => {
    if (!P.has(e.pointerId)) return; P.set(e.pointerId, { x: e.clientX, y: e.clientY }); const pts = [...P.values()];
    if (pts.length >= 2 && base.pts.length >= 2) { const d0 = Math.hypot(base.pts[0].x - base.pts[1].x, base.pts[0].y - base.pts[1].y), d1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); st.fov = clamp(base.fov * (d0 / Math.max(1, d1)), 40, 90); req(); return; }
    const dx = pts[0].x - base.pts[0].x, dy = pts[0].y - base.pts[0].y, k = 70 / Math.max(240, stage.clientHeight); moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
    st.yaw = wrap360(base.yaw - dx * k); st.pitch = clamp(base.pitch + dy * k, -60, 45); st.path = null; req();
  };
  const floorHit = (e) => { const r = cv.getBoundingClientRect(); ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam); const h = ray.intersectObjects(built.floors, false)[0]; return h ? [h.point.x, -h.point.z] : null; };
  const pu = (e) => { const was = P.has(e.pointerId); P.delete(e.pointerId); base = { yaw: st.yaw, pitch: st.pitch, fov: st.fov, pts: [...P.values()].map((p) => ({ ...p })) }; if (was && e.pointerType !== "mouse" && moved < 8 && performance.now() - downAt < 350) { const p = floorHit(e); if (p) go(p[0], p[1]); } };
  const dbl = (e) => { const p = floorHit(e); if (p) go(p[0], p[1]); };
  const wh = (e) => { e.preventDefault(); const s = e.deltaY > 0 ? -0.35 : 0.35, f = [Math.sin(rad(st.yaw)), Math.cos(rad(st.yaw))]; st.path = null; tryMove(f[0] * s, f[1] * s); st.last = 0; req(); ctx.onInteract && ctx.onInteract(); };
  cv.style.touchAction = "none"; cv.addEventListener("pointerdown", pd); cv.addEventListener("pointermove", pm); cv.addEventListener("pointerup", pu); cv.addEventListener("pointercancel", pu); cv.addEventListener("dblclick", dbl); cv.addEventListener("wheel", wh, { passive: false });
  /* джойстик */
  const joy = stage.querySelector(".ntr-joy"), knob = joy && joy.querySelector("i");
  if (joy) {
    let jid = null;
    const jmove = (e) => { if (e.pointerId !== jid) return; const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2; let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const L = Math.hypot(dx, dy); if (L > 1) { dx /= L; dy /= L; } st.joy = { x: dx, y: dy }; knob.style.transform = "translate(" + dx * R * 0.6 + "px," + dy * R * 0.6 + "px)"; st.path = null; req(); };
    const jend = (e) => { if (e.pointerId !== jid) return; jid = null; st.joy = null; knob.style.transform = ""; };
    joy.addEventListener("pointerdown", (e) => { jid = e.pointerId; joy.setPointerCapture && joy.setPointerCapture(e.pointerId); jmove(e); ctx.onInteract && ctx.onInteract(); e.preventDefault(); });
    joy.addEventListener("pointermove", jmove); joy.addEventListener("pointerup", jend); joy.addEventListener("pointercancel", jend);
  }
  const ro = window.ResizeObserver ? new ResizeObserver(() => { size(); req(); }) : null; if (ro) ro.observe(stage);
  size();
  const start = nav.nodes.find((n) => n.id === nav.start) || nav.nodes[0];
  st.x = start.x; st.y = start.y; st.yaw = start.start_yaw || 0;
  return {
    req, go,
    key(k, on) { if (on) st.keys.add(k); else st.keys.delete(k); if (on) { st.path = null; st.last = 0; } req(); },
    room(id) { const n = nav.nodes.find((x) => x.room_id === id); if (!n) return false; return go(n.x, n.y, n.start_yaw); },
    reset() { st.pitch = -4; st.fov = 70; go(start.x, start.y, start.start_yaw || 0, true); },
    look(dy, dp) { st.yaw = wrap360(st.yaw + dy); st.pitch = clamp(st.pitch + (dp || 0), -60, 45); req(); },
    step(s) { const f = [Math.sin(rad(st.yaw)), Math.cos(rad(st.yaw))]; tryMove(f[0] * s, f[1] * s); st.last = 0; req(); },
    pos: () => ({ x: st.x, y: st.y, yaw: st.yaw, room: st.room, free: free(st.x, st.y) }),
    free, screenOf(x, y) { const v = new T.Vector3(x, 0.02, -y).project(cam), r = cv.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, z: v.z }; },
    info: () => ({ textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    destroy() { st.dead = true; cancelAnimationFrame(st.raf); if (ro) ro.disconnect(); cv.removeEventListener("wheel", wh); cv.removeEventListener("dblclick", dbl); disposeTree(built.group); built.textures.forEach((t) => t.dispose()); renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); cv.remove(); }
  };
}

/* ---------------- 6. Модел: нормализиране на данните от източника ---------------- */
function normalize(t) {
  const m = Object.assign({ rooms: [], scene: null, minimap: null, labels: {}, locked: false }, t || {});
  m.rooms = (m.rooms || []).map((r, i) => Object.assign({ n: i, name: r.name || ROOM_BG[r.type] || r.room_id, hotspots: [], yaw_offset: 0 }, r));
  const has = new Set(m.rooms.map((r) => r.room_id));
  m.rooms.forEach((r) => { r.hotspots = (r.hotspots || []).map((h) => Object.assign({}, h, { label: h.label || ((m.rooms.find((x) => x.room_id === h.to_room) || {}).name) || ROOM_BG[h.to_room] || h.to_room, enabled: has.has(h.to_room) })); });
  if (!m.minimap && m.scene) m.minimap = { north_deg: m.scene.architecture.north_deg, rooms: m.scene.architecture.rooms.map((r) => ({ id: r.id, name: r.name, type: r.type, polygon: r.polygon })) };
  return m;
}
/* публичен източник: nd_public_tour (за свободен обект в публикуван проект) + /pano/<обект>/<n>. rpc(name, args) идва от страницата. */
export function publicSource(o) {
  return {
    load: () => o.rpc("nd_public_tour", { p_unit_id: o.unitId }).then((r) => {
      if (r && r.nd_public_tour !== undefined) r = r.nd_public_tour;
      if (!r) return normalize({ unit: o.unit || null, empty: true });
      if (r.locked) return normalize({ unit: Object.assign({}, o.unit || {}, { status: r.status, code: r.code }), locked: true, status: r.status });
      const t = r.tour; if (!t) return normalize({ unit: o.unit || { code: r.code }, empty: true });
      return normalize({ unit: Object.assign({ code: r.code, status: r.status }, o.unit || {}), rooms: t.rooms, scene: t.scene, minimap: t.minimap, label: t.label, source_kind: t.source, version: t.version });
    }),
    panoUrl: (room) => Promise.resolve("/pano/" + encodeURIComponent(o.unitId) + "/" + room.n)
  };
}

/* ---------------- 7. Компонент ---------------- */
const IMG = (n) => (window.NC && NC.img ? NC.img(n) : (window.NC_TOUR_ASSETS || "/mobile/crm/assets/") + n);
export function mount(el, opts) {
  const o = Object.assign({ mode: "auto", staff: false }, opts || {});
  const S = { dead: false, model: null, mode: null, room: null, pano: null, walk: null, keyH: null, vis: true, auto: false, side: o.side || null };
  el.classList.add("ntr"); el.innerHTML = '<div class="ntr-st" role="status"><span class="ntr-spin" aria-hidden="true"></span><span>Зареждане на разходката…</span></div>';
  const $ = (s) => el.querySelector(s), $$ = (s) => [].slice.call(el.querySelectorAll(s));
  const sideRoot = () => S.side || el.querySelector(".ntr-side");
  /* мащаб на страницата: CRM/публичната страница на TASK-008 мащабира платното с CSS zoom – всички размери тук са в px на компонента */
  const zoomOf = (n) => { const r = n.getBoundingClientRect(); return n.offsetWidth && r.width ? r.width / n.offsetWidth : 1; };
  function scrollBox(n) { for (let p = n.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY) && p.clientHeight > 0) return p; } return null; }
  function fit() {
    if (S.dead || !el.isConnected) return;
    const fsMode = el.classList.contains("ntr-fs") || document.fullscreenElement === el;
    /* на цял екран мащабът на платното се неутрализира, за да заеме целия екран */
    if (fsMode) { const pz = el.parentElement ? zoomOf(el.parentElement) : 1; const zz = Math.abs(pz - 1) > 0.01 ? String(+(1 / pz).toFixed(4)) : ""; if (el.style.zoom !== zz) el.style.zoom = zz; } else if (el.style.zoom) el.style.zoom = "";
    const z = zoomOf(el) || 1, vw = window.innerWidth, vh = window.innerHeight;
    const fs = clamp((vw < 600 ? 13 : clamp(vw / 92, 13, 18)) / z, 8, 90);
    el.style.setProperty("--ntr-fs", fs.toFixed(2) + "px"); if (S.side) S.side.style.setProperty("--ntr-fs", fs.toFixed(2) + "px");
    const wEm = el.clientWidth / fs, hosted = !!S.side, narrow = wEm < 44 && !(fsMode && vw > vh), wide = !narrow && wEm >= (hosted ? 46 : 62);
    el.classList.toggle("ntr-narrow", narrow); el.classList.toggle("ntr-wide", wide); el.classList.toggle("ntr-hosted", hosted);
    if (fsMode) { el.style.removeProperty("--ntr-h"); el.style.setProperty("--ntr-sh", "auto"); return; }
    /* височината: реално измереното видимо място в превъртащия се контейнер, под горния ръб на компонента (≤ видимата височина – винаги се побира цял) */
    const sb = scrollBox(el), r = el.getBoundingClientRect();
    let visH, topIn;
    if (sb) { const sr = sb.getBoundingClientRect(); visH = Math.min(vh, sr.bottom) - Math.max(0, sr.top); topIn = r.top - sr.top + sb.scrollTop * zoomOf(sb); }
    else { visH = vh; topIn = r.top + (window.scrollY || 0); }
    const avail = visH - Math.min(Math.max(0, topIn), visH * 0.5) - 10;
    if (narrow) { el.style.setProperty("--ntr-sh", Math.round(clamp(el.clientWidth * 0.8, 13 * fs, Math.max(13 * fs, (visH * 0.6) / z))) + "px"); el.style.removeProperty("--ntr-h"); }
    else { el.style.removeProperty("--ntr-sh"); el.style.setProperty("--ntr-h", Math.round(clamp(avail / z, 21 * fs, 1600)) + "px"); }
    fitSide();
  }
  /* кремавата карта да не е по-висока от прегледа: свива се само мини-картата (до 5em) */
  function fitSide() {
    const host = sideRoot(); if (!host) return;
    const svg = host.querySelector(".ntr-mm-svg"); if (!svg) return;
    svg.style.maxHeight = "";
    if (el.classList.contains("ntr-narrow") || el.classList.contains("ntr-fs") || document.fullscreenElement === el) return;
    const z = zoomOf(host) || 1, fs = parseFloat(el.style.getPropertyValue("--ntr-fs")) || 15;
    const over = S.side ? (host.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom) / z : host.scrollHeight - host.clientHeight;
    if (over > 1) svg.style.maxHeight = Math.round(Math.max(8 * fs, svg.getBoundingClientRect().height / z - over - 2)) + "px";
  }
  const onResize = () => fit();
  window.addEventListener("resize", onResize);
  let lastW = 0; const roEl = window.ResizeObserver ? new ResizeObserver(() => { const w = el.clientWidth; if (Math.abs(w - lastW) > 1) { lastW = w; fit(); } }) : null; if (roEl) roEl.observe(el);
  const onFs = () => setTimeout(() => { fit(); S.pano && S.pano.req(); S.walk && S.walk.req(); }, 80); document.addEventListener("fullscreenchange", onFs);
  const onVis = () => { S.vis = !document.hidden; if (document.hidden) { S.pano && S.pano.stopAuto(); } };
  document.addEventListener("visibilitychange", onVis);

  function status(msg, kind) { const s = $(".ntr-stage .ntr-st"); if (!s) return; s.hidden = !msg; s.className = "ntr-st" + (kind ? " " + kind : ""); s.innerHTML = msg ? (kind === "err" ? ic("info") : '<span class="ntr-spin" aria-hidden="true"></span>') + "<span>" + esc(msg) + "</span>" : ""; }
  function unitTitle(m) { const u = m.unit || {}; return "Апартамент " + (u.code || ""); }
  function roomById(id) { return S.model && S.model.rooms.find((r) => r.room_id === id); }
  function sceneRoomName(id) { const r = S.model && S.model.scene && S.model.scene.architecture.rooms.find((x) => x.id === id); return r ? r.name || ROOM_BG[r.type] || r.id : id; }

  /* празни и заключени състояния – илюстрациите са само тук, отбелязани като илюстрация */
  function emptyHtml(kind, m) {
    const u = (m && m.unit) || {};
    if (kind === "locked") return '<div class="ntr-empty locked" role="status"><div class="ntr-stamp ' + esc(u.status || "") + '">' + ic("lock") + "<b>" + esc(ST[u.status] || "Недостъпен") + "</b></div><h3>" + esc(unitTitle(m)) + " не е свободен</h3><p>Разходката, панорамите и мини-картата на капариран или продаден апартамент не се показват публично.</p>" + (o.onStaffView ? '<button type="button" class="ntr-btn" data-act="staffview">' + ic("lock") + "<span>Покажи (само за екипа)</span></button>" : "") + "</div>";
    if (kind === "nowebgl") return '<div class="ntr-empty" role="status"><h3>Браузърът не поддържа WebGL</h3><p>360° панорамата и 3D разходката изискват WebGL. Опитайте с друг браузър или устройство.</p></div>';
    const img = kind === "noscene" ? "nd/ph28.webp" : o.staff ? "nd/ph36.webp" : "nd/ph38.webp";
    const t = kind === "noscene" ? "3D разходка за " + (u.code || "апартамента") + " още няма" : "360° разходката за " + (u.code || "апартамента") + " още не е подготвена";
    const p = kind === "noscene" ? "Свободната 3D разходка се показва само от истинска 3D сцена върху проверената геометрия. Не показваме снимка или видео вместо нея." : "Тук се разглеждат истински 360° панорами по стаи – поглед във всички посоки, преходи през вратите, мини-карта и цял екран. Не показваме плоска снимка вместо панорама." + (o.staff ? " Панорамите се подготвят от раздела за екипа по-долу." : "");
    return '<div class="ntr-empty deco" role="status"><div class="ntr-empty-img" style="background-image:url(&quot;' + esc(IMG(img)) + '&quot;)" aria-hidden="true"></div><span class="ntr-ill">Илюстрация – не е този апартамент</span><div class="ntr-empty-t"><span class="ntr-tag">' + ic(kind === "noscene" ? "walk" : "r360") + (kind === "noscene" ? "3D разходка" : "360° панорама") + "</span><h3>" + esc(t) + "</h3><p>" + esc(p) + "</p></div></div>";
  }
  function sideHtml(m) {
    const u = m.unit || {}, has = m.rooms.length > 0;
    const sel = has || (m.scene && m.scene.architecture) ? '<label class="ntr-sel"><span class="ntr-sel-l">Избери помещение</span><select data-act="room" aria-label="Помещение">' + (S.mode === "walk" && m.scene ? m.scene.navigation.nodes.map((n) => '<option value="' + esc(n.room_id) + '">' + esc(sceneRoomName(n.room_id)) + "</option>").join("") : m.rooms.map((r) => '<option value="' + esc(r.room_id) + '">' + esc(r.name) + "</option>").join("")) + "</select>" + ic("down") + "</label>" : "";
    const mm = m.minimap ? '<div class="ntr-mm" title="Мини-карта: точката е мястото, конусът – посоката на погледа">' + minimapSvg(m.minimap, S.mode === "walk" && m.scene ? m.scene.navigation.nodes.map((n) => ({ room_id: n.room_id })) : m.rooms, S.room) + "</div>" : "";
    const rows = [["ruler", "Обща площ", m2(u.area_total)], ["grid", "Чиста площ", m2(u.area_net)], ["umbrella", "Тераса", m2(u.terrace_area)], ["sun", "Изложение", u.exposure || "—"]];
    const autoOk = S.mode === "pano" && m.rooms.length > 1;
    return '<div class="ntr-card">' + sel + mm + '<h4 class="ntr-ut">' + esc((u.code || "") + (u.rooms ? " – " + u.rooms + (u.rooms === 1 ? " стая" : " стаи") : "")) + "</h4>" +
      '<div class="ntr-rows">' + rows.map((x) => '<div class="ntr-row">' + ic(x[0]) + "<span>" + esc(x[1]) + "</span><b>" + esc(x[2]) + "</b></div>").join("") + "</div>" +
      (autoOk ? '<button type="button" class="ntr-btn hot ntr-auto" data-act="auto" aria-pressed="' + S.auto + '">' + ic(S.auto ? "pause" : "play") + "<span>" + (S.auto ? "Спри автоматичната разходка" : "Автоматична разходка") + "</span></button>" : "") +
      '<p class="ntr-note">' + esc(S.mode === "walk" ? "3D разходка: примерно обзавеждане, неутрален фон зад прозорците – не е реалната гледка." : m.label || "") + "</p></div>";
  }
  function thumbsHtml(m, vertical) {
    const list = S.mode === "walk" && m.scene ? m.scene.navigation.nodes.map((n) => ({ room_id: n.room_id, name: sceneRoomName(n.room_id), thumb: (roomById(n.room_id) || {}).thumb })) : m.rooms;
    return list.map((r) => '<button type="button" class="ntr-th" data-act="room" data-room="' + esc(r.room_id) + '" aria-current="' + (r.room_id === S.room) + '" aria-label="' + esc(r.name) + '">' +
      (r.thumb ? '<img src="' + esc(r.thumb) + '" alt="" decoding="async">' : '<span class="ntr-th-none">' + ic(S.mode === "walk" ? "walk" : "r360") + "</span>") + "<span>" + esc(r.name) + "</span></button>").join("");
  }
  function layout(m) {
    const modes = []; if (m.rooms.length) modes.push("pano"); if (m.scene && m.scene.navigation) modes.push("walk");
    const tag = S.mode === "walk" ? ic("walk") + "3D разходка" : ic("r360") + "360° панорама";
    const sw = modes.length > 1 ? '<div class="ntr-modes" role="group" aria-label="Режим">' + modes.map((k) => '<button type="button" data-act="mode" data-mode="' + k + '" aria-pressed="' + (S.mode === k) + '" aria-label="' + (k === "walk" ? "3D разходка" : "360° панорама") + '">' + ic(k === "walk" ? "walk" : "r360") + '<span class="ntr-ml">' + (k === "walk" ? "3D разходка" : "360° панорама") + '</span><span class="ntr-ms" aria-hidden="true">' + (k === "walk" ? "3D" : "360°") + "</span></button>").join("") + "</div>" : '<span class="ntr-tag">' + tag + "</span>";
    const help = S.mode === "walk" ? (COARSE() ? "Джойстик – ходене · плъзгане – поглед · докосни пода – отиди" : "Стрелки / W A S D – ходене · мишка – поглед · колело – напред · двоен клик – отиди дотук") : COARSE() ? "Плъзни – поглед · два пръста – мащаб · стрелките на пода – към съседната стая" : "Плъзни с мишката – поглед · колело – мащаб · стрелките на пода – към съседната стая";
    el.innerHTML = '<div class="ntr-wrap">' +
      '<div class="ntr-left" role="group" aria-label="Помещения"><button type="button" class="ntr-arr" data-act="tup" aria-label="Нагоре">' + ic("up") + '</button><div class="ntr-lst">' + thumbsHtml(m, true) + '</div><button type="button" class="ntr-arr" data-act="tdown" aria-label="Надолу">' + ic("down") + "</button></div>" +
      '<div class="ntr-main"><div class="ntr-stage" tabindex="0" role="application" aria-roledescription="' + (S.mode === "walk" ? "3D разходка" : "360° панорама") + '" aria-label="' + esc(unitTitle(m) + ". " + help) + '">' +
      '<div class="ntr-hs"></div><div class="ntr-top">' + sw + '<div class="ntr-lab"><b>' + esc(unitTitle(m)) + '</b><span class="ntr-lab-room"></span>' + (m.unit && m.unit.area_total ? "<span>" + esc(m2(m.unit.area_total)) + "</span>" : "") + "</div></div>" +
      '<div class="ntr-tools" role="group" aria-label="Управление">' + (S.mode === "pano" ? '<button type="button" data-act="zin" aria-label="Приближи" title="Приближи">' + ic("zin") + '</button><button type="button" data-act="zout" aria-label="Отдалечи" title="Отдалечи">' + ic("zout") + "</button>" : "") +
      '<button type="button" data-act="reset" aria-label="Начален поглед" title="Начален поглед">' + ic("home") + '</button><button type="button" data-act="plan" aria-label="Мини-карта" title="Мини-карта" aria-pressed="false">' + ic("plan") + '</button><button type="button" data-act="fs" aria-label="На цял екран" title="На цял екран">' + ic("fs") + "</button></div>" +
      (S.mode === "pano" ? '<div class="ntr-hint" aria-hidden="true">' + ic("r360") + "<b>360°</b></div>" : "") + (S.mode === "walk" ? '<div class="ntr-joy" aria-label="Джойстик за ходене" role="slider" aria-valuetext="ходене"><i></i></div>' : "") +
      '<div class="ntr-flmm" hidden></div><div class="ntr-help">' + esc(help) + '</div><div class="ntr-badge">' + esc(S.mode === "walk" ? "3D сцена · примерно обзавеждане · неутрален фон" : m.label || "360°") + '</div><div class="ntr-st" role="status" hidden></div></div>' +
      '<div class="ntr-strip" role="group" aria-label="Помещения"><button type="button" class="ntr-arr" data-act="sprev" aria-label="Предишни">' + ic("left") + '</button><div class="ntr-lst">' + thumbsHtml(m, false) + '</div><button type="button" class="ntr-arr" data-act="snext" aria-label="Следващи">' + ic("right") + "</button></div></div>" +
      (S.side ? "" : '<aside class="ntr-side" aria-label="Помещение и апартамент">' + sideHtml(m) + "</aside>") + "</div>";
    if (S.side) S.side.innerHTML = '<div class="ntr ntr-sidehost">' + sideHtml(m) + "</div>";
    fit();
  }
  function refreshSide() { const host = sideRoot(); if (!host) return; const html = sideHtml(S.model); if (S.side) S.side.innerHTML = '<div class="ntr ntr-sidehost">' + html + "</div>"; else host.innerHTML = html; bindSide(); markRoom(); fitSide(); }
  function markRoom() {
    const r = S.room, name = S.mode === "walk" ? sceneRoomName(r) : (roomById(r) || {}).name;
    const lab = $(".ntr-lab-room"); if (lab) lab.textContent = name || "";
    $$(".ntr-th").forEach((b) => { const on = b.dataset.room === r; b.setAttribute("aria-current", on); if (on && b.scrollIntoView && b.offsetParent) { const p = b.parentElement; if (p) { const vertical = p.parentElement.classList.contains("ntr-left"); if (vertical) p.scrollTop = b.offsetTop - p.clientHeight / 2 + b.clientHeight / 2; else p.scrollLeft = b.offsetLeft - p.clientWidth / 2 + b.clientWidth / 2; } } });
    const host = sideRoot(); if (host) { const s = host.querySelector("select[data-act=room]"); if (s && r) s.value = r; host.querySelectorAll(".ntr-mm-r").forEach((p) => p.classList.toggle("cur", p.dataset.room === r)); }
    el.querySelectorAll(".ntr-flmm .ntr-mm-r").forEach((p) => p.classList.toggle("cur", p.dataset.room === r));
    o.onRoom && o.onRoom(r);
  }
  function setView(x, y, yaw) { [sideRoot(), $(".ntr-flmm")].forEach((h) => h && mmPlace(h, S.model.minimap, x, y, yaw)); }

  /* режими */
  async function startPano(roomId) {
    destroyViewers(); const m = S.model, stage = $(".ntr-stage");
    S.pano = panoViewer(stage, {
      onLoading: (room) => status("Зареждане на " + room.name + "…"),
      onError: (msg) => status(msg + " – опитайте отново или изберете друго помещение.", "err"),
      onShow: (room) => { status(""); S.room = room.room_id; markRoom(); const n = room.node; if (n) { const v = S.pano.view(); setView(n.x, n.y, v.lon); } },
      onView: (lon) => { const r = roomById(S.room); if (r && r.node) setView(r.node.x, r.node.y, lon); },
      onAuto: (on) => { S.auto = on; const b = sideRoot() && sideRoot().querySelector("[data-act=auto]"); if (b) { b.setAttribute("aria-pressed", on); b.innerHTML = ic(on ? "pause" : "play") + "<span>" + (on ? "Спри автоматичната разходка" : "Автоматична разходка") + "</span>"; } },
      onInteract: () => { const h = $(".ntr-hint"); if (h) h.classList.add("gone"); }
    });
    await showRoom(roomId || (m.rooms[0] && m.rooms[0].room_id), false);
    prefetch();
  }
  async function showRoom(id, keep) {
    const r = roomById(id); if (!r || !S.pano) return false;
    let url; try { url = await o.source.panoUrl(r); } catch (e) { status("Панорамата не е достъпна: " + (e.message || e), "err"); return false; }
    return S.pano.show(r, url, keep);
  }
  /* зареждане: текущата стая веднага; съседните – само на компютър, след като текущата е показана (без да се държат в паметта на GPU) */
  function prefetch() {
    if (COARSE() || (navigator.connection && navigator.connection.saveData)) return;
    const cur = roomById(S.room); if (!cur) return;
    const ids = (cur.hotspots || []).filter((h) => h.enabled !== false).map((h) => h.to_room).slice(0, 3);
    setTimeout(() => ids.forEach((id) => { const r = roomById(id); if (r) o.source.panoUrl(r).then((u) => { if (/^\/pano\//.test(u)) return; const im = new Image(); im.decoding = "async"; im.src = u; }).catch(() => {}); }), 1200);
  }
  function startWalk(roomId) {
    destroyViewers(); const m = S.model, stage = $(".ntr-stage");
    try {
      S.walk = walkViewer(stage, m.scene, {
        onRoom: (id) => { S.room = id; markRoom(); },
        onView: (x, y, yaw) => setView(x, y, yaw),
        onInteract: () => {}
      });
    } catch (e) { status("3D сцената не се построи: " + (e.message || e), "err"); return; }
    if (roomId) S.walk.room(roomId);
    S.walk.req(); status("");
  }
  function destroyViewers() { if (S.pano) { try { S.pano.destroy(); } catch (e) { /* */ } S.pano = null; } if (S.walk) { try { S.walk.destroy(); } catch (e) { /* */ } S.walk = null; } S.auto = false; }
  async function setMode(k, roomId) {
    if (!S.model) return; if (k === "walk" && !(S.model.scene && S.model.scene.navigation)) k = "pano"; if (k === "pano" && !S.model.rooms.length) k = "walk";
    S.mode = k; const keep = roomId || S.room;
    destroyViewers(); layout(S.model); bindMain(); bindSide();
    if (k === "walk") startWalk(keep); else await startPano(keep && roomById(keep) ? keep : null);
    el.dataset.mode = k;
  }

  /* събития */
  function goRoom(id) {
    if (S.mode === "walk") { if (S.walk && !S.walk.room(id)) status("До това помещение няма проходим път в 3D", "err"); return; }
    if (S.pano) { S.pano.stopAuto(); showRoom(id, true).then(prefetch); }
  }
  function nextRoom() { const list = S.model.rooms, i = list.findIndex((r) => r.room_id === S.room); return showRoom(list[(i + 1) % list.length].room_id, false); }
  function bindMain() {
    el.onclick = (e) => {
      const b = e.target.closest("[data-act],[data-hs]"); if (!b || !el.contains(b)) return;
      if (b.hasAttribute("data-hs")) { if (b.getAttribute("aria-disabled") === "true") return; goRoom(b.getAttribute("data-hs")); return; }
      const a = b.dataset.act;
      if (a === "room") goRoom(b.dataset.room);
      else if (a === "mode") setMode(b.dataset.mode);
      else if (a === "fs") fsToggle(el, () => { fit(); S.pano && S.pano.req(); S.walk && S.walk.req(); });
      else if (a === "reset") { if (S.pano) S.pano.reset(roomById(S.room)); if (S.walk) S.walk.reset(); }
      else if (a === "zin") S.pano && S.pano.zoom(-8); else if (a === "zout") S.pano && S.pano.zoom(8);
      else if (a === "plan") { const f = $(".ntr-flmm"), on = f.hidden; f.hidden = !on; b.setAttribute("aria-pressed", on); if (on) { f.innerHTML = minimapSvg(S.model.minimap, S.model.rooms, S.room); } }
      else if (a === "tup" || a === "tdown") { const l = $(".ntr-left .ntr-lst"); l.scrollBy({ top: (a === "tup" ? -1 : 1) * l.clientHeight * 0.8, behavior: RM() ? "auto" : "smooth" }); }
      else if (a === "sprev" || a === "snext") { const l = $(".ntr-strip .ntr-lst"); l.scrollBy({ left: (a === "sprev" ? -1 : 1) * l.clientWidth * 0.8, behavior: RM() ? "auto" : "smooth" }); }
      else if (a === "staffview" && o.onStaffView) o.onStaffView();
    };
    const fm = $(".ntr-flmm"); if (fm) fm.onclick = (e) => { const p = e.target.closest(".ntr-mm-r"); if (p) goRoom(p.dataset.room); };
    const stage = $(".ntr-stage"); if (!stage) return;
    stage.onkeydown = (e) => {
      if (e.target !== stage) return; const k = e.key;
      if (S.mode === "pano" && S.pano) {
        const mv = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[k];
        if (mv) S.pano.look(mv[0], mv[1]); else if (k === "+" || k === "=") S.pano.zoom(-8); else if (k === "-" || k === "_") S.pano.zoom(8); else if (k === "0") S.pano.reset(roomById(S.room));
        else if (k === "PageDown" || k === "n") nextRoom(); else if (k === "f") fsToggle(el, fit); else return;
        e.preventDefault(); const h = $(".ntr-hint"); if (h) h.classList.add("gone");
      } else if (S.mode === "walk" && S.walk) {
        const m = { ArrowUp: "f", w: "f", W: "f", ArrowDown: "b", s: "b", S: "b", ArrowLeft: "tl", ArrowRight: "tr", a: "sl", A: "sl", d: "sr", D: "sr" }[k];
        if (m) { S.walk.key(m, true); e.preventDefault(); } else if (k === "0") { S.walk.reset(); e.preventDefault(); } else if (k === "f") { fsToggle(el, fit); e.preventDefault(); }
      }
    };
    stage.onkeyup = (e) => { if (S.mode !== "walk" || !S.walk) return; const m = { ArrowUp: "f", w: "f", W: "f", ArrowDown: "b", s: "b", S: "b", ArrowLeft: "tl", ArrowRight: "tr", a: "sl", A: "sl", d: "sr", D: "sr" }[e.key]; if (m) S.walk.key(m, false); };
    stage.onblur = () => { if (S.walk) ["f", "b", "tl", "tr", "sl", "sr"].forEach((k) => S.walk.key(k, false)); };
  }
  function bindSide() {
    const host = sideRoot(); if (!host) return;
    const s = host.querySelector("select[data-act=room]"); if (s) s.onchange = () => goRoom(s.value);
    const a = host.querySelector("[data-act=auto]"); if (a) a.onclick = () => { if (!S.pano) return; if (S.auto) S.pano.stopAuto(); else S.pano.auto(true, nextRoom); };
    const mm = host.querySelector(".ntr-mm"); if (mm) mm.onclick = (e) => { const p = e.target.closest(".ntr-mm-r"); if (p && p.classList.contains("go")) goRoom(p.dataset.room); else if (p && S.mode === "walk") goRoom(p.dataset.room); };
  }
  /* пауза, когато компонентът не се вижда */
  const io = window.IntersectionObserver ? new IntersectionObserver((es) => { es.forEach((x) => { if (!x.isIntersecting && S.pano) S.pano.stopAuto(); }); }) : null; if (io) io.observe(el);

  async function load() {
    let m;
    try { m = normalize(await o.source.load()); } catch (e) { el.innerHTML = '<div class="ntr-empty" role="status"><h3>Разходката не се зареди</h3><p>' + esc(e.message || e) + '</p><button type="button" class="ntr-btn" data-act="retry">Опитай отново</button></div>'; el.onclick = (ev) => { if (ev.target.closest("[data-act=retry]")) load(); }; return; }
    if (S.dead) return;
    if (o.unit) m.unit = Object.assign({}, m.unit || {}, o.unit);
    S.model = m;
    if (m.locked) { el.innerHTML = emptyHtml("locked", m); if (S.side) S.side.innerHTML = ""; bindMain(); return; }
    if (!m.rooms.length && !(m.scene && m.scene.navigation)) { el.innerHTML = emptyHtml("empty", m); if (S.side) S.side.innerHTML = ""; bindMain(); return; }
    if (!webglOk()) { el.innerHTML = emptyHtml("nowebgl", m); return; }
    const want = o.mode === "walk" || (o.mode === "auto" && !m.rooms.length) ? "walk" : "pano";
    await setMode(want, o.room || null);
  }
  load();
  return {
    destroy() { S.dead = true; destroyViewers(); if (io) io.disconnect(); if (roEl) roEl.disconnect(); el.style.zoom = ""; ['--ntr-h', '--ntr-sh', '--ntr-fs'].forEach((k) => el.style.removeProperty(k)); window.removeEventListener("resize", onResize); document.removeEventListener("fullscreenchange", onFs); document.removeEventListener("visibilitychange", onVis); el.onclick = null; el.innerHTML = ""; el.classList.remove("ntr", "ntr-fs", "ntr-narrow", "ntr-wide", "ntr-hosted"); if (S.side) S.side.innerHTML = ""; },
    reload: load, setMode, goRoom, fit,
    state: () => ({ mode: S.mode, room: S.room, auto: S.auto, pano: S.pano ? S.pano.view() : null, walk: S.walk ? S.walk.pos() : null, gpu: S.pano ? S.pano.info() : S.walk ? S.walk.info() : null, rooms: S.model ? S.model.rooms.length : 0 }),
    _walk: () => S.walk, _pano: () => S.pano
  };
}
