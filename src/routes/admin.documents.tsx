// Автоматизация №9 — CRM модул „Управление на документи“.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FolderOpen,
  Import,
  Eye,
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
import {
  documentAccept,
  safeDocumentFileName,
  validateDocumentUpload,
} from "@/lib/document-upload";
import documentSendBrush from "@/assets/mobile-opa/document-send-brush.png";

export const Route = createFileRoute("/admin/documents")({
  validateSearch: (search) =>
    z.object({ deal: z.string().uuid().optional() }).parse(search),
  component: DocumentsAdmin,
});

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
  const routeSearch = Route.useSearch();
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
  const [pickers, setPickers] = useState<{ clients: any[]; properties: any[]; deals: any[] }>({
    clients: [],
    properties: [],
    deals: [],
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const [editReq, setEditReq] = useState<any | null>(null);
  const [view, setView] = useState<any | null>(null);
  const [preview, setPreview] = useState<{ url: string; document: any } | null>(null);

  // чеклист / заявки
  const [clientId, setClientId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [dealId, setDealId] = useState(routeSearch.deal ?? "");
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

  useEffect(() => {
    if (!dealId) return;
    const deal = pickers.deals.find((candidate) => candidate.id === dealId);
    if (!deal) return;
    setClientId(deal.client_id ?? "");
    setPropertyId(deal.property_id ?? "");
  }, [dealId, pickers.deals]);

  const loadChecklist = useCallback(async () => {
    if (!clientId && !propertyId && !dealId) {
      setChecklist([]);
      return;
    }
    try {
      const r = await getDocumentChecklist({
        data: {
          clientId: clientId || null,
          propertyId: propertyId || null,
          dealId: dealId || null,
        },
      });
      setChecklist(r as any[]);
      setPicked([]);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [clientId, dealId, propertyId]);

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

  const previewFile = async (document: any) => {
    try {
      const r: any = await documentSignedUrl({ data: { id: document.id } });
      if (r?.url) setPreview({ url: r.url, document });
      else toast.error("Няма прикачен файл.");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const downloadFile = async (document: any) => {
    try {
      const r: any = await documentSignedUrl({ data: { id: document.id, download: true } });
      if (!r?.url) throw new Error("Няма прикачен файл.");
      const anchor = window.document.createElement("a");
      anchor.href = r.url;
      anchor.download = document.file_name || "document";
      anchor.rel = "noopener";
      anchor.click();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const uploadFromCrm = async (
    file: File,
    requirementCode: string | null,
    acceptedTypes?: string | null,
  ) => {
    if (!clientId && !propertyId && !dealId)
      return toast.error("Изберете клиент, имот или сделка.");
    const validationError = validateDocumentUpload(file, Number(cfg?.max_file_mb ?? 0), acceptedTypes);
    if (validationError) return toast.error(validationError);
    setBusy(true);
    let path: string | null = null;
    try {
      path = `crm/${dealId || clientId || propertyId}/${crypto.randomUUID()}-${safeDocumentFileName(file.name)}`;
      const { error } = await supabase.storage
        .from("crm-documents")
        .upload(path, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      await registerDocumentItem({
        data: {
          requirementCode,
          clientId: clientId || null,
          propertyId: propertyId || null,
          dealId: dealId || null,
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
      if (path) await supabase.storage.from("crm-documents").remove([path]).catch(() => {});
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
          dealId: dealId || null,
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

          <div className="space-y-3 md:hidden">
            {docs.map((document) => (
              <article
                key={document.id}
                className="rounded-2xl border border-amber-500/20 bg-[rgba(255,253,248,0.96)] p-4 text-[#3d1119] shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-sm font-bold">{document.title}</h2>
                    <p className="mt-1 truncate text-xs opacity-65">
                      {document.file_name} · v{document.version} · {kb(document.file_size)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#8b1a2b]/10 px-2 py-1 text-[10px] font-bold text-[#8b1a2b]">
                    {STATUS_LABEL[document.status] ?? document.status}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-[#8b1a2b]/5 p-3 text-xs">
                  <div>
                    <dt className="opacity-55">Клиент</dt>
                    <dd className="truncate font-semibold">{document.clients?.full_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="opacity-55">Имот</dt>
                    <dd className="truncate font-semibold">{document.properties?.title ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="opacity-55">Сделка</dt>
                    <dd className="truncate font-semibold">{document.deals?.title ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="opacity-55">Валиден до</dt>
                    <dd>{d(document.expires_at)}</dd>
                  </div>
                  <div>
                    <dt className="opacity-55">AI статус</dt>
                    <dd>{document.ai_status ?? "—"}</dd>
                  </div>
                </dl>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => previewFile(document)} className="flex items-center justify-center gap-1 rounded-lg border border-[#8b1a2b]/20 py-2 text-[11px] font-semibold">
                    <Eye className="h-3.5 w-3.5" /> Преглед
                  </button>
                  <button type="button" onClick={() => downloadFile(document)} className="flex items-center justify-center gap-1 rounded-lg border border-[#8b1a2b]/20 py-2 text-[11px] font-semibold">
                    <Download className="h-3.5 w-3.5" /> Изтегли
                  </button>
                  <button type="button" onClick={() => setView(document)} className="rounded-lg border border-[#8b1a2b]/20 py-2 text-[11px] font-semibold">
                    Детайли
                  </button>
                  <button
                    type="button"
                    onClick={() => run(() => aiReviewDocumentItem({ data: { id: document.id } }), "AI проверката е готова")}
                    disabled={busy}
                    className="flex items-center justify-center gap-1 rounded-lg border border-[#8b1a2b]/20 py-2 text-[11px] font-semibold disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> AI
                  </button>
                  <button
                    type="button"
                    onClick={() => run(() => reviewDocumentItem({ data: { id: document.id, decision: "approved" } }), "Одобрен")}
                    disabled={busy}
                    className="flex items-center justify-center gap-1 rounded-lg bg-emerald-700 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Одобри
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Изтриване на документа?"))
                        run(() => deleteDocumentItem({ data: { id: document.id } }), "Изтрит");
                    }}
                    disabled={busy}
                    className="flex items-center justify-center gap-1 rounded-lg border border-rose-300 py-2 text-[11px] font-semibold text-rose-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Изтрий
                  </button>
                </div>
              </article>
            ))}
            {!docs.length ? (
              <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,253,248,0.96)] p-8 text-center text-sm text-[#3d1119]/60">
                Няма документи. Използвайте „Чеклист“, за да поискате или качите файлове.
              </div>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)] md:block">
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
                      <span className="block opacity-70">{r.deals?.title ?? ""}</span>
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
                        onClick={() => previewFile(r)}
                        className="mr-2 inline-flex items-center gap-1 text-xs underline"
                      >
                        <Eye className="h-3 w-3" />
                        Преглед
                      </button>
                      <button
                        onClick={() => downloadFile(r)}
                        className="mr-2 inline-flex items-center gap-1 text-xs underline"
                      >
                        <Download className="h-3 w-3" />
                        Изтегли
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
                onChange={(e) => {
                  setClientId(e.target.value);
                  setDealId("");
                }}
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
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setDealId("");
                }}
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
              Сделка
              <select
                value={dealId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  const deal = pickers.deals.find((candidate) => candidate.id === nextId);
                  setDealId(nextId);
                  if (deal) {
                    setClientId(deal.client_id ?? "");
                    setPropertyId(deal.property_id ?? "");
                  }
                }}
                className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(255,255,255,0.92)] px-3 py-2 text-sm text-[#3d1119]"
              >
                <option value="">— без —</option>
                {pickers.deals.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {deal.deal_number ? `${deal.deal_number} · ` : ""}{deal.title}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[10px] text-amber-100/55">
                Изборът на сделка свързва автоматично нейния клиент и имот.
              </span>
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
                type="button"
                onClick={sendRequests}
                disabled={busy || !picked.length}
                className="w-full disabled:opacity-50 md:hidden"
              >
                <img src={documentSendBrush} alt={`Изпрати документите (${picked.length})`} className="mx-auto h-14 w-full max-w-md object-contain" />
              </button>
              <button
                onClick={sendRequests}
                disabled={busy || !picked.length}
                className="hidden items-center gap-2 rounded-lg bg-amber-500/25 px-4 py-2 text-sm text-amber-50 disabled:opacity-50 md:inline-flex"
              >
                <Link2 className="h-4 w-4" />
                Изпрати заявка ({picked.length})
              </button>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {checklist.map((row) => (
              <article key={row.requirement.id} className="rounded-2xl border border-amber-500/20 bg-[rgba(255,253,248,0.96)] p-4 text-[#3d1119] shadow-lg">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Избери ${row.requirement.name}`}
                    checked={picked.includes(row.requirement.code)}
                    onChange={(event) =>
                      setPicked((current) =>
                        event.target.checked
                          ? [...current, row.requirement.code]
                          : current.filter((code) => code !== row.requirement.code),
                      )
                    }
                    className="mt-1 h-5 w-5 accent-[#8b1a2b]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-sm font-bold">{row.requirement.name}</h2>
                      <span className="shrink-0 rounded-full bg-[#8b1a2b]/10 px-2 py-1 text-[10px] font-bold text-[#8b1a2b]">
                        {STATE_LABEL[row.state] ?? row.state}
                      </span>
                    </div>
                    {row.requirement.description ? <p className="mt-1 text-xs opacity-65">{row.requirement.description}</p> : null}
                    <p className="mt-2 text-xs opacity-65">
                      {SCOPE_LABEL[row.requirement.scope] ?? row.requirement.scope} · {row.versions} версии · валиден до {d(row.document?.expires_at)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#8b1a2b]/10 pt-3">
                  <label className="flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#8b1a2b] py-2.5 text-xs font-semibold text-white">
                    <Upload className="h-3.5 w-3.5" /> Качи файл
                    <input
                      type="file"
                      accept={documentAccept(row.requirement.accepted_types)}
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file)
                          uploadFromCrm(
                            file,
                            row.requirement.code,
                            row.requirement.accepted_types,
                          );
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {row.document ? (
                    <button type="button" onClick={() => previewFile(row.document)} className="flex items-center justify-center gap-1 rounded-lg border border-[#8b1a2b]/20 py-2.5 text-xs font-semibold">
                      <Eye className="h-3.5 w-3.5" /> Преглед
                    </button>
                  ) : (
                    <button type="button" disabled className="rounded-lg border border-[#8b1a2b]/10 py-2.5 text-xs opacity-45">
                      Няма файл
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!checklist.length ? (
              <div className="rounded-2xl border border-amber-500/20 bg-[rgba(255,253,248,0.96)] p-8 text-center text-sm text-[#3d1119]/60">
                Изберете клиент или имот, за да видите чеклиста.
              </div>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)] md:block">
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
                          accept={documentAccept(row.requirement.accepted_types)}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f)
                              uploadFromCrm(
                                f,
                                row.requirement.code,
                                row.requirement.accepted_types,
                              );
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      {row.document && (
                        <button
                          onClick={() => previewFile(row.document)}
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
        <>
        <div className="space-y-3 md:hidden">
          {requests.map((request) => (
            <article key={request.id} className="rounded-2xl border border-amber-500/20 bg-[rgba(255,253,248,0.96)] p-4 text-[#3d1119] shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold">{request.requirement_name}</h2>
                  <p className="mt-1 truncate text-xs opacity-65">
                    {request.clients?.full_name ?? "Без клиент"}{request.properties?.title ? ` · ${request.properties.title}` : ""}{request.deals?.title ? ` · ${request.deals.title}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#8b1a2b]/10 px-2 py-1 text-[10px] font-bold text-[#8b1a2b]">
                  {REQ_STATUS[request.status] ?? request.status}
                </span>
              </div>
              <p className="mt-3 text-xs opacity-65">
                Срок: {d(request.due_at)} · Напомняния: {request.reminders_sent}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(request.link);
                      toast.success("Линкът е копиран.");
                    } catch {
                      toast.error("Линкът не можа да бъде копиран.");
                    }
                  }}
                  className="flex items-center justify-center gap-1 rounded-lg border border-[#8b1a2b]/20 py-2.5 text-xs font-semibold"
                >
                  <Link2 className="h-3.5 w-3.5" /> Копирай линк
                </button>
                {!["cancelled", "approved"].includes(request.status) ? (
                  <button
                    type="button"
                    onClick={() => run(() => cancelDocumentRequest({ data: { id: request.id } }), "Заявката е отменена")}
                    disabled={busy}
                    className="rounded-lg border border-rose-300 py-2.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                  >
                    Отмени
                  </button>
                ) : (
                  <button type="button" disabled className="rounded-lg border border-[#8b1a2b]/10 py-2.5 text-xs opacity-45">
                    Приключена
                  </button>
                )}
              </div>
            </article>
          ))}
          {!requests.length ? <div className="rounded-2xl bg-white/90 p-8 text-center text-sm text-[#3d1119]/60">Няма заявки.</div> : null}
        </div>
        <div className="hidden overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)] md:block">
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
                    <span className="block opacity-70">{r.deals?.title ?? ""}</span>
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
        </>
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
          <div className="space-y-3 md:hidden">
            {requirements.map((requirement) => (
              <article key={requirement.id} className="rounded-2xl border border-amber-500/20 bg-[rgba(255,253,248,0.96)] p-4 text-[#3d1119] shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold">{requirement.name}</h2>
                    <p className="mt-1 text-xs opacity-65">{requirement.description || requirement.code}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${requirement.is_active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                    {requirement.is_active ? "Активно" : "Неактивно"}
                  </span>
                </div>
                <p className="mt-3 text-xs opacity-65">
                  {SCOPE_LABEL[requirement.scope] ?? requirement.scope} · {requirement.category} · {requirement.valid_months ? `${requirement.valid_months} мес.` : "безсрочен"}
                </p>
                <button type="button" onClick={() => setEditReq(requirement)} className="mt-3 w-full rounded-lg border border-[#8b1a2b]/20 py-2.5 text-xs font-semibold">
                  Редакция
                </button>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)] md:block">
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
        <>
        <div className="space-y-3 md:hidden">
          {log.map((event) => (
            <article key={event.id} className="rounded-2xl border border-amber-500/20 bg-[rgba(255,253,248,0.96)] p-4 text-xs text-[#3d1119] shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <strong>{event.action}</strong>
                <span className="opacity-60">{dt(event.created_at)}</span>
              </div>
              <p className="mt-2">{event.message ?? "—"}</p>
              <p className="mt-2 opacity-60">{event.status} · {event.actor}</p>
            </article>
          ))}
          {!log.length ? <div className="rounded-2xl bg-white/90 p-8 text-center text-sm text-[#3d1119]/60">Няма записи.</div> : null}
        </div>
        <div className="hidden overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)] md:block">
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
        </>
      )}

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Преглед на ${preview.document.file_name}`}
          className="fixed inset-0 z-[90] flex flex-col bg-black/90 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-center justify-between gap-3 py-2 text-white">
            <p className="min-w-0 truncate text-sm font-semibold">{preview.document.file_name}</p>
            <button type="button" onClick={() => setPreview(null)} aria-label="Затвори прегледа" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-white">
            {String(preview.document.mime_type ?? "").startsWith("image/") ? (
              <img src={preview.url} alt={preview.document.title} className="h-full w-full object-contain" />
            ) : preview.document.mime_type === "application/pdf" || /\.pdf$/i.test(preview.document.file_name ?? "") ? (
              <iframe title={preview.document.file_name} src={preview.url} className="h-full w-full border-0" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center text-[#3d1119]">
                <FolderOpen className="h-14 w-14 text-[#8b1a2b]" />
                <p>Този формат се отваря чрез изтегляне.</p>
              </div>
            )}
          </div>
          <button type="button" onClick={() => downloadFile(preview.document)} className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-[#3d1119]">
            <Download className="h-4 w-4" /> Изтегли файла
          </button>
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
                <dt className="text-xs opacity-70">Сделка</dt>
                <dd>{view.deals?.title ?? "—"}</dd>
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
              onClick={() => previewFile(view)}
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
