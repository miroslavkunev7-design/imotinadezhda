import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const logAdminAccess = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      path: z.string().min(1).max(255),
      userId: z.string().uuid().nullable().optional(),
      email: z.string().max(255).nullable().optional(),
    }).parse,
  )
  .handler(async ({ data }) => {
    let ip: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
    } catch {}
    const userAgent = (() => {
      try { return getRequestHeader("user-agent") ?? null; } catch { return null; }
    })();

    const { error } = await supabaseAdmin.from("admin_access_log").insert({
      path: data.path,
      user_id: data.userId ?? null,
      email: data.email ?? null,
      ip,
      user_agent: userAgent,
    });
    if (error) {
      console.error("admin_access_log insert failed", error);
      return { ok: false };
    }
    return { ok: true };
  });
