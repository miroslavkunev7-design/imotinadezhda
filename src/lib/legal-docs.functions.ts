import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChatCompletions, resolveAiProvider } from "@/lib/ai-provider";
import { assertCrmAccess } from "@/lib/auth/crm-access";
import {
  NOTARY_EXTRACTION_PROMPT,
  buildDepositReceipt,
  buildSaleContract,
  parseNotaryJson,
  type NotaryAct,
} from "@/lib/legal-docs";

const inputSchema = z.object({
  file_name: z.string().max(200),
  mime_type: z.string().max(120),
  /** data:<mime>;base64,... — изпраща се от браузъра след обработка на изображението. */
  file_data: z.string().min(32),
  kind: z.enum(["contract", "receipt", "both"]).default("both"),
  deposit_amount: z.number().nonnegative().nullable().optional(),
  deposit_currency: z.string().max(8).nullable().optional(),
});

/** Извлича данните от нотариален акт и генерира договор / разписка. */
export const analyzeNotaryAct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(
      context.userId,
      context.supabase,
      (context.claims as { email?: string } | undefined)?.email ?? null,
    );
    if (!resolveAiProvider()) throw new Error("AI не е конфигуриран.");

    const isPdf = data.mime_type.includes("pdf") || data.file_name.toLowerCase().endsWith(".pdf");
    const contentBlock = isPdf
      ? { type: "file", file: { filename: data.file_name, file_data: data.file_data } }
      : { type: "image_url", image_url: { url: data.file_data } };

    const res = await aiChatCompletions({
      temperature: 0.1,
      messages: [
        { role: "system", content: NOTARY_EXTRACTION_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Извлечи данните от този документ и върни САМО JSON." },
            contentBlock,
          ],
        },
      ],
    });

    if (res.status === 429) throw new Error("Твърде много заявки към AI — опитай след минута.");
    if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const act: NotaryAct = parseNotaryJson(raw);

    return {
      extracted: act,
      contract_text:
        data.kind === "receipt" ? null : buildSaleContract(act),
      receipt_text:
        data.kind === "contract"
          ? null
          : buildDepositReceipt(act, {
              amount: data.deposit_amount ?? null,
              currency: data.deposit_currency ?? "EUR",
            }),
    };
  });
