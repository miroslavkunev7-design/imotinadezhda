/* Вариант 3 – хедът и стъклото се преливат заедно (всички страници).
   1) зад долната част на хеда се връща предишното топло преливане (праскова), както беше преди;
   2) големият стъклен прозорец се застъпва леко нагоре върху хеда (до 70px), без да мести съдържанието
      и без да закрива заглавието и подзаглавието на страницата. */
(function () {
  if (window.__ndV3Head) return; window.__ndV3Head = 1;
  var MAXLIFT = 70, GAP = 14, SEL = '#canvas > .oflow, #canvas > .bflow, #canvas > .iflow, #canvas > .kflow, #canvas > .flow, #canvas > .v3-glass';
  function offTop(el, cv) { var y = 0; while (el && el !== cv) { y += el.offsetTop; el = el.offsetParent; } return y; }
  function run() {
    var cv = document.getElementById('canvas'), top = document.querySelector('#canvas > .top, #top');
    if (!cv || !top) return;
    var hh = top.offsetTop + top.offsetHeight;
    if (hh < 50) return;
    cv.style.setProperty('--hh', hh + 'px');
    /* най-ниската точка на текста в хеда (заглавие, подзаглавие, линия, иконка) */
    var tb = 0;
    [].forEach.call(top.querySelectorAll('.hero-title,.hero-sub,.hero-line,[data-hero],.o-ic,h1,h2'), function (e) {
      if (!e.offsetHeight) return; var b = offTop(e, cv) + e.offsetHeight; if (b > tb) tb = b;
    });
    var g = cv.querySelector(SEL); if (!g) return;
    if (g.__ndPT == null) {
      var cs = getComputedStyle(g);
      g.__ndPT = parseFloat(cs.paddingTop) || 0; g.__ndMT = parseFloat(cs.marginTop) || 0; if (!g.classList.contains('v3-glass')) g.classList.add('v3-lift');
    }
    var gTop = offTop(g, cv) - (g.__ndLiftNow || 0);   /* горният ръб на стъклото без застъпването */
    var lift = Math.max(0, Math.min(MAXLIFT, gTop - (tb ? tb + GAP : 0)));
    if (!tb) lift = Math.min(MAXLIFT, Math.max(0, gTop - (hh - MAXLIFT)));
    if (g.__ndLiftNow === lift) return;
    g.__ndLiftNow = lift;
    if (g.classList.contains('v3-glass')) { g.style.marginTop = -lift + 'px'; g.style.paddingTop = lift + 'px'; g.style.boxSizing = 'content-box'; }
    else { g.style.marginTop = (g.__ndMT - lift) + 'px'; g.style.paddingTop = (g.__ndPT + lift) + 'px'; }
  }
  function boot() {
    run(); setTimeout(run, 300); setTimeout(run, 1200); setTimeout(run, 2500);
    var top = document.querySelector('#canvas > .top, #top');
    if (top && window.ResizeObserver) new ResizeObserver(function () { run(); }).observe(top);
    addEventListener('resize', function () { setTimeout(run, 80); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
