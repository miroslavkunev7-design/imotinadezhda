module.exports = async (req, res) => {
  if (!String(req.url).includes('k=0aa1fafaca6370d20541f5f5')) { res.statusCode = 404; return res.end('not found'); }
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const out = { host: url && new URL(url).host, usingService: !!key, tables: {} };
  try {
    const r = await fetch(url + '/rest/v1/', { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/openapi+json' } });
    out.status = r.status; const j = await r.json(); const defs = j.definitions || {};
    out.rpc = Object.keys(j.paths || {}).filter(p => p.startsWith('/rpc/')).map(p => p.slice(5));
    await Promise.all(Object.keys(defs).map(async (t) => {
      let count = null;
      try { const c = await fetch(url + '/rest/v1/' + t + '?select=*', { method: 'HEAD', headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'count=exact', Range: '0-0' } });
        count = (c.headers.get('content-range') || '').split('/')[1] || c.status; } catch (e) {}
      out.tables[t] = { count, cols: Object.keys(defs[t].properties || {}) };
    }));
  } catch (e) { out.err = String(e); }
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(out));
};
