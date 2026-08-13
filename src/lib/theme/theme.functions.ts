import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/auth/assert-admin";
import type { ThemePresets, ThemeTokens } from "./tokens";

export const saveTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tokens: ThemeTokens; presets: ThemePresets }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { error } = await context.supabase
      .from("theme_settings")
      .update({ tokens: data.tokens, presets: data.presets, updated_by: context.userId })
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
