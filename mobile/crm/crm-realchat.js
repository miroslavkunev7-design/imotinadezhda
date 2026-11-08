/* Истинският разговор в Messenger / Instagram / WhatsApp – отваря се в отделен прозорец със собствения си адрес.
   Facebook не позволява страниците му да се вграждат в наш прозорец (iframe), затова е самостоятелен прозорец:
   влизате веднъж в профила си там и после всичко работи както във Facebook. */
(function () {
  if (window.NDRealChat) return;
  var PAGE = "1447196405137713"; // страницата „Недвижими Имоти • Надежда •“
  function phoneUi() { return innerWidth < 700 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
  function digits(p) { var n = String(p || "").replace(/\D/g, ""); if (/^00/.test(n)) n = n.slice(2); if (/^0[89]/.test(n)) n = "359" + n.slice(1); return n.length >= 9 ? n : ""; }
  function plat(c) { var p = (c && (c.platform || (c.data || {}).platform)) || "messenger"; return p === "whatsapp" || p === "instagram" ? p : "messenger"; }
  function ext(c) { var e = c && (c.ext_id || (c.data || {}).ext_id) || ""; return /^TEST/i.test(e) ? "" : String(e); }
  function url(c) {
    var d = (c && c.data) || {}, p = plat(c), e = ext(c);
    if (d.link && /^https:\/\//.test(d.link)) return d.link;
    if (p === "whatsapp") {
      var n = digits(d.phone || e);
      if (n) return phoneUi() ? "https://wa.me/" + n : "https://web.whatsapp.com/send?phone=" + n;
      return "https://business.facebook.com/latest/inbox/whatsapp?asset_id=" + PAGE;
    }
    if (p === "instagram") return "https://business.facebook.com/latest/inbox/instagram_direct?asset_id=" + PAGE + (e ? "&selected_item_id=" + encodeURIComponent(e) : "");
    return "https://business.facebook.com/latest/inbox/messenger?asset_id=" + PAGE + (e ? "&selected_item_id=" + encodeURIComponent(e) + "&mailbox_id=" + PAGE + "&thread_type=FB_MESSAGE" : "");
  }
  function label(c) { var p = typeof c === "string" ? c : plat(c); return p === "whatsapp" ? "WhatsApp" : p === "instagram" ? "Instagram" : "Messenger"; }
  /* side: "l" | "r" – от коя страна да излезе прозорецът (до балончетата) */
  function open(c, side) {
    var u = url(c), w;
    if (phoneUi()) { w = window.open(u, "_blank"); if (w) { try { w.opener = null; } catch (x) {} return true; } location.href = u; return true; }
    var sw = screen.availWidth || innerWidth, sh = screen.availHeight || innerHeight;
    var W = Math.min(480, sw - 40), H = Math.min(880, sh - 60);
    var L = (screen.availLeft || 0) + (side === "l" ? 24 : sw - W - 24), T = (screen.availTop || 0) + Math.max(10, Math.round((sh - H) / 2));
    w = window.open(u, "nd-real-" + plat(c), "popup=yes,width=" + W + ",height=" + H + ",left=" + L + ",top=" + T);
    if (!w) return false;
    try { w.opener = null; w.focus(); } catch (x) {}
    return true;
  }
  window.NDRealChat = { url: url, open: open, label: label, platform: plat };
})();
