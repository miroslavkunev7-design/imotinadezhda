import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(8000),
});

async function buildContext() {
  const [{ data: cities }, { data: quarters }, { count: propCount }, { data: recentProps }, { count: newInqCount }, { data: recentInq }] = await Promise.all([
    supabaseAdmin.from("cities").select("slug, name, region, population").order("display_order"),
    supabaseAdmin.from("quarters").select("slug, name, city_id, avg_price_per_sqm").order("display_order"),
    supabaseAdmin.from("properties").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("properties").select("title, price, currency, property_type, status, is_published, is_featured, cities:city_id(name)").order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabaseAdmin.from("inquiries").select("name, email, message, status, created_at, properties:property_id(title)").order("created_at", { ascending: false }).limit(5),
  ]);

  return `АКТУАЛНИ ДАННИ ОТ ПЛАТФОРМАТА ИЛДЖ.ИА (Postgres / Supabase):

ГРАДОВЕ (${cities?.length ?? 0}):
${(cities ?? []).map((c) => `• ${c.name} (${c.slug}) — регион: ${c.region ?? "—"}, население: ${c.population ?? "—"}`).join("\n")}

КВАРТАЛИ (${quarters?.length ?? 0}):
${(quarters ?? []).map((q) => `• ${q.name} (${q.slug}) — средна цена: ${q.avg_price_per_sqm ?? "—"} €/м²`).join("\n")}

ИМОТИ: общо ${propCount ?? 0}. Последно добавени:
${(recentProps ?? []).map((p: any) => `• "${p.title}" — ${p.price} ${p.currency}, ${p.property_type}/${p.status}, град: ${p.cities?.name ?? "—"}${p.is_featured ? " ★" : ""}${p.is_published ? "" : " (черновa)"}`).join("\n")}

ЗАПИТВАНИЯ: нови ${newInqCount ?? 0}. Последни:
${(recentInq ?? []).map((i: any) => `• ${i.name} <${i.email}> [${i.status}] — ${i.properties?.title ? `за "${i.properties.title}" — ` : ""}${(i.message ?? "").slice(0, 100)}`).join("\n")}`;
}

export const aiAssistantChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      messages: z.array(messageSchema).min(1).max(40),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Admin check
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY не е конфигуриран");

    const dbContext = await buildContext();
    const systemPrompt = `Ти си ИЛДЖ.ИА Асистент — изключително интелигентен експерт-помощник за администратор на луксозна имотна платформа в България. Помагаш с анализ, статистики, идеи за описания, оптимизация на офертите, обработка на запитвания и стратегии за продажба.

Правила:
- Винаги отговаряй на български език, професионално и стегнато.
- Базирай отговорите си върху реалните данни по-долу.
- Когато потребителят иска описание/обява, генерирай елегантен и убедителен текст, подходящ за луксозен сегмент.
- Когато се иска статистика, изчисли я от данните по-долу и я представи структурирано.
- Когато се обсъжда запитване, предложи професионален отговор и стъпки за обработка.
- Ако данните не са достатъчни, кажи го честно.

${dbContext}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "system", content: systemPrompt }, ...data.messages],
        temperature: 0.6,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Достигнат е лимитът на заявките. Опитайте по-късно.");
      if (res.status === 402) throw new Error("Изчерпан кредит за AI. Добавете средства в Lovable AI.");
      throw new Error(`AI грешка: ${res.status} ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    const reply: string = json?.choices?.[0]?.message?.content ?? "";
    return { reply };
  });
