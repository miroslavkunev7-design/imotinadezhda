/* Public mobile site — real published listings and inquiries from the CRM database.
   Only properties with status "Публикуван" are visible; inquiries create/attach a CRM client. */
(function () {
  "use strict";
  var URL = "https://hyvwfsmjbaynozceookv.supabase.co";
  var KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
  var H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
  function rpc(name, body) {
    return fetch(URL + "/rest/v1/rpc/" + name, { method: "POST", headers: H, body: JSON.stringify(body || {}) }).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error((j && j.message) || "HTTP " + r.status); return j; });
    });
  }
  function sign(paths) {
    if (!paths.length) return Promise.resolve({});
    return fetch(URL + "/storage/v1/object/sign/nd-files", { method: "POST", headers: H, body: JSON.stringify({ expiresIn: 86400, paths: paths }) })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (a) { var m = {}; (a || []).forEach(function (x) { if (x.signedURL) m[x.path] = URL + "/storage/v1" + x.signedURL; }); return m; })
      .catch(function () { return {}; });
  }
  /* Точното място на имота. В CRM градът, населеното място и кварталът се пишат по различен начин
     („с. Енево“ като град, „с. Мировци“ като квартал, „Велики Преслав“ като място в Шумен…). Тук всеки имот получава:
     city = областният град, под който се показва (Шумен / Варна / Бургас); town = селото или градът извън него (празно за самия град);
     townKind = village | town | resort; hood = кварталът; loc = надписът за локацията. */
  var MAIN = ["Бургас", "Варна", "Шумен"];
  function locate(r) {
    var P = window.NDPlaces; if (!P) return { city: r.city || "", town: "", townKind: "", hood: r.hood || "", loc: "" };
    var strip = function (x) { return String(x || "").replace(/^\s*(гр\.|град\s|с\.|село\s)\s*/i, "").replace(/\s+/g, " ").trim(); };
    var isV = function (x) { return /^\s*(с\.|село\s)/i.test(String(x || "")); };
    var cityRaw = r.city || "", placeRaw = r.place || "", hoodRaw = String(r.hood || "").trim(), cityC = P.city(strip(cityRaw));
    var name, kind = "", hood = hoodRaw;
    var placeIsHood = placeRaw && (P.PLACES[cityC] || []).some(function (h) { return P.key(h) === P.key(placeRaw); });
    if (isV(hoodRaw)) { name = strip(hoodRaw); kind = "village"; hood = ""; }
    else if (placeRaw && !placeIsHood && P.key(strip(placeRaw)) !== P.key(strip(cityRaw))) { name = strip(placeRaw); if (isV(placeRaw)) kind = "village"; if (P.key(strip(hoodRaw)) === P.key(name)) hood = ""; }
    else { name = strip(cityRaw); if (isV(cityRaw)) kind = "village"; if (placeIsHood && !hood) hood = placeRaw; }
    name = P.city(name);
    var inReg = function (reg, n) { var o = P.REGION[reg] || {}; return (o.villages || []).indexOf(n) >= 0 ? "village" : (o.towns || []).indexOf(n) >= 0 ? "town" : (o.resorts || []).indexOf(n) >= 0 ? "resort" : ""; };
    var want = [P.regionOf(P.city(strip(r.region))), P.regionOf(cityC)].filter(function (x) { return MAIN.indexOf(x) >= 0; });
    var region = MAIN.indexOf(name) >= 0 ? name : "";
    if (!region) want.forEach(function (w) { if (!region && inReg(w, name)) region = w; });
    if (!region) { var g = P.regionOf(name); region = MAIN.indexOf(g) >= 0 ? g : (want[0] || ""); }
    if (!region) return { city: name, town: "", townKind: "", hood: P.hood(name, hood), loc: (hood ? "кв. " + hood + ", " : "") + name };
    if (name === region) { var h = P.hood(region, hood); return { city: region, town: "", townKind: "", hood: h, loc: (h ? "кв. " + h + ", " : "") + "гр. " + region }; }
    kind = kind || inReg(region, name) || "village";
    var h2 = P.hood(name, hood);
    return { city: region, town: name, townKind: kind, hood: h2, loc: (kind === "village" ? "с. " : kind === "town" ? "гр. " : "") + name + (h2 ? ", кв. " + h2 : "") + ", обл. " + region };
  }
  window.ndLocate = locate;
  window.__ND_LISTINGS = [];
  window.__ND_READY = rpc("nd_public_listings2").catch(function () { return rpc("nd_public_listings"); }).then(function (rows) {
    rows = (rows || []).map(function (r) { return r && r.nd_public_listings2 ? r.nd_public_listings2 : r; });
    var paths = [];
    rows.forEach(function (r) { (r.pics || []).forEach(function (p) { paths.push(p); }); });
    return sign(paths).then(function (m) {
      var P = window.NDPlaces;
      window.__ND_LISTINGS = rows.map(function (r) {
        var L = locate(r);
        var gal = (r.pics || []).map(function (p) { return m[p]; }).filter(Boolean);
        var cover = (r.cover && m[r.cover]) || gal[0] || null;
        if (cover) gal = [cover].concat(gal.filter(function (u) { return u !== cover; }));
        var fresh = Date.now() - new Date(r.updated_at) < 7 * 864e5;
        return { id: String(r.id), code: r.code, name: r.title, title: r.title, price: Number(r.price) || 0, area: Number(r.area) || 0,
          rooms: Math.max(0, Number(r.rooms) || 0), beds: Math.max(0, Number(r.beds) || 0), baths: Math.max(0, Number(r.baths) || 0), img: cover, gallery: gal, badge: fresh ? "НОВО" : "",
          city: L.city, town: L.town, townKind: L.townKind, loc: L.loc, region: r.region || "", place: r.place || "", num: r.num || null, floor: r.floor || "", build: r.build || "", year: r.year || null, expo: r.expo || "", heat: r.heat || "", parking: r.parking || "", elevator: !!r.elevator, act: r.act || "", features: r.features || "", tour: r.tour || "", hood: L.hood, type: r.type || "", deal: r.deal || "sale", cond: r.cond || "", desc: r.descr || "", agent: r.agent || null };
      });
    });
  }).catch(function () { window.__ND_LISTINGS = []; });
  /* inquiry / viewing request -> CRM client + activity */
  window.ndInquiry = function (o) { return rpc("nd_public_inquiry", { p: o }); };
})();
