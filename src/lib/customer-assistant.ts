import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { duckDuckGoSearch, fetchUrlContent } from "@/lib/web-research";
import { aiChatCompletions, resolveAiProvider } from "@/lib/ai-provider";
import { isQuietHours } from "@/lib/customer-channels";

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
  {
    type: "function" as const,
    function: {
      name: "capture_contact",
      description:
        "Запиши име, телефон, имейл, град и бюджет на клиента, когато ги е дал. Извиквай веднага щом има поне телефон или име+град.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          city: { type: "string" },
          budget: { type: "number" },
          intent: { type: "string", description: "buy / rent / sell / other" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "request_human",
      description:
        "Клиентът иска жив брокер, обаждане или да предадеш разговора на човек.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
];

export function customerSystemPrompt(ctx: { propertyInfo?: string; pageUrl?: string; quietHours?: boolean }) {
  return `Ти си **Надежда** — виртуален консултант на „Имоти Надежда" (imotinadezhda.bg). На линия си 24/7.

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
- Ако искат оглед/обаждане — покани за телефон; не обещавай точен час.

КОНТАКТИ И ХЕНДОФ
- Ако клиентът проявява интерес, учтиво питай за име, телефон, град и бюджет — не всички наведнъж.
- Когато имаш телефон или име — извикай capture_contact.
- Ако иска жив брокер, обаждане или „да говоря с човек“ — извикай request_human.
- Живите брокери са на линия 8:30–17:30 (Европа/София). ${ctx.quietHours ? "Сега е извън работното време — кажи, че брокер ще се свърже сутринта след 8:30." : "Ако иска човек, кажи че брокер ще поеме разговора."}

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
  if (name === "capture_contact") return { ok: true, captured: args };
  if (name === "request_human") return { ok: true, handoff: true, reason: args.reason ?? "user_requested_human" };
  return { error: "unknown_tool" };
}

type AiMessage = { role: string; content?: string; tool_calls?: any[]; tool_call_id?: string };

export async function callCustomerAI(messages: AiMessage[]) {
  if (!resolveAiProvider()) throw new Error("AI_NOT_CONFIGURED");
  const res = await aiChatCompletions({
    messages,
    tools: CUSTOMER_TOOLS,
    temperature: 0.55,
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
  const wantsProperty = /имот|апартамент|къща|наем|продажб|бюджет|€|лв|град|квартал|варна|бургас|шумен|нови пазар/i.test(text);
  if (GREETING_RE.test(text) && !wantsProperty) {
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

const HUMAN_RE =
  /(жив\s*човек|с\s*брокер|с\s*човек|оператор|консултант\s*на\s*живо|обадете\s*ми\s*се|да\s*ми\s*се\s*обади|говорите\s*ли\s*с\s*човек|human|real person|speak to (a )?(human|agent|broker))/i;

export function wantsHumanHandoff(text: string) {
  return HUMAN_RE.test(text);
}

export type ContactHints = {
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  budget?: number;
};

export function extractContactHints(text: string): ContactHints {
  const out: ContactHints = {};
  const phone =
    text.match(/(?:\+359|00359|0)\s*8[7-9](?:[\s-]?\d){7}/)?.[0] ??
    text.match(/\b08[7-9]\d{7}\b/)?.[0];
  if (phone) out.phone = phone.replace(/\s+/g, "");
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (email) out.email = email;
  const city = text.match(/\b(Варна|Бургас|Шумен|София|Нови пазар|Пловдив)\b/i)?.[1];
  if (city) out.city = city;
  const budgetRaw = text.match(/(\d[\d\s]{2,8})\s*(евро|€|eur|лв)/i);
  if (budgetRaw) {
    const n = Number(budgetRaw[1].replace(/\s/g, ""));
    if (n > 1000) out.budget = n;
  }
  const name = text.match(/(?:казвам се|аз съм|името ми е)\s+([А-ЯA-Z][а-яa-zА-ЯA-Z-]{1,40})/i)?.[1];
  if (name) out.name = name;
  return out;
}

export type ToolEvent = { name: string; args: Record<string, unknown> };

export async function generateCustomerReply(opts: {
  db: Db;
  history: Array<{ role: string; content: string }>;
  message: string;
  propertyInfo?: string;
  pageUrl?: string;
}): Promise<{ reply: string; tools: ToolEvent[] }> {
  const quiet = isQuietHours();
  const sys = customerSystemPrompt({
    propertyInfo: opts.propertyInfo,
    pageUrl: opts.pageUrl,
    quietHours: quiet,
  });
  const messages: AiMessage[] = [
    { role: "system", content: sys },
    ...opts.history.map((m) => ({
      role: m.role === "agent" ? "assistant" : m.role,
      content: m.content,
    })),
  ];
  const tools: ToolEvent[] = [];
  let finalContent = "";

  try {
    for (let i = 0; i < 4; i++) {
      const json = await callCustomerAI(messages);
      const msg = json.choices?.[0]?.message;
      if (!msg) break;
      if (msg.tool_calls?.length) {
        messages.push(msg);
        for (const call of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }
          const name = String(call.function?.name ?? "");
          tools.push({ name, args });
          const result = await runCustomerTool(opts.db, name, args);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result).slice(0, 12000),
          });
        }
        continue;
      }
      finalContent = msg.content ?? "";
      break;
    }
  } catch (aiErr: any) {
    const code = aiErr?.message ?? "";
    if (
      code === "AI_NOT_CONFIGURED" ||
      code.startsWith("AI ") ||
      code === "RATE_LIMIT" ||
      code === "PAYMENT_REQUIRED"
    ) {
      console.warn("[customer-assistant] AI unavailable, using fallback:", code);
      finalContent = await fallbackCustomerReply(opts.db, opts.message, opts.propertyInfo);
    } else {
      throw aiErr;
    }
  }

  if (!finalContent) {
    finalContent = await fallbackCustomerReply(opts.db, opts.message, opts.propertyInfo);
  }

  if (wantsHumanHandoff(opts.message) && !tools.some((t) => t.name === "request_human")) {
    tools.push({ name: "request_human", args: { reason: "phrase" } });
    if (quiet && !/8:30|сутрин|работно/i.test(finalContent)) {
      finalContent += "\n\nБрокер ще се свърже след 8:30.";
    }
  }

  return { reply: finalContent, tools };
}
