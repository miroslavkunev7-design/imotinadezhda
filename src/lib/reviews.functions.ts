// Автоматизация №14 — API слой (typed RPC) за модула „Събиране на ревюта“.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const listReviewRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("review_requests")
      .select(
        "id, created_at, updated_at, deal_id, client_id, contact_name, contact_email, contact_phone, channel, template_code, platform_code, step_no, status, scheduled_at, sent_at, clicked_at, click_count, rating, rated_at, feedback, sentiment, ai_used, model, subject, body, token, attempts, error, deals:deal_id(title, deal_type)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listReviewsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; platform?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listReviews } = await import("@/lib/reviews.server");
    return listReviews(data);
  });

export const listReviewPlatformsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listPlatforms } = await import("@/lib/reviews.server");
    return listPlatforms();
  });

export const listReviewTemplatesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listTemplates } = await import("@/lib/reviews.server");
    return listTemplates();
  });

export const listReviewEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("review_events")
      .select("id, created_at, action, status, message, actor, request_id, review_id, deal_id")
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listReviewDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("deals")
      .select(
        "id, deal_number, title, deal_type, status, closed_at, clients:client_id(id, full_name, email, phone)",
      )
      .order("closed_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getReviewConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getReviewSettings, getReviewJobState } = await import("@/lib/reviews.server");
    return { settings: await getReviewSettings(), job: await getReviewJobState() };
  });

export const saveReviewConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveReviewSettings } = await import("@/lib/reviews.server");
    return saveReviewSettings(data as any);
  });

export const getReviewAnalyticsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getReviewAnalytics } = await import("@/lib/reviews.server");
    return getReviewAnalytics();
  });

export const createReviewRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      dealId?: string | null;
      clientId?: string | null;
      contactName?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      channel?: string;
      platformCode?: string;
      delayHours?: number;
      sendNow?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { createReviewRequest, sendReviewRequest } = await import("@/lib/reviews.server");
    const actor = actorEmail(context.claims) ?? "crm";
    const created = await createReviewRequest({
      ...data,
      delayHours: data.sendNow ? 0 : data.delayHours,
      actor,
    });
    if (data.sendNow) return sendReviewRequest(created.id, actor);
    return created;
  });

export const sendReviewRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { requestId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { sendReviewRequest } = await import("@/lib/reviews.server");
    return sendReviewRequest(data.requestId, actorEmail(context.claims));
  });

export const setReviewStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { reviewId: string; status?: string; isPublic?: boolean; isFeatured?: boolean }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { setReviewStatus } = await import("@/lib/reviews.server");
    const patch: Record<string, unknown> = {};
    if (data.status) patch["status"] = data.status;
    if (typeof data.isPublic === "boolean") patch["is_public"] = data.isPublic;
    if (typeof data.isFeatured === "boolean") patch["is_featured"] = data.isFeatured;
    return setReviewStatus(data.reviewId, patch as any, actorEmail(context.claims));
  });

export const generateReviewReplyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reviewId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generateReviewReply } = await import("@/lib/reviews.server");
    return generateReviewReply(data.reviewId, actorEmail(context.claims));
  });

export const importExternalReviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      platformCode: string;
      authorName: string;
      rating: number;
      body?: string | null;
      externalUrl?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { importExternalReview } = await import("@/lib/reviews.server");
    return importExternalReview({ ...data, actor: actorEmail(context.claims) });
  });

export const runReviewSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runReviewSweep } = await import("@/lib/reviews.server");
    return runReviewSweep(data.limit);
  });

export const resumeReviewJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeReviewJob } = await import("@/lib/reviews.server");
    return resumeReviewJob();
  });
