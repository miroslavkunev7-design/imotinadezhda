import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const recipientSchema = z.object({ email: z.string().email(), name: z.string().optional() });

/**
 * Bulk email marketing via Resend.
 * - Requires RESEND_API_KEY + MARKETING_FROM_EMAIL secrets.
 * - Logs every attempt to email_send_log so the marketing page shows real history.
 * - Skips emails listed in suppressed_emails table.
 */
export const sendMarketingEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      recipients: z.array(recipientSchema).min(1).max(500),
      subject: z.string().min(1).max(200),
      html: z.string().min(1),
      template_name: z.string().default("marketing"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Admin gate
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.MARKETING_FROM_EMAIL ?? "no-reply@imotinadezhda.bg";

    // Load suppression list once
    const { data: suppressed } = await supabaseAdmin.from("suppressed_emails").select("email");
    const suppressSet = new Set((suppressed ?? []).map((s) => (s.email as string).toLowerCase()));

    const filtered = data.recipients.filter((r) => !suppressSet.has(r.email.toLowerCase()));

    if (!apiKey) {
      // No provider configured — log every recipient as "queued" so user sees what would have been sent
      const rows = filtered.map((r) => ({
        recipient_email: r.email,
        subject: data.subject,
        template_name: data.template_name,
        status: "queued",
        error: "RESEND_API_KEY not configured",
      }));
      if (rows.length) await supabaseAdmin.from("email_send_log").insert(rows);
      return {
        ok: false,
        sent: 0,
        failed: 0,
        queued: rows.length,
        suppressed: data.recipients.length - filtered.length,
        message: "Имейл провайдърът не е конфигуриран. Получателите са записани в лога като 'queued'.",
      };
    }

    let sent = 0;
    let failed = 0;
    const logRows: any[] = [];

    for (const r of filtered) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from,
            to: [r.email],
            subject: data.subject,
            html: data.html,
          }),
        });
        if (res.ok) {
          sent++;
          logRows.push({ recipient_email: r.email, subject: data.subject, template_name: data.template_name, status: "sent" });
        } else {
          failed++;
          const text = await res.text();
          logRows.push({ recipient_email: r.email, subject: data.subject, template_name: data.template_name, status: "failed", error: text.slice(0, 500) });
        }
      } catch (e: any) {
        failed++;
        logRows.push({ recipient_email: r.email, subject: data.subject, template_name: data.template_name, status: "failed", error: String(e?.message ?? e).slice(0, 500) });
      }
    }

    if (logRows.length) await supabaseAdmin.from("email_send_log").insert(logRows);

    return {
      ok: failed === 0,
      sent,
      failed,
      queued: 0,
      suppressed: data.recipients.length - filtered.length,
      message: `Изпратени: ${sent}, грешки: ${failed}, потиснати: ${data.recipients.length - filtered.length}`,
    };
  });
