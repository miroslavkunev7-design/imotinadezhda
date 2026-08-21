import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Phone } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

function getVisitorToken() {
  if (typeof window === "undefined") return "";
  let t = localStorage.getItem("in_visitor_token");
  if (!t) {
    t = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) + Date.now().toString(36);
    localStorage.setItem("in_visitor_token", t);
  }
  return t;
}

function chatStorageKey(propertyId?: string | null) {
  return propertyId ? `in_chat_${propertyId}` : "in_chat_site";
}

export function CustomerChat({ propertyId }: { propertyId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const token = useMemo(getVisitorToken, []);
  const storageKey = chatStorageKey(propertyId);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setMessages(parsed.messages ?? []);
        setChatId(parsed.chatId ?? null);
        if (parsed.visitorName) setVisitorName(parsed.visitorName);
        if (parsed.visitorPhone) setVisitorPhone(parsed.visitorPhone);
      } else {
        setMessages([
          {
            role: "assistant",
            content:
              "Здравейте! 👋 Аз съм **Надежда** — вашият виртуален консултант.\n\nМожем да си говорим свободно — за имоти, правни въпроси, или да проуча нещо в интернет. Как мога да помогна?",
          },
        ]);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!messages.length) return;
    localStorage.setItem(storageKey, JSON.stringify({ messages, chatId, visitorName, visitorPhone }));
  }, [messages, chatId, visitorName, visitorPhone, storageKey]);

  useEffect(() => {
    if (open) {
      setUnread(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
    }
  }, [open, messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setSending(true);
    try {
      const res = await fetch("/api/public/customer-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          visitor_token: token,
          visitor_name: visitorName || undefined,
          visitor_phone: visitorPhone || undefined,
          property_id: propertyId ?? null,
          page_url: typeof window !== "undefined" ? window.location.href : undefined,
          message: text,
          history: messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .slice(-40)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const fallback =
          res.status === 429
            ? "Имаме малко натоварване, опитайте пак след минута."
            : res.status === 402
              ? "Чатът временно не работи. Моля, оставете телефон и ще Ви потърсим."
              : "Възникна грешка. Опитайте отново.";
        setMessages([...next, { role: "assistant", content: fallback }]);
      } else {
        if (json.chat_id) setChatId(json.chat_id);
        setMessages([...next, { role: "assistant", content: json.reply ?? "" }]);
        if (!open) setUnread(true);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "Няма връзка. Опитайте пак." }]);
    }
    setSending(false);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex fixed bottom-20 right-4 z-[100] items-center gap-2 rounded-full bg-gradient-to-br from-primary to-[#5e0f1d] px-4 py-3 text-sm font-semibold text-amber-100 shadow-2xl ring-2 ring-amber-400/60 transition hover:scale-105 md:bottom-5 md:right-5 md:px-5"
          aria-label="Отвори чат"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Чат с агенцията</span>
          {unread && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300" />}
        </button>
      )}

      {open && (
        <div className="fixed inset-x-3 bottom-20 z-[100] flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-amber-400/40 bg-[rgba(255,251,243,0.98)] shadow-2xl backdrop-blur-md sm:inset-auto md:bottom-5 sm:right-5 sm:w-[400px] sm:bottom-5">
          <header className="flex items-center justify-between gap-2 border-b border-amber-500/20 bg-gradient-to-r from-primary to-[#5e0f1d] px-4 py-3 text-amber-100">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-amber-300/80">Виртуален консултант</div>
              <div className="font-display text-base">Надежда · онлайн</div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Затвори">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-amber-400/30 bg-white text-primary"
                  }`}
                >
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-a:text-amber-700">
                    <ReactMarkdown
                      components={{
                        a: (props) => (
                          <a {...props} target={props.href?.startsWith("/") ? "_self" : "_blank"} rel="noreferrer" />
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-primary/60">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Надежда пише…
              </div>
            )}
          </div>

          <div className="border-t border-amber-500/20 bg-white/60 px-3 py-2">
            <div className="mb-2 grid grid-cols-2 gap-2">
              <input
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="Име"
                className="rounded-lg border border-primary/15 bg-white px-2 py-1 text-xs text-primary outline-none"
              />
              <input
                value={visitorPhone}
                onChange={(e) => setVisitorPhone(e.target.value)}
                placeholder="Телефон"
                className="rounded-lg border border-primary/15 bg-white px-2 py-1 text-xs text-primary outline-none"
              />
            </div>
            <div className="mb-2 flex items-center justify-between text-[10px] text-primary/50">
              <span>Безплатен AI консултант — без лимити и регистрация.</span>
              <a href="tel:+359885774863" className="inline-flex items-center gap-1 text-primary hover:underline">
                <Phone className="h-3 w-3" /> Обади се
              </a>
              <a href="https://wa.me/359885774863" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                WhatsApp
              </a>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Напишете съобщение…"
                className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm text-primary outline-none focus:border-amber-500/50"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
                aria-label="Изпрати"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
