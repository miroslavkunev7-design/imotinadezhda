/**
 * Apply split SQL parts via Supabase MCP-compatible approach:
 * prints each part path for manual/agent apply, OR set SUPABASE_ACCESS_TOKEN.
 * Usage: node scripts/apply-sql-parts.mjs scripts/.migration-batches-remaining
 */
import fs from "fs";
import path from "path";

const dir = process.argv[2] ?? "scripts/.migration-batches-remaining";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectId = "bxtxygakafwusstpptkg";
const parts = fs
  .readdirSync(dir)
  .filter((f) => f.includes("_part") && f.endsWith(".sql"))
  .sort();

if (!token) {
  console.error("Set SUPABASE_ACCESS_TOKEN to apply automatically.");
  parts.forEach((p) => console.log(path.join(dir, p)));
  process.exit(1);
}

async function runSql(query, name) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name}: ${res.status} ${text}`);
  console.log(`[ok] ${name}`);
}

for (const part of parts) {
  const query = fs.readFileSync(path.join(dir, part), "utf8");
  await runSql(query, part);
}
console.log("All parts applied.");
