type SpeechRecognitionCtor = new () => SpeechRecognition;

export type SpeechRecognitionHandle = {
  stop: () => void;
};

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Няма достъп до микрофона. Разреши го в браузъра (иконата до адресната лента) и в Windows: Настройки → Поверителност → Микрофон.";
    case "audio-capture":
      return "Микрофонът не е открит. Провери дали е включен и избран като входно устройство в Windows.";
    case "no-speech":
      return "Не чух нищо. Говори по-близо до микрофона и опитай отново.";
    case "network":
      return "Разпознаването на реч изисква интернет връзка.";
    case "aborted":
      return "";
    default:
      return code ? `Грешка при запис: ${code}` : "Грешка при запис на глас.";
  }
}

export async function ensureMicrophoneAccess(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { ok: false, message: "Браузърът не поддържа достъп до микрофона." };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (err: unknown) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return { ok: false, message: speechErrorMessage("not-allowed") };
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return { ok: false, message: speechErrorMessage("audio-capture") };
    }
    const message = err instanceof Error ? err.message : "Не мога да достъпя микрофона.";
    return { ok: false, message };
  }
}

export async function startSpeechRecognition(opts: {
  lang?: string;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  onListeningChange: (listening: boolean) => void;
}): Promise<SpeechRecognitionHandle | null> {
  const SR = getSpeechRecognitionCtor();
  if (!SR) {
    opts.onError("Браузърът не поддържа разпознаване на реч. Използвай Chrome или Edge.");
    return null;
  }

  const mic = await ensureMicrophoneAccess();
  if (!mic.ok) {
    opts.onError(mic.message);
    return null;
  }

  const rec = new SR();
  rec.lang = opts.lang ?? "bg-BG";
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;

  let stopped = false;

  rec.onresult = (event: SpeechRecognitionEvent) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0]?.transcript ?? "";
    }
    const trimmed = transcript.trim();
    if (trimmed) opts.onTranscript(trimmed);
  };

  rec.onerror = (event: SpeechRecognitionErrorEvent) => {
    const message = speechErrorMessage(event.error);
    if (message) opts.onError(message);
    opts.onListeningChange(false);
  };

  rec.onend = () => {
    if (!stopped) {
      try {
        rec.start();
        return;
      } catch {
        // Recognition ended and cannot restart.
      }
    }
    opts.onListeningChange(false);
  };

  rec.onstart = () => opts.onListeningChange(true);

  try {
    rec.start();
  } catch {
    opts.onError("Не мога да стартирам записа. Опитай отново.");
    opts.onListeningChange(false);
    return null;
  }

  return {
    stop: () => {
      stopped = true;
      try {
        rec.stop();
      } catch {
        // Already stopped.
      }
      opts.onListeningChange(false);
    },
  };
}
