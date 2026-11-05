/* Local public media. Posters remain visible when playback is unavailable. */
(function () {
  'use strict';
  var api = window.NDMedia = window.NDMedia || {};
  var root = '/mobile/media/';
  api.cityVideo = function (city) { return /^(shumen|varna|burgas)$/.test(city) ? 'city-' + city : ''; };
  api.heroVideo = function (city, detail, id) {
    var names = ['hero-garden', 'hero-residence', 'hero-courtyard'];
    if (!detail) return {shumen:names[0],varna:names[1],burgas:names[2]}[city] || names[0];
    var hash = 0;
    String(id || city || '').split('').forEach(function (c) { hash = (hash * 31 + c.charCodeAt(0)) >>> 0; });
    return names[hash % names.length];
  };
  api.photo = function (city, name, fallback) {
    var aliases = {'Индустриална зона Север':'Индустриална зона – Север','Промишлена зона Юг':'Индустриална зона – Юг','Промишлена зона Лозово':'Лозово'};
    name = aliases[name] || String(name || '').replace(/\s*[–-]\s*зона\s+[А-ЯA-Z]$/i, '');
    var entry = (window.ND_PLACE_PHOTOS || {})[city + '|' + name];
    return entry && entry.src || fallback;
  };
  api.photoKind = function(city,name) { var p=(window.ND_PLACE_PHOTOS||{})[city+'|'+name];return p&&p.kind||''; };
  api.photoLabel = function(city,name) { var k=api.photoKind(city,name);return k==='region'?'Регионален кадър':k==='nearby'?'Околности':''; };
  api.photoTitle = function (city, name) {
    var p = (window.ND_PLACE_PHOTOS || {})[city + '|' + name];
    return p ? p.caption + (p.author ? ' · ' + p.author : '') : name;
  };
  api.photoAlt = function (city, name) {
    var p = (window.ND_PLACE_PHOTOS || {})[city + '|' + name];
    return p ? p.caption : name;
  };
  function connect(video) {
    if (!video || video.dataset.ndConnected) return function () {};
    video.dataset.ndConnected = '1';
    video.muted = true;
    video.defaultMuted = true;
    var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var visible = false, failed = false, observer;
    function update() {
      if (failed) return;
      if (visible && !document.hidden && !motion.matches) {
        if (!video.getAttribute('src')) video.src = video.dataset.ndVideo;
        var promise = video.play();
        if (promise) promise.catch(function () { /* poster is the autoplay fallback */ });
      } else video.pause();
    }
    function onError() { failed = true; video.pause(); video.removeAttribute('src'); video.load(); }
    video.addEventListener('error', onError);
    document.addEventListener('visibilitychange', update);
    if (motion.addEventListener) motion.addEventListener('change', update);
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; update(); }, {rootMargin:'100px'});
      observer.observe(video);
    } else { visible = true; update(); }
    return function () {
      if (observer) observer.disconnect();
      video.pause();
      video.removeEventListener('error', onError);
      document.removeEventListener('visibilitychange', update);
      if (motion.removeEventListener) motion.removeEventListener('change', update);
      delete video.dataset.ndConnected;
    };
  }
  api.connect = connect;
  if (window.React) {
    api.Background = function Background(props) {
      var ref = React.useRef(null);
      React.useEffect(function () { return connect(ref.current); }, [props.name]);
      if (!props.name) return React.createElement('img', {className:props.className||'',style:props.style,src:props.fallback||'/mobile/home-assets/city-novi-pazar.webp',alt:props.alt||''});
      return React.createElement('video', {
        key: props.name, ref: ref,
        className: (props.className || '') + ' nd-background-video', style: props.style,
        'data-nd-video': root + props.name + '.mp4',
        'data-nd-react': '1',
        poster: root + props.name + '.webp',
        muted: true, loop: true, playsInline: true, preload: 'none',
        'aria-label': props.alt || 'Декоративен видео фон', tabIndex: -1
      });
    };
  }
  function start() { document.querySelectorAll('video[data-nd-video]:not([data-nd-react])').forEach(connect); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
}());
