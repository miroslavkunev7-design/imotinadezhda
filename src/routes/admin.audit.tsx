import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
});

type LogRow = {
  id: string;
  path: string;
  user_id: string | null;
  email: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

function AuditPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "/login" | "/admin">("all");

  useEffect(() => {
    let q = supabase
      .from("admin_access_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (filter !== "all") q = q.eq("path", filter);
    q.then(({ data }) => {
      setRows((data ?? []) as LogRow[]);
      setLoading(false);
    });
  }, [filter]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl text-amber-100">Одит лог — достъп до /login и /admin</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="rounded border border-amber-100/20 bg-[#1a0608] px-3 py-1.5 text-sm text-amber-100"
        >
          <option value="all">Всички</option>
          <option value="/login">/login</option>
          <option value="/admin">/admin</option>
        </select>
      </div>

      {loading ? (
        <p className="text-amber-100/60">Зареждане...</p>
      ) : rows.length === 0 ? (
        <p className="text-amber-100/60">Няма записи.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-amber-100/10">
          <table className="w-full text-sm text-amber-100/80">
            <thead className="bg-[#1a0608] text-xs uppercase text-amber-300/70">
              <tr>
                <th className="px-3 py-2 text-left">Кога</th>
                <th className="px-3 py-2 text-left">Път</th>
                <th className="px-3 py-2 text-left">Имейл</th>
                <th className="px-3 py-2 text-left">Потребител</th>
                <th className="px-3 py-2 text-left">IP</th>
                <th className="px-3 py-2 text-left">Браузър</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-amber-100/5">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("bg-BG")}</td>
                  <td className="px-3 py-2 font-mono text-amber-200">{r.path}</td>
                  <td className="px-3 py-2">{r.email ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.user_id ? r.user_id.slice(0, 8) : "анонимен"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.ip ?? "—"}</td>
                  <td className="px-3 py-2 max-w-xs truncate" title={r.user_agent ?? ""}>{r.user_agent ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
