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
  {
    type: "function",
    function: {
      name: "update_crm_theme",
      description:
        "Променя CRM темата (цветовете и стила на админ панела) на ТЕКУЩИЯ потребител — лично за него, не засяга другите брокери. Извикай когато потребителят поиска промяна на цветовете, шрифта, фона, страничния панел или херо фона на CRM (напр. 'направи CRM жълто и зелено', 'смени сайдбара на тъмносиньо', 'промени шрифта на Inter', 'смени херо фона на градиент от лилаво към розово'). Можеш да зададеш preset, индивидуални hex/rgba/css цветове, или комбинация (preset като база + overrides). Можеш да настройваш отделно главния фон, акцента, текста, сайдбара (sidebar/sidebarTo/sidebarText/sidebarBorder), заглавията (heading), херо фона на основното работно пространство (heroBg — приема CSS background стойност, например linear-gradient(...) или цвят) и шрифта (fontFamily — име на CSS шрифт, без зареждане на нов файл).",
      parameters: {
        type: "object",
        properties: {
          preset: {
            type: "string",
            enum: ["burgundy", "midnight", "forest", "royal", "light", "graphite"],
            description: "Готова палитра като база. Опционално.",
          },
          surface: { type: "string", description: "Основен фон, hex/rgb()/oklch()." },
          surfaceTo: { type: "string", description: "Вторичен фон за основния градиент." },
          accent: { type: "string", description: "Акцентен цвят (бутони, активни линкове)." },
          accentSoft: { type: "string", description: "Полупрозрачен акцент за hover (rgba препоръчително)." },
          text: { type: "string", description: "Основен цвят на текста." },
          textMuted: { type: "string", description: "Цвят на второстепенния текст (rgba)." },
          border: { type: "string", description: "Цвят на границите." },
          sidebar: { type: "string", description: "Цвят/слой на страничния панел (sidebar). Препоръчително rgba за прозрачност." },
          sidebarTo: { type: "string", description: "Втори стоп за градиент на сайдбара. Опционално." },
          sidebarText: { type: "string", description: "Цвят на текста в сайдбара." },
          sidebarBorder: { type: "string", description: "Цвят на дясната граница на сайдбара." },
          heading: { type: "string", description: "Цвят на заглавията." },
          heroBg: { type: "string", description: "CSS background за главното работно пространство (hex, rgba, linear-gradient(...))." },
          fontFamily: { type: "string", description: "CSS font-family за целия CRM, например 'Inter, sans-serif'." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Търси в интернет в реално време (DuckDuckGo). Използвай за проучване на инвеститори, фирми, хора, пазарни данни, новини, адреси и др. неща извън CRM базата. Връща до 6 резултата с заглавие, URL и кратко описание.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Заявка за търсене, на български или английски" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Изтегля и връща текстовото съдържание на конкретна уеб страница (по URL от web_search или директно). Използвай за дълбоко четене след търсене.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Пълен URL, започващ с http(s)://" },
        },
        required: ["url"],
      },
    },
  },
];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function duckDuckGoSearch(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const res = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ILDJIA-Research/1.0)",
      "Accept-Language": "bg,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error("Search failed: " + res.status);
  const html = await res.text();
  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const blockRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) && results.length < 6) {
    let url = m[1];
    const uddg = url.match(/uddg=([^&]+)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    results.push({ title: stripHtml(m[2]), url, snippet: stripHtml(m[3]) });
  }
  return results;
}

const COLOR_RE = /^(#([0-9a-fA-F]{3}){1,2}|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\))$/;
function validColor(v: unknown): v is string {
  return typeof v === "string" && COLOR_RE.test(v.trim());
}

const THEME_PRESETS: Record<string, Record<string, string>> = {
  burgundy: { surface: "#1a0608", surfaceTo: "#3a0a12", accent: "#c9a04c", accentSoft: "rgba(201,160,76,0.18)", text: "#fde7b3", textMuted: "rgba(253,231,179,0.7)", border: "rgba(201,160,76,0.25)" },
  midnight: { surface: "#0b1220", surfaceTo: "#111e3a", accent: "#60a5fa", accentSoft: "rgba(96,165,250,0.18)", text: "#e2e8f0", textMuted: "rgba(226,232,240,0.7)", border: "rgba(96,165,250,0.25)" },
  forest:   { surface: "#06160f", surfaceTo: "#0d2e20", accent: "#34d399", accentSoft: "rgba(52,211,153,0.18)", text: "#d1fae5", textMuted: "rgba(209,250,229,0.7)", border: "rgba(52,211,153,0.25)" },
  royal:    { surface: "#140820", surfaceTo: "#2a1248", accent: "#c084fc", accentSoft: "rgba(192,132,252,0.18)", text: "#ede9fe", textMuted: "rgba(237,233,254,0.7)", border: "rgba(192,132,252,0.25)" },
  light:    { surface: "#fdfaf5", surfaceTo: "#f5ede0", accent: "#8B1A2B", accentSoft: "rgba(139,26,43,0.12)", text: "#3a1a08", textMuted: "rgba(58,26,8,0.7)", border: "rgba(139,26,43,0.2)" },
  graphite: { surface: "#111111", surfaceTo: "#2a2a2a", accent: "#f59e0b", accentSoft: "rgba(245,158,11,0.18)", text: "#fafafa", textMuted: "rgba(250,250,250,0.65)", border: "rgba(245,158,11,0.25)" },
};

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
  if (name === "update_crm_theme") {
    const base = args.preset && THEME_PRESETS[args.preset] ? THEME_PRESETS[args.preset] : null;
    const { data: profile } = await supabaseAdmin.from("profiles").select("crm_theme").eq("id", userId).maybeSingle();
    const current = (profile?.crm_theme ?? {}) as Record<string, any>;
    const starting = base ? { ...base, preset: args.preset } : current;
    const colorFields = ["surface", "surfaceTo", "accent", "accentSoft", "text", "textMuted", "border", "sidebar", "sidebarTo", "sidebarText", "sidebarBorder", "heading"] as const;
    const freeFields = ["heroBg", "fontFamily"] as const;
    const overrides: Record<string, string> = {};
    const rejected: string[] = [];
    for (const f of colorFields) {
      if (args[f] !== undefined) {
        if (validColor(args[f])) overrides[f] = String(args[f]).trim();
        else rejected.push(f);
      }
    }
    for (const f of freeFields) {
      if (args[f] !== undefined) {
        const v = String(args[f]).trim();
        // лимит и забрана за url()/expression/опасни конструкции
        if (v.length > 0 && v.length <= 300 && !/url\s*\(|expression\s*\(|javascript:|<|>/i.test(v)) {
          overrides[f] = v;
        } else {
          rejected.push(f);
        }
      }
    }
    const next = { ...starting, ...overrides };
    if (!base && Object.keys(overrides).length === 0) {
      return { error: "Не са подадени валидни стойности или preset.", rejected };
    }
    const { error } = await supabaseAdmin.from("profiles").update({ crm_theme: next as any }).eq("id", userId);
    if (error) return { error: error.message };
    return {
      ok: true,
      applied: next,
      rejected: rejected.length ? rejected : undefined,
      message: "Темата е обновена само за теб. [THEME_UPDATED]",
    };
  }
  if (name === "web_search") {
    const q = String(args.query ?? "").trim();
    if (!q) return { error: "Празна заявка" };
    try {
      const results = await duckDuckGoSearch(q);
      if (results.length === 0) return { results: [], note: "Няма намерени резултати." };
      return { results };
    } catch (e: any) {
      return { error: "Грешка при търсене: " + (e?.message ?? String(e)) };
    }
  }
  if (name === "fetch_url") {
    const url = String(args.url ?? "").trim();
    if (!/^https?:\/\//i.test(url)) return { error: "Невалиден URL" };
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ILDJIA-Research/1.0)", "Accept-Language": "bg,en;q=0.8" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { error: "HTTP " + res.status };
      const ct = res.headers.get("content-type") ?? "";
      if (!/text\/html|text\/plain|application\/xhtml/i.test(ct)) return { error: "Неподдържан тип съдържание: " + ct };
      const html = await res.text();
      const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const text = stripHtml(html).slice(0, 6000);
      return { url, title: titleM ? stripHtml(titleM[1]) : "", text };
    } catch (e: any) {
      return { error: "Грешка при изтегляне: " + (e?.message ?? String(e)) };
    }
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

Имаш достъп до базата данни през tools (search_clients, get_client, search_properties, get_property, save_contract, update_crm_theme).

ТВОИТЕ ЗАДАЧИ:
1. Подготвяй юридически документи (предварителен договор, договор за продажба, договор за наем, посреднически договор) според българското законодателство (ЗЗД, ЗС, ЗУТ).
2. Когато потребител каже "напиши договор на Златомир" или "предварителен на клиент X" — първо извикай search_clients/get_client, после get_property ако е нужно, и едва тогава състави договор с реални данни. Накрая извикай save_contract за запис в системата.
3. Отговаряй на запитвания, прави анализи, генерирай описания на имоти.
4. Винаги попълвай в договорите: имена, ЕГН, документи за самоличност (от документите на клиента), точен адрес на имота, цена с думи, срокове, неустойки.
5. Ако данни липсват — попитай преди да продължиш или маркирай с {ПОПЪЛНЕТЕ}.
6. ДИЗАЙНЕР НА CRM: Когато потребителят (брокерът) поиска промяна на цветовете/стила на CRM (напр. "направи CRM жълто и зелено", "смени сайдбара на синьо", "промени шрифта", "смени херо фона на градиент", "светъл режим", "върни към burgundy"), извикай update_crm_theme с подходящи стойности. Промените са ЛИЧНИ — виждат се само от него и не засягат другите служители. Можеш да задаваш: surface/surfaceTo (главен фон), accent/accentSoft (акценти), text/textMuted/heading (текст), border, sidebar/sidebarTo/sidebarText/sidebarBorder (страничен панел), heroBg (фон на работното пространство — приема и градиенти), fontFamily (шрифт). Налични preset-и: burgundy, midnight, forest, royal, light, graphite. Можеш да комбинираш preset + конкретни overrides. След извикване винаги потвърди какво си променил и предложи как да върне ако не хареса.
7. ПРОУЧВАНЕ В ИНТЕРНЕТ: Когато потребителят попита за информация която не е в CRM базата (напр. "кой е инвеститорът X в София", "коя фирма строи комплекс Y", "пазарни цени в кв. Z", "контакти на агенция W", новини, лица, компании) — извикай web_search със смислена заявка, прегледай резултатите и при нужда извикай fetch_url за по-задълбочено четене на най-релевантния линк. Винаги цитирай източниците като markdown линкове в отговора. Ако данните може да са остарели или противоречиви — кажи го честно.

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
