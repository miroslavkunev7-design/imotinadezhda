import { useCallback, useEffect, useRef, useState } from "react";
import { startSpeechRecognition, type SpeechRecognitionHandle } from "@/lib/speech-recognition";

export function useSpeechInput(
  onTranscript: (text: string) => void,
  onError: (message: string) => void,
  lang = "bg-BG",
) {
  const [listening, setListening] = useState(false);
  const controllerRef = useRef<SpeechRecognitionHandle | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onErrorRef = useRef(onError);

  onTranscriptRef.current = onTranscript;
  onErrorRef.current = onError;

  useEffect(() => {
    return () => {
      controllerRef.current?.stop();
      controllerRef.current = null;
    };
  }, []);

  const toggleListen = useCallback(async () => {
    if (listening) {
      controllerRef.current?.stop();
      controllerRef.current = null;
      setListening(false);
      return;
    }

    const controller = await startSpeechRecognition({
      lang,
      onTranscript: (text) => onTranscriptRef.current(text),
      onError: (message) => onErrorRef.current(message),
      onListeningChange: setListening,
    });

    if (controller) controllerRef.current = controller;
  }, [lang, listening]);

  return { listening, toggleListen };
}
