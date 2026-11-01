import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiChatCompletions, resolveAiProvider } from "@/lib/ai-provider";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/auth/crm-access";
import { resolveServerDb } from "@/lib/supabase-server-db";
import { parseEgn } from "@/lib/egn";
import { SHUMEN_BANKS } from "@/lib/shumen-banks";

const imageSchema = z.object({
  imageBase64: z.string().min(80).max(15_000_000),
  mimeType: z.string().min(3).max(80),
});

const inputSchema = z.object({
  clientId: z.string().uuid(),
  bankId: z.string().min(1).max(40),
  images: z.array(imageSchema).min(1).max(2),
});

const OCR_SYSTEM = `Ти четеш българска лична карта (лице и/или гръб, MRZ).
Върни САМО JSON, без markdown:
{
  "full_name": string | null,
  "egn": string | null,
  "id_number": string | null,
  "birth_date": string | null,
  "valid_until": string | null,
  "issued_by": string | null,
  "nationality": string | null,
  "raw_text": string
}
ЕГН е точно 10 цифри. Номерът на картата е без интервали. Датите ISO YYYY-MM-DD ако можеш.`;

export type CkrCheckResult = {
  at: string;
  bankId: string;
  bankName: string;
  status: "passed" | "review" | "failed";
  identity: {
    full_name: string | null;
    egn: string | null;
    id_number: string | null;
    birth_date: string | null;
    valid_until: string | null;
    issued_by: string | null;
  };
  egn: ReturnType<typeof parseEgn>;
  nameMatch: boolean | null;
  adult: boolean | null;
  summary: string;
  steps: { label: string; ok: boolean; detail: string }[];
};

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

async function ocrId(images: z.infer<typeof imageSchema>[]) {
  if (!resolveAiProvider()) {
    throw new Error("AI не е конфигуриран — задайте OPENAI_API_KEY или GEMINI_API_KEY.");
  }
  const content: unknown[] = [
    { type: "text", text: "Извлечи данните от личната карта." },
    ...images.map((img) => ({
      type: "image_url" as const,
      image_url: { url: `data:${img.mimeType};base64,${img.imageBase64}` },
    })),
  ];
  const res = await aiChatCompletions({
    messages: [
      { role: "system", content: OCR_SYSTEM },
      { role: "user", content },
    ],
    temperature: 0,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Не можах да прочета картата (${res.status}). ${t.slice(0, 160)}`);
  }
  const json = await res.json();
  const raw: string = json?.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Личната карта не се разчете. Снимай лицето на картата по-близо и по-ясно.");
    parsed = JSON.parse(m[0]);
  }
  return parsed as {
    full_name?: string | null;
    egn?: string | null;
    id_number?: string | null;
    birth_date?: string | null;
    valid_until?: string | null;
    issued_by?: string | null;
  };
}

function namesClose(a: string, b: string) {
  const tokens = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-zа-яёъьюїі]/gi, " ")
      .split(/\s+/)
      .filter((p) => p.length > 1);
  const pa = new Set(tokens(a));
  const pb = tokens(b);
  if (!pa.size || !pb.length) return null;
  const hits = pb.filter((p) => pa.has(p)).length;
  if (hits >= 2) return true;
  if (hits === 1 && pb.length === 1) return true;
  return false;
}

export async function runCkrCheckHandler(
  data: z.infer<typeof inputSchema>,
  context: { userId: string; supabase: any; claims: unknown },
) {
  await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
  const bank = SHUMEN_BANKS.find((b) => b.id === data.bankId);
  if (!bank) throw new Error("Непозната банка.");

  const db = resolveServerDb(context.supabase);
  const { data: client, error } = await db
    .from("clients")
    .select("id, full_name, mortgage_data")
    .eq("id", data.clientId)
    .single();
  if (error || !client) throw new Error(error?.message ?? "Клиентът не е намерен.");

  const ocr = await ocrId(data.images);
  const egn = parseEgn(ocr.egn);
  const nameMatch = ocr.full_name ? namesClose(ocr.full_name, client.full_name ?? "") : null;
  const adult = egn.valid ? (egn.ageYears ?? 0) >= 18 : null;
  const expired =
    ocr.valid_until && /^\d{4}-\d{2}-\d{2}$/.test(ocr.valid_until)
      ? ocr.valid_until < new Date().toISOString().slice(0, 10)
      : null;

  const steps: CkrCheckResult["steps"] = [
    {
      label: "Лична карта прочетена",
      ok: Boolean(ocr.egn || ocr.id_number),
      detail: ocr.full_name ? `Име на картата: ${ocr.full_name}` : "Името не се видя ясно.",
    },
    {
      label: "ЕГН — контролна сума",
      ok: egn.valid,
      detail: egn.valid
        ? `ЕГН валидно, роден/а ${egn.birthDate}, ${egn.sex === "м" ? "мъж" : "жена"}, ${egn.ageYears} г.`
        : "ЕГН липсва или контролната цифра не съвпада.",
    },
    {
      label: "Пълнолетие",
      ok: adult === true,
      detail: adult === true ? "Над 18 г. — може ипотека." : adult === false ? "Под 18 г. — банката няма да приеме." : "Не може да се сметне възрастта.",
    },
    {
      label: "Име спрямо досието",
      ok: nameMatch !== false,
      detail:
        nameMatch === true
          ? "Името на картата съвпада с клиента."
          : nameMatch === false
            ? `На картата е „${ocr.full_name}“, в досието — „${client.full_name}“.`
            : "Няма достатъчно текст за сравнение.",
    },
    {
      label: "Срок на картата",
      ok: expired !== true,
      detail: expired === true ? `Картата е изтекла (${ocr.valid_until}).` : ocr.valid_until ? `Валидна до ${ocr.valid_until}.` : "Срокът не се прочете.",
    },
  ];

  let status: CkrCheckResult["status"] = "passed";
  if (!egn.valid || adult === false || expired === true) status = "failed";
  else if (nameMatch === false || !ocr.id_number) status = "review";

  const summary =
    status === "passed"
      ? `Самоличността е проверена. Пакетът към ${bank.name} е готов за справка в ЦКР по ЕГН.`
      : status === "failed"
        ? "Проверката спря — оправи личната карта / ЕГН и пусни отново."
        : "Има разминаване — прегледай преди да пратиш към банката.";

  const result: CkrCheckResult = {
    at: new Date().toISOString(),
    bankId: bank.id,
    bankName: bank.name,
    status,
    identity: {
      full_name: ocr.full_name ?? null,
      egn: egn.egn || null,
      id_number: ocr.id_number ?? null,
      birth_date: ocr.birth_date ?? egn.birthDate,
      valid_until: ocr.valid_until ?? null,
      issued_by: ocr.issued_by ?? null,
    },
    egn,
    nameMatch,
    adult,
    summary,
    steps,
  };

  const prev = (client.mortgage_data ?? {}) as Record<string, unknown>;
  const prevApps = (prev.bank_apps ?? {}) as Record<string, Record<string, string>>;
  const bankApp = { ...(prevApps[bank.id] ?? {}) };
  if (egn.egn) bankApp.egn = egn.egn;

  await db
    .from("clients")
    .update({
      mortgage_data: {
        ...prev,
        bank_apps: { ...prevApps, [bank.id]: bankApp },
        ckr_checks: { ...((prev.ckr_checks ?? {}) as object), [bank.id]: result },
      },
    } as never)
    .eq("id", data.clientId);

  return result;
}

export const runCkrCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) =>
    runCkrCheckHandler(data, { userId: context.userId, supabase: context.supabase, claims: context.claims }),
  );
