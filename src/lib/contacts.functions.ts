import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const entrySchema = z.object({
  id: z.string().uuid().optional(),
  group_id: z.string().uuid(),
  company_name: z.string().trim().min(1).max(255),
  contact_person: z.string().trim().max(255).optional().nullable(),
  role: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(80).optional().nullable(),
  email: z.string().trim().max(255).optional().nullable(),
  website: z.string().trim().max(255).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  vat_number: z.string().trim().max(50).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const groupSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  icon: z.string().trim().max(60).optional().nullable(),
  display_order: z.number().int().min(0).max(999).optional(),
});

export const listContactGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contact_groups")
      .select("*")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { groups: data ?? [] };
  });

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contact_entries")
      .select("*")
      .order("company_name", { ascending: true });
    if (error) throw new Error(error.message);
    return { contacts: data ?? [] };
  });

export const saveContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => entrySchema.parse(input))
  .handler(async ({ data, context }) => {
    const payload = { ...data, created_by: context.userId };
    if (data.id) {
      const { error } = await context.supabase
        .from("contact_entries")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("contact_entries")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("contact_entries")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveContactGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => groupSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("contact_groups")
        .update(data)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("contact_groups")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteContactGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("contact_groups")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
