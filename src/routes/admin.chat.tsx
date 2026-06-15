import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageCircle, User, Bot, UserCog, RefreshCw, Users, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/chat")({ component: ChatAdmin });

type Tab = "team" | "customers";

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
      </div>
      {tab === "team" ? <TeamChat /> : <CustomerChat />}
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
    <section className="flex h-[calc(100vh-220px)] min-w-0 flex-col rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] backdrop-blur">
      <header className="flex items-center justify-between border-b border-amber-500/15 p-3">
        <div>
          <div className="font-semibold text-amber-100">Екипен чат</div>
          <div className="text-xs text-amber-100/60">Виждат го всички брокери в реално време.</div>
        </div>
        <button onClick={load} className="text-amber-100/60 hover:text-amber-100"><RefreshCw className="h-4 w-4" /></button>
      </header>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 && <div className="text-center text-sm text-amber-100/50">Все още няма съобщения. Напиши първото.</div>}
        {msgs.map(m => {
          const mine = m.sender_id === me?.id;
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <div className={`flex h-7 w-7 flex-none items-center justify-center rounded-full ${mine ? "bg-emerald-500/25 text-emerald-100" : "bg-amber-500/20 text-amber-200"}`}>
                <UserCog className="h-3.5 w-3.5" />
              </div>
              <div className={`group max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-emerald-500/15 text-emerald-50" : "bg-amber-500/10 text-amber-100"}`}>
                {!mine && <div className="mb-0.5 text-[10px] font-semibold text-amber-200/80">{m.sender_name || "Брокер"}</div>}
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-amber-100/40">
                  <span>{new Date(m.created_at).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" })}</span>
                  {mine && (
                    <button onClick={() => remove(m.id)} className="opacity-0 transition group-hover:opacity-100 hover:text-rose-300">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 border-t border-amber-500/15 p-3">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={me ? `Напиши съобщение като ${me.name}...` : "Зареждане..."}
          disabled={!me}
          className="flex-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-400 disabled:opacity-60"
        />
        <Button onClick={send} disabled={busy || !text.trim() || !me}><Send className="h-4 w-4" /> Изпрати</Button>
      </div>
    </section>
  );
}

/* ===================== CUSTOMER CHAT (existing) ===================== */

function CustomerChat() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<Chat | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
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
      if (!active.is_handed_off) {
        await supabase.from("customer_chats").update({ is_handed_off: true, last_message_at: new Date().toISOString() }).eq("id", active.id);
        setActive({ ...active, is_handed_off: true });
      } else {
        await supabase.from("customer_chats").update({ last_message_at: new Date().toISOString() }).eq("id", active.id);
      }
      setReply("");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="flex h-[calc(100vh-220px)] gap-4">
      <aside className="w-80 flex-none overflow-y-auto rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-amber-500/15 p-3">
          <h2 className="font-display text-amber-100">Разговори</h2>
          <button onClick={loadChats} className="text-amber-100/60 hover:text-amber-100"><RefreshCw className="h-4 w-4" /></button>
        </div>
        {chats.length === 0 ? (
          <div className="p-6 text-center text-sm text-amber-100/60">Все още няма разговори.</div>
        ) : (
          <ul>
            {chats.map(c => {
              const isActive = active?.id === c.id;
              return (
                <li key={c.id}>
                  <button onClick={() => setActive(c)}
                    className={`flex w-full items-start gap-2 border-b border-amber-500/10 p-3 text-left transition ${isActive ? "bg-amber-500/15" : "hover:bg-amber-500/5"}`}>
                    <User className="mt-0.5 h-4 w-4 flex-none text-amber-300" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-amber-100">{c.visitor_name || "Анонимен"}</span>
                        {c.is_handed_off && <UserCog className="h-3 w-3 text-emerald-300" />}
                      </div>
                      <div className="truncate text-[11px] text-amber-100/55">
                        {c.visitor_phone || c.visitor_email || c.page_url || "—"}
                      </div>
                      <div className="text-[10px] text-amber-100/40">
                        {new Date(c.last_message_at).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" })}
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
              <div className="font-semibold text-amber-100">{active.visitor_name || "Анонимен посетител"}</div>
              <div className="text-xs text-amber-100/60">
                {[active.visitor_phone, active.visitor_email, active.page_url].filter(Boolean).join(" · ")}
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
                    <div className="mt-1 text-[10px] text-amber-100/40">{new Date(m.created_at).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}</div>
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
