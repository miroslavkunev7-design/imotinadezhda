import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, User as UserIcon, Mic, MicOff, Volume2, Square, Paperclip, FileText, X, Loader2, CheckCircle2, Plus, MessageSquare, Trash2, PanelLeftClose, PanelLeft, Camera, Image as ImageIcon, ScrollText, Download, Copy, Wand2 } from "lucide-react";
import {
  aiAssistantChat,
  listAiConversations,
  getAiConversation,
  deleteAiConversation,
} from "@/lib/ai-assistant.functions";
import { cn } from "@/lib/utils";
import { speakBG } from "@/lib/tts-utils";
import { useSpeechInput } from "@/hooks/use-speech-input";
import { supabase } from "@/integrations/supabase/client";
import {
  startDocumentBatch,
  processBatchFile,
  commitDocumentBatch,
  CATEGORY_LABELS,
  DOCUMENT_CATEGORIES,
} from "@/lib/document-processor.functions";
import { toast } from "sonner";
import { analyzeNotaryAct } from "@/lib/legal-docs.functions";
import type { NotaryAct } from "@/lib/legal-docs";
import { enhanceDocumentImage, fileToDataUrl } from "@/lib/image-enhance";
import { generateAiImage } from "@/lib/ai-image.functions";

export const Route = createFileRoute("/admin/ai")({
  component: AIAssistant,
});

type ReviewFile = {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size: number;
  category: (typeof DOCUMENT_CATEGORIES)[number];
  period_day: number | null;
  period_month: number | null;
  period_year: number | null;
  detected_client_name: string | null;
  detected_bank: string | null;
  detected_amount: number | null;
  confidence: number;
  reasoning: string;
};

type Msg =
  | { role: "user" | "assistant"; content: string }
  | { role: "review"; batch_id: string; files: ReviewFile[]; committed?: boolean }
  | { role: "image"; prompt: string; url: string }
  | {
      role: "legal";
      file_name: string;
      preview?: string | null;
      extracted: NotaryAct;
      contract_text: string | null;
      receipt_text: string | null;
    };

const SUGGESTIONS = [
  "Дай ми резюме на статистиката от платформата",
  "Кои нови запитвания са с най-висок приоритет?",
  "Напиши примерно описание за луксозен тристаен в Лазур, Бургас",
  "Кои квартали имат най-висока средна цена?",
];

function AIAssistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Array<{ id: string; title: string; updated_at: string }>>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const notaryInputRef = useRef<HTMLInputElement>(null);
  const [attachMenu, setAttachMenu] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number; label: string } | null>(null);

  const refreshSessions = async () => {
    try {
      const list = await listAiConversations();
      setSessions(list as Array<{ id: string; title: string; updated_at: string }>);
    } catch (e) {
      console.warn("listAiConversations failed", e);
    }
  };

  useEffect(() => {
    refreshSessions();
  }, []);

  const openSession = async (id: string) => {
    if (id === conversationId) return;
    setLoadingSession(true);
    setError(null);
    try {
      const res = await getAiConversation({ data: { id } });
      const loaded: Msg[] = (res.messages as Array<{ role: string; content: string }>)
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      setMessages(loaded);
      setConversationId(id);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior }), 50);
    } catch (e: any) {
      toast.error(e?.message ?? "Не мога да заредя разговора");
    } finally {
      setLoadingSession(false);
    }
  };

  const newChat = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  };

  const removeSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Изтрий този разговор завинаги?")) return;
    try {
      await deleteAiConversation({ data: { id } });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (id === conversationId) newChat();
      toast.success("Разговорът е изтрит.");
    } catch (err: any) {
      toast.error(err?.message ?? "Изтриването се провали");
    }
  };

  const onSpeechTranscript = useCallback((text: string) => {
    setInput(text);
    setError(null);
  }, []);
  const onSpeechError = useCallback((message: string) => setError(message), []);
  const { listening, toggleListen } = useSpeechInput(onSpeechTranscript, onSpeechError);

  const speak = (text: string, idx: number) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setError("Браузърът ти не поддържа глас");
      return;
    }
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    setSpeakingIdx(idx);
    speakBG(text, {
      onEnd: () => setSpeakingIdx(null),
      onError: () => setSpeakingIdx(null),
    });
  };

  const makeImage = async (prompt: string) => {
    const clean = prompt.trim();
    if (!clean || busy) return;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: `Генерирай изображение: ${clean}` }]);
    setBusy(true);
    setUploading({ done: 0, total: 1, label: "Генерирам изображение…" });
    try {
      const res = await generateAiImage({ data: { prompt: clean, size: "1024x1024" } });
      setMessages((prev) => [...prev, { role: "image", prompt: clean, url: res.image }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e: any) {
      setError(e?.message ?? "Генерирането се провали");
    } finally {
      setUploading(null);
      setBusy(false);
    }
  };

  const send = async (text: string) => {
    const imgMatch = text.trim().match(/^(?:\/img|\/image|генерирай\s+(?:изображение|снимка|картинка))\s*[:,-]?\s*(.+)$/i);
    if (imgMatch?.[1]) {
      await makeImage(imgMatch[1]);
      return;
    }
    if (!text.trim() || busy) return;

    setError(null);
    const next = [...messages, { role: "user" as const, content: text.trim() }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const result = await aiAssistantChat({ data: { messages: next, conversation_id: conversationId } });
      if (result.conversation_id) setConversationId(result.conversation_id);
      setMessages([...next, { role: "assistant", content: result.reply }]);
      if (result.reply?.includes("[THEME_UPDATED]") || /тема|theme|цвят|стил/i.test(text)) {
        window.dispatchEvent(new Event("crm-theme-changed"));
      }
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      refreshSessions();
    } catch (e: any) {
      setError(e?.message ?? "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); send(input); };

  /* ---------- Document ingest ---------- */
  const onAttachClick = () => fileInputRef.current?.click();

  /** Нотариален акт → извличане на данни + договор/разписка */
  const handleNotaryFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setAttachMenu(false);
    setUploading({ done: 0, total: 1, label: `Обработвам ${file.name}…` });
    try {
      const isImage = file.type.startsWith("image/");
      const dataUrl = isImage ? (await enhanceDocumentImage(file)).dataUrl : await fileToDataUrl(file);
      setUploading({ done: 0, total: 1, label: "Извличам данните от акта…" });
      const res = await analyzeNotaryAct({
        data: {
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          file_data: dataUrl,
          kind: "both",
        },
      });
      setMessages((m) => [
        ...m,
        {
          role: "legal",
          file_name: file.name,
          preview: isImage ? dataUrl : null,
          extracted: res.extracted as NotaryAct,
          contract_text: res.contract_text,
          receipt_text: res.receipt_text,
        },
      ]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e: any) {
      setError(e?.message ?? "Грешка при обработка на акта");
    } finally {
      setUploading(null);
      if (notaryInputRef.current) notaryInputRef.current.value = "";
    }
  };

  /** Снимки от камера/галерия → минават през същия документен пайплайн, но с изчистено изображение. */
  const handleImageCapture = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setAttachMenu(false);
    const prepared: File[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) { prepared.push(f); continue; }
      try {
        const { dataUrl } = await enhanceDocumentImage(f);
        const blob = await (await fetch(dataUrl)).blob();
        prepared.push(new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
      } catch {
        prepared.push(f);
      }
    }
    const dt = new DataTransfer();
    for (const f of prepared) dt.items.add(f);
    await handleFiles(dt.files);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files);
    setError(null);
    setUploading({ done: 0, total: list.length, label: "Създавам сесия…" });
    try {
      const { batch_id } = await startDocumentBatch();
      const aggregated: ReviewFile[] = [];

      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        setUploading({ done: i, total: list.length, label: `Качвам ${file.name}…` });
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `temp/${batch_id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("client-documents")
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) { toast.error(`Грешка при качване на ${file.name}: ${upErr.message}`); continue; }

        setUploading({ done: i, total: list.length, label: `Анализирам ${file.name}…` });
        try {
          const res = await processBatchFile({ data: {
            batch_id,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type || null,
          }});
          for (const r of res.files) aggregated.push(r as ReviewFile);
        } catch (e: any) {
          toast.error(`Анализ на ${file.name} се провали: ${e?.message ?? "неизвестна грешка"}`);
        }
      }

      if (aggregated.length) {
        setMessages((m) => [...m, { role: "review", batch_id, files: aggregated }]);
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } else {
        toast.error("Няма разпознати файлове.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Грешка при обработка");
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const updateReviewFile = (mIdx: number, fIdx: number, patch: Partial<ReviewFile>) => {
    setMessages((prev) =>
      prev.map((m, i) => {
        if (i !== mIdx || m.role !== "review") return m;
        const files = m.files.map((f, j) => (j === fIdx ? { ...f, ...patch } : f));
        return { ...m, files };
      }),
    );
  };
  const removeReviewFile = (mIdx: number, fIdx: number) => {
    setMessages((prev) =>
      prev.map((m, i) => {
        if (i !== mIdx || m.role !== "review") return m;
        return { ...m, files: m.files.filter((_, j) => j !== fIdx) };
      }),
    );
  };

  const commitReview = async (mIdx: number, clientName: string) => {
    const msg = messages[mIdx];
    if (!msg || msg.role !== "review") return;
    if (!clientName.trim()) { toast.error("Въведи име на клиента."); return; }
    if (!msg.files.length) { toast.error("Няма файлове за запазване."); return; }
    setBusy(true);
    try {
      const result = await commitDocumentBatch({ data: {
        batch_id: msg.batch_id,
        client_name: clientName.trim(),
        files: msg.files.map((f) => ({
          storage_path: f.storage_path,
          file_name: f.file_name,
          mime_type: f.mime_type,
          size: f.size,
          category: f.category,
          period_day: f.period_day,
          period_month: f.period_month,
          period_year: f.period_year,
          detected_client_name: f.detected_client_name,
          detected_bank: f.detected_bank,
          detected_amount: f.detected_amount,
          confidence: f.confidence,
          reasoning: f.reasoning,
        })),
      }});
      setMessages((prev) => prev.map((m, i) => (i === mIdx && m.role === "review" ? { ...m, committed: true } : m)));
      toast.success(
        `${result.client_created ? "Създадох клиент" : "Записах при клиент"} „${clientName}" — ${result.count} документ${result.count === 1 ? "" : "а"}.`,
      );
      setMessages((prev) => [...prev, {
        role: "assistant",
        content:
          `Готово. ${result.client_created ? "Създадох нов клиент" : "Записах при съществуващ клиент"} „${clientName}". Запазих ${result.count} документ${result.count === 1 ? "" : "а"}, подредени по категория и период.`,
      }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Запазването се провали.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl gap-4">
      {/* Sessions sidebar */}
      <aside
        className={cn(
          "flex shrink-0 flex-col overflow-hidden rounded-2xl border border-primary/15 bg-card transition-all duration-200",
          sidebarOpen ? "w-64" : "w-0 border-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-primary/10 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Разговори</span>
          <button
            type="button"
            onClick={newChat}
            className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            title="Нов разговор"
          >
            <Plus className="h-3.5 w-3.5" />
            Нов
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">Няма записани разговори.</p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openSession(s.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openSession(s.id)}
                    className={cn(
                      "group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition",
                      s.id === conversationId
                        ? "bg-primary/15 text-accent-foreground"
                        : "hover:bg-muted/60 text-foreground/85",
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{s.title || "Нов разговор"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(s.updated_at).toLocaleString("bg-BG", {
                          day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => removeSession(s.id, e)}
                      className="rounded p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      aria-label="Изтрий"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
      <header className="mb-4 flex items-start gap-2">
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="mt-1 rounded-md border border-primary/15 p-1.5 text-muted-foreground hover:bg-muted"
          aria-label={sidebarOpen ? "Скрий панела" : "Покажи панела"}
          title={sidebarOpen ? "Скрий панела" : "Покажи панела"}
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </button>
        <div className="flex-1">
        <h1 className="flex items-center gap-2 font-display text-4xl text-accent-foreground">
          <Sparkles className="h-7 w-7 text-primary" /> AI Помощник
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Интелигентен експерт с пълен достъп до данните на платформата. Питай за статистики, описания, анализи, или прикачи документи/ZIP папка — AI ги подрежда по клиент, категория и месец.
        </p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-auto rounded-2xl border border-primary/15 bg-card p-6">
        {loadingSession && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Зареждам разговора…
          </div>
        )}
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
        {messages.map((m, i) => m.role === "review" ? (
          <ReviewCard
            key={i}
            msg={m}
            busy={busy}
            onChangeFile={(fIdx, patch) => updateReviewFile(i, fIdx, patch)}
            onRemove={(fIdx) => removeReviewFile(i, fIdx)}
            onCommit={(name) => commitReview(i, name)}
          />
        ) : m.role === "image" ? (
          <div key={i} className="rounded-2xl border border-primary/25 bg-background p-4">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              <div className="flex-1 truncate text-sm font-semibold">Генерирано изображение</div>
              <a
                href={m.url}
                download={`ai-image-${i}.png`}
                className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
              >
                <Download className="h-3.5 w-3.5" /> Изтегли
              </a>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{m.prompt}</p>
            <img src={m.url} alt={m.prompt} className="mt-3 w-full rounded-lg object-contain" />
          </div>
        ) : (
          m.role === "legal" ? (
            <LegalCard key={i} msg={m} />
          ) : (
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
          )
        ))}
        {busy && !uploading && <div className="text-sm text-muted-foreground">Мисля…</div>}
        {uploading && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{uploading.label}</span>
            <span className="ml-auto text-xs opacity-70">{uploading.done}/{uploading.total}</span>
          </div>
        )}
        {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.zip,.jpg,.jpeg,.png,.webp,.heic"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleImageCapture(e.target.files)}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleImageCapture(e.target.files)}
          className="hidden"
        />
        <input
          ref={notaryInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => handleNotaryFile(e.target.files)}
          className="hidden"
        />
        <div className="relative">
          <Button
            type="button"
            onClick={() => setAttachMenu((v) => !v)}
            disabled={busy || !!uploading}
            variant="outline"
            className="px-4"
            aria-label="Прикачи"
            title="Прикачи файл, снимка или нотариален акт"
          >
            <Plus className={cn("h-4 w-4 transition-transform", attachMenu && "rotate-45")} />
          </Button>
          {attachMenu && (
            <div className="absolute bottom-full left-0 z-30 mb-2 w-64 overflow-hidden rounded-xl border border-primary/20 bg-popover shadow-xl">
              {[
                { icon: Paperclip, label: "Документи или ZIP", hint: "PDF, снимки, архив", onClick: () => { setAttachMenu(false); onAttachClick(); } },
                { icon: ImageIcon, label: "Снимки от галерия", hint: "автоматично изчистване", onClick: () => { setAttachMenu(false); galleryInputRef.current?.click(); } },
                { icon: Camera, label: "Снимка с камера", hint: "сканирай на момента", onClick: () => { setAttachMenu(false); cameraInputRef.current?.click(); } },
                { icon: ScrollText, label: "Нотариален акт → договор", hint: "и разписка за депозит", onClick: () => { setAttachMenu(false); notaryInputRef.current?.click(); } },
                { icon: Wand2, label: "Генерирай изображение", hint: "по твое описание", onClick: () => {
                    setAttachMenu(false);
                    const p = input.trim() || window.prompt("Опиши изображението, което да генерирам:") || "";
                    if (p.trim()) void makeImage(p);
                  } },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-primary/10"
                >
                  <item.icon className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">{item.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
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
    </div>
  );
}

function ReviewCard({
  msg,
  busy,
  onChangeFile,
  onRemove,
  onCommit,
}: {
  msg: Extract<Msg, { role: "review" }>;
  busy: boolean;
  onChangeFile: (fIdx: number, patch: Partial<ReviewFile>) => void;
  onRemove: (fIdx: number) => void;
  onCommit: (clientName: string) => void;
}) {
  const detected = msg.files.find((f) => f.detected_client_name)?.detected_client_name ?? "";
  const [clientName, setClientName] = useState(detected);

  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-accent-foreground">
            Анализирах {msg.files.length} документ{msg.files.length === 1 ? "" : "а"}. Провери и потвърди.
          </div>
          {detected && !msg.committed && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              Разпознато име: <span className="font-medium text-primary">{detected}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Клиент</label>
        <input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          disabled={msg.committed || busy}
          placeholder="Иван Костов"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Ако клиентът съществува — файловете ще се добавят при него. Ако не — ще бъде създаден нов.
        </p>
      </div>

      <div className="space-y-2">
        {msg.files.map((f, j) => (
          <div key={j} className="rounded-lg border border-border bg-background/60 p-3 text-sm">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 flex-none text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{f.file_name}</div>
                {f.reasoning && (
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{f.reasoning}</div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={f.category}
                    onChange={(e) => onChangeFile(j, { category: e.target.value as ReviewFile["category"] })}
                    disabled={msg.committed || busy}
                    className="rounded border border-input bg-background px-2 py-1 text-xs"
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                  {(f.category === "salary_slip" || f.category === "bank_statement") && (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={f.period_day ?? ""}
                        onChange={(e) => onChangeFile(j, { period_day: e.target.value ? Number(e.target.value) : null })}
                        disabled={msg.committed || busy}
                        placeholder="ден"
                        className="w-16 rounded border border-input bg-background px-2 py-1 text-xs"
                      />
                      <select
                        value={f.period_month ?? ""}
                        onChange={(e) => onChangeFile(j, { period_month: e.target.value ? Number(e.target.value) : null })}
                        disabled={msg.committed || busy}
                        className="rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="">— месец —</option>
                        {Array.from({ length: 12 }, (_, k) => k + 1).map((m) => (
                          <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={2000}
                        max={2100}
                        value={f.period_year ?? ""}
                        onChange={(e) => onChangeFile(j, { period_year: e.target.value ? Number(e.target.value) : null })}
                        disabled={msg.committed || busy}
                        placeholder="година"
                        className="w-20 rounded border border-input bg-background px-2 py-1 text-xs"
                      />
                    </>
                  )}
                  <span className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                    f.confidence >= 0.75 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                    f.confidence >= 0.4 ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                    "bg-rose-500/15 text-rose-700 dark:text-rose-400",
                  )}>
                    {Math.round(f.confidence * 100)}%
                  </span>
                </div>
              </div>
              {!msg.committed && (
                <button
                  type="button"
                  onClick={() => onRemove(j)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Премахни"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {msg.committed ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Запазено при клиента.
        </div>
      ) : (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            onClick={() => onCommit(clientName)}
            disabled={busy || !clientName.trim() || !msg.files.length}
            className="gold-cta-button px-5"
          >
            Запази при клиент
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------- Нотариален акт: извлечени данни + генерирани документи ---------- */

function LegalCard({ msg }: { msg: Extract<Msg, { role: "legal" }> }) {
  const [tab, setTab] = useState<"data" | "contract" | "receipt">("data");
  const act = msg.extracted;
  const p = act.property ?? {};

  const download = (name: string, text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rows: Array<[string, unknown]> = [
    ["Акт №", act.act_number],
    ["Том", act.act_volume],
    ["Рег. №", act.act_register_number],
    ["Дата", act.act_date],
    ["Нотариус", act.notary_name],
    ["Продавач(и)", act.sellers.map((s) => s.name).filter(Boolean).join(", ")],
    ["Купувач(и)", act.buyers.map((s) => s.name).filter(Boolean).join(", ")],
    ["Вид имот", p.type],
    ["Идентификатор", p.cadastral_id],
    ["Адрес", p.address],
    ["Град", p.city],
    ["Квартал", p.quarter],
    ["Площ", p.area_sqm != null ? `${p.area_sqm} кв.м` : null],
    ["Общи части", p.common_parts_sqm != null ? `${p.common_parts_sqm} кв.м` : null],
    ["Ид. части", p.ideal_parts],
    ["Етаж", p.floor],
    ["Цена", act.price != null ? `${Number(act.price).toLocaleString("bg-BG")} ${act.currency ?? ""}` : null],
    ["Данъчна оценка", act.tax_valuation != null ? `${Number(act.tax_valuation).toLocaleString("bg-BG")} лв.` : null],
  ];

  const text = tab === "contract" ? msg.contract_text : tab === "receipt" ? msg.receipt_text : null;

  return (
    <div className="rounded-2xl border border-primary/25 bg-background p-4">
      <div className="flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-primary" />
        <div className="flex-1 truncate text-sm font-semibold">Нотариален акт: {msg.file_name}</div>
      </div>

      {msg.preview && (
        <img src={msg.preview} alt={msg.file_name} className="mt-3 max-h-56 w-full rounded-lg object-contain" />
      )}

      <div className="mt-3 flex gap-2">
        {([
          ["data", "Извлечени данни"],
          ["contract", "Договор"],
          ["receipt", "Разписка"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs",
              tab === key ? "border-primary bg-primary text-primary-foreground" : "border-primary/20 hover:border-primary",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "data" ? (
        <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-xs md:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2 border-b border-primary/10 py-1">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value ? String(value) : "—"}</dd>
            </div>
          ))}
          {act.notes && <p className="mt-2 text-xs text-muted-foreground md:col-span-2">{act.notes}</p>}
        </dl>
      ) : (
        <>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs leading-relaxed">
            {text ?? "Няма генериран документ."}
          </pre>
          {text && (
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="px-3 text-xs"
                onClick={() => { navigator.clipboard?.writeText(text); toast.success("Копирано"); }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Копирай
              </Button>
              <Button
                type="button"
                variant="outline"
                className="px-3 text-xs"
                onClick={() => download(`${tab === "contract" ? "dogovor" : "razpiska"}-${Date.now()}.txt`, text)}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Изтегли
              </Button>
            </div>
          )}
        </>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Данните са извлечени автоматично — провери всяко поле преди подпис.
      </p>
    </div>
  );
}
