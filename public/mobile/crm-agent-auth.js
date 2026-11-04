// Gives the chat a fresh access token of the signed-in CRM user (mirrored by /auth),
// so Ted's tools in n8n run with exactly this user's rights. Returns null when signed out.
(function () {
  var KEY = 'crm-agent-session';
  var AUTH_URL = 'https://khdhfuvxdquatcgzgvyk.supabase.co/auth/v1';
  var PUBLISHABLE = 'sb_publishable_pmtpdNr_7VyxdjieW9nS-g_Kfq80Kia';
  window.crmAgentToken = async function () {
    var s;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !s.access_token) return null;
    if (s.expires_at && s.expires_at * 1000 - Date.now() > 60000) return s.access_token;
    try {
      var res = await fetch(AUTH_URL + '/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!res.ok) { localStorage.removeItem(KEY); return null; }
      var d = await res.json();
      localStorage.setItem(KEY, JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at }));
      return d.access_token;
    } catch (e) { return null; }
  };
})();
