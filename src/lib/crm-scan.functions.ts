import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  imageBase64: z.string().min(100).max(15_000_000),
  mimeType: z.string().min(3).max(80),
});

const SYSTEM = `Ти си асистент за разпознаване на клиентски бележки на български език за агенция за недвижими имоти.
Получаваш СНИМКА (ръкопис от тетрадка ИЛИ печатен документ ИЛИ визитка).
Извличаш ВСИЧКА разпозната информация и я връщаш СТРИКТНО като валиден JSON със следната схема:

{
  "full_name": string | null,            // име на клиента
  "phone": string | null,                 // телефон (нормализиран ако може, иначе както е написан)
  "email": string | null,
  "client_type": "buyer" | "seller" | "tenant" | "landlord" | null,
  "search_property_type": "apartment" | "house" | "office" | "land" | "commercial" | null,
  "search_status": "sale" | "rent" | null,
  "rooms_min": number | null,
  "rooms_max": number | null,
  "area_min": number | null,
  "area_max": number | null,
  "budget_min": number | null,
  "budget_max": number | null,
  "currency": "EUR" | "BGN" | null,
  "city": string | null,                  // име на града (както е написано)
  "quarter": string | null,               // име на квартала
  "deal_stage": "lead" | "viewing" | "negotiation" | "started" | "mortgage" | "closed" | null,
  "notes": string | null,                  // всичко останало — срещи, дати, бележки
  "raw_text": string                       // целият извлечен текст
}

Правила:
- Връщай САМО JSON, без markdown ограждания, без обяснения.
- Ако нещо не е сигурно — null.
- "тристаен" => rooms_min=3, rooms_max=3. "2-3 стаен" => rooms_min=2, rooms_max=3.
- Числа без валута приемай за EUR ако сумата е под 5000 (наем) или над 30000 (продажба).
- Гарантирай валиден JSON.`;

export const scanClientFromImage = createServerFn({ method: "POST" })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY не е конфигуриран");

    const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Извлечи информацията от тази снимка." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Лимитът е изчерпан, моля опитай след малко.");
    if (res.status === 402) throw new Error("Кредитите за AI са изчерпани. Зареди от Settings → Workspace → Usage.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI грешка ${res.status}: ${t.slice(0, 200)}`);
    }

    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    // Strip code fences if any
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON object
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("AI не върна валиден JSON");
      parsed = JSON.parse(m[0]);
    }
    return { ok: true as const, data: parsed };
  });
