#!/usr/bin/env node
/**
 * Прилага всички непуснати миграции от db/migrations към Supabase.
 * Използва SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY от .env и RPC public.exec_sql.
 * Няма зависимост от Lovable — работи навсякъде (локално, CI, Vercel).
 *
 *   node scripts/apply-migrations.mjs [--dry]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "db/migrations");

if (existsSync(path.join(root, ".env"))) {
  for (const line of readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Липсват SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const dry = process.argv.includes("--dry");
const baseline = process.argv.includes("--baseline"); // маркира съществуващите миграции като приложени, без да ги пуска
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function rpc(query) {
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

async function applied() {
  const res = await fetch(`${url}/rest/v1/schema_migrations?select=version`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return new Set((await res.json()).map((r) => r.version));
}

async function record(version, checksum) {
  const res = await fetch(`${url}/rest/v1/schema_migrations`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ version, checksum }),
  });
  if (!res.ok) throw new Error(`ledger: ${res.status} ${await res.text()}`);
}

const done = await applied();
if (done === null) {
  console.error("Няма таблица public.schema_migrations / функция exec_sql.");
  console.error("Пусни веднъж db/migrations/_BOOTSTRAP_exec_sql.sql в Supabase SQL Editor.");
  process.exit(2);
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql") && !f.startsWith("_"))
  .sort();

let count = 0;
for (const file of files) {
  const version = file.replace(/\.sql$/, "");
  if (done.has(version)) continue;
  const sql = readFileSync(path.join(dir, file), "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex").slice(0, 16);
  if (dry) {
    console.log(`⏳ предстои: ${file}`);
    continue;
  }
  if (baseline) {
    await record(version, checksum);
    console.log(`✓ маркирана като приложена: ${file}`);
    count++;
    continue;
  }
  process.stdout.write(`▶ ${file} … `);
  try {
    await rpc(sql);
    await record(version, checksum);
    console.log("ok");
    count++;
  } catch (e) {
    console.log("ГРЕШКА");
    console.error(String(e.message).slice(0, 800));
    process.exit(1);
  }
}
console.log(dry ? "dry-run готов" : count ? `Приложени ${count} миграции.` : "Няма нови миграции.");
