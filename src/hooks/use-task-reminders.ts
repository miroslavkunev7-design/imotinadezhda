import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Poll broker_tasks every minute. When a task's "due_at - reminder_minutes"
 * window has passed and reminded_at is null, fire:
 *   - sonner toast (long, persistent),
 *   - browser Notification (desktop + Android Chrome) with sound,
 *   - audio beep,
 *   - mark reminded_at = now() so it never re-fires.
 *
 * Works as long as the admin page (or installed PWA) is open in the
 * background. For true push when the app is fully closed, a service worker
 * + VAPID push subscription would be required (significant additional setup).
 */
export function useTaskReminders() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Lazily request notification permission once
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      // Don't auto-prompt aggressively; wait for a user gesture (click anywhere)
      const ask = () => {
        Notification.requestPermission().catch(() => {});
        window.removeEventListener("click", ask);
      };
      window.addEventListener("click", ask, { once: true });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Build a small beep using a data URI so we don't ship an audio file
    const a = new Audio(
      "data:audio/mpeg;base64,SUQzAwAAAAAAFlRJVDIAAAAMAAAAAGJlZXAAAAAAAAA=" // tiny placeholder
    );
    audioRef.current = a;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("broker_tasks")
        .select("id, title, description, due_at, reminder_minutes, reminded_at, is_completed, brokers:broker_id(full_name)")
        .eq("is_completed", false)
        .is("reminded_at", null)
        .not("due_at", "is", null)
        .lte("due_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()); // only look ahead 24h

      if (cancelled || error || !data) return;

      const now = Date.now();
      const due = (data as any[]).filter((t) => {
        if (!t.due_at) return false;
        const dueMs = new Date(t.due_at).getTime();
        const lead = (t.reminder_minutes ?? 180) * 60 * 1000;
        const fireAt = dueMs - lead;
        return now >= fireAt && now <= dueMs + 60 * 60 * 1000; // grace 1h after due
      });

      for (const t of due) {
        try {
          const { error: upErr } = await supabase
            .from("broker_tasks")
            .update({ reminded_at: nowIso })
            .eq("id", t.id)
            .is("reminded_at", null); // race-safe: only first tab fires it
          if (upErr) continue;

          fireReminder({
            title: `⏰ Напомняне: ${t.title}`,
            body: t.due_at
              ? `Срок: ${new Date(t.due_at).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" })}\n${t.description ?? ""}`.trim()
              : (t.description ?? ""),
            audio: audioRef.current,
          });
        } catch {
          /* ignore */
        }
      }

      try {
        const { processViewingReminders } = await import("@/lib/viewings.functions");
        const viewing = await processViewingReminders();
        for (const n of viewing.notifications ?? []) {
          fireReminder({ title: n.title, body: n.body, audio: audioRef.current });
        }
      } catch {
        /* viewings table or auth not ready */
      }
    };

    // First check shortly after mount, then every 60s
    const t0 = setTimeout(check, 4000);
    const iv = setInterval(check, 60_000);
    return () => { cancelled = true; clearTimeout(t0); clearInterval(iv); };
  }, []);
}

function fireReminder(opts: { title: string; body: string; audio: HTMLAudioElement | null }) {
  // 1) Persistent toast
  toast(opts.title, {
    description: opts.body,
    duration: 60_000,
  });

  // 2) Native browser notification (works on Android Chrome + Desktop)
  try {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      const n = new Notification(opts.title, {
        body: opts.body,
        tag: opts.title,
        requireInteraction: true,
        silent: false,
      });
      n.onclick = () => { window.focus(); n.close(); };
    }
  } catch { /* ignore */ }

  // 3) Vibrate on mobile
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate?.([400, 200, 400, 200, 800]);
    }
  } catch { /* ignore */ }

  // 4) Beep using Web Audio (no asset needed)
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AC) {
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.15;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(() => { o.frequency.value = 660; }, 250);
      setTimeout(() => { o.stop(); ctx.close().catch(() => {}); }, 700);
    }
  } catch { /* ignore */ }
}
