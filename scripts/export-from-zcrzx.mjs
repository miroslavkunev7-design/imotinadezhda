/**
 * Export public/readable data from live zcrzx project (anon key).
 * Usage: node scripts/export-from-zcrzx.mjs
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const SOURCE_URL = "https://zcrzxgzyptqibsajoece.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjcnp4Z3p5cHRxaWJzYWpvZWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNDgwMjMsImV4cCI6MjA5NTgyNDAyM30.jHsY0umR0xZi0AKT9nNWAB34hRh84VrgjkIt52CuLo8";

const outDir = path.join(process.cwd(), "scripts/.data-export");
const TABLES = [
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

const sb = createClient(SOURCE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function exportTable(table) {
  const rows = [];
  const page = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await sb.from(table).select("*").range(from, from + page - 1);
    if (error) {
      console.log(`  [err] ${table}: ${error.message}`);
      return;
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < page) break;
    from += page;
  }
  fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
  console.log(`  [ok] ${table} — ${rows.length} rows`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  console.log("Export from", SOURCE_URL);
  for (const table of TABLES) await exportTable(table);
  console.log("Saved to", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
