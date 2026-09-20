// Автоматизация №8 — CRM модул „Генериране на договори“.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FileSignature,
  FileText,
  Layers,
  ListChecks,
  Printer,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  deleteGeneratedContract,
  enqueueContractJob,
  generateContractNow,
  getContractsAnalytics,
  getContractsConfig,
  listContractEvents,
  listContractPickers,
  listContractQueue,
  listContractTemplates,
  listGeneratedContracts,
  markContractSignedManually,
  previewContractTemplate,
  resumeContractsJob,
  runContractsQueueNow,
  saveContractTemplate,
  saveContractsConfig,
  sendContractForSignature,
  voidContractDoc,
} from "@/lib/contracts.functions";

export const Route = createFileRoute("/admin/contracts")({ component: ContractsAdmin });

const STATUS_LABEL: Record<string, string> = {
  draft: "Чернова",
  sent: "Изпратен за подпис",
  signed: "Подписан",
  declined: "Отказан",
  void: "Анулиран",
  error: "Грешка",
};
const TRIGGER_LABEL: Record<string, string> = {
  none: "Ръчно",
  deposit: "При депозит",
  deal: "При сделка",
  rental: "При наем",
  viewing: "След оглед",
};

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("bg-BG") : "—");
const money = (v: unknown, cur?: string | null) =>
  v == null ? "—" : `${Number(v).toLocaleString("bg-BG")} ${cur ?? "EUR"}`;

function ContractsAdmin() {
  const [tab, setTab] = useState<"docs" | "generator" | "templates" | "queue" | "log">("docs");
  const [docs, setDocs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
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
  const [view, setView] = useState<any | null>(null);
  const [editTpl, setEditTpl] = useState<any | null>(null);

  // генератор
  const [genTpl, setGenTpl] = useState("");
  const [genClient, setGenClient] = useState("");
  const [genProperty, setGenProperty] = useState("");
  const [genAmount, setGenAmount] = useState("");
  const [genExtra, setGenExtra] = useState("");
  const [genAi, setGenAi] = useState(true);
  const [preview, setPreview] = useState<{ text: string; missing: string[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, t, q, l, a, c, p] = await Promise.all([
        listGeneratedContracts({ data: { status: status || undefined } }),
        listContractTemplates(),
        listContractQueue(),
        listContractEvents(),
        getContractsAnalytics(),
        getContractsConfig(),
        listContractPickers(),
      ]);
      setDocs(d as any[]);
      setTemplates(t as any[]);
      setQueue(q as any[]);
      setLog(l as any[]);
      setAnalytics(a);
      setCfg((c as any).settings);
      setJob((c as any).job);
      setPickers(p as any);
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const extraVars = () => {
    const out: Record<string, string | number> = {};
    if (genAmount) out["amount"] = Number(genAmount);
    for (const line of genExtra.split("\n")) {
      const i = line.indexOf("=");
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return out;
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doPreview = async () => {
    if (!genTpl) return toast.error("Изберете шаблон.");
    setBusy(true);
    try {
      const r: any = await previewContractTemplate({
        data: {
          templateId: genTpl,
          clientId: genClient || null,
          propertyId: genProperty || null,
          variables: extraVars(),
        },
      });
      setPreview({ text: r.text, missing: r.missing });
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
            <FileSignature className="mr-2 inline h-8 w-8 text-amber-300" />
            Договори — Автоматизация №8
          </h1>
          <p className="mt-1 text-sm text-amber-100/70">
            Автоматично попълване на документи от шаблони, AI допълване, изпращане за подпис по линк
            и аналитика.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => run(() => runContractsQueueNow({ data: {} }), "Опашката е обработена")}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-100 hover:bg-amber-500/30"
          >
            <Zap className="h-4 w-4" />
            Обработи опашката
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
            onClick={() => run(() => resumeContractsJob(), "Автоматизацията е възобновена")}
            className="rounded-lg bg-rose-500/30 px-3 py-1.5"
          >
            Възобнови
          </button>
        </div>
      )}

      {analytics && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Общо документи", analytics.total],
            ["Подписани", analytics.byStatus?.signed ?? 0],
            ["За подпис", analytics.byStatus?.sent ?? 0],
            ["% подписване", `${analytics.signRate}%`],
            ["Ср. време до подпис", `${analytics.avgSignHours} ч`],
            ["В опашка", analytics.pendingQueue],
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
            ["docs", "Документи", FileText],
            ["generator", "Генератор", Sparkles],
            ["templates", "Шаблони", Layers],
            ["queue", "Опашка", ListChecks],
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
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-[rgba(40,8,16,0.75)] text-left text-amber-100/85">
                <tr>
                  <th className="px-4 py-3">№ / Документ</th>
                  <th className="px-4 py-3">Клиент</th>
                  <th className="px-4 py-3">Имот</th>
                  <th className="px-4 py-3">Сума</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Изпратен / Подписан</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((r) => (
                  <tr key={r.id} className="border-t border-[#8B1A2B]/15">
                    <td className="px-4 py-2">
                      <span className="font-semibold">{r.doc_number ?? "—"}</span>
                      <span className="block text-xs opacity-70">
                        {r.title}
                        {r.ai_used ? " · AI" : ""}
                      </span>
                      {Array.isArray(r.missing_fields) && r.missing_fields.length > 0 && (
                        <span className="block text-xs text-rose-700">
                          Липсват: {r.missing_fields.join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">{r.clients?.full_name ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{r.properties?.title ?? "—"}</td>
                    <td className="px-4 py-2">{money(r.amount, r.currency)}</td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-[#8B1A2B]/12 px-2 py-0.5 text-xs">
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {dt(r.sent_at)}
                      <span className="block opacity-70">{dt(r.signed_at)}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <button onClick={() => setView(r)} className="mr-2 text-xs underline">
                        Преглед
                      </button>
                      <button
                        onClick={() =>
                          run(async () => {
                            const res: any = await sendContractForSignature({ data: { id: r.id } });
                            if (res?.sign_url)
                              await navigator.clipboard?.writeText(res.sign_url).catch(() => {});
                          }, "Линкът за подпис е готов и копиран")
                        }
                        className="mr-2 inline-flex items-center gap-1 text-xs underline"
                      >
                        <Send className="h-3 w-3" />
                        За подпис
                      </button>
                      {r.status !== "signed" && (
                        <button
                          onClick={() => {
                            const name = prompt("Име на подписалия:");
                            if (name)
                              run(
                                () =>
                                  markContractSignedManually({
                                    data: { id: r.id, signatureName: name },
                                  }),
                                "Отбелязан като подписан",
                              );
                          }}
                          className="mr-2 text-xs underline"
                        >
                          Подписан
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const reason = prompt("Причина за анулиране:");
                          if (reason)
                            run(
                              () => voidContractDoc({ data: { id: r.id, reason } }),
                              "Документът е анулиран",
                            );
                        }}
                        className="mr-2 text-xs underline"
                      >
                        Анулирай
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Изтриване на документа?"))
                            run(() => deleteGeneratedContract({ data: { id: r.id } }), "Изтрит");
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
                      Няма документи. Използвайте таб „Генератор“.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "generator" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-amber-500/20 bg-[rgba(40,8,16,0.55)] p-5">
            <h2 className="font-display text-xl text-amber-100">Нов документ</h2>
            <label className="block text-xs text-amber-100/70">
              Шаблон
              <select
                value={genTpl}
                onChange={(e) => setGenTpl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-2 text-sm text-amber-100"
              >
                <option value="">— избери —</option>
                {templates
                  .filter((t) => t.is_active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-xs text-amber-100/70">
              Клиент
              <select
                value={genClient}
                onChange={(e) => setGenClient(e.target.value)}
                className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-2 text-sm text-amber-100"
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
                value={genProperty}
                onChange={(e) => setGenProperty(e.target.value)}
                className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-2 text-sm text-amber-100"
              >
                <option value="">— без —</option>
                {pickers.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-amber-100/70">
              Сума / депозит
              <input
                value={genAmount}
                onChange={(e) => setGenAmount(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-2 text-sm text-amber-100"
              />
            </label>
            <label className="block text-xs text-amber-100/70">
              Допълнителни променливи (по едно на ред: ключ=стойност)
              <textarea
                value={genExtra}
                onChange={(e) => setGenExtra(e.target.value)}
                rows={4}
                placeholder={"seller_name=Иван Петров\nclient_egn=8001011234"}
                className="mt-1 w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-2 text-sm text-amber-100"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-amber-100/80">
              <input type="checkbox" checked={genAi} onChange={(e) => setGenAi(e.target.checked)} />
              AI допълване на липсващите текстови полета
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={doPreview}
                disabled={busy}
                className="rounded-lg border border-amber-500/30 px-3 py-2 text-sm text-amber-100"
              >
                Преглед
              </button>
              <button
                disabled={busy || !genTpl}
                onClick={() =>
                  run(
                    () =>
                      generateContractNow({
                        data: {
                          templateId: genTpl,
                          clientId: genClient || null,
                          propertyId: genProperty || null,
                          variables: extraVars(),
                          useAi: genAi,
                        },
                      }),
                    "Документът е генериран",
                  )
                }
                className="rounded-lg bg-amber-500/25 px-3 py-2 text-sm text-amber-50"
              >
                Генерирай
              </button>
              <button
                disabled={busy || !genTpl}
                onClick={() =>
                  run(
                    () =>
                      enqueueContractJob({
                        data: {
                          templateId: genTpl,
                          clientId: genClient || null,
                          propertyId: genProperty || null,
                          variables: extraVars(),
                          autoSend: true,
                        },
                      }),
                    "Добавен в опашката",
                  )
                }
                className="rounded-lg border border-amber-500/30 px-3 py-2 text-sm text-amber-100"
              >
                В опашка + авто-изпращане
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-[rgba(255,255,255,0.9)] p-5">
            <h2 className="mb-2 font-display text-xl">Преглед</h2>
            {preview?.missing?.length ? (
              <p className="mb-3 text-xs text-rose-700">
                Липсващи полета: {preview.missing.join(", ")}
              </p>
            ) : null}
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap font-serif text-sm leading-relaxed">
              {preview?.text ?? "Изберете шаблон и натиснете „Преглед“."}
            </pre>
          </div>
        </section>
      )}

      {tab === "templates" && (
        <section className="space-y-3">
          <button
            onClick={() =>
              setEditTpl({
                name: "",
                contract_type: "other",
                category: "sale",
                template_content: "",
                is_active: true,
                auto_trigger: "none",
                sort_order: 100,
              })
            }
            className="rounded-lg bg-amber-500/25 px-3 py-2 text-sm text-amber-50"
          >
            + Нов шаблон
          </button>
          <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)]">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[rgba(40,8,16,0.75)] text-left text-amber-100/85">
                <tr>
                  <th className="px-4 py-3">Шаблон</th>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Тригер</th>
                  <th className="px-4 py-3">Полета</th>
                  <th className="px-4 py-3">Генерирани</th>
                  <th className="px-4 py-3">Активен</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-t border-[#8B1A2B]/15">
                    <td className="px-4 py-2 font-semibold">
                      {t.name}
                      <span className="block text-xs opacity-60">{t.code ?? "—"}</span>
                    </td>
                    <td className="px-4 py-2 text-xs">{t.contract_type}</td>
                    <td className="px-4 py-2 text-xs">
                      {TRIGGER_LABEL[t.auto_trigger ?? "none"] ?? t.auto_trigger}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {Array.isArray(t.placeholders) ? t.placeholders.length : 0}
                    </td>
                    <td className="px-4 py-2">{t.generated_count ?? 0}</td>
                    <td className="px-4 py-2 text-xs">{t.is_active ? "Да" : "Не"}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => setEditTpl(t)} className="text-xs underline">
                        Редактирай
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "queue" && (
        <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-[rgba(40,8,16,0.75)] text-left text-amber-100/85">
              <tr>
                <th className="px-4 py-3">Създаден</th>
                <th className="px-4 py-3">Шаблон</th>
                <th className="px-4 py-3">Клиент</th>
                <th className="px-4 py-3">Имот</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Опити</th>
                <th className="px-4 py-3">Грешка</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((q) => (
                <tr key={q.id} className="border-t border-[#8B1A2B]/15">
                  <td className="px-4 py-2 text-xs">{dt(q.created_at)}</td>
                  <td className="px-4 py-2">
                    {q.contract_templates?.name ?? q.template_code ?? "—"}
                  </td>
                  <td className="px-4 py-2">{q.clients?.full_name ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{q.properties?.title ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    {q.status}
                    {q.auto_send ? " · авто-изпращане" : ""}
                  </td>
                  <td className="px-4 py-2">{q.attempts}</td>
                  <td className="px-4 py-2 text-xs text-rose-700">{q.last_error ?? "—"}</td>
                </tr>
              ))}
              {!queue.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center opacity-60">
                    Опашката е празна.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "log" && (
        <div className="overflow-x-auto rounded-xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-[rgba(40,8,16,0.75)] text-left text-amber-100/85">
              <tr>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Действие</th>
                <th className="px-4 py-3">Документ</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Съобщение</th>
                <th className="px-4 py-3">Актьор</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id} className="border-t border-[#8B1A2B]/15">
                  <td className="px-4 py-2 text-xs">{dt(l.created_at)}</td>
                  <td className="px-4 py-2 text-xs">{l.action}</td>
                  <td className="px-4 py-2 text-xs">
                    {l.generated_contracts?.doc_number ?? l.generated_contracts?.title ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">{l.status}</td>
                  <td className="px-4 py-2 text-xs">{l.message ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{l.actor ?? "—"}</td>
                </tr>
              ))}
              {!log.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center opacity-60">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#8B1A2B]/55 p-4"
          onClick={() => setView(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-card p-8 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display text-2xl">{view.title}</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-sm"
                >
                  <Printer className="h-4 w-4" />
                  Принтирай
                </button>
                <button onClick={() => setView(null)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <article className="whitespace-pre-wrap font-serif text-base">{view.content}</article>
          </div>
        </div>
      )}

      {editTpl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#8B1A2B]/55 p-4"
          onClick={() => setEditTpl(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-card p-6"
            data-task-dialog
          >
            <h2 className="mb-4 font-display text-2xl">
              {editTpl.id ? "Редакция на шаблон" : "Нов шаблон"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                Име
                <input
                  value={editTpl.name ?? ""}
                  onChange={(e) => setEditTpl({ ...editTpl, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs">
                Тип (contract_type)
                <input
                  value={editTpl.contract_type ?? ""}
                  onChange={(e) => setEditTpl({ ...editTpl, contract_type: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs">
                Тригер
                <select
                  value={editTpl.auto_trigger ?? "none"}
                  onChange={(e) => setEditTpl({ ...editTpl, auto_trigger: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
                >
                  {Object.entries(TRIGGER_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(editTpl.is_active)}
                  onChange={(e) => setEditTpl({ ...editTpl, is_active: e.target.checked })}
                />
                Активен
              </label>
            </div>
            <label className="mt-3 block text-xs">
              Текст на шаблона — променливи във вид {"{{"}име{"}}"}, условия {"{{"}#if име{"}}"}…
              {"{{"}/if{"}}"}
              <textarea
                value={editTpl.template_content ?? ""}
                onChange={(e) => setEditTpl({ ...editTpl, template_content: e.target.value })}
                rows={16}
                className="mt-1 w-full rounded-lg border border-input px-3 py-2 font-mono text-xs"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditTpl(null)}
                className="rounded-lg border border-input px-4 py-2 text-sm"
              >
                Отказ
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await saveContractTemplate({
                      data: {
                        id: editTpl.id ?? null,
                        name: editTpl.name,
                        contract_type: editTpl.contract_type || "other",
                        template_content: editTpl.template_content,
                        is_active: Boolean(editTpl.is_active),
                        auto_trigger: editTpl.auto_trigger ?? "none",
                      },
                    });
                    setEditTpl(null);
                  }, "Шаблонът е записан")
                }
                className="rounded-lg bg-[#8B1A2B] px-4 py-2 text-sm text-white"
              >
                Запази
              </button>
            </div>
          </div>
        </div>
      )}

      {showCfg && cfg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#8B1A2B]/55 p-4"
          onClick={() => setShowCfg(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-card p-6"
            data-task-dialog
          >
            <h2 className="mb-4 font-display text-2xl">Настройки на автоматизацията</h2>
            <div className="space-y-3 text-sm">
              {(
                [
                  ["enabled", "Автоматизацията е включена"],
                  ["ai_enabled", "AI допълване на полета"],
                  ["auto_send", "Автоматично изпращане за подпис"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(cfg[k])}
                    onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
              {(
                [
                  ["batch_size", "Документи на цикъл"],
                  ["retry_limit", "Макс. опити"],
                  ["expire_days", "Валидност на линка (дни)"],
                  ["commission", "Комисион (%)"],
                  ["term_months", "Срок по договор (месеци)"],
                  ["reserve_days", "Резервация (дни)"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="block text-xs">
                  {label}
                  <input
                    type="number"
                    value={Number(cfg[k] ?? 0)}
                    onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
                  />
                </label>
              ))}
              {(
                [
                  ["number_prefix", "Префикс на номерата"],
                  ["agency_name", "Агенция"],
                  ["agency_city", "Град"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="block text-xs">
                  {label}
                  <input
                    value={String(cfg[k] ?? "")}
                    onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCfg(false)}
                className="rounded-lg border border-input px-4 py-2 text-sm"
              >
                Отказ
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await saveContractsConfig({
                      data: {
                        enabled: cfg.enabled,
                        ai_enabled: cfg.ai_enabled,
                        auto_send: cfg.auto_send,
                        batch_size: cfg.batch_size,
                        retry_limit: cfg.retry_limit,
                        expire_days: cfg.expire_days,
                        number_prefix: cfg.number_prefix,
                        agency_name: cfg.agency_name,
                        agency_city: cfg.agency_city,
                        commission: cfg.commission,
                        term_months: cfg.term_months,
                        reserve_days: cfg.reserve_days,
                      },
                    });
                    setShowCfg(false);
                  }, "Настройките са записани")
                }
                className="rounded-lg bg-[#8B1A2B] px-4 py-2 text-sm text-white"
              >
                Запази
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
