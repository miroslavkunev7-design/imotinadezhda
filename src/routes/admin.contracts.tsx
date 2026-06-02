import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Trash2, Eye, X, Printer } from "lucide-react";
import { listContracts, deleteContract } from "@/lib/crm.functions";

export const Route = createFileRoute("/admin/contracts")({
  component: ContractsAdmin,
});

function ContractsAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [view, setView] = useState<any | null>(null);

  const load = async () => {
    try { setRows(await listContracts()); } catch (e: any) { alert(e.message); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Изтриване?")) return;
    try { await deleteContract({ data: { id } }); await load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl text-amber-100"><FileText className="inline h-8 w-8 text-amber-300" /> Договори</h1>
        <p className="mt-1 text-sm text-amber-100/60">Генерирани от AI асистента ({rows.length})</p>
      </header>

      <div className="overflow-hidden rounded-xl border border-amber-500/15 bg-[rgba(255, 255, 255,0.85)]">
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
                <td className="px-4 py-2 text-xs">{labelType(r.contract_type)}</td>
                <td className="px-4 py-2">{r.clients?.full_name ?? "—"}</td>
                <td className="px-4 py-2">{r.properties?.title ?? "—"}</td>
                <td className="px-4 py-2"><span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs">{r.status}</span></td>
                <td className="px-4 py-2 text-xs">{new Date(r.created_at).toLocaleDateString("bg-BG")}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => setView(r)} className="mr-2 text-amber-300"><Eye className="h-4 w-4" /></button>
                  <button onClick={() => remove(r.id)} className="text-rose-400"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-amber-100/40">Все още няма договори. Питай AI асистента: „Напиши предварителен договор за клиент X и имот Y".</td></tr>}
          </tbody>
        </table>
      </div>

      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#8B1A2B]/55 p-4" onClick={() => setView(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-card p-8 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h2 className="font-display text-2xl text-accent-foreground">{view.title}</h2>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-muted"><Printer className="h-4 w-4" />Принтирай</button>
                <button onClick={() => setView(null)}><X className="h-5 w-5" /></button>
              </div>
            </div>
            <article className="prose prose-sm max-w-none whitespace-pre-wrap font-serif text-base text-foreground">{view.content}</article>
          </div>
        </div>
      )}
    </div>
  );
}

function labelType(t: string) {
  return ({ preliminary: "Предварителен", sale: "Продажба", rent: "Наем", brokerage: "Посреднически", other: "Друг" } as any)[t] ?? t;
}
