import { useEffect, useRef, useState, type FormEvent } from "react";
import { Sparkles, X, Send, User as UserIcon, Mic, MicOff, Volume2, Square } from "lucide-react";
import { aiAssistantChat } from "@/lib/ai-assistant.functions";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "admin-ai-bubble-msgs";

export function AdminAIBubble() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Msg[]) : [];
    } catch {
      return [];
    }
  });
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [open, messages.length]);

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
    } catch (e: any) {
      setError(e?.message ?? "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      {/* Floating bubble button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="AI Асистент"
        className={cn(
          "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 text-amber-950 shadow-[0_12px_32px_rgba(180,120,20,0.55)]",
          "transition hover:scale-105 hover:shadow-[0_18px_40px_rgba(180,120,20,0.7)]",
          open && "scale-95",
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        {!open && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
          </span>
        )}
      </button>

      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed bottom-24 right-5 z-50 flex w-[min(96vw,400px)] flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-[linear-gradient(180deg,#fbf6ec_0%,#f4ead5_100%)] shadow-[0_28px_60px_rgba(139, 26, 43,0.45)] transition-all duration-300",
          open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
        style={{ maxHeight: "min(70vh, 600px)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-amber-500/20 bg-gradient-to-r from-[#66081c] to-[#4a0613] px-4 py-3 text-amber-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-amber-950">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">AI Асистент</div>
            <div className="text-[10px] text-amber-200/80">Винаги наличен</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-amber-100/80 hover:bg-amber-100/10"
            aria-label="Затвори"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.length === 0 && (
            <div className="space-y-2 text-xs text-primary/70">
              <p>Здравей! Питай ме каквото и да е — статистики, описания, анализи, договори.</p>
              <div className="grid gap-1.5">
                {[
                  "Покажи последните 5 запитвания",
                  "Кой имот е най-разглеждан?",
                  "Напиши описание за тристаен в Лазур",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border border-primary/15 bg-white/60 px-2.5 py-1.5 text-left text-xs text-primary/85 hover:border-primary/40 hover:bg-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2", m.role === "user" && "justify-end")}>
              {m.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/80 text-primary",
                )}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <UserIcon className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}
          {busy && <div className="text-xs text-primary/60">Мисля…</div>}
          {error && (
            <div className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <form onSubmit={onSubmit} className="flex gap-2 border-t border-amber-500/20 bg-white/40 p-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Напиши съобщение…"
            disabled={busy}
            className="flex-1 rounded-lg border border-primary/20 bg-white px-3 py-2 text-xs text-primary placeholder:text-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/85 disabled:opacity-50"
            aria-label="Изпрати"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </>
  );
}
