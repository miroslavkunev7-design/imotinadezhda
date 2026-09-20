// Автоматизация №4 — Автоматично изпращане на имоти.
// Съвпадение между лийдове/клиенти и активни оферти + авто-разпращане по имейл.
// Без зависимост от Lovable — Supabase + AI провайдър + собствен SMTP/email слой.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions, listAiProviders } from "@/lib/ai-provider";
import { sendTransactionalEmail } from "@/lib/send-email";

const db = () => supabaseAdmin as unknown as { from: (t: string) => any };

export const SITE_URL = "https://imotinadezhda.bg";

export type MatchingWeights = {
  price: number;
  type: number;
  location: number;
  rooms: number;
  area: number;
  freshness: number;
};

export type MatchingSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  auto_on_qualified: boolean;
  auto_on_new_property: boolean;
  min_score: number;
  max_per_send: number;
  cooldown_hours: number;
  max_sends_per_week: number;
  min_grade: "A" | "B" | "C" | "D";
  price_tolerance_pct: number;
  weights: MatchingWeights;
};

export const DEFAULT_MATCHING: MatchingSettings = {
  enabled: true,
  ai_enabled: true,
  auto_on_qualified: true,
  auto_on_new_property: true,
  min_score: 55,
  max_per_send: 5,
  cooldown_hours: 48,
  max_sends_per_week: 3,
  min_grade: "C",
  price_tolerance_pct: 12,
  weights: { price: 30, type: 20, location: 20, rooms: 12, area: 10, freshness: 8 },
};

export async function getMatchingSettings(): Promise<MatchingSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", "matching")
    .maybeSingle();
  const v = (data?.value ?? {}) as Partial<MatchingSettings>;
  return {
    ...DEFAULT_MATCHING,
    ...v,
    weights: { ...DEFAULT_MATCHING.weights, ...(v.weights ?? {}) },
  };
}

export async function saveMatchingSettings(
  patch: Partial<MatchingSettings>,
): Promise<MatchingSettings> {
  const next = { ...(await getMatchingSettings()), ...patch };
  if (patch.weights) next.weights = { ...DEFAULT_MATCHING.weights, ...patch.weights };
  await db()
    .from("automation_settings")
    .upsert(
      { key: "matching", value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  return next;
}

// ------------------------------------------------------------------
// Скоринг на съвпадение
// ------------------------------------------------------------------

type LeadCriteria = {
  id: string;
  client_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  lead_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  desired_city: string | null;
  desired_district: string | null;
  desired_property_type: string | null;
  rooms_min: number | null;
  area_min: number | null;
  area_max: number | null;
  qualification_grade: string | null;
};

export type PropertyRow = {
  id: string;
  title: string;
  price: number;
  currency: string | null;
  property_type: string | null;
  rooms: number | null;
  area_sqm: number | null;
  city_id: string | null;
  quarter_id: string | null;
  cover_image_url: string | null;
  created_at: string;
  is_featured: boolean | null;
  is_published: boolean | null;
  status: string | null;
  cities?: { name: string | null } | null;
  quarters?: { name: string | null } | null;
};

export type MatchScore = {
  score: number;
  grade: "A" | "B" | "C" | "D";
  breakdown: Record<string, number>;
  reasons: string[];
  mismatches: string[];
};

const norm = (v: string | null | undefined) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[.,„“"'`]/g, "")
    .trim();

export function scoreMatch(lead: LeadCriteria, p: PropertyRow, s: MatchingSettings): MatchScore {
  const w = s.weights;
  const reasons: string[] = [];
  const mismatches: string[] = [];
  const tol = 1 + s.price_tolerance_pct / 100;

  // --- Цена ---
  let priceFactor = 0.45; // без заявен бюджет — неутрално
  if (lead.budget_max || lead.budget_min) {
    const min = lead.budget_min ?? 0;
    const max = lead.budget_max ?? Number.MAX_SAFE_INTEGER;
    if (p.price >= min && p.price <= max) {
      priceFactor = 1;
      reasons.push("Цената е точно в бюджета");
    } else if (p.price > max && p.price <= max * tol) {
      priceFactor = 0.7;
      reasons.push(`Малко над бюджета (до ${s.price_tolerance_pct}%)`);
    } else if (p.price < min && p.price >= min * 0.75) {
      priceFactor = 0.85;
      reasons.push("Под заявения бюджет — по-изгодно");
    } else {
      priceFactor = 0;
      mismatches.push("Цената е извън бюджета");
    }
  }

  // --- Тип имот ---
  let typeFactor = 0.5;
  if (lead.desired_property_type) {
    if (norm(lead.desired_property_type) === norm(p.property_type)) {
      typeFactor = 1;
      reasons.push("Търсеният тип имот");
    } else {
      typeFactor = 0;
      mismatches.push("Различен тип имот");
    }
  }

  // --- Локация ---
  let locationFactor = 0.4;
  const cityName = norm(p.cities?.name);
  const quarterName = norm(p.quarters?.name);
  if (lead.desired_city) {
    if (
      cityName &&
      (cityName.includes(norm(lead.desired_city)) || norm(lead.desired_city).includes(cityName))
    ) {
      locationFactor = 0.8;
      reasons.push(`В търсения град (${p.cities?.name})`);
      if (lead.desired_district && quarterName) {
        if (
          quarterName.includes(norm(lead.desired_district)) ||
          norm(lead.desired_district).includes(quarterName)
        ) {
          locationFactor = 1;
          reasons.push(`Точният квартал (${p.quarters?.name})`);
        }
      }
    } else {
      locationFactor = 0.05;
      mismatches.push("Друг град");
    }
  }

  // --- Стаи ---
  let roomsFactor = 0.5;
  if (lead.rooms_min) {
    if (p.rooms == null) roomsFactor = 0.35;
    else if (p.rooms >= lead.rooms_min) {
      roomsFactor = 1;
      reasons.push(`${p.rooms} стаи (търси ${lead.rooms_min}+)`);
    } else if (p.rooms === lead.rooms_min - 1) roomsFactor = 0.4;
    else {
      roomsFactor = 0;
      mismatches.push("По-малко стаи от търсените");
    }
  }

  // --- Площ ---
  let areaFactor = 0.5;
  if (lead.area_min || lead.area_max) {
    const a = p.area_sqm ?? 0;
    const amin = lead.area_min ?? 0;
    const amax = lead.area_max ?? Number.MAX_SAFE_INTEGER;
    if (!p.area_sqm) areaFactor = 0.35;
    else if (a >= amin && a <= amax) {
      areaFactor = 1;
      reasons.push(`${a} кв.м в търсения диапазон`);
    } else if (a >= amin * 0.9 && a <= amax * 1.1) areaFactor = 0.65;
    else {
      areaFactor = 0.1;
      mismatches.push("Площта е извън диапазона");
    }
  }

  // --- Свежест на офертата ---
  const days = Math.max(0, (Date.now() - new Date(p.created_at).getTime()) / 86400000);
  let freshFactor = days <= 3 ? 1 : days <= 14 ? 0.8 : days <= 45 ? 0.55 : 0.3;
  if (p.is_featured) {
    freshFactor = Math.min(1, freshFactor + 0.2);
    reasons.push("Селектирана оферта");
  }
  if (days <= 3) reasons.push("Нова оферта");

  const breakdown = {
    price: Math.round(priceFactor * w.price),
    type: Math.round(typeFactor * w.type),
    location: Math.round(locationFactor * w.location),
    rooms: Math.round(roomsFactor * w.rooms),
    area: Math.round(areaFactor * w.area),
    freshness: Math.round(freshFactor * w.freshness),
  };

  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0) || 100;
  let score = Math.round((Object.values(breakdown).reduce((a, b) => a + b, 0) / totalWeight) * 100);

  // Твърди несъответствия ограничават максимума.
  if (mismatches.includes("Цената е извън бюджета")) score = Math.min(score, 35);
  if (mismatches.includes("Различен тип имот")) score = Math.min(score, 40);
  if (mismatches.includes("Друг град")) score = Math.min(score, 45);
  score = Math.max(0, Math.min(100, score));

  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D";
  return {
    score,
    grade,
    breakdown,
    reasons: reasons.slice(0, 5),
    mismatches: mismatches.slice(0, 4),
  };
}

// ------------------------------------------------------------------
// Генериране на съвпадения
// ------------------------------------------------------------------

const LEAD_FIELDS =
  "id, client_id, full_name, email, phone, lead_type, budget_min, budget_max, currency, desired_city, desired_district, desired_property_type, rooms_min, area_min, area_max, qualification_grade, qualification_status, matching_opt_out, last_match_sent_at, match_sends_count";

const PROPERTY_SELECT =
  "id, title, price, currency, property_type, rooms, area_sqm, city_id, quarter_id, cover_image_url, created_at, is_featured, is_published, status, cities:city_id(name), quarters:quarter_id(name)";

async function activeProperties(limit = 400): Promise<PropertyRow[]> {
  const { data } = await db()
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("status", "active")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as PropertyRow[];
}

/** Изчислява и записва съвпаденията за един лийд. Връща подредени по скор. */
export async function generateMatchesForLead(
  leadId: string,
  opts: { source?: "lead" | "property" | "manual" } = {},
): Promise<Array<MatchScore & { property: PropertyRow }>> {
  const settings = await getMatchingSettings();
  const { data: lead } = await db()
    .from("leads")
    .select(LEAD_FIELDS)
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) throw new Error("Лийдът не е намерен.");

  const props = await activeProperties();
  const scored = props
    .map((p) => ({ ...scoreMatch(lead as LeadCriteria, p, settings), property: p }))
    .filter((m) => m.score >= Math.min(settings.min_score, 40))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  if (scored.length) {
    await db()
      .from("property_matches")
      .upsert(
        scored.map((m) => ({
          lead_id: leadId,
          client_id: (lead as any).client_id ?? null,
          property_id: m.property.id,
          score: m.score,
          grade: m.grade,
          breakdown: m.breakdown,
          reasons: m.reasons,
          mismatches: m.mismatches,
          source: opts.source ?? "lead",
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "lead_id,property_id", ignoreDuplicates: false },
      );
  }
  return scored;
}

/** Обратна посока: нов имот → подходящи лийдове. */
export async function generateMatchesForProperty(propertyId: string): Promise<number> {
  const settings = await getMatchingSettings();
  const { data: property } = await db()
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("id", propertyId)
    .maybeSingle();
  if (!property) throw new Error("Имотът не е намерен.");

  const { data: leads } = await db()
    .from("leads")
    .select(LEAD_FIELDS)
    .eq("matching_opt_out", false)
    .in("qualification_status", ["qualified", "nurture", "pending"])
    .order("qualification_score", { ascending: false, nullsFirst: false })
    .limit(300);

  const rows: any[] = [];
  for (const l of (leads ?? []) as LeadCriteria[]) {
    const m = scoreMatch(l, property as PropertyRow, settings);
    if (m.score < settings.min_score) continue;
    rows.push({
      lead_id: l.id,
      client_id: (l as any).client_id ?? null,
      property_id: propertyId,
      score: m.score,
      grade: m.grade,
      breakdown: m.breakdown,
      reasons: m.reasons,
      mismatches: m.mismatches,
      source: "property",
      updated_at: new Date().toISOString(),
    });
  }
  if (rows.length) {
    await db()
      .from("property_matches")
      .upsert(rows, { onConflict: "lead_id,property_id", ignoreDuplicates: false });
  }
  return rows.length;
}

// ------------------------------------------------------------------
// Разпращане
// ------------------------------------------------------------------

const money = (v: number, currency: string | null) =>
  `${new Intl.NumberFormat("bg-BG").format(Math.round(v))} ${currency === "BGN" ? "лв." : "€"}`;

function propertyCard(p: PropertyRow, reasons: string[]): string {
  const url = `${SITE_URL}/properties/${p.id}`;
  const img = p.cover_image_url
    ? `<img src="${p.cover_image_url}" alt="${p.title}" width="220" style="width:220px;border-radius:10px;display:block;object-fit:cover" />`
    : "";
  return `<tr><td style="padding:12px 0;border-bottom:1px solid #eadfd0">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td valign="top" style="padding-right:14px">${img}</td>
    <td valign="top" style="font-family:system-ui,sans-serif;font-size:14px;color:#3a2a2e">
      <div style="font-size:16px;font-weight:700;color:#8b1a2b">${p.title}</div>
      <div style="margin-top:4px;font-size:15px;font-weight:700">${money(p.price, p.currency)}</div>
      <div style="margin-top:4px;color:#6b5a5e">${[p.cities?.name, p.quarters?.name].filter(Boolean).join(", ")}${
        p.rooms ? ` · ${p.rooms} стаи` : ""
      }${p.area_sqm ? ` · ${p.area_sqm} кв.м` : ""}</div>
      ${reasons.length ? `<div style="margin-top:6px;color:#8b1a2b;font-size:13px">✔ ${reasons.slice(0, 3).join(" · ")}</div>` : ""}
      <div style="margin-top:8px"><a href="${url}" style="background:#8b1a2b;color:#f7e3c0;text-decoration:none;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600">Виж имота</a></div>
    </td>
  </tr></table>
</td></tr>`;
}

async function aiIntro(
  lead: any,
  matches: Array<{ property: PropertyRow; score: number }>,
): Promise<{ text: string; model: string | null }> {
  const settings = await getMatchingSettings();
  const fallback = `Здравейте, ${String(lead.full_name ?? "").split(" ")[0] || "клиент"},\n\nПодбрахме ${matches.length} имота, които отговарят на Вашите критерии. Ако някой Ви допада, отговорете на този имейл и ще организираме оглед.`;
  if (!settings.ai_enabled || listAiProviders().length === 0)
    return { text: fallback, model: null };
  try {
    const list = matches
      .map(
        (m) =>
          `- ${m.property.title}, ${money(m.property.price, m.property.currency)}, ${m.property.cities?.name ?? ""} (съвпадение ${m.score}%)`,
      )
      .join("\n");
    const res = await aiChatCompletions({
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: `Напиши кратко въведение (макс. 70 думи) на български за имейл от агенция „Имоти Надежда“ до клиент ${lead.full_name ?? ""}. Учтив, професионален тон, без измислени факти и без списък с имотите (той е отделно). Критерии на клиента: бюджет ${lead.budget_min ?? "—"}–${lead.budget_max ?? "—"} ${lead.currency ?? "EUR"}, град ${lead.desired_city ?? "—"}, тип ${lead.desired_property_type ?? "—"}. Подбрани имоти:\n${list}\nВърни само текста.`,
        },
      ],
    });
    if (!res.ok) return { text: fallback, model: null };
    const json = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text && text.length > 30
      ? { text, model: json.model ?? null }
      : { text: fallback, model: null };
  } catch {
    return { text: fallback, model: null };
  }
}

/** Проверява дали лийдът може да получи изпращане сега. */
export async function canSend(
  lead: any,
  settings: MatchingSettings,
): Promise<{ ok: boolean; reason?: string }> {
  if (lead.matching_opt_out) return { ok: false, reason: "Клиентът е отписан от предложения" };
  if (!lead.email) return { ok: false, reason: "Няма имейл — подготви ръчно изпращане" };
  const gradeOrder = { A: 4, B: 3, C: 2, D: 1 } as Record<string, number>;
  if (
    lead.qualification_grade &&
    gradeOrder[lead.qualification_grade] < gradeOrder[settings.min_grade]
  )
    return { ok: false, reason: `Клас под минималния (${settings.min_grade})` };
  if (lead.last_match_sent_at) {
    const hours = (Date.now() - new Date(lead.last_match_sent_at).getTime()) / 3600000;
    if (hours < settings.cooldown_hours)
      return {
        ok: false,
        reason: `Изчаква ${Math.ceil(settings.cooldown_hours - hours)} ч. (cooldown)`,
      };
  }
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count } = await db()
    .from("match_sends")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", lead.id)
    .eq("status", "sent")
    .gte("created_at", weekAgo);
  if (Number(count ?? 0) >= settings.max_sends_per_week)
    return { ok: false, reason: "Достигнат седмичен лимит" };
  return { ok: true };
}

/** Съставя и изпраща селекция от имоти към лийда. */
export async function sendMatchesToLead(
  leadId: string,
  opts: { force?: boolean; propertyIds?: string[] } = {},
): Promise<{
  status: "sent" | "manual" | "skipped";
  reason?: string;
  sendId?: string;
  count: number;
}> {
  const settings = await getMatchingSettings();
  if (!settings.enabled && !opts.force)
    return { status: "skipped", reason: "Автоматизацията е изключена", count: 0 };

  const { data: lead } = await db()
    .from("leads")
    .select(LEAD_FIELDS)
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) throw new Error("Лийдът не е намерен.");

  if (!opts.force) {
    const gate = await canSend(lead, settings);
    if (!gate.ok) return { status: "skipped", reason: gate.reason, count: 0 };
  }

  // Избор на съвпадения — неизпратени, над прага.
  let q = db()
    .from("property_matches")
    .select(`id, score, reasons, property_id, properties:property_id(${PROPERTY_SELECT})`)
    .eq("lead_id", leadId)
    .order("score", { ascending: false })
    .limit(opts.propertyIds?.length ? opts.propertyIds.length : settings.max_per_send);
  if (opts.propertyIds?.length) q = q.in("property_id", opts.propertyIds);
  else q = q.in("status", ["new", "queued"]).gte("score", settings.min_score);

  const { data: rows } = await q;
  const matches = ((rows ?? []) as any[]).filter((r) => r.properties);
  if (matches.length === 0)
    return { status: "skipped", reason: "Няма нови подходящи имоти", count: 0 };

  const items = matches.map((m) => ({
    id: m.id as string,
    score: m.score as number,
    reasons: (m.reasons ?? []) as string[],
    property: m.properties as PropertyRow,
  }));
  const intro = await aiIntro(lead, items);
  const subject =
    items.length === 1
      ? `Имот за Вас: ${items[0]!.property.title}`
      : `${items.length} подбрани имота за Вас — Имоти Надежда`;

  const { data: send } = await db()
    .from("match_sends")
    .insert({
      lead_id: leadId,
      channel: lead.email ? "email" : "manual",
      subject,
      body: intro.text,
      property_ids: items.map((i) => i.property.id),
      match_count: items.length,
      status: "pending",
      ai_used: Boolean(intro.model),
      model: intro.model,
    })
    .select("id, token")
    .maybeSingle();

  const sendId = send?.id as string | undefined;
  const token = send?.token as string | undefined;

  const feedbackBase = `${SITE_URL}/api/public/matches/feedback?token=${token ?? ""}`;
  const html = `<div style="background:#fffaf3;padding:24px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:620px;margin:0 auto">
    <tr><td style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#3a2a2e;white-space:pre-wrap">${intro.text.replace(
      /[<>&]/g,
      (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string,
    )}</td></tr>
    <tr><td style="height:12px"></td></tr>
    ${items.map((i) => propertyCard(i.property, i.reasons)).join("")}
    <tr><td style="padding-top:18px;font-family:system-ui,sans-serif;font-size:13px;color:#6b5a5e">
      <a href="${feedbackBase}&action=interested" style="color:#8b1a2b;font-weight:700">Интересувам се — свържете се с мен</a> ·
      <a href="${feedbackBase}&action=rejected" style="color:#6b5a5e">Не са подходящи</a><br/><br/>
      Имоти Надежда · <a href="${SITE_URL}" style="color:#8b1a2b">imotinadezhda.bg</a><br/>
      <a href="${feedbackBase}&action=opt_out" style="color:#9c8f92">Отписване от предложения</a>
    </td></tr>
  </table>
</div>`;

  const text = `${intro.text}\n\n${items
    .map(
      (i) =>
        `• ${i.property.title} — ${money(i.property.price, i.property.currency)}\n  ${SITE_URL}/properties/${i.property.id}`,
    )
    .join("\n")}\n\nИмоти Надежда · ${SITE_URL}`;

  if (!lead.email) {
    await db().from("match_sends").update({ status: "manual" }).eq("id", sendId);
    await logEvent(
      leadId,
      "note",
      `Подготвени ${items.length} имота за ръчно изпращане (без имейл).`,
    );
    return { status: "manual", sendId, count: items.length };
  }

  try {
    await sendTransactionalEmail({
      to: String(lead.email),
      subject,
      text,
      html,
      purpose: "property_matches",
      label: "auto-property-matching",
      idempotency_key: sendId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db().from("match_sends").update({ status: "failed", error: msg }).eq("id", sendId);
    await logEvent(
      leadId,
      "contact_failed",
      `Изпращането на имоти се провали: ${msg}`,
      null,
      "email",
    );
    return { status: "skipped", reason: msg, count: 0 };
  }

  const now = new Date().toISOString();
  await db().from("match_sends").update({ status: "sent", sent_at: now }).eq("id", sendId);
  await db()
    .from("property_matches")
    .update({ status: "sent", sent_at: now, send_id: sendId, updated_at: now })
    .in(
      "id",
      items.map((i) => i.id),
    );
  await db()
    .from("leads")
    .update({
      last_match_sent_at: now,
      match_sends_count: Number(lead.match_sends_count ?? 0) + 1,
      updated_at: now,
    })
    .eq("id", leadId);
  await logEvent(
    leadId,
    "contact_sent",
    `Изпратени ${items.length} подбрани имота по имейл.`,
    { send_id: sendId },
    "email",
  );

  return { status: "sent", sendId, count: items.length };
}

async function logEvent(
  leadId: string,
  event_type: string,
  detail?: string | null,
  payload?: unknown,
  channel?: string | null,
) {
  try {
    await db()
      .from("lead_events")
      .insert({
        lead_id: leadId,
        event_type,
        detail: detail ?? null,
        payload: payload ?? null,
        channel: channel ?? null,
      });
  } catch {
    /* без прекъсване на потока */
  }
}

// ------------------------------------------------------------------
// Обратна връзка от имейла
// ------------------------------------------------------------------

export async function registerMatchFeedback(
  token: string,
  action: "interested" | "rejected" | "opt_out" | "open",
): Promise<{ ok: boolean; leadId?: string }> {
  const { data: send } = await db()
    .from("match_sends")
    .select("id, lead_id, property_ids")
    .eq("token", token)
    .maybeSingle();
  if (!send) return { ok: false };
  const now = new Date().toISOString();

  if (action === "open") {
    await db()
      .from("match_sends")
      .update({ opened_at: now })
      .eq("id", send.id)
      .is("opened_at", null);
    await db()
      .from("property_matches")
      .update({ status: "viewed", updated_at: now })
      .eq("send_id", send.id)
      .eq("status", "sent");
    return { ok: true, leadId: send.lead_id as string };
  }

  await db().from("match_sends").update({ clicked_at: now }).eq("id", send.id);
  const { registerLeadActivity } = await import("./followup.server");
  await registerLeadActivity(send.lead_id as string, "реакция на изпратени имоти");

  if (action === "opt_out") {
    await db()
      .from("leads")
      .update({ matching_opt_out: true, followup_opt_out: true, updated_at: now })
      .eq("id", send.lead_id);
    await logEvent(
      send.lead_id as string,
      "note",
      "Клиентът се отписа от автоматичните предложения.",
    );
    return { ok: true, leadId: send.lead_id as string };
  }

  await db()
    .from("property_matches")
    .update({ status: action, responded_at: now, feedback: action, updated_at: now })
    .eq("send_id", send.id);

  if (action === "interested") {
    await db()
      .from("leads")
      .update({ status: "interested", updated_at: now })
      .eq("id", send.lead_id);
    await logEvent(
      send.lead_id as string,
      "note",
      "Клиентът заяви интерес към изпратените имоти — обади се веднага.",
    );
  } else {
    await logEvent(
      send.lead_id as string,
      "note",
      "Клиентът отказа изпратените имоти — уточни критериите.",
    );
  }
  return { ok: true, leadId: send.lead_id as string };
}

// ------------------------------------------------------------------
// Cron / batch
// ------------------------------------------------------------------

export async function runMatchingSweep(limit = 20): Promise<{
  processed: number;
  generated: number;
  sent: number;
  skipped: number;
}> {
  const settings = await getMatchingSettings();
  if (!settings.enabled) return { processed: 0, generated: 0, sent: 0, skipped: 0 };

  const statuses = settings.min_grade === "D" ? ["qualified", "nurture"] : ["qualified"];
  const { data: leads } = await db()
    .from("leads")
    .select("id")
    .eq("matching_opt_out", false)
    .in("qualification_status", statuses)
    .order("qualification_score", { ascending: false, nullsFirst: false })
    .limit(limit);

  let generated = 0,
    sent = 0,
    skipped = 0,
    processed = 0;
  for (const l of (leads ?? []) as any[]) {
    processed++;
    try {
      const m = await generateMatchesForLead(l.id as string);
      generated += m.length;
      const r = await sendMatchesToLead(l.id as string);
      if (r.status === "sent") sent++;
      else skipped++;
    } catch {
      skipped++;
    }
  }
  return { processed, generated, sent, skipped };
}

/** Нов/обновен имот → съвпадения и (по настройка) веднага изпращане. */
export async function onPropertyPublished(
  propertyId: string,
): Promise<{ matched: number; sent: number }> {
  const settings = await getMatchingSettings();
  if (!settings.enabled || !settings.auto_on_new_property) return { matched: 0, sent: 0 };
  const matched = await generateMatchesForProperty(propertyId);

  const { data: rows } = await db()
    .from("property_matches")
    .select("lead_id")
    .eq("property_id", propertyId)
    .eq("status", "new")
    .gte("score", settings.min_score)
    .order("score", { ascending: false })
    .limit(30);

  const unique = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.lead_id as string)));
  let sent = 0;
  for (const leadId of unique) {
    try {
      const r = await sendMatchesToLead(leadId);
      if (r.status === "sent") sent++;
    } catch {
      /* пропуска се */
    }
  }
  return { matched, sent };
}

// ------------------------------------------------------------------
// Аналитика
// ------------------------------------------------------------------

export async function matchingAnalytics() {
  const [{ data: matches }, { data: sends }] = await Promise.all([
    db().from("property_matches").select("score, grade, status, created_at").limit(5000),
    db()
      .from("match_sends")
      .select("status, match_count, opened_at, clicked_at, created_at, ai_used")
      .limit(2000),
  ]);

  const m = (matches ?? []) as any[];
  const s = (sends ?? []) as any[];
  const byStatus: Record<string, number> = {};
  const byGrade: Record<string, number> = {};
  for (const r of m) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.grade) byGrade[r.grade] = (byGrade[r.grade] ?? 0) + 1;
  }
  const sentSends = s.filter((r) => r.status === "sent");
  const opened = sentSends.filter((r) => r.opened_at).length;
  const clicked = sentSends.filter((r) => r.clicked_at).length;
  const interested = m.filter((r) => r.status === "interested").length;
  const avgScore = m.length
    ? Math.round(m.reduce((a, r) => a + Number(r.score ?? 0), 0) / m.length)
    : 0;

  const week = new Date(Date.now() - 7 * 86400000).getTime();
  return {
    totalMatches: m.length,
    avgScore,
    byStatus,
    byGrade,
    sends: s.length,
    sentSends: sentSends.length,
    sentThisWeek: sentSends.filter((r) => new Date(r.created_at).getTime() >= week).length,
    propertiesSent: sentSends.reduce((a, r) => a + Number(r.match_count ?? 0), 0),
    openRate: sentSends.length ? Math.round((opened / sentSends.length) * 100) : 0,
    clickRate: sentSends.length ? Math.round((clicked / sentSends.length) * 100) : 0,
    interested,
    conversionRate: sentSends.length ? Math.round((interested / sentSends.length) * 100) : 0,
    aiUsedPct: sentSends.length
      ? Math.round((sentSends.filter((r) => r.ai_used).length / sentSends.length) * 100)
      : 0,
  };
}
