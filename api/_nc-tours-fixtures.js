// ИМОТИ НАДЕЖДА · TASK-010 · САМО ЗА ТЕСТОВЕ – служебни (TEST) геометрии на два апартамента с различно разпределение.
// Не са реални апартаменти, не се записват в живата база и не се показват на публиката. Използват се от api/_nc-tours*.test.js
// и от локалния тестов стенд. Размерите са в метри; north_deg = посоката на +y на плана спрямо севера.
"use strict";

const ext = 0.3, int = 0.12, rail = 0.08;
/* TEST-A1 – двустаен, правоъгълен: дневна с кухня, спалня, баня, антре, килер, тераса (юг) */
function testA1() {
  return {
    schema: "nd.unit_geometry.v1", units: "m", north_deg: 180, default_height_m: 2.7, entrance: "entr",
    rooms: [
      { id: "living", name: "Дневна с кухня", type: "living_kitchen", polygon: [[0.15, 3.06], [4.94, 3.06], [4.94, 6.85], [0.15, 6.85]] },
      { id: "bedroom", name: "Спалня", type: "bedroom", polygon: [[5.06, 3.06], [8.25, 3.06], [8.25, 6.85], [5.06, 6.85]] },
      { id: "bath", name: "Баня", type: "bathroom", polygon: [[0.15, 0.15], [2.14, 0.15], [2.14, 2.94], [0.15, 2.94]] },
      { id: "hall", name: "Входно антре", type: "hall", polygon: [[2.26, 0.15], [6.34, 0.15], [6.34, 2.94], [2.26, 2.94]] },
      { id: "storage", name: "Килер", type: "storage", polygon: [[6.46, 0.15], [8.25, 0.15], [8.25, 2.94], [6.46, 2.94]] },
      { id: "terrace", name: "Тераса", type: "terrace", polygon: [[0.04, 7.15], [4.96, 7.15], [4.96, 8.56], [0.04, 8.56]] }
    ],
    walls: [
      { id: "w_s", a: [0, 0], b: [8.4, 0], thickness_m: ext }, { id: "w_e", a: [8.4, 0], b: [8.4, 7], thickness_m: ext },
      { id: "w_n", a: [0, 7], b: [8.4, 7], thickness_m: ext }, { id: "w_w", a: [0, 0], b: [0, 7], thickness_m: ext },
      { id: "w_mid", a: [0, 3], b: [8.4, 3], thickness_m: int }, { id: "w_lb", a: [5, 3], b: [5, 7], thickness_m: int },
      { id: "w_bh", a: [2.2, 0], b: [2.2, 3], thickness_m: int }, { id: "w_hs", a: [6.4, 0], b: [6.4, 3], thickness_m: int },
      { id: "r_n", a: [0, 8.6], b: [5, 8.6], thickness_m: rail, height_m: 1.1 }, { id: "r_w", a: [0, 7], b: [0, 8.6], thickness_m: rail, height_m: 1.1 },
      { id: "r_e", a: [5, 7], b: [5, 8.6], thickness_m: rail, height_m: 1.1 }
    ],
    openings: [
      { id: "entr", type: "door", wall: "w_s", offset_m: 3.6, width_m: 0.9, height_m: 2.1, rooms: ["hall", "exterior"] },
      { id: "d_bath", type: "door", wall: "w_bh", offset_m: 1.8, width_m: 0.7, height_m: 2.05, rooms: ["bath", "hall"] },
      { id: "d_liv", type: "door", wall: "w_mid", offset_m: 3.0, width_m: 0.9, height_m: 2.1, rooms: ["hall", "living"] },
      { id: "d_bed", type: "door", wall: "w_mid", offset_m: 5.4, width_m: 0.8, height_m: 2.05, rooms: ["hall", "bedroom"] },
      { id: "d_sto", type: "door", wall: "w_hs", offset_m: 0.6, width_m: 0.7, height_m: 2.05, rooms: ["hall", "storage"] },
      { id: "bd_ter", type: "balcony_door", wall: "w_n", offset_m: 1.0, width_m: 1.0, height_m: 2.2, rooms: ["living", "terrace"] },
      { id: "win_liv", type: "window", wall: "w_n", offset_m: 2.8, width_m: 1.6, height_m: 1.5, sill_m: 0.9, rooms: ["living", "exterior"] },
      { id: "win_kit", type: "window", wall: "w_w", offset_m: 4.2, width_m: 1.2, height_m: 1.4, sill_m: 0.9, rooms: ["living", "exterior"] },
      { id: "win_bed", type: "window", wall: "w_n", offset_m: 6.0, width_m: 1.4, height_m: 1.5, sill_m: 0.9, rooms: ["bedroom", "exterior"] },
      { id: "win_bath", type: "window", wall: "w_w", offset_m: 1.0, width_m: 0.6, height_m: 0.6, sill_m: 1.4, rooms: ["bath", "exterior"] }
    ]
  };
}
/* TEST-B2 – тристаен, Г-образен: коридор, 2 спални, отделна кухня, баня + тоалетна, тераса във вътрешния ъгъл */
function testB2() {
  return {
    schema: "nd.unit_geometry.v1", units: "m", north_deg: 90, default_height_m: 2.75, entrance: "entr",
    rooms: [
      { id: "bed1", name: "Спалня 1", type: "bedroom", polygon: [[0.15, 0.15], [3.74, 0.15], [3.74, 3.74], [0.15, 3.74]] },
      { id: "bath", name: "Баня", type: "bathroom", height_m: 2.6, polygon: [[3.86, 0.15], [6.14, 0.15], [6.14, 2.34], [3.86, 2.34]] },
      { id: "hall", name: "Входно антре", type: "hall", polygon: [[6.26, 0.15], [8.34, 0.15], [8.34, 2.34], [6.26, 2.34]] },
      { id: "wc", name: "Тоалетна", type: "wc", height_m: 2.6, polygon: [[8.46, 0.15], [9.85, 0.15], [9.85, 2.34], [8.46, 2.34]] },
      { id: "corr", name: "Коридор", type: "corridor", polygon: [[3.86, 2.46], [9.85, 2.46], [9.85, 3.74], [3.86, 3.74]] },
      { id: "living", name: "Дневна", type: "living", polygon: [[0.15, 3.86], [5.94, 3.86], [5.94, 7.05], [0.15, 7.05]] },
      { id: "corr2", name: "Коридор към спалня 2", type: "corridor", polygon: [[6.06, 3.86], [7.14, 3.86], [7.14, 7.14], [6.06, 7.14]] },
      { id: "kitchen", name: "Кухня", type: "kitchen", polygon: [[7.26, 3.86], [9.85, 3.86], [9.85, 7.14], [7.26, 7.14]] },
      { id: "bed2", name: "Спалня 2", type: "bedroom", polygon: [[6.15, 7.26], [9.85, 7.26], [9.85, 10.65], [6.15, 10.65]] },
      { id: "terrace", name: "Тераса", type: "terrace", polygon: [[0.04, 7.35], [5.85, 7.35], [5.85, 8.76], [0.04, 8.76]] }
    ],
    walls: [
      { id: "w1", a: [0, 0], b: [10, 0], thickness_m: ext }, { id: "w2", a: [10, 0], b: [10, 10.8], thickness_m: ext },
      { id: "w3", a: [6, 10.8], b: [10, 10.8], thickness_m: ext }, { id: "w4", a: [6, 7.2], b: [6, 10.8], thickness_m: ext },
      { id: "w5", a: [0, 7.2], b: [6, 7.2], thickness_m: ext }, { id: "w6", a: [0, 0], b: [0, 7.2], thickness_m: ext },
      { id: "i1", a: [0, 3.8], b: [3.8, 3.8], thickness_m: int }, { id: "i2", a: [3.8, 0], b: [3.8, 3.8], thickness_m: int },
      { id: "i3", a: [3.8, 2.4], b: [10, 2.4], thickness_m: int }, { id: "i4", a: [6.2, 0], b: [6.2, 2.4], thickness_m: int },
      { id: "i5", a: [8.4, 0], b: [8.4, 2.4], thickness_m: int }, { id: "i6", a: [3.8, 3.8], b: [10, 3.8], thickness_m: int },
      { id: "i7", a: [6, 3.8], b: [6, 7.2], thickness_m: int }, { id: "i8", a: [7.2, 3.8], b: [7.2, 7.2], thickness_m: int },
      { id: "i9", a: [6, 7.2], b: [10, 7.2], thickness_m: int },
      { id: "r1", a: [0, 7.2], b: [0, 8.8], thickness_m: rail, height_m: 1.1 }, { id: "r2", a: [0, 8.8], b: [6, 8.8], thickness_m: rail, height_m: 1.1 }
    ],
    openings: [
      { id: "entr", type: "door", wall: "w1", offset_m: 6.8, width_m: 0.9, height_m: 2.1, rooms: ["hall", "exterior"] },
      { id: "d_hc", type: "door", wall: "i3", offset_m: 3.0, width_m: 0.9, height_m: 2.1, rooms: ["hall", "corr"] },
      { id: "d_b1", type: "door", wall: "i2", offset_m: 2.7, width_m: 0.8, height_m: 2.05, rooms: ["bed1", "corr"] },
      { id: "d_bath", type: "door", wall: "i3", offset_m: 0.6, width_m: 0.7, height_m: 2.05, rooms: ["bath", "corr"] },
      { id: "d_wc", type: "door", wall: "i3", offset_m: 5.0, width_m: 0.7, height_m: 2.05, rooms: ["wc", "corr"] },
      { id: "d_liv", type: "door", wall: "i6", offset_m: 0.6, width_m: 0.9, height_m: 2.1, rooms: ["corr", "living"] },
      { id: "p_c2", type: "passage", wall: "i6", offset_m: 2.35, width_m: 0.9, height_m: 2.1, rooms: ["corr", "corr2"] },
      { id: "d_kit", type: "door", wall: "i8", offset_m: 0.8, width_m: 0.8, height_m: 2.05, rooms: ["corr2", "kitchen"] },
      { id: "d_b2", type: "door", wall: "i9", offset_m: 0.15, width_m: 0.8, height_m: 2.05, rooms: ["corr2", "bed2"] },
      { id: "bd_ter", type: "balcony_door", wall: "w5", offset_m: 1.5, width_m: 1.0, height_m: 2.2, rooms: ["living", "terrace"] },
      { id: "win_liv1", type: "window", wall: "w5", offset_m: 3.2, width_m: 1.6, height_m: 1.5, sill_m: 0.9, rooms: ["living", "exterior"] },
      { id: "win_liv2", type: "window", wall: "w6", offset_m: 4.6, width_m: 1.4, height_m: 1.5, sill_m: 0.9, rooms: ["living", "exterior"] },
      { id: "win_b1a", type: "window", wall: "w6", offset_m: 1.2, width_m: 1.4, height_m: 1.5, sill_m: 0.9, rooms: ["bed1", "exterior"] },
      { id: "win_b1b", type: "window", wall: "w1", offset_m: 1.0, width_m: 1.2, height_m: 1.5, sill_m: 0.9, rooms: ["bed1", "exterior"] },
      { id: "win_kit", type: "window", wall: "w2", offset_m: 4.8, width_m: 1.2, height_m: 1.2, sill_m: 1.0, rooms: ["kitchen", "exterior"] },
      { id: "win_b2a", type: "window", wall: "w3", offset_m: 1.2, width_m: 1.6, height_m: 1.5, sill_m: 0.9, rooms: ["bed2", "exterior"] },
      { id: "win_b2b", type: "window", wall: "w2", offset_m: 8.4, width_m: 1.2, height_m: 1.5, sill_m: 0.9, rooms: ["bed2", "exterior"] },
      { id: "win_bath", type: "window", wall: "w1", offset_m: 4.6, width_m: 0.6, height_m: 0.6, sill_m: 1.4, rooms: ["bath", "exterior"] },
      { id: "win_wc", type: "window", wall: "w1", offset_m: 8.9, width_m: 0.5, height_m: 0.5, sill_m: 1.5, rooms: ["wc", "exterior"] }
    ]
  };
}
/* липсващи височини → BLOCKED (не се „досещаме“) */
function testNoHeights() { const g = testA1(); delete g.default_height_m; return g; }

/* служебна равноправоъгълна TEST панорама: градиент по посоката + решетка на 22.5° + надпис TEST и посоки N/E/S/W
   (u = 0.5 е посоката yaw_offset; N е на u = 0.5 при yaw_offset = 0). Генерира се програмно – не е снимка. */
const FONT = { T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"], E: ["11111", "10000", "11110", "10000", "10000", "10000", "11111"], S: ["01111", "10000", "01110", "00001", "00001", "10001", "01110"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"], W: ["10001", "10001", "10101", "10101", "10101", "11011", "10001"] };
function testPano(w, h, o) {
  const opt = o || {}, d = new Uint8Array(w * h * 4), hue = opt.hue || 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, k = (y * w + x) * 4;
    const a = (u * 6 + hue) % 6, f = a - Math.floor(a), c = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][Math.floor(a)];
    const shade = 0.55 + 0.4 * Math.sin(v * Math.PI);
    const grid = (x % Math.round(w / 16) < Math.max(1, w / 1024)) || (y % Math.round(h / 8) < Math.max(1, h / 512));
    d[k] = grid ? 30 : 60 + c[0] * 150 * shade; d[k + 1] = grid ? 30 : 60 + c[1] * 150 * shade; d[k + 2] = grid ? 30 : 60 + c[2] * 150 * shade; d[k + 3] = 255;
  }
  const stamp = (text, cx, cy, s) => {
    const tw = text.length * 6 * s;
    for (let n = 0; n < text.length; n++) { const g = FONT[text[n]]; if (!g) continue; for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r][q] === "1") for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) { const X = Math.round(cx - tw / 2 + (n * 6 + q) * s + xx), Y = Math.round(cy - 3.5 * s + r * s + yy); if (X >= 0 && Y >= 0 && X < w && Y < h) { const k = (Y * w + X) * 4; d[k] = d[k + 1] = d[k + 2] = 255; } } }
  };
  const s = Math.max(2, Math.round(h / 64));
  stamp("TEST", w / 2, h * 0.3, s * 2);
  [["N", 0.5], ["E", 0.75], ["S", 0.0], ["S", 1.0], ["W", 0.25]].forEach(([t, u]) => stamp(t, u * w, h * 0.5, s));
  const J = require("./_vendor/jpeg-js");
  if (opt.png) { const { PNG } = require("./_vendor/pngjs/lib/png.js"); const p = new PNG({ width: w, height: h }); p.data = Buffer.from(d); return PNG.sync.write(p); }
  return Buffer.from(J.encode({ data: d, width: w, height: h }, opt.q || 80).data);
}

module.exports = { testA1, testB2, testNoHeights, testPano };
