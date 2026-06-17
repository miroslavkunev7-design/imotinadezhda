import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, CreditCard, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/admin/inquiries")({
  component: InquiriesAdmin,
});

type Row = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  properties: { title: string } | null;
};

type MortgageRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  employer: string | null;
  monthly_income: number | null;
  notes: string | null;
  status: string;
  files: { category: string; month?: string | null; path: string; file_name: string }[];
  created_at: string;
  property_id: string | null;
  properties: { title: string } | null;
};

function InquiriesAdmin() {
  const [tab, setTab] = useState<"inquiries" | "mortgages">("inquiries");
  const [rows, setRows] = useState<Row[]>([]);
  const [mortgages, setMortgages] = useState<MortgageRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");

  const load = () => {
    supabase
      .from("inquiries")
      .select("*, properties:property_id(title)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows((data as Row[]) ?? []));
    supabase
      .from("mortgage_applications")
      .select("*, properties:property_id(title)")
      .order("created_at", { ascending: false })
      .then(({ data }) => setMortgages((data as any) ?? []));
  };
  useEffect(load, []);

  const setStatus = async (id: string, status: string) => {
    await supabase.from("inquiries").update({ status: status as "new" | "in_progress" | "closed" }).eq("id", id);
    load();
  };

  const setMortgageStatus = async (id: string, status: string) => {
    await supabase.from("mortgage_applications").update({ status }).eq("id", id);
    load();
  };

  const saveNotes = async (
    table: "inquiries" | "mortgage_applications",
    id: string,
    notes: string,
  ) => {
    const { error } = await supabase.from(table).update({ notes }).eq("id", id);
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
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-amber-100">Запитвания</h1>
        <p className="mt-1 text-sm text-amber-100/60">
          {rows.length} запитвания · {mortgages.length} ипотечни кандидатури
        </p>
      </header>

      <div className="flex gap-1 rounded-xl border border-amber-500/20 bg-[rgba(255, 255, 255,0.6)] p-1">
        <button
          onClick={() => setTab("inquiries")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "inquiries" ? "bg-gradient-to-r from-primary to-[#7a0d22] text-amber-100" : "text-amber-100/60 hover:text-amber-100"
          }`}
        >
          <MessageSquare className="h-4 w-4" /> Общи запитвания ({rows.length})
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
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-1.5 text-sm text-amber-100">
              <option value="">Статус: всички</option>
              <option value="new">Ново</option>
              <option value="in_progress">В процес</option>
              <option value="closed">Затворено</option>
            </select>
            {statusFilter && <button onClick={() => setStatusFilter("")} className="text-xs text-amber-100/60 underline">Изчисти</button>}
          </div>
          {rows.filter((r) => !statusFilter || r.status === statusFilter).map((r) => (
            <article key={r.id} className="rounded-2xl border border-amber-500/15 bg-[rgba(255, 255, 255,0.85)] p-5 text-amber-100">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{r.name} <span className="ml-2 text-sm text-amber-100/60">{r.email}</span></div>
                  {r.phone && <div className="text-sm text-amber-100/60">{r.phone}</div>}
                  {r.properties?.title && <div className="mt-1 text-xs text-amber-300">Имот: {r.properties.title}</div>}
                  <div className="mt-1 text-xs text-amber-100/40">{new Date(r.created_at).toLocaleString("bg-BG")}</div>
                </div>
                <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-1 text-sm text-amber-100">
                  <option value="new">Ново</option>
                  <option value="in_progress">В процес</option>
                  <option value="closed">Затворено</option>
                </select>
              </div>
              {r.message && <p className="mt-3 whitespace-pre-wrap text-sm">{r.message}</p>}
              <NotesEditor initial={r.notes ?? ""} onSave={(v) => saveNotes("inquiries", r.id, v)} />
            </article>
          ))}
          {!rows.length && <p className="text-center text-amber-100/40">Няма запитвания</p>}
        </div>
      )}

      {tab === "mortgages" && (
        <div className="space-y-3">
          {mortgages.map((m) => (
            <article key={m.id} className="rounded-2xl border border-amber-500/15 bg-[rgba(255, 255, 255,0.85)] p-5 text-amber-100">
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
                <select
                  value={m.status}
                  onChange={(e) => setMortgageStatus(m.id, e.target.value)}
                  className="rounded border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-1 text-sm text-amber-100"
                >
                  <option value="new">Ново</option>
                  <option value="in_review">В обработка</option>
                  <option value="approved">Одобрено</option>
                  <option value="rejected">Отказано</option>
                </select>
              </div>

              <NotesEditor initial={m.notes ?? ""} onSave={(v) => saveNotes("mortgage_applications", m.id, v)} />

              {m.files?.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-100/70">
                    Документи ({m.files.length})
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {m.files.map((f) => (
                      <button
                        key={f.path}
                        onClick={() => downloadFile(f.path, f.file_name)}
                        className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-left text-xs text-amber-100 hover:bg-amber-500/10"
                      >
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
      )}
    </div>
  );
}

function labelCategory(c: string) {
  return ({
    bank_statement: "Банково извлечение",
    payslip: "Фиш за заплата",
    contract: "Трудов договор",
    id_front: "Лична карта (лице)",
    id_back: "Лична карта (гръб)",
    employer_note: "Служебна бележка",
  } as Record<string, string>)[c] ?? c;
}

function NotesEditor({ initial, onSave }: { initial: string; onSave: (v: string) => void | Promise<void> }) {
  const [value, setValue] = useState(initial);
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div className="mt-3">
        {value ? (
          <p className="whitespace-pre-wrap text-sm text-amber-100/90">{value}</p>
        ) : (
          <p className="text-xs italic text-amber-100/40">Няма бележки</p>
        )}
        <button
          onClick={() => setEditing(true)}
          className="mt-1 text-xs text-amber-300 underline-offset-2 hover:underline"
        >
          {value ? "Редактирай бележки" : "Добави бележки"}
        </button>
      </div>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-amber-500/30 bg-[rgba(20,4,8,0.6)] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-100/30"
        placeholder="Вътрешни бележки за този запис..."
      />
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
