import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

export const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
export const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";

/** Prefer live API once deployed; fall back to direct Supabase REST for local/preview. */
export const CMS_API = (import.meta.env.VITE_CMS_API as string) || "https://imotinadezhda.bg/api/cms";

let sb: SupabaseClient | null = null;

export function client(): SupabaseClient {
  if (!sb) {
    sb = createClient(SB_URL, SB_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "nd-settings-auth" }
    });
  }
  return sb;
}

export type CmsPage = {
  id: string;
  slug: string;
  label: string;
  schema_version: number;
};

export type CmsComponent = {
  id: string;
  page_id: string;
  component_key: string;
  type: string;
  sort_order: number;
  rect: Record<string, unknown>;
  props: Record<string, unknown>;
};

export type CmsArchive = {
  id: string;
  entity_type: "property" | "client";
  entity_id: string;
  archived_at: string;
  payload: Record<string, unknown>;
};

async function token(): Promise<string | null> {
  const { data } = await client().auth.getSession();
  return data.session?.access_token || null;
}

export async function ensureStaff(): Promise<Session | null> {
  const { data } = await client().auth.getSession();
  if (!data.session) return null;
  const { data: ok, error } = await client().rpc("nd_is_staff");
  if (error || ok !== true) return null;
  return data.session;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
  const staff = await ensureStaff();
  if (!staff) {
    await client().auth.signOut();
    throw new Error("This account is not staff (nd_is_staff).");
  }
  return staff;
}

export async function signOut() {
  await client().auth.signOut();
}

export async function fetchPages(): Promise<CmsPage[]> {
  try {
    const r = await fetch(CMS_API + "?action=pages", { cache: "no-store" });
    const j = await r.json();
    if (j.ok && j.pages) return j.pages as CmsPage[];
  } catch { /* fall through */ }
  const { data, error } = await client().from("cms_pages").select("*").order("label");
  if (error) throw error;
  return (data || []) as CmsPage[];
}

export async function fetchComponents(slug: string): Promise<{ page: CmsPage | null; components: CmsComponent[] }> {
  try {
    const r = await fetch(CMS_API + "?action=page&slug=" + encodeURIComponent(slug), { cache: "no-store" });
    const j = await r.json();
    if (j.ok) return { page: j.page, components: j.components || [] };
  } catch { /* fall through */ }
  const { data: pages } = await client().from("cms_pages").select("*").eq("slug", slug).maybeSingle();
  if (!pages) return { page: null, components: [] };
  const { data: components } = await client()
    .from("cms_components")
    .select("*")
    .eq("page_id", pages.id)
    .order("sort_order");
  return { page: pages as CmsPage, components: (components || []) as CmsComponent[] };
}

export async function saveComponent(input: {
  page_slug: string;
  page_label?: string;
  component_key: string;
  type: string;
  sort_order?: number;
  rect?: Record<string, unknown>;
  props: Record<string, unknown>;
}) {
  const t = await token();
  if (!t) throw new Error("Not signed in");
  try {
    const r = await fetch(CMS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
      body: JSON.stringify({ action: "upsert_component", ...input })
    });
    if (r.ok) {
      const j = await r.json();
      if (j.ok) return j.component as CmsComponent;
    }
    // Production /api/cms may be undeployed (404) — fall through to RLS upsert.
  } catch {
    /* fall through to direct Supabase */
  }
  const { data: pageRow, error: pe } = await client()
    .from("cms_pages")
    .upsert({ slug: input.page_slug, label: input.page_label || input.page_slug, schema_version: 1 }, { onConflict: "slug" })
    .select("*")
    .single();
  if (pe) throw pe;
  const { data, error } = await client()
    .from("cms_components")
    .upsert(
      {
        page_id: pageRow.id,
        component_key: input.component_key,
        type: input.type,
        sort_order: input.sort_order ?? 0,
        rect: input.rect || {},
        props: input.props,
        updated_at: new Date().toISOString()
      },
      { onConflict: "page_id,component_key" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as CmsComponent;
}

export async function fetchSetting<T = Record<string, unknown>>(id: string): Promise<T | null> {
  const { data, error } = await client().from("cms_settings").select("data").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data?.data as T) || null;
}

export async function saveSetting(id: string, data: Record<string, unknown>) {
  const t = await token();
  if (!t) throw new Error("Not signed in");
  try {
    const r = await fetch(CMS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
      body: JSON.stringify({ action: "upsert_setting", id, data })
    });
    const j = await r.json();
    if (j.ok) return j.setting;
  } catch { /* fall through */ }
  const { data: row, error } = await client()
    .from("cms_settings")
    .upsert({ id, data, updated_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw error;
  return row;
}

export async function fetchArchives(): Promise<CmsArchive[]> {
  const t = await token();
  const { data, error } = await client().from("cms_archives").select("*").order("archived_at", { ascending: false });
  if (error) {
    if (t) {
      const r = await fetch(CMS_API + "?action=archives", { headers: { Authorization: "Bearer " + t } });
      const j = await r.json();
      if (j.ok) return j.archives;
    }
    throw error;
  }
  return (data || []) as CmsArchive[];
}

export async function archiveEntity(entity_type: "property" | "client", entity_id: string, payload: Record<string, unknown>) {
  const t = await token();
  if (!t) throw new Error("Not signed in");
  try {
    const r = await fetch(CMS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
      body: JSON.stringify({ action: "archive", entity_type, entity_id, payload })
    });
    const j = await r.json();
    if (j.ok) return j.archive;
  } catch { /* fall through */ }
  const { data, error } = await client()
    .from("cms_archives")
    .upsert({ entity_type, entity_id, payload, archived_at: new Date().toISOString() }, { onConflict: "entity_type,entity_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function unarchiveEntity(entity_type: "property" | "client", entity_id: string) {
  const t = await token();
  if (!t) throw new Error("Not signed in");
  try {
    await fetch(CMS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
      body: JSON.stringify({ action: "unarchive", entity_type, entity_id })
    });
  } catch { /* ignore */ }
  const { error } = await client().from("cms_archives").delete().eq("entity_type", entity_type).eq("entity_id", entity_id);
  if (error) throw error;
}

export async function listCrmProperties() {
  const { data, error } = await client().from("nd_properties").select("id,code,title,city,status,price").order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function listCrmClients() {
  const { data, error } = await client().from("nd_clients").select("id,name,phone,city,status").order("updated_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}

export async function fetchMortgageRates() {
  const { data, error } = await client().from("mortgage_rates").select("*").order("bank").limit(100);
  if (error) throw error;
  return data || [];
}

export function previewUrlForSlug(slug: string, origin = "https://imotinadezhda.bg") {
  if (slug === "/") return origin + "/";
  if (slug.startsWith("#/")) return origin + "/" + slug;
  if (slug.startsWith("/")) return origin + slug;
  return origin + "/" + slug;
}

export type BrokerCard = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  office?: string;
  title?: string;
  active?: boolean;
};

/** Prefer deployed /api/brokers; never call Auth Admin from Electron. */
export const BROKERS_API =
  (import.meta.env.VITE_BROKERS_API as string) || "https://imotinadezhda.bg/api/brokers";

export async function listBrokers(): Promise<BrokerCard[]> {
  const t = await token();
  try {
    const r = await fetch(BROKERS_API + "?action=list", {
      headers: t ? { Authorization: "Bearer " + t } : {},
      cache: "no-store"
    });
    const j = await r.json();
    if (j.ok && Array.isArray(j.brokers)) return j.brokers as BrokerCard[];
  } catch {
    /* fall through */
  }
  const { data, error } = await client().from("nd_brokers").select("id,name,data").order("name").limit(200);
  if (error) throw error;
  return (data || []).map((row) => {
    const d = (row.data || {}) as Record<string, unknown>;
    return {
      id: row.id,
      name: row.name || String(d.name || ""),
      email: typeof d.email === "string" ? d.email : undefined,
      phone: typeof d.phone === "string" ? d.phone : undefined,
      office: typeof d.office === "string" ? d.office : undefined,
      title: typeof d.title === "string" ? d.title : undefined,
      active: d.active !== false
    };
  });
}

export async function createBrokerProfile(input: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  office?: string;
  title?: string;
}): Promise<{ ok: true; email: string; user_id: string; broker_id: string }> {
  const t = await token();
  if (!t) throw new Error("Not signed in as staff");
  const r = await fetch(BROKERS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
    body: JSON.stringify({ action: "create", ...input })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) {
    throw new Error(
      (j && j.error) ||
        (r.status === 404
          ? "api/brokers not deployed yet — needs production deploy + SUPABASE_SERVICE_ROLE_KEY"
          : `Broker create failed (HTTP ${r.status})`)
    );
  }
  return j as { ok: true; email: string; user_id: string; broker_id: string };
}
