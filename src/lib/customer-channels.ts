/** Outbound adapters for WhatsApp, Messenger, Viber. Never log tokens. */

export type AssistantChannel = "site" | "whatsapp" | "messenger" | "viber";

export function isQuietHours(d = new Date()) {
  const start = process.env.ASSISTANT_QUIET_HOURS_START || "17:30";
  const end = process.env.ASSISTANT_QUIET_HOURS_END || "08:30";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const minutes =
    Number(parts.find((p) => p.type === "hour")?.value ?? 0) * 60 +
    Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const a = toMin(start);
  const b = toMin(end);
  if (a === b) return false;
  if (a < b) return minutes >= a && minutes < b;
  return minutes >= a || minutes < b;
}

export function envPresent(name: string) {
  const v = process.env[name];
  return Boolean(v && String(v).trim());
}

export function channelStatus() {
  return {
    site: { ready: true, send: true as const, hint: "Публичният чат на сайта работи локално." },
    whatsapp: {
      ready: envPresent("WHATSAPP_TOKEN") && envPresent("WHATSAPP_PHONE_NUMBER_ID"),
      verify: envPresent("WHATSAPP_VERIFY_TOKEN"),
      send: envPresent("WHATSAPP_TOKEN") && envPresent("WHATSAPP_PHONE_NUMBER_ID"),
      hint: "Ако липсват ключове: входящите се записват, изходящите — през wa.me.",
      waMe: "https://wa.me/359885774863",
    },
    messenger: {
      ready: envPresent("FACEBOOK_PAGE_ACCESS_TOKEN") || envPresent("META_APP_ID"),
      verify: envPresent("FACEBOOK_VERIFY_TOKEN") || envPresent("WHATSAPP_VERIFY_TOKEN"),
      send: envPresent("FACEBOOK_PAGE_ACCESS_TOKEN"),
      hint: "PAGE token се взима и от свързана Facebook страница в Разпръскване.",
    },
    viber: {
      ready: envPresent("VIBER_AUTH_TOKEN") || envPresent("VIBER_TOKEN"),
      send: envPresent("VIBER_AUTH_TOKEN") || envPresent("VIBER_TOKEN"),
      hint: "Свържи с VIBER_AUTH_TOKEN в .env — webhook-ът е готов.",
    },
  };
}

export function viberAuthToken() {
  return (process.env.VIBER_AUTH_TOKEN ?? process.env.VIBER_TOKEN ?? "").trim();
}

export function facebookVerifyToken() {
  return (
    process.env.FACEBOOK_VERIFY_TOKEN ??
    process.env.WHATSAPP_VERIFY_TOKEN ??
    process.env.META_VERIFY_TOKEN ??
    ""
  ).trim();
}

function isLocalHost(url: string) {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Meta hub.verify — on localhost echo challenge even without token. */
export function verifyMetaHub(requestUrl: string, expected: string) {
  const url = new URL(requestUrl);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || !challenge) return null;
  if (expected && token === expected) return challenge;
  if (!expected && isLocalHost(requestUrl)) return challenge;
  return null;
}

export async function sendWhatsAppText(toDigits: string, text: string) {
  const token = process.env.WHATSAPP_TOKEN ?? "";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  if (!token || !phoneId || !toDigits) {
    console.info("[assistant] WhatsApp outbound skipped (no token or empty recipient)");
    return { sent: false as const, reason: "missing_token" };
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toDigits,
      type: "text",
      text: { body: text.slice(0, 1000) },
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("[assistant] WhatsApp send failed", res.status, err.slice(0, 180));
    return { sent: false as const, reason: "api_error" };
  }
  return { sent: true as const };
}

export async function sendMessengerText(psid: string, text: string, pageToken?: string | null) {
  const token = (pageToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "").trim();
  if (!token || !psid) {
    console.info("[assistant] Messenger outbound skipped (no page token)");
    return { sent: false as const, reason: "missing_token" };
  }
  const res = await fetch("https://graph.facebook.com/v21.0/me/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      messaging_type: "RESPONSE",
      message: { text: text.slice(0, 2000) },
      access_token: token,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("[assistant] Messenger send failed", res.status, err.slice(0, 180));
    return { sent: false as const, reason: "api_error" };
  }
  return { sent: true as const };
}

export async function sendViberText(receiverId: string, text: string) {
  const token = viberAuthToken();
  if (!token || !receiverId) {
    console.info("[assistant] Viber outbound skipped (no VIBER_AUTH_TOKEN)");
    return { sent: false as const, reason: "missing_token" };
  }
  const res = await fetch("https://chatapi.viber.com/pa/send_message", {
    method: "POST",
    headers: { "X-Viber-Auth-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      receiver: receiverId,
      type: "text",
      text: text.slice(0, 2000),
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.warn("[assistant] Viber send failed", res.status, err.slice(0, 180));
    return { sent: false as const, reason: "api_error" };
  }
  return { sent: true as const };
}

export async function sendChannelReply(
  channel: AssistantChannel,
  externalUserId: string | null | undefined,
  text: string,
  pageToken?: string | null,
) {
  if (!externalUserId) return { sent: false as const, reason: "no_recipient" };
  if (channel === "whatsapp") return sendWhatsAppText(externalUserId, text);
  if (channel === "messenger") return sendMessengerText(externalUserId, text, pageToken);
  if (channel === "viber") return sendViberText(externalUserId, text);
  return { sent: false as const, reason: "site" };
}
