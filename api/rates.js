// Live reference rates for the CRM bank module.
// Source: European Central Bank Data Portal (official, free, no key).
//  - 6-month EURIBOR, monthly average (FM dataset)
//  - €STR, daily overnight rate published every TARGET2 business day (EST dataset)
// The response is cached for 30 minutes at the edge.
const ECB = 'https://data-api.ecb.europa.eu/service/data/';
const SERIES = {
  euribor6m: 'FM/M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA',
  euribor3m: 'FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA',
  estr: 'EST/B.EU000A2X2A25.WT'
};

async function latest(key) {
  const url = ECB + SERIES[key] + '?lastNObservations=1&format=csvdata';
  const res = await fetch(url, { headers: { Accept: 'text/csv' } });
  if (!res.ok) throw new Error(key + ' HTTP ' + res.status);
  const lines = (await res.text()).trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const row = lines[lines.length - 1].split(',');
  const period = row[head.indexOf('TIME_PERIOD')];
  const value = parseFloat(row[head.indexOf('OBS_VALUE')]);
  if (!period || !isFinite(value)) throw new Error(key + ' parse');
  return { value, period };
}

module.exports = async (req, res) => {
  const out = { source: 'ECB Data Portal', fetchedAt: new Date().toISOString() };
  const keys = Object.keys(SERIES);
  const results = await Promise.allSettled(keys.map(latest));
  results.forEach((r, i) => { out[keys[i]] = r.status === 'fulfilled' ? r.value : { error: String(r.reason && r.reason.message || r.reason) }; });
  const ok = keys.some((k) => out[k] && out[k].value != null);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', ok ? 'public, s-maxage=1800, stale-while-revalidate=600' : 'no-store');
  res.statusCode = ok ? 200 : 502;
  res.end(JSON.stringify(out));
};
