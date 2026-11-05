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
  window.__ND_LISTINGS = [];
  window.__ND_READY = rpc("nd_public_listings").then(function (rows) {
    var paths = [];
    rows.forEach(function (r) { (r.pics || []).forEach(function (p) { paths.push(p); }); });
    return sign(paths).then(function (m) {
      window.__ND_LISTINGS = rows.map(function (r) {
        var gal = (r.pics || []).map(function (p) { return m[p]; }).filter(Boolean);
        var cover = (r.cover && m[r.cover]) || gal[0] || null;
        if (cover) gal = [cover].concat(gal.filter(function (u) { return u !== cover; }));
        var fresh = Date.now() - new Date(r.updated_at) < 7 * 864e5;
        return { id: String(r.id), code: r.code, name: r.title, title: r.title, price: Number(r.price) || 0, area: Number(r.area) || 0,
          rooms: r.rooms || 0, beds: r.beds || 0, baths: r.baths || 0, img: cover, gallery: gal, badge: fresh ? "НОВО" : "",
          city: r.city || "", region: r.region || "", hood: r.hood || "", type: r.type || "", deal: r.deal || "sale", cond: r.cond || "", desc: r.descr || "" };
      });
    });
  }).catch(function () { window.__ND_LISTINGS = []; });
  /* inquiry / viewing request -> CRM client + activity */
  window.ndInquiry = function (o) { return rpc("nd_public_inquiry", { p: o }); };
})();
