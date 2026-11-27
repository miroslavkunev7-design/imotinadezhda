/* Снимката на влезлия брокер горе вдясно (на всички страници на CRM).
   До разпознаването се вижда неутрален силует – никога снимката на друг брокер. */
(function () {
  "use strict";
  var BLANK = "assets/avatar-blank.svg";
  function matches(card) {
    var u = window.ND && ND.user; if (!u || !card) return false;
    if (card.user_id) return card.user_id === u.id;
    return !!(u.email && card.email && u.email.toLowerCase() === card.email.toLowerCase());
  }
  function set(url, name) {
    [].forEach.call(document.querySelectorAll(".avatar img"), function (im) {
      im.onerror = function () { this.onerror = null; this.src = BLANK; };
      if (url && im.getAttribute("src") !== url) im.src = url;
      im.alt = name || "Моят профил"; im.decoding = "async";
    });
  }
  function paint(card) {
    if (!matches(card)) return;
    var p = card.photo || card.thumb;
    if (!p || /^avatar\.jpg$/.test(p)) return set(BLANK, card.name);
    (/^brokers\//.test(p) ? ND.fileUrl(p) : Promise.resolve(/^https?:\/\//.test(p) ? p : "assets/" + p))
      .then(function (u) { set(u || BLANK, card.name); }, function () { set(BLANK, card.name); });
  }
  function boot() {
    set(null);
    if (!window.ND || !ND.ready) return;
    ND.ready().then(function () { return ND.load("brokers"); })
      .then(function (cards) { var mine = (cards || []).filter(matches); if (mine.length) paint(mine[0]); }).catch(function () {});
  }
  addEventListener("nd-broker-updated", function (e) { paint(e.detail); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
