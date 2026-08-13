// Server-only helper for sending Web Push via VAPID.
// Filename ends with .server.ts so it is blocked from client bundles.
import webpush from "web-push";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || "mailto:agenciq_nadejdi@abv.bg";
  if (!pub || !priv) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
}

export interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

export async function sendPush(sub: PushSub, payload: PushPayload): Promise<{ ok: boolean; gone?: boolean }> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 },
    );
    return { ok: true };
  } catch (e: any) {
    const code = e?.statusCode ?? 0;
    return { ok: false, gone: code === 404 || code === 410 };
  }
}
