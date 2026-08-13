import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/auth/crm-access";
import { resolveServerDb } from "@/lib/supabase-server-db";

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

const uuid = z.string().uuid();
const optStr = z.string().max(500).optional().nullable();
const optDate = z.string().max(20).optional().nullable();
const optNum = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().nullable().optional());

// ---------------- RENTALS ----------------

export const listRentals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = resolveServerDb(context.supabase) as any;
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { data, error } = await db
      .from("rentals")
      .select("*, cities:city_id(name), quarters:quarter_id(name), tenant:tenant_client_id(full_name, phone), landlord:landlord_client_id(full_name, phone)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const rentalSchema = z.object({
  id: uuid.optional().nullable(),
  tenant_client_id: uuid.optional().nullable(),
  landlord_client_id: uuid.optional().nullable(),
  property_id: uuid.optional().nullable(),
  city_id: uuid.optional().nullable(),
  quarter_id: uuid.optional().nullable(),
  address: optStr,
  tenant_name: optStr,
  tenant_phone: optStr,
  landlord_name: optStr,
  landlord_phone: optStr,
  start_date: optDate,
  end_date: optDate,
  monthly_rent: optNum,
  management_fee: optNum,
  currency: z.string().max(8).default("EUR"),
  payment_day: optNum,
  deposit: optNum,
  inventory: z.string().max(4000).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  status: z.string().max(20).default("active"),
});

export const upsertRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => rentalSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase) as any;
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const clean: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() };
    if (!clean.id) { clean.created_by = context.userId; delete clean.id; }
    const { data: row, error } = await db.from("rentals").upsert(clean).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase) as any;
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { error } = await db.from("rentals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- PAYMENTS ----------------

export const listRentalPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rental_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase) as any;
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { data: rows, error } = await db
      .from("rental_payments")
      .select("*")
      .eq("rental_id", data.rental_id)
      .order("period_month", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const paymentSchema = z.object({
  id: uuid.optional().nullable(),
  rental_id: uuid,
  period_month: z.string().min(7), // "YYYY-MM" or "YYYY-MM-DD"
  due_date: optDate,
  paid_date: optDate,
  amount: optNum,
  currency: z.string().max(8).default("EUR"),
  status: z.enum(["paid", "unpaid", "late", "partial"]).default("unpaid"),
  document_url: optStr,
  document_name: optStr,
  document_mime: optStr,
  notes: z.string().max(2000).optional().nullable(),
});

export const upsertRentalPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => paymentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase) as any;
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    // Normalise period_month to first day of month.
    const pm = data.period_month.length === 7 ? `${data.period_month}-01` : data.period_month;
    const clean: Record<string, unknown> = { ...data, period_month: pm, updated_at: new Date().toISOString() };
    if (!clean.id) delete clean.id;
    const { data: row, error } = await db
      .from("rental_payments")
      .upsert(clean, { onConflict: "rental_id,period_month" })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteRentalPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase) as any;
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { error } = await db.from("rental_payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });