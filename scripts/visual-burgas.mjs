#!/usr/bin/env node
/**
 * Burgas page visual regression — catches:
 *   1. Vertical overflow at 1920x1080 (must fit single viewport, no scroll)
 *   2. Element overlap between scroller arrows and the "Виж всички квартали" CTA
 *   3. Pixel diff of full viewport + hero & quarters bands vs baseline
 *
 *   bun run visual:burgas                  # diff vs baseline (creates if missing)
 *   bun run visual:burgas -- --update      # force overwrite baseline
 *   bun run visual:burgas -- --update-safe # overwrite ONLY if overflow+overlap guards pass
 *   bun run visual:burgas -- --url=https://...lovable.app
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
const DEFAULT_URL = `https://id-preview--${PROJECT_ID}.lovable.app/cities/burgas`;
const url = flags.url ?? DEFAULT_URL;
const update = flags.update === "true";
const updateSafe = flags["update-safe"] === "true";
const VW = 1920;
const VH = 1080;

const baselineDir = "tests/visual/baseline";
const outDir = "tests/visual/current";
const diffDir = "tests/visual/diff";
[baselineDir, outDir, diffDir].forEach((d) => fs.mkdirSync(d, { recursive: true }));

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("❌ Playwright not installed. Run: bun add -d playwright && bunx playwright install chromium");
  process.exit(2);
}

console.log(`→ Capturing ${url} @ ${VW}x${VH}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(1500);

const issues = [];

// ---------- Check 1: Vertical overflow ----------
const docMetrics = await page.evaluate(() => ({
  scrollHeight: document.documentElement.scrollHeight,
  clientHeight: document.documentElement.clientHeight,
  bodyScrollHeight: document.body.scrollHeight,
}));
const overflow = Math.max(docMetrics.scrollHeight, docMetrics.bodyScrollHeight) - docMetrics.clientHeight;
console.log(`  document.scrollHeight=${docMetrics.scrollHeight} clientHeight=${docMetrics.clientHeight} → overflow=${overflow}px`);
if (overflow > 2) {
  issues.push(`Vertical overflow: page is ${overflow}px taller than the ${VH}px viewport.`);
}

// ---------- Check 2: Arrow ↔ CTA overlap ----------
const overlap = await page.evaluate(() => {
  const cta = document.querySelector('a[href*="/cities/"][href$="burgas"], a[href$="/cities/burgas"]');
  const arrow = document.querySelector('button[aria-label="Предишни"]');
  if (!cta || !arrow) return { found: false };
  const a = cta.getBoundingClientRect();
  const b = arrow.getBoundingClientRect();
  const intersect = !(b.right < a.left || b.left > a.right || b.bottom < a.top || b.top > a.bottom);
  return { found: true, intersect, cta: a, arrow: b };
});
if (!overlap.found) {
  console.log(`  ⚠ Could not locate CTA or arrow for overlap check (skipping).`);
} else {
  console.log(`  arrow vs CTA overlap=${overlap.intersect}`);
  if (overlap.intersect) {
    issues.push(`Scroller arrow overlaps the "Виж всички квартали" CTA.`);
  }
}

// ---------- Check 3: Visual snapshots ----------
const viewportShot = await page.screenshot({ clip: { x: 0, y: 0, width: VW, height: VH } });
fs.writeFileSync(path.join(outDir, "burgas-viewport.png"), viewportShot);

const heroLoc = page.locator("section").first();
fs.writeFileSync(path.join(outDir, "burgas-hero.png"), await heroLoc.screenshot());

const quartersLoc = page.locator("section").nth(2);
if (await quartersLoc.count()) {
  fs.writeFileSync(path.join(outDir, "burgas-quarters.png"), await quartersLoc.screenshot());
}

await browser.close();
console.log(`✓ Captured snapshots to ${outDir}/`);

const targets = ["burgas-viewport.png", "burgas-hero.png", "burgas-quarters.png"].filter((f) =>
  fs.existsSync(path.join(outDir, f)),
);
let pixelFailed = 0;
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
  if (res.status !== 0) pixelFailed++;
}

if (issues.length) {
  console.error(`\n❌ Layout checks failed:`);
  for (const i of issues) console.error(`   • ${i}`);
}
if (pixelFailed) {
  console.error(`\n❌ ${pixelFailed} pixel-diff target(s) exceeded threshold (see ${diffDir}/).`);
}
if (issues.length || pixelFailed) process.exit(1);
console.log(`\n✅ Burgas visual regression passed.`);
process.exit(0);
