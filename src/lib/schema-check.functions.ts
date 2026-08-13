import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/auth/assert-admin";

// Required schema for the app. Each entry: table + expected columns.
// The page uses this list to render a status matrix and hint which
// migration file provides the missing pieces.
const EXPECTED: Array<{
  table: string;
  columns: string[];
  migration?: string;
  purpose: string;
}> = [
  { table: "profiles", columns: ["id", "full_name", "avatar_url"], purpose: "Профили на потребители / брокери" },
  { table: "user_roles", columns: ["user_id", "role"], purpose: "Роли (admin/broker) — RBAC" },
  { table: "cities", columns: ["id", "name", "slug"], purpose: "Градове" },
  { table: "quarters", columns: ["id", "name", "city_id"], purpose: "Квартали" },
  { table: "properties", columns: ["id", "title", "price", "city_id"], purpose: "Имоти" },
  { table: "clients", columns: ["id", "full_name", "phone", "client_type"], purpose: "Клиенти (CRM)" },
  { table: "inquiries", columns: ["id", "name", "phone", "message"], purpose: "Запитвания от сайта" },
  { table: "tasks", columns: ["id", "title", "due_at", "status"], purpose: "Задачи / календар" },
  { table: "contracts", columns: ["id", "type", "status"], purpose: "Договори" },
  { table: "audit_log", columns: ["id", "action", "actor_id", "created_at"], purpose: "Одит лог" },
  {
    table: "rentals",
    columns: [
      "id", "tenant_client_id", "landlord_client_id", "address",
      "monthly_rent", "management_fee", "currency", "payment_day", "status",
    ],
    migration: "db/migrations/20260713120000_rentals_and_payments.sql (+ ..._rentals_management_fee.sql)",
    purpose: "Наеми & плащания",
  },
  {
    table: "rental_payments",
    columns: ["id", "rental_id", "period_month", "amount", "status", "document_url"],
    migration: "db/migrations/20260713120000_rentals_and_payments.sql",
    purpose: "Месечни плащания за наеми",
  },
];

export type ColumnStatus = { name: string; ok: boolean; error?: string };
export type ForeignKeyStatus = {
  column: string;
  references: string; // e.g. "clients.id"
  ok: boolean;
  error?: string;
};
export type TableStatus = {
  table: string;
  purpose: string;
  migration?: string;
  exists: boolean;
  error?: string;
  columns: ColumnStatus[];
  foreignKeys?: ForeignKeyStatus[];
};
export type SchemaCheckResult = {
  checkedAt: string;
  host: string;
  tables: TableStatus[];
  allOk: boolean;
};

function looksLikeMissingTable(msg: string) {
  return /schema cache/i.test(msg) || /does not exist/i.test(msg) || /Could not find the table/i.test(msg);
}
function looksLikeMissingColumn(msg: string) {
  return /column .* does not exist/i.test(msg) || /Could not find the .* column/i.test(msg);
}
function looksLikeMissingRelation(msg: string) {
  return /Could not find a relationship/i.test(msg) || /relationship .* not found/i.test(msg) || /foreign key/i.test(msg);
}

// Expected foreign keys per table. Probed via PostgREST embedded selects — if the
// relationship (FK) is missing, PostgREST returns "Could not find a relationship".
const EXPECTED_FKS: Record<string, Array<{ column: string; refTable: string; refColumn: string }>> = {
  rentals: [
    { column: "tenant_client_id", refTable: "clients", refColumn: "id" },
    { column: "landlord_client_id", refTable: "clients", refColumn: "id" },
    { column: "property_id", refTable: "properties", refColumn: "id" },
    { column: "city_id", refTable: "cities", refColumn: "id" },
    { column: "quarter_id", refTable: "quarters", refColumn: "id" },
  ],
  rental_payments: [
    { column: "rental_id", refTable: "rentals", refColumn: "id" },
  ],
};

export const checkSchema = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SchemaCheckResult> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const host = (() => {
      try { return new URL(process.env.SUPABASE_URL ?? "").host; } catch { return "unknown"; }
    })();

    const tables: TableStatus[] = [];

    for (const spec of EXPECTED) {
      // Probe the table itself
      const probe = await (supabaseAdmin as any).from(spec.table).select("*").limit(0);
      const tableErr = probe.error?.message as string | undefined;
      const exists = !tableErr || !looksLikeMissingTable(tableErr);

      let columns: ColumnStatus[];
      if (!exists) {
        columns = spec.columns.map((c) => ({ name: c, ok: false, error: "таблицата липсва" }));
      } else {
        // Probe each column individually so we know exactly which is missing.
        columns = await Promise.all(spec.columns.map(async (c) => {
          const r = await (supabaseAdmin as any).from(spec.table).select(c).limit(0);
          if (!r.error) return { name: c, ok: true };
          const m = r.error.message as string;
          if (looksLikeMissingColumn(m)) return { name: c, ok: false, error: "колоната липсва" };
          // Other errors (permission etc.) — mark as unknown but not "missing"
          return { name: c, ok: false, error: m };
        }));
      }

      // Probe foreign key relationships via PostgREST embedded selects.
      let foreignKeys: ForeignKeyStatus[] | undefined;
      const fkSpecs = EXPECTED_FKS[spec.table];
      if (fkSpecs && fkSpecs.length > 0) {
        if (!exists) {
          foreignKeys = fkSpecs.map((f) => ({
            column: f.column,
            references: `${f.refTable}.${f.refColumn}`,
            ok: false,
            error: "таблицата липсва",
          }));
        } else {
          foreignKeys = await Promise.all(fkSpecs.map(async (f) => {
            // Use embedded select with explicit FK column hint: `alias:refTable!fkColumn(refColumn)`
            const embed = `${f.refTable}!${f.column}(${f.refColumn})`;
            const r = await (supabaseAdmin as any).from(spec.table).select(`id, ${embed}`).limit(0);
            const base: ForeignKeyStatus = { column: f.column, references: `${f.refTable}.${f.refColumn}`, ok: false };
            if (!r.error) return { ...base, ok: true };
            const m = r.error.message as string;
            if (looksLikeMissingRelation(m)) return { ...base, error: "FK липсва" };
            if (looksLikeMissingColumn(m)) return { ...base, error: "колоната липсва" };
            if (looksLikeMissingTable(m)) return { ...base, error: `${f.refTable} липсва` };
            return { ...base, error: m };
          }));
        }
      }

      tables.push({
        table: spec.table,
        purpose: spec.purpose,
        migration: spec.migration,
        exists,
        error: !exists ? tableErr : undefined,
        columns,
        foreignKeys,
      });
    }

    const allOk = tables.every(
      (t) => t.exists && t.columns.every((c) => c.ok) && (t.foreignKeys ?? []).every((f) => f.ok),
    );
    return { checkedAt: new Date().toISOString(), host, tables, allOk };
  });