import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/audit/$id")({
  component: AuditDetailPage,
});

type LogRow = {
  id: string;
  path: string;
  user_id: string | null;
  email: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-amber-100/10 py-3 md:grid-cols-[200px_1fr]">
      <div className="text-xs uppercase tracking-wide text-amber-300/70">{label}</div>
      <div className="break-all text-sm text-amber-100">{value}</div>
    </div>
  );
}

function AuditDetailPage() {
  const { id } = Route.useParams();
  const [row, setRow] = useState<LogRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("admin_access_log")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setRow(data as LogRow | null);
        setLoading(false);
      });
  }, [id]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl text-amber-100">Одит запис</h1>
        <Link
          to="/admin/audit"
          className="text-xs text-amber-300/70 underline hover:text-amber-200"
        >
          ← Назад към списъка
        </Link>
      </div>

      {loading ? (
        <p className="text-amber-100/60">Зареждане...</p>
      ) : error ? (
        <p className="text-red-300">{error}</p>
      ) : !row ? (
        <p className="text-amber-100/60">Записът не е намерен.</p>
      ) : (
        <div className="rounded-lg border border-amber-100/10 bg-[#1a0608]/40 p-6">
          <Row label="ID" value={<span className="font-mono text-xs">{row.id}</span>} />
          <Row
            label="Време"
            value={new Date(row.created_at).toLocaleString("bg-BG", {
              dateStyle: "full",
              timeStyle: "medium",
            })}
          />
          <Row
            label="Път"
            value={<span className="font-mono text-amber-200">{row.path}</span>}
          />
          <Row label="Имейл" value={row.email ?? "—"} />
          <Row
            label="Потребител (user_id)"
            value={
              row.user_id ? (
                <span className="font-mono text-xs">{row.user_id}</span>
              ) : (
                "анонимен"
              )
            }
          />
          <Row label="IP адрес" value={<span className="font-mono text-xs">{row.ip ?? "—"}</span>} />
          <Row
            label="User Agent"
            value={<span className="text-xs">{row.user_agent ?? "—"}</span>}
          />
          <Row
            label="Metadata"
            value={
              row.metadata && Object.keys(row.metadata).length > 0 ? (
                <pre className="overflow-x-auto rounded bg-[#0d0405] p-3 text-xs text-amber-100/80">
                  {JSON.stringify(row.metadata, null, 2)}
                </pre>
              ) : (
                "—"
              )
            }
          />
        </div>
      )}
    </div>
  );
}
