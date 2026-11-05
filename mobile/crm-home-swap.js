// Phones only: the public start page is /mobile/home.html; every CRM address (#/crm...) opens the new CRM module in /crm/ (files unchanged). Desktop keeps the old CRM.
(function(){
  function go(){
    if(!window.matchMedia('(max-width: 768px)').matches)return;
    var h=location.hash||'';
    if(/^#\/crm(\/|$)/.test(h))location.replace('/mobile/crm/crm-nachalo.html');
    else if((location.pathname==='/'||location.pathname==='/index.html')&&(h===''||h==='#'||h==='#/')&&!/[?&]desktop=1/.test(location.search))location.replace('/mobile/home.html');
  }
  window.addEventListener('hashchange',go);
  go();
})();
