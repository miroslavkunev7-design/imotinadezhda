export type LeadTier = "hot" | "warm" | "cold";
export type LeadUrgency = "high" | "medium" | "low";
export type ClientType = "buyer" | "seller" | "tenant" | "landlord";

export type QualificationBreakdown = {
  budget: number;
  area: number;
  intent: number;
  completeness: number;
  reasons: string[];
};

export type ExtractedQualification = {
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  city_name: string | null;
  quarter_name: string | null;
  client_type: ClientType | null;
  search_status: "sale" | "rent" | null;
  search_property_type: string | null;
  rooms_min: number | null;
  rooms_max: number | null;
  urgency: LeadUrgency | null;
  intent_summary: string | null;
};

export type ClientScoreInput = {
  phone?: string | null;
  email?: string | null;
  client_type?: string | null;
  status?: string | null;
  search_city_id?: string | null;
  search_quarter_id?: string | null;
  search_property_type?: string | null;
  search_status?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  currency?: string | null;
  notes?: string | null;
  assigned_broker_id?: string | null;
  rooms_min?: number | null;
  rooms_max?: number | null;
  updated_at?: string | null;
  deal_stage?: string | null;
  match_count?: number | null;
  inquiry_count?: number | null;
  urgency?: LeadUrgency | null;
};

export type InquiryScoreInput = {
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  notes?: string | null;
  property_id?: string | null;
  status?: string | null;
  extracted?: ExtractedQualification | null;
};

export type ScoreResult = {
  score: number;
  tier: LeadTier;
  urgency: LeadUrgency | null;
  breakdown: QualificationBreakdown;
  summary: string;
};

const CITY_ALIASES: { name: string; keys: string[] }[] = [
  { name: "Нови пазар", keys: ["нови пазар", "новия пазар", "novi pazar", "novi-pazar"] },
  { name: "Бургас", keys: ["бургас", "burgas"] },
  { name: "Варна", keys: ["варна", "varna"] },
  { name: "Шумен", keys: ["шумен", "shumen"] },
];

export function scoreToTier(score: number): LeadTier {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export function tierLabel(tier: string | null | undefined): string {
  if (tier === "hot") return "Горещ";
  if (tier === "warm") return "Топъл";
  if (tier === "cold") return "Студен";
  return "Без оценка";
}

export function urgencyLabel(urgency: string | null | undefined): string {
  if (urgency === "high") return "Спешен";
  if (urgency === "medium") return "Среден";
  if (urgency === "low") return "Нисък";
  return "—";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hasPhone(phone?: string | null) {
  return (phone ?? "").replace(/\D/g, "").length >= 8;
}

function hasEmail(email?: string | null) {
  return Boolean(email && email.includes("@") && email.length >= 5);
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function fold(text: string) {
  return text.toLowerCase().replace(/\u00a0/g, " ");
}

export function extractFromFreeText(raw: string | null | undefined): ExtractedQualification {
  const empty: ExtractedQualification = {
    budget_min: null,
    budget_max: null,
    currency: null,
    city_name: null,
    quarter_name: null,
    client_type: null,
    search_status: null,
    search_property_type: null,
    rooms_min: null,
    rooms_max: null,
    urgency: null,
    intent_summary: null,
  };
  const text = fold(raw ?? "").trim();
  if (!text) return empty;

  const out = { ...empty };

  const range = text.match(
    /(?:от|между)\s*(\d[\d\s.]{1,12})\s*(?:до|-|–|—)\s*(\d[\d\s.]{1,12})/i,
  );
  const single = text.match(
    /(\d[\d\s.]{2,12})\s*(?:хил\.?|хиляди)?\s*(евро|eur|€|лв\.?|bgn|leva)/i,
  );
  const until = text.match(
    /(?:до|макс(?:имум)?|бюджет)\s*(\d[\d\s.]{2,12})\s*(?:хил\.?|хиляди)?\s*(евро|eur|€|лв\.?|bgn)?/i,
  );

  const parseAmount = (rawAmt: string, unit?: string) => {
    let n = Number(rawAmt.replace(/[^\d]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    if (/хил/i.test(unit ?? "") || (n > 0 && n < 1000 && /хил/.test(text))) n *= 1000;
    if (n < 1000 && /хил/.test(rawAmt)) n *= 1000;
    return n;
  };

  if (range) {
    out.budget_min = parseAmount(range[1]);
    out.budget_max = parseAmount(range[2]);
  } else if (single) {
    const amount = parseAmount(single[1], single[0]);
    out.budget_max = amount;
    const cur = (single[2] ?? "").toLowerCase();
    out.currency = /лв|bgn|leva/.test(cur) ? "BGN" : "EUR";
  } else if (until) {
    out.budget_max = parseAmount(until[1], until[0]);
    if (until[2] && /лв|bgn/.test(until[2].toLowerCase())) out.currency = "BGN";
    else if (until[2]) out.currency = "EUR";
  }

  if (!out.currency && /лв|bgn|лева/.test(text)) out.currency = "BGN";
  else if (!out.currency && /евро|eur|€/.test(text)) out.currency = "EUR";

  for (const city of CITY_ALIASES) {
    if (city.keys.some((k) => text.includes(k))) {
      out.city_name = city.name;
      break;
    }
  }

  if (/под\s*наем|наемам|наемател|под наем/.test(text)) {
    out.client_type = "tenant";
    out.search_status = "rent";
  } else if (/отдавам|наемодател/.test(text)) {
    out.client_type = "landlord";
    out.search_status = "rent";
  } else if (/продавам|продавач/.test(text)) {
    out.client_type = "seller";
    out.search_status = "sale";
  } else if (/купувам|купувач|покупк/.test(text)) {
    out.client_type = "buyer";
    out.search_status = "sale";
  }

  if (/къщ/.test(text)) out.search_property_type = "house";
  else if (/офис/.test(text)) out.search_property_type = "office";
  else if (/парцел|земя|земи/.test(text)) out.search_property_type = "land";
  else if (/магазин|търговск/.test(text)) out.search_property_type = "commercial";
  else if (/апартамент|ап\.|стаен|стая/.test(text)) out.search_property_type = "apartment";

  const rooms = text.match(/(\d)\s*-?\s*стаен/);
  if (rooms) {
    const r = Number(rooms[1]);
    out.rooms_min = r;
    out.rooms_max = r;
  } else if (/гарсониер|едностаен/.test(text)) {
    out.rooms_min = 1;
    out.rooms_max = 1;
  } else if (/двустаен/.test(text)) {
    out.rooms_min = 2;
    out.rooms_max = 2;
  } else if (/тристаен/.test(text)) {
    out.rooms_min = 3;
    out.rooms_max = 3;
  }

  if (/спешн|веднага|днес|утре|тази седмица|asap|най-?бързо/.test(text)) out.urgency = "high";
  else if (/до месец|скоро|този месец|в рамките на/.test(text)) out.urgency = "medium";
  else if (/няма бързане|когато|гледаме|без спешност/.test(text)) out.urgency = "low";

  const snippet = (raw ?? "").trim().replace(/\s+/g, " ");
  if (snippet) out.intent_summary = snippet.slice(0, 280);

  return out;
}

function firstFilled<T>(a: T | null | undefined, b: T | null | undefined): T | null {
  if (a != null && a !== ("" as unknown as T)) return a;
  if (b != null && b !== ("" as unknown as T)) return b;
  return null;
}

/** Fill only empty client fields from extraction — never overwrite existing data. */
export function mergeExtractionIntoClient<T extends Record<string, unknown>>(
  client: T,
  extracted: ExtractedQualification,
  resolved?: { city_id?: string | null; quarter_id?: string | null },
): Partial<T> {
  const patch: Record<string, unknown> = {};
  if (client.budget_min == null && extracted.budget_min != null) patch.budget_min = extracted.budget_min;
  if (client.budget_max == null && extracted.budget_max != null) patch.budget_max = extracted.budget_max;
  if (!client.currency && extracted.currency) patch.currency = extracted.currency;
  if (!client.client_type && extracted.client_type) patch.client_type = extracted.client_type;
  if (!client.search_status && extracted.search_status) patch.search_status = extracted.search_status;
  if (!client.search_property_type && extracted.search_property_type) {
    patch.search_property_type = extracted.search_property_type;
  }
  if (client.rooms_min == null && extracted.rooms_min != null) patch.rooms_min = extracted.rooms_min;
  if (client.rooms_max == null && extracted.rooms_max != null) patch.rooms_max = extracted.rooms_max;
  if (!client.search_city_id && resolved?.city_id) patch.search_city_id = resolved.city_id;
  if (!client.search_quarter_id && resolved?.quarter_id) patch.search_quarter_id = resolved.quarter_id;
  return patch as Partial<T>;
}

export function scoreClient(input: ClientScoreInput): ScoreResult {
  const reasons: string[] = [];
  let budget = 0;
  const min = num(input.budget_min);
  const max = num(input.budget_max);
  if (min != null && max != null && max >= min) {
    budget = 28;
    reasons.push("Има бюджет от–до");
  } else if (min != null || max != null) {
    budget = 20;
    reasons.push("Има бюджет (една граница)");
  } else {
    reasons.push("Липсва бюджет");
  }
  const cap = input.currency === "BGN" ? 160000 : 80000;
  if ((max ?? min ?? 0) >= cap) budget = Math.min(30, budget + 2);

  let area = 0;
  if (input.search_city_id) {
    area += 12;
    reasons.push("Има град");
  }
  if (input.search_quarter_id) {
    area += 8;
    reasons.push("Има квартал");
  }
  if (area === 0) reasons.push("Липсва район");

  let intent = 0;
  if (input.client_type) {
    intent += 7;
    reasons.push(`Интерес: ${input.client_type}`);
  }
  if (input.search_property_type) {
    intent += 7;
    reasons.push(`Тип имот: ${input.search_property_type}`);
  }
  if (input.search_status) {
    intent += 5;
    reasons.push(input.search_status === "rent" ? "Наем" : "Покупка/продажба");
  }
  if (input.urgency === "high") intent += 6;
  else if (input.urgency === "medium") intent += 3;
  else if (input.urgency === "low") intent += 1;
  if (input.deal_stage === "started" || input.deal_stage === "mortgage") {
    intent = Math.min(25, intent + 3);
    reasons.push("Има започнала сделка");
  }
  intent = clamp(intent, 0, 25);

  let completeness = 0;
  if (hasPhone(input.phone)) {
    completeness += 8;
    reasons.push("Има телефон");
  }
  if (hasEmail(input.email)) completeness += 4;
  if ((input.notes ?? "").trim().length >= 15) completeness += 5;
  if (input.assigned_broker_id) completeness += 3;
  if ((input.match_count ?? 0) > 0) completeness += 3;
  if ((input.inquiry_count ?? 0) > 0) completeness += 2;
  if (input.updated_at) {
    const age = Date.now() - new Date(input.updated_at).getTime();
    if (Number.isFinite(age) && age < 21 * 24 * 60 * 60 * 1000) completeness += 2;
  }
  completeness = clamp(completeness, 0, 25);

  const score = clamp(budget + area + intent + completeness, 0, 100);
  const tier = scoreToTier(score);
  const summaryParts = [
    `${score}/100 · ${tierLabel(tier)}`,
    min != null || max != null ? `бюджет ${min ?? "?"}–${max ?? "?"} ${input.currency ?? ""}`.trim() : null,
    input.urgency ? urgencyLabel(input.urgency) : null,
  ].filter(Boolean);

  return {
    score,
    tier,
    urgency: input.urgency ?? null,
    breakdown: { budget, area, intent, completeness, reasons },
    summary: summaryParts.join(" · "),
  };
}

export function scoreInquiry(input: InquiryScoreInput): ScoreResult {
  const extracted = input.extracted ?? extractFromFreeText(`${input.message ?? ""}\n${input.notes ?? ""}`);
  const reasons: string[] = [];
  let score = 0;

  if (hasPhone(input.phone)) {
    score += 12;
    reasons.push("Има телефон");
  }
  if (hasEmail(input.email)) score += 4;
  const msgLen = (input.message ?? "").trim().length;
  if (msgLen >= 80) {
    score += 16;
    reasons.push("Подробно съобщение");
  } else if (msgLen >= 20) {
    score += 10;
    reasons.push("Има съобщение");
  }
  if (input.property_id) {
    score += 18;
    reasons.push("Конкретен имот");
  }
  if (extracted.budget_min != null || extracted.budget_max != null) {
    score += 16;
    reasons.push("Извлечен бюджет");
  }
  if (extracted.city_name) {
    score += 12;
    reasons.push(`Град: ${extracted.city_name}`);
  }
  if (extracted.urgency === "high") score += 10;
  else if (extracted.urgency === "medium") score += 6;
  if (input.status === "in_progress") score += 4;
  if (extracted.client_type || extracted.search_property_type) score += 6;

  score = clamp(score, 0, 100);
  const tier = scoreToTier(score);
  return {
    score,
    tier,
    urgency: extracted.urgency,
    breakdown: {
      budget: extracted.budget_min != null || extracted.budget_max != null ? 16 : 0,
      area: extracted.city_name ? 12 : 0,
      intent: (input.property_id ? 18 : 0) + (extracted.urgency === "high" ? 10 : 0),
      completeness: (hasPhone(input.phone) ? 12 : 0) + (msgLen >= 20 ? 10 : 0),
      reasons,
    },
    summary: extracted.intent_summary || `${score}/100 · ${tierLabel(tier)}`,
  };
}

export function qualificationDbPatch(result: ScoreResult, source: "ai" | "heuristic") {
  return {
    lead_score: result.score,
    lead_tier: result.tier,
    lead_urgency: result.urgency,
    qualification_source: source,
    qualification_summary: result.summary,
    qualification_breakdown: result.breakdown,
    qualified_at: new Date().toISOString(),
  };
}

export function parseAiQualificationJson(raw: string): ExtractedQualification | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const type = parsed.client_type;
    const status = parsed.search_status;
    const urgency = parsed.urgency;
    return {
      budget_min: num(parsed.budget_min),
      budget_max: num(parsed.budget_max),
      currency: typeof parsed.currency === "string" ? parsed.currency.slice(0, 8) : null,
      city_name: typeof parsed.city_name === "string" ? parsed.city_name.slice(0, 80) : null,
      quarter_name: typeof parsed.quarter_name === "string" ? parsed.quarter_name.slice(0, 80) : null,
      client_type:
        type === "buyer" || type === "seller" || type === "tenant" || type === "landlord" ? type : null,
      search_status: status === "sale" || status === "rent" ? status : null,
      search_property_type:
        typeof parsed.search_property_type === "string" ? parsed.search_property_type.slice(0, 40) : null,
      rooms_min: num(parsed.rooms_min) != null ? Math.round(num(parsed.rooms_min)!) : null,
      rooms_max: num(parsed.rooms_max) != null ? Math.round(num(parsed.rooms_max)!) : null,
      urgency: urgency === "high" || urgency === "medium" || urgency === "low" ? urgency : null,
      intent_summary: typeof parsed.intent_summary === "string" ? parsed.intent_summary.slice(0, 400) : null,
    };
  } catch {
    return null;
  }
}

export function combineExtractions(
  a: ExtractedQualification,
  b: ExtractedQualification,
): ExtractedQualification {
  return {
    budget_min: firstFilled(a.budget_min, b.budget_min),
    budget_max: firstFilled(a.budget_max, b.budget_max),
    currency: firstFilled(a.currency, b.currency),
    city_name: firstFilled(a.city_name, b.city_name),
    quarter_name: firstFilled(a.quarter_name, b.quarter_name),
    client_type: firstFilled(a.client_type, b.client_type),
    search_status: firstFilled(a.search_status, b.search_status),
    search_property_type: firstFilled(a.search_property_type, b.search_property_type),
    rooms_min: firstFilled(a.rooms_min, b.rooms_min),
    rooms_max: firstFilled(a.rooms_max, b.rooms_max),
    urgency: firstFilled(a.urgency, b.urgency),
    intent_summary: firstFilled(a.intent_summary, b.intent_summary),
  };
}
