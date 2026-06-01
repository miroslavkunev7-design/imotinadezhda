import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  const [pathFilter, setPathFilter] = useState<"all" | "/login" | "/admin">("all");
  const [emailFilter, setEmailFilter] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [live, setLive] = useState(true);
  const [newCount, setNewCount] = useState(0);

  const matchesFilters = (r: LogRow) => {
    if (pathFilter !== "all" && r.path !== pathFilter) return false;
    if (emailFilter.trim() && !(r.email ?? "").toLowerCase().includes(emailFilter.trim().toLowerCase())) return false;
    if (ipFilter.trim() && !(r.ip ?? "").toLowerCase().includes(ipFilter.trim().toLowerCase())) return false;
    if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(r.created_at) > end) return false;
    }
    return true;
  };

  useEffect(() => {
    setLoading(true);
    setNewCount(0);
    let q = supabase
      .from("admin_access_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (pathFilter !== "all") q = q.eq("path", pathFilter);
    if (emailFilter.trim()) q = q.ilike("email", `%${emailFilter.trim()}%`);
    if (ipFilter.trim()) q = q.ilike("ip", `%${ipFilter.trim()}%`);
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }
    q.then(({ data }) => {
      setRows((data ?? []) as LogRow[]);
      setLoading(false);
    });
  }, [pathFilter, emailFilter, ipFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!live) return;
    const channel = supabase
      .channel("admin_access_log_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_access_log" },
        (payload) => {
          const row = payload.new as LogRow;
          if (!matchesFilters(row)) return;
          setRows((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            return [row, ...prev].slice(0, 500);
          });
          setNewCount((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, pathFilter, emailFilter, ipFilter, dateFrom, dateTo]);

  const inputCls =
    "rounded border border-amber-100/20 bg-[#1a0608] px-3 py-1.5 text-sm text-amber-100 placeholder:text-amber-100/30";

  const hasFilters = useMemo(
    () => pathFilter !== "all" || emailFilter || ipFilter || dateFrom || dateTo,
    [pathFilter, emailFilter, ipFilter, dateFrom, dateTo],
  );

  const exportCsv = () => {
    const headers = ["Кога", "Път", "Имейл", "Потребител", "IP", "Браузър"];
    const escape = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          new Date(r.created_at).toLocaleString("bg-BG"),
          r.path,
          r.email,
          r.user_id,
          r.ip,
          r.user_agent,
        ]
          .map(escape)
          .join(","),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl text-amber-100">
          Одит лог — достъп до /login и /admin
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setLive((v) => !v);
              setNewCount(0);
            }}
            className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs transition ${
              live
                ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
                : "border-amber-100/20 bg-[#1a0608] text-amber-100/70"
            }`}
            title={live ? "Изключи live обновяване" : "Включи live обновяване"}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                live ? "animate-pulse bg-emerald-400" : "bg-amber-100/30"
              }`}
            />
            {live ? "На живо" : "Пауза"}
            {live && newCount > 0 && (
              <span className="ml-1 rounded-full bg-emerald-400/30 px-1.5 text-[10px] font-semibold text-emerald-100">
                +{newCount}
              </span>
            )}
          </button>
          {hasFilters && (
            <button
              onClick={() => {
                setPathFilter("all");
                setEmailFilter("");
                setIpFilter("");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-xs text-amber-300/70 underline hover:text-amber-200"
            >
              Изчисти филтрите
            </button>
          )}
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="rounded border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-300/20 disabled:opacity-40"
          >
            Експорт CSV ({rows.length})
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <select
          value={pathFilter}
          onChange={(e) => setPathFilter(e.target.value as any)}
          className={inputCls}
        >
          <option value="all">Всички пътища</option>
          <option value="/login">/login</option>
          <option value="/admin">/admin</option>
        </select>
        <input
          type="text"
          placeholder="Имейл..."
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          className={inputCls}
        />
        <input
          type="text"
          placeholder="IP адрес..."
          value={ipFilter}
          onChange={(e) => setIpFilter(e.target.value)}
          className={inputCls}
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className={inputCls}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className={inputCls}
        />
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
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-amber-100/5 hover:bg-amber-100/5">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString("bg-BG")}
                  </td>
                  <td className="px-3 py-2 font-mono text-amber-200">{r.path}</td>
                  <td className="px-3 py-2">{r.email ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.user_id ? r.user_id.slice(0, 8) : "анонимен"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.ip ?? "—"}</td>
                  <td
                    className="px-3 py-2 max-w-xs truncate"
                    title={r.user_agent ?? ""}
                  >
                    {r.user_agent ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link
                      to="/admin/audit/$id"
                      params={{ id: r.id }}
                      className="text-xs text-amber-300 underline hover:text-amber-200"
                    >
                      Детайли →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
