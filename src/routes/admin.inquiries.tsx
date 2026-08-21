import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Download,
  CreditCard,
  MessageSquare,
  Phone,
  Mail,
  TrendingUp,
  Clock,
  Users,
  AlertTriangle,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureManualLead, listLeadDesk, updateLead } from "@/lib/lead-capture.functions";

export const Route = createFileRoute("/admin/inquiries")({
  component: InquiriesAdmin,
});

type Desk = Awaited<ReturnType<typeof listLeadDesk>>;

const SOURCE_LABEL: Record<string, string> = {
  website: "Сайт",
  property: "Имот",
  contacts: "Контакти",
  sell: "Продай",
  chat: "Чат",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  phone: "Телефон",
  email: "Имейл",
  manual: "Ръчно",
  other: "Друго",
};

const INTENT_LABEL: Record<string, string> = {
  buy: "Купува",
  sell: "Продава",
  rent: "Наем",
  mortgage: "Ипотека",
  valuation: "Оценка",
  other: "Друго",
};

function InquiriesAdmin() {
  const [tab, setTab] = useState<"inquiries" | "mortgages">("inquiries");
  const [desk, setDesk] = useState<Desk | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ name: "", phone: "", email: "", message: "", source: "phone" as const });

  const load = async () => {
    try {
      setDesk(await listLeadDesk());
    } catch (e: any) {
      toast.error(e?.message ?? "Не мога да заредя лийдовете");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const rows = desk?.inquiries ?? [];
  const mortgages = desk?.mortgages ?? [];
  const analytics = desk?.analytics;
  const brokers = desk?.brokers ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (sourceFilter && r.source !== sourceFilter) return false;
      if (!needle) return true;
      return `${r.name} ${r.email} ${r.phone ?? ""} ${r.message ?? ""}`.toLowerCase().includes(needle);
    });
  }, [rows, statusFilter, sourceFilter, q]);

  const patch = async (id: string, data: Parameters<typeof updateLead>[0]["data"]) => {
    setBusy(id);
    try {
      await updateLead({ data: { id, ...data } });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Не се записа");
    } finally {
      setBusy(null);
    }
  };

  const saveManual = async () => {
    if (manual.name.trim().length < 2) {
      toast.error("Име е задължително");
      return;
    }
    setBusy("manual");
    try {
      await captureManualLead({ data: manual });
      toast.success("Лийдът е записан.");
      setManualOpen(false);
      setManual({ name: "", phone: "", email: "", message: "", source: "phone" });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Не се записа");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-amber-100/70">
        <Loader2 className="h-5 w-5 animate-spin" /> Зареждане…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-amber-100">Лийдове</h1>
          <p className="mt-1 text-sm text-amber-100/60">
            Smart Lead Capture — всички канали на едно място · {analytics?.total90 ?? 0} за 90 дни
          </p>
        </div>
        <Button onClick={() => setManualOpen((v) => !v)} className="bg-amber-400 text-[#2a0a12] hover:bg-amber-300">
          <Plus className="h-4 w-4" /> Ръчен запис (обаждане)
        </Button>
      </header>

      {analytics ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Днес" value={analytics.newToday} />
          <Kpi icon={<MessageSquare className="h-4 w-4" />} label="7 дни" value={analytics.new7d} />
          <Kpi icon={<Users className="h-4 w-4" />} label="Отворени" value={analytics.open} />
          <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Без брокер" value={analytics.unassigned} />
          <Kpi icon={<Clock className="h-4 w-4" />} label="SLA > 1ч" value={analytics.slaOverdue} warn={analytics.slaOverdue > 0} />
          <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Ср. оценка" value={analytics.avgScore} />
          <Kpi icon={<Users className="h-4 w-4" />} label="Дубликати" value={analytics.duplicates} />
        </div>
      ) : null}

      {analytics ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <Bars title="По канал" data={analytics.byChannel} labels={{ web: "Сайт", chat: "Чат", whatsapp: "WhatsApp", messenger: "Messenger", phone: "Телефон", email: "Имейл", crm: "CRM" }} />
          <Bars title="По източник" data={analytics.bySource} labels={SOURCE_LABEL} />
          <Bars title="Намерение" data={analytics.byIntent} labels={INTENT_LABEL} />
        </div>
      ) : null}

      {manualOpen ? (
        <div className="grid gap-2 rounded-2xl border border-amber-200/20 bg-black/25 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <input value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="Име *" className="rounded-lg border border-amber-200/20 bg-black/40 px-3 py-2 text-sm text-amber-50" />
          <input value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} placeholder="Телефон" className="rounded-lg border border-amber-200/20 bg-black/40 px-3 py-2 text-sm text-amber-50" />
          <input value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} placeholder="Имейл" className="rounded-lg border border-amber-200/20 bg-black/40 px-3 py-2 text-sm text-amber-50" />
          <select value={manual.source} onChange={(e) => setManual({ ...manual, source: e.target.value as any })} className="rounded-lg border border-amber-200/20 bg-black/40 px-3 py-2 text-sm text-amber-50">
            <option value="phone">Телефон</option>
            <option value="email">Имейл</option>
            <option value="facebook">Facebook</option>
            <option value="manual">Друго</option>
          </select>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
            <Button size="sm" onClick={saveManual} disabled={busy === "manual"} className="flex-1">
              {busy === "manual" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Запиши"}
            </Button>
          </div>
          <textarea value={manual.message} onChange={(e) => setManual({ ...manual, message: e.target.value })} placeholder="Какво каза клиентът…" rows={2} className="rounded-lg border border-amber-200/20 bg-black/40 px-3 py-2 text-sm text-amber-50 sm:col-span-2 lg:col-span-5" />
        </div>
      ) : null}

      <div className="flex gap-1 rounded-xl border border-amber-500/20 bg-[rgba(255,255,255,0.6)] p-1">
        <button
          onClick={() => setTab("inquiries")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "inquiries" ? "bg-gradient-to-r from-primary to-[#7a0d22] text-amber-100" : "text-amber-100/60 hover:text-amber-100"
          }`}
        >
          <MessageSquare className="h-4 w-4" /> Лийдове ({filtered.length})
        </button>
        <button
          onClick={() => setTab("mortgages")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "mortgages" ? "bg-gradient-to-r from-primary to-[#7a0d22] text-amber-100" : "text-amber-100/60 hover:text-amber-100"
          }`}
        >
          <CreditCard className="h-4 w-4" /> Ипотечни кандидатури ({mortgages.length})
        </button>
      </div>

      {tab === "inquiries" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси име, телефон, текст…" className="min-w-[200px] flex-1 rounded border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-1.5 text-sm text-amber-100" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-1.5 text-sm text-amber-100">
              <option value="">Статус: всички</option>
              <option value="new">Ново</option>
              <option value="in_progress">В процес</option>
              <option value="closed">Затворено</option>
            </select>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-1.5 text-sm text-amber-100">
              <option value="">Канал: всички</option>
              {Object.entries(SOURCE_LABEL).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
          {filtered.map((r: any) => (
            <article key={r.id} className="rounded-2xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)] p-5 text-amber-100">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {r.name}
                    <ScoreBadge score={Number(r.score ?? 0)} />
                    {r.duplicate_of ? <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase">дубликат</span> : null}
                    {r.status === "new" && hoursAgo(r.created_at) >= 1 ? (
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] uppercase text-red-200">SLA</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm text-amber-100/60">
                    {r.phone ? (
                      <a className="inline-flex items-center gap-1 hover:underline" href={`tel:${r.phone}`}>
                        <Phone className="h-3.5 w-3.5" /> {r.phone}
                      </a>
                    ) : null}
                    {r.email ? (
                      <a className="inline-flex items-center gap-1 hover:underline" href={`mailto:${r.email}`}>
                        <Mail className="h-3.5 w-3.5" /> {r.email}
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                    <Chip>{SOURCE_LABEL[r.source] ?? r.source}</Chip>
                    {r.intent ? <Chip>{INTENT_LABEL[r.intent] ?? r.intent}</Chip> : null}
                    {r.urgency === "high" ? <Chip>Спешно</Chip> : null}
                    {r.city_hint ? <Chip>{r.city_hint}</Chip> : null}
                    {r.budget_max ? <Chip>до {Number(r.budget_max).toLocaleString("bg-BG")}</Chip> : null}
                    {r.properties?.title ? <Chip>Имот: {r.properties.title}</Chip> : null}
                    {r.brokers?.full_name ? <Chip>{r.brokers.full_name}</Chip> : <Chip>без брокер</Chip>}
                  </div>
                  <div className="mt-1 text-xs text-amber-100/40">{new Date(r.created_at).toLocaleString("bg-BG")}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <select
                    value={r.status}
                    disabled={busy === r.id}
                    onChange={(e) => patch(r.id, { status: e.target.value as any, first_response: e.target.value !== "new" })}
                    className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-1 text-sm text-amber-100"
                  >
                    <option value="new">Ново</option>
                    <option value="in_progress">В процес</option>
                    <option value="closed">Затворено</option>
                  </select>
                  <select
                    value={r.assigned_broker_id ?? ""}
                    disabled={busy === r.id}
                    onChange={(e) => patch(r.id, { assigned_broker_id: e.target.value || null })}
                    className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-1 text-sm text-amber-100"
                  >
                    <option value="">Брокер…</option>
                    {brokers.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {r.ai_summary ? <p className="mt-3 text-sm text-amber-50/90">{r.ai_summary}</p> : null}
              {r.message && <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>}
              <NotesEditor initial={r.notes ?? ""} onSave={(v) => patch(r.id, { notes: v })} />
            </article>
          ))}
          {!filtered.length && <p className="text-center text-amber-100/40">Няма запитвания</p>}
        </div>
      )}

      {tab === "mortgages" && (
        <MortgagesTab mortgages={mortgages} onReload={load} />
      )}
    </div>
  );
}

function hoursAgo(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

function Kpi({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${warn ? "border-red-400/30 bg-red-500/10" : "border-amber-200/15 bg-black/25"}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-100/50">
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-2xl text-amber-50">{value}</div>
    </div>
  );
}

function Bars({ title, data, labels }: { title: string; data: Record<string, number>; labels: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return (
    <div className="rounded-2xl border border-amber-200/15 bg-black/25 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-200/70">{title}</div>
      <div className="space-y-1.5">
        {entries.length === 0 ? <div className="text-xs text-amber-100/40">Няма данни</div> : null}
        {entries.map(([k, n]) => (
          <div key={k} className="grid grid-cols-[88px_1fr_28px] items-center gap-2 text-xs text-amber-100/80">
            <span className="truncate">{labels[k] ?? k}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-amber-100/10">
              <div className="h-full rounded-full bg-amber-300" style={{ width: `${(n / max) * 100}%` }} />
            </div>
            <span className="text-right">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-amber-200/20 bg-black/20 px-2 py-0.5 text-amber-100/80">{children}</span>;
}

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 70 ? "bg-emerald-500/25 text-emerald-200" : score >= 40 ? "bg-amber-500/25 text-amber-100" : "bg-white/10 text-amber-100/60";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{score}</span>;
}

function MortgagesTab({ mortgages, onReload }: { mortgages: any[]; onReload: () => void }) {
  const setMortgageStatus = async (id: string, status: string) => {
    await supabase.from("mortgage_applications").update({ status }).eq("id", id);
    onReload();
  };
  const saveNotes = async (id: string, notes: string) => {
    const { error } = await supabase.from("mortgage_applications").update({ notes }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Бележките са запазени");
  };
  const downloadFile = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("mortgage-docs").createSignedUrl(path, 60 * 60);
    if (error || !data) return toast.error(error?.message ?? "Грешка");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.target = "_blank";
    a.click();
  };
  return (
    <div className="space-y-3">
      {mortgages.map((m) => (
        <article key={m.id} className="rounded-2xl border border-amber-500/15 bg-[rgba(255,255,255,0.85)] p-5 text-amber-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-amber-300" />
                <span className="font-semibold">{m.full_name}</span>
                <span className="text-sm text-amber-100/60">{m.phone}</span>
                {m.email && <span className="text-sm text-amber-100/60">· {m.email}</span>}
              </div>
              {m.employer && <div className="mt-1 text-xs text-amber-100/60">Работодател: {m.employer}</div>}
              {m.monthly_income != null && <div className="text-xs text-amber-100/60">Доход: {m.monthly_income} лв./мес.</div>}
              {m.properties?.title && <div className="mt-1 text-xs text-amber-300">Имот: {m.properties.title}</div>}
              <div className="mt-1 text-xs text-amber-100/40">{new Date(m.created_at).toLocaleString("bg-BG")}</div>
            </div>
            <select value={m.status} onChange={(e) => setMortgageStatus(m.id, e.target.value)} className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-1 text-sm text-amber-100">
              <option value="new">Ново</option>
              <option value="in_review">В обработка</option>
              <option value="approved">Одобрено</option>
              <option value="rejected">Отказано</option>
            </select>
          </div>
          <NotesEditor initial={m.notes ?? ""} onSave={(v) => saveNotes(m.id, v)} />
          {m.files?.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-100/70">Документи ({m.files.length})</div>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {m.files.map((f: any) => (
                  <button key={f.path} onClick={() => downloadFile(f.path, f.file_name)} className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-left text-xs text-amber-100 hover:bg-amber-500/10">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 flex-none text-amber-300" />
                        <span className="truncate">{labelCategory(f.category)}{f.month ? ` · ${f.month}` : ""}</span>
                      </div>
                      <div className="ml-5 truncate text-[10px] text-amber-100/50">{f.file_name}</div>
                    </div>
                    <Download className="h-3.5 w-3.5 flex-none text-amber-300" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </article>
      ))}
      {!mortgages.length && <p className="text-center text-amber-100/40">Няма ипотечни кандидатури</p>}
    </div>
  );
}

function labelCategory(c: string) {
  return (
    {
      bank_statement: "Банково извлечение",
      payslip: "Фиш за заплата",
      contract: "Трудов договор",
      id_front: "Лична карта (лице)",
      id_back: "Лична карта (гръб)",
      employer_note: "Служебна бележка",
    } as Record<string, string>
  )[c] ?? c;
}

function NotesEditor({ initial, onSave }: { initial: string; onSave: (v: string) => void | Promise<void> }) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div className="mt-3">
        {value ? <p className="whitespace-pre-wrap text-sm text-amber-100/90">{value}</p> : <p className="text-xs italic text-amber-100/40">Няма бележки</p>}
        <button onClick={() => setEditing(true)} className="mt-1 text-xs text-amber-300 underline-offset-2 hover:underline">
          {value ? "Редактирай бележки" : "Добави бележки"}
        </button>
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} className="w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-100/30" placeholder="Вътрешни бележки…" />
      <div className="flex gap-2">
        <button
          onClick={async () => {
            await onSave(value);
            setEditing(false);
          }}
          className="rounded-lg bg-gradient-to-r from-primary to-[#7a0d22] px-3 py-1.5 text-xs font-semibold text-amber-100"
        >
          Запази
        </button>
        <button
          onClick={() => {
            setValue(initial);
            setEditing(false);
          }}
          className="rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs text-amber-100/70"
        >
          Отказ
        </button>
      </div>
    </div>
  );
}
