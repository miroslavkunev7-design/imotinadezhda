/**
 * Build migration batches skipping first N files (already applied).
 * Usage: node scripts/build-migration-batches.mjs --skip 1
 */
import fs from "fs";
import path from "path";

const skip = Number(process.argv.find((a) => a.startsWith("--skip="))?.split("=")[1] ?? 1);
const migrationsDir = path.join(process.cwd(), "supabase/migrations");
const outDir = path.join(process.cwd(), "scripts/.migration-batches-remaining");
const MAX = Number(process.argv.find((a) => a.startsWith("--max="))?.split("=")[1] ?? 45000);

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .slice(skip);

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));

let batch = 0;
let buf = "";
let names = [];

function flush() {
  if (!buf.trim()) return;
  batch++;
  const name = `batch_${String(batch).padStart(2, "0")}.sql`;
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(name, buf.length, "bytes", names.length, "files", names[0], "→", names[names.length - 1]);
  buf = "";
  names = [];
}

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  const chunk = `-- ${file}\n${sql}\n\n`;
  if (buf.length + chunk.length > MAX && buf.length) flush();
  buf += chunk;
  names.push(file);
}
flush();
console.log("Skip", skip, "| Remaining", files.length, "files →", batch, "batches");
