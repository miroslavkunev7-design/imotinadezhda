import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  Eye,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { addClientDocument, deleteClientDocument, getClientDocuments } from "@/lib/crm.functions";
import { checkDocumentMonth } from "@/lib/mortgage-docs.functions";
import {
  MORTGAGE_DOC_REQS,
  lastTwelveMonths,
  monthLabel,
  mortgageDocType,
  type MortgageDocReq,
} from "@/lib/mortgage-docs";

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Файлът не можа да бъде прочетен"));
    fr.readAsDataURL(file);
  });
}

/**
 * Забоденото листче с документите по ипотечния кредит: номерирани изисквания,
 * прикачване на файлове, зелено кръгче при качен документ и подпрозорче с
 * 12-те месеца за фишовете и банковите извлечения.
 */
export function MortgageDocsModal({
  client,
  onClose,
  onChanged,
}: {
  client: any;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [openReq, setOpenReq] = useState<MortgageDocReq | null>(null);
  const pending = useRef<{ req: MortgageDocReq; month?: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const months = useMemo(() => lastTwelveMonths(), []);

  const reload = useCallback(async () => {
    const rows = await getClientDocuments({ data: { client_id: client.id } });
    setDocs(rows ?? []);
  }, [client.id]);

  useEffect(() => {
    void (async () => {
      try {
        await reload();
      } catch (e: any) {
        toast.error(e?.message ?? "Грешка при зареждане");
      } finally {
        setLoading(false);
      }
    })();
  }, [reload]);

  const docsFor = (reqId: string, month?: string) =>
    docs.filter((d) => d.document_type === mortgageDocType(reqId, month));

  const monthsDone = (reqId: string) =>
    months.filter((m) => docsFor(reqId, m.key).length > 0).length;

  const reqDone = (req: MortgageDocReq) =>
    req.kind === "monthly" ? monthsDone(req.id) === months.length : docsFor(req.id).length > 0;

  const doneCount = MORTGAGE_DOC_REQS.filter(reqDone).length;

  const pickFile = (req: MortgageDocReq, month?: string) => {
    pending.current = { req, month };
    if (fileInput.current) {
      fileInput.current.value = "";
      fileInput.current.click();
    }
  };

  const handleFile = async (file: File) => {
    const target = pending.current;
    pending.current = null;
    if (!target) return;
    const { req, month } = target;
    const key = mortgageDocType(req.id, month);
    setBusyKey(key);
    try {
      // 1) AI проверка на месеца — при разминаване не качваме.
      if (req.monthCheck && month) {
        if (file.size <= 12_000_000) {
          const dataUrl = await toDataUrl(file);
          const check = await checkDocumentMonth({
            data: {
              file_data: dataUrl,
              expected_month: month,
              kind: req.id === "bank_statement" ? "bank_statement" : "payslip",
              file_name: file.name,
            },
          });
          if (!check.ok && check.month) {
            toast.error(
              `Качили сте грешен документ — той е за ${monthLabel(check.month)}, а графата е за ${monthLabel(month)}.`,
            );
            return;
          }
          if (check.skipped)
            toast.message("Месецът не беше разчетен автоматично — качено без проверка.");
        } else {
          toast.message("Файлът е голям — качен без автоматична проверка на месеца.");
        }
      }

      // 2) Качване в частното хранилище + запис.
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${client.id}/${key.replace(/:/g, "_")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("client-documents")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { data: signed } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      await addClientDocument({
        data: {
          client_id: client.id,
          document_type: key,
          file_url: signed?.signedUrl ?? path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
        },
      });
      await reload();
      onChanged?.();
      toast.success("Документът е прикачен.");
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при качване");
    } finally {
      setBusyKey(null);
    }
  };

  const removeDoc = async (id: string) => {
    if (!confirm("Да изтрия ли документа?")) return;
    try {
      await deleteClientDocument({ data: { id } });
      await reload();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    }
  };

  const bank = client?.mortgage_data?.bank;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[#8B1A2B]/55 p-3 pb-24 sm:pb-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-[6px] border border-amber-500/40 bg-[#fdf6dc] shadow-2xl"
        style={{ boxShadow: "0 22px 60px rgba(0,0,0,.45)" }}
      >
        {/* Забоденото листче — заглавие */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-amber-700/20 bg-[#f7e9b8] px-4 py-3">
          <div className="flex items-start gap-2">
            {openReq && (
              <button
                type="button"
                onClick={() => setOpenReq(null)}
                className="mt-0.5 text-[#7a1226]"
                aria-label="Назад"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <div className="font-display text-lg text-[#7a1226]">
                {openReq ? openReq.label : "Документи за кредита"}
              </div>
              <div className="text-[11px] text-[#7a1226]/70">
                {client.full_name}
                {bank ? ` · ${bank}` : ""}
                {!openReq ? ` · ${doneCount}/${MORTGAGE_DOC_REQS.length} готови` : ""}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Затвори" className="text-[#7a1226]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-[#7a1226]/70">
              <Loader2 className="h-4 w-4 animate-spin" /> Зареждане…
            </div>
          )}

          {/* СПИСЪК С ИЗИСКВАНИЯТА */}
          {!loading &&
            !openReq &&
            MORTGAGE_DOC_REQS.map((req, idx) => {
              const done = reqDone(req);
              const single = docsFor(req.id)[0];
              const busy = busyKey === mortgageDocType(req.id);
              return (
                <div
                  key={req.id}
                  className={`rounded-lg border px-3 py-2.5 ${done ? "border-emerald-600/40 bg-emerald-500/10" : "border-[#7a1226]/20 bg-white/60"}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold ${
                        done ? "bg-emerald-600 text-white" : "bg-[#7a1226]/10 text-[#7a1226]"
                      }`}
                    >
                      {done ? <Check className="h-4 w-4" /> : idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[#3d0a15]">
                        {idx + 1}. {req.label}
                      </div>
                      <div className="text-[11px] text-[#7a1226]/70">
                        {req.kind === "monthly"
                          ? `${monthsDone(req.id)}/12 месеца прикачени`
                          : single
                            ? single.file_name
                            : (req.hint ?? "Няма прикачен файл")}
                      </div>
                    </div>

                    {req.kind === "monthly" ? (
                      <button
                        type="button"
                        onClick={() => setOpenReq(req)}
                        className="flex flex-none items-center gap-1 rounded-md bg-[#7a1226] px-2.5 py-1.5 text-[11px] font-semibold text-amber-50"
                      >
                        <Paperclip className="h-3.5 w-3.5" /> Отвори
                      </button>
                    ) : single ? (
                      <div className="flex flex-none items-center gap-1">
                        <a
                          href={single.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md bg-emerald-600 p-1.5 text-white"
                          title="Виж документа"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => pickFile(req)}
                          className="rounded-md bg-[#7a1226]/10 p-1.5 text-[#7a1226]"
                          title="Прикачи още / замени"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDoc(single.id)}
                          className="rounded-md bg-[#7a1226]/10 p-1.5 text-[#7a1226]"
                          title="Изтрий"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => pickFile(req)}
                        className="flex flex-none items-center gap-1 rounded-md bg-[#7a1226] px-2.5 py-1.5 text-[11px] font-semibold text-amber-50 disabled:opacity-60"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Качи
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          {/* ПОДПРОЗОРЧЕ: 12 МЕСЕЦА */}
          {!loading && openReq && (
            <div className="space-y-2">
              <p className="text-[11px] text-[#7a1226]/75">
                Графите са изчислени от текущия месец 12 месеца назад. При качване се проверява за
                кой месец е документът.
              </p>
              {months.map((m, i) => {
                const list = docsFor(openReq.id, m.key);
                const has = list.length > 0;
                const busy = busyKey === mortgageDocType(openReq.id, m.key);
                return (
                  <div
                    key={m.key}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                      has
                        ? "border-emerald-600/45 bg-emerald-500/10"
                        : "border-[#7a1226]/20 bg-white/60"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold ${
                        has ? "bg-emerald-600 text-white" : "bg-[#7a1226]/10 text-[#7a1226]"
                      }`}
                    >
                      {has ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#3d0a15]">{m.label}</div>
                      {has && (
                        <div className="truncate text-[11px] text-[#7a1226]/70">
                          {list[0].file_name}
                        </div>
                      )}
                    </div>
                    {has ? (
                      <div className="flex flex-none items-center gap-1">
                        <a
                          href={list[0].file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold text-white"
                          title="Виж прикачения документ"
                        >
                          <Eye className="h-3.5 w-3.5" /> Виж
                        </a>
                        <button
                          type="button"
                          onClick={() => pickFile(openReq, m.key)}
                          className="rounded-md bg-[#7a1226]/10 p-1.5 text-[#7a1226]"
                          title="Прикачи отново"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDoc(list[0].id)}
                          className="rounded-md bg-[#7a1226]/10 p-1.5 text-[#7a1226]"
                          title="Изтрий"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => pickFile(openReq, m.key)}
                        className="flex flex-none items-center gap-1 rounded-md bg-[#7a1226] px-2.5 py-1.5 text-[11px] font-semibold text-amber-50 disabled:opacity-60"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Качи файл
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-amber-700/20 bg-[#f7e9b8] px-4 py-2.5">
          <span className="flex items-center gap-1 text-[11px] text-[#7a1226]/75">
            <FileText className="h-3.5 w-3.5" /> Файловете се пазят в защитеното хранилище на
            клиента.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-[#7a1226] px-3 py-1.5 text-xs font-semibold text-amber-50"
          >
            Готово
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </div>
    </div>
  );
}
