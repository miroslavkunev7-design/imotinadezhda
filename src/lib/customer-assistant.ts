import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { duckDuckGoSearch, fetchUrlContent } from "@/lib/web-research";

export const CUSTOMER_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_properties",
      description:
        "Търси публикувани имоти по град/квартал/бюджет/брой стаи/тип. Връща до 8 резултата.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string" },
          quarter: { type: "string" },
          max_price: { type: "number" },
          min_price: { type: "number" },
          rooms: { type: "number" },
          property_type: { type: "string" },
          stretch_pct: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "Търси в интернет (DuckDuckGo). Използвай за всяка информация извън базата на агенцията — новини, пазар, компании, закони, общи теми.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Заявка на български или английски" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "fetch_url",
      description: "Чете конкретна уеб страница след web_search или по директен URL.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string" },
        },
        required: ["url"],
      },
    },
  },
];

export function customerSystemPrompt(ctx: { propertyInfo?: string; pageUrl?: string }) {
  return `Ти си **Надежда** — виртуален консултант на „Имоти Надежда" (imotinadezhda.bg).

ХАРАКТЕР И ОБХВАТ
- Говориш на топъл, естествен български. Разговорът е напълно свободен — поздрави, small talk, шеги, лични въпроси („как си?") — отговаряш учтиво и човешки.
- НИКОГА не споменаваш токени, кредити, абонаменти, лимити, плащания или технически ограничения. Услугата е безплатна за посетителите.
- НИКОГА не отказваш разговор с „това не е моята област", освен ако не става въпрос за явно незаконно съдържание.
- При правни въпроси (договори, собственост, наем, предварителен договор, такси, нотариус) отговаряш с висока юридическа точност по българското право (ЗЗД, ЗС, ЗУТ, Закон за кадастъра), ясно и структурирано — ниво сериозен правен консултант. Ако нещо зависи от конкретен случай, казваш какво обикновено се прави и препоръчваш нотариус/адвокат за подпис.
- При имоти: търси в базата с search_properties. При всичко друго — web_search и при нужда fetch_url. Цитирай източниците като markdown линкове.
- Отговори кратко (2–5 изречения), освен при правни обяснения или списък с имоти/източници.

ИМОТИ
- При бюджет „до X" — search_properties със stretch_pct 30–35 и предложи 1–2 по-добри опции малко над бюджета с аргументи.
- Никога не казвай „нямаме нищо" — предложи най-близката алтернатива.
- Ако искат оглед/обаждане — покани за телефон или имейл; не обещавай точен час.

${ctx.propertyInfo ? `КОНТЕКСТ — клиентът гледа имот:\n${ctx.propertyInfo}\n` : ""}${ctx.pageUrl ? `Страница: ${ctx.pageUrl}` : ""}`;
}

type Db = SupabaseClient<Database>;

export async function searchPublishedProperties(db: Db, args: Record<string, unknown>) {
  const stretch = Math.max(0, Math.min(60, Number(args.stretch_pct ?? 0)));
  const maxPrice = args.max_price ? Number(args.max_price) * (1 + stretch / 100) : undefined;

  let q = db
    .from("properties")
    .select("id, title, price, currency, area_sqm, rooms, floor, address, cities(name), quarters(name)")
    .eq("is_published", true)
    .order("price", { ascending: true })
    .limit(8);

  if (args.min_price) q = q.gte("price", Number(args.min_price));
  if (maxPrice) q = q.lte("price", maxPrice);
  if (args.rooms) q = q.eq("rooms", Number(args.rooms));
  if (args.property_type) q = q.eq("property_type", String(args.property_type) as never);

  if (args.city) {
    const { data: city } = await db.from("cities").select("id").ilike("name", `%${args.city}%`).maybeSingle();
    if (city) q = q.eq("city_id", city.id);
  }
  if (args.quarter) {
    const { data: qq } = await db.from("quarters").select("id").ilike("name", `%${args.quarter}%`).maybeSingle();
    if (qq) q = q.eq("quarter_id", qq.id);
  }

  const { data, error } = await q;
  if (error) return { error: error.message, results: [] };
  return {
    results: (data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      price: `${Number(r.price).toLocaleString("bg-BG")} ${r.currency}`,
      area: r.area_sqm ? `${r.area_sqm} m²` : null,
      rooms: r.rooms,
      floor: r.floor,
      city: r.cities?.name,
      quarter: r.quarters?.name,
      url: `/properties/${r.id}`,
    })),
  };
}

export async function runCustomerTool(db: Db, name: string, args: Record<string, unknown>) {
  if (name === "search_properties") return searchPublishedProperties(db, args);
  if (name === "web_search") {
    const q = String(args.query ?? "").trim();
    if (!q) return { error: "Празна заявка" };
    try {
      const results = await duckDuckGoSearch(q);
      return results.length ? { results } : { results: [], note: "Няма намерени резултати." };
    } catch (e: any) {
      return { error: e?.message ?? "search failed" };
    }
  }
  if (name === "fetch_url") {
    return fetchUrlContent(String(args.url ?? "").trim());
  }
  return { error: "unknown_tool" };
}

type AiMessage = { role: string; content?: string; tool_calls?: any[]; tool_call_id?: string };

function resolveAiGateway() {
  const lovable = process.env.LOVABLE_API_KEY;
  if (lovable) {
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovable,
      model: process.env.CUSTOMER_AI_MODEL ?? "google/gemini-2.5-flash",
    };
  }
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      key: openai,
      model: process.env.CUSTOMER_AI_MODEL ?? "gpt-4o-mini",
    };
  }
  const gemini = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (gemini) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: gemini,
      model: process.env.CUSTOMER_AI_MODEL ?? "gemini-2.0-flash",
    };
  }
  const gateway = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_GATEWAY_API_KEY;
  if (gateway) {
    return {
      url: "https://ai-gateway.vercel.sh/v1/chat/completions",
      key: gateway,
      model: process.env.CUSTOMER_AI_MODEL ?? "google/gemini-2.5-flash",
    };
  }
  return null;
}

export async function callCustomerAI(messages: AiMessage[]) {
  const cfg = resolveAiGateway();
  if (!cfg) throw new Error("AI_NOT_CONFIGURED");
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      tools: CUSTOMER_TOOLS,
      temperature: 0.55,
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("PAYMENT_REQUIRED");
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const GREETING_RE =
  /^(здравей|здрасти|добър\s*(ден|вечер|утро)|hello|hi|hey|как\s*(си|сте)|какво\s*правиш|как\s*минава)/i;

export async function fallbackCustomerReply(db: Db, message: string, propertyInfo?: string) {
  const text = message.trim();
  if (GREETING_RE.test(text)) {
    return "Здравейте! Радвам се, че пишете. Аз съм добре, благодаря — надявам се и при Вас всичко е наред. С удоволствие мога да поговоря за имоти, правни въпроси около сделка или да проуча нещо в интернет. Как мога да помогна?";
  }

  if (/имот|апартамент|къща|наем|продажб|бюджет|€|лв|град|квартал|варна|бургас|шумен|нови пазар/i.test(text)) {
    const props = await searchPublishedProperties(db, {
      city: text.match(/варна/i) ? "Варна" : text.match(/бургас/i) ? "Бургас" : text.match(/шumen/i) ? "Шумен" : undefined,
      max_price: Number((text.match(/(\d[\d\s]{3,8})/)?.[1] ?? "").replace(/\s/g, "")) || undefined,
    });
    if (props.results?.length) {
      const lines = props.results.slice(0, 3).map((r: any) => `• [${r.title}](${r.url}) — ${r.price}`);
      return `Ето няколко актуални предложения от нашата база:\n\n${lines.join("\n")}\n\nИскате ли да филтрираме по квартал, бюджет или брой стаи?`;
    }
  }

  try {
    const results = await duckDuckGoSearch(text);
    if (results.length) {
      const lines = results.slice(0, 4).map((r) => `• [${r.title}](${r.url}) — ${r.snippet}`);
      return `Проучих темата онлайн. Ето най-полезното, което намерих:\n\n${lines.join("\n")}\n\nИскате ли да задълбая в някой от източниците?`;
    }
  } catch {
    /* ignore */
  }

  if (propertyInfo) {
    return `Виждам, че разглеждате конкретен имот. Мога да отговоря за него, да предложа алтернативи или да проуча допълнителна информация. Какво точно искате да знаете?`;
  }

  return "Разбирам. Разкажете ми малко повече — за имот, правен въпрос или друга тема — и ще помогна веднага. Мога и да потърся информация в интернет, ако желаете.";
}
