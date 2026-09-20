// Автоматизация №7 — Автоматично публикуване на обяви към портали.
// Feed портали получават XML/JSON от нашия публичен endpoint, API порталите се извикват директно.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions, listAiProviders } from "@/lib/ai-provider";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: unknown) => any;
  };

export const SITE_URL = "https://imotinadezhda.bg";
const JOB_KEY = "portals_sync";

// ------------------------------------------------------------------
// Настройки
// ------------------------------------------------------------------
export type PortalSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  batch_size: number;
  auto_queue: boolean;
  auto_remove_sold: boolean;
  min_price: number;
  require_cover_image: boolean;
  retry_limit: number;
  resync_hours: number;
  lease_seconds: number;
};

export const DEFAULT_PORTALS: PortalSettings = {
  enabled: true,
  ai_enabled: true,
  batch_size: 20,
  auto_queue: true,
  auto_remove_sold: true,
  min_price: 1000,
  require_cover_image: true,
  retry_limit: 3,
  resync_hours: 24,
  lease_seconds: 300,
};

export async function getPortalSettings(): Promise<PortalSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", "portals")
    .maybeSingle();
  return { ...DEFAULT_PORTALS, ...((data?.value ?? {}) as Partial<PortalSettings>) };
}

export async function savePortalSettings(patch: Partial<PortalSettings>): Promise<PortalSettings> {
  const next = { ...(await getPortalSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert(
      { key: "portals", value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

// ------------------------------------------------------------------
// Състояние на фоновата задача
// ------------------------------------------------------------------
export type PortalJobState = {
  key: string;
  paused: boolean;
  paused_reason: string | null;
  paused_at: string | null;
  last_run_at: string | null;
  locked_until: string | null;
  stats: Record<string, number | string | boolean | null>;
};

export async function getPortalJobState(): Promise<PortalJobState> {
  const { data } = await db().from("automation_jobs").select("*").eq("key", JOB_KEY).maybeSingle();
  return {
    key: JOB_KEY,
    paused: Boolean(data?.paused),
    paused_reason: data?.paused_reason ?? null,
    paused_at: data?.paused_at ?? null,
    last_run_at: data?.last_run_at ?? null,
    locked_until: data?.locked_until ?? null,
    stats: (data?.stats ?? {}) as Record<string, number | string | boolean | null>,
  };
}

async function claimJob(leaseSeconds: number): Promise<boolean> {
  const { data, error } = await db().rpc("claim_automation_job", {
    _key: JOB_KEY,
    _lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(`Не може да се заеме задачата: ${error.message}`);
  return Boolean(data);
}

async function releaseJob(stats: Record<string, number | string | boolean | null>) {
  await db()
    .from("automation_jobs")
    .upsert(
      {
        key: JOB_KEY,
        locked_until: null,
        last_run_at: new Date().toISOString(),
        stats,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
}

export async function pausePortalJob(reason: string) {
  await db()
    .from("automation_jobs")
    .upsert(
      {
        key: JOB_KEY,
        paused: true,
        paused_reason: reason,
        paused_at: new Date().toISOString(),
        locked_until: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
}

export async function resumePortalJob() {
  await db()
    .from("automation_jobs")
    .upsert(
      {
        key: JOB_KEY,
        paused: false,
        paused_reason: null,
        paused_at: null,
        locked_until: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
  return getPortalJobState();
}

// ------------------------------------------------------------------
// Помощни
// ------------------------------------------------------------------
const PROPERTY_SELECT =
  "id, title, description, price, currency, property_type, status, rooms, bedrooms, bathrooms, area_sqm, built_up_area_sqm, yard_sqm, floor, total_floors, year_built, construction_type, heating, address, amenities, cover_image_url, is_published, portals_enabled, updated_at, cities:city_id(name), quarters:quarter_id(name)";

export const xmlEsc = (s: unknown) =>
  String(s ?? "").replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
  );

async function hash(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}

async function logSync(entry: {
  portal_id?: string | null;
  property_id?: string | null;
  listing_id?: string | null;
  action: string;
  status?: string;
  http_status?: number | null;
  message?: string | null;
  payload?: unknown;
  duration_ms?: number | null;
  actor?: string;
}) {
  await db()
    .from("portal_sync_log")
    .insert({
      portal_id: entry.portal_id ?? null,
      property_id: entry.property_id ?? null,
      listing_id: entry.listing_id ?? null,
      action: entry.action,
      status: entry.status ?? "ok",
      http_status: entry.http_status ?? null,
      message: entry.message ?? null,
      payload: entry.payload ?? null,
      duration_ms: entry.duration_ms ?? null,
      actor: entry.actor ?? "automation",
    });
}

export function propertyUrl(p: any): string {
  return `${SITE_URL}/imot/${p.id}`;
}

function locationOf(p: any): string {
  return [p.cities?.name, p.quarters?.name].filter(Boolean).join(", ");
}

// ------------------------------------------------------------------
// Портали
// ------------------------------------------------------------------
export async function listPortals() {
  const { data } = await db()
    .from("listing_portals")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data ?? []) as any[];
}

export async function getPortalByCode(code: string) {
  const { data } = await db().from("listing_portals").select("*").eq("code", code).maybeSingle();
  return data ?? null;
}

export async function savePortal(id: string, patch: Record<string, unknown>) {
  const { error } = await db()
    .from("listing_portals")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}

// ------------------------------------------------------------------
// Подготовка на обявата (payload + AI текст)
// ------------------------------------------------------------------
export type BuiltListing = {
  payload: Record<string, unknown>;
  hash: string;
  ai_title: string | null;
  ai_description: string | null;
  ai_used: boolean;
  blocked?: string;
};

const TYPE_LABEL: Record<string, string> = {
  apartment: "Апартамент",
  house: "Къща",
  villa: "Вила",
  office: "Офис",
  shop: "Магазин",
  land: "Парцел",
  garage: "Гараж",
  industrial: "Индустриален имот",
};

export async function buildListingPayload(
  property: any,
  portal: any,
  settings: PortalSettings,
): Promise<BuiltListing> {
  const base = {
    reference: String(property.id).slice(0, 8).toUpperCase(),
    title: property.title,
    description: property.description ?? "",
    type: TYPE_LABEL[String(property.property_type)] ?? String(property.property_type ?? ""),
    price: Math.round(Number(property.price ?? 0) * (1 + Number(portal.price_markup ?? 0) / 100)),
    currency: property.currency ?? "EUR",
    city: property.cities?.name ?? "",
    quarter: property.quarters?.name ?? "",
    address: property.address ?? "",
    area_sqm: property.area_sqm ?? null,
    built_up_area_sqm: property.built_up_area_sqm ?? null,
    yard_sqm: property.yard_sqm ?? null,
    rooms: property.rooms ?? null,
    bedrooms: property.bedrooms ?? null,
    bathrooms: property.bathrooms ?? null,
    floor: property.floor ?? null,
    total_floors: property.total_floors ?? null,
    year_built: property.year_built ?? null,
    construction: property.construction_type ?? null,
    heating: property.heating ?? null,
    amenities: property.amenities ?? [],
    image: property.cover_image_url ?? null,
    url: propertyUrl(property),
    agency: "Имоти Надежда",
    agency_phone: "+359 899 800 500",
    updated_at: property.updated_at,
  };

  let aiTitle: string | null = null;
  let aiDescription: string | null = null;
  let aiUsed = false;
  let blocked: string | undefined;

  if (settings.ai_enabled && portal.ai_copy && listAiProviders().length > 0) {
    try {
      const res = await aiChatCompletions({
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content:
              'Ти си копирайтър за обяви за недвижими имоти в България. Върни строг JSON: {"title": string (до 70 символа), "description": string (140–220 думи)}. Използвай само подадените факти, без измислени детайли, без емоджи, без цена в заглавието. Пиши на български, конкретно и продаващо.',
          },
          {
            role: "user",
            content: `Портал: ${portal.name}\nИмот: ${JSON.stringify({ ...base, description: String(base.description).slice(0, 1200) })}`,
          },
        ],
      });
      if (!res.ok) {
        if (res.status === 402 || res.status === 403)
          blocked = `AI е блокиран (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`;
      } else {
        const json = (await res.json()) as any;
        const raw = String(json?.choices?.[0]?.message?.content ?? "");
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]) as { title?: string; description?: string };
          aiTitle = parsed.title?.slice(0, 120) ?? null;
          aiDescription = parsed.description?.slice(0, 4000) ?? null;
          aiUsed = Boolean(aiTitle || aiDescription);
        }
      }
    } catch {
      /* при AI грешка използваме оригиналния текст */
    }
  }

  const payload: Record<string, unknown> = {
    ...base,
    title: aiTitle ?? base.title,
    description: aiDescription ?? base.description,
    original_title: base.title,
  };

  // Приложение на картата на полетата на портала (field_map: { "външно_име": "вътрешно_име" })
  const map = (portal.field_map ?? {}) as Record<string, string>;
  const mapped: Record<string, unknown> = Object.keys(map).length
    ? Object.fromEntries(Object.entries(map).map(([ext, int]) => [ext, payload[int] ?? null]))
    : payload;

  return {
    payload: mapped,
    hash: await hash(JSON.stringify(mapped)),
    ai_title: aiTitle,
    ai_description: aiDescription,
    ai_used: aiUsed,
    blocked,
  };
}

// ------------------------------------------------------------------
// Опашка
// ------------------------------------------------------------------
export function isEligible(p: any, settings: PortalSettings): { ok: boolean; reason?: string } {
  if (!p.is_published) return { ok: false, reason: "Имотът не е публикуван на сайта" };
  if (p.portals_enabled === false) return { ok: false, reason: "Изключен от синхронизация" };
  if (["sold", "rented", "archived", "reserved"].includes(String(p.status)))
    return { ok: false, reason: `Статус: ${p.status}` };
  if (Number(p.price ?? 0) < settings.min_price)
    return { ok: false, reason: "Цената е под минималната" };
  if (settings.require_cover_image && !p.cover_image_url)
    return { ok: false, reason: "Липсва основна снимка" };
  return { ok: true };
}

export async function queueProperties(
  opts: { portalId?: string; propertyIds?: string[] } = {},
): Promise<{ queued: number; skipped: number }> {
  const settings = await getPortalSettings();
  const portals = (await listPortals()).filter(
    (p) => p.is_active && (!opts.portalId || p.id === opts.portalId),
  );
  if (portals.length === 0) return { queued: 0, skipped: 0 };

  let q = db().from("properties").select(PROPERTY_SELECT).limit(1000);
  if (opts.propertyIds?.length) q = q.in("id", opts.propertyIds);
  else q = q.eq("is_published", true);
  const { data: props } = await q;

  let queued = 0;
  let skipped = 0;
  for (const p of (props ?? []) as any[]) {
    const eligible = isEligible(p, settings);
    for (const portal of portals) {
      const { data: existing } = await db()
        .from("portal_listings")
        .select("id, status")
        .eq("portal_id", portal.id)
        .eq("property_id", p.id)
        .maybeSingle();
      if (!eligible.ok) {
        skipped++;
        if (
          existing &&
          ["published", "updated", "queued"].includes(String(existing.status)) &&
          settings.auto_remove_sold
        ) {
          await db()
            .from("portal_listings")
            .update({
              status: "queued",
              priority: 10,
              updated_at: new Date().toISOString(),
              last_error: eligible.reason,
            })
            .eq("id", existing.id);
        }
        continue;
      }
      if (existing && ["queued", "pending_approval"].includes(String(existing.status))) continue;
      if (existing) {
        await db()
          .from("portal_listings")
          .update({ status: "queued", last_error: null, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await db()
          .from("portal_listings")
          .insert({ portal_id: portal.id, property_id: p.id, status: "queued", priority: 100 });
      }
      queued++;
    }
  }
  await logSync({
    action: "queue",
    message: `Поставени в опашка: ${queued}, пропуснати: ${skipped}`,
  });
  return { queued, skipped };
}

// ------------------------------------------------------------------
// Изпращане на една обява
// ------------------------------------------------------------------
export type PushResult =
  | "published"
  | "updated"
  | "removed"
  | "manual"
  | "unchanged"
  | "error"
  | "blocked"
  | "skipped";

export async function pushListing(
  listingId: string,
): Promise<{ result: PushResult; detail?: string }> {
  const settings = await getPortalSettings();
  const started = Date.now();
  const { data: listing } = await db()
    .from("portal_listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { result: "skipped", detail: "Няма такава обява" };

  const [{ data: portal }, { data: property }] = await Promise.all([
    db().from("listing_portals").select("*").eq("id", listing.portal_id).maybeSingle(),
    db().from("properties").select(PROPERTY_SELECT).eq("id", listing.property_id).maybeSingle(),
  ]);
  if (!portal || !portal.is_active) return { result: "skipped", detail: "Порталът е неактивен" };
  if (!property) {
    await db()
      .from("portal_listings")
      .update({ status: "removed", removed_at: new Date().toISOString() })
      .eq("id", listing.id);
    return { result: "removed", detail: "Имотът е изтрит" };
  }

  const eligible = isEligible(property, settings);
  const wasLive = ["published", "updated"].includes(String(listing.status));

  // Сваляне на обявата, ако имотът вече не е подходящ
  if (!eligible.ok) {
    const now = new Date().toISOString();
    if (portal.kind === "api" && wasLive && portal.endpoint_url && listing.external_id) {
      const r = await callPortalApi(portal, "remove", {
        external_id: listing.external_id,
        reference: String(property.id).slice(0, 8).toUpperCase(),
      });
      await logSync({
        portal_id: portal.id,
        property_id: property.id,
        listing_id: listing.id,
        action: "remove",
        status: r.ok ? "ok" : "error",
        http_status: r.status,
        message: r.message,
        duration_ms: Date.now() - started,
      });
    }
    await db()
      .from("portal_listings")
      .update({
        status: "removed",
        removed_at: now,
        updated_at: now,
        last_error: eligible.reason ?? null,
      })
      .eq("id", listing.id);
    return { result: "removed", detail: eligible.reason };
  }

  const built = await buildListingPayload(property, portal, settings);
  if (built.blocked) {
    await pausePortalJob(built.blocked);
    return { result: "blocked", detail: built.blocked };
  }

  // Няма промяна и е синхронизирано скоро → пропускаме
  const fresh =
    listing.content_hash === built.hash &&
    wasLive &&
    listing.last_synced_at &&
    Date.now() - new Date(listing.last_synced_at).getTime() < settings.resync_hours * 3600_000;
  if (fresh) {
    await db()
      .from("portal_listings")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", listing.id);
    return { result: "unchanged" };
  }

  const now = new Date().toISOString();
  const common = {
    payload: built.payload,
    content_hash: built.hash,
    ai_title: built.ai_title,
    ai_description: built.ai_description,
    ai_used: built.ai_used,
    price_at_publish: (built.payload as any).price ?? property.price,
    last_synced_at: now,
    updated_at: now,
    attempts: Number(listing.attempts ?? 0) + 1,
  };

  // Feed портали: обявата влиза автоматично в публичния фид
  if (portal.kind === "feed") {
    await db()
      .from("portal_listings")
      .update({
        ...common,
        status: wasLive ? "updated" : "published",
        published_at: listing.published_at ?? now,
        external_url: propertyUrl(property),
        last_error: null,
      })
      .eq("id", listing.id);
    await afterPublish(
      portal,
      property,
      listing.id,
      wasLive ? "update" : "publish",
      0,
      Date.now() - started,
    );
    return { result: wasLive ? "updated" : "published" };
  }

  // Ръчни портали: подготвяме текста и чакаме брокер
  if (portal.kind === "manual") {
    await db()
      .from("portal_listings")
      .update({ ...common, status: "pending_approval", last_error: null })
      .eq("id", listing.id);
    await logSync({
      portal_id: portal.id,
      property_id: property.id,
      listing_id: listing.id,
      action: "publish",
      status: "skipped",
      message: "Подготвено за ръчно публикуване",
      duration_ms: Date.now() - started,
    });
    return { result: "manual" };
  }

  // API портали
  if (!portal.endpoint_url) {
    await db()
      .from("portal_listings")
      .update({ ...common, status: "error", last_error: "Липсва endpoint на портала" })
      .eq("id", listing.id);
    return { result: "error", detail: "Липсва endpoint на портала" };
  }

  const r = await callPortalApi(portal, wasLive ? "update" : "publish", {
    ...built.payload,
    external_id: listing.external_id ?? null,
  });
  if (!r.ok) {
    const attempts = Number(listing.attempts ?? 0) + 1;
    await db()
      .from("portal_listings")
      .update({
        ...common,
        status: attempts >= settings.retry_limit ? "error" : "queued",
        last_error: r.message,
      })
      .eq("id", listing.id);
    await logSync({
      portal_id: portal.id,
      property_id: property.id,
      listing_id: listing.id,
      action: wasLive ? "update" : "publish",
      status: "error",
      http_status: r.status,
      message: r.message,
      duration_ms: Date.now() - started,
    });
    await db()
      .from("listing_portals")
      .update({ last_status: "error", last_error: r.message, last_sync_at: now })
      .eq("id", portal.id);
    return { result: "error", detail: r.message };
  }

  await db()
    .from("portal_listings")
    .update({
      ...common,
      status: wasLive ? "updated" : "published",
      published_at: listing.published_at ?? now,
      external_id: r.external_id ?? listing.external_id ?? null,
      external_url: r.external_url ?? listing.external_url ?? null,
      last_error: null,
    })
    .eq("id", listing.id);
  await afterPublish(
    portal,
    property,
    listing.id,
    wasLive ? "update" : "publish",
    r.status,
    Date.now() - started,
  );
  return { result: wasLive ? "updated" : "published" };
}

async function afterPublish(
  portal: any,
  property: any,
  listingId: string,
  action: string,
  httpStatus: number,
  ms: number,
) {
  const now = new Date().toISOString();
  await logSync({
    portal_id: portal.id,
    property_id: property.id,
    listing_id: listingId,
    action,
    status: "ok",
    http_status: httpStatus || null,
    message: `${portal.name}: ${action === "publish" ? "публикувано" : "обновено"}`,
    duration_ms: ms,
  });
  const { count } = await db()
    .from("portal_listings")
    .select("id", { count: "exact", head: true })
    .eq("portal_id", portal.id)
    .in("status", ["published", "updated"]);
  await db()
    .from("listing_portals")
    .update({
      last_sync_at: now,
      last_status: "ok",
      last_error: null,
      published_count: count ?? 0,
      updated_at: now,
    })
    .eq("id", portal.id);
  const { count: liveCount } = await db()
    .from("portal_listings")
    .select("id", { count: "exact", head: true })
    .eq("property_id", property.id)
    .in("status", ["published", "updated"]);
  await db()
    .from("properties")
    .update({ last_portal_sync_at: now, portal_published_count: liveCount ?? 0 })
    .eq("id", property.id);
}

async function callPortalApi(
  portal: any,
  action: string,
  body: Record<string, unknown>,
): Promise<{
  ok: boolean;
  status: number;
  message: string;
  external_id?: string | null;
  external_url?: string | null;
}> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = portal.credentials_env ? process.env[String(portal.credentials_env)] : undefined;
  if (portal.auth_type === "bearer" && secret) headers["Authorization"] = `Bearer ${secret}`;
  else if (portal.auth_type === "basic" && secret) headers["Authorization"] = `Basic ${secret}`;
  else if (portal.auth_type === "header" && secret)
    headers[String(portal.auth_header || "X-Api-Key")] = secret;
  else if (portal.auth_type !== "none" && !secret) {
    return {
      ok: false,
      status: 0,
      message: `Липсва секрет ${portal.credentials_env ?? "(незададен)"} в средата`,
    };
  }

  try {
    const res = await fetch(String(portal.endpoint_url), {
      method: "POST",
      headers,
      body: JSON.stringify({ action, listing: body }),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* порталът може да върне текст */
    }
    if (!res.ok)
      return {
        ok: false,
        status: res.status,
        message: `HTTP ${res.status}: ${text.slice(0, 300)}`,
      };
    return {
      ok: true,
      status: res.status,
      message: "OK",
      external_id: json?.id ?? json?.external_id ?? null,
      external_url: json?.url ?? json?.external_url ?? null,
    };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
  }
}

// ------------------------------------------------------------------
// Cron цикъл
// ------------------------------------------------------------------
export async function runPortalsSync(limitOverride?: number): Promise<{
  ran: boolean;
  reason?: string;
  queued: number;
  processed: number;
  published: number;
  updated: number;
  removed: number;
  manual: number;
  unchanged: number;
  errors: number;
  paused?: boolean;
}> {
  const settings = await getPortalSettings();
  const empty = {
    queued: 0,
    processed: 0,
    published: 0,
    updated: 0,
    removed: 0,
    manual: 0,
    unchanged: 0,
    errors: 0,
  };
  if (!settings.enabled) return { ran: false, reason: "Автоматизацията е изключена", ...empty };

  const state = await getPortalJobState();
  const probeOnly = state.paused;
  if (!(await claimJob(settings.lease_seconds)))
    return { ran: false, reason: "Друг цикъл вече работи", ...empty };

  const limit = Math.min(Math.max(limitOverride ?? settings.batch_size, 1), 100);
  const stats = { ...empty };

  try {
    if (!probeOnly && settings.auto_queue) {
      const q = await queueProperties();
      stats.queued = q.queued;
    }

    const { data: due } = await db()
      .from("portal_listings")
      .select("id")
      .in("status", ["queued"])
      .order("priority", { ascending: true })
      .order("updated_at", { ascending: true })
      .limit(probeOnly ? 1 : limit);

    for (const l of (due ?? []) as any[]) {
      stats.processed++;
      const res = await pushListing(l.id as string);
      if (res.result === "published") stats.published++;
      else if (res.result === "updated") stats.updated++;
      else if (res.result === "removed") stats.removed++;
      else if (res.result === "manual") stats.manual++;
      else if (res.result === "unchanged") stats.unchanged++;
      else if (res.result === "error") stats.errors++;
      else if (res.result === "blocked") {
        await releaseJob({ ...stats, blocked: res.detail ?? null, at: new Date().toISOString() });
        return { ran: true, reason: res.detail, paused: true, ...stats };
      }
    }

    if (probeOnly && stats.published + stats.updated > 0) await resumePortalJob();
    await releaseJob({ ...stats, at: new Date().toISOString(), probe: probeOnly });
    return {
      ran: true,
      reason: probeOnly ? "Пробен цикъл (автоматизацията е на пауза)" : undefined,
      ...stats,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await releaseJob({ ...stats, error: detail, at: new Date().toISOString() });
    throw new Error(detail);
  }
}

// ------------------------------------------------------------------
// Генериране на фид за портал
// ------------------------------------------------------------------
export async function buildPortalFeed(
  code: string,
  token: string | null,
): Promise<{ status: number; body: string; contentType: string }> {
  const portal = await getPortalByCode(code);
  if (!portal)
    return { status: 404, body: "Порталът не е намерен", contentType: "text/plain; charset=utf-8" };
  if (!portal.is_active)
    return { status: 403, body: "Фидът е спрян", contentType: "text/plain; charset=utf-8" };
  if (portal.feed_token && portal.feed_token !== token)
    return { status: 401, body: "Невалиден токен", contentType: "text/plain; charset=utf-8" };

  const { data: rows } = await db()
    .from("portal_listings")
    .select("payload, external_url, published_at, updated_at, property_id")
    .eq("portal_id", portal.id)
    .in("status", ["published", "updated"])
    .order("updated_at", { ascending: false })
    .limit(Math.min(Number(portal.max_listings ?? 500), 2000));

  const items = ((rows ?? []) as any[]).map((r) => ({
    ...(r.payload ?? {}),
    url: r.external_url ?? r.payload?.url,
    updated_at: r.updated_at,
  }));
  await logSync({
    portal_id: portal.id,
    action: "feed_pull",
    message: `Фид отдаден с ${items.length} обяви`,
  });
  await db()
    .from("listing_portals")
    .update({ last_sync_at: new Date().toISOString(), last_status: "ok" })
    .eq("id", portal.id);

  if (portal.feed_format === "json") {
    return {
      status: 200,
      body: JSON.stringify(
        {
          agency: "Имоти Надежда",
          generated_at: new Date().toISOString(),
          count: items.length,
          listings: items,
        },
        null,
        2,
      ),
      contentType: "application/json; charset=utf-8",
    };
  }

  if (portal.feed_format === "csv") {
    const keys = Array.from(new Set(items.flatMap((i) => Object.keys(i))));
    const csv = [
      keys.join(","),
      ...items.map((i) =>
        keys.map((k) => `"${String((i as any)[k] ?? "").replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    return { status: 200, body: csv, contentType: "text/csv; charset=utf-8" };
  }

  const xmlItems = items
    .map(
      (i) => `  <listing>
${Object.entries(i)
  .map(([k, v]) => `    <${k}>${Array.isArray(v) ? xmlEsc(v.join(", ")) : xmlEsc(v)}</${k}>`)
  .join("\n")}
  </listing>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<listings agency="Имоти Надежда" generated="${new Date().toISOString()}" count="${items.length}">
${xmlItems}
</listings>`;
  return { status: 200, body: xml, contentType: "application/xml; charset=utf-8" };
}

// ------------------------------------------------------------------
// Аналитика
// ------------------------------------------------------------------
export async function portalsAnalytics() {
  const [{ data: ls }, { data: logs }, { data: portals }] = await Promise.all([
    db()
      .from("portal_listings")
      .select("status, ai_used, published_at, updated_at, portal_id, last_error")
      .limit(5000),
    db().from("portal_sync_log").select("action, status, created_at, duration_ms").limit(2000),
    db()
      .from("listing_portals")
      .select("id, name, code, is_active, kind, last_sync_at, last_status")
      .limit(100),
  ]);
  const l = (ls ?? []) as any[];
  const g = (logs ?? []) as any[];
  const week = Date.now() - 7 * 86400_000;

  const byStatus: Record<string, number> = {};
  for (const x of l) byStatus[String(x.status)] = (byStatus[String(x.status)] ?? 0) + 1;

  const byPortal = ((portals ?? []) as any[]).map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    kind: p.kind,
    is_active: p.is_active,
    last_sync_at: p.last_sync_at,
    last_status: p.last_status,
    live: l.filter(
      (x) => x.portal_id === p.id && ["published", "updated"].includes(String(x.status)),
    ).length,
    queued: l.filter((x) => x.portal_id === p.id && x.status === "queued").length,
    errors: l.filter((x) => x.portal_id === p.id && x.status === "error").length,
  }));

  const durations = g
    .filter((x) => typeof x.duration_ms === "number")
    .map((x) => Number(x.duration_ms));
  const live = (byStatus["published"] ?? 0) + (byStatus["updated"] ?? 0);

  return {
    total: l.length,
    live,
    queued: byStatus["queued"] ?? 0,
    pendingApproval: byStatus["pending_approval"] ?? 0,
    removed: byStatus["removed"] ?? 0,
    errors: byStatus["error"] ?? 0,
    activePortals: byPortal.filter((p) => p.is_active).length,
    totalPortals: byPortal.length,
    publishedThisWeek: l.filter((x) => x.published_at && new Date(x.published_at).getTime() >= week)
      .length,
    syncedThisWeek: g.filter((x) => new Date(x.created_at).getTime() >= week && x.status === "ok")
      .length,
    errorsThisWeek: g.filter(
      (x) => new Date(x.created_at).getTime() >= week && x.status === "error",
    ).length,
    aiUsedPct: l.length ? Math.round((l.filter((x) => x.ai_used).length / l.length) * 100) : 0,
    avgDurationMs: durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0,
    byStatus,
    byPortal,
  };
}
