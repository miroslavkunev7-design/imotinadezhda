import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchAllDayBankRates } from "@/lib/bank-day-rates";

export type { DayBankRate, DayBankRatesResult } from "@/lib/bank-day-rates";

export const getDayBankRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => fetchAllDayBankRates());
