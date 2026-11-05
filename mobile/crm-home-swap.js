// Every CRM address (#/crm...) opens the new CRM on phones and on desktop (it lays itself out for the screen). Phones also get /mobile/home.html as the public start page.
(function(){
  function go(){
    var h=location.hash||'';
    if(/^#\/crm(\/|$)/.test(h)){location.replace('/mobile/crm/crm-nachalo.html');return}
    if(!window.matchMedia('(max-width: 768px)').matches)return;
    if((location.pathname==='/'||location.pathname==='/index.html')&&(h===''||h==='#'||h==='#/')&&!/[?&]desktop=1/.test(location.search))location.replace('/mobile/home.html');
  }
  window.addEventListener('hashchange',go);
  go();
})();
