// Автоматизация №13 — Отчети към Собственици: автоматични отчети за интерес и огледи.
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
const JOB_KEY = "owner_reports_sweep";
const SETTINGS_KEY = "owner_reports";

// ------------------------------------------------------------------
// Настройки
// ------------------------------------------------------------------
export type OwnerReportSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  auto_send: boolean;
  batch_size: number;
  lease_seconds: number;
  default_template: string;
  default_frequency: "weekly" | "biweekly" | "monthly";
  period_days: number;
  send_hour: number;
  skip_empty_activity: boolean;
};

export const DEFAULT_OWNER_REPORTS: OwnerReportSettings = {
  enabled: true,
  ai_enabled: true,
  auto_send: true,
  batch_size: 5,
  lease_seconds: 300,
  default_template: "monthly_standard",
  default_frequency: "monthly",
  period_days: 30,
  send_hour: 9,
  skip_empty_activity: false,
};

export async function getOwnerReportSettings(): Promise<OwnerReportSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return { ...DEFAULT_OWNER_REPORTS, ...((data?.value ?? {}) as Partial<OwnerReportSettings>) };
}

export async function saveOwnerReportSettings(
  patch: Partial<OwnerReportSettings>,
): Promise<OwnerReportSettings> {
  const next = { ...(await getOwnerReportSettings()), ...patch };
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
// Състояние на фоновата задача
// ------------------------------------------------------------------
export async function getOwnerReportJobState() {
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

export async function pauseOwnerReportJob(reason: string) {
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

export async function resumeOwnerReportJob() {
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
  return getOwnerReportJobState();
}

async function logEvent(
  reportId: string | null,
  ownerId: string | null,
  action: string,
  status: string,
  message?: string | null,
  actor?: string | null,
) {
  await db()
    .from("owner_report_events")
    .insert({
      report_id: reportId,
      owner_id: ownerId,
      action,
      status,
      message: message ?? null,
      actor: actor ?? "system",
    });
}

// ------------------------------------------------------------------
// Данни
// ------------------------------------------------------------------
const PROPERTY_SELECT =
  "id, title, price, currency, property_type, status, is_published, views_count, cover_image_url, area_sqm, rooms, updated_at, created_at, cities:city_id(name), quarters:quarter_id(name)";

export async function listOwnersWithProperties() {
  const [{ data: owners, error: oErr }, { data: props, error: pErr }] = await Promise.all([
    db()
      .from("owners")
      .select("id, full_name, email, phone, notes, created_at")
      .order("full_name", { ascending: true })
      .limit(500),
    db().from("properties").select(PROPERTY_SELECT).not("owner_id", "is", null).limit(1000),
  ]);
  if (oErr) throw new Error(oErr.message);
  if (pErr) throw new Error(pErr.message);
  const ownerProps = new Map<string, any[]>();
  const { data: links } = await db()
    .from("properties")
    .select("id, owner_id")
    .not("owner_id", "is", null)
    .limit(1000);
  const byId = new Map((props ?? []).map((p: any) => [p.id, p]));
  for (const l of links ?? []) {
    const list = ownerProps.get(l.owner_id) ?? [];
    const prop = byId.get(l.id);
    if (prop) list.push(prop);
    ownerProps.set(l.owner_id, list);
  }
  return (owners ?? []).map((o: any) => ({ ...o, properties: ownerProps.get(o.id) ?? [] }));
}

export type PeriodMetrics = {
  properties: Array<{
    id: string;
    title: string;
    price: number | null;
    currency: string | null;
    city: string | null;
    quarter: string | null;
    is_published: boolean;
    views_total: number;
    inquiries: number;
    viewings: number;
    viewings_completed: number;
    viewings_no_show: number;
    matches: number;
    avg_rating: number | null;
    feedback: string[];
  }>;
  totals: {
    properties: number;
    inquiries: number;
    viewings: number;
    viewings_completed: number;
    viewings_no_show: number;
    matches: number;
    views_total: number;
    avg_rating: number | null;
  };
};

export async function collectOwnerMetrics(
  propertyIds: string[],
  periodStart: string,
  periodEnd: string,
): Promise<PeriodMetrics> {
  const empty: PeriodMetrics = {
    properties: [],
    totals: {
      properties: 0,
      inquiries: 0,
      viewings: 0,
      viewings_completed: 0,
      viewings_no_show: 0,
      matches: 0,
      views_total: 0,
      avg_rating: null,
    },
  };
  if (!propertyIds.length) return empty;

  const [{ data: props }, { data: inquiries }, { data: viewings }, { data: matches }] =
    await Promise.all([
      db().from("properties").select(PROPERTY_SELECT).in("id", propertyIds),
      db()
        .from("inquiries")
        .select("id, property_id, created_at")
        .in("property_id", propertyIds)
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd),
      db()
        .from("viewings")
        .select("id, property_id, status, rating, feedback, scheduled_at")
        .in("property_id", propertyIds)
        .gte("scheduled_at", periodStart)
        .lte("scheduled_at", periodEnd),
      db()
        .from("property_matches")
        .select("id, property_id, created_at")
        .in("property_id", propertyIds)
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd),
    ]);

  const rows: PeriodMetrics["properties"] = (props ?? []).map((p: any) => {
    const pv = (viewings ?? []).filter((v: any) => v.property_id === p.id);
    const ratings = pv
      .map((v: any) => Number(v.rating))
      .filter((n: number) => Number.isFinite(n) && n > 0);
    return {
      id: p.id as string,
      title: p.title as string,
      price: p.price ?? null,
      currency: p.currency ?? "EUR",
      city: p.cities?.name ?? null,
      quarter: p.quarters?.name ?? null,
      is_published: Boolean(p.is_published),
      views_total: Number(p.views_count ?? 0),
      inquiries: (inquiries ?? []).filter((i: any) => i.property_id === p.id).length,
      viewings: pv.length,
      viewings_completed: pv.filter((v: any) => v.status === "completed").length,
      viewings_no_show: pv.filter((v: any) => v.status === "no_show").length,
      matches: (matches ?? []).filter((m: any) => m.property_id === p.id).length,
      avg_rating: ratings.length
        ? Math.round((ratings.reduce((s: number, n: number) => s + n, 0) / ratings.length) * 10) /
          10
        : null,
      feedback: pv
        .map((v: any) => String(v.feedback ?? "").trim())
        .filter(Boolean)
        .slice(0, 6),
    };
  });

  const sum = (k: string) => rows.reduce((s: number, r: any) => s + Number(r[k] ?? 0), 0);
  const allRatings: number[] = rows
    .map((r) => r.avg_rating)
    .filter((n): n is number => typeof n === "number");

  return {
    properties: rows,
    totals: {
      properties: rows.length,
      inquiries: sum("inquiries"),
      viewings: sum("viewings"),
      viewings_completed: sum("viewings_completed"),
      viewings_no_show: sum("viewings_no_show"),
      matches: sum("matches"),
      views_total: sum("views_total"),
      avg_rating: allRatings.length
        ? Math.round(
            (allRatings.reduce((s: number, n: number) => s + n, 0) / allRatings.length) * 10,
          ) / 10
        : null,
    },
  };
}

// ------------------------------------------------------------------
// AI резюме
// ------------------------------------------------------------------
function safeJson(text: string): any | null {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function fallbackSummary(ownerName: string, m: PeriodMetrics, days: number) {
  const t = m.totals;
  const summary =
    `Здравейте, ${ownerName}. За последните ${days} дни по Вашите ${t.properties} имота регистрирахме ` +
    `${t.inquiries} запитвания, ${t.viewings} насрочени огледа (${t.viewings_completed} проведени) и ${t.matches} съвпадения с търсения на клиенти.`;
  const rec: string[] = [];
  if (t.inquiries === 0)
    rec.push(
      "Липсват запитвания — препоръчваме обновяване на снимките и преразглеждане на цената.",
    );
  if (t.viewings_no_show > 0)
    rec.push("Има неявили се клиенти — засилваме напомнянията преди огледите.");
  if (t.viewings_completed > 2 && t.inquiries > 3)
    rec.push("Интересът е висок — възможно е задържане на текущата цена.");
  if (!rec.length)
    rec.push("Продължаваме активното представяне на имота в порталите и към подходящите клиенти.");
  return { summary, recommendations: rec.join(" ") };
}

async function aiSummary(ownerName: string, template: any, m: PeriodMetrics, days: number) {
  const prompt = `Данни за отчет към собственик на имоти в България.
Собственик: ${ownerName}
Период: последните ${days} дни
Общо: ${JSON.stringify(m.totals)}
По имоти: ${JSON.stringify(m.properties.map((p) => ({ title: p.title, city: p.city, price: p.price, inquiries: p.inquiries, viewings: p.viewings, completed: p.viewings_completed, matches: p.matches, rating: p.avg_rating, feedback: p.feedback })))}
Тон: ${template?.tone ?? "professional"}.
Върни само JSON: {"summary": "3-5 изречения обобщение на български", "recommendations": "2-4 конкретни препоръки на български"}.
Използвай само подадените данни, без измислени факти.`;

  const res = await aiChatCompletions({
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          "Ти си консултант на българска агенция за недвижими имоти „Имоти Надежда“. Пишеш ясни и конкретни отчети към собственици на български език. Отговаряш само с валиден JSON.",
      },
      { role: "user", content: prompt },
    ],
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as any;
  const parsed = safeJson(String(json?.choices?.[0]?.message?.content ?? ""));
  if (!parsed) return null;
  return {
    summary: String(parsed.summary ?? "").trim(),
    recommendations: String(parsed.recommendations ?? "").trim(),
    model: String(json?.model ?? ""),
  };
}

// ------------------------------------------------------------------
// HTML
// ------------------------------------------------------------------
const money = (v?: number | null, c?: string | null) =>
  v == null
    ? "—"
    : `${Number(v).toLocaleString("bg-BG", { maximumFractionDigits: 0 })} ${c ?? "EUR"}`;

export function renderReportHtml(input: {
  ownerName: string;
  periodStart: string;
  periodEnd: string;
  metrics: PeriodMetrics;
  summary: string;
  recommendations: string;
  token: string;
}) {
  const d = (v: string) => new Date(v).toLocaleDateString("bg-BG");
  const t = input.metrics.totals;
  const card = (label: string, value: string | number) =>
    `<td style="padding:12px 14px;background:#fdf7ec;border:1px solid #e6d3ae;border-radius:12px;text-align:center">
      <div style="font-size:22px;font-weight:700;color:#8b1a2b">${value}</div>
      <div style="font-size:12px;color:#6b5a4a">${label}</div></td>`;

  const rows = input.metrics.properties
    .map(
      (p) => `<tr>
      <td style="padding:10px;border-bottom:1px solid #eadfce;color:#3a2b2e"><strong>${p.title}</strong><br/><span style="font-size:12px;color:#7a6a5c">${[p.city, p.quarter].filter(Boolean).join(", ") || "—"} · ${money(p.price, p.currency)}</span></td>
      <td style="padding:10px;border-bottom:1px solid #eadfce;text-align:center;color:#3a2b2e">${p.inquiries}</td>
      <td style="padding:10px;border-bottom:1px solid #eadfce;text-align:center;color:#3a2b2e">${p.viewings} / ${p.viewings_completed}</td>
      <td style="padding:10px;border-bottom:1px solid #eadfce;text-align:center;color:#3a2b2e">${p.matches}</td>
      <td style="padding:10px;border-bottom:1px solid #eadfce;text-align:center;color:#3a2b2e">${p.avg_rating ?? "—"}</td>
    </tr>`,
    )
    .join("");

  const feedback = input.metrics.properties
    .flatMap((p) =>
      p.feedback.map(
        (f) => `<li style="margin-bottom:6px;color:#3a2b2e"><em>${p.title}:</em> ${f}</li>`,
      ),
    )
    .join("");

  return `<div style="max-width:720px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#fffaf2;padding:24px;border-radius:16px">
  <div style="background:#8b1a2b;color:#f7e3c0;padding:18px 22px;border-radius:14px">
    <div style="font-size:12px;letter-spacing:2px;opacity:.85">ИМОТИ НАДЕЖДА</div>
    <div style="font-size:22px;font-weight:700">Отчет към собственик</div>
    <div style="font-size:13px;opacity:.9">${input.ownerName} · ${d(input.periodStart)} – ${d(input.periodEnd)}</div>
  </div>

  <table style="width:100%;border-collapse:separate;border-spacing:8px;margin-top:16px"><tr>
    ${card("Запитвания", t.inquiries)}
    ${card("Огледи", t.viewings)}
    ${card("Проведени", t.viewings_completed)}
    ${card("Съвпадения", t.matches)}
  </tr></table>

  <h3 style="color:#8b1a2b;margin:22px 0 8px">Обобщение</h3>
  <p style="color:#3a2b2e;line-height:1.6">${input.summary || "—"}</p>

  <h3 style="color:#8b1a2b;margin:22px 0 8px">Активност по имоти</h3>
  <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eadfce;border-radius:12px;overflow:hidden">
    <tr style="background:#f7e3c0">
      <th style="text-align:left;padding:10px;color:#8b1a2b;font-size:13px">Имот</th>
      <th style="padding:10px;color:#8b1a2b;font-size:13px">Запитвания</th>
      <th style="padding:10px;color:#8b1a2b;font-size:13px">Огледи / проведени</th>
      <th style="padding:10px;color:#8b1a2b;font-size:13px">Съвпадения</th>
      <th style="padding:10px;color:#8b1a2b;font-size:13px">Оценка</th>
    </tr>
    ${rows || `<tr><td colspan="5" style="padding:14px;color:#7a6a5c">Няма имоти за периода.</td></tr>`}
  </table>

  ${feedback ? `<h3 style="color:#8b1a2b;margin:22px 0 8px">Обратна връзка от огледи</h3><ul style="padding-left:18px">${feedback}</ul>` : ""}

  <h3 style="color:#8b1a2b;margin:22px 0 8px">Препоръки</h3>
  <p style="color:#3a2b2e;line-height:1.6">${input.recommendations || "—"}</p>

  <p style="margin-top:22px;font-size:12px;color:#7a6a5c">
    Онлайн версия: <a style="color:#8b1a2b" href="${SITE_URL}/api/public/reports/view/${input.token}">${SITE_URL}/api/public/reports/view/${input.token}</a>
  </p>
</div>`;
}

// ------------------------------------------------------------------
// Генериране
// ------------------------------------------------------------------
export async function generateOwnerReport(input: {
  ownerId: string;
  templateCode?: string;
  periodDays?: number;
  useAi?: boolean;
  actor?: string | null;
  scheduleId?: string | null;
}) {
  const settings = await getOwnerReportSettings();
  const templateCode = input.templateCode ?? settings.default_template;
  const days = Math.min(Math.max(input.periodDays ?? settings.period_days, 1), 365);

  const { data: owner, error: oErr } = await db()
    .from("owners")
    .select("id, full_name, email, phone")
    .eq("id", input.ownerId)
    .maybeSingle();
  if (oErr) throw new Error(oErr.message);
  if (!owner) throw new Error("Собственикът не е намерен.");

  const { data: template } = await db()
    .from("owner_report_templates")
    .select("*")
    .eq("code", templateCode)
    .maybeSingle();

  const { data: props } = await db()
    .from("properties")
    .select("id")
    .eq("owner_id", owner.id)
    .limit(200);
  const propertyIds = (props ?? []).map((p: any) => p.id as string);

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - days * 864e5);
  const metrics = await collectOwnerMetrics(
    propertyIds,
    periodStart.toISOString(),
    periodEnd.toISOString(),
  );

  let summary = "";
  let recommendations = "";
  let aiUsed = false;
  let model: string | null = null;

  const wantAi = (input.useAi ?? settings.ai_enabled) && (template?.include_ai_summary ?? true);
  if (wantAi) {
    try {
      const ai = await aiSummary(owner.full_name, template, metrics, days);
      if (ai?.summary) {
        summary = ai.summary;
        recommendations = ai.recommendations;
        aiUsed = true;
        model = ai.model || null;
      }
    } catch (e) {
      await logEvent(
        null,
        owner.id,
        "ai_failed",
        "error",
        e instanceof Error ? e.message : String(e),
        input.actor ?? null,
      );
    }
  }
  if (!summary) {
    const fb = fallbackSummary(owner.full_name, metrics, days);
    summary = fb.summary;
    recommendations = fb.recommendations;
  }

  const subject = `Отчет за Вашите имоти · ${periodStart.toLocaleDateString("bg-BG")} – ${periodEnd.toLocaleDateString("bg-BG")}`;

  const { data: created, error } = await db()
    .from("owner_reports")
    .insert({
      owner_id: owner.id,
      owner_name: owner.full_name,
      owner_email: owner.email,
      property_ids: propertyIds,
      template_code: templateCode,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      status: "ready",
      metrics,
      summary,
      recommendations,
      subject,
      recipient: owner.email,
      ai_used: aiUsed,
      model,
      schedule_id: input.scheduleId ?? null,
      created_by: input.actor ?? "crm",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const html = renderReportHtml({
    ownerName: owner.full_name,
    periodStart: created.period_start,
    periodEnd: created.period_end,
    metrics,
    summary,
    recommendations,
    token: created.token,
  });
  await db()
    .from("owner_reports")
    .update({ html, updated_at: new Date().toISOString() })
    .eq("id", created.id);
  await logEvent(
    created.id,
    owner.id,
    "generated",
    "ok",
    `${metrics.totals.properties} имота, ${metrics.totals.inquiries} запитвания`,
    input.actor ?? null,
  );

  return { ...created, html };
}

export async function sendOwnerReport(reportId: string, actor?: string | null) {
  const { data: report, error } = await db()
    .from("owner_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!report) throw new Error("Отчетът не е намерен.");
  if (!report.recipient) {
    await db()
      .from("owner_reports")
      .update({ status: "failed", error: "Липсва имейл на собственика." })
      .eq("id", reportId);
    throw new Error("Липсва имейл на собственика.");
  }

  const html =
    report.html ??
    renderReportHtml({
      ownerName: report.owner_name ?? "",
      periodStart: report.period_start,
      periodEnd: report.period_end,
      metrics: report.metrics as PeriodMetrics,
      summary: report.summary ?? "",
      recommendations: report.recommendations ?? "",
      token: report.token,
    });

  try {
    await sendTransactionalEmail({
      to: String(report.recipient),
      subject: String(report.subject ?? "Отчет за Вашите имоти"),
      html,
      text: `${report.summary ?? ""}\n\n${report.recommendations ?? ""}\n\n${SITE_URL}/api/public/reports/view/${report.token}`,
      purpose: "owner_report",
      label: `owner-report-${report.template_code}`,
      idempotency_key: report.id as string,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await db()
      .from("owner_reports")
      .update({ status: "failed", error: detail, updated_at: new Date().toISOString() })
      .eq("id", reportId);
    await logEvent(reportId, report.owner_id, "send_failed", "error", detail, actor ?? null);
    throw new Error(detail);
  }

  const now = new Date().toISOString();
  await db()
    .from("owner_reports")
    .update({ status: "sent", sent_at: now, error: null, html, updated_at: now })
    .eq("id", reportId);
  await logEvent(reportId, report.owner_id, "sent", "ok", String(report.recipient), actor ?? null);
  return { ok: true, sent_at: now };
}

export async function setOwnerReportStatus(
  reportId: string,
  status: string,
  actor?: string | null,
) {
  const { error } = await db()
    .from("owner_reports")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) throw new Error(error.message);
  await logEvent(reportId, null, "status", "ok", status, actor ?? null);
  return { ok: true };
}

export async function markReportOpened(token: string) {
  const { data } = await db()
    .from("owner_reports")
    .select("id, open_count, html, owner_name")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  await db()
    .from("owner_reports")
    .update({ opened_at: new Date().toISOString(), open_count: Number(data.open_count ?? 0) + 1 })
    .eq("id", data.id);
  return data;
}

// ------------------------------------------------------------------
// Графици
// ------------------------------------------------------------------
function nextRun(frequency: string, hour: number, from = new Date()): string {
  const next = new Date(from);
  const add = frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : 30;
  next.setDate(next.getDate() + add);
  next.setHours(hour, 0, 0, 0);
  return next.toISOString();
}

export async function upsertOwnerReportSchedule(input: {
  id?: string | null;
  ownerId: string;
  templateCode?: string;
  frequency?: string;
  hour?: number;
  autoSend?: boolean;
  isActive?: boolean;
  notes?: string | null;
}) {
  const settings = await getOwnerReportSettings();
  const frequency = input.frequency ?? settings.default_frequency;
  const hour = input.hour ?? settings.send_hour;
  const payload: Record<string, unknown> = {
    owner_id: input.ownerId,
    template_code: input.templateCode ?? settings.default_template,
    frequency,
    hour,
    auto_send: input.autoSend ?? settings.auto_send,
    is_active: input.isActive ?? true,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { error } = await db().from("owner_report_schedules").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
    return { ok: true, id: input.id };
  }
  payload["next_run_at"] = nextRun(frequency, hour);
  const { data, error } = await db()
    .from("owner_report_schedules")
    .upsert(payload, { onConflict: "owner_id,template_code" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, id: data.id as string };
}

export async function deleteOwnerReportSchedule(id: string) {
  const { error } = await db().from("owner_report_schedules").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ------------------------------------------------------------------
// Фонова обработка
// ------------------------------------------------------------------
export async function runOwnerReportSweep(limit?: number) {
  const settings = await getOwnerReportSettings();
  if (!settings.enabled) return { skipped: "disabled" as const, processed: 0 };
  const job = await getOwnerReportJobState();
  if (job.paused) return { skipped: "paused" as const, reason: job.paused_reason, processed: 0 };
  if (!(await claimJob(settings.lease_seconds)))
    return { skipped: "locked" as const, processed: 0 };

  const batch = Math.min(Math.max(limit ?? settings.batch_size, 1), 25);
  let generated = 0;
  let sent = 0;
  let failed = 0;

  try {
    const { data: due } = await db()
      .from("owner_report_schedules")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", new Date().toISOString())
      .order("next_run_at", { ascending: true })
      .limit(batch);

    for (const s of due ?? []) {
      try {
        const report = await generateOwnerReport({
          ownerId: s.owner_id,
          templateCode: s.template_code,
          periodDays:
            s.frequency === "weekly" ? 7 : s.frequency === "biweekly" ? 14 : settings.period_days,
          actor: "scheduler",
          scheduleId: s.id,
        });
        generated += 1;

        const emptyActivity =
          (report.metrics as PeriodMetrics)?.totals?.inquiries === 0 &&
          (report.metrics as PeriodMetrics)?.totals?.viewings === 0;
        if (
          s.auto_send &&
          settings.auto_send &&
          report.recipient &&
          !(settings.skip_empty_activity && emptyActivity)
        ) {
          await sendOwnerReport(report.id, "scheduler");
          sent += 1;
        }

        await db()
          .from("owner_report_schedules")
          .update({
            last_run_at: new Date().toISOString(),
            last_report_id: report.id,
            next_run_at: nextRun(s.frequency, s.hour),
            updated_at: new Date().toISOString(),
          })
          .eq("id", s.id);
      } catch (e) {
        failed += 1;
        await logEvent(
          null,
          s.owner_id,
          "schedule_failed",
          "error",
          e instanceof Error ? e.message : String(e),
          "scheduler",
        );
        await db()
          .from("owner_report_schedules")
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRun(s.frequency, s.hour),
            updated_at: new Date().toISOString(),
          })
          .eq("id", s.id);
      }
    }
  } finally {
    await releaseJob({ generated, sent, failed });
  }

  return { processed: generated, generated, sent, failed };
}

// ------------------------------------------------------------------
// Аналитика
// ------------------------------------------------------------------
export async function getOwnerReportAnalytics() {
  const [{ data: reports }, { data: schedules }, { data: owners }, { data: events }] =
    await Promise.all([
      db()
        .from("owner_reports")
        .select(
          "id, created_at, status, ai_used, sent_at, opened_at, open_count, metrics, owner_id",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      db().from("owner_report_schedules").select("id, is_active, frequency, next_run_at, owner_id"),
      db().from("owners").select("id, email"),
      db()
        .from("owner_report_events")
        .select("action, status, created_at")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

  const rows = reports ?? [];
  const byStatus: Record<string, number> = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

  const sentRows = rows.filter((r: any) => r.status === "sent");
  const opened = sentRows.filter((r: any) => r.opened_at).length;

  const last90 = rows.filter(
    (r: any) => Date.now() - new Date(r.created_at).getTime() < 90 * 864e5,
  );
  const trend: Record<string, number> = {};
  for (const r of last90) {
    const day = new Date(r.created_at).toISOString().slice(0, 10);
    trend[day] = (trend[day] ?? 0) + 1;
  }

  const totals = rows.reduce(
    (acc: any, r: any) => {
      const t = r.metrics?.totals ?? {};
      acc.inquiries += Number(t.inquiries ?? 0);
      acc.viewings += Number(t.viewings ?? 0);
      acc.matches += Number(t.matches ?? 0);
      return acc;
    },
    { inquiries: 0, viewings: 0, matches: 0 },
  );

  const activeSchedules = (schedules ?? []).filter((s: any) => s.is_active);
  const coveredOwners = new Set(activeSchedules.map((s: any) => s.owner_id));

  return {
    total: rows.length,
    byStatus,
    sent: sentRows.length,
    opened,
    open_rate: sentRows.length ? Math.round((opened / sentRows.length) * 100) : 0,
    ai_share: rows.length
      ? Math.round((rows.filter((r: any) => r.ai_used).length / rows.length) * 100)
      : 0,
    schedules_active: activeSchedules.length,
    owners_total: (owners ?? []).length,
    owners_with_email: (owners ?? []).filter((o: any) => o.email).length,
    owners_covered: coveredOwners.size,
    reported_totals: totals,
    trend: Object.entries(trend).sort(([a], [b]) => a.localeCompare(b)),
    events_recent: (events ?? []).length,
  };
}
