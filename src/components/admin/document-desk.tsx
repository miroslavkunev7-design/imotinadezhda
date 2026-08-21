import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  ScanLine,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DocScanner } from "@/components/admin/doc-scanner";
import {
  DOC_STATUSES,
  DOC_TYPES,
  deleteChecklistItem,
  listDocumentDesk,
  listDocumentLookups,
  registerDocumentUpload,
  seedDealChecklist,
  updateDocumentTracking,
  type DeskAnalytics,
  type DeskRow,
  type DocStatus,
} from "@/lib/documents.functions";

const STATUS_BG: Record<DocStatus, { label: string; className: string }> = {
  missing: { label: "Липсва", className: "bg-rose-100 text-rose-800" },
  requested: { label: "Поискан", className: "bg-amber-100 text-amber-900" },
  uploaded: { label: "Качен", className: "bg-sky-100 text-sky-800" },
  verified: { label: "Проверен", className: "bg-emerald-100 text-emerald-800" },
  expired: { label: "Изтекъл", className: "bg-rose-200 text-rose-900" },
};

type View = "all" | "missing" | "client" | "type" | "overdue" | "scan";

function parseRowRef(row: DeskRow): { source: "client" | "property" | "checklist"; id: string } | null {
  if (row.checklist_id) return { source: "checklist", id: row.checklist_id };
  if (row.id.startsWith("client:")) return { source: "client", id: row.id.slice("client:".length) };
  if (row.id.startsWith("property:")) return { source: "property", id: row.id.slice("property:".length) };
  return null;
}

function openFile(url: string | null) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type Props = {
  initialClient?: string;
  initialProperty?: string;
};

export function DocumentDesk({ initialClient, initialProperty }: Props) {
  const [view, setView] = useState<View>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rows, setRows] = useState<DeskRow[]>([]);
  const [analytics, setAnalytics] = useState<DeskAnalytics | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; full_name: string; phone: string | null }>>([]);
  const [properties, setProperties] = useState<Array<{ id: string; title: string }>>([]);
  const [clientId, setClientId] = useState(initialClient ?? "");
  const [propertyId, setPropertyId] = useState(initialProperty ?? "");
  const [docType, setDocType] = useState("");
  const [status, setStatus] = useState<DocStatus | "">("");
  const [expiresAt, setExpiresAt] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const desk = await listDocumentDesk({
        data: {
          client_id: clientId || undefined,
          property_id: propertyId || undefined,
          doc_type: docType || undefined,
          status: status || undefined,
        },
      });
      setRows(desk.rows);
      setAnalytics(desk.analytics);
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при зареждане");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const lookups = await listDocumentLookups();
        setClients(lookups.clients as any);
        setProperties(lookups.properties as any);
      } catch (e: any) {
        toast.error(e?.message ?? "Грешка при списъците");
      }
    })();
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId, propertyId, docType, status]);

  const visible = useMemo(() => {
    if (view === "missing") return rows.filter((r) => r.status === "missing" || r.status === "requested");
    if (view === "overdue") return rows.filter((r) => r.status === "expired");
    return rows;
  }, [rows, view]);

  const byClient = useMemo(() => {
    const map = new Map<string, { name: string; rows: DeskRow[]; missing: number }>();
    for (const r of rows) {
      const key = r.client_id ?? "none";
      const name = r.client_name ?? "Без клиент";
      const cur = map.get(key) ?? { name, rows: [], missing: 0 };
      cur.rows.push(r);
      if (r.status === "missing" || r.status === "expired") cur.missing += 1;
      map.set(key, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].missing - a[1].missing);
  }, [rows]);

  const byType = useMemo(() => {
    const map = new Map<string, { label: string; rows: DeskRow[]; missing: number }>();
    for (const r of rows) {
      const cur = map.get(r.doc_type) ?? { label: r.doc_type_label, rows: [], missing: 0 };
      cur.rows.push(r);
      if (r.status === "missing" || r.status === "expired") cur.missing += 1;
      map.set(r.doc_type, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].missing - a[1].missing);
  }, [rows]);

  const seed = async () => {
    if (!clientId && !propertyId) {
      toast.error("Избери клиент и/или имот за чеклиста.");
      return;
    }
    setBusy("seed");
    try {
      await seedDealChecklist({ data: { client_id: clientId || null, property_id: propertyId || null } });
      toast.success("Чеклистът за сделката е създаден.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    } finally {
      setBusy(null);
    }
  };

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!clientId && !propertyId) {
      toast.error("Избери клиент или имот, към който да се върже файлът.");
      return;
    }
    const type = docType || "other";
    const typeMeta = DOC_TYPES.find((t) => t.id === type);
    const useProperty = !!propertyId && (!clientId || typeMeta?.subject !== "client");
    const bucket = useProperty ? "property-documents" : "client-documents";
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "bin";
        const owner = useProperty ? propertyId : clientId;
        const path = `${owner}/${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
        if (upErr) { toast.error(upErr.message); continue; }
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
        await registerDocumentUpload({
          data: {
            client_id: clientId || null,
            property_id: propertyId || null,
            doc_type: type,
            file_url: signed?.signedUrl ?? path,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            file_path: path,
            expires_at: expiresAt || null,
            bucket,
          },
        });
      }
      toast.success("Файлът е качен.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при качване");
    } finally {
      setUploading(false);
    }
  };

  const setStatusFor = async (row: DeskRow, next: DocStatus) => {
    const ref = parseRowRef(row);
    if (!ref) return;
    setBusy(row.id);
    try {
      await updateDocumentTracking({ data: { ...ref, status: next } });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    } finally {
      setBusy(null);
    }
  };

  const setExpiryFor = async (row: DeskRow, value: string) => {
    const ref = parseRowRef(row);
    if (!ref) return;
    setBusy(row.id);
    try {
      await updateDocumentTracking({ data: { ...ref, expires_at: value || null } });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    } finally {
      setBusy(null);
    }
  };

  const removeSlot = async (row: DeskRow) => {
    if (!row.checklist_id) return;
    if (!confirm("Премахване на този слот от чеклиста? Файлът не се трие.")) return;
    setBusy(row.id);
    try {
      await deleteChecklistItem({ data: { id: row.checklist_id } });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    } finally {
      setBusy(null);
    }
  };

  const tabs: Array<{ id: View; label: string }> = [
    { id: "all", label: "Всички" },
    { id: "missing", label: "Липсващи" },
    { id: "client", label: "По клиент" },
    { id: "type", label: "По тип" },
    { id: "overdue", label: "Просрочени" },
    { id: "scan", label: "Скенер" },
  ];

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-200">
            Автоматизация №9 · файлове и статуси
          </div>
          <h1 className="mt-2 font-display text-4xl text-amber-100">Управление на документи</h1>
          <p className="mt-1 max-w-2xl text-sm text-amber-100/60">
            Скица, данъчна оценка, нотариален акт, пълномощни и лични карти — към клиент и/или имот.
            Институциите (КАИС, НАП) са отделна задача №13.
          </p>
        </div>
      </header>

      {analytics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={CheckCircle2} label="Попълнени" value={`${analytics.complete_pct}%`} hint={`${analytics.uploaded + analytics.verified} качени/проверени`} />
          <Stat icon={AlertCircle} label="Липсващи" value={String(analytics.missing + analytics.requested)} hint={`${analytics.requested} поискани`} />
          <Stat icon={Clock} label="Изтичат до 30 дни" value={String(analytics.expiring_30)} hint={`${analytics.overdue} вече изтекли`} />
          <Stat icon={FolderOpen} label="Общо записи" value={String(analytics.total)} hint={`${analytics.verified} проверени`} />
        </div>
      )}

      <div className="rounded-xl border border-amber-500/20 bg-[rgba(20,4,8,0.35)] p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-amber-100/70">
            Клиент
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.7)] px-3 py-2 text-sm text-amber-50">
              <option value="">Всички клиенти</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </label>
          <label className="text-xs text-amber-100/70">
            Имот
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.7)] px-3 py-2 text-sm text-amber-50">
              <option value="">Всички имоти</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <label className="text-xs text-amber-100/70">
            Тип
            <select value={docType} onChange={(e) => setDocType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.7)] px-3 py-2 text-sm text-amber-50">
              <option value="">Всички типове</option>
              {DOC_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-amber-100/70">
            Статус
            <select value={status} onChange={(e) => setStatus(e.target.value as DocStatus | "")}
              className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.7)] px-3 py-2 text-sm text-amber-50">
              <option value="">Всички статуси</option>
              {DOC_STATUSES.map((s) => <option key={s} value={s}>{STATUS_BG[s].label}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-amber-100/70">
            Валиден до
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 block rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.7)] px-3 py-2 text-sm text-amber-50" />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-2 text-sm text-amber-50 hover:bg-amber-500/25">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Качи файл
            <input type="file" multiple className="hidden" accept="image/*,application/pdf,.doc,.docx"
              onChange={(e) => { onUpload(e.target.files); e.target.value = ""; }} />
          </label>
          <Button type="button" variant="outline" disabled={!!busy} onClick={seed}
            className="border-amber-400/40 text-amber-100 hover:bg-amber-500/10">
            {busy === "seed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Чеклист за сделката
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setView(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${view === t.id ? "bg-amber-400 text-[#3a0f18]" : "border border-amber-500/30 text-amber-100/80 hover:bg-amber-500/10"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {view === "scan" ? (
        <div className="rounded-xl border border-amber-500/15 bg-white p-4 text-[#3a0f18]">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ScanLine className="h-4 w-4" /> Сканер на документи
          </div>
          <DocScanner />
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/20 py-16 text-amber-100/70">
          <Loader2 className="h-5 w-5 animate-spin" /> Зареждане…
        </div>
      ) : view === "client" ? (
        <GroupedList groups={byClient.map(([id, g]) => ({
          key: id,
          title: g.name,
          hint: `${g.rows.length} · липсват ${g.missing}`,
          rows: g.rows,
        }))} busy={busy} onOpen={openFile} onStatus={setStatusFor} onExpiry={setExpiryFor} onRemove={removeSlot} />
      ) : view === "type" ? (
        <GroupedList groups={byType.map(([id, g]) => ({
          key: id,
          title: g.label,
          hint: `${g.rows.length} · липсват ${g.missing}`,
          rows: g.rows,
        }))} busy={busy} onOpen={openFile} onStatus={setStatusFor} onExpiry={setExpiryFor} onRemove={removeSlot} />
      ) : (
        <FileTable rows={visible} busy={busy} onOpen={openFile} onStatus={setStatusFor} onExpiry={setExpiryFor} onRemove={removeSlot} />
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof CheckCircle2; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-[rgba(20,4,8,0.45)] px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-amber-200/80">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 font-display text-3xl text-amber-50">{value}</div>
      <div className="text-xs text-amber-100/50">{hint}</div>
    </div>
  );
}

function FileTable({
  rows, busy, onOpen, onStatus, onExpiry, onRemove,
}: {
  rows: DeskRow[];
  busy: string | null;
  onOpen: (url: string | null) => void;
  onStatus: (row: DeskRow, s: DocStatus) => void;
  onExpiry: (row: DeskRow, v: string) => void;
  onRemove: (row: DeskRow) => void;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-amber-500/30 py-12 text-center text-sm text-amber-100/60">
        Няма записи за този изглед. Създай чеклист или качи файл.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.94)]">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-[rgba(40,8,16,0.9)] text-left text-amber-100">
          <tr>
            <th className="px-4 py-3">Документ</th>
            <th className="px-4 py-3">Клиент / имот</th>
            <th className="px-4 py-3">Статус</th>
            <th className="px-4 py-3">Качил · дата</th>
            <th className="px-4 py-3">Валиден до</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="text-[#3a0f18]">
          {rows.map((r) => {
            const st = STATUS_BG[r.status];
            const canOpen = !!r.file_url;
            return (
              <tr key={r.id} className="border-t border-amber-500/10 hover:bg-amber-500/5">
                <td className="px-4 py-2">
                  <div className="font-semibold">{r.doc_type_label}</div>
                  {canOpen ? (
                    <button type="button" onClick={() => onOpen(r.file_url)}
                      className="mt-0.5 inline-flex max-w-[260px] items-center gap-1 truncate text-xs text-emerald-700 underline-offset-2 hover:underline"
                      title="Отвори в нов таб">
                      <ExternalLink className="h-3 w-3 flex-none" />
                      <span className="truncate">{r.file_name ?? "Отвори"}</span>
                    </button>
                  ) : (
                    <div className="text-xs text-[#6b1626]">{r.file_name ?? "няма файл"}</div>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">
                  {r.client_id ? (
                    <div className="block font-medium">{r.client_name ?? "Клиент"}</div>
                  ) : <div className="text-[#6b1626]">—</div>}
                  <div className="text-[#6b1626]">{r.property_title ?? "—"}</div>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={r.status}
                    disabled={busy === r.id || !parseRowRef(r)}
                    onChange={(e) => onStatus(r, e.target.value as DocStatus)}
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${st.className}`}
                  >
                    {DOC_STATUSES.map((s) => <option key={s} value={s}>{STATUS_BG[s].label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2 text-xs">
                  <div>{r.uploaded_by_name ?? (r.uploaded_by ? r.uploaded_by.slice(0, 8) : "—")}</div>
                  <div className="text-[#6b1626]">{fmtWhen(r.uploaded_at)}</div>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="date"
                    defaultValue={fmtDate(r.expires_at) === "—" ? "" : fmtDate(r.expires_at)}
                    onBlur={(e) => {
                      const next = e.target.value || "";
                      if (next !== (r.expires_at ?? "")) onExpiry(r, next);
                    }}
                    className="rounded border border-amber-500/25 bg-white px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  {r.checklist_id && (
                    <button type="button" title="Премахни слота" onClick={() => onRemove(r)}
                      className="rounded p-1 text-rose-600 hover:bg-rose-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GroupedList({
  groups, busy, onOpen, onStatus, onExpiry, onRemove,
}: {
  groups: Array<{ key: string; title: string; hint: string; rows: DeskRow[] }>;
  busy: string | null;
  onOpen: (url: string | null) => void;
  onStatus: (row: DeskRow, s: DocStatus) => void;
  onExpiry: (row: DeskRow, v: string) => void;
  onRemove: (row: DeskRow) => void;
}) {
  if (!groups.length) {
    return (
      <div className="rounded-xl border border-dashed border-amber-500/30 py-12 text-center text-sm text-amber-100/60">
        Няма групирани записи.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="mb-1.5 flex items-baseline justify-between text-amber-100">
            <h2 className="font-display text-xl">{g.title}</h2>
            <span className="text-xs text-amber-100/50">{g.hint}</span>
          </div>
          <FileTable rows={g.rows} busy={busy} onOpen={onOpen} onStatus={onStatus} onExpiry={onExpiry} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}
