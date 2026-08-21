import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  FileText,
  Trash2,
  Eye,
  X,
  Printer,
  Plus,
  Sparkles,
  Download,
  Loader2,
  FileSignature,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { deleteContract } from "@/lib/crm.functions";
import {
  fillContractPreview,
  listContractDesk,
  saveGeneratedContract,
} from "@/lib/contracts.functions";
import { CONTRACT_STATUS_LABELS, CONTRACT_TYPE_LABELS, buildPrintableHtml } from "@/lib/contracts";
import { Button } from "@/components/ui/button";

type Desk = Awaited<ReturnType<typeof listContractDesk>>;
type ContractRow = Desk["contracts"][number];

export const Route = createFileRoute("/admin/contracts")({
  validateSearch: (s: Record<string, unknown>) => ({
    client: typeof s.client === "string" && s.client.length > 0 ? s.client : undefined,
    property: typeof s.property === "string" && s.property.length > 0 ? s.property : undefined,
  }),
  component: ContractsAdmin,
});

function nestedLabel(rel: unknown, key: string): string {
  if (!rel) return "—";
  const row = Array.isArray(rel) ? rel[0] : rel;
  if (row && typeof row === "object" && key in row) {
    const v = (row as Record<string, unknown>)[key];
    return typeof v === "string" && v.trim() ? v : "—";
  }
  return "—";
}

function typeLabel(t: string) {
  return CONTRACT_TYPE_LABELS[t] ?? t;
}
function statusLabel(s: string) {
  return CONTRACT_STATUS_LABELS[s] ?? s;
}

function downloadHtml(title: string, content: string) {
  const html = buildPrintableHtml(title, content);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 80) || "dogovor"}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function printContent(title: string, content: string) {
  const html = buildPrintableHtml(title, content);
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!w) {
    toast.error("Блокиран е прозорецът за печат — разреши pop-up.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

function ContractsAdmin() {
  const search = Route.useSearch();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [loading, setLoading] = useState(true);
  const [wizard, setWizard] = useState(!!search.client || !!search.property);
  const [templateId, setTemplateId] = useState("");
  const [clientId, setClientId] = useState(search.client ?? "");
  const [propertyId, setPropertyId] = useState(search.property ?? "");
  const [ownerId, setOwnerId] = useState("");
  const [brokerId, setBrokerId] = useState("");
  const [notes, setNotes] = useState("");
  const [useAi, setUseAi] = useState(true);
  const [clientQ, setClientQ] = useState("");
  const [propQ, setPropQ] = useState("");
  const [filling, setFilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{
    id?: string | null;
    title: string;
    content: string;
    contract_type: string;
    template_id: string | null;
    client_id: string | null;
    property_id: string | null;
    unfilled?: number;
    ai_used?: boolean;
    ai_note?: string | null;
  } | null>(null);
  const [view, setView] = useState<ContractRow | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    try {
      const next = await listContractDesk();
      setDesk(next);
      if (!templateId && next.templates[0]) setTemplateId(next.templates[0].id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Грешка");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!desk) return;
    if (propertyId) {
      const prop = desk.properties.find((p) => p.id === propertyId);
      if (prop?.owner_id) setOwnerId((cur) => cur || prop.owner_id || "");
      if (prop?.broker_id) setBrokerId((cur) => cur || prop.broker_id || "");
    } else if (clientId) {
      const client = desk.clients.find((c) => c.id === clientId);
      if (client?.assigned_broker_id) {
        setBrokerId((cur) => cur || client.assigned_broker_id || "");
      }
    }
    // Initial auto-fill from ?client= / ?property= once desk is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desk]);

  const clientsFiltered = useMemo(() => {
    const q = clientQ.trim().toLowerCase();
    const rows = desk?.clients ?? [];
    if (!q) return rows.slice(0, 80);
    return rows
      .filter((c) => `${c.full_name} ${c.phone ?? ""}`.toLowerCase().includes(q))
      .slice(0, 80);
  }, [desk, clientQ]);

  const propertiesFiltered = useMemo(() => {
    const q = propQ.trim().toLowerCase();
    const rows = desk?.properties ?? [];
    if (!q) return rows.slice(0, 80);
    return rows
      .filter((p) => `${p.title} ${p.address ?? ""}`.toLowerCase().includes(q))
      .slice(0, 80);
  }, [desk, propQ]);

  const rows = useMemo(() => {
    const all = desk?.contracts ?? [];
    if (statusFilter === "all") return all;
    return all.filter((r) => r.status === statusFilter);
  }, [desk, statusFilter]);

  const fill = async () => {
    if (!templateId) {
      toast.error("Избери шаблон.");
      return;
    }
    setFilling(true);
    try {
      const result = await fillContractPreview({
        data: {
          template_id: templateId,
          client_id: clientId || null,
          property_id: propertyId || null,
          owner_id: ownerId || null,
          broker_id: brokerId || null,
          notes: notes || null,
          use_ai: useAi,
        },
      });
      setPreview({
        title: result.title,
        content: result.content,
        contract_type: result.contract_type,
        template_id: result.template_id,
        client_id: result.resolved.client_id,
        property_id: result.resolved.property_id,
        unfilled: result.unfilled,
        ai_used: result.ai_used,
        ai_note: result.ai_note,
      });
      if (result.ai_note) toast.message(result.ai_note);
      else if (result.ai_used) toast.success("AI допълни клаузите от бележките.");
      else toast.success("Шаблонът е попълнен.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Грешка при попълване");
    } finally {
      setFilling(false);
    }
  };

  const save = async (status: "draft" | "final" | "pending_signature") => {
    if (!preview) return;
    setSaving(true);
    try {
      const saved = await saveGeneratedContract({
        data: {
          id: preview.id ?? null,
          template_id: preview.template_id,
          client_id: preview.client_id,
          property_id: preview.property_id,
          contract_type: preview.contract_type,
          title: preview.title,
          content: preview.content,
          status,
        },
      });
      setPreview({ ...preview, id: saved.id });
      toast.success(
        status === "draft"
          ? "Черновата е записана."
          : status === "final"
            ? "Договорът е финален."
            : "Маркиран за подпис.",
      );
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Неуспешен запис");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Изтриване на този договор?")) return;
    try {
      await deleteContract({ data: { id } });
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Грешка");
    }
  };

  const analytics = desk?.analytics;
  const selectClass =
    "w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.65)] px-3 py-2 text-sm text-amber-100";
  const inputClass =
    "w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.65)] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-100/35";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-amber-100">
            <FileText className="mr-2 inline h-8 w-8 text-amber-300" />
            Договори
          </h1>
          <p className="mt-1 text-sm text-amber-100/60">
            Шаблони за агенцията — попълват се от клиент, имот и сделка.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setWizard((v) => !v)}
          className="rounded-full bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
        >
          <Plus className="h-4 w-4" />
          {wizard ? "Скрий генератора" : "Нов договор"}
        </Button>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-amber-500/20 p-10 text-center text-amber-100/60">
          Зареждане…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Генерирани"
              value={String(analytics?.total ?? 0)}
              icon={<FileText className="h-4 w-4" />}
            />
            <Stat
              label="Чакат подпис"
              value={String(analytics?.pending_signatures ?? 0)}
              icon={<Clock className="h-4 w-4" />}
              accent
            />
            <Stat
              label="Чернови / финални"
              value={`${analytics?.drafts ?? 0} / ${analytics?.finals ?? 0}`}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <Stat
              label="Последен"
              value={
                analytics?.last
                  ? new Date(analytics.last.created_at).toLocaleDateString("bg-BG")
                  : "—"
              }
              hint={analytics?.last?.title}
              icon={<FileSignature className="h-4 w-4" />}
            />
          </div>

          {(analytics?.by_type.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {analytics!.by_type.map((row) => (
                <span
                  key={row.type}
                  className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs text-amber-100"
                >
                  {typeLabel(row.type)} · {row.count}
                </span>
              ))}
            </div>
          )}

          {wizard && (
            <section className="space-y-4 rounded-2xl border border-amber-500/20 bg-[rgba(255,255,255,0.05)] p-5">
              <h2 className="font-display text-xl text-amber-100">Генератор</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(desk?.templates ?? []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                      templateId === t.id
                        ? "border-amber-400 bg-amber-500/20 text-amber-50"
                        : "border-amber-500/20 text-amber-100/80 hover:border-amber-400/50"
                    }`}
                  >
                    <div className="font-semibold">{t.name}</div>
                    <div className="mt-1 text-[11px] text-amber-100/50">
                      {typeLabel(t.contract_type)}
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-xs text-amber-100/70">
                  Търсене клиент
                  <input
                    className={`${inputClass} mt-1`}
                    value={clientQ}
                    onChange={(e) => setClientQ(e.target.value)}
                    placeholder="Име или телефон"
                  />
                </label>
                <label className="block text-xs text-amber-100/70">
                  Клиент
                  <select
                    className={`${selectClass} mt-1`}
                    value={clientId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setClientId(id);
                      const client = desk?.clients.find((c) => c.id === id);
                      if (client?.assigned_broker_id && !propertyId) {
                        setBrokerId(client.assigned_broker_id);
                      }
                    }}
                  >
                    <option value="">— без клиент —</option>
                    {clientsFiltered.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-amber-100/70">
                  Търсене имот
                  <input
                    className={`${inputClass} mt-1`}
                    value={propQ}
                    onChange={(e) => setPropQ(e.target.value)}
                    placeholder="Заглавие или адрес"
                  />
                </label>
                <label className="block text-xs text-amber-100/70">
                  Имот
                  <select
                    className={`${selectClass} mt-1`}
                    value={propertyId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setPropertyId(id);
                      const prop = desk?.properties.find((p) => p.id === id);
                      setOwnerId(prop?.owner_id ?? "");
                      if (prop?.broker_id) setBrokerId(prop.broker_id);
                    }}
                  >
                    <option value="">— без имот —</option>
                    {propertiesFiltered.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                        {p.price != null ? ` · ${p.price} ${p.currency ?? ""}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-amber-100/70">
                  Собственик
                  <select
                    className={`${selectClass} mt-1`}
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                  >
                    <option value="">— ако има в имота —</option>
                    {(desk?.owners ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-amber-100/70">
                  Брокер
                  <select
                    className={`${selectClass} mt-1`}
                    value={brokerId}
                    onChange={(e) => setBrokerId(e.target.value)}
                  >
                    <option value="">— ако е назначен —</option>
                    {(desk?.brokers ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-xs text-amber-100/70">
                Бележки / липсващи клаузи
                <textarea
                  className={`${inputClass} mt-1 min-h-[88px]`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Напр. задатък 10 000 EUR, срок до 15 септември, разноските за купувача…"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-amber-100/80">
                <input
                  type="checkbox"
                  checked={useAi}
                  onChange={(e) => setUseAi(e.target.checked)}
                  className="accent-amber-400"
                />
                <Sparkles className="h-4 w-4 text-amber-300" />
                AI да допълни празни клаузи от бележките
                {!desk?.ai_available && (
                  <span className="text-xs text-amber-100/45">
                    (няма ключ — ще се ползва само шаблонът)
                  </span>
                )}
              </label>

              <Button type="button" onClick={fill} disabled={filling} className="rounded-full">
                {filling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSignature className="h-4 w-4" />
                )}
                Попълни преглед
              </Button>
            </section>
          )}

          {preview && (
            <section className="space-y-3 rounded-2xl border border-amber-400/30 bg-[rgba(255,255,255,0.06)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input
                  className={`${inputClass} max-w-xl font-display text-lg`}
                  value={preview.title}
                  onChange={(e) => setPreview({ ...preview, title: e.target.value })}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => printContent(preview.title, preview.content)}
                  >
                    <Printer className="h-4 w-4" /> Печат / PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadHtml(preview.title, preview.content)}
                  >
                    <Download className="h-4 w-4" /> HTML
                  </Button>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="text-amber-100/60"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              {(preview.unfilled || preview.ai_note) && (
                <p className="text-xs text-amber-100/55">
                  {preview.unfilled ? `Непопълнени полета: ${preview.unfilled}. ` : ""}
                  {preview.ai_used ? "AI е използван. " : ""}
                  {preview.ai_note ?? ""}
                </p>
              )}
              <textarea
                className={`${inputClass} min-h-[320px] font-serif text-base leading-relaxed`}
                value={preview.content}
                onChange={(e) => setPreview({ ...preview, content: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => save("draft")}
                >
                  Запази чернова
                </Button>
                <Button type="button" disabled={saving} onClick={() => save("final")}>
                  Запази финален
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => save("pending_signature")}
                >
                  Чака подпис
                </Button>
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {["all", "draft", "final", "pending_signature", "signed"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1 text-xs ${
                  statusFilter === s
                    ? "bg-amber-500/25 text-amber-50"
                    : "text-amber-100/60 hover:text-amber-100"
                }`}
              >
                {s === "all" ? "Всички" : statusLabel(s)}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-amber-500/15 bg-[rgba(20,4,8,0.35)]">
            <table className="w-full text-sm text-amber-100">
              <thead className="bg-[rgba(40,8,16,0.7)] text-left text-amber-100/80">
                <tr>
                  <th className="px-4 py-3">Заглавие</th>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Клиент</th>
                  <th className="px-4 py-3">Имот</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-amber-500/10 hover:bg-amber-500/5">
                    <td className="px-4 py-2 font-semibold">{r.title}</td>
                    <td className="px-4 py-2 text-xs">{typeLabel(r.contract_type)}</td>
                    <td className="px-4 py-2">{nestedLabel(r.clients, "full_name")}</td>
                    <td className="px-4 py-2">{nestedLabel(r.properties, "title")}</td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs">
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {new Date(r.created_at).toLocaleDateString("bg-BG")}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setView(r)}
                        className="mr-2 text-amber-300"
                        title="Преглед"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="text-rose-400"
                        title="Изтрий"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-amber-100/40">
                      Все още няма договори. Отвори генератора по-горе или идвай от клиентската
                      карта.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
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
              <h2 className="font-display text-2xl text-accent-foreground">{view.title}</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPreview({
                      id: view.id,
                      title: view.title,
                      content: view.content,
                      contract_type: view.contract_type,
                      template_id: view.template_id,
                      client_id: view.client_id,
                      property_id: view.property_id,
                    });
                    setWizard(true);
                    setView(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Редактирай
                </button>
                <button
                  type="button"
                  onClick={() => printContent(view.title, view.content)}
                  className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <Printer className="h-4 w-4" />
                  Принтирай
                </button>
                <button
                  type="button"
                  onClick={() => downloadHtml(view.title, view.content)}
                  className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <Download className="h-4 w-4" />
                  HTML
                </button>
                <button type="button" onClick={() => setView(null)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <article className="prose prose-sm max-w-none whitespace-pre-wrap font-serif text-base text-foreground">
              {view.content}
            </article>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent
          ? "border-amber-400/40 bg-amber-500/15"
          : "border-amber-500/20 bg-[rgba(255,255,255,0.05)]"
      }`}
    >
      <div className="flex items-center gap-2 text-amber-300">
        {icon}
        <span className="text-xs uppercase tracking-wide text-amber-100/55">{label}</span>
      </div>
      <div className="mt-1 font-display text-2xl text-amber-50">{value}</div>
      {hint && <div className="mt-1 truncate text-[11px] text-amber-100/45">{hint}</div>}
    </div>
  );
}
