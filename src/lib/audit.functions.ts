import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALLOWED_ADMIN_PATHS = /^\/admin(\/[a-zA-Z0-9._\-\/]*)?$/;

export const checkAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (error) {
      console.error("admin access check failed", error);
      return { isAdmin: false };
    }

    return { isAdmin: !!data };
  });

export const logAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      path: z.string().min(1).max(255).regex(ALLOWED_ADMIN_PATHS, "Invalid admin path"),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    let ip: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
    } catch {
      ip = null;
    }
    const userAgent = (() => {
      try {
        return getRequestHeader("user-agent") ?? null;
      } catch {
        return null;
      }
    })();

    const email = (context.claims as { email?: string } | undefined)?.email ?? null;

    const { error } = await supabaseAdmin.from("admin_access_log").insert({
      path: data.path,
      user_id: context.userId,
      email,
      ip,
      user_agent: userAgent,
    });
    if (error) {
      console.error("admin_access_log insert failed", error);
      return { ok: false };
    }
    return { ok: true };
  });
