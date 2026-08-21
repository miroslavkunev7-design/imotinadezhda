import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, ChevronLeft, ChevronRight, Check, Trash2, Pencil } from "lucide-react";
import coverImg from "@/assets/schedule-cover.jpg";
import logoNadezhda from "@/assets/logo-nadezhda-transparent.png";
import { ClientPicker } from "@/components/admin/client-picker";
import { formatClientLabel, isClientRelatedTaskType } from "@/lib/task-kinds";

/** Viewport overlay — must portal to body. DeskCalendar uses perspective/transform,
 *  which turns `position:fixed` into a box over the tall week grid and hides the card. */
function TaskDialogOverlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      data-task-dialog
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/45 p-4"
      onClick={onClose}
    >
      {children}
    </div>,
    document.body,
  );
}

type TaskFields = Record<string, string>;
type Task = {
  id: string;
  broker_id: string;
  client_id?: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  is_completed: boolean;
  auto_action_log: { end_at?: string; highlight?: string; kind?: string; fields?: TaskFields } | null;
  clients?: { full_name: string; phone?: string | null } | null;
};

type FieldDef = { key: string; label: string; type?: "text" | "tel" | "number" | "textarea"; placeholder?: string };
type TaskKind = { key: string; label: string; icon: string; fields: FieldDef[] };

const TASK_KINDS: TaskKind[] = [
  { key: "viewing", label: "Оглед", icon: "🔑", fields: [
    { key: "owner_phone",   label: "Тел. собственик", type: "tel" },
    { key: "client_phone",  label: "Тел. клиент",     type: "tel" },
    { key: "street",        label: "Улица на имота" },
    { key: "property_type", label: "Тип на имота",    placeholder: "напр. 2-стаен" },
    { key: "quarter",       label: "Квартал" },
    { key: "floor",         label: "Етаж" },
    { key: "price_gross",   label: "Цена (наша)",     type: "text", placeholder: "€" },
    { key: "price_net",     label: "Цена (чисто)",    type: "text", placeholder: "€" },
  ]},
  { key: "property_check", label: "Проверка на имот", icon: "🏠", fields: [
    { key: "property_id", label: "Идентификатор на имота", placeholder: "ID / код на имота" },
    { key: "street",      label: "Улица" },
    { key: "quarter",     label: "Квартал" },
    { key: "notes",       label: "Забележки", type: "textarea" },
  ]},
  { key: "meeting_owner", label: "Среща със собственик", icon: "🤝", fields: [
    { key: "owner_name",  label: "Име на собственик" },
    { key: "owner_phone", label: "Телефон", type: "tel" },
    { key: "property_id", label: "Имот (ID/адрес)" },
    { key: "location",    label: "Място на срещата" },
  ]},
  { key: "meeting_client", label: "Среща с клиент", icon: "👤", fields: [
    { key: "client_name",  label: "Име на клиент" },
    { key: "client_phone", label: "Телефон", type: "tel" },
    { key: "budget",       label: "Бюджет (€)" },
    { key: "requirements", label: "Търси", type: "textarea", placeholder: "тип, квартал, характеристики" },
    { key: "location",     label: "Място на срещата" },
  ]},
  { key: "contract_prelim", label: "Предварителен договор", icon: "📄", fields: [
    { key: "property_id",  label: "Имот (ID)" },
    { key: "owner_phone",  label: "Тел. собственик", type: "tel" },
    { key: "client_phone", label: "Тел. купувач", type: "tel" },
    { key: "deposit",      label: "Капаро (€)" },
    { key: "location",     label: "Място" },
  ]},
  { key: "contract_notary", label: "Нотариус / окончателен договор", icon: "⚖️", fields: [
    { key: "property_id",     label: "Имот (ID)" },
    { key: "notary_name",     label: "Нотариус" },
    { key: "notary_address",  label: "Адрес на кантората" },
    { key: "price",           label: "Продажна цена (€)" },
    { key: "owner_phone",     label: "Тел. продавач", type: "tel" },
    { key: "client_phone",    label: "Тел. купувач", type: "tel" },
  ]},
  { key: "photo_session", label: "Фотозаснемане", icon: "📸", fields: [
    { key: "property_id",   label: "Имот (ID)" },
    { key: "street",        label: "Улица" },
    { key: "contact_phone", label: "Контакт", type: "tel" },
  ]},
  { key: "document_prep", label: "Изготвяне на документи", icon: "🗂️", fields: [
    { key: "property_id", label: "Имот (ID)" },
    { key: "doc_type",    label: "Вид документ", placeholder: "нотариален акт, скица, у-ние ДС..." },
    { key: "institution", label: "Институция" },
    { key: "deadline",    label: "Срок" },
  ]},
  { key: "bank_appointment", label: "Банка / кредит", icon: "🏦", fields: [
    { key: "client_phone", label: "Тел. клиент", type: "tel" },
    { key: "bank_name",    label: "Банка" },
    { key: "purpose",      label: "Цел", placeholder: "оценка, кредит, превод" },
    { key: "amount",       label: "Сума (€)" },
  ]},
  { key: "mortgage", label: "Ипотека", icon: "🏦", fields: [
    { key: "bank_name", label: "Банка" },
    { key: "amount",    label: "Сума (€)" },
    { key: "purpose",   label: "Цел", placeholder: "жилищен кредит, рефинансиране…" },
  ]},
  { key: "deal", label: "Сделка", icon: "🤝", fields: [
    { key: "property_id", label: "Имот (ID/адрес)" },
    { key: "deposit",     label: "Капаро (€)" },
  ]},
  { key: "qualification", label: "Квалификация", icon: "⭐", fields: [
    { key: "topic", label: "Относно" },
  ]},
  { key: "client_docs", label: "Документи на клиент", icon: "📎", fields: [
    { key: "doc_type", label: "Вид документ" },
    { key: "deadline", label: "Срок" },
  ]},
  { key: "follow_up", label: "Follow-up", icon: "🔁", fields: [
    { key: "topic", label: "Относно" },
  ]},
  { key: "evaluation", label: "Оценка на имот", icon: "📐", fields: [
    { key: "property_id", label: "Имот (ID)" },
    { key: "street",      label: "Улица" },
    { key: "evaluator",   label: "Оценител" },
    { key: "amount",      label: "Оценка (€)" },
  ]},
  { key: "key_handover", label: "Предаване на ключове", icon: "🗝️", fields: [
    { key: "property_id", label: "Имот (ID)" },
    { key: "street",      label: "Улица" },
    { key: "from_name",   label: "От (име)" },
    { key: "to_name",     label: "Към (име)" },
    { key: "contact_phone", label: "Телефон", type: "tel" },
  ]},
  { key: "rent_collect", label: "Събиране на наем", icon: "💶", fields: [
    { key: "property_id",  label: "Имот (ID)" },
    { key: "tenant_phone", label: "Тел. наемател", type: "tel" },
    { key: "amount",       label: "Сума (€)" },
    { key: "month",        label: "За месец" },
  ]},
  { key: "advertising", label: "Публикуване / актуализация на обява", icon: "📢", fields: [
    { key: "property_id", label: "Имот (ID)" },
    { key: "portals",     label: "Портали", placeholder: "imoti.net, imot.bg, сайта..." },
    { key: "price",       label: "Цена (€)" },
  ]},
  { key: "call", label: "Обаждане", icon: "📞", fields: [
    { key: "phone",        label: "Телефон", type: "tel" },
    { key: "contact_name", label: "Име" },
    { key: "topic",        label: "Относно" },
  ]},
  { key: "other", label: "Друго", icon: "📝", fields: [] },
];
const KIND_MAP: Record<string, TaskKind> = TASK_KINDS.reduce((acc, k) => { acc[k.key] = k; return acc; }, {} as Record<string, TaskKind>);
const getKind = (k?: string) => (k && KIND_MAP[k]) || KIND_MAP.other;

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 08..18
const DAY_NAMES = ["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"];
const DAY_SHORT = ["Пон", "Вто", "Сря", "Чет", "Пет", "Съб", "Нед"];

const HIGHLIGHTS: { key: string; bg: string; label: string }[] = [
  { key: "pink",   bg: "#FBB6C4", label: "Розов" },
  { key: "peach",  bg: "#FDCFA4", label: "Праскова" },
  { key: "yellow", bg: "#FDE68A", label: "Жълт" },
  { key: "green",  bg: "#BBF7D0", label: "Зелен" },
  { key: "blue",   bg: "#BFDBFE", label: "Син" },
];
const highlightBg = (k?: string) => HIGHLIGHTS.find(h => h.key === k)?.bg;

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow; // move to Monday
  x.setDate(x.getDate() + diff);
  return x;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function combine(day: Date, hour: number, minute = 0) {
  const x = new Date(day); x.setHours(hour, minute, 0, 0); return x;
}
function fmtHM(iso: string) {
  return new Date(iso).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
}

export function WeeklySchedule() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ day: Date; hour: number; task?: Task; mode: "view" | "edit" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hlChoice, setHlChoice] = useState<string>("");
  const [kindChoice, setKindChoice] = useState<string>("other");
  const [fieldValues, setFieldValues] = useState<TaskFields>({});
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setHlChoice(editing.task?.auto_action_log?.highlight ?? "");
      setKindChoice(editing.task?.auto_action_log?.kind ?? "other");
      setFieldValues(editing.task?.auto_action_log?.fields ?? {});
      setClientId(editing.task?.client_id ?? null);
    }
  }, [editing]);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);

  const load = async () => {
    if (!brokerId) return;
    const { data, error } = await supabase
      .from("broker_tasks")
      .select("id,broker_id,client_id,title,description,due_at,is_completed,auto_action_log,clients:client_id(full_name,phone)")
      .gte("due_at", weekStart.toISOString())
      .lt("due_at", weekEnd.toISOString())
      .order("due_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setTasks(((data as any[]) ?? []).map((row) => ({
      ...row,
      clients: Array.isArray(row.clients) ? row.clients[0] ?? null : row.clients ?? null,
    })) as Task[]);
  };

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      let bId: string | null = null;
      if (uid) {
        const { data } = await supabase.from("brokers").select("id").eq("user_id", uid).maybeSingle();
        bId = (data as { id: string } | null)?.id ?? null;
      }
      if (!bId) {
        const { data } = await supabase.from("brokers").select("id").limit(1).maybeSingle();
        bId = (data as { id: string } | null)?.id ?? null;
      }
      setBrokerId(bId);
    })();
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [brokerId, weekStart]);

  const tasksAt = (day: Date, hour: number) => {
    const slotStart = combine(day, hour);
    const slotEnd = combine(day, hour + 1);
    return tasks.filter(t => {
      if (!t.due_at) return false;
      const s = new Date(t.due_at);
      return s >= slotStart && s < slotEnd;
    });
  };

  const toggle = async (t: Task) => {
    const { error } = await supabase.from("broker_tasks")
      .update({ is_completed: !t.is_completed, completed_at: !t.is_completed ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на задачата?")) return;
    const { error } = await supabase.from("broker_tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  };

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    if (!brokerId) {
      toast.error("Няма намерен брокерски профил в базата — задачата не може да бъде запазена.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    const description = String(fd.get("description") || "").trim() || null;
    const startH = Number(fd.get("start"));
    const endH = Number(fd.get("end"));
    const highlight = String(fd.get("highlight") || "").trim() || undefined;
    if (!title) return toast.error("Заглавието е задължително");
    if (endH <= startH) return toast.error("Крайният час трябва да е след началния");
    if (isClientRelatedTaskType(kindChoice) && !clientId) {
      return toast.error("Избери клиент за този тип задача.");
    }
    setBusy(true);
    try {
      const due_at = combine(editing.day, startH).toISOString();
      const end_at = combine(editing.day, endH).toISOString();
      const cleanFields: TaskFields = {};
      const kindDef = getKind(kindChoice);
      for (const f of kindDef.fields) {
        const v = (fieldValues[f.key] ?? "").trim();
        if (v) cleanFields[f.key] = v;
      }
      const log: NonNullable<Task["auto_action_log"]> = { end_at, kind: kindChoice };
      if (highlight) log.highlight = highlight;
      if (Object.keys(cleanFields).length) log.fields = cleanFields;
      const payload = {
        broker_id: brokerId,
        title,
        description,
        due_at,
        task_type: kindChoice,
        client_id: clientId || null,
        auto_action_log: log,
      };
      if (editing.task) {
        const { error } = await supabase.from("broker_tasks").update(payload).eq("id", editing.task.id);
        if (error) throw error;
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("broker_tasks")
          .insert({ ...payload, created_by: userRes.user?.id ?? null });
        if (error) throw error;
      }
      toast.success("Задачата е запазена");
      setEditing(null);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const weekLabel = `${weekStart.toLocaleDateString("bg-BG", { day: "2-digit", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString("bg-BG", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="week-schedule relative min-w-0 w-full pt-5">
      {/* Wall-calendar spiral rings on top */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-around px-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="block h-6 w-3 rounded-full border border-[#8B1A2B]/50"
            style={{
              background:
                "linear-gradient(180deg, #e9d891 0%, #c9a84c 40%, #7a5b1a 70%, #b8942e 100%)",
              boxShadow: "inset 0 -2px 2px rgba(0,0,0,0.35), inset 0 2px 2px rgba(255,255,255,0.55), 0 2px 3px rgba(0,0,0,0.25)",
            }}
          />
        ))}
      </div>
    <section className="relative min-w-0 overflow-hidden rounded-2xl rounded-t-md border border-[#C9A84C]/40 bg-[#fbf6ea] px-3 pb-3 pt-3 shadow-sm sm:px-4">
      {/* Cover: compact so the week grid stays fully in view */}
      <div
        className="relative -mx-3 -mt-3 mb-0 flex max-h-[88px] items-center justify-center overflow-hidden rounded-t-md border-b-2 border-[#8B1A2B] sm:-mx-4 sm:max-h-[110px]"
        style={{
          backgroundImage: `url(${coverImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <img
          src={logoNadezhda}
          alt="Имоти Надежда"
          className="pointer-events-none select-none"
          style={{
            width: "min(36%, 160px)",
            filter: "drop-shadow(0 2px 6px rgba(255,255,255,0.85)) drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
          }}
        />
      </div>
      {/* Toolbar row below cover */}
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[#C9A84C]/40 pb-2 pt-2">
        <h2 className="min-w-0 truncate font-display text-base font-bold text-[#8B1A2B]">Седмичен график</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="rounded-md border border-[#8B1A2B] bg-white p-1.5 text-[#8B1A2B] hover:bg-[#8B1A2B] hover:text-white" aria-label="Предишна седмица"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded-md border border-[#8B1A2B] bg-[#8B1A2B] px-2 py-1 text-xs font-semibold text-white hover:bg-[#6f1322]">Днес</button>
          <span className="mx-1 text-xs font-bold text-[#8B1A2B]">{weekLabel}</span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="rounded-md border border-[#8B1A2B] bg-white p-1.5 text-[#8B1A2B] hover:bg-[#8B1A2B] hover:text-white" aria-label="Следваща седмица"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="week-grid-scroll min-w-0 overflow-x-auto">
        <div className="grid w-full min-w-[720px]" style={{ gridTemplateColumns: "44px repeat(7, minmax(86px, 1fr))" }}>
          {/* Day headers below cover — bold black */}
          <div />
          {DAY_NAMES.map((name, i) => {
            const d = addDays(weekStart, i);
            const isToday = new Date().toDateString() === d.toDateString();
            return (
              <div key={name} className={`min-w-0 border-b-2 border-[#8B1A2B] px-0.5 pb-1 pt-1 text-center ${isToday ? "bg-[#C9A84C]/25" : ""}`}>
                <div className="truncate text-[11px] font-black uppercase tracking-wide text-black xl:text-[12px]">
                  <span className="hidden xl:inline">{name}</span>
                  <span className="xl:hidden">{DAY_SHORT[i]}</span>
                </div>
                <div className="text-[12px] font-black text-black">{d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit" })}</div>
              </div>
            );
          })}
          {/* hour rows */}
          {HOURS.map(h => (
            <div key={h} className="contents">
              <div className="border-t border-[#C9A84C]/30 py-1 pr-1.5 text-right text-[12px] font-black tabular-nums text-[#8B1A2B]">
                {String(h).padStart(2, "0")}:00
              </div>
              {Array.from({ length: 7 }).map((_, di) => {
                const day = addDays(weekStart, di);
                const cellTasks = tasksAt(day, h);
                return (
                  <div key={di} className="week-cell relative flex min-h-[76px] min-w-0 flex-col gap-0.5 overflow-visible border-t border-l border-[#C9A84C]/30 p-0.5 sm:p-1">
                    {cellTasks.map(t => {
                      const endIso = t.auto_action_log?.end_at;
                      const hlBg = highlightBg(t.auto_action_log?.highlight);
                      return (
                        <div key={t.id} className={`group relative z-0 min-w-0 shrink-0 rounded-md border px-1 py-0.5 text-[10px] leading-tight lg:px-1.5 lg:py-1 lg:text-[12px] ${t.is_completed ? "border-emerald-400/60 bg-emerald-50 text-emerald-900" : "border-[#8B1A2B]/40 bg-white text-[#2b1418]"}`}>
                          <div className="flex min-w-0 items-start gap-1">
                            <button type="button" onClick={() => toggle(t)} className={`mt-0.5 grid h-3 w-3 flex-none place-items-center rounded border ${t.is_completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-[#8B1A2B]/50 bg-white text-transparent hover:text-[#8B1A2B]/40"}`} aria-label="Готово">
                              <Check className="h-2.5 w-2.5" />
                            </button>
                            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditing({ day, hour: h, task: t, mode: "view" })}>
                              <div className={`break-words font-semibold ${t.is_completed ? "line-through opacity-70" : ""}`}>
                                <span
                                  style={hlBg ? { backgroundColor: hlBg, padding: "0 2px", borderRadius: 2, color: "#2a0a12" } : undefined}
                                >{getKind(t.auto_action_log?.kind).icon} {t.title}</span>
                              </div>
                              <div className="text-[9px] opacity-70 lg:text-[11px]">{fmtHM(t.due_at!)}{endIso ? `–${fmtHM(endIso)}` : ""}</div>
                              {t.clients?.full_name && (
                                <div className="truncate text-[9px] font-semibold text-[#8B1A2B] lg:text-[11px]">👤 {t.clients.full_name}</div>
                              )}
                            </div>
                            <button type="button" onClick={() => remove(t.id)} className="opacity-0 transition group-hover:opacity-100" aria-label="Изтрий">
                              <Trash2 className="h-2.5 w-2.5 text-[#8B1A2B]" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setEditing({ day, hour: h, mode: "edit" })}
                      className="mt-auto flex w-full shrink-0 items-center justify-center gap-1 rounded-md border border-dashed border-[#C9A84C]/60 py-0.5 text-[9px] font-semibold text-[#8B1A2B]/70 hover:bg-white hover:text-[#8B1A2B]"
                    >
                      <Plus className="h-2.5 w-2.5" /> добави
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {editing && editing.mode === "view" && editing.task && (() => {
        const t = editing.task;
        const kind = getKind(t.auto_action_log?.kind);
        const endIso = t.auto_action_log?.end_at;
        const hlBg = highlightBg(t.auto_action_log?.highlight);
        const fields = t.auto_action_log?.fields ?? {};
        return (
          <TaskDialogOverlay onClose={() => setEditing(null)}>
            <div onClick={e => e.stopPropagation()} className="task-dialog-card my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col rounded-2xl border-2 border-[#C9A84C] bg-[#8B1A2B] shadow-2xl">
              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                <div className="flex items-start justify-between border-b border-[#C9A84C]/70 pb-2">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-white">{kind.icon} {kind.label}</div>
                    <h3 className="font-display text-lg font-bold text-white" style={hlBg ? { backgroundColor: hlBg, padding: "0 6px", borderRadius: 3, display: "inline-block" } : undefined}>{t.title}</h3>
                    <div className="mt-1 text-xs font-semibold text-white/85">
                      {editing.day.toLocaleDateString("bg-BG", { weekday: "long", day: "2-digit", month: "short" })} · {fmtHM(t.due_at!)}{endIso ? ` – ${fmtHM(endIso)}` : ""}
                    </div>
                    {t.clients?.full_name && (
                      <div className="mt-1 text-xs font-semibold text-white">Клиент: {formatClientLabel(t.clients)}</div>
                    )}
                  </div>
                  <button type="button" onClick={() => setEditing(null)} className="rounded-md p-1 text-white hover:bg-white/10" aria-label="Затвори"><X className="h-5 w-5" /></button>
                </div>
                {t.description && (
                  <div className="task-field rounded-md border border-[#8B1A2B]/20 bg-white p-3 text-sm font-semibold text-[#2a0a12] whitespace-pre-wrap">{t.description}</div>
                )}
                {kind.fields.length > 0 && (
                  <dl className="grid grid-cols-2 gap-2">
                    {kind.fields.map(f => {
                      const v = fields[f.key];
                      if (!v) return null;
                      return (
                        <div key={f.key} className="task-field rounded-md border border-[#C9A84C]/40 bg-white p-2">
                          <dt className="text-[10px] font-bold uppercase tracking-wide text-[#8B1A2B]">{f.label}</dt>
                          <dd className="text-sm font-semibold text-[#2a0a12] break-words">{v}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
                {kind.fields.length > 0 && !Object.values(fields).some(Boolean) && (
                  <div className="text-xs italic text-white/85">Няма попълнени полета за тази задача.</div>
                )}
              </div>
              <div className="sticky bottom-0 flex items-center justify-between gap-2 rounded-b-2xl border-t border-[#C9A84C]/70 bg-[#8B1A2B] px-5 py-3">
                <button type="button" onClick={async () => { await remove(t.id); setEditing(null); }} className="rounded-md border border-[#8B1A2B]/40 bg-white px-3 py-2 text-sm font-bold text-[#8B1A2B] hover:bg-[#8B1A2B]/10">
                  <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Изтрий
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing({ ...editing, mode: "edit" })} className="rounded-md bg-gradient-to-b from-[#d4b866] to-[#b8942e] px-4 py-2 text-sm font-extrabold text-[#2a0a12] shadow">
                    <Pencil className="mr-1 inline h-3.5 w-3.5" /> Редактирай
                  </button>
                </div>
              </div>
            </div>
          </TaskDialogOverlay>
        );
      })()}

      {editing && editing.mode === "edit" && (() => {
        const kindDef = getKind(kindChoice);
        return (
        <TaskDialogOverlay onClose={() => setEditing(null)}>
          <form onSubmit={save} onClick={e => e.stopPropagation()} className="task-dialog-form my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col rounded-2xl border-2 border-[#C9A84C] bg-[#8B1A2B] shadow-2xl">
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
            <div className="flex items-center justify-between border-b border-[#C9A84C]/70 pb-2">
              <h3 className="font-display text-lg font-bold text-white">
                {editing.task ? "Редакция на задача" : "Нова задача"}
                <span className="ml-2 text-xs font-semibold text-white/85">
                  {editing.day.toLocaleDateString("bg-BG", { weekday: "long", day: "2-digit", month: "short" })}
                </span>
              </h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded-md p-1 text-white hover:bg-[#8B1A2B]/10" aria-label="Затвори"><X className="h-5 w-5" /></button>
            </div>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-white">Тип задача *</span>
              <select
                value={kindChoice}
                onChange={e => setKindChoice(e.target.value)}
                className="mt-1 w-full rounded-md border border-[#8B1A2B]/40 bg-white px-3 py-2 text-sm font-semibold text-black focus:border-[#8B1A2B] focus:ring-2 focus:ring-white/40"
              >
                {TASK_KINDS.map(k => (
                  <option key={k.key} value={k.key}>{k.icon} {k.label}</option>
                ))}
              </select>
            </label>
            {isClientRelatedTaskType(kindChoice) && (
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-white">Клиент *</span>
                <ClientPicker
                  tone="schedule"
                  required
                  value={clientId}
                  onChange={(id, c) => {
                    setClientId(id);
                    if (c) {
                      setFieldValues((prev) => ({
                        ...prev,
                        client_name: prev.client_name || c.full_name,
                        contact_name: prev.contact_name || c.full_name,
                        client_phone: prev.client_phone || c.phone || "",
                        phone: prev.phone || c.phone || "",
                        tenant_phone: prev.tenant_phone || c.phone || "",
                      }));
                    }
                  }}
                />
                <span className="mt-1 block text-[11px] text-white/75">Задължително — избери точния клиент от регистъра.</span>
              </label>
            )}
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-white">Заглавие *</span>
              <input name="title" required defaultValue={editing.task?.title ?? ""} placeholder={`Например: ${kindDef.label}`} className="mt-1 w-full rounded-md border border-[#8B1A2B]/40 bg-white px-3 py-2 text-sm font-medium text-black outline-none focus:border-[#8B1A2B] focus:ring-2 focus:ring-white/40" />
            </label>
            {kindDef.fields.length > 0 && (
              <div className="task-field rounded-md border border-[#C9A84C]/70 bg-white p-3">
                <div className="task-field-label mb-2 text-[11px] font-bold uppercase tracking-wide text-[#8B1A2B]">Полета за „{kindDef.label}"</div>
                <div className="grid grid-cols-2 gap-2">
                  {kindDef.fields.map(f => (
                    <label key={f.key} className={`block ${f.type === "textarea" ? "col-span-2" : ""}`}>
                      <span className="task-field-label text-[10px] font-bold uppercase tracking-wide text-[#8B1A2B]">{f.label}</span>
                      {f.type === "textarea" ? (
                        <textarea
                          rows={2}
                          value={fieldValues[f.key] ?? ""}
                          onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="mt-1 w-full rounded-md border border-[#8B1A2B]/40 bg-white px-2 py-1.5 text-sm font-medium text-black outline-none focus:border-[#8B1A2B] focus:ring-2 focus:ring-white/40"
                        />
                      ) : (
                        <input
                          type={f.type ?? "text"}
                          value={fieldValues[f.key] ?? ""}
                          onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                          className="mt-1 w-full rounded-md border border-[#8B1A2B]/40 bg-white px-2 py-1.5 text-sm font-medium text-black outline-none focus:border-[#8B1A2B] focus:ring-2 focus:ring-white/40"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-white">Описание / забележки</span>
              <textarea name="description" defaultValue={editing.task?.description ?? ""} rows={2} placeholder="Свободен текст..." className="mt-1 w-full rounded-md border border-[#8B1A2B]/40 bg-white px-3 py-2 text-sm font-medium text-black outline-none focus:border-[#8B1A2B] focus:ring-2 focus:ring-white/40" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-white">От</span>
                <select name="start" defaultValue={editing.task?.due_at ? new Date(editing.task.due_at).getHours() : editing.hour} className="mt-1 w-full rounded-md border border-[#8B1A2B]/40 bg-white px-2 py-2 text-sm font-semibold text-black focus:border-[#8B1A2B] focus:ring-2 focus:ring-white/40">
                  {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-white">До</span>
                <select name="end" defaultValue={editing.task?.auto_action_log?.end_at ? new Date(editing.task.auto_action_log.end_at).getHours() : editing.hour + 1} className="mt-1 w-full rounded-md border border-[#8B1A2B]/40 bg-white px-2 py-2 text-sm font-semibold text-black focus:border-[#8B1A2B] focus:ring-2 focus:ring-white/40">
                  {[...HOURS, 19].map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
              </label>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-white">Маркер</span>
              <input type="hidden" name="highlight" value={hlChoice} />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setHlChoice("")}
                  className={`task-hl grid h-8 w-8 place-items-center rounded-full border-2 bg-white text-[10px] font-bold text-[#8B1A2B] ${hlChoice === "" ? "border-white ring-2 ring-white/60" : "border-[#8B1A2B]/30"}`}
                  aria-label="Без маркер"
                >—</button>
                {HIGHLIGHTS.map(h => (
                  <button
                    key={h.key}
                    type="button"
                    onClick={() => setHlChoice(h.key)}
                    aria-label={h.label}
                    title={h.label}
                    className={`task-hl h-8 w-8 rounded-full border-2 transition ${hlChoice === h.key ? "border-white ring-2 ring-white/70 scale-110" : "border-white/80"}`}
                    style={{ backgroundColor: h.bg, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
                  />
                ))}
              </div>
            </div>
            </div>
            <div className="sticky bottom-0 flex items-center justify-between gap-2 rounded-b-2xl border-t border-[#C9A84C]/70 bg-[#8B1A2B] px-5 py-3">
              {editing.task ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!editing.task) return;
                    await remove(editing.task.id);
                    setEditing(null);
                  }}
                  className="rounded-md border border-[#8B1A2B]/40 bg-white px-3 py-2 text-sm font-bold text-[#8B1A2B] hover:bg-[#8B1A2B]/10"
                >
                  Изтрий
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="rounded-md border border-[#8B1A2B]/40 bg-white px-3 py-2 text-sm font-bold text-[#8B1A2B] hover:bg-[#8B1A2B]/10">Отказ</button>
                <button type="submit" disabled={busy} className="rounded-md bg-gradient-to-b from-[#d4b866] to-[#b8942e] px-4 py-2 text-sm font-extrabold text-[#2a0a12] shadow disabled:opacity-50">
                  {busy ? "Запазване..." : editing.task ? "Запази" : "Добавяне"}
                </button>
              </div>
            </div>
          </form>
        </TaskDialogOverlay>
        );
      })()}
    </section>
    </div>
  );
}