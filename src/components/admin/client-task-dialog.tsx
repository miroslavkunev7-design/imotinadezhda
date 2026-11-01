import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ListChecks, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CLIENT_BOUND_TASK_OPTIONS,
  autoTaskTitle,
  isClientRelatedTaskType,
} from "@/lib/task-kinds";
import { ClientPicker } from "@/components/admin/client-picker";

export type BoundClient = {
  id: string;
  full_name: string;
  phone?: string | null;
  assigned_broker_id?: string | null;
};

type Broker = { id: string; full_name: string };

function toLocalInput(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  if (!iso) {
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ClientTaskDialog({
  open,
  onClose,
  onSaved,
  client,
  defaultType = "follow_up",
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  client: BoundClient | null;
  defaultType?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [brokerId, setBrokerId] = useState("");
  const [taskType, setTaskType] = useState(defaultType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState(toLocalInput());
  const [titleTouched, setTitleTouched] = useState(false);

  useEffect(() => {
    if (!open || !client) return;
    setClientId(client.id);
    setTaskType(defaultType);
    setTitle(autoTaskTitle(defaultType, client.full_name));
    setDescription("");
    setDueAt(toLocalInput());
    setTitleTouched(false);
    setBrokerId(client.assigned_broker_id ?? "");
    supabase
      .from("brokers")
      .select("id,full_name")
      .order("full_name")
      .then(({ data }) => {
        const rows = (data as Broker[]) ?? [];
        setBrokers(rows);
        setBrokerId((prev) => prev || client.assigned_broker_id || rows[0]?.id || "");
      });
  }, [open, client?.id, defaultType]);

  if (!open || !client) return null;
  if (typeof document === "undefined") return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error("Избери клиент.");
      return;
    }
    if (!brokerId) {
      toast.error("Избери брокер.");
      return;
    }
    if (!title.trim()) {
      toast.error("Заглавието е задължително.");
      return;
    }
    if (isClientRelatedTaskType(taskType) && !clientId) {
      toast.error("За този тип задача трябва да избереш клиент.");
      return;
    }
    setBusy(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("broker_tasks").insert({
        broker_id: brokerId,
        client_id: clientId,
        title: title.trim(),
        description: description.trim() || null,
        task_type: taskType,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        reminder_minutes: 180,
        reminded_at: null,
        is_completed: false,
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Задачата е добавена към клиента.");
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Не стана записът.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.55)] px-3 py-2 text-sm text-amber-50 placeholder:text-amber-100/40";

  return createPortal(
    <div
      className="fixed inset-0 z-[280] flex items-center justify-center bg-black/55 p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-[#2a0a12] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-amber-200">
              <ListChecks className="h-3 w-3" /> Задача за клиент
            </div>
            <h2 className="mt-1 font-display text-xl text-amber-100">Добавяне към задача</h2>
            <p className="mt-0.5 text-xs text-amber-100/60">{client.full_name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-amber-100/70 hover:bg-amber-500/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Клиент *</div>
            <ClientPicker
              tone="dark"
              required
              value={clientId}
              onChange={(id, c) => {
                setClientId(id);
                if (c && !titleTouched) setTitle(autoTaskTitle(taskType, c.full_name));
              }}
              clients={[client]}
              locked
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Тип *</div>
              <select
                value={taskType}
                onChange={(e) => {
                  const next = e.target.value;
                  setTaskType(next);
                  if (!titleTouched) setTitle(autoTaskTitle(next, client.full_name));
                }}
                className={field}
              >
                {CLIENT_BOUND_TASK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Брокер *</div>
              <select required value={brokerId} onChange={(e) => setBrokerId(e.target.value)} className={field}>
                <option value="">— избери —</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Заглавие *</div>
            <input
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleTouched(true);
              }}
              className={field}
            />
          </label>
          <label className="block">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Срок</div>
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={field} />
          </label>
          <label className="block">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Бележка</div>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-amber-500/30 px-3 py-2 text-sm text-amber-100">
            Отказ
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-gradient-to-b from-[#d4b866] to-[#b8942e] px-4 py-2 text-sm font-extrabold text-[#2a0a12] disabled:opacity-50"
          >
            {busy ? "Запазване…" : "Добавяне"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
