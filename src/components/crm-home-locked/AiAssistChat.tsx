import { Bot } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AI_ASSIST_SKILLS, matchSkill, type AiSkillId } from "./imoti/ai-skills";

const SKILL_WEAPON: Record<
  AiSkillId,
  { emoji: string; label: string; hint: string }
> = {
  "upload-property": {
    emoji: "🏰",
    label: "Качване на имот",
    hint: "Оръжие · снимки и описание",
  },
  "collect-leads": {
    emoji: "🧲",
    label: "Събиране на имоти и клиенти",
    hint: "Оръжие · лийдове от текст/файл",
  },
};

type ChatRole = "user" | "assistant";

type ChatAttachment = {
  id: string;
  name: string;
  kind: "image" | "file" | "camera";
  previewUrl?: string;
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  at: number;
  attachments?: ChatAttachment[];
};

type ChatThread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
};

const STORAGE_KEY = "crm-locked-ai-assist-threads-v2";

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

function draftReply(prompt: string, attachmentNames: string[]): string {
  const text = prompt.trim().toLowerCase();
  const attached =
    attachmentNames.length > 0
      ? `\nПолучих файл(ове): ${attachmentNames.join(", ")}. Ще ги ползвам в задачата.`
      : "";

  const skill = matchSkill(prompt);
  if (skill) {
    return [skill.reply, attached].filter(Boolean).join("\n");
  }

  if (text.includes("предварителен договор") || text.includes("предварителен")) {
    return [
      "Чернова — предварителен договор:",
      "1) Страни  2) Имот  3) Цена/капаро  4) Срокове  5) Неустойка",
      "Кажи ми данните или прикачи снимка/файл — имам достъп до каквото ми дадеш.",
      attached,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (text.includes("клиент") || text.includes("запиши")) {
    return [
      "Записвам нов клиент. Продиктувай или прикачи визитка/снимка:",
      "име, телефон, град, покупка/наем, бюджет.",
      attached || "Слушам.",
    ].join("\n");
  }
  if (text.includes("оглед")) {
    return `За оглед ми кажи имот, дата/час и клиент.${attached}`;
  }
  if (attachmentNames.length > 0 && !text) {
    return `Приех прикачения материал (${attachmentNames.join(", ")}). Кажи какво да направя с него — договор, нов клиент, описание на имот и т.н.`;
  }
  return [
    "Готов съм. Аз съм личният ти CRM асистент — каквото ми кажеш и каквото ми дадеш (текст, файл, снимка), мога да работя с него.",
    "Отвори + за оръжия (skills) или кажи: предварителен договор, оглед, архив.",
    attached,
  ]
    .filter(Boolean)
    .join(" ");
}

function emptyThread(): ChatThread {
  const welcome: ChatMessage = {
    id: uid("m"),
    role: "assistant",
    content:
      "Здравей! Аз съм личният ти асистент в CRM — пиши, диктувай или отвори + за оръжия (skills) и прикачвания.",
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
  onSkill,
}: {
  open: boolean;
  onClose: () => void;
  onSkill?: (id: AiSkillId) => void;
}) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<ChatAttachment[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

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
    setAttachOpen(false);
    setExpanded(false);
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
  }, [open, active?.messages.length, busy, expanded]);

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
    setPendingFiles([]);
  }, [persist, threads]);

  const ingestFiles = useCallback((files: FileList | null, kind: ChatAttachment["kind"]) => {
    if (!files?.length) return;
    const next: ChatAttachment[] = [];
    Array.from(files).forEach((file) => {
      const isImage = file.type.startsWith("image/");
      next.push({
        id: uid("a"),
        name: file.name || (kind === "camera" ? "Моментна снимка" : "Файл"),
        kind: isImage && kind === "file" ? "image" : kind,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
      });
    });
    setPendingFiles((prev) => [...prev, ...next]);
    setAttachOpen(false);
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if ((!text && pendingFiles.length === 0) || !active || busy) return;
    setDraft("");
    const attachments = pendingFiles;
    setPendingFiles([]);
    setBusy(true);

    const userMsg: ChatMessage = {
      id: uid("m"),
      role: "user",
      content: text || (attachments.length ? "Прикачих материал." : ""),
      at: Date.now(),
      attachments,
    };

    const withUser = threads.map((t) => {
      if (t.id !== active.id) return t;
      const titleSeed = text || attachments[0]?.name || t.title;
      const title = t.title === "Нов разговор" ? titleSeed.slice(0, 42) : t.title;
      return {
        ...t,
        title,
        updatedAt: Date.now(),
        messages: [...t.messages, userMsg],
      };
    });
    persist(withUser);

    await new Promise((r) => window.setTimeout(r, 380));

    const skill = matchSkill(text);
    if (skill) onSkill?.(skill.id);

    const reply: ChatMessage = {
      id: uid("m"),
      role: "assistant",
      content: draftReply(
        text,
        attachments.map((a) => a.name),
      ),
      at: Date.now(),
    };
    const withReply = withUser.map((t) =>
      t.id === active.id
        ? { ...t, updatedAt: Date.now(), messages: [...t.messages, reply] }
        : t,
    );
    persist(withReply);
    setBusy(false);
  }, [active, busy, draft, onSkill, pendingFiles, persist, threads]);

  const runSkill = useCallback(
    (id: AiSkillId) => {
      const skill = AI_ASSIST_SKILLS.find((s) => s.id === id);
      if (!skill || !active) return;
      setAttachOpen(false);
      setHistoryOpen(false);
      onSkill?.(id);
      const userMsg: ChatMessage = {
        id: uid("m"),
        role: "user",
        content: skill.prompt,
        at: Date.now(),
      };
      const reply: ChatMessage = {
        id: uid("m"),
        role: "assistant",
        content: skill.reply,
        at: Date.now(),
      };
      const next = threads.map((t) =>
        t.id === active.id
          ? {
              ...t,
              title: skill.title,
              updatedAt: Date.now(),
              messages: [...t.messages, userMsg, reply],
            }
          : t,
      );
      persist(next);
    },
    [active, onSkill, persist, threads],
  );

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
    <div
      className={`crm-locked-ai-panel${expanded ? " crm-locked-ai-panel--expanded" : ""}`}
      role="dialog"
      aria-label="Личен AI асистент"
      aria-modal={expanded}
    >
      <div className="crm-locked-ai-panel__head">
        <span className="crm-locked-ai-panel__title">
          <span className="crm-locked-ai-emoji crm-locked-ai-emoji--title" aria-hidden>
            🤖
          </span>
          Личен асистент
        </span>
        <div className="crm-locked-ai-panel__actions">
          <button
            type="button"
            className="crm-locked-ai-icon-btn crm-locked-ai-icon-btn--neon"
            aria-label="Предишни разговори"
            title="Предишни разговори"
            onClick={() => {
              setAttachOpen(false);
              setHistoryOpen((v) => !v);
            }}
          >
            <span className="crm-locked-ai-emoji" aria-hidden>
              🕑
            </span>
          </button>
          <button
            type="button"
            className="crm-locked-ai-icon-btn crm-locked-ai-icon-btn--neon"
            aria-label="Нов разговор"
            title="Нов разговор"
            onClick={startNew}
          >
            <span className="crm-locked-ai-emoji" aria-hidden>
              ✨
            </span>
          </button>
          <button
            type="button"
            className="crm-locked-ai-icon-btn crm-locked-ai-icon-btn--neon"
            aria-label={expanded ? "Свий" : "Цял екран"}
            title={expanded ? "Свий" : "Цял екран"}
            onClick={() => setExpanded((v) => !v)}
          >
            <span className="crm-locked-ai-emoji" aria-hidden>
              {expanded ? "🗗" : "⛶"}
            </span>
          </button>
          <button
            type="button"
            className="crm-locked-ai-icon-btn crm-locked-ai-icon-btn--neon"
            aria-label="Затвори"
            onClick={() => {
              setExpanded(false);
              onClose();
            }}
          >
            <span className="crm-locked-ai-emoji" aria-hidden>
              ✕
            </span>
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
            {m.attachments?.length ? (
              <div className="crm-locked-ai-attach-list">
                {m.attachments.map((a) =>
                  a.previewUrl ? (
                    <img
                      key={a.id}
                      src={a.previewUrl}
                      alt={a.name}
                      className="crm-locked-ai-attach-thumb"
                    />
                  ) : (
                    <span key={a.id} className="crm-locked-ai-attach-chip">
                      {a.name}
                    </span>
                  ),
                )}
              </div>
            ) : null}
          </div>
        ))}
        {busy ? (
          <div className="crm-locked-ai-bubble crm-locked-ai-bubble--assistant">Пиша…</div>
        ) : null}
      </div>

      {pendingFiles.length > 0 ? (
        <div className="crm-locked-ai-pending">
          {pendingFiles.map((a) => (
            <span key={a.id} className="crm-locked-ai-attach-chip">
              {a.name}
              <button
                type="button"
                aria-label={`Премахни ${a.name}`}
                onClick={() => setPendingFiles((prev) => prev.filter((x) => x.id !== a.id))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="crm-locked-ai-compose">
        <textarea
          ref={inputRef}
          className="crm-locked-ai-input"
          rows={expanded ? 3 : 2}
          placeholder="Кажи какво да направя… (договор, клиент, оглед…)"
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
          <div className="crm-locked-ai-compose__left">
            <div className="crm-locked-ai-attach-wrap">
              <button
                type="button"
                className="crm-locked-ai-icon-btn crm-locked-ai-icon-btn--neon"
                aria-label="Оръжия и прикачвания"
                title="Skills / прикачи файл"
                aria-expanded={attachOpen}
                onClick={() => {
                  setHistoryOpen(false);
                  setAttachOpen((v) => !v);
                }}
              >
                <span className="crm-locked-ai-emoji" aria-hidden>
                  ➕
                </span>
              </button>
              {attachOpen ? (
                <div className="crm-locked-ai-attach-menu" role="menu">
                  <div className="crm-locked-ai-attach-menu__section" aria-hidden>
                    Оръжия · Skills
                  </div>
                  {AI_ASSIST_SKILLS.map((s) => {
                    const weapon = SKILL_WEAPON[s.id];
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="menuitem"
                        className="crm-locked-ai-attach-menu__weapon"
                        title={weapon.hint}
                        onClick={() => runSkill(s.id)}
                      >
                        <span className="crm-locked-ai-emoji crm-locked-ai-emoji--weapon" aria-hidden>
                          {weapon.emoji}
                        </span>
                        <span className="crm-locked-ai-attach-menu__weapon-text">
                          <strong>{weapon.label}</strong>
                          <em>{weapon.hint}</em>
                        </span>
                      </button>
                    );
                  })}
                  <div className="crm-locked-ai-attach-menu__section" aria-hidden>
                    Прикачи
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => imageRef.current?.click()}
                  >
                    <span className="crm-locked-ai-emoji" aria-hidden>
                      🖼
                    </span>
                    Изображение
                  </button>
                  <button type="button" role="menuitem" onClick={() => fileRef.current?.click()}>
                    <span className="crm-locked-ai-emoji" aria-hidden>
                      📎
                    </span>
                    Файл
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => cameraRef.current?.click()}
                  >
                    <span className="crm-locked-ai-emoji" aria-hidden>
                      📷
                    </span>
                    Моментна снимка
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="crm-locked-ai-icon-btn crm-locked-ai-icon-btn--neon"
              aria-label="Диктовка"
              title="Диктовка"
              onClick={onDictate}
            >
              <span className="crm-locked-ai-emoji" aria-hidden>
                🎙
              </span>
            </button>
          </div>
          <button
            type="button"
            className="crm-locked-ai-send crm-locked-ai-send--neon"
            aria-label="Изпрати"
            disabled={(!draft.trim() && pendingFiles.length === 0) || busy}
            onClick={() => void send()}
          >
            <span className="crm-locked-ai-emoji" aria-hidden>
              🚀
            </span>
            Изпрати
          </button>
        </div>
      </div>

      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          ingestFiles(e.target.files, "image");
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        hidden
        onChange={(e) => {
          ingestFiles(e.target.files, "file");
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          ingestFiles(e.target.files, "camera");
          e.target.value = "";
        }}
      />
    </div>
  );
}
