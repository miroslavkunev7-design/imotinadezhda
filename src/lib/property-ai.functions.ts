import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChatCompletions } from "@/lib/ai-provider";

/**
 * AI анализ на имот: по снимките + личното описание изготвя публично описание
 * за сайта и разпознава основните данни (град, квартал, тип, площ, стаи, етаж).
 *
 * Работи през `src/lib/ai-provider.ts` (OPENAI_API_KEY / GEMINI_API_KEY /
 * AI_GATEWAY_KEY от Vercel env) — без зависимост от външна платформа.
 */
export const analyzeProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        /** Публични/подписани URL адреси на снимките (до 8). */
        image_urls: z.array(z.string().url()).max(8).default([]),
        personal_description: z.string().max(6000).optional(),
        city: z.string().max(120).optional(),
        quarter: z.string().max(120).optional(),
        property_type: z.string().max(60).optional(),
        area_sqm: z.number().nullable().optional(),
        personal_price: z.number().nullable().optional(),
        currency: z.string().max(6).default("EUR"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const content: unknown[] = [
      {
        type: "text",
        text:
          "Ти си опитен брокер на недвижими имоти в България. По приложените снимки и личните бележки " +
          "напиши ПУБЛИЧНО описание за обява на български език (200–350 думи, ясно, без измислени факти, " +
          "без телефони и без лични договорки) и извади структурираните данни.\n" +
          `Известно: град=${data.city ?? "?"}, квартал=${data.quarter ?? "?"}, тип=${data.property_type ?? "?"}, ` +
          `площ=${data.area_sqm ?? "?"} м².\n` +
          `Лични бележки: ${data.personal_description ?? "(няма)"}\n` +
          'Отговори САМО с JSON: {"site_description":"...","city":null|"...","quarter":null|"...",' +
          '"property_type":null|"...","area_sqm":null|number,"rooms":null|number,"floor":null|number,' +
          '"condition":null|"...","highlights":["..."]}',
      },
      ...data.image_urls.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    let res: Response;
    try {
      res = await aiChatCompletions({ messages: [{ role: "user", content }], temperature: 0.3 });
    } catch (e: any) {
      throw new Error(e?.message ?? "AI не е конфигуриран");
    }
    if (!res.ok) throw new Error(`AI грешка ${res.status}`);

    const json = (await res.json()) as any;
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: Record<string, unknown> = {};
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = {};
      }
    }

    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

    // „Наша цена“ = лична цена + 5 (винаги нагоре, както е договорено).
    const ourPrice =
      typeof data.personal_price === "number" && Number.isFinite(data.personal_price)
        ? data.personal_price + 5
        : null;

    return {
      ok: true as const,
      site_description: str(parsed.site_description) ?? "",
      city: str(parsed.city),
      quarter: str(parsed.quarter),
      property_type: str(parsed.property_type),
      area_sqm: num(parsed.area_sqm),
      rooms: num(parsed.rooms),
      floor: num(parsed.floor),
      condition: str(parsed.condition),
      highlights: Array.isArray(parsed.highlights)
        ? (parsed.highlights as unknown[])
            .filter((h): h is string => typeof h === "string")
            .slice(0, 8)
        : [],
      our_price: ourPrice,
      currency: data.currency,
    };
  });
