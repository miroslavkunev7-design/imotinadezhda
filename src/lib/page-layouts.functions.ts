import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAGE_KEYS = ["home", "sale", "rent", "about", "contacts"] as const;
const pageKeySchema = z.enum(PAGE_KEYS);

// Section schema: id + visible са задължителни; title/subtitle/props са опционални overrides.
// props е JSON-safe речник от прости стойности (string/number/boolean/null).
const propValueSchema: z.ZodType<string | number | boolean | null> = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  z.null(),
]);
const sectionSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
  visible: z.boolean(),
  title: z.string().max(200).optional(),
  subtitle: z.string().max(500).optional(),
  props: z.record(z.string().max(64), propValueSchema).optional(),
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

// ADMIN: load one page's layout
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

// ADMIN: save layout + auto-snapshot the previous version
export const savePageLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        page_key: pageKeySchema,
        sections: sectionsSchema,
        note: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Snapshot the current value (ако има) преди да го заменим
    const { data: current } = await supabase
      .from("page_layouts")
      .select("sections")
      .eq("page_key", data.page_key)
      .maybeSingle();

    if (current?.sections) {
      await supabase.from("page_layout_revisions").insert({
        page_key: data.page_key,
        sections: current.sections,
        created_by: userId,
        note: data.note ?? null,
      });
    }

    // 2. Upsert новата подредба
    const { error } = await supabase.from("page_layouts").upsert({
      page_key: data.page_key,
      sections: data.sections as any,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    // 3. Подрязваме историята до последните 30 версии за тази страница
    const { data: keep } = await supabase
      .from("page_layout_revisions")
      .select("id")
      .eq("page_key", data.page_key)
      .order("created_at", { ascending: false })
      .limit(30);
    if (keep && keep.length === 30) {
      const oldestKept = keep[keep.length - 1].id;
      const { data: olderRows } = await supabase
        .from("page_layout_revisions")
        .select("id, created_at")
        .eq("page_key", data.page_key)
        .order("created_at", { ascending: false });
      if (olderRows) {
        const cutoffIdx = olderRows.findIndex((r) => r.id === oldestKept);
        const toDelete = olderRows.slice(cutoffIdx + 1).map((r) => r.id);
        if (toDelete.length > 0) {
          await supabase.from("page_layout_revisions").delete().in("id", toDelete);
        }
      }
    }

    return { ok: true };
  });

// ADMIN: reset (snapshot then delete row → defaults take over)
export const resetPageLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ page_key: pageKeySchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: current } = await supabase
      .from("page_layouts")
      .select("sections")
      .eq("page_key", data.page_key)
      .maybeSingle();
    if (current?.sections) {
      await supabase.from("page_layout_revisions").insert({
        page_key: data.page_key,
        sections: current.sections,
        created_by: userId,
        note: "Преди връщане към оригинала",
      });
    }
    const { error } = await supabase
      .from("page_layouts")
      .delete()
      .eq("page_key", data.page_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ADMIN: list revisions
export const listPageLayoutRevisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ page_key: pageKeySchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("page_layout_revisions")
      .select("id, sections, note, created_by, created_at")
      .eq("page_key", data.page_key)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return { revisions: rows ?? [] };
  });

// ADMIN: restore a specific revision (snapshots current, then writes it as the live layout)
export const restorePageLayoutRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ page_key: pageKeySchema, revision_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rev, error: revErr } = await supabase
      .from("page_layout_revisions")
      .select("sections")
      .eq("id", data.revision_id)
      .eq("page_key", data.page_key)
      .maybeSingle();
    if (revErr) throw new Error(revErr.message);
    if (!rev) throw new Error("Версията не е намерена.");

    const parsed = sectionsSchema.safeParse(rev.sections);
    if (!parsed.success) throw new Error("Невалидна структура на версията.");

    // Snapshot current preview restoring
    const { data: current } = await supabase
      .from("page_layouts")
      .select("sections")
      .eq("page_key", data.page_key)
      .maybeSingle();
    if (current?.sections) {
      await supabase.from("page_layout_revisions").insert({
        page_key: data.page_key,
        sections: current.sections,
        created_by: userId,
        note: "Преди restore",
      });
    }

    const { error } = await supabase.from("page_layouts").upsert({
      page_key: data.page_key,
      sections: parsed.data as any,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true, sections: parsed.data };
  });
