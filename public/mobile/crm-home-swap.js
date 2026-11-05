// Phones only: every CRM address (#/crm...) opens the new CRM module in /crm/ (files unchanged). Desktop keeps the old CRM.
(function(){
  function go(){
    if(!window.matchMedia('(max-width: 768px)').matches)return;
    if(/^#\/crm(\/|$)/.test(location.hash||''))location.replace('/crm');
  }
  window.addEventListener('hashchange',go);
  go();
})();
