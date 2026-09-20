// Автоматизация №14 — Събиране на Ревюта: Google / Facebook оценки след сделка.
// Без зависимост от Lovable: Supabase + конфигуриран AI провайдър + собствен email слой.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions } from "@/lib/ai-provider";
import { sendTransactionalEmail } from "@/lib/send-email";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: unknown) => any;
  };

export const SITE_URL = "https://imotinadezhda.bg";
const JOB_KEY = "review_collection_sweep";
const SETTINGS_KEY = "review_collection";

// ------------------------------------------------------------------
// Настройки
// ------------------------------------------------------------------
export type ReviewSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  auto_enroll_won_deals: boolean;
  delay_hours: number;
  reminder_after_days: number;
  max_steps: number;
  batch_size: number;
  lease_seconds: number;
  default_platform: string;
  gate_low_ratings: boolean;
  min_public_rating: number;
  auto_publish_min_rating: number;
  auto_ai_reply: boolean;
};

export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = {
  enabled: true,
  ai_enabled: true,
  auto_enroll_won_deals: true,
  delay_hours: 24,
  reminder_after_days: 5,
  max_steps: 2,
  batch_size: 10,
  lease_seconds: 300,
  default_platform: "google",
  gate_low_ratings: true,
  min_public_rating: 4,
  auto_publish_min_rating: 5,
  auto_ai_reply: true,
};

export async function getReviewSettings(): Promise<ReviewSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return { ...DEFAULT_REVIEW_SETTINGS, ...((data?.value ?? {}) as Partial<ReviewSettings>) };
}

export async function saveReviewSettings(patch: Partial<ReviewSettings>): Promise<ReviewSettings> {
  const next = { ...(await getReviewSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert(
      { key: SETTINGS_KEY, value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

// ------------------------------------------------------------------
// Задача
// ------------------------------------------------------------------
export async function getReviewJobState() {
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

export async function pauseReviewJob(reason: string) {
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

export async function resumeReviewJob() {
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
  return getReviewJobState();
}

async function logEvent(
  requestId: string | null,
  reviewId: string | null,
  dealId: string | null,
  action: string,
  status: string,
  message?: string | null,
  actor?: string | null,
) {
  await db()
    .from("review_events")
    .insert({
      request_id: requestId,
      review_id: reviewId,
      deal_id: dealId,
      action,
      status,
      message: message ?? null,
      actor: actor ?? "system",
    });
}

// ------------------------------------------------------------------
// Помощни
// ------------------------------------------------------------------
export async function listPlatforms() {
  const { data, error } = await db()
    .from("review_platforms")
    .select("*")
    .order("priority", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listTemplates() {
  const { data, error } = await db()
    .from("review_templates")
    .select("*")
    .order("step_no", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function platformByCode(code: string) {
  const { data } = await db().from("review_platforms").select("*").eq("code", code).maybeSingle();
  return data ?? null;
}

async function pickTemplate(step: number, dealType: string | null, channel: string) {
  const { data } = await db()
    .from("review_templates")
    .select("*")
    .eq("is_active", true)
    .eq("channel", channel)
    .eq("step_no", step)
    .limit(20);
  const rows = data ?? [];
  return (
    rows.find((t: any) => t.deal_type === dealType) ?? rows.find((t: any) => !t.deal_type) ?? null
  );
}

function fillTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => vars[key] ?? "");
}

export function reviewLink(token: string) {
  return `${SITE_URL}/api/public/reviews/r/${token}`;
}

// ------------------------------------------------------------------
// Създаване на покани
// ------------------------------------------------------------------
export type CreateRequestInput = {
  dealId?: string | null;
  clientId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  channel?: string;
  platformCode?: string;
  step?: number;
  delayHours?: number;
  actor?: string | null;
};

export async function createReviewRequest(input: CreateRequestInput) {
  const settings = await getReviewSettings();
  let deal: any = null;
  if (input.dealId) {
    const { data } = await db()
      .from("deals")
      .select(
        "id, title, deal_type, client_id, property_id, owner_id, broker_id, status, closed_at, clients:client_id(id, full_name, email, phone)",
      )
      .eq("id", input.dealId)
      .maybeSingle();
    deal = data ?? null;
  }

  let client: any = deal?.clients ?? null;
  const clientId = input.clientId ?? deal?.client_id ?? null;
  if (!client && clientId) {
    const { data } = await db()
      .from("clients")
      .select("id, full_name, email, phone")
      .eq("id", clientId)
      .maybeSingle();
    client = data ?? null;
  }

  const name = input.contactName ?? client?.full_name ?? "клиент";
  const email = input.contactEmail ?? client?.email ?? null;
  const phone = input.contactPhone ?? client?.phone ?? null;
  const channel = input.channel ?? (email ? "email" : "sms");
  if (channel === "email" && !email) throw new Error("Липсва имейл за покана за ревю.");
  if (channel === "sms" && !phone) throw new Error("Липсва телефон за SMS покана.");

  const step = input.step ?? 1;
  const platformCode = input.platformCode ?? settings.default_platform;
  const delayHours = input.delayHours ?? settings.delay_hours;
  const scheduledAt = new Date(Date.now() + Math.max(0, delayHours) * 3600_000).toISOString();

  const { data: row, error } = await db()
    .from("review_requests")
    .insert({
      deal_id: deal?.id ?? input.dealId ?? null,
      client_id: clientId,
      owner_id: deal?.owner_id ?? null,
      property_id: deal?.property_id ?? null,
      broker_id: deal?.broker_id ?? null,
      contact_name: name,
      contact_email: email,
      contact_phone: phone,
      channel,
      platform_code: platformCode,
      step_no: step,
      status: "scheduled",
      scheduled_at: scheduledAt,
      created_by: input.actor ?? "system",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent(
    row.id,
    null,
    row.deal_id,
    "request_created",
    "ok",
    `${channel} · ${platformCode} · стъпка ${step}`,
    input.actor,
  );
  return row;
}

// ------------------------------------------------------------------
// Изпращане
// ------------------------------------------------------------------
function fallbackBody(name: string, link: string) {
  return {
    subject: `Как оценявате работата ни, ${name}?`,
    body: `Здравейте, ${name},\n\nБлагодарим Ви за доверието към „Имоти Надежда“. Ще се радваме да отделите минута и да ни оцените:\n\n${link}\n\nПоздрави,\nЕкип „Имоти Надежда“`,
  };
}

async function aiPersonalize(name: string, context: string, link: string) {
  const res = await aiChatCompletions({
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content:
          "Ти пишеш кратки, топли и професионални имейли на български за агенция за недвижими имоти „Имоти Надежда“. Отговаряш само с валиден JSON.",
      },
      {
        role: "user",
        content: `Напиши покана за оценка (Google/Facebook ревю) до клиент.
Име: ${name}
Контекст на сделката: ${context || "приключена сделка"}
Линк за оценка (използвай го точно): ${link}
Върни само JSON: {"subject":"...","body":"..."} — до 90 думи, без измислени факти, без емоджи.`,
      },
    ],
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const json = (await res.json()) as any;
  const raw = String(json?.choices?.[0]?.message?.content ?? "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    const body = String(parsed.body ?? "").trim();
    if (!body) return null;
    return {
      subject: String(parsed.subject ?? `Оценете ни, ${name}`).trim(),
      body: body.includes(link) ? body : `${body}\n\n${link}`,
      model: String(json?.model ?? ""),
    };
  } catch {
    return null;
  }
}

function emailHtml(name: string, bodyText: string, link: string) {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#3a2b2e;font-size:15px;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
  const stars = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<a href="${link}?rating=${n}" style="text-decoration:none;font-size:26px;color:#c9a84c;padding:0 4px" aria-label="${n} звезди">★</a>`,
    )
    .join("");
  return `<div style="max-width:640px;margin:0 auto;background:#fffaf2;padding:26px;font-family:system-ui,-apple-system,Segoe UI,sans-serif;border:1px solid #e6d3ae;border-radius:16px">
  <div style="background:#8b1a2b;color:#fffaf2;padding:16px 20px;border-radius:12px;margin-bottom:20px">
    <div style="font-size:12px;letter-spacing:2px">НЕДВИЖИМИ ИМОТИ</div>
    <div style="font-size:22px;font-weight:700">НАДЕЖДА</div>
  </div>
  ${paragraphs}
  <div style="text-align:center;margin:22px 0">${stars}</div>
  <div style="text-align:center">
    <a href="${link}" style="display:inline-block;background:#8b1a2b;color:#fffaf2;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">Оценете ни</a>
  </div>
  <p style="margin-top:22px;font-size:12px;color:#7a6a5c;text-align:center">„Имоти Надежда“ · imotinadezhda.bg</p>
</div>`;
}

export async function sendReviewRequest(requestId: string, actor?: string | null) {
  const settings = await getReviewSettings();
  const { data: req, error } = await db()
    .from("review_requests")
    .select("*, deals:deal_id(title, deal_type, agreed_price, currency)")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!req) throw new Error("Поканата не е намерена.");
  if (req.status === "opted_out") throw new Error("Клиентът е отказал комуникация.");

  const platform = (await platformByCode(req.platform_code)) ?? {
    name: "Google",
    review_url: null,
  };
  const link = reviewLink(req.token);
  const name = req.contact_name ?? "клиент";
  const dealTitle = req.deals?.title ?? "";
  const template = await pickTemplate(
    Number(req.step_no ?? 1),
    req.deals?.deal_type ?? null,
    req.channel,
  );

  let subject: string | null = null;
  let body = "";
  let aiUsed = false;
  let model: string | null = null;

  if (template) {
    const vars = {
      name,
      review_link: link,
      platform: platform.name ?? "Google",
      property_line: dealTitle ? ` за „${dealTitle}“` : "",
    };
    subject = template.subject ? fillTemplate(template.subject, vars) : null;
    body = fillTemplate(template.body, vars);
  }

  if (settings.ai_enabled && req.channel === "email") {
    try {
      const ai = await aiPersonalize(name, dealTitle, link);
      if (ai) {
        subject = ai.subject;
        body = ai.body;
        aiUsed = true;
        model = ai.model || null;
      }
    } catch (e) {
      await logEvent(
        req.id,
        null,
        req.deal_id,
        "ai_personalize",
        "warn",
        (e as Error).message,
        actor,
      );
    }
  }

  if (!body) {
    const fb = fallbackBody(name, link);
    subject = subject ?? fb.subject;
    body = fb.body;
  }
  subject = subject ?? `Оценете ни, ${name}`;

  try {
    if (req.channel === "email") {
      await sendTransactionalEmail({
        to: req.contact_email,
        subject,
        html: emailHtml(name, body, link),
        text: body,
        purpose: "review_request",
        label: `review-${req.step_no}`,
        idempotency_key: `review-${req.id}-${req.step_no}`,
      });
    } else {
      // SMS каналът се обслужва външно — записваме съдържанието за ръчно/интеграционно изпращане.
      await logEvent(req.id, null, req.deal_id, "sms_queued", "ok", body.slice(0, 200), actor);
    }
  } catch (e) {
    await db()
      .from("review_requests")
      .update({
        status: "failed",
        attempts: Number(req.attempts ?? 0) + 1,
        error: (e as Error).message,
        subject,
        body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    await logEvent(req.id, null, req.deal_id, "request_send", "error", (e as Error).message, actor);
    throw e;
  }

  const { data: updated } = await db()
    .from("review_requests")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      attempts: Number(req.attempts ?? 0) + 1,
      error: null,
      subject,
      body,
      ai_used: aiUsed,
      model,
      template_code: template?.code ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.id)
    .select("*")
    .single();
  await logEvent(
    req.id,
    null,
    req.deal_id,
    "request_send",
    "ok",
    `${req.channel} · ${req.contact_email ?? req.contact_phone ?? ""}`,
    actor,
  );
  return updated;
}

// ------------------------------------------------------------------
// Публичен поток (клик, рейтинг, отзив)
// ------------------------------------------------------------------
export async function getRequestByToken(token: string) {
  const { data } = await db().from("review_requests").select("*").eq("token", token).maybeSingle();
  return data ?? null;
}

export async function registerClick(token: string) {
  const req = await getRequestByToken(token);
  if (!req) return null;
  await db()
    .from("review_requests")
    .update({
      status: req.status === "rated" || req.status === "completed" ? req.status : "clicked",
      clicked_at: req.clicked_at ?? new Date().toISOString(),
      click_count: Number(req.click_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.id);
  await logEvent(req.id, null, req.deal_id, "link_click", "ok", null, "public");
  return req;
}

function sentimentFor(rating: number, text: string): string {
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return text ? "negative" : "negative";
}

export async function submitRating(input: {
  token: string;
  rating: number;
  feedback?: string | null;
  authorName?: string | null;
}) {
  const settings = await getReviewSettings();
  const req = await getRequestByToken(input.token);
  if (!req) throw new Error("Невалиден линк.");
  const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 0)));
  const feedback = (input.feedback ?? "").trim() || null;
  const sentiment = sentimentFor(rating, feedback ?? "");
  const platform = await platformByCode(req.platform_code);
  const minRedirect = Number(platform?.min_rating_to_redirect ?? settings.min_public_rating);
  const redirect = settings.gate_low_ratings ? rating >= minRedirect : true;

  await db()
    .from("review_requests")
    .update({
      status: feedback || !redirect ? "completed" : "rated",
      rating,
      rated_at: new Date().toISOString(),
      feedback,
      sentiment,
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.id);

  const autoPublish = rating >= Number(settings.auto_publish_min_rating);
  const { data: review } = await db()
    .from("reviews")
    .insert({
      request_id: req.id,
      deal_id: req.deal_id,
      client_id: req.client_id,
      broker_id: req.broker_id,
      platform_code: redirect ? req.platform_code : "internal",
      author_name: input.authorName ?? req.contact_name ?? "Клиент",
      author_email: req.contact_email,
      rating,
      body: feedback,
      sentiment,
      source: "internal",
      is_public: autoPublish && Boolean(feedback),
      status: autoPublish && feedback ? "published" : "new",
    })
    .select("*")
    .single();

  await logEvent(
    req.id,
    review?.id ?? null,
    req.deal_id,
    "rating_submitted",
    "ok",
    `${rating}/5 · ${sentiment}`,
    "public",
  );

  if (rating <= 2) {
    await logEvent(
      req.id,
      review?.id ?? null,
      req.deal_id,
      "alert_low_rating",
      "warn",
      `Ниска оценка ${rating}/5 — нужна реакция.`,
      "system",
    );
  }

  return {
    rating,
    redirect,
    review_url: redirect ? (platform?.review_url ?? null) : null,
    platform_name: platform?.name ?? "Google",
    reviewId: review?.id ?? null,
  };
}

// ------------------------------------------------------------------
// Ревюта — управление
// ------------------------------------------------------------------
export async function listReviews(filters: { status?: string; platform?: string } = {}) {
  let q = db()
    .from("reviews")
    .select("*, clients:client_id(full_name), deals:deal_id(title)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.platform) q = q.eq("platform_code", filters.platform);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setReviewStatus(
  reviewId: string,
  patch: { status?: string; is_public?: boolean; is_featured?: boolean },
  actor?: string | null,
) {
  const { data, error } = await db()
    .from("reviews")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", reviewId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent(
    null,
    reviewId,
    data?.deal_id ?? null,
    "review_status",
    "ok",
    JSON.stringify(patch),
    actor,
  );
  return data;
}

export async function generateReviewReply(reviewId: string, actor?: string | null) {
  const { data: review } = await db().from("reviews").select("*").eq("id", reviewId).maybeSingle();
  if (!review) throw new Error("Ревюто не е намерено.");
  const res = await aiChatCompletions({
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          "Ти отговаряш публично на ревюта от името на българска агенция за недвижими имоти „Имоти Надежда“. Тонът е учтив, кратък и конкретен. Отговаряш само с текста на отговора.",
      },
      {
        role: "user",
        content: `Оценка: ${review.rating}/5\nПлатформа: ${review.platform_code}\nАвтор: ${review.author_name ?? "клиент"}\nТекст: ${review.body ?? "(без текст)"}\n\nНапиши отговор до 60 думи на български.`,
      },
    ],
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const json = (await res.json()) as any;
  const reply = String(json?.choices?.[0]?.message?.content ?? "").trim();
  if (!reply) throw new Error("AI не върна отговор.");
  const { data, error } = await db()
    .from("reviews")
    .update({ ai_reply: reply, updated_at: new Date().toISOString() })
    .eq("id", reviewId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent(
    null,
    reviewId,
    review.deal_id ?? null,
    "ai_reply",
    "ok",
    reply.slice(0, 200),
    actor,
  );
  return data;
}

export async function importExternalReview(input: {
  platformCode: string;
  authorName: string;
  rating: number;
  body?: string | null;
  externalUrl?: string | null;
  actor?: string | null;
}) {
  const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 5)));
  const { data, error } = await db()
    .from("reviews")
    .insert({
      platform_code: input.platformCode,
      author_name: input.authorName,
      rating,
      body: input.body ?? null,
      sentiment: sentimentFor(rating, input.body ?? ""),
      source: input.platformCode === "internal" ? "manual" : input.platformCode,
      external_url: input.externalUrl ?? null,
      is_public: rating >= 4,
      status: rating >= 4 ? "published" : "new",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent(
    null,
    data.id,
    null,
    "review_imported",
    "ok",
    `${input.platformCode} · ${rating}/5`,
    input.actor,
  );
  return data;
}

// ------------------------------------------------------------------
// Аналитика
// ------------------------------------------------------------------
export async function getReviewAnalytics() {
  const [{ data: requests }, { data: reviews }] = await Promise.all([
    db()
      .from("review_requests")
      .select(
        "id, status, rating, channel, platform_code, step_no, sent_at, clicked_at, rated_at, created_at",
      )
      .limit(2000),
    db()
      .from("reviews")
      .select("id, rating, platform_code, status, is_public, sentiment, created_at")
      .limit(2000),
  ]);
  const reqs = requests ?? [];
  const revs = reviews ?? [];
  const sent = reqs.filter((r: any) => r.sent_at).length;
  const clicked = reqs.filter((r: any) => r.clicked_at).length;
  const rated = reqs.filter((r: any) => r.rating).length;
  const ratings = revs
    .map((r: any) => Number(r.rating))
    .filter((n: number) => Number.isFinite(n) && n > 0);
  const byPlatform: Record<string, { count: number; avg: number }> = {};
  for (const r of revs) {
    const key = String(r.platform_code ?? "internal");
    const cur = byPlatform[key] ?? { count: 0, avg: 0 };
    const total = cur.avg * cur.count + Number(r.rating ?? 0);
    cur.count += 1;
    cur.avg = Math.round((total / cur.count) * 10) / 10;
    byPlatform[key] = cur;
  }
  const distribution = [1, 2, 3, 4, 5].reduce<Record<string, number>>((acc, n) => {
    acc[String(n)] = revs.filter((r: any) => Number(r.rating) === n).length;
    return acc;
  }, {});
  return {
    requests_total: reqs.length,
    sent,
    clicked,
    rated,
    pending: reqs.filter((r: any) => r.status === "pending" || r.status === "scheduled").length,
    failed: reqs.filter((r: any) => r.status === "failed").length,
    click_rate: sent ? Math.round((clicked / sent) * 100) : 0,
    rating_rate: sent ? Math.round((rated / sent) * 100) : 0,
    reviews_total: revs.length,
    reviews_public: revs.filter((r: any) => r.is_public && r.status === "published").length,
    avg_rating: ratings.length
      ? Math.round((ratings.reduce((s: number, n: number) => s + n, 0) / ratings.length) * 10) / 10
      : null,
    nps_positive: revs.filter((r: any) => r.sentiment === "positive").length,
    nps_negative: revs.filter((r: any) => r.sentiment === "negative").length,
    by_platform: byPlatform,
    distribution,
  };
}

// ------------------------------------------------------------------
// Фонов цикъл
// ------------------------------------------------------------------
export async function runReviewSweep(limitOverride?: number) {
  const settings = await getReviewSettings();
  const job = await getReviewJobState();
  if (!settings.enabled) return { skipped: "disabled" as const };
  if (job.paused) return { skipped: "paused" as const, reason: job.paused_reason };
  if (!(await claimJob(settings.lease_seconds))) return { skipped: "locked" as const };

  const stats = { enrolled: 0, sent: 0, reminders: 0, failed: 0 };
  try {
    // 1) Автоматично записване на приключени сделки
    if (settings.auto_enroll_won_deals) {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data: deals } = await db()
        .from("deals")
        .select("id, client_id, closed_at, status")
        .eq("status", "won")
        .gte("closed_at", since)
        .limit(50);
      for (const deal of deals ?? []) {
        const { data: existing } = await db()
          .from("review_requests")
          .select("id")
          .eq("deal_id", deal.id)
          .limit(1);
        if (existing && existing.length) continue;
        try {
          await createReviewRequest({ dealId: deal.id, actor: "auto-enroll" });
          stats.enrolled += 1;
        } catch (e) {
          await logEvent(
            null,
            null,
            deal.id,
            "auto_enroll",
            "error",
            (e as Error).message,
            "system",
          );
        }
      }
    }

    // 2) Дължими покани
    const { data: due } = await db()
      .from("review_requests")
      .select("id, step_no")
      .in("status", ["pending", "scheduled"])
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(limitOverride ?? settings.batch_size);
    for (const req of due ?? []) {
      try {
        await sendReviewRequest(req.id, "cron");
        stats.sent += 1;
      } catch {
        stats.failed += 1;
      }
    }

    // 3) Напомняния
    if (settings.max_steps > 1) {
      const cutoff = new Date(Date.now() - settings.reminder_after_days * 86_400_000).toISOString();
      const { data: stale } = await db()
        .from("review_requests")
        .select(
          "id, deal_id, client_id, contact_name, contact_email, contact_phone, channel, platform_code, step_no",
        )
        .eq("status", "sent")
        .eq("step_no", 1)
        .lte("sent_at", cutoff)
        .limit(limitOverride ?? settings.batch_size);
      for (const req of stale ?? []) {
        const { data: already } = await db()
          .from("review_requests")
          .select("id")
          .eq("deal_id", req.deal_id)
          .eq("step_no", 2)
          .limit(1);
        if (already && already.length) continue;
        try {
          const created = await createReviewRequest({
            dealId: req.deal_id,
            clientId: req.client_id,
            contactName: req.contact_name,
            contactEmail: req.contact_email,
            contactPhone: req.contact_phone,
            channel: req.channel,
            platformCode: req.platform_code,
            step: 2,
            delayHours: 0,
            actor: "cron-reminder",
          });
          await sendReviewRequest(created.id, "cron-reminder");
          stats.reminders += 1;
        } catch {
          stats.failed += 1;
        }
      }
    }

    // 4) AI отговори на нови публични ревюта
    if (settings.auto_ai_reply) {
      const { data: fresh } = await db()
        .from("reviews")
        .select("id")
        .is("ai_reply", null)
        .eq("status", "published")
        .limit(5);
      for (const r of fresh ?? []) {
        try {
          await generateReviewReply(r.id, "cron");
        } catch {
          /* AI грешките не спират цикъла */
        }
      }
    }

    await releaseJob({ ...stats, ran_at: new Date().toISOString() });
    return stats;
  } catch (e) {
    await releaseJob({ ...stats, error: (e as Error).message });
    throw e;
  }
}
