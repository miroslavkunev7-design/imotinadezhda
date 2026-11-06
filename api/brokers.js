// /api/brokers — staff-only create Auth user + nd_staff + nd_brokers CRM card.
// SERVICE_ROLE stays server-side only. Electron/Settings never embed it.
const SB_URL = process.env.ND_SUPABASE_URL || process.env.SUPABASE_URL || "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = process.env.ND_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ND_SUPABASE_SERVICE_ROLE_KEY || "";

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, apikey");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function bearer(req) {
  const auth = String(req.headers["authorization"] || "");
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}

async function isStaff(token) {
  if (!token) return false;
  const r = await fetch(SB_URL + "/rest/v1/rpc/nd_is_staff", {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: "{}"
  });
  return r.ok && (await r.json()) === true;
}

function headers(key, prefer) {
  const h = {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  };
  if (prefer) h.Prefer = prefer;
  return h;
}

function newId() {
  return "b-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});

  try {
    const token = bearer(req);
    if (!(await isStaff(token))) return send(res, 401, { ok: false, error: "Staff only (nd_is_staff)" });

    if (req.method === "GET") {
      const r = await fetch(SB_URL + "/rest/v1/nd_brokers?select=id,name,data&order=name.asc&limit=200", {
        headers: headers(SB_KEY)
      });
      const rows = await r.json();
      if (!r.ok) throw new Error((rows && rows.message) || "list failed");
      const brokers = (rows || []).map((row) => {
        const d = row.data || {};
        return {
          id: row.id,
          name: row.name || d.name || "",
          email: d.email || "",
          phone: d.phone || "",
          office: d.office || "",
          title: d.title || d.role || "",
          active: d.active !== false
        };
      });
      return send(res, 200, { ok: true, brokers });
    }

    if (req.method !== "POST") return send(res, 405, { ok: false, error: "GET or POST" });

    const body = await readBody(req);
    if ((body.action || "create") !== "create") {
      return send(res, 400, { ok: false, error: "Unknown action" });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim() || email.split("@")[0];
    const phone = String(body.phone || "").trim();
    const office = String(body.office || "Шумен").trim();
    const title = String(body.title || "Брокер").trim();
    const role = String(body.role || "broker").trim() === "admin" ? "admin" : "broker";

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return send(res, 400, { ok: false, error: "Invalid email" });
    }
    if (password.length < 8) {
      return send(res, 400, { ok: false, error: "Password must be at least 8 characters" });
    }

    const service = SR();
    if (!service) {
      return send(res, 503, {
        ok: false,
        error: "SUPABASE_SERVICE_ROLE_KEY missing on server — required for Auth admin createUser. Never put it in Electron."
      });
    }

    // 1) Auth user via Admin API
    const createRes = await fetch(SB_URL + "/auth/v1/admin/users", {
      method: "POST",
      headers: {
        apikey: service,
        Authorization: "Bearer " + service,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role, office, title, source: "settings-brokers" }
      })
    });
    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      return send(res, createRes.status === 422 ? 409 : 500, {
        ok: false,
        error: (created && (created.msg || created.error_description || created.message)) || "Auth createUser failed"
      });
    }
    const userId = created.id || (created.user && created.user.id);
    if (!userId) return send(res, 500, { ok: false, error: "Auth user id missing in response" });

    // 2) Staff row → nd_is_staff()
    const staffRes = await fetch(SB_URL + "/rest/v1/nd_staff", {
      method: "POST",
      headers: headers(service, "resolution=merge-duplicates,return=representation"),
      body: JSON.stringify({ user_id: userId, role })
    });
    const staffBody = await staffRes.json().catch(() => ({}));
    if (!staffRes.ok) {
      return send(res, 500, {
        ok: false,
        error: "Auth user created but nd_staff insert failed: " + ((staffBody && staffBody.message) || staffRes.status),
        user_id: userId
      });
    }

    // 3) CRM broker card
    const brokerId = newId();
    const data = {
      id: brokerId,
      name,
      title,
      role: title,
      pos: title,
      phone,
      email,
      office,
      photo: "avatar.jpg",
      thumb: "avatar.jpg",
      rating: 5,
      reviews: 0,
      sales: true,
      rent: true,
      active: true,
      perms: ["Огледи", "Клиенти", "Публикации"],
      restr: [],
      clients: [],
      deals: 0,
      listings: 0,
      user_id: userId
    };
    const brokerRes = await fetch(SB_URL + "/rest/v1/nd_brokers", {
      method: "POST",
      headers: headers(service, "return=representation"),
      body: JSON.stringify({ id: brokerId, name, data, created_by: userId })
    });
    const brokerBody = await brokerRes.json().catch(() => ({}));
    if (!brokerRes.ok) {
      return send(res, 500, {
        ok: false,
        error: "Auth+staff ok but nd_brokers insert failed: " + ((brokerBody && brokerBody.message) || brokerRes.status),
        user_id: userId
      });
    }

    return send(res, 200, {
      ok: true,
      email,
      user_id: userId,
      broker_id: brokerId,
      role
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e.message || e) });
  }
};
