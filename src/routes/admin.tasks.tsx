import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CheckSquare, Square, Plus, Trash2, X, Calendar as CalIcon } from "lucide-react";

export const Route = createFileRoute("/admin/tasks")({ component: TasksAdmin });

type Task = {
  id: string;
  broker_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  task_type: string;
  is_completed: boolean;
  due_at: string | null;
  created_at: string;
};
type Broker = { id: string; full_name: string };
type Client = { id: string; full_name: string };

function TasksAdmin() {
  const [rows, setRows] = useState<Task[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [t, b, c] = await Promise.all([
      supabase.from("broker_tasks").select("*").order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
      supabase.from("brokers").select("id,full_name").order("full_name"),
      supabase.from("clients").select("id,full_name").order("full_name"),
    ]);
    if (t.error) return toast.error(t.error.message);
    setRows((t.data as Task[]) ?? []);
    setBrokers((b.data as Broker[]) ?? []);
    setClients((c.data as Client[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    try {
      if (!editing.title?.trim()) throw new Error("Заглавието е задължително");
      if (!editing.broker_id) throw new Error("Избери брокер");
      const payload: any = {
        title: editing.title.trim(),
        description: editing.description ?? null,
        task_type: editing.task_type || "general",
        broker_id: editing.broker_id,
        client_id: editing.client_id || null,
        due_at: editing.due_at || null,
        is_completed: editing.is_completed ?? false,
        reminder_minutes: (editing as any).reminder_minutes ?? 180,
        // Reset reminder so the new due_at can fire again
        reminded_at: null,
      };
      if (editing.id) {
        const { error } = await supabase.from("broker_tasks").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("broker_tasks").insert(payload);
        if (error) throw error;
      }
      toast.success("Задачата е запазена");
      setEditing(null);
      await load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
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
    toast.success("Изтрита");
    await load();
  };

  const filtered = rows.filter(r => filter === "all" || (filter === "open" ? !r.is_completed : r.is_completed));
  const brokerName = (id: string) => brokers.find(b => b.id === id)?.full_name ?? "—";
  const clientName = (id: string | null) => id ? (clients.find(c => c.id === id)?.full_name ?? "—") : "";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-amber-100">Задачи на брокерите</h1>
          <p className="text-sm text-amber-100/60">Възлагане, проследяване и срокове.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-amber-500/30 bg-amber-500/5 p-0.5 text-xs">
            {(["open", "all", "done"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md transition ${filter === f ? "bg-amber-500/25 text-amber-100" : "text-amber-100/60 hover:text-amber-100"}`}>
                {f === "open" ? "Активни" : f === "all" ? "Всички" : "Готови"}
              </button>
            ))}
          </div>
          <Button onClick={() => setEditing({ task_type: "general", is_completed: false })}>
            <Plus className="h-4 w-4" /> Нова задача
          </Button>
        </div>
      </header>

      <div className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] backdrop-blur">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-amber-100/60">Няма задачи в този изглед.</div>
        ) : (
          <ul className="divide-y divide-amber-500/15">
            {filtered.map(t => {
              const overdue = !t.is_completed && t.due_at && new Date(t.due_at) < new Date();
              return (
                <li key={t.id} className="flex items-start gap-3 p-4">
                  <button onClick={() => toggle(t)} className="mt-0.5 text-amber-300 hover:text-amber-200">
                    {t.is_completed ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold ${t.is_completed ? "text-amber-100/40 line-through" : "text-amber-100"}`}>{t.title}</div>
                    {t.description && <div className="mt-0.5 text-xs text-amber-100/60">{t.description}</div>}
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-amber-100/55">
                      <span>👤 {brokerName(t.broker_id)}</span>
                      {t.client_id && <span>· Клиент: {clientName(t.client_id)}</span>}
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5">{t.task_type}</span>
                      {t.due_at && (
                        <span className={overdue ? "text-rose-300" : ""}>
                          <CalIcon className="mr-1 inline h-3 w-3" />
                          {new Date(t.due_at).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Редактирай</Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4 text-rose-300" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <form onSubmit={save} onClick={e => e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-2xl border border-amber-500/30 bg-[#1a0608] p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-amber-100">{editing.id ? "Редакция" : "Нова задача"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-amber-100/60 hover:text-amber-100"><X className="h-5 w-5" /></button>
            </div>
            <Field label="Заглавие *">
              <input required value={editing.title ?? ""} onChange={e => setEditing({ ...editing, title: e.target.value })} className={inp} />
            </Field>
            <Field label="Описание">
              <textarea value={editing.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value })} className={inp} rows={3} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Брокер *">
                <select required value={editing.broker_id ?? ""} onChange={e => setEditing({ ...editing, broker_id: e.target.value })} className={inp}>
                  <option value="">— избери —</option>
                  {brokers.map(b => <option key={b.id} value={b.id}>{b.full_name}</option>)}
                </select>
              </Field>
              <Field label="Клиент (по избор)">
                <select value={editing.client_id ?? ""} onChange={e => setEditing({ ...editing, client_id: e.target.value || null })} className={inp}>
                  <option value="">—</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </Field>
              <Field label="Тип">
                <select value={editing.task_type ?? "general"} onChange={e => setEditing({ ...editing, task_type: e.target.value })} className={inp}>
                  <option value="general">Обща</option>
                  <option value="call">Обаждане</option>
                  <option value="visit">Оглед</option>
                  <option value="meeting">Среща</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="document">Документ</option>
                </select>
              </Field>
              <Field label="Срок">
                <input type="datetime-local" value={editing.due_at ? editing.due_at.slice(0, 16) : ""}
                  onChange={e => setEditing({ ...editing, due_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className={inp} />
              </Field>
              <Field label="Напомняне (минути преди срока)">
                <select
                  value={String((editing as any).reminder_minutes ?? 180)}
                  onChange={e => setEditing({ ...editing, reminder_minutes: Number(e.target.value) } as any)}
                  className={inp}
                >
                  <option value="15">15 мин</option>
                  <option value="30">30 мин</option>
                  <option value="60">1 час</option>
                  <option value="120">2 часа</option>
                  <option value="180">3 часа</option>
                  <option value="360">6 часа</option>
                  <option value="720">12 часа</option>
                  <option value="1440">1 ден</option>
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Отказ</Button>
              <Button type="submit" disabled={busy}>{busy ? "Запазване..." : "Запази"}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const inp = "w-full rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-100 outline-none focus:border-amber-400";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs text-amber-100/70">{label}</span>{children}</label>;
}
