import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  chat_id: z.string().uuid().optional(),
  visitor_token: z.string().min(8).max(128),
  property_id: z.string().uuid().nullable().optional(),
  page_url: z.string().max(500).optional(),
  visitor_name: z.string().max(120).optional(),
  visitor_phone: z.string().max(40).optional(),
  visitor_email: z.string().email().max(200).optional(),
  message: z.string().min(1).max(2000),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_properties",
      description:
        "Търси публикувани имоти по град/квартал/бюджет/брой стаи/тип. Връща до 8 резултата. Използвай когато клиент пита за конкретни обяви или за предложения.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "Име на град (Бургас, София, Шумен, Варна, ...)" },
          quarter: { type: "string", description: "Име на квартал (напр. „Боян Българанов", „Меден рудник")" },
          max_price: { type: "number", description: "Горна граница на цената в EUR" },
          min_price: { type: "number", description: "Долна граница на цената в EUR" },
          rooms: { type: "number", description: "Брой стаи" },
          property_type: { type: "string", description: "apartment, house, land, office, ..." },
          stretch_pct: {
            type: "number",
            description:
              "Ако клиентът има бюджет, разшири горната граница с този процент (напр. 30-35), за да предложиш по-добри опции малко над бюджета.",
          },
        },
        additionalProperties: false,
      },
    },
  },
];

function systemPrompt(ctx: { propertyInfo?: string; pageUrl?: string }) {
  return `Ти си Надежда — топъл, спокоен и опитен виртуален консултант на агенция за недвижими имоти „Имоти Надежда" (imotinadezhda.bg, Бургас, Шумен, София, Варна).

ПРАВИЛА НА РАЗГОВОРА
- Говори на чист български, кратко (макс 3–4 изречения на отговор), приятелски, без бизнес жаргон.
- НИКОГА не следваш скрипт или фиксиран таргет. Разговорът е свободен — задавай уточняващи въпроси само ако е необходимо за конкретно предложение.
- Винаги се представи накратко в първото съобщение и кажи, че агенцията не е онлайн в момента, но може да помогнеш с информация и предложения.
- Ако клиент пита за конкретен имот, обясни какво знаеш за него. Ако пита нещо извън недвижимите имоти — кажи, че не е твоят експертиз, и предложи помощ по темата на агенцията.

ТЪРСЕНЕ И ПРЕДЛОЖЕНИЯ
- Когато клиент даде град / квартал / бюджет — извикай инструмента search_properties.
- Ако даде максимален бюджет (напр. „до 100 000"), извикай search_properties с stretch_pct между 30 и 35, за да получиш и оферти малко над бюджета. Покажи първо подходящите в рамките, а после внимателно посочи 1–2 по-скъпи („чуть над бюджета, но струва си заради…") с конкретни аргументи: локация, етаж, гледка, ремонт, площ, паркомясто, инфраструктура.
- Когато няма точно съвпадение — никога не казвай „нямаме нищо". Предложи най-близкото (друг квартал, по-малък метраж, друг тип) и обясни защо.
- Когато клиент пита за цена/защо толкова — обоснови през конкретни характеристики на имота. Бъди уверена, но не агресивна.

КОНТАКТ
- Ако клиентът иска лична консултация, оглед или цените е чувствителна — предложи да оставят телефон/имейл и че агент ще се свърже в работно време. Не давай лъжливи обещания за час.

${ctx.propertyInfo ? `КОНТЕКСТ — клиентът гледа точно този имот сега:\n${ctx.propertyInfo}\n` : ""}${ctx.pageUrl ? `URL на страницата: ${ctx.pageUrl}` : ""}`;
}

async function loadPropertyContext(propertyId: string | null | undefined) {
  if (!propertyId) return undefined;
  const { data } = await supabaseAdmin
    .from("properties")
    .select("title, description, price, currency, area_sqm, rooms, floor, address, property_type, cities(name), quarters(name)")
    .eq("id", propertyId)
    .maybeSingle();
  if (!data) return undefined;
  const c: any = data;
  return [
    `Заглавие: ${c.title}`,
    `Град/Квартал: ${c.cities?.name ?? "—"} / ${c.quarters?.name ?? "—"}`,
    `Цена: ${c.price} ${c.currency}`,
    `Площ: ${c.area_sqm ?? "—"} m², стаи: ${c.rooms ?? "—"}, етаж: ${c.floor ?? "—"}`,
    `Тип: ${c.property_type ?? "—"}`,
    c.description ? `Описание: ${String(c.description).slice(0, 800)}` : "",
  ].filter(Boolean).join("\n");
}

async function searchProperties(args: any) {
  const stretch = Math.max(0, Math.min(60, Number(args.stretch_pct ?? 0)));
  const maxPrice = args.max_price ? Number(args.max_price) * (1 + stretch / 100) : undefined;

  let q = supabaseAdmin
    .from("properties")
    .select("id, title, price, currency, area_sqm, rooms, floor, address, cities(name), quarters(name)")
    .eq("is_published", true)
    .order("price", { ascending: true })
    .limit(8);

  if (args.min_price) q = q.gte("price", Number(args.min_price));
  if (maxPrice) q = q.lte("price", maxPrice);
  if (args.rooms) q = q.eq("rooms", Number(args.rooms));
  if (args.property_type) q = q.eq("property_type", String(args.property_type));

  if (args.city) {
    const { data: city } = await supabaseAdmin
      .from("cities")
      .select("id")
      .ilike("name", `%${args.city}%`)
      .maybeSingle();
    if (city) q = q.eq("city_id", city.id);
  }
  if (args.quarter) {
    const { data: qq } = await supabaseAdmin
      .from("quarters")
      .select("id")
      .ilike("name", `%${args.quarter}%`)
      .maybeSingle();
    if (qq) q = q.eq("quarter_id", qq.id);
  }

  const { data, error } = await q;
  if (error) return { error: error.message, results: [] };
  return {
    results: (data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      price: `${Number(r.price).toLocaleString()} ${r.currency}`,
      area: r.area_sqm ? `${r.area_sqm} m²` : null,
      rooms: r.rooms,
      floor: r.floor,
      city: r.cities?.name,
      quarter: r.quarters?.name,
      url: `/properties/${r.id}`,
    })),
  };
}

async function callLovableAI(messages: any[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      tools: TOOLS,
    }),
  });
  if (res.status === 429) throw new Error("RATE_LIMIT");
  if (res.status === 402) throw new Error("PAYMENT_REQUIRED");
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  return res.json();
}

export const Route = createFileRoute("/api/public/customer-chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        try {
          const body = InputSchema.parse(await request.json());

          // Find / create chat
          let chatId = body.chat_id;
          if (chatId) {
            const { data } = await supabaseAdmin
              .from("customer_chats")
              .select("id, visitor_token")
              .eq("id", chatId)
              .maybeSingle();
            if (!data || data.visitor_token !== body.visitor_token) chatId = undefined;
          }
          if (!chatId) {
            const { data, error } = await supabaseAdmin
              .from("customer_chats")
              .insert({
                visitor_token: body.visitor_token,
                property_id: body.property_id ?? null,
                page_url: body.page_url ?? null,
                visitor_name: body.visitor_name ?? null,
                visitor_phone: body.visitor_phone ?? null,
                visitor_email: body.visitor_email ?? null,
              })
              .select("id")
              .single();
            if (error) throw new Error(error.message);
            chatId = data.id;
          }

          // Persist user message
          await supabaseAdmin.from("customer_chat_messages").insert({
            chat_id: chatId,
            role: "user",
            content: body.message,
          });

          // Load history
          const { data: history } = await supabaseAdmin
            .from("customer_chat_messages")
            .select("role, content")
            .eq("chat_id", chatId)
            .order("created_at", { ascending: true })
            .limit(40);

          const propertyInfo = await loadPropertyContext(body.property_id);
          const sys = systemPrompt({ propertyInfo, pageUrl: body.page_url });

          const messages: any[] = [
            { role: "system", content: sys },
            ...(history ?? []).map((m: any) => ({ role: m.role === "agent" ? "assistant" : m.role, content: m.content })),
          ];

          // Tool loop (max 3 iterations)
          let finalContent = "";
          for (let i = 0; i < 3; i++) {
            const json = await callLovableAI(messages);
            const choice = json.choices?.[0];
            const msg = choice?.message;
            if (!msg) break;
            if (msg.tool_calls?.length) {
              messages.push(msg);
              for (const call of msg.tool_calls) {
                let result: any = { error: "unknown_tool" };
                if (call.function?.name === "search_properties") {
                  try {
                    const args = JSON.parse(call.function.arguments || "{}");
                    result = await searchProperties(args);
                  } catch (e: any) {
                    result = { error: e?.message ?? "bad args" };
                  }
                }
                messages.push({
                  role: "tool",
                  tool_call_id: call.id,
                  content: JSON.stringify(result),
                });
              }
              continue;
            }
            finalContent = msg.content ?? "";
            break;
          }

          if (!finalContent) {
            finalContent = "Извинявам се — за момент имам затруднение. Може ли да опитате пак след минута или да оставите телефон, за да Ви потърсим?";
          }

          await Promise.all([
            supabaseAdmin.from("customer_chat_messages").insert({
              chat_id: chatId,
              role: "assistant",
              content: finalContent,
            }),
            supabaseAdmin
              .from("customer_chats")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", chatId),
          ]);

          return new Response(
            JSON.stringify({ chat_id: chatId, reply: finalContent }),
            { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
          );
        } catch (e: any) {
          const msg = e?.message ?? "error";
          const status = msg === "RATE_LIMIT" ? 429 : msg === "PAYMENT_REQUIRED" ? 402 : 500;
          return new Response(JSON.stringify({ error: msg }), {
            status,
            headers: { ...cors, "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
