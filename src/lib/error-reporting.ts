/** Client-side error reporting — logs to console (no external platform dependency). */
export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[app-error]", error, {
    route: window.location.pathname,
    ...context,
  });
}
