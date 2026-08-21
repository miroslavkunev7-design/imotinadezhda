import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";
import { resolveServerDb, type ServerDb } from "@/lib/supabase-server-db";
import { aiChatCompletions, resolveAiProvider } from "@/lib/ai-provider";

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

async function gate(ctx: { userId: string; supabase: ServerDb; claims: unknown }) {
  await assertCrmAccess(ctx.userId, ctx.supabase, authEmail(ctx.claims));
  return resolveServerDb(ctx.supabase) as ServerDb & { from: (t: string) => ReturnType<ServerDb["from"]> };
}

function sofiaParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute, minutes: hour * 60 + minute };
}

function pastShiftEnd(end = "17:30") {
  const [h, m] = end.split(":").map(Number);
  return sofiaParts().minutes >= h * 60 + m;
}

function phoneDigits(raw: string | null | undefined) {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("359")) return d;
  if (d.startsWith("0")) return `359${d.slice(1)}`;
  return d;
}

export const listBotDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await gate(context);
    const [{ data: agents }, { data: assignments }, { data: findings }, { data: messages }, { data: clients }] =
      await Promise.all([
        db.from("bot_agents").select("*").order("id"),
        db.from("bot_client_assignments").select("*, clients:client_id(id, full_name, phone, notes, budget_min, budget_max, currency, search_property_type, cities:search_city_id(name), quarters:search_quarter_id(name))").order("assigned_at", { ascending: false }),
        db.from("bot_findings").select("*").order("created_at", { ascending: false }).limit(20),
        db.from("bot_messages").select("*").order("created_at", { ascending: false }).limit(30),
        db.from("clients").select("id, full_name, phone, client_type, status").eq("status", "active").order("full_name").limit(80),
      ]);

    const valentin = (agents ?? []).find((a: { id: string }) => a.id === "valentin");
    if (valentin?.is_running && pastShiftEnd(valentin.shift_end ?? "17:30")) {
      await db.from("bot_agents").update({
        is_running: false,
        stopped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", "valentin");
      valentin.is_running = false;
    }

    return {
      agents: agents ?? [],
      assignments: assignments ?? [],
      findings: findings ?? [],
      messages: messages ?? [],
      clients: clients ?? [],
      whatsappReady: Boolean(process.env["WHATSAPP_TOKEN"] && process.env["WHATSAPP_PHONE_NUMBER_ID"]),
    };
  });

export const setBotRunning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.enum(["valentin", "senior"]), running: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await gate(context);
    if (data.id === "valentin" && data.running && pastShiftEnd()) {
      throw new Error("Смяната на Валентин свършва в 17:30. Утре от 08:30.");
    }
    const patch = {
      is_running: data.running,
      started_at: data.running ? new Date().toISOString() : undefined,
      stopped_at: data.running ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("bot_agents").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.running && data.id === "valentin") {
      await tickValentinInner(db);
    }
    return { ok: true };
  });

async function tickValentinInner(db: ServerDb) {
  const { data: listings } = await db
    .from("extracted_listings")
    .select("id, title, source_url, price")
    .order("created_at", { ascending: false })
    .limit(6);
  const rows = (listings ?? []).map((l: { title?: string | null; source_url?: string; price?: number | null }) => ({
    bot_id: "valentin",
    title: l.title || "Нова обява",
    source_url: l.source_url ?? null,
    summary: l.price != null ? `${l.price} €` : "Проверено при обиколката на порталите.",
  }));
  if (rows.length) await db.from("bot_findings").insert(rows);
  else {
    await db.from("bot_findings").insert({
      bot_id: "valentin",
      title: "Обиколка без нови обяви",
      summary: "Няма свежи извлечени обяви в опашката. Валентин чака следващия цикъл — пусни извличане от „Извлечени имоти“, ако порталите са тихи.",
    });
  }
  await db.from("bot_agents").update({ last_tick_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", "valentin");
}

export const tickValentin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await gate(context);
    const { data: agent } = await db.from("bot_agents").select("*").eq("id", "valentin").maybeSingle();
    if (!agent?.is_running) throw new Error("Валентин не е в смяна. Натисни „Започни работа“.");
    if (pastShiftEnd(agent.shift_end ?? "17:30")) {
      await db.from("bot_agents").update({ is_running: false, stopped_at: new Date().toISOString() }).eq("id", "valentin");
      throw new Error("17:30 — Валентин автоматично спря.");
    }
    await tickValentinInner(db);
    return { ok: true };
  });

export const assignBotClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    bot_id: z.enum(["valentin", "senior"]),
    client_ids: z.array(z.string().uuid()).min(1).max(8),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await gate(context);
    await db.from("bot_client_assignments").delete().eq("bot_id", data.bot_id);
    const { error } = await db.from("bot_client_assignments").insert(
      data.client_ids.map((client_id) => ({ bot_id: data.bot_id, client_id })),
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const analyzeAssignedClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bot_id: z.enum(["senior"]).default("senior") }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await gate(context);
    if (!resolveAiProvider()) throw new Error("AI не е конфигуриран.");
    const { data: assigned } = await db
      .from("bot_client_assignments")
      .select("id, client_id, clients:client_id(id, full_name, phone, notes, budget_min, budget_max, currency, rooms_min, rooms_max, area_min, area_max, search_property_type, cities:search_city_id(name), quarters:search_quarter_id(name))")
      .eq("bot_id", data.bot_id);
    if (!assigned?.length) throw new Error("Прикачи поне един клиент към старшия брокер.");

    const { data: props } = await db
      .from("properties")
      .select("id, title, price, currency, area_sqm, rooms, cities:city_id(name), quarters:quarter_id(name)")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(40);

    const analyses: Array<{ assignment_id: string; client_id: string; text: string; wa?: string }> = [];
    for (const row of assigned) {
      const c = row.clients as Record<string, unknown> | null;
      if (!c) continue;
      const prompt = `Ти си старши брокер в „Имоти Надежда“. Говориш изискано, топло, на български, близо до жив човек. Не лъжи за цени и наличност.

Клиент: ${JSON.stringify(c)}
Налични обяви (кратко): ${JSON.stringify(props ?? []).slice(0, 8000)}

Задача:
1) 3–6 изречения анализ на ситуацията.
2) 2–4 конкретни варианта от списъка (заглавие + защо става) или кажи че няма точно съвпадение.
3) Предложи оглед (ден/час) и следваща стъпка за живия брокер.
4) Чернова за WhatsApp до клиента — учтива, надъхваща за оглед, без емоджи спам. Маркирай я след ред WHATSAPP:`;

      const res = await aiChatCompletions({
        messages: [
          { role: "system", content: "Старши брокер на Имоти Надежда. Кратък, точен, човешки тон." },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
      });
      const json = await res.json().catch(() => ({}));
      const text = json?.choices?.[0]?.message?.content ?? "Не успях да анализирам сега.";
      const wa = text.split("WHATSAPP:")[1]?.trim() || text.slice(0, 500);
      await db.from("bot_client_assignments").update({ last_analysis: text }).eq("id", row.id);
      await db.from("bot_messages").insert({
        bot_id: data.bot_id,
        client_id: row.client_id,
        direction: "out",
        channel: "crm",
        body: text,
      });
      analyses.push({ assignment_id: row.id, client_id: row.client_id, text, wa });
    }
    return { analyses };
  });

export const draftWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    client_id: z.string().uuid(),
    body: z.string().min(3).max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await gate(context);
    const { data: client } = await db.from("clients").select("id, full_name, phone").eq("id", data.client_id).maybeSingle();
    if (!client) throw new Error("Клиентът не е намерен.");
    const digits = phoneDigits(client.phone);
    if (!digits) throw new Error("Няма телефон на клиента.");

    const token = process.env["WHATSAPP_TOKEN"];
    const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
    if (token && phoneId) {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: digits,
          type: "text",
          text: { body: data.body.slice(0, 1000) },
        }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`WhatsApp API отказа. Отвори черновата ръчно. ${err.slice(0, 180)}`);
      }
      await db.from("bot_messages").insert({
        bot_id: "senior",
        client_id: data.client_id,
        direction: "out",
        channel: "whatsapp",
        body: data.body,
      });
      return { sent: true, waUrl: null as string | null };
    }

    await db.from("bot_messages").insert({
      bot_id: "senior",
      client_id: data.client_id,
      direction: "out",
      channel: "whatsapp",
      body: data.body,
    });
    return {
      sent: false,
      waUrl: `https://wa.me/${digits}?text=${encodeURIComponent(data.body)}`,
    };
  });
