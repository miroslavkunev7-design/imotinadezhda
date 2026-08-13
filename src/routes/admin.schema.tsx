import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, RefreshCw, Loader2, Database, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkSchema, type TableStatus } from "@/lib/schema-check.functions";

export const Route = createFileRoute("/admin/schema")({
  component: SchemaPage,
  head: () => ({ meta: [{ title: "Supabase схема — статус" }] }),
});

function SchemaPage() {
  const fn = useServerFn(checkSchema);
  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["schema-check"],
    queryFn: () => fn(),
  });

  const missingTables = data?.tables.filter((t) => !t.exists) ?? [];
  const partial = data?.tables.filter((t) => t.exists && t.columns.some((c) => !c.ok)) ?? [];

  return (
    <div className="space-y-6" data-crm-themed>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-200">
            Диагностика · Supabase
          </div>
          <h1 className="mt-2 font-display text-4xl text-amber-100 flex items-center gap-3">
            <Database className="h-8 w-8" /> Supabase схема
          </h1>
          <p className="mt-1 text-sm text-amber-100/70">
            Проверява дали всички нужни таблици и колони съществуват в базата.
            {data?.host && <> Хост: <code className="text-amber-200">{data.host}</code></>}
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching} className="gold-cta-button">
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Провери отново</span>
        </Button>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-950/60 p-4 text-rose-100">
          Грешка: {String((error as Error).message)}
        </div>
      )}

      {data && (
        <>
          <div
            className={`rounded-xl border p-5 shadow-lg ${
              data.allOk
                ? "border-emerald-400/40 bg-emerald-950/50 text-emerald-100"
                : "border-amber-400/50 bg-[rgba(139,26,43,0.85)] text-amber-50"
            }`}
          >
            {data.allOk ? (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6" />
                <div>
                  <div className="font-display text-lg">Всичко е наред</div>
                  <div className="text-sm opacity-80">Всички очаквани таблици и колони съществуват.</div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" />
                <div className="text-sm space-y-1">
                  <div className="font-display text-lg text-amber-100">Открити разлики от очакваната схема</div>
                  {missingTables.length > 0 && (
                    <div>Липсват таблици: <b>{missingTables.map((t) => t.table).join(", ")}</b></div>
                  )}
                  {partial.length > 0 && (
                    <div>Таблици с липсващи колони: <b>{partial.map((t) => t.table).join(", ")}</b></div>
                  )}
                  <div className="pt-2">
                    <a
                      href="https://supabase.com/dashboard/project/_/sql/new"
                      target="_blank" rel="noreferrer"
                      className="inline-block rounded-lg border border-amber-300/60 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-500/30"
                    >
                      Отвори Supabase SQL Editor →
                    </a>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3 text-[11px] opacity-60">Последна проверка: {new Date(data.checkedAt).toLocaleString("bg-BG")}</div>
          </div>

          <div className="space-y-3">
            {data.tables.map((t) => <TableCard key={t.table} t={t} />)}
          </div>
        </>
      )}

      {!data && !error && (
        <div className="flex items-center gap-2 text-amber-100/70"><Loader2 className="h-4 w-4 animate-spin" /> Проверка на схемата...</div>
      )}
    </div>
  );
}

function TableCard({ t }: { t: TableStatus }) {
  const okCount = t.columns.filter((c) => c.ok).length;
  const total = t.columns.length;
  const fks = t.foreignKeys ?? [];
  const fkOk = fks.filter((f) => f.ok).length;
  const fkTotal = fks.length;
  const fullyOk = t.exists && okCount === total && fkOk === fkTotal;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-[rgba(255,255,255,0.94)] p-4 text-[#3a0f18] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {fullyOk ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <XCircle className="h-5 w-5 text-rose-600" />
          )}
          <div>
            <div className="font-semibold">
              <code className="rounded bg-[rgba(139,26,43,0.1)] px-1.5 py-0.5">public.{t.table}</code>
            </div>
            <div className="text-xs text-[#6b1626]">{t.purpose}</div>
          </div>
        </div>
        <div className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          fullyOk ? "bg-emerald-100 text-emerald-800" :
          t.exists ? "bg-amber-100 text-amber-800" :
          "bg-rose-100 text-rose-800"
        }`}>
          {!t.exists ? "таблицата липсва" : `${okCount}/${total} колони`}
        </div>
      </div>

      {!t.exists && t.error && (
        <div className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-800 break-all">
          {t.error}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {t.columns.map((c) => (
          <span
            key={c.name}
            title={c.error ?? ""}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono ${
              c.ok
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {c.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {c.name}
          </span>
        ))}
      </div>

      {fkTotal > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6b1626]">
            Foreign keys ({fkOk}/{fkTotal})
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {fks.map((f) => (
              <span
                key={f.column}
                title={f.error ?? ""}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono ${
                  f.ok
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {f.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {f.column} → {f.references}
              </span>
            ))}
          </div>
        </div>
      )}

      {t.migration && !fullyOk && (
        <div className="mt-3 text-xs text-[#6b1626]">
          Миграция: <code className="rounded bg-[rgba(139,26,43,0.08)] px-1.5 py-0.5">{t.migration}</code>
        </div>
      )}
    </div>
  );
}