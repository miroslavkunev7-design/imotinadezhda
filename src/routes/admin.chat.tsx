import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageCircle, User, Bot, UserCog, RefreshCw, Users, Trash2, BarChart3, UserPlus } from "lucide-react";
import officeBg from "@/assets/office-glass-tower.jpg";
import { AssistantAnalytics } from "@/components/admin/assistant-analytics";
import { convertChatToClient, setChatHandoff } from "@/lib/customer-assistant.functions";

export const Route = createFileRoute("/admin/chat")({ component: ChatAdmin });

type Tab = "team" | "customers" | "analytics";
type ChannelFilter = "all" | "site" | "whatsapp" | "messenger" | "viber" | "unanswered" | "handoff";

type Chat = {
  id: string;
  visitor_token: string;
  visitor_name: string | null;
  visitor_phone: string | null;
  visitor_email: string | null;
  page_url: string | null;
  is_handed_off: boolean;
  last_message_at: string;
  created_at: string;
  channel?: string | null;
  unanswered?: boolean;
  lead_captured?: boolean;
  client_id?: string | null;
  visitor_city?: string | null;
};
type Msg = { id: string; chat_id: string; role: string; content: string; created_at: string };

type TeamMsg = {
  id: string;
  sender_id: string;
  sender_name: string | null;
  content: string;
  created_at: string;
};

function ChatAdmin() {
  const [tab, setTab] = useState<Tab>("team");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("team")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === "team" ? "bg-amber-500/25 text-amber-100" : "border border-amber-500/20 text-amber-100/60 hover:text-amber-100"}`}
        >
          <Users className="h-4 w-4" /> Екипен чат
        </button>
        <button
          onClick={() => setTab("customers")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === "customers" ? "bg-amber-500/25 text-amber-100" : "border border-amber-500/20 text-amber-100/60 hover:text-amber-100"}`}
        >
          <MessageCircle className="h-4 w-4" /> Чат с клиенти
        </button>
        <button
          onClick={() => setTab("analytics")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === "analytics" ? "bg-amber-500/25 text-amber-100" : "border border-amber-500/20 text-amber-100/60 hover:text-amber-100"}`}
        >
          <BarChart3 className="h-4 w-4" /> Аналитика 24/7
        </button>
      </div>
      {tab === "team" ? <TeamChat /> : tab === "analytics" ? <AssistantAnalytics /> : <CustomerChat />}
    </div>
  );
}

/* ===================== TEAM CHAT ===================== */

function TeamChat() {
  const [msgs, setMsgs] = useState<TeamMsg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      const uid = auth.user.id;
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle();
      const fallback = auth.user.email?.split("@")[0] ?? "Брокер";
      setMe({ id: uid, name: (prof?.full_name as string) || fallback });
    })();
  }, []);

  const load = async () => {
    const { data, error } = await supabase
      .from("team_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) return toast.error(error.message);
    setMsgs((data as TeamMsg[]) ?? []);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase
      .channel("team-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "team_messages" }, (payload: any) => {
        setMsgs(prev => [...prev, payload.new as TeamMsg]);
        setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "team_messages" }, (payload: any) => {
        setMsgs(prev => prev.filter(m => m.id !== (payload.old as any).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const send = async () => {
    if (!me || !text.trim() || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("team_messages").insert({
        sender_id: me.id,
        sender_name: me.name,
        content: text.trim(),
      });
      if (error) throw error;
      setText("");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на съобщението?")) return;
    const { error } = await supabase.from("team_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <section
      className="relative flex h-[calc(100vh-220px)] min-w-0 flex-col overflow-hidden rounded-2xl border-2 border-[#C9A84C]/40 shadow-2xl"
      style={{ backgroundImage: `linear-gradient(rgba(10,3,6,0.72), rgba(10,3,6,0.82)), url(${officeBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <header className="flex items-center justify-between border-b border-[#C9A84C]/30 bg-black/25 p-3 backdrop-blur-sm">
        <div>
          <div className="font-semibold text-white drop-shadow">Екипен чат</div>
          <div className="text-xs text-white/80">Виждат го всички брокери в реално време.</div>
        </div>
        <button onClick={load} className="text-white/80 hover:text-white"><RefreshCw className="h-4 w-4" /></button>
      </header>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 && <div className="text-center text-sm text-white/70 drop-shadow">Все още няма съобщения. Напиши първото.</div>}
        {msgs.map(m => {
          const mine = m.sender_id === me?.id;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <div className={`flex h-7 w-7 flex-none items-center justify-center rounded-full ${mine ? "bg-sky-500 text-white" : "bg-emerald-500 text-white"}`}>
                <UserCog className="h-3.5 w-3.5" />
              </div>
              <div className={`group max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-lg ${mine ? "bg-sky-500 text-white" : "bg-emerald-500 text-white"}`}>
                {!mine && <div className="mb-0.5 text-[10px] font-semibold text-white/90">{m.sender_name || "Брокер"}</div>}
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-white/75">
                  <span>{new Date(m.created_at).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" })}</span>
                  {mine && (
                    <button onClick={() => remove(m.id)} className="opacity-0 transition group-hover:opacity-100 hover:text-rose-200">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 border-t border-[#C9A84C]/30 bg-black/25 p-3 backdrop-blur-sm">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={me ? `Напиши съобщение като ${me.name}...` : "Зареждане..."}
          disabled={!me}
          className="flex-1 rounded-md border-2 border-[#C9A84C]/50 bg-white/95 px-3 py-2 text-sm text-[#3a0f18] placeholder:text-[#8B1A2B]/50 outline-none focus:border-[#C9A84C] disabled:opacity-60"
        />
        <Button onClick={send} disabled={busy || !text.trim() || !me}><Send className="h-4 w-4" /> Изпрати</Button>
      </div>
    </section>
  );
}

const CHANNEL_SHORT: Record<string, string> = {
  site: "Сайт",
  whatsapp: "WA",
  messenger: "FB",
  viber: "Viber",
};

/* ===================== CUSTOMER CHAT (existing) ===================== */

function CustomerChat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<Chat | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<ChannelFilter>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadChats = async () => {
    const { data, error } = await supabase.from("customer_chats").select("*").order("last_message_at", { ascending: false }).limit(100);
    if (error) return toast.error(error.message);
    setChats((data as Chat[]) ?? []);
  };
  useEffect(() => { loadChats(); }, []);

  useEffect(() => {
    if (!active) { setMsgs([]); return; }
    let cancel = false;
    (async () => {
      const { data, error } = await supabase.from("customer_chat_messages").select("*").eq("chat_id", active.id).order("created_at", { ascending: true });
      if (cancel) return;
      if (error) return toast.error(error.message);
      setMsgs((data as Msg[]) ?? []);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    })();
    return () => { cancel = true; };
  }, [active?.id]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-chats")
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_chats" }, () => loadChats())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "customer_chat_messages" }, (payload: any) => {
        if (active && payload.new.chat_id === active.id) {
          setMsgs(prev => [...prev, payload.new as Msg]);
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active?.id]);

  const send = async () => {
    if (!active || !reply.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("customer_chat_messages").insert({
        chat_id: active.id, role: "agent", content: reply.trim(), metadata: {},
      });
      if (error) throw error;
      await supabase.from("customer_chats").update({
        is_handed_off: true,
        unanswered: false,
        last_message_at: new Date().toISOString(),
      }).eq("id", active.id);
      setActive({ ...active, is_handed_off: true, unanswered: false });
      setReply("");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const convert = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const res = await convertChatToClient({ data: { chat_id: active.id } });
      toast.success(res.duplicate ? "Вече има запитване — свързано." : "Създадени са запитване и клиент.");
      setActive({ ...active, lead_captured: true, client_id: res.client_id });
      loadChats();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleHandoff = async (on: boolean) => {
    if (!active) return;
    try {
      await setChatHandoff({ data: { chat_id: active.id, handed_off: on, reason: on ? "broker" : undefined } });
      setActive({ ...active, is_handed_off: on, unanswered: on });
      loadChats();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const visible = chats.filter((c) => {
    if (filter === "all") return true;
    if (filter === "unanswered") return Boolean(c.unanswered);
    if (filter === "handoff") return Boolean(c.is_handed_off);
    return (c.channel || "site") === filter;
  });

  return (
    <div className="flex h-[calc(100vh-220px)] gap-4">
      <aside className="w-80 flex-none overflow-y-auto rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-amber-500/15 p-3">
          <h2 className="font-display text-amber-100">Разговори</h2>
          <button onClick={loadChats} className="text-amber-100/60 hover:text-amber-100"><RefreshCw className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-wrap gap-1 border-b border-amber-500/10 p-2">
          {([
            ["all", "Всички"],
            ["site", "Сайт"],
            ["whatsapp", "WA"],
            ["messenger", "FB"],
            ["viber", "Viber"],
            ["unanswered", "Отворени"],
            ["handoff", "Брокер"],
          ] as Array<[ChannelFilter, string]>).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-2 py-0.5 text-[10px] ${filter === key ? "bg-amber-500/25 text-amber-50" : "text-amber-100/50 hover:text-amber-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <div className="p-6 text-center text-sm text-amber-100/60">Все още няма разговори.</div>
        ) : (
          <ul>
            {visible.map(c => {
              const isActive = active?.id === c.id;
              const ch = CHANNEL_SHORT[c.channel || "site"] || "Сайт";
              return (
                <li key={c.id}>
                  <button onClick={() => setActive(c)}
                    className={`flex w-full items-start gap-2 border-b border-amber-500/10 p-3 text-left transition ${isActive ? "bg-amber-500/15" : "hover:bg-amber-500/5"}`}>
                    <User className="mt-0.5 h-4 w-4 flex-none text-amber-300" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-amber-100">{c.visitor_name || "Анонимен"}</span>
                        <span className="rounded bg-amber-500/15 px-1 text-[9px] text-amber-200">{ch}</span>
                        {c.is_handed_off && <UserCog className="h-3 w-3 text-emerald-300" />}
                        {c.unanswered && <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />}
                      </div>
                      <div className="truncate text-[11px] text-amber-100/55">
                        {c.visitor_phone || c.visitor_email || c.page_url || "—"}
                      </div>
                      <div className="text-[10px] text-amber-100/40">
                        {new Date(c.last_message_at).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" })}
                        {c.lead_captured ? " · лийд" : ""}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] backdrop-blur">
        {!active ? (
          <div className="m-auto flex flex-col items-center gap-2 text-amber-100/60">
            <MessageCircle className="h-10 w-10" />
            <p className="text-sm">Избери разговор от ляво.</p>
          </div>
        ) : (
          <>
            <header className="border-b border-amber-500/15 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-amber-100">{active.visitor_name || "Анонимен посетител"}</div>
                  <div className="text-xs text-amber-100/60">
                    {[CHANNEL_SHORT[active.channel || "site"], active.visitor_phone, active.visitor_email, active.visitor_city, active.page_url].filter(Boolean).join(" · ")}
                    {active.is_handed_off ? " · AI спрян (брокер)" : " · AI"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={convert} disabled={busy || Boolean(active.client_id)}>
                    <UserPlus className="h-3.5 w-3.5" /> {active.client_id ? "Клиент" : "Към клиент"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleHandoff(!active.is_handed_off)}>
                    {active.is_handed_off ? "Върни AI" : "Предай на брокер"}
                  </Button>
                </div>
              </div>
            </header>
            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
              {msgs.map(m => (
                <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "" : "flex-row-reverse"}`}>
                  <div className={`flex h-7 w-7 flex-none items-center justify-center rounded-full ${m.role === "user" ? "bg-amber-500/20 text-amber-200" : m.role === "agent" ? "bg-emerald-500/25 text-emerald-100" : "bg-sky-500/25 text-sky-100"}`}>
                    {m.role === "user" ? <User className="h-3.5 w-3.5" /> : m.role === "agent" ? <UserCog className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-amber-500/10 text-amber-100" : m.role === "agent" ? "bg-emerald-500/15 text-emerald-50" : "bg-sky-500/15 text-sky-50"}`}>
                    {m.content}
                    <div className="mt-1 text-[10px] text-amber-100/40">{new Date(m.created_at).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })} {m.role === "assistant" ? "AI" : m.role === "agent" ? "брокер" : ""}</div>
                  </div>
                </div>
              ))}
              {msgs.length === 0 && <div className="text-center text-sm text-amber-100/50">Няма съобщения.</div>}
            </div>
            <div className="flex gap-2 border-t border-amber-500/15 p-3">
              <input value={reply} onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Напиши отговор..."
                className="flex-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-400" />
              <Button onClick={send} disabled={busy || !reply.trim()}><Send className="h-4 w-4" /> Изпрати</Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
