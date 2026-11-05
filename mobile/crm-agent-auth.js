// Gives the assistant chat a fresh access token of the user signed in to the CRM
// (Supabase project hyvwfsmjbaynozceookv, same sign-in as /mobile/crm), so the
// assistant's tools (/api/tools) run with exactly this user's rights. Returns null when signed out.
(function () {
  var KEY = 'nd-crm-auth';
  var AUTH_URL = 'https://hyvwfsmjbaynozceookv.supabase.co/auth/v1';
  var PUBLISHABLE = 'sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni';
  window.crmAgentToken = async function () {
    var s;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (s && s.currentSession) s = s.currentSession;
    if (!s || !s.access_token) return null;
    if (s.expires_at && s.expires_at * 1000 - Date.now() > 60000) return s.access_token;
    try {
      var res = await fetch(AUTH_URL + '/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!res.ok) return null;
      var d = await res.json();
      localStorage.setItem(KEY, JSON.stringify(d));
      return d.access_token;
    } catch (e) { return null; }
  };
})();
