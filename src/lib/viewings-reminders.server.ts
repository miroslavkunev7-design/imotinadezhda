import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmail } from "@/lib/send-email";

export type ViewingReminderKind = "day_before" | "hours_before";

export type ViewingReminderNotice = {
  viewingId: string;
  kind: ViewingReminderKind;
  title: string;
  body: string;
};

export type ViewingReminderResult = {
  fired: number;
  emails: number;
  pushed: number;
  notifications: ViewingReminderNotice[];
};

type Rel = { full_name?: string | null; email?: string | null; phone?: string | null; user_id?: string | null } | null;
type PropRel = { title?: string | null; address?: string | null } | null;

function oneRel<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" });
}

function viewingLabel(row: {
  property_title?: string | null;
  location?: string | null;
  properties?: PropRel;
  clients?: Rel;
}) {
  const prop = row.property_title || oneRel(row.properties)?.title || row.location || "имот";
  const client = oneRel(row.clients)?.full_name;
  return client ? `${client} · ${prop}` : prop;
}

async function enqueueOrSendEmail(opts: { to: string; subject: string; text: string; html: string; key: string }) {
  try {
    await sendTransactionalEmail({
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      label: "viewing-reminder",
      purpose: "viewing_reminder",
      message_id: opts.key,
      idempotency_key: opts.key,
    });
    return true;
  } catch {
    try {
      const { error } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: opts.to,
          subject: opts.subject,
          text: opts.text,
          html: opts.html,
          label: "viewing-reminder",
          message_id: opts.key,
          queued_at: new Date().toISOString(),
        },
      });
      return !error;
    } catch {
      return false;
    }
  }
}

async function pushToUser(userId: string | null | undefined, title: string, body: string, tag: string) {
  if (!userId) return 0;
  let sendPush: typeof import("@/lib/push.server").sendPush;
  try {
    ({ sendPush } = await import("@/lib/push.server"));
  } catch {
    return 0;
  }
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  let pushed = 0;
  for (const s of subs ?? []) {
    try {
      const r = await sendPush(s as { endpoint: string; p256dh: string; auth: string }, {
        title,
        body,
        url: "/admin/viewings",
        tag,
      });
      if (r.ok) pushed++;
      if (r.gone) await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", (s as { endpoint: string }).endpoint);
    } catch {
      /* VAPID missing or network */
    }
  }
  return pushed;
}

function copyFor(kind: ViewingReminderKind, label: string, when: string, location: string | null) {
  const loc = location ? `\nМясто: ${location}` : "";
  if (kind === "day_before") {
    return {
      title: `Оглед утре — ${label}`,
      body: `Утре в ${when}${loc}\nМоля потвърдете присъствието.`,
      subject: `Напомняне: оглед утре (${when})`,
    };
  }
  return {
    title: `Оглед след ~2 часа — ${label}`,
    body: `Днес в ${when}${loc}\nБрокерът ви очаква на място.`,
    subject: `Напомняне: оглед след около 2 часа (${when})`,
  };
}

/**
 * Fires viewing reminders:
 *  - day before (once the 24h window opens)
 *  - ~2 hours before
 * Idempotent via reminded_* columns. WhatsApp is skipped (no Business API wiring here).
 */
export async function runViewingReminders(): Promise<ViewingReminderResult> {
  const now = Date.now();
  const nowIso = new Date().toISOString();
  const from = new Date(now - 30 * 60 * 1000).toISOString();
  const to = new Date(now + 30 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("viewings")
    .select(
      "id, scheduled_at, location, notes, status, property_title, reminded_day_before_at, reminded_hours_before_at, broker_id, client_id, clients:client_id(full_name, email, phone), brokers:broker_id(full_name, email, phone, user_id), properties:property_id(title, address)",
    )
    .in("status", ["planned", "confirmed"])
    .gte("scheduled_at", from)
    .lte("scheduled_at", to);

  if (error || !data) {
    return { fired: 0, emails: 0, pushed: 0, notifications: [] };
  }

  const result: ViewingReminderResult = { fired: 0, emails: 0, pushed: 0, notifications: [] };

  for (const raw of data) {
    const row = raw as typeof raw & { clients: Rel; brokers: Rel; properties: PropRel };
    const dueMs = new Date(row.scheduled_at as string).getTime();
    if (!Number.isFinite(dueMs)) continue;

    const kinds: ViewingReminderKind[] = [];
    const hoursOpen = now >= dueMs - 2 * 60 * 60 * 1000 - 10 * 60 * 1000 && now <= dueMs + 20 * 60 * 1000;
    const dayOpen = now >= dueMs - 24 * 60 * 60 * 1000 && now < dueMs - 90 * 60 * 1000;

    if (!row.reminded_hours_before_at && hoursOpen) kinds.push("hours_before");
    if (!row.reminded_day_before_at && dayOpen) kinds.push("day_before");

    for (const kind of kinds) {
      const col = kind === "day_before" ? "reminded_day_before_at" : "reminded_hours_before_at";
      const { data: claimed } = await supabaseAdmin
        .from("viewings")
        .update({ [col]: nowIso })
        .eq("id", row.id)
        .is(col, null)
        .select("id")
        .maybeSingle();
      if (!claimed) continue;

      result.fired++;
      const client = oneRel(row.clients);
      const broker = oneRel(row.brokers);
      const prop = oneRel(row.properties);
      const label = viewingLabel({
        property_title: row.property_title ?? prop?.title,
        location: row.location,
        properties: prop,
        clients: client,
      });
      const when = fmtWhen(row.scheduled_at as string);
      const copy = copyFor(kind, label, when, (row.location as string | null) ?? prop?.address ?? null);
      const html = `<p>${copy.body.replace(/\n/g, "<br/>")}</p><p style="color:#8B1A2B">Имоти Надежда</p>`;

      result.notifications.push({
        viewingId: row.id as string,
        kind,
        title: copy.title,
        body: copy.body,
      });

      const recipients = [client?.email, broker?.email].filter((e, i, a) => e && a.indexOf(e) === i) as string[];
      for (const to of recipients) {
        const ok = await enqueueOrSendEmail({
          to,
          subject: copy.subject,
          text: copy.body,
          html,
          key: `viewing-${row.id}-${kind}-${to}`,
        });
        if (ok) result.emails++;
      }

      result.pushed += await pushToUser(broker?.user_id, copy.title, copy.body, `viewing-${row.id}-${kind}`);
    }
  }

  return result;
}
