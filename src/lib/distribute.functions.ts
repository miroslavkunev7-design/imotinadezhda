import { createHmac } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";
import { resolveServerDb, type ServerDb } from "@/lib/supabase-server-db";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SITE_URL } from "@/lib/site-config";

const GRAPH = "https://graph.facebook.com/v21.0";

export const PORTAL_DEFS = [
  { key: "facebook", label: "Facebook страница", kind: "oauth" as const, workerSite: "facebook" },
  { key: "instagram", label: "Instagram", kind: "oauth" as const, workerSite: "instagram" },
  { key: "imoti_bg", label: "imot.bg", kind: "login" as const, workerSite: "imot.bg" },
  { key: "imoti_net", label: "imoti.net", kind: "login" as const, workerSite: "imoti.net" },
  { key: "olx_bg", label: "OLX.bg", kind: "login" as const, workerSite: "olx.bg" },
  { key: "bazar_bg", label: "bazar.bg", kind: "login" as const, workerSite: "bazar.bg" },
  { key: "alo_bg", label: "alo.bg", kind: "login" as const, workerSite: "alo.bg" },
  { key: "home_bg", label: "home.bg", kind: "login" as const, workerSite: "home.bg" },
  { key: "imoti_info", label: "imoti.info", kind: "login" as const, workerSite: null },
  { key: "realistimo", label: "Realistimo", kind: "login" as const, workerSite: null },
] as const;

export type PortalKey = (typeof PORTAL_DEFS)[number]["key"];

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

async function gate(ctx: { userId: string; supabase: ServerDb; claims: unknown }) {
  await assertCrmAccess(ctx.userId, ctx.supabase, authEmail(ctx.claims));
  return resolveServerDb(ctx.supabase) as ServerDb & { from: (t: string) => any };
}

function maskEmail(email: string | null | undefined) {
  const e = (email ?? "").trim();
  if (!e || !e.includes("@")) return null;
  const [u, d] = e.split("@");
  const keep = u.slice(0, 2);
  return `${keep}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
}

function metaApp() {
  const id = (process.env["META_APP_ID"] ?? "").trim();
  const secret = (process.env["META_APP_SECRET"] ?? "").trim();
  return { id, secret, ready: Boolean(id && secret) };
}

function stateSecret() {
  return (process.env["META_APP_SECRET"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "imnad-fb").slice(0, 64);
}

export function signFacebookState(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readFacebookState(state: string | null): { t: number; origin: string; uid: string } | null {
  if (!state || !state.includes(".")) return null;
  const [body, sig] = state.split(".");
  const expect = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  if (expect !== sig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed?.origin || !parsed?.uid) return null;
    if (Date.now() - Number(parsed.t ?? 0) > 15 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function facebookRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/public/hooks/facebook-oauth`;
}

export const FB_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_manage_metadata",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

async function graphGet<T>(path: string, token: string, extra: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Facebook Graph ${res.status}`);
  return json;
}

async function graphPost<T>(path: string, token: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${GRAPH}${path.startsWith("/") ? path : `/${path}`}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Facebook Graph ${res.status}`);
  return json;
}

type FbPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
};

export async function storeFacebookPages(pages: FbPage[], userId: string | null) {
  const db = supabaseAdmin as any;
  const primary = pages[0];
  if (!primary) throw new Error("В този Facebook профил няма страница. Създайте Page и свържете отново.");

  await db.from("platform_connections").upsert(
    {
      platform_key: "facebook",
      is_connected: true,
      connect_status: "connected",
      connect_error: null,
      connected_at: new Date().toISOString(),
      connected_by: userId,
      username: primary.name,
      profile_url: `https://www.facebook.com/${primary.id}`,
      external_id: primary.id,
      access_token: primary.access_token,
      meta: {
        pages: pages.map((p) => ({
          id: p.id,
          name: p.name,
          ig: p.instagram_business_account?.id ?? null,
        })),
        selectedPageId: primary.id,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "platform_key" },
  );

  const ig = pages.find((p) => p.instagram_business_account?.id);
  if (ig?.instagram_business_account?.id) {
    await db.from("platform_connections").upsert(
      {
        platform_key: "instagram",
        is_connected: true,
        connect_status: "connected",
        connect_error: null,
        connected_at: new Date().toISOString(),
        connected_by: userId,
        username: ig.name,
        external_id: ig.instagram_business_account.id,
        access_token: ig.access_token,
        meta: { pageId: ig.id, igUserId: ig.instagram_business_account.id },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform_key" },
    );
  }

  await db.from("social_accounts").upsert(
    {
      platform: "facebook_page",
      display_name: primary.name,
      external_id: primary.id,
      access_token: primary.access_token,
      meta: { pages: pages.map((p) => ({ id: p.id, name: p.name })) },
      connected_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "platform,external_id" },
  );
}

export async function exchangeFacebookCode(code: string, origin: string, userId: string | null) {
  const { id, secret } = metaApp();
  if (!id || !secret) throw new Error("Липсват META_APP_ID / META_APP_SECRET в .env");
  const redirect = facebookRedirectUri(origin);

  const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", id);
  tokenUrl.searchParams.set("client_secret", secret);
  tokenUrl.searchParams.set("redirect_uri", redirect);
  tokenUrl.searchParams.set("code", code);
  const tokenRes = await fetch(tokenUrl);
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: { message?: string } };
  if (!tokenJson.access_token) throw new Error(tokenJson.error?.message ?? "Facebook не върна токен");

  const llUrl = new URL(`${GRAPH}/oauth/access_token`);
  llUrl.searchParams.set("grant_type", "fb_exchange_token");
  llUrl.searchParams.set("client_id", id);
  llUrl.searchParams.set("client_secret", secret);
  llUrl.searchParams.set("fb_exchange_token", tokenJson.access_token);
  const llRes = await fetch(llUrl);
  const llJson = (await llRes.json()) as { access_token?: string };
  const userToken = llJson.access_token || tokenJson.access_token;

  const accounts = await graphGet<{ data: FbPage[] }>("/me/accounts", userToken, {
    fields: "id,name,access_token,instagram_business_account",
  });
  const pages = accounts.data ?? [];
  await storeFacebookPages(pages, userId);
  return { pages: pages.map((p) => p.name) };
}

function listingCopy(property: {
  title?: string | null;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  area_sqm?: number | null;
  cities?: { name?: string | null } | null;
  quarters?: { name?: string | null } | null;
  id: string;
}) {
  const loc = [property.cities?.name, property.quarters?.name].filter(Boolean).join(", ");
  const price =
    property.price != null
      ? `${Number(property.price).toLocaleString("bg-BG")} ${property.currency || "EUR"}`
      : "";
  const area = property.area_sqm ? `${property.area_sqm} м²` : "";
  const url = `${SITE_URL}/properties/${property.id}`;
  const bits = [property.title, loc, [price, area].filter(Boolean).join(" · "), "", (property.description ?? "").slice(0, 900), "", `Виж обявата: ${url}`];
  return { message: bits.filter((b) => b !== undefined).join("\n").trim(), url };
}

async function postFacebook(pageId: string, token: string, message: string, imageUrl: string | null, link: string) {
  if (imageUrl) {
    const photo = await graphPost<{ id?: string; post_id?: string }>(`/${pageId}/photos`, token, {
      url: imageUrl,
      caption: message,
    });
    return `https://www.facebook.com/${photo.post_id || photo.id || pageId}`;
  }
  const feed = await graphPost<{ id?: string }>(`/${pageId}/feed`, token, { message, link });
  return `https://www.facebook.com/${feed.id || pageId}`;
}

async function postInstagram(igUserId: string, token: string, imageUrl: string, caption: string) {
  const created = await graphPost<{ id?: string }>(`/${igUserId}/media`, token, {
    image_url: imageUrl,
    caption: caption.slice(0, 2200),
  });
  if (!created.id) throw new Error("Instagram не прие снимката");
  const pub = await graphPost<{ id?: string }>(`/${igUserId}/media_publish`, token, { creation_id: created.id });
  return pub.id ? `https://www.instagram.com/p/${pub.id}/` : null;
}

export const listDistributeDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await gate(context);
    const [{ data: connections }, { data: properties }, { data: queue }] = await Promise.all([
      db.from("platform_connections").select(
        "id, platform_key, profile_url, username, email, is_connected, connect_status, connect_error, connected_at, notes, external_id, meta",
      ),
      db
        .from("properties")
        .select("id, title, price, currency, area_sqm, is_published, cover_image_url, cities(name), quarters(name)")
        .order("updated_at", { ascending: false })
        .limit(80),
      db
        .from("cross_post_queue")
        .select("id, property_id, site, status, external_url, error, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const byKey = new Map((connections ?? []).map((c: any) => [c.platform_key, c]));
    const portals = PORTAL_DEFS.map((def) => {
      const row = byKey.get(def.key);
      return {
        ...def,
        connected: Boolean(row?.is_connected),
        status: row?.connect_status ?? "idle",
        error: row?.connect_error ?? null,
        displayName: row?.username ?? null,
        emailMasked: maskEmail(row?.email),
        profileUrl: row?.profile_url ?? null,
        connectedAt: row?.connected_at ?? null,
        pageId: row?.external_id ?? null,
        pages: (row?.meta as { pages?: { id: string; name: string }[] } | null)?.pages ?? [],
      };
    });

    return {
      portals,
      facebookOAuthReady: metaApp().ready,
      properties: properties ?? [],
      queue: queue ?? [],
    };
  });

export const startFacebookConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    await gate(context);
    const { id, ready } = metaApp();
    if (!ready) {
      throw new Error(
        "За свързване на Facebook страница сложете META_APP_ID и META_APP_SECRET в .env (Meta for Developers → приложение → Facebook Login).",
      );
    }
    const origin = data.origin;
    const state = signFacebookState({ t: Date.now(), origin, uid: context.userId });
    const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    url.searchParams.set("client_id", id);
    url.searchParams.set("redirect_uri", facebookRedirectUri(origin));
    url.searchParams.set("state", state);
    url.searchParams.set("scope", FB_OAUTH_SCOPES);
    url.searchParams.set("response_type", "code");
    return { url: url.toString() };
  });

export const disconnectPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ platform_key: z.string().min(2) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await gate(context);
    const { error } = await db
      .from("platform_connections")
      .update({
        is_connected: false,
        connect_status: "idle",
        connect_error: null,
        access_token: null,
        password_secret: null,
        connected_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("platform_key", data.platform_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const savePortalLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        platform_key: z.string().min(2),
        email: z.union([z.literal(""), z.string().email()]).optional(),
        password: z.string().optional(),
        username: z.string().optional(),
        profile_url: z.union([z.literal(""), z.string().url()]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await gate(context);
    const patch: Record<string, unknown> = {
      platform_key: data.platform_key,
      email: data.email || null,
      username: data.username || null,
      profile_url: data.profile_url || null,
      is_connected: true,
      connect_status: "connected",
      connect_error: null,
      connected_at: new Date().toISOString(),
      connected_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    if ((data.password ?? "").length >= 3) patch.password_secret = data.password;
    const { error } = await db.from("platform_connections").upsert(patch, { onConflict: "platform_key" });
    if (error) throw new Error(error.message);

    if (data.email && data.password) {
      await db.from("portal_credentials").upsert(
        {
          platform: data.platform_key,
          login_email: data.email,
          login_secret: data.password,
          updated_by: context.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "platform" },
      );
    }
    return { ok: true };
  });

export const scatterListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        property_id: z.string().uuid(),
        channels: z.array(z.string()).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await gate(context);
    const { data: property, error: pErr } = await db
      .from("properties")
      .select("*, property_images(url, is_cover, display_order), cities(name), quarters(name)")
      .eq("id", data.property_id)
      .single();
    if (pErr || !property) throw new Error(pErr?.message ?? "Имотът не е намерен");

    const { data: connections } = await db.from("platform_connections").select("*");
    const byKey = new Map((connections ?? []).map((c: any) => [c.platform_key, c]));
    const { message, url } = listingCopy(property);
    const images = (property.property_images ?? [])
      .sort(
        (a: any, b: any) =>
          Number(b.is_cover) - Number(a.is_cover) || (a.display_order ?? 0) - (b.display_order ?? 0),
      )
      .map((i: any) => i.url as string);
    const cover = property.cover_image_url || images[0] || null;

    const results: { channel: string; ok: boolean; url?: string | null; error?: string }[] = [];

    for (const channel of data.channels) {
      const def = PORTAL_DEFS.find((p) => p.key === channel);
      if (channel === "facebook") {
        const row = byKey.get("facebook");
        if (!row?.is_connected || !row.access_token || !row.external_id) {
          results.push({ channel, ok: false, error: "Facebook страницата не е свързана" });
          continue;
        }
        try {
          const ext = await postFacebook(row.external_id, row.access_token, message, cover, url);
          await db.from("cross_post_queue").insert({
            property_id: data.property_id,
            site: "facebook",
            status: "published",
            external_url: ext,
            requested_by: context.userId,
          });
          results.push({ channel, ok: true, url: ext });
        } catch (e: any) {
          await db.from("cross_post_queue").insert({
            property_id: data.property_id,
            site: "facebook",
            status: "failed",
            error: e?.message ?? "Facebook грешка",
            requested_by: context.userId,
          });
          results.push({ channel, ok: false, error: e?.message ?? "Facebook грешка" });
        }
        continue;
      }

      if (channel === "instagram") {
        const row = byKey.get("instagram");
        if (!row?.is_connected || !row.access_token || !row.external_id) {
          results.push({ channel, ok: false, error: "Instagram не е свързан (свържете Facebook страница с бизнес профил)" });
          continue;
        }
        if (!cover) {
          results.push({ channel, ok: false, error: "Instagram иска снимка — качете корица на имота" });
          continue;
        }
        try {
          const ext = await postInstagram(row.external_id, row.access_token, cover, message);
          await db.from("cross_post_queue").insert({
            property_id: data.property_id,
            site: "instagram",
            status: "published",
            external_url: ext,
            requested_by: context.userId,
          });
          results.push({ channel, ok: true, url: ext });
        } catch (e: any) {
          await db.from("cross_post_queue").insert({
            property_id: data.property_id,
            site: "instagram",
            status: "failed",
            error: e?.message ?? "Instagram грешка",
            requested_by: context.userId,
          });
          results.push({ channel, ok: false, error: e?.message ?? "Instagram грешка" });
        }
        continue;
      }

      if (!def?.workerSite) {
        results.push({ channel, ok: false, error: "Този портал още няма автоматично публикуване" });
        continue;
      }
      const row = byKey.get(channel);
      if (!row?.is_connected) {
        results.push({ channel, ok: false, error: "Профилът не е свързан" });
        continue;
      }
      const { error } = await db.from("cross_post_queue").insert({
        property_id: data.property_id,
        site: def.workerSite,
        status: "queued",
        requested_by: context.userId,
      });
      if (error) results.push({ channel, ok: false, error: error.message });
      else results.push({ channel, ok: true });
    }

    return { results, preview: message, shareUrl: url };
  });
