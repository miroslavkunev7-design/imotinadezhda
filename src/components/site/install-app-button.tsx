import { useEffect, useState } from "react";
import { Download, Smartphone, X, Share, Plus } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "android" | "ios" | "desktop" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Linux/i.test(ua)) return "desktop";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallAppButton() {
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("other");
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showDesktopHelp, setShowDesktopHelp] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mounted || installed) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (platform === "ios") {
      setShowIosHelp(true);
      return;
    }
    // Desktop without BIP (Safari/Firefox) or other
    setShowDesktopHelp(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="fixed bottom-5 right-4 z-50 inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/70 bg-[#8B1A2B] px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_30px_-6px_rgba(0,0,0,0.55)] backdrop-blur transition hover:bg-[#a02335] active:scale-95 sm:bottom-6 sm:right-6"
        aria-label="Инсталирай приложението"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Инсталирай приложението</span>
        <span className="sm:hidden">Инсталирай</span>
      </button>

      {showIosHelp && (
        <HelpModal
          title="Инсталирай на iPhone / iPad"
          onClose={() => setShowIosHelp(false)}
        >
          <ol className="space-y-3 text-sm">
            <li className="flex gap-2">
              <span className="font-semibold text-[#8B1A2B]">1.</span>
              <span>
                Отвори този сайт в <strong>Safari</strong> (не Chrome).
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold text-[#8B1A2B]">2.</span>
              <span className="flex items-center gap-1">
                Натисни бутона <Share className="inline h-4 w-4" /> <strong>Споделяне</strong> в долната лента.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold text-[#8B1A2B]">3.</span>
              <span className="flex items-center gap-1">
                Избери <Plus className="inline h-4 w-4" /> <strong>„Добави към началния екран“</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-[#8B1A2B]">4.</span>
              <span>Потвърди с „Добави“ — иконата ще се появи на началния екран.</span>
            </li>
          </ol>
        </HelpModal>
      )}

      {showDesktopHelp && (
        <HelpModal
          title="Инсталирай приложението"
          onClose={() => setShowDesktopHelp(false)}
        >
          <div className="space-y-3 text-sm">
            <p>
              За най-добро изживяване отвори сайта в <strong>Google Chrome</strong> или <strong>Microsoft Edge</strong>.
            </p>
            <ol className="space-y-2">
              <li>
                <strong>Windows / Mac:</strong> кликни иконата <Smartphone className="inline h-4 w-4" /> вдясно в адрес-бара
                или меню ⋮ → <strong>„Install Имоти Надежда“</strong> / <strong>„Apps → Install this site as an app“</strong>.
              </li>
              <li>
                <strong>Android (Chrome):</strong> меню ⋮ → <strong>„Добави към началния екран“</strong> или <strong>„Install app“</strong>.
              </li>
              <li>
                <strong>iPhone (Safari):</strong> бутон <Share className="inline h-4 w-4" /> Споделяне → <strong>„Добави към началния екран“</strong>.
              </li>
            </ol>
            <p className="text-xs text-muted-foreground">
              Ако не виждаш опцията, отвори сайта в нов прозорец (не в preview / iframe).
            </p>
          </div>
        </HelpModal>
      )}
    </>
  );
}

function HelpModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#C9A84C]/40 bg-white p-5 text-[#2b1418] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-serif text-lg font-bold text-[#8B1A2B]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-black/5"
            aria-label="Затвори"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
