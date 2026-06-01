#!/usr/bin/env node
/**
 * District Page 1:1 visual check — captures header & footer bands and diffs
 * them against `tests/visual/baseline/`. First run seeds the baseline.
 *
 *   bun run visual:district                # diff vs baseline (creates if missing)
 *   bun run visual:district -- --update    # overwrite baseline with current
 *   bun run visual:district -- --url=https://...lovable.app
 *
 * Defaults to the published preview URL. Uses Chromium via Playwright; falls
 * back to a clear error if Chromium isn't available so CI can install on demand.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? "true"];
    }),
);

const PROJECT_ID = "96d88938-791e-487e-8256-6bfbd8c8aa0f";
const DEFAULT_URL = `https://id-preview--${PROJECT_ID}.lovable.app/cities/burgas/districts/lazur`;
const url = flags.url ?? DEFAULT_URL;
const update = flags.update === "true";

const baselineDir = "tests/visual/baseline";
const outDir = "tests/visual/current";
const diffDir = "tests/visual/diff";
[baselineDir, outDir, diffDir].forEach((d) => fs.mkdirSync(d, { recursive: true }));

// Lazy require so the script can at least print a useful error.
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("❌ Playwright not installed. Run: bun add -d playwright && bunx playwright install chromium");
  process.exit(2);
}

console.log(`→ Capturing ${url}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
// Allow font loading + marble background images to settle
await page.waitForTimeout(1500);

const full = await page.screenshot({ fullPage: true });
const fullPath = path.join(outDir, "district-full.png");
fs.writeFileSync(fullPath, full);

// Crop bands using sharp-less approach: take element screenshots instead.
const header = await page.locator("header").first().screenshot();
fs.writeFileSync(path.join(outDir, "district-header.png"), header);

// Footer band = the last <section> or <footer>; fall back to a fixed bottom slice.
const footerLocator = page.locator("footer").first();
let footerBuf;
if (await footerLocator.count()) {
  footerBuf = await footerLocator.screenshot();
} else {
  // Bottom 220px slice of the viewport
  footerBuf = await page.screenshot({
    clip: { x: 0, y: 900 - 220, width: 1440, height: 220 },
  });
}
fs.writeFileSync(path.join(outDir, "district-footer.png"), footerBuf);

await browser.close();
console.log(`✓ Captured header & footer to ${outDir}/`);

const targets = ["district-header.png", "district-footer.png"];
let failed = 0;
for (const name of targets) {
  const baseline = path.join(baselineDir, name);
  const current = path.join(outDir, name);
  if (update || !fs.existsSync(baseline)) {
    fs.copyFileSync(current, baseline);
    console.log(`📌 ${update ? "Updated" : "Seeded"} baseline: ${baseline}`);
    continue;
  }
  const diff = path.join(diffDir, name);
  const res = spawnSync("node", ["scripts/visual-diff.mjs", baseline, current, diff, "--max=3"], {
    stdio: "inherit",
  });
  if (res.status !== 0) failed++;
}
process.exit(failed === 0 ? 0 : 1);
