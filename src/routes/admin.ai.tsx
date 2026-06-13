import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, User as UserIcon, Mic, MicOff, Volume2, Square } from "lucide-react";
import { aiAssistantChat } from "@/lib/ai-assistant.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/ai")({
  component: AIAssistant,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Дай ми резюме на статистиката от платформата",
  "Кои нови запитвания са с най-висок приоритет?",
  "Напиши примерно описание за луксозен тристаен в Лазур, Бургас",
  "Кои квартали имат най-висока средна цена?",
];

function AIAssistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const speak = (text: string, idx: number) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setError("Браузърът ти не поддържа глас");
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingIdx === idx) {
      setSpeakingIdx(null);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "bg-BG";
    const voices = window.speechSynthesis.getVoices();
    const bg = voices.find((v) => v.lang?.toLowerCase().startsWith("bg"));
    if (bg) u.voice = bg;
    u.onend = () => setSpeakingIdx(null);
    u.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(u);
  };

  const toggleListen = () => {
    if (typeof window === "undefined") return;
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Браузърът ти не поддържа разпознаване на реч");
      return;
    }
    if (listening) {
      try { recognitionRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "bg-BG";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setInput(transcript);
    };
    rec.onerror = (e: any) => { setError("Грешка при запис: " + (e.error || "")); setListening(false); };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setError(null);
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: text.trim() }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const result = await aiAssistantChat({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: result.reply }]);
      if (result.reply?.includes("[THEME_UPDATED]") || /тема|theme|цвят|стил/i.test(text)) {
        window.dispatchEvent(new Event("crm-theme-changed"));
      }
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e: any) {
      setError(e?.message ?? "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); send(input); };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 font-display text-4xl text-accent-foreground">
          <Sparkles className="h-7 w-7 text-primary" /> AI Помощник
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Интелигентен експерт с пълен достъп до данните на платформата. Питай за статистики, описания, анализи, отговори на запитвания.
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-auto rounded-2xl border border-primary/15 bg-card p-6">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Започни с примерен въпрос:</p>
            <div className="grid gap-2 md:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-xl border border-primary/15 bg-background p-3 text-left text-sm hover:border-primary">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></div>}
            <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
              {m.content}
              {m.role === "assistant" && (
                <button
                  type="button"
                  onClick={() => speak(m.content, i)}
                  className="mt-2 flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                  aria-label={speakingIdx === i ? "Спри" : "Чуй"}
                >
                  {speakingIdx === i ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {speakingIdx === i ? "Спри" : "Чуй"}
                </button>
              )}
            </div>
            {m.role === "user" && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted"><UserIcon className="h-4 w-4" /></div>}
          </div>
        ))}
        {busy && <div className="text-sm text-muted-foreground">Мисля…</div>}
        {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Слушам…" : "Питай помощника..."}
          disabled={busy}
          className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm"
        />
        <Button
          type="button"
          onClick={toggleListen}
          disabled={busy}
          variant="outline"
          className={cn("px-4", listening && "bg-red-600 text-white hover:bg-red-700 animate-pulse")}
          aria-label={listening ? "Спри запис" : "Говори"}
        >
          {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button type="submit" disabled={busy || !input.trim()} className="gold-cta-button px-5">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
