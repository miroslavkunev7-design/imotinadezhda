// Writes dist-installer/SHA256SUMS.txt for every installer named Ted-Setup*.exe (the versioned
// Ted-Setup-<version>-x64.exe and, in CI, its unversioned copy Ted-Setup-x64.exe), in `sha256sum`
// format ("<hex>  <file name>"), so it can be checked with `sha256sum -c` or compared with Get-FileHash.
//
//   node scripts/sha256.mjs [folder]     default folder: dist-installer
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.resolve(root, process.argv[2] || "dist-installer");

async function sha256(file) {
  const hash = createHash("sha256");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
}

// Top level only: win-unpacked/ holds the unpacked program and __uninstaller-*.exe is a build
// by-product; neither is handed out.
const installers = fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && /^Ted-Setup.*\.exe$/i.test(e.name))
      .map((e) => e.name)
      .sort()
  : [];

if (!installers.length) {
  console.error(`sha256: няма файлове Ted-Setup*.exe в ${dir} - първо изградете инсталатора (npm run dist:win).`);
  process.exit(1);
}

const lines = [];
for (const name of installers) lines.push(`${await sha256(path.join(dir, name))}  ${name}`);

const out = path.join(dir, "SHA256SUMS.txt");
fs.writeFileSync(out, lines.join("\n") + "\n"); // LF only, so `sha256sum -c` accepts it
console.log(lines.join("\n"));
console.log(`sha256: записано в ${out}`);
