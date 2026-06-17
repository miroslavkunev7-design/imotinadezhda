import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const fileSchema = z.object({
  category: z.string().max(80),
  month: z.string().max(20).optional().nullable(),
  path: z.string().max(500),
  file_name: z.string().max(300),
  size: z.number().nonnegative().optional(),
});

const applicationSchema = z.object({
  property_id: z.string().uuid().optional().nullable(),
  full_name: z.string().min(2).max(200),
  phone: z.string().min(4).max(40),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  employer: z.string().max(200).optional().nullable(),
  monthly_income: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  files: z.array(fileSchema).max(60),
});

const uploadSchema = z.object({
  category: z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/),
  month: z.string().max(20).optional().nullable(),
  fileName: z.string().min(1).max(300),
  contentType: z.string().max(120).optional().nullable(),
  size: z.number().int().nonnegative().max(20 * 1024 * 1024),
  base64: z.string().min(1),
});

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "document";
}

export const uploadMortgageDocument = createServerFn({ method: "POST" })
  .inputValidator((d) => uploadSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = safeFileName(data.fileName);
    const monthPart = data.month ? `-${data.month.replace(/[^a-zA-Z0-9_-]+/g, "-")}` : "";
    const path = `${crypto.randomUUID()}/${data.category}${monthPart}-${Date.now()}-${safeName}`;
    const bytes = Uint8Array.from(atob(data.base64), (char) => char.charCodeAt(0));
    const { error } = await supabaseAdmin.storage
      .from("mortgage-docs")
      .upload(path, bytes, {
        contentType: data.contentType || "application/octet-stream",
        upsert: false,
      });
    if (error) {
      console.error("[mortgage-docs-upload]", error);
      throw new Error("Грешка при качване на документа.");
    }
    return { category: data.category, month: data.month ?? undefined, path, file_name: data.fileName, size: data.size };
  });

export const submitMortgageApplication = createServerFn({ method: "POST" })
  .inputValidator((d) => applicationSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      ...data,
      email: data.email === "" ? null : data.email,
    };
    const { data: row, error } = await supabaseAdmin
      .from("mortgage_applications")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      console.error("[mortgage-application-submit]", error);
      throw new Error("Грешка при изпращане на заявлението.");
    }
    return { id: row.id };
  });
