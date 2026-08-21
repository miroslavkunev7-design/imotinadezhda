import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GRAPH = "https://graph.facebook.com/v21.0";

export const FB_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_manage_metadata",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

export function metaApp() {
  const id = (process.env["META_APP_ID"] ?? "").trim();
  const secret = (process.env["META_APP_SECRET"] ?? "").trim();
  return { id, secret, ready: Boolean(id && secret) };
}

function stateSecret() {
  return (process.env["META_APP_SECRET"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "imnad-fb").slice(0, 64);
}

export function facebookRedirectUri(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/public/hooks/facebook-oauth`;
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

type FbPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
};

async function graphGet<T>(path: string, token: string, extra: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Facebook Graph ${res.status}`);
  return json;
}

async function storeFacebookPages(pages: FbPage[], userId: string | null) {
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
