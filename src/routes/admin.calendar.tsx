import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, CheckSquare, MessageSquare, KeyRound, Plus } from "lucide-react";
import { listViewings, VIEWING_STATUS_LABEL, type ViewingStatus } from "@/lib/viewings.functions";
import { ScheduleViewingDialog } from "@/components/admin/schedule-viewing-dialog";

export const Route = createFileRoute("/admin/calendar")({ component: CalendarAdmin });

type EventKind = "task" | "inquiry" | "viewing";
type Event = { id: string; date: string; title: string; kind: EventKind; meta?: string };

type CalView = "month" | "week" | "day";

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  x.setDate(x.getDate() + (dow === 0 ? -6 : 1 - dow));
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);
const DAY_SHORT = ["Пон", "Вто", "Сря", "Чет", "Пет", "Съб", "Нед"];

function CalendarAdmin() {
  const [now, setNow] = useState(() => new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<CalView>("month");
  const [bookOpen, setBookOpen] = useState(false);

  const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);
  const monthEnd = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0), [now]);
  const weekStart = useMemo(() => startOfWeek(now), [now]);

  const loadRange = async (from: Date, to: Date) => {
    const fromIso = from.toISOString();
    const toIso = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59).toISOString();
    const [tasks, inqs, viewings] = await Promise.all([
      supabase.from("broker_tasks").select("id,title,due_at,is_completed,task_type").gte("due_at", fromIso).lte("due_at", toIso),
      supabase.from("inquiries").select("id,name,created_at,status").gte("created_at", fromIso).lte("created_at", toIso),
      listViewings({ data: { from: fromIso, to: toIso } }).catch(() => []),
    ]);
    if (tasks.error) return toast.error(tasks.error.message);
    if (inqs.error) return toast.error(inqs.error.message);
    const viewingEvents: Event[] = ((viewings as any[]) ?? []).map((v) => {
      const client = Array.isArray(v.clients) ? v.clients[0]?.full_name : v.clients?.full_name;
      const status = VIEWING_STATUS_LABEL[(v.status as ViewingStatus) ?? "planned"];
      return {
        id: `v-${v.id}`,
        date: v.scheduled_at as string,
        title: `Оглед${client ? `: ${client}` : ""}`,
        kind: "viewing" as const,
        meta: [status, v.property_title || v.location].filter(Boolean).join(" · "),
      };
    });
    const ev: Event[] = [
      ...((tasks.data ?? []) as any[])
        .filter((t) => t.due_at && t.task_type !== "viewing")
        .map((t) => ({
          id: `t-${t.id}`,
          date: t.due_at as string,
          title: t.title as string,
          kind: "task" as const,
          meta: t.is_completed ? "✔ готова" : undefined,
        })),
      ...((inqs.data ?? []) as any[]).map((i) => ({
        id: `i-${i.id}`,
        date: i.created_at as string,
        title: `Запитване: ${i.name}`,
        kind: "inquiry" as const,
        meta: i.status,
      })),
      ...viewingEvents,
    ];
    setEvents(ev);
  };

  useEffect(() => {
    if (view === "month") {
      loadRange(monthStart, monthEnd);
    } else if (view === "week") {
      loadRange(weekStart, addDays(weekStart, 6));
    } else {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      loadRange(day, day);
    }
  }, [view, monthStart, monthEnd, weekStart, now]);

  const cells = useMemo(() => {
    const firstWeekday = (monthStart.getDay() + 6) % 7;
    const days = monthEnd.getDate();
    const arr: { date: Date | null }[] = [];
    for (let i = 0; i < firstWeekday; i++) arr.push({ date: null });
    for (let d = 1; d <= days; d++) arr.push({ date: new Date(now.getFullYear(), now.getMonth(), d) });
    while (arr.length % 7 !== 0) arr.push({ date: null });
    return arr;
  }, [monthStart, monthEnd, now]);

  const eventsOn = (d: Date) =>
    events.filter((e) => {
      const x = new Date(e.date);
      return sameDay(x, d);
    });

  const selectedDate = selected ? new Date(selected) : now;
  const selectedEvents = eventsOn(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const shift = (dir: number) => {
    if (view === "month") setNow(new Date(now.getFullYear(), now.getMonth() + dir, 1));
    else if (view === "week") setNow(addDays(now, dir * 7));
    else setNow(addDays(now, dir));
  };

  const kindClass = (kind: EventKind) =>
    kind === "viewing"
      ? "bg-amber-300 text-amber-950"
      : kind === "task"
        ? "bg-emerald-400 text-emerald-950"
        : "bg-sky-300 text-sky-950";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-amber-100">Календар</h1>
          <p className="text-sm text-amber-100/60">Огледи, задачи със срок и нови запитвания.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-amber-500/30 p-0.5">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1.5 text-xs ${view === v ? "bg-amber-500/25 text-amber-50" : "text-amber-100/70"}`}
              >
                {v === "month" ? "Месец" : v === "week" ? "Седмица" : "Ден"}
              </button>
            ))}
          </div>
          <button
            onClick={() => shift(-1)}
            className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-amber-100 hover:bg-amber-500/15"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[150px] text-center font-display text-amber-100">
            {view === "month"
              ? now.toLocaleDateString("bg-BG", { month: "long", year: "numeric" })
              : view === "week"
                ? `${weekStart.toLocaleDateString("bg-BG", { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString("bg-BG", { day: "numeric", month: "short" })}`
                : now.toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <button
            onClick={() => shift(1)}
            className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-amber-100 hover:bg-amber-500/15"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setNow(new Date())}
            className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/15"
          >
            Днес
          </button>
          <Link
            to="/admin/viewings"
            className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100 hover:bg-amber-500/15"
          >
            Табло огледи
          </Link>
          <button
            onClick={() => setBookOpen(true)}
            className="gold-cta-button inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Оглед
          </button>
        </div>
      </header>

      {view === "month" && (
        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] p-4 backdrop-blur">
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-[#C9A84C]">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c.date) return <div key={i} className="aspect-square rounded-md bg-[#3a0912]/40" />;
              const ev = eventsOn(c.date);
              const isToday = sameDay(c.date, new Date());
              const iso = c.date.toISOString();
              return (
                <button
                  key={i}
                  onClick={() => {
                    setSelected(iso);
                    setNow(c.date!);
                  }}
                  className={`flex aspect-square flex-col rounded-md border-2 p-1 text-left transition ${
                    isToday
                      ? "border-[#C9A84C] bg-gradient-to-br from-[#a01f36] to-[#6b1626] shadow-[0_0_0_2px_rgba(201,168,76,0.4)]"
                      : "border-[#C9A84C]/50 bg-gradient-to-br from-[#8B1A2B] to-[#5a0f1d] hover:from-[#a01f36] hover:to-[#6b1626]"
                  } ${selected && sameDay(new Date(selected), c.date) ? "ring-2 ring-[#C9A84C]" : ""}`}
                >
                  <div className="text-sm font-extrabold text-white drop-shadow">{c.date.getDate()}</div>
                  <div className="mt-0.5 space-y-0.5 overflow-hidden">
                    {ev.slice(0, 2).map((e) => (
                      <div key={e.id} className={`truncate rounded px-1 text-[9px] font-bold ${kindClass(e.kind)}`}>
                        {e.title}
                      </div>
                    ))}
                    {ev.length > 2 && <div className="text-[9px] font-bold text-[#C9A84C]">+{ev.length - 2}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="overflow-x-auto rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] p-3">
          <div className="min-w-[720px]">
            <div className="mb-1 grid grid-cols-[48px_repeat(7,1fr)] gap-1 text-center text-[11px] font-bold uppercase text-[#C9A84C]">
              <div />
              {weekDays.map((d, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setNow(d);
                    setView("day");
                  }}
                  className={`rounded py-1 ${sameDay(d, new Date()) ? "bg-amber-500/20 text-amber-50" : ""}`}
                >
                  {DAY_SHORT[i]} {d.getDate()}
                </button>
              ))}
            </div>
            {HOURS.map((h) => (
              <div key={h} className="grid grid-cols-[48px_repeat(7,1fr)] gap-1 border-t border-amber-500/10">
                <div className="py-1 text-right text-[10px] text-amber-100/50">{String(h).padStart(2, "0")}:00</div>
                {weekDays.map((d, i) => {
                  const slotStart = new Date(d);
                  slotStart.setHours(h, 0, 0, 0);
                  const slotEnd = new Date(d);
                  slotEnd.setHours(h + 1, 0, 0, 0);
                  const slotEv = events.filter((e) => {
                    const t = new Date(e.date).getTime();
                    return t >= slotStart.getTime() && t < slotEnd.getTime();
                  });
                  return (
                    <div key={i} className="min-h-[44px] rounded-sm bg-[#3a0912]/30 p-0.5">
                      {slotEv.map((e) => (
                        <div key={e.id} className={`mb-0.5 truncate rounded px-1 text-[10px] font-semibold ${kindClass(e.kind)}`}>
                          {new Date(e.date).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })} {e.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "day" && (
        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] p-4">
          {HOURS.map((h) => {
            const slotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h);
            const slotEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h + 1);
            const slotEv = events.filter((e) => {
              const t = new Date(e.date).getTime();
              return t >= slotStart.getTime() && t < slotEnd.getTime();
            });
            return (
              <div key={h} className="flex gap-3 border-t border-amber-500/10 py-2">
                <div className="w-14 shrink-0 text-right text-xs text-amber-100/50">{String(h).padStart(2, "0")}:00</div>
                <div className="min-h-[40px] flex-1 space-y-1">
                  {slotEv.map((e) => (
                    <div key={e.id} className={`rounded-md px-2 py-1 text-sm font-semibold ${kindClass(e.kind)}`}>
                      {new Date(e.date).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })} · {e.title}
                      {e.meta ? ` · ${e.meta}` : ""}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "month" && selected && (
        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] p-4 backdrop-blur">
          <h3 className="mb-3 font-display text-lg text-amber-100">
            {new Date(selected).toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-amber-100/60">Няма събития.</p>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  {e.kind === "viewing" ? (
                    <KeyRound className="h-4 w-4 text-amber-300" />
                  ) : e.kind === "task" ? (
                    <CheckSquare className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-sky-300" />
                  )}
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

      <div className="flex flex-wrap gap-4 text-xs text-amber-100/70">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-amber-400/70" /> Оглед
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-emerald-500/40" /> Задача (срок)
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-sky-500/40" /> Запитване
        </div>
        <CalIcon className="ml-auto h-4 w-4 text-amber-100/40" />
      </div>

      <ScheduleViewingDialog open={bookOpen} onClose={() => setBookOpen(false)} onSaved={() => {
        if (view === "month") loadRange(monthStart, monthEnd);
        else if (view === "week") loadRange(weekStart, addDays(weekStart, 6));
        else {
          const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          loadRange(day, day);
        }
      }} />
    </div>
  );
}
