import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().max(20000),
  tool_call_id: z.string().optional(),
  tool_calls: z.any().optional(),
  name: z.string().optional(),
});

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_clients",
      description: "Търси клиенти в CRM по име, имейл или телефон. Връща списък с подходящи клиенти.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Текст за търсене (име, имейл или телефон)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_client",
      description: "Извлича пълните данни на конкретен клиент по ID — включително критерии за търсене, документи и съвпадащи имоти.",
      parameters: {
        type: "object",
        properties: { client_id: { type: "string" } },
        required: ["client_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_properties",
      description: "Търси имоти по заглавие, град или ценови диапазон.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          city_slug: { type: "string" },
          max_price: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_property",
      description: "Извлича пълните данни на конкретен имот по ID.",
      parameters: {
        type: "object",
        properties: { property_id: { type: "string" } },
        required: ["property_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_contract",
      description: "Запазва генериран договор в базата данни. Извикай когато потребителят потвърди готов договор.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          contract_type: { type: "string", enum: ["preliminary", "sale", "rent", "brokerage", "other"] },
          content: { type: "string", description: "Пълен текст на договора в markdown" },
          client_id: { type: "string" },
          property_id: { type: "string" },
        },
        required: ["title", "contract_type", "content"],
      },
    },
  },
];

async function runTool(name: string, args: any, userId: string): Promise<any> {
  if (name === "search_clients") {
    const q = String(args.query ?? "").trim();
    let query = supabaseAdmin.from("clients").select("id, full_name, phone, email, client_type, status, budget_min, budget_max, search_property_type, search_status, notes, cities:search_city_id(name), quarters:search_quarter_id(name)").limit(20);
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) return { error: error.message };
    return { clients: data ?? [] };
  }
  if (name === "get_client") {
    const { data: client } = await supabaseAdmin.from("clients").select("*, cities:search_city_id(name), quarters:search_quarter_id(name)").eq("id", args.client_id).maybeSingle();
    if (!client) return { error: "Клиент не е намерен" };
    const [{ data: docs }, { data: matches }] = await Promise.all([
      supabaseAdmin.from("client_documents").select("document_type, file_name, notes, created_at").eq("client_id", args.client_id),
      supabaseAdmin.from("property_matches").select("score, status, properties:property_id(id, title, price, currency)").eq("client_id", args.client_id).order("score", { ascending: false }).limit(5),
    ]);
    return { client, documents: docs ?? [], top_matches: matches ?? [] };
  }
  if (name === "search_properties") {
    let query = supabaseAdmin.from("properties").select("id, title, price, currency, area_sqm, rooms, property_type, status, cities:city_id(name, slug), quarters:quarter_id(name)").eq("is_published", true).limit(20);
    if (args.query) query = query.ilike("title", `%${args.query}%`);
    if (args.max_price) query = query.lte("price", args.max_price);
    const { data, error } = await query;
    if (error) return { error: error.message };
    let rows = data ?? [];
    if (args.city_slug) rows = rows.filter((p: any) => p.cities?.slug === args.city_slug);
    return { properties: rows };
  }
  if (name === "get_property") {
    const { data: prop } = await supabaseAdmin.from("properties").select("*, cities:city_id(name, slug), quarters:quarter_id(name)").eq("id", args.property_id).maybeSingle();
    if (!prop) return { error: "Имотът не е намерен" };
    const { data: images } = await supabaseAdmin.from("property_images").select("url").eq("property_id", args.property_id);
    return { property: prop, images: images ?? [] };
  }
  if (name === "save_contract") {
    const { data, error } = await supabaseAdmin.from("generated_contracts").insert({
      title: args.title,
      contract_type: args.contract_type,
      content: args.content,
      client_id: args.client_id ?? null,
      property_id: args.property_id ?? null,
      created_by: userId,
      status: "draft",
    }).select().single();
    if (error) return { error: error.message };
    return { ok: true, contract_id: data.id, message: "Договорът е запазен като чернова в /admin/contracts" };
  }
  return { error: "Непознат инструмент: " + name };
}

export const aiAssistantChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      messages: z.array(messageSchema).min(1).max(60),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY не е конфигуриран");

    // Лек контекст с агрегати
    const [{ count: clientCount }, { count: propCount }, { count: newMatchCount }, { count: newInq }] = await Promise.all([
      supabaseAdmin.from("clients").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("properties").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("property_matches").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    ]);

    const systemPrompt = `Ти си ИЛДЖ.ИА Юридически и CRM Асистент — експерт за луксозна имотна агенция "Недвижими имоти Надежда" в България.

Имаш достъп до базата данни през tools (search_clients, get_client, search_properties, get_property, save_contract).

ТВОИТЕ ЗАДАЧИ:
1. Подготвяй юридически документи (предварителен договор, договор за продажба, договор за наем, посреднически договор) според българското законодателство (ЗЗД, ЗС, ЗУТ).
2. Когато потребител каже "напиши договор на Златомир" или "предварителен на клиент X" — първо извикай search_clients/get_client, после get_property ако е нужно, и едва тогава състави договор с реални данни. Накрая извикай save_contract за запис в системата.
3. Отговаряй на запитвания, прави анализи, генерирай описания на имоти.
4. Винаги попълвай в договорите: имена, ЕГН, документи за самоличност (от документите на клиента), точен адрес на имота, цена с думи, срокове, неустойки.
5. Ако данни липсват — попитай преди да продължиш или маркирай с {ПОПЪЛНЕТЕ}.

ТЕКУЩИ АГРЕГАТИ:
• Клиенти: ${clientCount ?? 0}
• Имоти: ${propCount ?? 0}
• Нови съвпадения: ${newMatchCount ?? 0}
• Нови запитвания: ${newInq ?? 0}

Стил: професионален български, ясен, юридически прецизен. За договори използвай официален стил и пълно форматиране в Markdown с раздели и членове.`;

    const conversation: any[] = [{ role: "system", content: systemPrompt }, ...data.messages];
    let iterations = 0;

    while (iterations < 6) {
      iterations++;
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: conversation,
          tools: TOOLS,
          temperature: 0.4,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 429) throw new Error("Достигнат е лимитът на заявките. Опитайте по-късно.");
        if (res.status === 402) throw new Error("Изчерпан кредит за AI. Добавете средства в Lovable AI.");
        throw new Error(`AI грешка: ${res.status} ${text.slice(0, 200)}`);
      }
      const json = await res.json();
      const msg = json?.choices?.[0]?.message;
      if (!msg) throw new Error("Празен отговор от AI");

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        conversation.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
        for (const call of msg.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(call.function.arguments ?? "{}"); } catch {}
          const result = await runTool(call.function.name, args, context.userId);
          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result).slice(0, 12000),
          });
        }
        continue;
      }

      return { reply: msg.content ?? "" };
    }
    return { reply: "Прекалено много стъпки. Опитайте по-конкретен въпрос." };
  });
