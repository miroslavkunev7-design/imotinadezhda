// Автоматизация №9 — CRM модул „Управление на документи“.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FolderOpen,
  Import,
  Link2,
  ListChecks,
  RefreshCw,
  ScanLine,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { DocScanner } from "@/components/admin/doc-scanner";
import { supabase } from "@/integrations/supabase/client";
import {
  aiReviewDocumentItem,
  cancelDocumentRequest,
  createDocumentRequests,
  deleteDocumentItem,
  documentSignedUrl,
  documentsDashboard,
  getDocumentChecklist,
  importLegacyDocumentFiles,
  listDocumentItems,
  listDocumentPickers,
  listDocumentRequests,
  listDocumentRequirements,
  registerDocumentItem,
  resumeDocumentsAutomation,
  reviewDocumentItem,
  runDocumentsAutomation,
  saveDocumentRequirement,
  saveDocumentsSettings,
} from "@/lib/documents.functions";

export const Route = createFileRoute("/admin/documents")({ component: DocumentsAdmin });

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Качен",
  in_review: "За проверка",
  approved: "Одобрен",
  rejected: "Отхвърлен",
  expired: "Изтекъл",
};
const REQ_STATUS: Record<string, string> = {
  pending: "Чака клиента",
  uploaded: "Получен",
  approved: "Одобрен",
  rejected: "Отхвърлен",
  cancelled: "Отменена",
  expired: "Просрочена",
};
const STATE_LABEL: Record<string, string> = {
  missing: "Липсва",
  requested: "Заявен",
  uploaded: "Качен",
  in_review: "За проверка",
  approved: "Одобрен",
  rejected: "Отхвърлен",
  expired: "Изтекъл",
};
const SCOPE_LABEL: Record<string, string> = { client: "Клиент", property: "Имот", deal: "Сделка" };

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");
const d = (v?: string | null) => (v ? new Date(v).toLocaleDateString("bg-BG") : "—");
const kb = (v?: number | null) =>
  v == null ? "—" : `${Math.max(1, Math.round(Number(v) / 1024))} KB`;

function DocumentsAdmin() {
  const [tab, setTab] = useState<
    "docs" | "checklist" | "requests" | "requirements" | "scanner" | "log"
  >("docs");
  const [docs, setDocs] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [cfg, setCfg] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [pickers, setPickers] = useState<{ clients: any[]; properties: any[] }>({
    clients: [],
    properties: [],
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [editReq, setEditReq] = useState<any | null>(null);
  const [view, setView] = useState<any | null>(null);

  // чеклист / заявки
  const [clientId, setClientId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [checklist, setChecklist] = useState<any[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [dd, rq, rr, dash, pk] = await Promise.all([
        listDocumentItems({ data: { status: status || null } }),
        listDocumentRequests({ data: {} }),
        listDocumentRequirements(),
        documentsDashboard(),
        listDocumentPickers(),
      ]);
      setDocs(dd as any[]);
      setRequests(rq as any[]);
      setRequirements(rr as any[]);
      setAnalytics((dash as any).analytics);
      setLog((dash as any).events);
      setCfg((dash as any).settings);
      setJob((dash as any).job);
      setPickers(pk as any);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const loadChecklist = useCallback(async () => {
    if (!clientId && !propertyId) {
      setChecklist([]);
      return;
    }
    try {
      const r = await getDocumentChecklist({
        data: { clientId: clientId || null, propertyId: propertyId || null },
      });
      setChecklist(r as any[]);
      setPicked([]);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [clientId, propertyId]);

  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
      await loadChecklist();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (id: string) => {
    try {
      const r: any = await documentSignedUrl({ data: { id } });
      if (r?.url) window.open(r.url, "_blank", "noopener");
      else toast.error("Няма прикачен файл.");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const uploadFromCrm = async (file: File, requirementCode: string | null) => {
    if (!clientId && !propertyId) return toast.error("Изберете клиент или имот.");
    setBusy(true);
    try {
      const path = `crm/${clientId || propertyId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("crm-documents")
        .upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      await registerDocumentItem({
        data: {
          requirementCode,
          clientId: clientId || null,
          propertyId: propertyId || null,
          fileName: file.name,
          storagePath: path,
          fileSize: file.size,
          mimeType: file.type || null,
        },
      });
      toast.success("Файлът е качен и добавен в регистъра.");
      await load();
      await loadChecklist();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendRequests = async () => {
    if (!picked.length) return toast.error("Изберете поне един документ.");
    setBusy(true);
    try {
      const res: any = await createDocumentRequests({
        data: {
          clientId: clientId || null,
          propertyId: propertyId || null,
          requirementCodes: picked,
          message: message || null,
        },
      });
      const link = res?.requests?.[0]?.link;
      if (link) await navigator.clipboard?.writeText(link).catch(() => {});
      toast.success(`Създадени ${res.created} заявки. Първият линк е копиран.`);
      setMessage("");
      await load();
      await loadChecklist();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-amber-100">
            <FolderOpen className="mr-2 inline h-8 w-8 text-amber-300" />
            Документи — Автоматизация №9
          </h1>
          <p className="mt-1 text-sm text-amber-100/70">
            Събиране на файлове по линк, чеклисти по клиент и имот, AI проверка, срокове на
            валидност и аналитика.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              run(() => runDocumentsAutomation({ data: {} }), "Автоматизацията е изпълнена")
            }
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/30"
          >
            <Zap className="h-4 w-4" />
            Обработи
          </button>
          <button
            onClick={() => run(() => importLegacyDocumentFiles(), "Импортът е завършен")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
          >
            <Import className="h-4 w-4" />
            Импорт от CRM
          </button>
          <button
            onClick={() => setShowCfg(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
          >
            <Settings2 className="h-4 w-4" />
            Настройки
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
          >
            <RefreshCw className="h-4 w-4" />
            Обнови
          </button>
        </div>
      </header>

      {job?.paused && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          <span>Автоматизацията е на пауза: {job.paused_reason ?? "неизвестна причина"}</span>
          <button
            onClick={() => run(() => resumeDocumentsAutomation(), "Възобновена")}
            className="rounded-lg bg-rose-500/30 px-3 py-1.5"
          >
            Възобнови
          </button>
        </div>
      )}

      {analytics && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Общо файлове", analytics.total],
            ["Одобрени", analytics.approved],
            ["За проверка", analytics.pendingReview],
            ["Изтичат скоро", analytics.expiringSoon],
            ["Изтекли", analytics.expired],
            ["% събрани заявки", `${analytics.collectionRate}%`],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-amber-500/20 bg-[rgba(40,8,16,0.55)] p-4"
            >
              <p className="text-xs uppercase tracking-wide text-amber-100/60">{label}</p>
              <p className="mt-1 font-display text-2xl text-amber-100">{value as any}</p>
            </div>
          ))}
        </div>
      )}

      <nav className="flex flex-wrap gap-2">
        {(
          [
            ["docs", "Регистър", FolderOpen],
            ["checklist", "Чеклист", ListChecks],
            ["requests", "Заявки", Link2],
            ["requirements", "Изисквания", ClipboardList],
            ["scanner", "Скенер", ScanLine],
            ["log", "Лог", RefreshCw],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${tab === key ? "bg-amber-500/25 text-amber-50" : "border border-amber-500/25 text-amber-100/80 hover:bg-amber-500/10"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {tab === "docs" && (
        <section className="space-y-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-amber-500/30 bg-[rgba(40,8,16,0.6)] px-3 py-2 text-sm text-amber-100"
          >
            <option value="">Всички статуси</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)]">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[rgba(40,8,16,0.75)] text-left text-amber-100/85">
                <tr>
                  <th className="px-4 py-3">Документ</th>
                  <th className="px-4 py-3">Клиент / Имот</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">AI</th>
                  <th className="px-4 py-3">Валиден до</th>
                  <th className="px-4 py-3">Качен</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((r) => (
                  <tr key={r.id} className="border-t border-[#8B1A2B]/15">
                    <td className="px-4 py-2">
                      <span className="font-semibold">{r.title}</span>
                      <span className="block text-xs opacity-70">
                        {r.file_name} · v{r.version} · {kb(r.file_size)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {r.clients?.full_name ?? "—"}
                      <span className="block opacity-70">{r.properties?.title ?? ""}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-[#8B1A2B]/12 px-2 py-0.5 text-xs">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {r.ai_status === "ok"
                        ? "Проверен"
                        : r.ai_status === "warning"
                          ? "Забележки"
                          : r.ai_status === "failed"
                            ? "Грешка"
                            : r.ai_status === "skipped"
                              ? "—"
                              : "Чака"}
                      {r.ai_confidence != null && (
                        <span className="block opacity-70">{r.ai_confidence}%</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">{d(r.expires_at)}</td>
                    <td className="px-4 py-2 text-xs">{dt(r.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <button onClick={() => setView(r)} className="mr-2 text-xs underline">
                        Детайли
                      </button>
                      <button
                        onClick={() => openFile(r.id)}
                        className="mr-2 inline-flex items-center gap-1 text-xs underline"
                      >
                        <Download className="h-3 w-3" />
                        Файл
                      </button>
                      <button
                        onClick={() =>
                          run(
                            () => aiReviewDocumentItem({ data: { id: r.id } }),
                            "AI проверката е готова",
                          )
                        }
                        className="mr-2 inline-flex items-center gap-1 text-xs underline"
                      >
                        <Sparkles className="h-3 w-3" />
                        AI
                      </button>
                      <button
                        onClick={() =>
                          run(
                            () => reviewDocumentItem({ data: { id: r.id, decision: "approved" } }),
                            "Одобрен",
                          )
                        }
                        className="mr-2 inline-flex items-center gap-1 text-xs underline"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Одобри
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt("Причина за отхвърляне:");
                          if (reason)
                            run(
                              () =>
                                reviewDocumentItem({
                                  data: { id: r.id, decision: "rejected", reason },
                                }),
                              "Отхвърлен",
                            );
                        }}
                        className="mr-2 text-xs underline"
                      >
                        Отхвърли
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Изтриване на документа?"))
                            run(() => deleteDocumentItem({ data: { id: r.id } }), "Изтрит");
                        }}
                        className="text-rose-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!docs.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center opacity-60">
                      Няма документи. Използвайте „Чеклист“, за да поискате файлове.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "checklist" && (
        <section className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-amber-500/20 bg-[rgba(40,8,16,0.55)] p-5 sm:grid-cols-2">
            <label className="block text-xs text-amber-100/70">
              Клиент
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(255,255,255,0.92)] px-3 py-2 text-sm text-[#3d1119]"
              >
                <option value="">— без —</option>
                {pickers.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-amber-100/70">
              Имот
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(255,255,255,0.92)] px-3 py-2 text-sm text-[#3d1119]"
              >
                <option value="">— без —</option>
                {pickers.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-amber-100/70 sm:col-span-2">
              Съобщение към клиента
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                maxLength={600}
                className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(255,255,255,0.92)] px-3 py-2 text-sm text-[#3d1119]"
                placeholder="Моля, качете следните документи за подготовка на сделката."
              />
            </label>
            <div className="sm:col-span-2">
              <button
                onClick={sendRequests}
                disabled={busy || !picked.length}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500/25 px-4 py-2 text-sm text-amber-50 disabled:opacity-50"
              >
                <Link2 className="h-4 w-4" />
                Изпрати заявка ({picked.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)]">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[rgba(40,8,16,0.75)] text-left text-amber-100/85">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3">Документ</th>
                  <th className="px-4 py-3">Обхват</th>
                  <th className="px-4 py-3">Състояние</th>
                  <th className="px-4 py-3">Версии</th>
                  <th className="px-4 py-3">Валиден до</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {checklist.map((row) => (
                  <tr key={row.requirement.id} className="border-t border-[#8B1A2B]/15">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={picked.includes(row.requirement.code)}
                        onChange={(e) =>
                          setPicked((p) =>
                            e.target.checked
                              ? [...p, row.requirement.code]
                              : p.filter((c) => c !== row.requirement.code),
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-semibold">{row.requirement.name}</span>
                      {row.requirement.is_required && (
                        <span className="ml-2 text-xs text-rose-700">задължителен</span>
                      )}
                      <span className="block text-xs opacity-70">
                        {row.requirement.description ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {SCOPE_LABEL[row.requirement.scope] ?? row.requirement.scope}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-[#8B1A2B]/12 px-2 py-0.5 text-xs">
                        {STATE_LABEL[row.state] ?? row.state}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">{row.versions}</td>
                    <td className="px-4 py-2 text-xs">{d(row.document?.expires_at)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <label className="mr-2 inline-flex cursor-pointer items-center gap-1 text-xs underline">
                        <Upload className="h-3 w-3" />
                        Качи
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadFromCrm(f, row.requirement.code);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {row.document && (
                        <button
                          onClick={() => openFile(row.document.id)}
                          className="text-xs underline"
                        >
                          Отвори
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!checklist.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center opacity-60">
                      Изберете клиент или имот, за да видите чеклиста.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "requests" && (
        <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)]">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-[rgba(40,8,16,0.75)] text-left text-amber-100/85">
              <tr>
                <th className="px-4 py-3">Документ</th>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Срок</th>
                <th className="px-4 py-3">Напомняния</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-[#8B1A2B]/15">
                  <td className="px-4 py-2">
                    <span className="font-semibold">{r.requirement_name}</span>
                    <span className="block text-xs opacity-70">{r.properties?.title ?? ""}</span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.clients?.full_name ?? "—"}
                    <span className="block opacity-70">
                      {r.clients?.phone ?? r.clients?.email ?? ""}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-[#8B1A2B]/12 px-2 py-0.5 text-xs">
                      {REQ_STATUS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">{d(r.due_at)}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.reminders_sent} · {dt(r.last_reminder_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(r.link);
                        toast.success("Линкът е копиран.");
                      }}
                      className="mr-2 text-xs underline"
                    >
                      Копирай линк
                    </button>
                    {!["cancelled", "approved"].includes(r.status) && (
                      <button
                        onClick={() =>
                          run(
                            () => cancelDocumentRequest({ data: { id: r.id } }),
                            "Заявката е отменена",
                          )
                        }
                        className="text-xs underline"
                      >
                        Отмени
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!requests.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center opacity-60">
                    Няма заявки.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "requirements" && (
        <section className="space-y-3">
          <button
            onClick={() =>
              setEditReq({
                scope: "client",
                category: "sale",
                is_required: true,
                ai_check: true,
                is_active: true,
                sort_order: 100,
              })
            }
            className="rounded-lg bg-amber-500/25 px-4 py-2 text-sm text-amber-50"
          >
            + Ново изискване
          </button>
          <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)]">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[rgba(40,8,16,0.75)] text-left text-amber-100/85">
                <tr>
                  <th className="px-4 py-3">Име</th>
                  <th className="px-4 py-3">Код</th>
                  <th className="px-4 py-3">Обхват</th>
                  <th className="px-4 py-3">Категория</th>
                  <th className="px-4 py-3">Валидност</th>
                  <th className="px-4 py-3">Активно</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {requirements.map((r) => (
                  <tr key={r.id} className="border-t border-[#8B1A2B]/15">
                    <td className="px-4 py-2">
                      <span className="font-semibold">{r.name}</span>
                      <span className="block text-xs opacity-70">{r.description ?? ""}</span>
                    </td>
                    <td className="px-4 py-2 text-xs">{r.code}</td>
                    <td className="px-4 py-2 text-xs">{SCOPE_LABEL[r.scope] ?? r.scope}</td>
                    <td className="px-4 py-2 text-xs">{r.category}</td>
                    <td className="px-4 py-2 text-xs">
                      {r.valid_months ? `${r.valid_months} мес.` : "безсрочен"}
                    </td>
                    <td className="px-4 py-2 text-xs">{r.is_active ? "да" : "не"}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => setEditReq(r)} className="text-xs underline">
                        Редакция
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "scanner" && (
        <section className="rounded-xl border border-amber-500/20 bg-[rgba(40,8,16,0.4)] p-2">
          <DocScanner />
        </section>
      )}

      {tab === "log" && (
        <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-[rgba(40,8,16,0.75)] text-left text-amber-100/85">
              <tr>
                <th className="px-4 py-3">Кога</th>
                <th className="px-4 py-3">Действие</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Съобщение</th>
                <th className="px-4 py-3">Автор</th>
              </tr>
            </thead>
            <tbody>
              {log.map((r) => (
                <tr key={r.id} className="border-t border-[#8B1A2B]/15">
                  <td className="px-4 py-2 text-xs">{dt(r.created_at)}</td>
                  <td className="px-4 py-2 text-xs">{r.action}</td>
                  <td className="px-4 py-2 text-xs">{r.status}</td>
                  <td className="px-4 py-2 text-xs">{r.message ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{r.actor}</td>
                </tr>
              ))}
              {!log.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center opacity-60">
                    Няма записи.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
          onClick={() => setView(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-amber-500/25 bg-[#fffdf8] p-6 text-[#3d1119]"
            onClick={(e) => e.stopPropagation()}
            data-task-dialog
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-[#8B1A2B]">{view.title}</h2>
                <p className="text-xs opacity-70">
                  {view.file_name} · v{view.version} · {kb(view.file_size)} ·{" "}
                  {STATUS_LABEL[view.status] ?? view.status}
                </p>
              </div>
              <button onClick={() => setView(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs opacity-70">Клиент</dt>
                <dd>{view.clients?.full_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs opacity-70">Имот</dt>
                <dd>{view.properties?.title ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs opacity-70">Издаден</dt>
                <dd>{d(view.issued_at)}</dd>
              </div>
              <div>
                <dt className="text-xs opacity-70">Валиден до</dt>
                <dd>{d(view.expires_at)}</dd>
              </div>
              <div>
                <dt className="text-xs opacity-70">Източник</dt>
                <dd>{view.source}</dd>
              </div>
              <div>
                <dt className="text-xs opacity-70">AI увереност</dt>
                <dd>{view.ai_confidence != null ? `${view.ai_confidence}%` : "—"}</dd>
              </div>
            </dl>
            {view.ai_summary && (
              <p className="mt-3 rounded-lg bg-[#8B1A2B]/8 p-3 text-sm">{view.ai_summary}</p>
            )}
            {Array.isArray(view.ai_fields?.issues) && view.ai_fields.issues.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm text-rose-700">
                {view.ai_fields.issues.map((i: string, k: number) => (
                  <li key={k}>{i}</li>
                ))}
              </ul>
            )}
            {view.rejected_reason && (
              <p className="mt-2 text-sm text-rose-700">Отхвърлен: {view.rejected_reason}</p>
            )}
            <button
              onClick={() => openFile(view.id)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#8B1A2B] px-4 py-2 text-sm text-white"
            >
              <Download className="h-4 w-4" />
              Отвори файла
            </button>
          </div>
        </div>
      )}

      {editReq && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
          onClick={() => setEditReq(null)}
        >
          <div
            className="w-full max-w-xl space-y-3 rounded-2xl border border-amber-500/25 bg-[#fffdf8] p-6 text-[#3d1119]"
            onClick={(e) => e.stopPropagation()}
            data-task-dialog
          >
            <h2 className="font-display text-2xl text-[#8B1A2B]">
              {editReq.id ? "Редакция" : "Ново"} изискване
            </h2>
            {(
              [
                ["name", "Име"],
                ["code", "Код"],
                ["description", "Описание"],
                ["category", "Категория"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="block text-xs opacity-80">
                {label}
                <input
                  value={editReq[field] ?? ""}
                  onChange={(e) => setEditReq({ ...editReq, [field]: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#8B1A2B]/30 bg-white px-3 py-2 text-sm"
                />
              </label>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs opacity-80">
                Обхват
                <select
                  value={editReq.scope}
                  onChange={(e) => setEditReq({ ...editReq, scope: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#8B1A2B]/30 bg-white px-3 py-2 text-sm"
                >
                  {Object.entries(SCOPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs opacity-80">
                Валидност (месеци)
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={editReq.valid_months ?? ""}
                  onChange={(e) =>
                    setEditReq({
                      ...editReq,
                      valid_months: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-[#8B1A2B]/30 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              {(
                [
                  ["is_required", "Задължителен"],
                  ["ai_check", "AI проверка"],
                  ["is_active", "Активно"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(editReq[field])}
                    onChange={(e) => setEditReq({ ...editReq, [field]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const {
                    id,
                    code,
                    name,
                    description,
                    scope,
                    category,
                    is_required,
                    ai_check,
                    valid_months,
                    is_active,
                    sort_order,
                  } = editReq;
                  await saveDocumentRequirement({
                    data: {
                      id: id ?? null,
                      code,
                      name,
                      description,
                      scope,
                      category,
                      is_required,
                      ai_check,
                      valid_months,
                      is_active,
                      sort_order,
                    },
                  });
                  setEditReq(null);
                }, "Записано")
              }
              className="rounded-lg bg-[#8B1A2B] px-4 py-2 text-sm text-white"
            >
              Запиши
            </button>
          </div>
        </div>
      )}

      {showCfg && cfg && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
          onClick={() => setShowCfg(false)}
        >
          <div
            className="w-full max-w-xl space-y-3 rounded-2xl border border-amber-500/25 bg-[#fffdf8] p-6 text-[#3d1119]"
            onClick={(e) => e.stopPropagation()}
            data-task-dialog
          >
            <h2 className="font-display text-2xl text-[#8B1A2B]">Настройки на автоматизацията</h2>
            <div className="flex flex-wrap gap-4 text-sm">
              {(
                [
                  ["enabled", "Включена"],
                  ["ai_enabled", "AI проверка"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(cfg[field])}
                    onChange={(e) => setCfg({ ...cfg, [field]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["batch_size", "Партида"],
                  ["due_days", "Срок (дни)"],
                  ["reminder_days", "Напомняне на (дни)"],
                  ["max_reminders", "Макс. напомняния"],
                  ["expiry_warning_days", "Предупреждение преди (дни)"],
                  ["max_file_mb", "Макс. размер (MB)"],
                  ["auto_approve_confidence", "Авто-одобрение при увереност %"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="block text-xs opacity-80">
                  {label}
                  <input
                    type="number"
                    value={cfg[field] ?? 0}
                    onChange={(e) => setCfg({ ...cfg, [field]: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-[#8B1A2B]/30 bg-white px-3 py-2 text-sm"
                  />
                </label>
              ))}
            </div>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const {
                    enabled,
                    ai_enabled,
                    batch_size,
                    due_days,
                    reminder_days,
                    max_reminders,
                    expiry_warning_days,
                    max_file_mb,
                    auto_approve_confidence,
                  } = cfg;
                  await saveDocumentsSettings({
                    data: {
                      enabled,
                      ai_enabled,
                      batch_size,
                      due_days,
                      reminder_days,
                      max_reminders,
                      expiry_warning_days,
                      max_file_mb,
                      auto_approve_confidence,
                    },
                  });
                  setShowCfg(false);
                }, "Настройките са записани")
              }
              className="rounded-lg bg-[#8B1A2B] px-4 py-2 text-sm text-white"
            >
              Запиши
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
