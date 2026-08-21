import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarPlus,
  Check,
  KeyRound,
  Pencil,
  Trash2,
  UserX,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScheduleViewingDialog, type ViewingDraft } from "@/components/admin/schedule-viewing-dialog";
import {
  deleteViewing,
  getViewingStats,
  listViewings,
  setViewingStatus,
  VIEWING_STATUS_LABEL,
  type ViewingStatus,
} from "@/lib/viewings.functions";

export const Route = createFileRoute("/admin/viewings")({ component: ViewingsAdmin });

type ViewingRow = {
  id: string;
  scheduled_at: string;
  location: string | null;
  notes: string | null;
  property_title: string | null;
  status: ViewingStatus;
  client_id: string | null;
  property_id: string | null;
  archived_property_id: string | null;
  broker_id: string;
  clients?: { full_name?: string; phone?: string | null } | null;
  brokers?: { full_name?: string } | null;
  properties?: { title?: string; address?: string | null } | null;
};

function nameOf(rel: { full_name?: string } | { full_name?: string }[] | null | undefined) {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0]?.full_name ?? null : rel.full_name ?? null;
}

function ViewingsAdmin() {
  const [rows, setRows] = useState<ViewingRow[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getViewingStats>> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ViewingDraft | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "today" | "all">("upcoming");

  const load = async () => {
    try {
      const from = new Date();
      from.setDate(from.getDate() - 14);
      from.setHours(0, 0, 0, 0);
      const to = new Date();
      to.setDate(to.getDate() + 45);
      const [list, st] = await Promise.all([
        listViewings({ data: { from: from.toISOString(), to: to.toISOString() } }),
        getViewingStats(),
      ]);
      setRows((list as ViewingRow[]) ?? []);
      setStats(st);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при зареждане на огледите.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    if (filter === "today") {
      return rows.filter((r) => r.scheduled_at >= start.toISOString() && r.scheduled_at < end.toISOString());
    }
    if (filter === "upcoming") {
      return rows.filter((r) => r.scheduled_at >= start.toISOString() && ["planned", "confirmed"].includes(r.status));
    }
    return rows;
  }, [rows, filter]);

  const setStatus = async (id: string, status: ViewingStatus) => {
    setBusyId(id);
    try {
      await setViewingStatus({ data: { id, status } });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Не се смени статусът.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на този оглед?")) return;
    setBusyId(id);
    try {
      await deleteViewing({ data: { id } });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Не се изтри.");
    } finally {
      setBusyId(null);
    }
  };

  const statusTone: Record<ViewingStatus, string> = {
    planned: "bg-amber-400/20 text-amber-100",
    confirmed: "bg-emerald-500/25 text-emerald-100",
    done: "bg-sky-500/20 text-sky-100",
    cancelled: "bg-white/10 text-amber-100/50",
    no_show: "bg-rose-500/25 text-rose-100",
  };

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-200">
            <KeyRound className="h-3 w-3" /> Огледи · напомняния
          </div>
          <h1 className="mt-2 font-display text-4xl text-amber-100">Насрочване на огледи</h1>
          <p className="mt-1 text-sm text-amber-100/60">
            Клиент, имот, брокер и час. Напомняне ден по-рано и около 2 часа преди огледа (имейл + push + в CRM).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/calendar"
            className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/15"
          >
            Календар седмица/ден
          </Link>
          <Button onClick={() => setDialog({})} className="gold-cta-button">
            <CalendarPlus className="h-4 w-4" /> Нов оглед
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Днес", value: stats?.todayCount ?? "—" },
          { label: "Предстоящи 7 дни", value: stats?.upcoming7Count ?? "—" },
          { label: "Потвърждения (30 дни)", value: stats ? `${stats.confirmationRate}%` : "—" },
          { label: "Недошли (30 дни)", value: stats?.noShowCount ?? "—" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] p-4 backdrop-blur">
            <div className="text-[11px] uppercase tracking-wider text-amber-200/70">{c.label}</div>
            <div className="mt-1 font-display text-3xl text-amber-50">{c.value}</div>
          </div>
        ))}
      </div>

      {!!stats?.byBroker?.length && (
        <div className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.55)] p-4">
          <h2 className="mb-3 font-display text-lg text-amber-100">По брокер (последните 30 дни)</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-amber-200/70">
                <tr>
                  <th className="py-2 pr-3">Брокер</th>
                  <th className="py-2 pr-3">Огледи</th>
                  <th className="py-2 pr-3">Потвърдени/проведени</th>
                  <th className="py-2">Недошли</th>
                </tr>
              </thead>
              <tbody>
                {stats.byBroker.map((b) => (
                  <tr key={b.name} className="border-t border-amber-500/10 text-amber-50">
                    <td className="py-2 pr-3">{b.name}</td>
                    <td className="py-2 pr-3">{b.total}</td>
                    <td className="py-2 pr-3">{b.confirmed}</td>
                    <td className="py-2">{b.noShows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["upcoming", "Предстоящи"],
            ["today", "Днес"],
            ["all", "Всички в периода"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              filter === key
                ? "border-amber-400 bg-amber-500/20 text-amber-50"
                : "border-amber-500/25 text-amber-100/70 hover:bg-amber-500/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(20,4,8,0.45)]">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-[rgba(40,8,16,0.85)] text-left text-amber-100">
            <tr>
              <th className="px-4 py-3">Кога</th>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Имот / място</th>
              <th className="px-4 py-3">Брокер</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-amber-100/50">
                  Няма огледи в този филтър.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const client = nameOf(r.clients);
                const broker = nameOf(r.brokers);
                const prop = r.property_title || (Array.isArray(r.properties) ? r.properties[0]?.title : r.properties?.title);
                return (
                  <tr key={r.id} className="border-t border-amber-500/10 text-amber-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(r.scheduled_at).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3">{client || "—"}</td>
                    <td className="px-4 py-3">
                      <div>{prop || "—"}</div>
                      {r.location && <div className="text-xs text-amber-100/50">{r.location}</div>}
                    </td>
                    <td className="px-4 py-3">{broker || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone[r.status]}`}>
                        {VIEWING_STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        {r.status === "planned" && (
                          <button
                            disabled={busyId === r.id}
                            onClick={() => setStatus(r.id, "confirmed")}
                            className="rounded-md border border-emerald-400/30 px-2 py-1 text-[11px] text-emerald-100 hover:bg-emerald-500/15"
                          >
                            <Check className="mr-1 inline h-3 w-3" />
                            Потвърди
                          </button>
                        )}
                        {["planned", "confirmed"].includes(r.status) && (
                          <>
                            <button
                              disabled={busyId === r.id}
                              onClick={() => setStatus(r.id, "done")}
                              className="rounded-md border border-sky-400/30 px-2 py-1 text-[11px] text-sky-100 hover:bg-sky-500/15"
                            >
                              Проведен
                            </button>
                            <button
                              disabled={busyId === r.id}
                              onClick={() => setStatus(r.id, "no_show")}
                              className="rounded-md border border-rose-400/30 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-500/15"
                            >
                              <UserX className="mr-1 inline h-3 w-3" />
                              Недошъл
                            </button>
                            <button
                              disabled={busyId === r.id}
                              onClick={() => setStatus(r.id, "cancelled")}
                              className="rounded-md border border-amber-500/20 px-2 py-1 text-[11px] text-amber-100/70 hover:bg-amber-500/10"
                            >
                              <XCircle className="mr-1 inline h-3 w-3" />
                              Отказ
                            </button>
                          </>
                        )}
                        <button
                          onClick={() =>
                            setDialog({
                              id: r.id,
                              client_id: r.client_id,
                              property_id: r.property_id,
                              archived_property_id: r.archived_property_id,
                              broker_id: r.broker_id,
                              scheduled_at: r.scheduled_at,
                              location: r.location,
                              notes: r.notes,
                              property_title: r.property_title,
                              status: r.status,
                            })
                          }
                          className="rounded-md border border-amber-500/25 p-1.5 text-amber-100 hover:bg-amber-500/10"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={busyId === r.id}
                          onClick={() => remove(r.id)}
                          className="rounded-md border border-rose-400/20 p-1.5 text-rose-200 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ScheduleViewingDialog
        open={dialog !== null}
        defaults={dialog ?? undefined}
        onClose={() => setDialog(null)}
        onSaved={load}
      />
    </div>
  );
}
