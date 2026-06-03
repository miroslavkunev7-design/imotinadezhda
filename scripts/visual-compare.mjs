#!/usr/bin/env node
/**
 * Visual comparison between the LIVE published site and a target URL
 * (defaults to the local dev preview / clone HTML).
 *
 * Renders both URLs at desktop (1366×768) and mobile (375×812) viewports
 * using headless Chromium via Playwright, saves screenshots side by side,
 * and writes a comparison HTML report.
 *
 * Usage:
 *   bun add -D playwright
 *   bunx playwright install chromium
 *   node scripts/visual-compare.mjs                                  # compare live vs local /
 *   node scripts/visual-compare.mjs https://example.com /home-clone  # custom target
 *   node scripts/visual-compare.mjs --out /mnt/documents/visual      # custom out dir
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flag = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const LIVE = args[0] ?? "https://imotinadezhda.lovable.app/";
const TARGET = args[1] ?? "http://localhost:8080/";
const OUT = resolve(flag("out", "/mnt/documents/visual-compare"));

const VIEWPORTS = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "mobile", width: 375, height: 812 },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const rows = [];

for (const vp of VIEWPORTS) {
  for (const [label, url] of [["live", LIVE], ["target", TARGET]]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    console.log(`→ ${label} @ ${vp.name}: ${url}`);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    } catch (e) {
      console.warn(`  load warning: ${e.message}`);
    }
    await page.waitForTimeout(800);
    const file = `${vp.name}-${label}.png`;
    await page.screenshot({ path: resolve(OUT, file), fullPage: true });
    await ctx.close();
  }
  rows.push(`
  <h2>${vp.name} (${vp.width}×${vp.height})</h2>
  <div class="row">
    <figure><figcaption>LIVE — ${LIVE}</figcaption><img src="${vp.name}-live.png"></figure>
    <figure><figcaption>TARGET — ${TARGET}</figcaption><img src="${vp.name}-target.png"></figure>
  </div>`);
}

await browser.close();

writeFileSync(
  resolve(OUT, "report.html"),
  `<!doctype html><meta charset=utf-8><title>Visual compare</title>
<style>
  body{font-family:system-ui;margin:24px;background:#0e0a0b;color:#f4e9d0}
  h1{color:#C9A84C}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  figure{margin:0;background:#1a0d10;padding:8px;border:1px solid #5e0f1d;border-radius:8px}
  figcaption{font-size:12px;margin-bottom:6px;color:#C9A84C}
  img{width:100%;height:auto;display:block;background:#fff}
</style>
<h1>Имоти Надежда — визуално сравнение</h1>
<p>LIVE: <code>${LIVE}</code> · TARGET: <code>${TARGET}</code></p>
${rows.join("\n")}`,
);

console.log(`\n✓ Done. Open ${OUT}/report.html`);
