import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { CalendarPlus, Loader2, X } from "lucide-react";
import { listClients, listBrokers, searchPropertiesForLink } from "@/lib/crm.functions";
import { upsertViewing, type ViewingStatus } from "@/lib/viewings.functions";

export type ViewingDraft = {
  id?: string | null;
  client_id?: string | null;
  property_id?: string | null;
  archived_property_id?: string | null;
  broker_id?: string | null;
  scheduled_at?: string | null;
  location?: string | null;
  notes?: string | null;
  property_title?: string | null;
  status?: ViewingStatus;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInput(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  if (!iso) {
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  defaults?: ViewingDraft;
};

export function ScheduleViewingDialog({ open, onClose, onSaved, defaults }: Props) {
  const [busy, setBusy] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; full_name: string; assigned_broker_id?: string | null }>>([]);
  const [brokers, setBrokers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [props, setProps] = useState<Array<{ id: string; title: string; address?: string | null }>>([]);
  const [form, setForm] = useState<ViewingDraft>({});

  useEffect(() => {
    if (!open) return;
    setForm({
      ...defaults,
      scheduled_at: toLocalInput(defaults?.scheduled_at),
      status: defaults?.status ?? "planned",
    });
    Promise.all([listClients(), listBrokers(), searchPropertiesForLink({ data: { q: "" } })])
      .then(([cs, bs, ps]) => {
        setClients((cs as any[]) ?? []);
        setBrokers((bs as any[]) ?? []);
        setProps((ps as any[]) ?? []);
        setForm((prev) => {
          const next = { ...prev };
          if (!next.broker_id) {
            next.broker_id =
              defaults?.broker_id ||
              (cs as any[])?.find((c) => c.id === defaults?.client_id)?.assigned_broker_id ||
              (bs as any[])?.[0]?.id ||
              null;
          }
          return next;
        });
      })
      .catch((e) => toast.error(e?.message ?? "Не се заредиха данните."));
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.broker_id) {
      toast.error("Избери брокер.");
      return;
    }
    if (!form.scheduled_at) {
      toast.error("Избери дата и час.");
      return;
    }
    setBusy(true);
    try {
      const chosen = props.find((p) => p.id === form.property_id);
      await upsertViewing({
        data: {
          id: form.id ?? undefined,
          client_id: form.client_id || null,
          property_id: form.property_id || null,
          archived_property_id: form.archived_property_id || null,
          broker_id: form.broker_id,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
          location: form.location || null,
          notes: form.notes || null,
          property_title: form.property_title || chosen?.title || null,
          status: form.status ?? "planned",
        },
      });
      toast.success("Огледът е в календара. Напомняния: ден по-рано и ~2 часа преди часа.");
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Не стана записът.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.55)] px-3 py-2 text-sm text-amber-50 placeholder:text-amber-100/40";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
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
              Насрочване
            </div>
            <h2 className="mt-1 font-display text-xl text-amber-100">{form.id ? "Редакция на оглед" : "Нов оглед"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-amber-100/70 hover:bg-amber-500/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Клиент</div>
            <select
              value={form.client_id ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                const c = clients.find((x) => x.id === id);
                setForm((f) => ({ ...f, client_id: id, broker_id: f.broker_id || c?.assigned_broker_id || f.broker_id }));
              }}
              className={field}
            >
              <option value="">— без клиент —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Имот</div>
            <select
              value={form.property_id ?? ""}
              onChange={(e) => {
                const id = e.target.value || null;
                const p = props.find((x) => x.id === id);
                setForm((f) => ({ ...f, property_id: id, property_title: p?.title ?? f.property_title, location: f.location || p?.address || null }));
              }}
              className={field}
            >
              <option value="">{form.property_title ? form.property_title : "— избери имот —"}</option>
              {props.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Брокер</div>
            <select
              required
              value={form.broker_id ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, broker_id: e.target.value }))}
              className={field}
            >
              <option value="" disabled>
                Избери
              </option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Дата и час</div>
            <input
              type="datetime-local"
              required
              value={form.scheduled_at ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
              className={field}
            />
          </label>

          <label className="block sm:col-span-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Място / адрес</div>
            <input
              value={form.location ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className={field}
              placeholder="адрес на имота или офис"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Статус</div>
            <select
              value={form.status ?? "planned"}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ViewingStatus }))}
              className={field}
            >
              <option value="planned">Планиран</option>
              <option value="confirmed">Потвърден</option>
              <option value="done">Проведен</option>
              <option value="cancelled">Отказан</option>
              <option value="no_show">Недошъл</option>
            </select>
          </label>

          <label className="block sm:col-span-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-200/70">Бележки</div>
            <textarea
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className={field}
              placeholder="вход, етаж, ключ, кого да чакаме…"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-amber-500/30 px-3 py-2 text-sm text-amber-100">
            Отказ
          </button>
          <button type="submit" disabled={busy} className="gold-cta-button inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            Запиши огледа
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
