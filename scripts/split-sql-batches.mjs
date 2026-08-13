/**
 * Split SQL batches on migration file boundaries.
 */
import fs from "fs";
import path from "path";

const dir = process.argv[2] ?? "scripts/.migration-batches-remaining";
const max = Number(process.argv[3] ?? 12000);

function splitFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  const chunks = sql.split(/(?=^-- \d{8})/m).filter(Boolean);
  const parts = [];
  let buf = "";
  for (const chunk of chunks) {
    if (buf.length + chunk.length > max && buf.trim()) {
      parts.push(buf);
      buf = "";
    }
    buf += chunk;
  }
  if (buf.trim()) parts.push(buf);
  return parts;
}

const files = fs.readdirSync(dir).filter((f) => f.match(/^batch_\d+\.sql$/)).sort();
for (const f of fs.readdirSync(dir)) {
  if (f.includes("_part")) fs.unlinkSync(path.join(dir, f));
}

let n = 0;
for (const file of files) {
  const parts = splitFile(path.join(dir, file));
  parts.forEach((part, i) => {
    n++;
    const out = path.join(dir, `${file.replace(".sql", "")}_part${i + 1}.sql`);
    fs.writeFileSync(out, part);
    console.log(out, part.length);
  });
}
console.log("Total parts:", n);
