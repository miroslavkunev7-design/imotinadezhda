import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChatCompletions } from "@/lib/ai-provider";

/**
 * AI проверка на качен документ: за кой месец е (фиш / банково извлечение).
 * Връща открития месец и дали съвпада с очаквания.
 */
export const checkDocumentMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        /** data URL (image/* или application/pdf) */
        file_data: z.string().min(32).max(14_000_000),
        expected_month: z.string().regex(/^\d{4}-\d{2}$/),
        kind: z.enum(["payslip", "bank_statement"]).default("payslip"),
        file_name: z.string().max(255).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const isImage = data.file_data.startsWith("data:image");
    const kindLabel =
      data.kind === "payslip" ? "фиш за работна заплата" : "извлечение от банкова сметка";

    const content: unknown[] = [
      {
        type: "text",
        text:
          `Това е ${kindLabel}. Определи за кой календарен месец и година се отнася документът ` +
          `(периодът, за който е начислен, не датата на печат). ` +
          `Отговори САМО с JSON: {"month":"YYYY-MM"|null,"is_expected_kind":true|false,"confidence":0-1,"note":"кратко на български"}.`,
      },
    ];
    if (isImage) {
      content.push({ type: "image_url", image_url: { url: data.file_data } });
    } else {
      content.push({
        type: "file",
        file: { filename: data.file_name ?? "document.pdf", file_data: data.file_data },
      });
    }

    let res: Response;
    try {
      res = await aiChatCompletions({
        messages: [{ role: "user", content }],
        temperature: 0,
      });
    } catch {
      return { ok: true, skipped: true, month: null, note: "AI проверката е недостъпна." } as const;
    }
    if (!res.ok) {
      return { ok: true, skipped: true, month: null, note: "AI проверката е недостъпна." } as const;
    }

    const json = (await res.json()) as any;
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return { ok: true, skipped: true, month: null, note: "Месецът не беше разчетен." } as const;
    }

    let parsed: {
      month?: string | null;
      is_expected_kind?: boolean;
      confidence?: number;
      note?: string;
    } = {};
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return { ok: true, skipped: true, month: null, note: "Месецът не беше разчетен." } as const;
    }

    const month =
      typeof parsed.month === "string" && /^\d{4}-\d{2}$/.test(parsed.month) ? parsed.month : null;
    if (!month) {
      return {
        ok: true,
        skipped: true,
        month: null,
        note: parsed.note ?? "Месецът не беше разчетен.",
      } as const;
    }

    return {
      ok: month === data.expected_month,
      skipped: false,
      month,
      note: parsed.note ?? "",
    } as const;
  });
