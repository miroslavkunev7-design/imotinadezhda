// Public cron endpoint: scans broker_tasks for due reminders and sends Web Push
// to every subscribed device of the task owner. Marks reminded_at so it never
// re-fires. Called by pg_cron every minute via pg_net.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/task-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPush } = await import("@/lib/push.server");

        const nowIso = new Date().toISOString();
        const horizon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // candidates: not completed, no reminded_at, due within 24h
        const { data: tasks, error } = await supabaseAdmin
          .from("broker_tasks")
          .select("id, title, description, due_at, reminder_minutes, broker_id, brokers:broker_id(user_id)")
          .eq("is_completed", false)
          .is("reminded_at", null)
          .not("due_at", "is", null)
          .lte("due_at", horizon);

        if (error) return Response.json({ error: error.message }, { status: 500 });

        const now = Date.now();
        let pushed = 0, fired = 0, removed = 0;

        for (const t of tasks ?? []) {
          const dueMs = new Date(t.due_at as string).getTime();
          const lead = ((t as any).reminder_minutes ?? 180) * 60 * 1000;
          const fireAt = dueMs - lead;
          if (now < fireAt || now > dueMs + 60 * 60 * 1000) continue;

          // claim atomically
          const { data: claimed } = await supabaseAdmin
            .from("broker_tasks")
            .update({ reminded_at: nowIso })
            .eq("id", (t as any).id)
            .is("reminded_at", null)
            .select("id")
            .maybeSingle();
          if (!claimed) continue;
          fired++;

          const userId = (t as any).brokers?.user_id;
          if (!userId) continue;

          const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("endpoint, p256dh, auth")
            .eq("user_id", userId);

          for (const s of subs ?? []) {
            const r = await sendPush(s as any, {
              title: `⏰ Напомняне: ${(t as any).title}`,
              body: `Срок: ${new Date(t.due_at as string).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" })}${(t as any).description ? "\n" + (t as any).description : ""}`,
              url: "/admin/tasks",
              tag: `task-${(t as any).id}`,
            });
            if (r.ok) pushed++;
            if (r.gone) { await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", (s as any).endpoint); removed++; }
          }
        }

        let viewings = { fired: 0, emails: 0, pushed: 0 };
        try {
          const { runViewingReminders } = await import("@/lib/viewings-reminders.server");
          viewings = await runViewingReminders();
        } catch {
          /* viewing reminders are optional if the table is missing */
        }

        return Response.json({ ok: true, fired, pushed, removedDeadSubs: removed, viewings });
      },
    },
  },
});
