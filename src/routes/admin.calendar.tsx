import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, CheckSquare, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/admin/calendar")({ component: CalendarAdmin });

type Event = { id: string; date: string; title: string; kind: "task" | "inquiry"; meta?: string };

function CalendarAdmin() {
  const [now, setNow] = useState(() => new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);
  const monthEnd = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0), [now]);

  useEffect(() => {
    (async () => {
      const fromIso = monthStart.toISOString();
      const toIso = new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate(), 23, 59, 59).toISOString();
      const [tasks, inqs] = await Promise.all([
        supabase.from("broker_tasks").select("id,title,due_at,is_completed").gte("due_at", fromIso).lte("due_at", toIso),
        supabase.from("inquiries").select("id,name,created_at,status").gte("created_at", fromIso).lte("created_at", toIso),
      ]);
      if (tasks.error) return toast.error(tasks.error.message);
      if (inqs.error) return toast.error(inqs.error.message);
      const ev: Event[] = [
        ...((tasks.data ?? []) as any[]).filter(t => t.due_at).map(t => ({
          id: `t-${t.id}`, date: t.due_at as string, title: t.title as string, kind: "task" as const,
          meta: t.is_completed ? "✔ готова" : undefined,
        })),
        ...((inqs.data ?? []) as any[]).map(i => ({
          id: `i-${i.id}`, date: i.created_at as string, title: `Запитване: ${i.name}`, kind: "inquiry" as const,
          meta: i.status,
        })),
      ];
      setEvents(ev);
    })();
  }, [monthStart, monthEnd]);

  const cells = useMemo(() => {
    const firstWeekday = (monthStart.getDay() + 6) % 7; // Mon=0
    const days = monthEnd.getDate();
    const arr: { date: Date | null }[] = [];
    for (let i = 0; i < firstWeekday; i++) arr.push({ date: null });
    for (let d = 1; d <= days; d++) arr.push({ date: new Date(now.getFullYear(), now.getMonth(), d) });
    while (arr.length % 7 !== 0) arr.push({ date: null });
    return arr;
  }, [monthStart, monthEnd, now]);

  const eventsOn = (d: Date) => events.filter(e => {
    const x = new Date(e.date);
    return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
  });

  const selectedEvents = selected ? events.filter(e => new Date(e.date).toDateString() === new Date(selected).toDateString()) : [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-amber-100">Календар</h1>
          <p className="text-sm text-amber-100/60">Задачи с краен срок и нови запитвания.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setNow(new Date(now.getFullYear(), now.getMonth() - 1, 1))}
            className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-amber-100 hover:bg-amber-500/15">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[150px] text-center font-display text-amber-100">
            {now.toLocaleDateString("bg-BG", { month: "long", year: "numeric" })}
          </div>
          <button onClick={() => setNow(new Date(now.getFullYear(), now.getMonth() + 1, 1))}
            className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-amber-100 hover:bg-amber-500/15">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => setNow(new Date())}
            className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/15">
            Днес
          </button>
        </div>
      </header>

      <div className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] p-4 backdrop-blur">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] uppercase text-amber-100/50">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c.date) return <div key={i} className="aspect-square rounded-md bg-amber-500/[0.03]" />;
            const ev = eventsOn(c.date);
            const isToday = c.date.toDateString() === new Date().toDateString();
            const iso = c.date.toISOString();
            return (
              <button key={i} onClick={() => setSelected(iso)}
                className={`flex aspect-square flex-col rounded-md border p-1 text-left transition ${
                  isToday ? "border-amber-400 bg-amber-500/15" : "border-amber-500/20 bg-amber-500/[0.04] hover:bg-amber-500/10"
                } ${selected && new Date(selected).toDateString() === c.date.toDateString() ? "ring-2 ring-amber-400" : ""}`}>
                <div className="text-xs font-semibold text-amber-100">{c.date.getDate()}</div>
                <div className="mt-0.5 space-y-0.5 overflow-hidden">
                  {ev.slice(0, 2).map(e => (
                    <div key={e.id} className={`truncate rounded px-1 text-[9px] ${e.kind === "task" ? "bg-emerald-500/25 text-emerald-100" : "bg-sky-500/25 text-sky-100"}`}>
                      {e.title}
                    </div>
                  ))}
                  {ev.length > 2 && <div className="text-[9px] text-amber-100/60">+{ev.length - 2}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] p-4 backdrop-blur">
          <h3 className="mb-3 font-display text-lg text-amber-100">
            {new Date(selected).toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-amber-100/60">Няма събития.</p>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map(e => (
                <li key={e.id} className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  {e.kind === "task" ? <CheckSquare className="h-4 w-4 text-emerald-300" /> : <MessageSquare className="h-4 w-4 text-sky-300" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-amber-100">{e.title}</div>
                    <div className="text-xs text-amber-100/60">
                      {new Date(e.date).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}
                      {e.meta && ` · ${e.meta}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex gap-4 text-xs text-amber-100/70">
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-emerald-500/40" /> Задача (срок)</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-sky-500/40" /> Запитване</div>
        <CalIcon className="ml-auto h-4 w-4 text-amber-100/40" />
      </div>
    </div>
  );
}
