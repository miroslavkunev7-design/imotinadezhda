import { Bot, History, Mic, Plus, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  at: number;
};

type ChatThread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};

const STORAGE_KEY = "crm-locked-ai-assist-threads-v1";

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatThread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveThreads(threads: ChatThread[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  } catch {
    // ignore quota / private mode
  }
}

function draftReply(prompt: string): string {
  const text = prompt.trim().toLowerCase();
  if (text.includes("предварителен договор") || text.includes("предварителен")) {
    return [
      "Чернова — предварителен договор (кратко):",
      "",
      "1) Страни: продавач / купувач + ЕГН/ЕИК",
      "2) Имот: адрес, площ, № по имотен регистър",
      "3) Цена и капаро; срок за окончателен договор",
      "4) Условия за отказ и неустойка",
      "",
      "Мога да попълня полетата, ако ми продиктуваш данните.",
    ].join("\n");
  }
  if (text.includes("клиент") || text.includes("запиши")) {
    return [
      "Записвам нов клиент. Кажи ми на глас или напиши:",
      "• име и телефон",
      "• град / квартал",
      "• търси: покупка или наем",
      "• бюджет и срокове",
      "",
      "Щом ми ги дадеш, ще ги подредя като CRM бележка.",
    ].join("\n");
  }
  if (text.includes("оглед")) {
    return "Добре — за оглед ми кажи имот, дата/час и кой клиент. Ще ти върна готов текст за SMS/имейл.";
  }
  return [
    "Слушам. Можеш да пишеш или да продиктуваш.",
    "Примери: „предварителен договор ми напиши“, „запиши нов клиент, бързам“.",
    "Ще запомня разговора в този панел.",
  ].join(" ");
}

function emptyThread(): ChatThread {
  const welcome: ChatMessage = {
    id: uid("m"),
    role: "assistant",
    content:
      "Здравей! Аз съм AI помощникът в CRM. Питай ме за договор, нов клиент, оглед или бележка — мога и да приемам диктовка.",
    at: Date.now(),
  };
  return {
    id: uid("t"),
    title: "Нов разговор",
    updatedAt: Date.now(),
    messages: [welcome],
  };
}

export function AiAssistFab({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`crm-locked-ai-fab${active ? " crm-locked-ai-fab--active" : ""}`}
      aria-label="AI помощник"
      aria-expanded={active}
      title="AI помощник"
      onClick={onToggle}
    >
      <Bot size={22} strokeWidth={1.7} />
    </button>
  );
}

export function AiAssistChat({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const existing = loadThreads();
    if (existing.length === 0) {
      const first = emptyThread();
      setThreads([first]);
      setActiveId(first.id);
      saveThreads([first]);
    } else {
      setThreads(existing);
      setActiveId(existing[0]?.id ?? null);
    }
    setHistoryOpen(false);
    window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) ?? threads[0] ?? null,
    [threads, activeId],
  );

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, active?.messages.length, busy]);

  const persist = useCallback((next: ChatThread[]) => {
    setThreads(next);
    saveThreads(next);
  }, []);

  const startNew = useCallback(() => {
    const next = emptyThread();
    persist([next, ...threads]);
    setActiveId(next.id);
    setHistoryOpen(false);
    setDraft("");
  }, [persist, threads]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !active || busy) return;
    setDraft("");
    setBusy(true);

    const userMsg: ChatMessage = {
      id: uid("m"),
      role: "user",
      content: text,
      at: Date.now(),
    };

    const withUser = threads.map((t) => {
      if (t.id !== active.id) return t;
      const title =
        t.title === "Нов разговор" ? text.slice(0, 42) || t.title : t.title;
      return {
        ...t,
        title,
        updatedAt: Date.now(),
        messages: [...t.messages, userMsg],
      };
    });
    persist(withUser);

    await new Promise((r) => window.setTimeout(r, 380));

    const reply: ChatMessage = {
      id: uid("m"),
      role: "assistant",
      content: draftReply(text),
      at: Date.now(),
    };
    const withReply = withUser.map((t) =>
      t.id === active.id
        ? { ...t, updatedAt: Date.now(), messages: [...t.messages, reply] }
        : t,
    );
    persist(withReply);
    setBusy(false);
  }, [active, busy, draft, persist, threads]);

  const onDictate = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        start: () => void;
      };
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setDraft((d) => (d ? d : "Диктовка: (браузърът не поддържа глас — напиши тук)"));
      return;
    }

    const rec = new Ctor();
    rec.lang = "bg-BG";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const said = event.results[0]?.[0]?.transcript?.trim();
      if (said) setDraft((prev) => (prev ? `${prev} ${said}` : said));
    };
    rec.start();
  }, []);

  if (!open) return null;

  return (
    <div className="crm-locked-ai-panel" role="dialog" aria-label="AI помощник">
      <div className="crm-locked-ai-panel__head">
        <span className="crm-locked-ai-panel__title">
          <Bot size={16} strokeWidth={1.8} aria-hidden />
          AI помощник
        </span>
        <div className="crm-locked-ai-panel__actions">
          <button
            type="button"
            className="crm-locked-ai-icon-btn"
            aria-label="Предишни разговори"
            title="Предишни разговори"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <History size={16} />
          </button>
          <button
            type="button"
            className="crm-locked-ai-icon-btn"
            aria-label="Нов разговор"
            title="Нов разговор"
            onClick={startNew}
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            className="crm-locked-ai-icon-btn"
            aria-label="Затвори"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {historyOpen ? (
        <div className="crm-locked-ai-history">
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              className={
                t.id === active?.id
                  ? "crm-locked-ai-history__item crm-locked-ai-history__item--active"
                  : "crm-locked-ai-history__item"
              }
              onClick={() => {
                setActiveId(t.id);
                setHistoryOpen(false);
              }}
            >
              <strong>{t.title}</strong>
              <span>{new Date(t.updatedAt).toLocaleString("bg-BG")}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="crm-locked-ai-messages" ref={listRef}>
        {(active?.messages ?? []).map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "crm-locked-ai-bubble crm-locked-ai-bubble--user"
                : "crm-locked-ai-bubble crm-locked-ai-bubble--assistant"
            }
          >
            {m.content}
          </div>
        ))}
        {busy ? (
          <div className="crm-locked-ai-bubble crm-locked-ai-bubble--assistant">Пиша…</div>
        ) : null}
      </div>

      <div className="crm-locked-ai-compose">
        <textarea
          ref={inputRef}
          className="crm-locked-ai-input"
          rows={2}
          placeholder="Напр. предварителен договор ми напиши…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="crm-locked-ai-compose__row">
          <button
            type="button"
            className="crm-locked-ai-icon-btn"
            aria-label="Диктовка"
            title="Диктовка"
            onClick={onDictate}
          >
            <Mic size={16} />
          </button>
          <button
            type="button"
            className="crm-locked-ai-send"
            aria-label="Изпрати"
            disabled={!draft.trim() || busy}
            onClick={() => void send()}
          >
            <Send size={16} />
            Изпрати
          </button>
        </div>
      </div>
    </div>
  );
}
