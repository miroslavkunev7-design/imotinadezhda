#!/usr/bin/env node
/**
 * Visual diff tool — 1:1 pixel comparison between two PNGs.
 *
 * Usage:
 *   node scripts/visual-diff.mjs <baseline.png> <current.png> [diff.png] [--threshold=0.1]
 *
 * Exit code: 0 if diff% <= max (default 2%), 1 otherwise.
 * Used by `bun run visual:district` to validate DistrictPage header & footer.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? "true"];
    }),
);

const [baselinePath, currentPath, diffPath = "diff.png"] = positional;
if (!baselinePath || !currentPath) {
  console.error("Usage: visual-diff.mjs <baseline> <current> [diff] [--threshold=0.1] [--max=3]");
  process.exit(2);
}
if (!fs.existsSync(baselinePath)) {
  console.error(`❌ Baseline missing: ${baselinePath}`);
  console.error("   Create it first with: bun run visual:capture");
  process.exit(2);
}
if (!fs.existsSync(currentPath)) {
  console.error(`❌ Current missing: ${currentPath}`);
  process.exit(2);
}

const threshold = Number(flags.threshold ?? 0.1);
const maxPct = Number(flags.max ?? 2);

const a = PNG.sync.read(fs.readFileSync(baselinePath));
const b = PNG.sync.read(fs.readFileSync(currentPath));

// Resize current to baseline dims if needed (simple crop/pad)
const { width, height } = a;
const norm = (src) => {
  if (src.width === width && src.height === height) return src;
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dstIdx = (y * width + x) << 2;
      if (x < src.width && y < src.height) {
        const srcIdx = (y * src.width + x) << 2;
        out.data[dstIdx] = src.data[srcIdx];
        out.data[dstIdx + 1] = src.data[srcIdx + 1];
        out.data[dstIdx + 2] = src.data[srcIdx + 2];
        out.data[dstIdx + 3] = src.data[srcIdx + 3];
      } else {
        out.data[dstIdx + 3] = 0;
      }
    }
  }
  return out;
};

const bN = norm(b);
const diff = new PNG({ width, height });
const mismatched = pixelmatch(a.data, bN.data, diff.data, width, height, {
  threshold,
  includeAA: false,
  alpha: 0.4,
});

fs.mkdirSync(path.dirname(diffPath), { recursive: true });
fs.writeFileSync(diffPath, PNG.sync.write(diff));

const total = width * height;
const pct = (mismatched / total) * 100;
const label = `${path.basename(baselinePath)} vs ${path.basename(currentPath)}`;
const status = pct <= maxPct ? "✅" : "❌";
console.log(
  `${status} ${label}  diff=${mismatched}px (${pct.toFixed(3)}%)  max=${maxPct}%  → ${diffPath}`,
);
process.exit(pct <= maxPct ? 0 : 1);
