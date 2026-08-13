import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiChatCompletions, resolveAiProvider } from "@/lib/ai-provider";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadUserAccess } from "@/lib/auth/crm-access";
import { resolveServerDb, type ServerDb } from "@/lib/supabase-server-db";

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
  {
    type: "function",
    function: {
      name: "create_client",
      description: "Създава нов клиент в CRM. Подай името задължително; останалите полета са опционални. Преди да извикаш, потвърди намерението с потребителя.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          client_type: { type: "string", enum: ["buyer", "seller", "tenant", "landlord"], description: "По подразбиране buyer" },
          status: { type: "string", enum: ["active", "paused", "closed", "lost"] },
          budget_min: { type: "number" },
          budget_max: { type: "number" },
          currency: { type: "string", enum: ["EUR", "BGN"] },
          rooms_min: { type: "number" },
          rooms_max: { type: "number" },
          area_min: { type: "number" },
          area_max: { type: "number" },
          search_property_type: { type: "string" },
          notes: { type: "string" },
          assigned_broker_id: { type: "string" },
        },
        required: ["full_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_client",
      description: "Редактира съществуващ клиент. Подай client_id + само полетата, които сменяш. Преди да извикаш, потвърди с потребителя.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          full_name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          client_type: { type: "string", enum: ["buyer", "seller", "tenant", "landlord"] },
          status: { type: "string", enum: ["active", "paused", "closed", "lost"] },
          budget_min: { type: "number" },
          budget_max: { type: "number" },
          currency: { type: "string", enum: ["EUR", "BGN"] },
          rooms_min: { type: "number" },
          rooms_max: { type: "number" },
          area_min: { type: "number" },
          area_max: { type: "number" },
          notes: { type: "string" },
          assigned_broker_id: { type: "string" },
        },
        required: ["client_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_client",
      description: "Изтрива клиент завинаги. ВИНАГИ изисквай явно потвърждение от потребителя преди да извикаш.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string" },
          confirm: { type: "boolean", description: "Трябва да е true." },
        },
        required: ["client_id", "confirm"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_property",
      description: "Създава нов имот. Подай title и city_id задължително. Преди да извикаш, потвърди с потребителя.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          city_id: { type: "string" },
          quarter_id: { type: "string" },
          property_type: { type: "string", description: "apartment, house, plot, office, commercial и т.н." },
          status: { type: "string", enum: ["for_sale", "for_rent", "sold", "rented", "reserved"] },
          price: { type: "number" },
          currency: { type: "string", enum: ["EUR", "BGN"] },
          area_sqm: { type: "number" },
          rooms: { type: "number" },
          floor: { type: "number" },
          address: { type: "string" },
          is_published: { type: "boolean" },
          owner_id: { type: "string" },
          assigned_broker_id: { type: "string" },
        },
        required: ["title", "city_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_property",
      description: "Редактира съществуващ имот (вкл. смяна на цена, статус, описание). Подай property_id + полетата, които сменяш. Потвърди с потребителя.",
      parameters: {
        type: "object",
        properties: {
          property_id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          city_id: { type: "string" },
          quarter_id: { type: "string" },
          property_type: { type: "string" },
          status: { type: "string", enum: ["for_sale", "for_rent", "sold", "rented", "reserved"] },
          price: { type: "number" },
          currency: { type: "string", enum: ["EUR", "BGN"] },
          area_sqm: { type: "number" },
          rooms: { type: "number" },
          floor: { type: "number" },
          address: { type: "string" },
          is_published: { type: "boolean" },
          assigned_broker_id: { type: "string" },
        },
        required: ["property_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_property",
      description: "Изтрива имот завинаги. ВИНАГИ изисквай явно потвърждение от потребителя преди да извикаш.",
      parameters: {
        type: "object",
        properties: {
          property_id: { type: "string" },
          confirm: { type: "boolean" },
        },
        required: ["property_id", "confirm"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_broker",
      description: "Създава нов брокер. Изисква full_name. Може да се добавят email, телефон, лиценз и био.",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          license_number: { type: "string" },
          bio: { type: "string" },
          photo_url: { type: "string" },
          is_active: { type: "boolean" },
        },
        required: ["full_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_broker",
      description: "Редактира съществуващ брокер. Подай broker_id + полетата, които сменяш.",
      parameters: {
        type: "object",
        properties: {
          broker_id: { type: "string" },
          full_name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          license_number: { type: "string" },
          bio: { type: "string" },
          photo_url: { type: "string" },
          is_active: { type: "boolean" },
        },
        required: ["broker_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_broker",
      description: "Изтрива брокер завинаги. ВИНАГИ изисквай явно потвърждение от потребителя.",
      parameters: {
        type: "object",
        properties: {
          broker_id: { type: "string" },
          confirm: { type: "boolean" },
        },
        required: ["broker_id", "confirm"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_brokers",
      description: "Връща списък с всички брокери (id, име, email, телефон, активен).",
      parameters: { type: "object", properties: {} },
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

async function runTool(name: string, args: any, userId: string, db: ServerDb): Promise<any> {
  if (name === "search_clients") {
    const q = String(args.query ?? "").trim();
    let query = db.from("clients").select("id, full_name, phone, email, client_type, status, budget_min, budget_max, search_property_type, search_status, notes, cities:search_city_id(name), quarters:search_quarter_id(name)").limit(20);
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) return { error: error.message };
    return { clients: data ?? [] };
  }
  if (name === "get_client") {
    const { data: client } = await db.from("clients").select("*, cities:search_city_id(name), quarters:search_quarter_id(name)").eq("id", args.client_id).maybeSingle();
    if (!client) return { error: "Клиент не е намерен" };
    const [{ data: docs }, { data: matches }] = await Promise.all([
      db.from("client_documents").select("document_type, file_name, notes, created_at").eq("client_id", args.client_id),
      db.from("property_matches").select("score, status, properties:property_id(id, title, price, currency)").eq("client_id", args.client_id).order("score", { ascending: false }).limit(5),
    ]);
    return { client, documents: docs ?? [], top_matches: matches ?? [] };
  }
  if (name === "search_properties") {
    let query = db.from("properties").select("id, title, price, currency, area_sqm, rooms, property_type, status, cities:city_id(name, slug), quarters:quarter_id(name)").eq("is_published", true).limit(20);
    if (args.query) query = query.ilike("title", `%${args.query}%`);
    if (args.max_price) query = query.lte("price", args.max_price);
    const { data, error } = await query;
    if (error) return { error: error.message };
    let rows = data ?? [];
    if (args.city_slug) rows = rows.filter((p: any) => p.cities?.slug === args.city_slug);
    return { properties: rows };
  }
  if (name === "get_property") {
    const { data: prop } = await db.from("properties").select("*, cities:city_id(name, slug), quarters:quarter_id(name)").eq("id", args.property_id).maybeSingle();
    if (!prop) return { error: "Имотът не е намерен" };
    const { data: images } = await db.from("property_images").select("url").eq("property_id", args.property_id);
    return { property: prop, images: images ?? [] };
  }
  if (name === "save_contract") {
    const { data, error } = await db.from("generated_contracts").insert({
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
    const { data: profile } = await db.from("profiles").select("crm_theme").eq("id", userId).maybeSingle();
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
    const { error } = await db.from("profiles").update({ crm_theme: next as any }).eq("id", userId);
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
  // ===== WRITE TOOLS (admin-only — gated at handler entry) =====
  const pickFields = (src: Record<string, unknown>, fields: string[]) => {
    const out: Record<string, unknown> = {};
    for (const f of fields) if (src[f] !== undefined && src[f] !== null && src[f] !== "") out[f] = src[f];
    return out;
  };

  if (name === "create_client") {
    if (!args.full_name) return { error: "full_name е задължително" };
    const payload = pickFields(args, [
      "full_name", "phone", "email", "client_type", "status",
      "budget_min", "budget_max", "currency", "rooms_min", "rooms_max",
      "area_min", "area_max", "search_property_type", "notes", "assigned_broker_id",
    ]);
    payload.created_by = userId;
    const { data, error } = await db.from("clients").insert(payload as never).select("id, full_name").single();
    if (error) return { error: error.message };
    return { ok: true, client: data, message: `Клиент "${data.full_name}" е създаден.` };
  }
  if (name === "update_client") {
    if (!args.client_id) return { error: "client_id е задължително" };
    const payload = pickFields(args, [
      "full_name", "phone", "email", "client_type", "status",
      "budget_min", "budget_max", "currency", "rooms_min", "rooms_max",
      "area_min", "area_max", "notes", "assigned_broker_id",
    ]);
    if (Object.keys(payload).length === 0) return { error: "Няма полета за промяна." };
    const { data, error } = await db.from("clients").update(payload as never).eq("id", args.client_id).select("id, full_name").maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "Клиент не е намерен." };
    return { ok: true, client: data, message: `Клиент "${data.full_name}" е обновен.` };
  }
  if (name === "delete_client") {
    if (!args.confirm) return { error: "Изисква се confirm=true." };
    const { error } = await db.from("clients").delete().eq("id", args.client_id);
    if (error) return { error: error.message };
    return { ok: true, message: "Клиентът е изтрит." };
  }

  if (name === "create_property") {
    if (!args.title || !args.city_id) return { error: "title и city_id са задължителни" };
    const payload = pickFields(args, [
      "title", "description", "city_id", "quarter_id", "property_type", "status",
      "price", "currency", "area_sqm", "rooms", "floor", "address",
      "is_published", "owner_id", "assigned_broker_id",
    ]);
    payload.created_by = userId;
    const { data, error } = await db.from("properties").insert(payload as never).select("id, title").single();
    if (error) return { error: error.message };
    const { fillPropertyCoordinates } = await import("@/lib/property-geo");
    await fillPropertyCoordinates(db, data.id).catch(() => null);
    return { ok: true, property: data, message: `Имот "${data.title}" е създаден.` };
  }
  if (name === "update_property") {
    if (!args.property_id) return { error: "property_id е задължително" };
    const payload = pickFields(args, [
      "title", "description", "city_id", "quarter_id", "property_type", "status",
      "price", "currency", "area_sqm", "rooms", "floor", "address",
      "is_published", "assigned_broker_id",
    ]);
    if (Object.keys(payload).length === 0) return { error: "Няма полета за промяна." };
    const { data, error } = await db.from("properties").update(payload as never).eq("id", args.property_id).select("id, title").maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "Имотът не е намерен." };
    const { fillPropertyCoordinates } = await import("@/lib/property-geo");
    await fillPropertyCoordinates(db, data.id).catch(() => null);
    return { ok: true, property: data, message: `Имот "${data.title}" е обновен.` };
  }
  if (name === "delete_property") {
    if (!args.confirm) return { error: "Изисква се confirm=true." };
    const { error } = await db.from("properties").delete().eq("id", args.property_id);
    if (error) return { error: error.message };
    return { ok: true, message: "Имотът е изтрит." };
  }

  if (name === "create_broker") {
    if (!args.full_name) return { error: "full_name е задължително" };
    const payload = pickFields(args, ["full_name", "email", "phone", "license_number", "bio", "photo_url", "is_active"]);
    const { data, error } = await db.from("brokers").insert(payload as never).select("id, full_name").single();
    if (error) return { error: error.message };
    return { ok: true, broker: data, message: `Брокер "${data.full_name}" е създаден.` };
  }
  if (name === "update_broker") {
    if (!args.broker_id) return { error: "broker_id е задължително" };
    const payload = pickFields(args, ["full_name", "email", "phone", "license_number", "bio", "photo_url", "is_active"]);
    if (Object.keys(payload).length === 0) return { error: "Няма полета за промяна." };
    const { data, error } = await db.from("brokers").update(payload as never).eq("id", args.broker_id).select("id, full_name").maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "Брокерът не е намерен." };
    return { ok: true, broker: data, message: `Брокер "${data.full_name}" е обновен.` };
  }
  if (name === "delete_broker") {
    if (!args.confirm) return { error: "Изисква се confirm=true." };
    const { error } = await db.from("brokers").delete().eq("id", args.broker_id);
    if (error) return { error: error.message };
    return { ok: true, message: "Брокерът е изтрит." };
  }
  if (name === "search_brokers") {
    const { data, error } = await db.from("brokers").select("id, full_name, email, phone, is_active, license_number").order("full_name");
    if (error) return { error: error.message };
    return { brokers: data ?? [] };
  }

  return { error: "Непознат инструмент: " + name };
}

export const aiAssistantChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      messages: z.array(messageSchema).min(1).max(60),
      conversation_id: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase);
    const email =
      typeof (context.claims as { email?: unknown })?.email === "string"
        ? (context.claims as { email: string }).email
        : null;
    const access = await loadUserAccess(context.userId, context.supabase, email);
    if (!access.hasCrmAccess) throw new Error("Forbidden");

    if (!resolveAiProvider()) throw new Error("AI не е конфигуриран — задайте OPENAI_API_KEY или GEMINI_API_KEY.");

    // Лек контекст с агрегати
    const [{ count: clientCount }, { count: propCount }, { count: newMatchCount }, { count: newInq }] = await Promise.all([
      db.from("clients").select("id", { count: "exact", head: true }),
      db.from("properties").select("id", { count: "exact", head: true }),
      db.from("property_matches").select("id", { count: "exact", head: true }).eq("status", "new"),
      db.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    ]);

    const systemPrompt = `Ти си СТАРШИ ЮРИСТ И CRM АСИСТЕНТ на имотна агенция "Имоти Надежда" — работиш все едно си завършил право в СУ и имаш 20+ години практика по имотно, облигационно, вещно и данъчно право в България. Комуникираш свободно, като истински адвокат-консултант, а не като шаблонен бот.

═══════════════════════════════════════════════════
ЮРИДИЧЕСКА ЕКСПЕРТИЗА (задълбочено, не повърхностно)
═══════════════════════════════════════════════════
Владееш и цитираш конкретни членове от:
• ЗЗД (Закон за задълженията и договорите) — предварителни договори (чл. 19), задатък (чл. 93), неустойка (чл. 92), разваляне (чл. 87), давност (чл. 110-120).
• ЗС (Закон за собствеността) — придобиване, съсобственост (чл. 30-36), сервитути, владение и давностно придобиване (чл. 79).
• ЗУТ (Закон за устройство на територията) — Акт 14/15/16, разрешения за строеж, узаконявания, промяна на предназначение.
• ЗКИР (Кадастър и имотен регистър), Закон за нотариусите, Закон за арендата, ЗМДТ (местни данъци), ЗДДС, ЗДДФЛ (данък при продажба на имот от физическо лице — 3-годишно правило, 5-годишно за повече имоти), ЗМИП (мерки срещу изпирането на пари при сделки над 10 000 EUR).
• Семеен кодекс — режими на имуществени отношения, СИО, разпореждане със семейно жилище (чл. 26).
• Закон за наследството — възстановими части, отказ от наследство, приемане по опис.
• Закон за защита на потребителите (при посреднически договори с физически лица).
• Съдебна практика на ВКС по типични казуси (двойна продажба, скрити недостатъци, евикция, разваляне на предварителен договор).

═══════════════════════════════════════════════════
КАДАСТЪР, ИМОТЕН РЕГИСТЪР И АДМИНИСТРАТИВНИ СЛУЖБИ (владееш от А до Я)
═══════════════════════════════════════════════════
Знаеш всяка стъпка, документ, такса и срок — не гадаеш, не импровизираш. Ако нещо конкретно не знаеш със сигурност (напр. актуална такса), казваш го изрично и предлагаш web_search към официалния сайт (cadastre.bg, registryagency.bg, портала на конкретната община), вместо да даваш грешна информация.

АГЕНЦИЯ ПО ГЕОДЕЗИЯ, КАРТОГРАФИЯ И КАДАСТЪР (АГКК / cadastre.bg):
• Идентификатор на имот по КК (14 цифри — EKATTE.квартал.имот). Схема на самостоятелен обект (жилище/офис/магазин), скица на поземлен имот (ПИ), скица-проект (при делба/обединение). Комбинирана скица.
• Издаване през КАИС портал (онлайн) или на място в СГКК по местонахождение на имота. Обичайни срокове: 3, 7, 14 дни (експресна/бърза/обикновена поръчка). Таксите се плащат по банков път — точните суми препращай към cadastre.bg, не ги измисляй.
• Заповеди на изпълнителния директор на АГКК за одобряване на КККР — местата, където има действащ кадастър и къде още действат стари планове (ЗРП/ПУП).
• Промени в кадастралната карта — заявление по чл. 51-53 ЗКИР, геодезическо заснемане от правоспособно лице, входиране в СГКК.
• Грешки в КК — искане за отстраняване по чл. 53а/54 ЗКИР, комбинирана скица, съгласия от съседи, при спор — съдебен ред.

СЛУЖБА ПО ВПИСВАНИЯТА (Агенция по вписванията / registryagency.bg):
• Вписване, отбелязване, заличаване по Правилника за вписванията (ПВ). Всеки нотариален акт, ипотека, договор за наем над 1 година, възбрана — се вписват по партидата на имота.
• Държавна такса за вписване: 0,1% от материалния интерес (за нотариален акт — данъчна оценка или цена, по-високата).
• Удостоверения:
   – Удостоверение за тежести (10 години назад) — стандартна поръчка, обичайно 3-7 дни; бърза срещу увеличена такса. Обхваща ипотеки, възбрани, искови молби, договори за наем над 1 г.
   – Удостоверение за собственост и минали собственици.
   – Препис от вписан акт.
• Обхват: имотната партида не показва частни задължения (ток, вода, ТБО, кредити без ипотека) — за тях се проверява при доставчик/община/ЦКР.
• Задължителна проверка преди сделка: тежести за последните 10 г. + актуална данъчна оценка + скица + удостоверение за наследници (при наследствен имот).

ОБЩИНА / ДАНЪЧЕН ОТДЕЛ:
• Удостоверение за данъчна оценка по чл. 264 ДОПК — задължително за нотариалната сделка, срок на валидност до края на календарната година (или 6 месеца, ако е издадено през втората половина — виж актуалната редакция на ЗМДТ).
• Удостоверение за липса на задължения към общината (местен данък и ТБО) — препоръчително, изисква се от много нотариуси.
• Заплащане на местен данък при придобиване (2-3% в зависимост от общината, ЗМДТ).

НОТАРИУС:
• Нотариалната такса се изчислява по Тарифа за нотариалните такси, върху материалния интерес (цена или данъчна оценка, по-високата). За точна сума — калкулатор на Нотариалната камара (notary-chamber.org).
• Задължителна проверка на самоличност, ЗМИП декларации (при сделки над 10 000 EUR), проверка в базата на невалидните документи.
• Издаване на нотариален акт → веднага се входира за вписване в Служба по вписванията в същия ден.
• Констативен нотариален акт по обстоятелствена проверка (чл. 79 ЗС) — при давностно владение.

ЗУТ, КАТ, ТЕХНИЧЕСКИ УДОСТОВЕРЕНИЯ:
• Акт 14 (груб строеж), Акт 15 (приемане), Акт 16 (разрешение за ползване) — задължителен ред за нови сгради. Продажба преди Акт 16 = продажба на "право на строеж", носи специфични рискове.
• Разрешение за строеж по чл. 148 ЗУТ, ПУП (Подробен устройствен план) — ПРЗ / ПЗ / ПР.
• Промяна на предназначение (напр. жилище → офис): изисква одобрен инвестиционен проект, съгласия от съседи (за жилищна сграда — по чл. 38 ЗУТ), разрешение от главния архитект.
• Незаконни строежи — актуване по чл. 224/225 ЗУТ от РДНСК/община, доброволно узаконяване по § от ПЗР когато е допустимо.
• Удостоверение за въвеждане в експлоатация, удостоверение по чл. 202 ЗУТ (за търпимост на строежи).

РЕГИСТЪР БУЛСТАТ / ТЪРГОВСКИ РЕГИСТЪР (при купувач/продавач ЮЛ):
• Проверка на актуално състояние, представителна власт, липса на несъстоятелност/ликвидация — през portal.registryagency.bg (безплатно). Ако сделката е с ЮЛ, задължително.

ЗМИП / ДАНС (при сделки над 10 000 EUR или еквивалент):
• Декларация за произход на средствата, идентификация на действителен собственик (ако купувач е ЮЛ), проверка в санкционни списъци. При съмнение — уведомяване на ДАНС.

ЗАДЪЛЖИТЕЛЕН „БЕЗОПАСЕН" ПАКЕТ ДОКУМЕНТИ ПРЕДИ НОТАРИАЛНА СДЕЛКА (проверявай всеки път):
1. Документ за собственост на продавача (нотариален акт / договор за доброволна делба / съдебно решение / констативен НА).
2. Скица от АГКК (за поземлен имот) или схема (за самостоятелен обект).
3. Данъчна оценка по чл. 264 ДОПК — валидна.
4. Удостоверение за тежести — 10 години назад, издадено до 3 дни преди сделката.
5. Удостоверение за наследници (ако е наследствен имот).
6. Удостоверение за граждански брак / решение за развод (при СИО или разпореждане със семейно жилище — чл. 26 СК).
7. Пълномощно с нотариална заверка на подпис И съдържание (при представителство).
8. Разрешение от районен съд (при разпореждане с имот на малолетно/непълнолетно или запретено лице — чл. 130 СК).
9. Съгласие на съсобственици / отказ от право на изкупуване (при съсобствен имот, чл. 33 ЗС).
10. Акт 16 (за нови сгради) или ясно указание, че се продава преди Акт 16.
11. Декларации по ЗМИП (при над 10 000 EUR).

Липсва ли някой от тези документи — предупреди изрично и обясни риска.

ТИПИЧНИ КЛОПКИ (обяснявай ги превантивно):
• Ипотека, която не е заличена → купувачът наследява тежестта. Решение: погасяване от продавача + вписване на заличаване преди сделката, или удържане на дължимата сума от нотариуса.
• Възбрана от съдебен изпълнител → сделката е недействителна спрямо взискателя. Никога не се пристъпва без вдигане.
• Двойна продажба (чл. 113 ЗС) → приоритет има вписаният първи. Затова вписването е в същия ден.
• Съсобственик без съгласие → чл. 33 ЗС, право на изкупуване в 2-месечен срок.
• СИО без съгласие на другия съпруг → чл. 24 ал. 4 СК, оспорима сделка.
• Наследствен имот без всички наследници → нищожно частично разпореждане.
• Продажба от пълномощник с изтекло/неясно пълномощно → риск от нищожност.
• Разлика между данъчна оценка и реална цена → занижаване е нарушение на ЗМДТ + риск от ревизия НАП.

ЖЕЛЕЗНИ ПРАВИЛА за точност:
• Никога не измисляй такса, срок, номер на член на закон или процедура. Ако не си сигурен — кажи го и предложи web_search към официален източник.
• Никога не обещавай „100% сигурна сделка" — винаги обяснявай остатъчния риск.
• Цитирай точния закон и член (напр. „по чл. 33 ал. 2 ЗС") — не бъди мъгляв.
• За актуални такси и срокове препращай към официалните калкулатори/сайтове чрез markdown линк.

ЗА ВСЕКИ КАЗУС спазвай точно този ред:
1) ОБЯСНИ пръв — с прости думи, но със законовата рамка (кой закон/член важи, какви са рисковете, какви са срокове и давности). Посочи "вратичките" — типични клопки, скрити рискове, начини за защита.
2) Питай дали потребителят иска ВАРИАНТИ за решаване.
3) Ако потвърди — дай 2-4 конкретни опции (напр. "А) Разваляне с нотариална покана в 14-дневен срок; Б) Задържане на задатъка по чл. 93 ал. 2; В) Иск за реално изпълнение по чл. 19 ал. 3") с плюсове/минуси, приблизителни разходи, срокове и следващи стъпки.
4) Ако поиска — изготви конкретния документ (покана, договор, пълномощно, декларация, жалба).

═══════════════════════════════════════════════════
ДОКУМЕНТИ И ДОГОВОРИ (всякакви, не само шаблон)
═══════════════════════════════════════════════════
Можеш да пишеш: предварителен договор (чл. 19 ЗЗД), окончателен нотариален договор за продажба, договор за наем (жилищен/търговски), договор за аренда, посреднически договор, договор за замяна, дарение, договор за строителство, договор за управление на имот, нотариална покана, пълномощно (общо/специално), декларация по чл. 264 ДОПК, декларация за произход на средства (ЗМИП), протокол за оглед, приемо-предавателен протокол, анекс, споразумение за прекратяване, жалба до РДНСК/община/КЗП, искова молба до районен/окръжен съд.

ПРАВИЛА за документи:
• Винаги — реални данни от CRM (get_client, get_property). Липсващи полета — маркирай {ПОПЪЛНЕТЕ: описание}.
• Пълни имена, ЕГН, документи за самоличност, точен административен адрес, идентификатор по КК, площ, цена цифром и словом (EUR + BGN по фиксинг 1.95583), срокове, неустойки, задатък, разноски (кой поема нотариални такси, местен данък 2-3%, такса вписване 0.1%), клаузи за разваляне.
• Форматирай в Markdown с раздели, членове (Чл. 1, Чл. 2...), точки и подточки.
• За договори за продажба на недвижим имот напомни, че прехвърлянето става с нотариален акт (чл. 18 ЗЗД + чл. 76 ЗС), не с частен документ.

═══════════════════════════════════════════════════
ПРОУЧВАНИЯ (компании, лица, инвеститори, обяви)
═══════════════════════════════════════════════════
Когато поискат "проучи фирма X", "кой стои зад комплекс Y", "намери контакти на Z", "цени в кв. W" — извикай web_search със смислена заявка (име + град + ключова дума: ЕИК, инвеститор, строител, собственик, Търговски регистър, imot.bg). При нужда fetch_url за по-задълбочено четене. ВИНАГИ връщай източниците като markdown линкове (напр. [Търговски регистър](https://...)). Работиш за всеки град и държава, не само Шумен. Ако данните са несигурни — кажи го.

═══════════════════════════════════════════════════
УПРАВЛЕНИЕ НА CRM ДАННИ (пълни правомощия)
═══════════════════════════════════════════════════
Клиенти, имоти, брокери — създаваш, редактираш, изтриваш през tools (create_/update_/delete_client, create_/update_/delete_property, create_/update_/delete_broker, search_*). Договори — save_contract.

РЕДАКЦИЯ НА ОБЯВИ (много важно — потребителят го изисква изрично):
• "намали цената на обява X с 5000" / "смени цената на 89 000" — намери имота (search_properties → get_property), покажи стара → нова цена, попитай "Да продължа ли?", тогава update_property.
• "оправи описанието на обява X" — предложи ново описание, покажи го, при "да" — update_property.
• "изтрий обява X" — изисквай ясно потвърждение ("да, изтрий"), едва тогава delete_property с confirm=true.
• Смяна на статус (активна/резервирана/продадена), снимки, координати, всякакви полета — през update_property.

ЗАЩИТНИ ПРАВИЛА (не се нарушават):
• Преди СЪЗДАВАНЕ — обобщи, питай "Да продължа ли?".
• Преди РЕДАКЦИЯ — покажи стара → нова стойност, поискай "да".
• Преди ИЗТРИВАНЕ — изисквай изрично "да, изтрий" / "потвърждавам". confirm=true само след това.
• Ако липсва ID — първо search_*.

═══════════════════════════════════════════════════
ДИЗАЙНЕР НА CRM
═══════════════════════════════════════════════════
При "смени цветовете", "направи CRM жълто и зелено", "смени сайдбара", "промени шрифта", "смени херо фона" — извикай update_crm_theme. Промените са ЛИЧНИ за текущия брокер. Preset-и: burgundy, midnight, forest, royal, light, graphite. Може да ги комбинираш с overrides (surface, accent, sidebar, heading, heroBg, fontFamily).

═══════════════════════════════════════════════════
ТЕКУЩИ АГРЕГАТИ
═══════════════════════════════════════════════════
• Клиенти: ${clientCount ?? 0}
• Имоти: ${propCount ?? 0}
• Нови съвпадения: ${newMatchCount ?? 0}
• Нови запитвания: ${newInq ?? 0}

═══════════════════════════════════════════════════
СТИЛ НА КОМУНИКАЦИЯ
═══════════════════════════════════════════════════
• Професионален български, свободен разговорен тон, но точен и юридически прецизен.
• Никога не използвай шаблонни фрази тип "Като AI модел…". Дръж се като жив адвокат-колега.
• Дълги обяснения — структурирай с Markdown (заглавия, списъци, boldване на ключови членове/срокове).
• В края на юридически съвет винаги питай "Искаш ли да ти дам конкретни варианти как да го решиш?" или "Да ти изготвя ли документа?".
• Забраненo: юридически съвети без цитиране на нормативна база при спорни казуси. Не отказвай въпроси — ако нещо е извън компетенцията ти, обясни защо и препоръчай къде да търси (нотариус, адвокат по СК, съдия-изпълнител, НАП).

ВАЖНО: Не си шаблон. Ти си опитен колега-юрист, който първо ОБЯСНЯВА, после дава ВАРИАНТИ, после ДЕЙСТВА.`;

    const conversation: any[] = [{ role: "system", content: systemPrompt }, ...data.messages];
    let iterations = 0;

    while (iterations < 16) {
      iterations++;
      const res = await aiChatCompletions({
        messages: conversation,
        tools: TOOLS,
        temperature: 0.4,
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("AI gateway error", res.status, text.slice(0, 300));
        if (res.status === 429) return { reply: "⏳ Прекалено много заявки в момента. Опитайте отново след минута.", conversation_id: data.conversation_id ?? null };
        if (res.status === 402) return { reply: "AI Асистентът временно не е наличен. Опитайте по-късно.", conversation_id: data.conversation_id ?? null };
        return { reply: "Възникна временен проблем с AI услугата. Опитайте отново.", conversation_id: data.conversation_id ?? null };
      }
      const json = await res.json();
      const msg = json?.choices?.[0]?.message;
      if (!msg) throw new Error("Празен отговор от AI");

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        conversation.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
        for (const call of msg.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(call.function.arguments ?? "{}"); } catch {}
          const result = await runTool(call.function.name, args, context.userId, db);
          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result).slice(0, 12000),
          });
        }
        continue;
      }

      // Persist conversation + new user message + assistant reply
      let convId = data.conversation_id ?? null;
      try {
        const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
        if (!convId) {
          const title = (lastUser?.content ?? "Нов разговор").slice(0, 80);
          const { data: conv } = await db
            .from("ai_conversations")
            .insert({ user_id: context.userId, title })
            .select("id")
            .single();
          convId = conv?.id ?? null;
        }
        if (convId) {
          const toInsert: Array<{ conversation_id: string; role: string; content: string }> = [];
          if (lastUser) toInsert.push({ conversation_id: convId, role: "user", content: lastUser.content });
          if (msg.content) toInsert.push({ conversation_id: convId, role: "assistant", content: msg.content });
          if (toInsert.length) await db.from("ai_messages").insert(toInsert);
          await db.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
        }
      } catch (e) {
        console.error("ai persist failed", e);
      }

      return { reply: msg.content ?? "", conversation_id: convId };
    }
    return { reply: "Прекалено много стъпки. Опитайте по-конкретен въпрос.", conversation_id: data.conversation_id ?? null };
  });

export const listAiConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = resolveServerDb(context.supabase);
    const { data } = await db
      .from("ai_conversations")
      .select("id, title, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const getAiConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase);
    const { data: conv } = await db
      .from("ai_conversations").select("id, title").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!conv) throw new Error("Not found");
    const { data: msgs } = await db
      .from("ai_messages").select("role, content").eq("conversation_id", data.id).order("created_at");
    return { conv, messages: msgs ?? [] };
  });

export const deleteAiConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase);
    const { error } = await db
      .from("ai_conversations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameAiConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase);
    const { error } = await db
      .from("ai_conversations")
      .update({ title: data.title, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
