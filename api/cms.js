// /api/cms — public read of CMS overrides + staff write for Settings app.
// Desktop never embeds service role; staff JWT + nd_is_staff for mutations.
const SB_URL = process.env.ND_SUPABASE_URL || "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = process.env.ND_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function headers(token, prefer) {
  const h = {
    apikey: SB_KEY,
    Authorization: "Bearer " + (token || SB_KEY),
    "Content-Type": "application/json"
  };
  if (prefer) h.Prefer = prefer;
  return h;
}

async function rest(path, opts) {
  const r = await fetch(SB_URL + "/rest/v1/" + path, opts);
  const text = await r.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch (e) { j = { message: text }; }
  if (!r.ok) throw new Error((j && (j.message || j.error_description || j.hint)) || ("HTTP " + r.status));
  return j;
}

async function readPage(slug) {
  const pages = await rest("cms_pages?slug=eq." + encodeURIComponent(slug) + "&select=*", { headers: headers() });
  const page = Array.isArray(pages) && pages[0] ? pages[0] : null;
  if (!page) return { page: null, components: [] };
  const components = await rest(
    "cms_components?page_id=eq." + encodeURIComponent(page.id) + "&select=*&order=sort_order.asc",
    { headers: headers() }
  );
  return { page, components: components || [] };
}

async function listPages() {
  return rest("cms_pages?select=*&order=label.asc", { headers: headers() });
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});

  try {
    if (req.method === "GET") {
      const url = new URL(req.url, "http://local");
      const action = url.searchParams.get("action") || "page";
      if (action === "pages") return send(res, 200, { ok: true, pages: await listPages() });
      if (action === "settings") {
        const id = url.searchParams.get("id");
        const q = id
          ? "cms_settings?id=eq." + encodeURIComponent(id) + "&select=*"
          : "cms_settings?select=*";
        return send(res, 200, { ok: true, settings: await rest(q, { headers: headers() }) });
      }
      if (action === "archives") {
        const token = bearer(req);
        if (!(await isStaff(token))) return send(res, 401, { ok: false, error: "Staff only" });
        const rows = await rest("cms_archives?select=*&order=archived_at.desc", { headers: headers(token) });
        return send(res, 200, { ok: true, archives: rows || [] });
      }
      const slug = url.searchParams.get("slug") || "/";
      const data = await readPage(slug);
      return send(res, 200, { ok: true, ...data });
    }

    if (req.method !== "POST") return send(res, 405, { ok: false, error: "GET or POST" });

    const token = bearer(req);
    if (!(await isStaff(token))) return send(res, 401, { ok: false, error: "Влезте в CRM като служител." });

    const body = await readBody(req);
    const action = body.action || "upsert_component";

    if (action === "upsert_component") {
      if (!body.page_slug || !body.component_key) return send(res, 400, { ok: false, error: "page_slug and component_key required" });
      let pageRows = await rest("cms_pages?slug=eq." + encodeURIComponent(body.page_slug) + "&select=*", { headers: headers(token) });
      let page = pageRows && pageRows[0];
      if (!page) {
        pageRows = await rest("cms_pages", {
          method: "POST",
          headers: headers(token, "return=representation"),
          body: JSON.stringify({ slug: body.page_slug, label: body.page_label || body.page_slug, schema_version: 1 })
        });
        page = Array.isArray(pageRows) ? pageRows[0] : pageRows;
      }
      const row = {
        page_id: page.id,
        component_key: body.component_key,
        type: body.type || "block",
        sort_order: body.sort_order != null ? body.sort_order : 0,
        rect: body.rect || {},
        props: body.props || {},
        updated_at: new Date().toISOString()
      };
      const saved = await rest("cms_components", {
        method: "POST",
        headers: headers(token, "resolution=merge-duplicates,return=representation"),
        body: JSON.stringify(row)
      });
      return send(res, 200, { ok: true, component: Array.isArray(saved) ? saved[0] : saved, page });
    }

    if (action === "upsert_setting") {
      if (!body.id) return send(res, 400, { ok: false, error: "id required" });
      const saved = await rest("cms_settings", {
        method: "POST",
        headers: headers(token, "resolution=merge-duplicates,return=representation"),
        body: JSON.stringify({ id: body.id, data: body.data || {}, updated_at: new Date().toISOString() })
      });
      return send(res, 200, { ok: true, setting: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === "archive") {
      if (!body.entity_type || !body.entity_id) return send(res, 400, { ok: false, error: "entity_type and entity_id required" });
      const saved = await rest("cms_archives", {
        method: "POST",
        headers: headers(token, "resolution=merge-duplicates,return=representation"),
        body: JSON.stringify({
          entity_type: body.entity_type,
          entity_id: String(body.entity_id),
          archived_at: new Date().toISOString(),
          payload: body.payload || {}
        })
      });
      return send(res, 200, { ok: true, archive: Array.isArray(saved) ? saved[0] : saved });
    }

    if (action === "unarchive") {
      await rest(
        "cms_archives?entity_type=eq." + encodeURIComponent(body.entity_type) + "&entity_id=eq." + encodeURIComponent(String(body.entity_id)),
        { method: "DELETE", headers: headers(token) }
      );
      return send(res, 200, { ok: true });
    }

    if (action === "add_asset") {
      const saved = await rest("cms_assets", {
        method: "POST",
        headers: headers(token, "return=representation"),
        body: JSON.stringify({
          path: body.path || "",
          url: body.url || null,
          mime: body.mime || null,
          bytes: body.bytes || null,
          meta: body.meta || {}
        })
      });
      return send(res, 200, { ok: true, asset: Array.isArray(saved) ? saved[0] : saved });
    }

    // Optional service-role path for bulk seed (still requires staff JWT)
    if (action === "seed_pages" && SR()) {
      return send(res, 200, { ok: true, pages: await listPages() });
    }

    return send(res, 400, { ok: false, error: "Unknown action" });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e.message || e) });
  }
};
