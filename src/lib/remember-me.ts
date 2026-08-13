// "Remember me" handling for Supabase auth.
//
// Supabase persists sessions in localStorage by default, which keeps the user
// signed in indefinitely across browser restarts. When "remember me" is OFF
// we want the session to die when the browser/tab closes (session-scoped).
//
// Implementation: when the user opts out of remembering, we set a localStorage
// flag plus a per-tab sessionStorage marker. On app boot, if the flag is set
// and no tab marker exists (= new browser session, not a same-tab reload), we
// sign out before the AuthProvider hydrates. The marker is then set so reloads
// inside the same tab keep the session alive until the tab is actually closed.

import { supabase } from "@/integrations/supabase/client";

const FLAG_KEY = "imoti-auth-session-only";
const TAB_KEY = "imoti-auth-tab-marker";

export function setRememberMe(remember: boolean): void {
  try {
    if (remember) {
      localStorage.removeItem(FLAG_KEY);
      sessionStorage.removeItem(TAB_KEY);
    } else {
      localStorage.setItem(FLAG_KEY, "1");
      sessionStorage.setItem(TAB_KEY, "1");
    }
  } catch {
    /* ignore storage errors */
  }
}

export async function enforceRememberMePolicy(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const sessionOnly = localStorage.getItem(FLAG_KEY) === "1";
    if (!sessionOnly) return;

    const tabAlive = sessionStorage.getItem(TAB_KEY) === "1";
    if (!tabAlive) {
      // New browser session (tab/window was closed) — drop persisted session.
      await supabase.auth.signOut().catch(() => {});
      localStorage.removeItem(FLAG_KEY);
    } else {
      // Same tab, just a reload — keep going.
      sessionStorage.setItem(TAB_KEY, "1");
    }
  } catch {
    /* ignore */
  }
}
