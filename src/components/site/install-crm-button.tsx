/**
 * Install CRM PWA button.
 * - Shows on the public homepage when the app is installable.
 * - On supported browsers (Chrome/Edge/Android) triggers the install prompt.
 * - On iOS shows a short Bulgarian instruction modal ("Добави в Начален екран").
 * - Hidden when already running as installed PWA (display-mode: standalone).
 */
import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallCrmButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Hide entirely if already running as installed app
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed) return null;

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (isIos) setShowIosHelp(true);
  };

  // Only render the button if we can actually do something (install prompt or iOS instructions)
  if (!deferred && !isIos) return null;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="fixed bottom-4 right-4 z-[60] inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#4f0314] to-[#260108] px-4 py-3 text-sm font-bold text-white shadow-[0_10px_30px_rgba(80,3,20,0.55)] ring-1 ring-[#c59441]/60 hover:brightness-110 transition md:bottom-6 md:right-6"
        aria-label="Изтегли CRM приложението"
      >
        <Download className="h-4 w-4 text-[#f4d07d]" />
        Изтегли CRM приложение
      </button>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-4 md:items-center"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-serif text-lg text-[#600f1c]">
                Инсталирай CRM на iPhone
              </h3>
              <button
                onClick={() => setShowIosHelp(false)}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Затвори"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-bold text-[#600f1c]">1.</span>
                <span>
                  Натисни бутона <Share className="inline h-4 w-4 align-text-bottom text-[#600f1c]" /> <strong>Сподели</strong> в Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-bold text-[#600f1c]">2.</span>
                <span>Избери <strong>„Добави в начален екран“</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-bold text-[#600f1c]">3.</span>
                <span>Натисни <strong>„Добави“</strong>. Иконата ще отвори директно вход за CRM.</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}

export default InstallCrmButton;
