/**
 * Import exported JSON data into bxtx Supabase project (service role).
 * Usage: node scripts/import-data-to-bxtx.mjs
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const TARGET_URL = "https://bxtxygakafwusstpptkg.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dHh5Z2FrYWZ3dXNzdHBwdGtnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY3MzcwNiwiZXhwIjoyMDk1MjQ5NzA2fQ.wmuessNJmtjuWoydXEfG0p6ZWsLu4GQQcyewGrL1Q-M";

const exportDir =
  process.env.EXPORT_DIR ??
  path.join(process.cwd(), "scripts/.data-export");

const ORDER = [
  "cities",
  "quarters",
  "villages",
  "properties",
  "property_images",
  "theme_settings",
  "page_layouts",
  "brokers",
  "clients",
  "inquiries",
  "profiles",
  "user_roles",
];

const sb = createClient(TARGET_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function upsertTable(table, rows) {
  if (!rows?.length) {
    console.log(`  [skip] ${table} — 0 rows`);
    return;
  }
  if (table === "page_layouts") {
    for (const row of rows) {
      const payload = { ...row };
      delete payload.updated_by;
      const { error } = await sb.from(table).upsert(payload, { onConflict: "page_key" });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    console.log(`  [ok] ${table} — ${rows.length} rows`);
    return;
  }
  if (table === "theme_settings") {
    const row = { ...rows[0] };
    delete row.updated_by;
    delete row.id;
    const { error } = await sb.from(table).update(row).eq("singleton", true);
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`  [ok] ${table} — updated singleton`);
    return;
  }
  const batch = 200;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    const { error } = await sb.from(table).upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  [ok] ${table} — ${rows.length} rows`);
}

async function loadCityIds() {
  const { data, error } = await sb.from("cities").select("id");
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.id));
}

function filterByCityIds(table, rows, cityIds) {
  if (!rows?.length) return rows;
  const hasCity = rows.some((r) => "city_id" in r);
  if (!hasCity) return rows;
  const kept = rows.filter((r) => !r.city_id || cityIds.has(r.city_id));
  const dropped = rows.length - kept.length;
  if (dropped) console.log(`  [warn] ${table} — skipped ${dropped} rows with unknown city_id`);
  return kept;
}

async function main() {
  console.log("Import →", TARGET_URL);
  const cityIds = await loadCityIds();
  for (const table of ORDER) {
    const file = path.join(exportDir, `${table}.json`);
    if (!fs.existsSync(file)) {
      console.log(`  [skip] ${table} — no file`);
      continue;
    }
    let rows = JSON.parse(fs.readFileSync(file, "utf8"));
    rows = filterByCityIds(table, rows, cityIds);
    await upsertTable(table, rows);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
