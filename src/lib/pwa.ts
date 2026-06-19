// PWA install + service worker helpers.
// All code is client-only and guards against iframe/preview contexts.

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

function isPreviewOrIframe(): boolean {
  if (typeof window === "undefined") return true;
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("vercel.app");
  return inIframe || isPreviewHost;
}

export function initPwa(): void {
  if (typeof window === "undefined") return;

  // Always unregister stale SWs in preview/iframe to keep the editor fresh.
  if (isPreviewOrIframe()) {
    navigator.serviceWorker?.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister().catch(() => {}));
    }).catch(() => {});
    return;
  }

  // Register service worker only in production-style contexts.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // 1) When a new SW takes control, reload once so the user gets the latest build.
          let refreshing = false;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });

          // 2) When a new SW finishes installing, ask it to skip waiting.
          const triggerUpdate = (worker: ServiceWorker | null) => {
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) {
                try { worker.postMessage({ type: "SKIP_WAITING" }); } catch {}
              }
            });
          };
          triggerUpdate(registration.installing);
          registration.addEventListener("updatefound", () => {
            triggerUpdate(registration.installing);
          });

          // 3) Poll for updates periodically and when tab regains focus/visibility.
          const checkForUpdate = () => { registration.update().catch(() => {}); };
          setInterval(checkForUpdate, 60 * 1000);
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") checkForUpdate();
          });
          window.addEventListener("focus", checkForUpdate);
        })
        .catch(() => {});
    });
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l(true));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((l) => l(false));
  });
}

export function canInstallApp(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    listeners.forEach((l) => l(false));
    return choice.outcome;
  } catch {
    return "dismissed";
  }
}

export function onInstallAvailabilityChange(cb: (available: boolean) => void): () => void {
  listeners.add(cb);
  // Fire current state immediately
  cb(canInstallApp());
  return () => {
    listeners.delete(cb);
  };
}
