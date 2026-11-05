module.exports = async (req, res) => {
  const pick = (...k) => k.map((n) => process.env[n]).find(Boolean);
  const url = pick('SUPABASE_URL', 'VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const key = pick('SUPABASE_SERVICE_ROLE_KEY') || pick('SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const out = { host: url ? new URL(url).host : null, usingService: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    envHosts: ['SUPABASE_URL','VITE_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL'].map(n=>[n, process.env[n] ? new URL(process.env[n]).host : null]) };
  try {
    const r = await fetch(url + '/rest/v1/', { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/openapi+json' } });
    out.status = r.status;
    const j = await r.json();
    const defs = j.definitions || {};
    out.tables = {};
    for (const t of Object.keys(defs)) out.tables[t] = Object.keys(defs[t].properties || {});
  } catch (e) { out.err = String(e); }
  res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(out));
};
