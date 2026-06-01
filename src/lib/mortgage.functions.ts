import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

export const submitMortgageApplication = createServerFn({ method: "POST" })
  .inputValidator((d) => applicationSchema.parse(d))
  .handler(async ({ data }) => {
    const payload = {
      ...data,
      email: data.email === "" ? null : data.email,
    };
    const { data: row, error } = await supabaseAdmin
      .from("mortgage_applications")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });
