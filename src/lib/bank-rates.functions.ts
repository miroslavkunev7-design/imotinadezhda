import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";
import { resolveLooseDb } from "@/lib/supabase-loose-db";

export type BankBranchRow = {
  bank: string;
  city_slug: string;
  branch_label: string | null;
  color: string | null;
  image_url: string | null;
  display_order: number;
  rate_bg: number | null;
  rate_foreign: number | null;
  valid_from: string | null;
  source: string | null;
  updated_by_name: string | null;
};

/** Клоновете в града + лихвата, валидна за избрания ден. */
export const listBankBranches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { city_slug: string; day?: string }) =>
    z.object({ city_slug: z.string().min(1), day: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<BankBranchRow[]> => {
    await assertCrmAccess(context.userId, context.supabase);
    const db = resolveLooseDb(context.supabase);
    const day = data.day ?? new Date().toISOString().slice(0, 10);

    const [branches, rates] = await Promise.all([
      db
        .from("bank_branches")
        .select("bank, city_slug, branch_label, color, image_url, display_order")
        .eq("city_slug", data.city_slug)
        .order("display_order", { ascending: true }),
      db
        .from("bank_branch_rates")
        .select("bank, city_slug, rate_bg, rate_foreign, valid_from, source, updated_by_name")
        .eq("city_slug", data.city_slug)
        .lte("valid_from", day)
        .order("valid_from", { ascending: false }),
    ]);
    if (branches.error) throw new Error(branches.error.message);
    if (rates.error) throw new Error(rates.error.message);

    const latest = new Map<string, any>();
    for (const r of rates.data ?? []) if (!latest.has(r.bank)) latest.set(r.bank, r);

    return (branches.data ?? []).map((b: any) => {
      const r = latest.get(b.bank);
      return {
        bank: b.bank,
        city_slug: b.city_slug,
        branch_label: b.branch_label ?? null,
        color: b.color ?? null,
        image_url: b.image_url ?? null,
        display_order: b.display_order ?? 0,
        rate_bg: r ? Number(r.rate_bg) : null,
        rate_foreign: r ? Number(r.rate_foreign) : null,
        valid_from: r?.valid_from ?? null,
        source: r?.source ?? null,
        updated_by_name: r?.updated_by_name ?? null,
      };
    });
  });

/** Въвеждане/обновяване на лихвата за клон (банка + град + дата). */
export const upsertBankBranchRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      bank: string;
      city_slug: string;
      rate_bg: number;
      rate_foreign: number;
      valid_from: string;
      source?: string;
      updated_by_name?: string;
    }) =>
      z
        .object({
          bank: z.string().min(1),
          city_slug: z.string().min(1),
          rate_bg: z.number().min(0).max(30),
          rate_foreign: z.number().min(0).max(30),
          valid_from: z.string().min(8),
          source: z.string().optional(),
          updated_by_name: z.string().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase);
    const db = resolveLooseDb(context.supabase);
    const { error } = await db.from("bank_branch_rates").upsert(
      {
        bank: data.bank,
        city_slug: data.city_slug,
        rate_bg: data.rate_bg,
        rate_foreign: data.rate_foreign,
        valid_from: data.valid_from,
        source: data.source ?? "branch_offer",
        updated_by: context.userId,
        updated_by_name: data.updated_by_name ?? null,
      } as any,
      { onConflict: "bank,city_slug,valid_from" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Снимка/лого за картата на банката в града. */
export const setBankBranchImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bank: string; city_slug: string; image_url: string | null }) =>
    z
      .object({
        bank: z.string().min(1),
        city_slug: z.string().min(1),
        image_url: z.string().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase);
    const db = resolveLooseDb(context.supabase);
    const { error } = await db
      .from("bank_branches")
      .update({ image_url: data.image_url } as any)
      .eq("bank", data.bank)
      .eq("city_slug", data.city_slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type BankRateFetchLogRow = {
  bank: string;
  url: string | null;
  ok: boolean;
  rate_bg: number | null;
  rate_foreign: number | null;
  cities_updated: number;
  skipped_manual: number;
  error: string | null;
  fetched_at: string;
};

/** Журнал на автоматичните дневни извличания (последните записи по банка). */
export const listBankRateFetchLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BankRateFetchLogRow[]> => {
    await assertCrmAccess(context.userId, context.supabase);
    const db = resolveLooseDb(context.supabase);
    const { data, error } = await db
      .from("bank_rate_fetch_log")
      .select("bank, url, ok, rate_bg, rate_foreign, cities_updated, skipped_manual, error, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      bank: r.bank,
      url: r.url ?? null,
      ok: Boolean(r.ok),
      rate_bg: r.rate_bg !== null ? Number(r.rate_bg) : null,
      rate_foreign: r.rate_foreign !== null ? Number(r.rate_foreign) : null,
      cities_updated: Number(r.cities_updated ?? 0),
      skipped_manual: Number(r.skipped_manual ?? 0),
      error: r.error ?? null,
      fetched_at: r.fetched_at,
    }));
  });

/** Ръчно стартиране на автоматичното обновяване („Обнови сега“). */
export const refreshBankRatesNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase);
    const { runBankRateSweep } = await import("@/lib/bank-rates.server");
    const result = await runBankRateSweep({ force: true });
    return {
      day: result.day,
      updated: result.banks.filter((b) => b.ok).length,
      failed: result.banks.filter((b) => !b.ok).map((b) => b.bank),
    };
  });

export type CityLocalTax = {
  city_slug: string;
  local_tax_rate: number;
  source: string | null;
  note: string | null;
  updated_by_name: string | null;
};

/** Ставката на местния данък при прехвърляне за града (по наредба на общината). */
export const getCityLocalTax = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { city_slug: string }) =>
    z.object({ city_slug: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<CityLocalTax | null> => {
    await assertCrmAccess(context.userId, context.supabase);
    const db = resolveLooseDb(context.supabase);
    const { data: row, error } = await db
      .from("city_local_taxes")
      .select("city_slug, local_tax_rate, source, note, updated_by_name")
      .eq("city_slug", data.city_slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      city_slug: (row as any).city_slug,
      local_tax_rate: Number((row as any).local_tax_rate),
      source: (row as any).source ?? null,
      note: (row as any).note ?? null,
      updated_by_name: (row as any).updated_by_name ?? null,
    };
  });

/** Въвеждане/обновяване на ставката на местния данък за града. */
export const upsertCityLocalTax = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { city_slug: string; local_tax_rate: number; note?: string }) =>
    z
      .object({
        city_slug: z.string().min(1),
        local_tax_rate: z.number().min(0).max(3),
        note: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase);
    const db = resolveLooseDb(context.supabase);
    const { error } = await db.from("city_local_taxes").upsert(
      {
        city_slug: data.city_slug,
        local_tax_rate: data.local_tax_rate,
        source: "ordinance",
        note: data.note ?? null,
        updated_by: context.userId,
        updated_by_name: "Въведена в CRM",
      } as any,
      { onConflict: "city_slug" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
