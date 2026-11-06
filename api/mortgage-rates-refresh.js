const lib = require("./_mortgage-rates");

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || "";
  const cron = req.headers["x-vercel-cron"];
  if (cron) {
    if (!secret) return true;
    return auth === "Bearer " + secret;
  }
  if (secret && auth === "Bearer " + secret) return true;
  return false;
}

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.end("method");
    return;
  }
  const sofia = lib.sofiaParts();
  if (req.headers["x-vercel-cron"] && sofia.hour !== 6) {
    lib.json(res, 200, { skipped: true, reason: "not 06:00 Europe/Sofia", sofiaHour: sofia.hour });
    return;
  }
  if (!authorized(req)) {
    lib.json(res, 401, { error: "unauthorized" });
    return;
  }
  try {
    const result = await lib.refreshToday();
    lib.json(res, 200, {
      ok: true,
      today: result.today,
      updated: result.updated,
      keptYesterday: result.keptYesterday,
      failures: result.failures,
      write: result.write,
      asOfPhrase: result.packed.asOfPhrase,
      stale: result.packed.stale
    });
  } catch (e) {
    lib.json(res, 200, { ok: false, keptYesterday: true, error: String(e && e.message || e) });
  }
};
