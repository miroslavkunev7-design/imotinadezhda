import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAGE_KEYS = ["home", "sale", "rent", "about", "contacts"] as const;
const pageKeySchema = z.enum(PAGE_KEYS);

const sectionSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
  visible: z.boolean(),
});
const sectionsSchema = z.array(sectionSchema).max(64);

export type PageSectionState = z.infer<typeof sectionSchema>;
export type PageKey = (typeof PAGE_KEYS)[number];

// PUBLIC: anyone can read the saved layout (RLS policy allows public SELECT)
export const getPublicPageLayout = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ page_key: pageKeySchema }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("page_layouts")
      .select("sections")
      .eq("page_key", data.page_key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const parsed = row?.sections ? sectionsSchema.safeParse(row.sections) : null;
    return parsed && parsed.success ? parsed.data : null;
  });

// ADMIN: list one page's layout
export const getPageLayout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ page_key: pageKeySchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("page_layouts")
      .select("sections,updated_at")
      .eq("page_key", data.page_key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const parsed = row?.sections ? sectionsSchema.safeParse(row.sections) : null;
    return {
      sections: parsed && parsed.success ? parsed.data : null,
      updated_at: row?.updated_at ?? null,
    };
  });

// ADMIN: save layout
export const savePageLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ page_key: pageKeySchema, sections: sectionsSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("page_layouts")
      .upsert({
        page_key: data.page_key,
        sections: data.sections,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ADMIN: reset (delete row → defaults take over)
export const resetPageLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ page_key: pageKeySchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("page_layouts").delete().eq("page_key", data.page_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
