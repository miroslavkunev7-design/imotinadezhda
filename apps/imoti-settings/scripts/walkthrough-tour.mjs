/**
 * Guided Bulgarian walkthrough of Imoti Nadezhda Settings (Vite renderer).
 * Records Playwright video → copies to store + artifacts.
 */
import { chromium } from "playwright";
import { mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "walkthrough-out");
const STORE_MP4 =
  "/cursor/stores/bc-01a19876-3883-7511-ae72-cb6e59cf6bcc/media/settings-app/settings-walkthrough.mp4";
const ARTIFACT_MP4 = "/opt/cursor/artifacts/settings-walkthrough.mp4";
const BASE = process.env.SETTINGS_URL || "http://127.0.0.1:5179/?walkthrough=1";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function caption(page, text, holdMs = 2800) {
  await page.evaluate((t) => {
    window.__setWalkthroughCaption?.(t);
  }, text);
  await sleep(holdMs);
}

async function clickTab(page, label) {
  await page.locator(".nav-tabs button", { hasText: label }).click();
  await sleep(600);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(dirname(STORE_MP4), { recursive: true });
  mkdirSync(dirname(ARTIFACT_MP4), { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage"]
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } }
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await sleep(1200);

  await caption(
    page,
    "Добре дошли в Imoti Nadezhda Settings — Windows програма за управление на живия сайт.",
    3500
  );

  await caption(
    page,
    "Горен ред: лого, заглавие, Reload preview (презарежда прегледа) и Sign out.",
    3200
  );
  await page.locator("button.ghost", { hasText: "Reload preview" }).hover();
  await sleep(900);

  await caption(
    page,
    "Странично меню: Pages, Agent, Archive, Cities, Bank и Display (резолюция).",
    3200
  );

  // ——— Pages ———
  await clickTab(page, "Pages");
  await caption(
    page,
    "Pages — избирате страница от живия сайт и редактирате CMS компоненти.",
    3200
  );

  const pageButtons = page.locator("aside .page-btn");
  const pageCount = await pageButtons.count();
  for (let i = 0; i < Math.min(pageCount, 6); i++) {
    const label = (await pageButtons.nth(i).innerText()).split("\n")[0].trim();
    await pageButtons.nth(i).click();
    await caption(page, `Страница: ${label} — компонентите отдолу важат за този slug.`, 2200);
  }

  await caption(
    page,
    "Компоненти — списък с overrides (цвят, форма, снимка, melt, височина, меню).",
    3000
  );
  const compBtns = page.locator("aside .comp-btn");
  const compCount = await compBtns.count();
  for (let i = 0; i < compCount; i++) {
    const key = (await compBtns.nth(i).innerText()).split("\n")[0].trim();
    await compBtns.nth(i).click();
    await caption(page, `Редактор за компонент „${key}“.`, 2000);
  }

  await page.locator("button.primary", { hasText: "+ New component" }).click();
  await caption(
    page,
    "New component — създава нов override. Типове: Color, Shape, Image, Melt, Section height, Dropdown.",
    3400
  );

  const typeSelect = page.locator('.main select').first();
  for (const type of ["color", "shape", "image", "melt", "section_height", "dropdown"]) {
    await typeSelect.selectOption(type);
    const bgLabels = {
      color: "Color — CSS променлива и цвят (напр. --wine).",
      shape: "Shape — кръг, квадрат, закръглен, pill, soft card + CSS селектор.",
      image: "Image — URL/upload на снимка за селектор; опция Melt overlay.",
      melt: "Melt photo — разтопена снимка върху секция от сайта.",
      section_height: "Section height — минимална височина на секция.",
      dropdown: "Dropdown builder — меню → целева карта."
    };
    await caption(page, bgLabels[type], 2600);
  }

  await typeSelect.selectOption("dropdown");
  await page.locator('.field span', { hasText: "Menu label" }).locator("..").locator("input").fill("Банка");
  await page.locator('.field span', { hasText: "Target card key" }).locator("..").locator("input").fill("bank-card");
  await page.locator("button.ghost", { hasText: "Add option" }).click();
  await caption(page, "Добавяте опции в dropdown менюто — етикет и целева карта.", 2600);

  // ——— Agent ———
  await clickTab(page, "Agent");
  await caption(
    page,
    "Agent — TED чат само в Settings. Skill „Видео за имот“ НЕ е на публичния сайт.",
    3600
  );
  await page.locator("select").first().selectOption("property_cinematic_video");
  await caption(
    page,
    "Видео за имот: прикачвате 4–10 снимки → Create video през отделен Settings n8n workflow.",
    3600
  );
  await page.locator("select").first().selectOption("chat");
  await caption(
    page,
    "TED (Settings) — отделен webhook (VITE_SETTINGS_TED_API), без /api/assistant на живия сайт.",
    3400
  );
  await page.locator("select").first().selectOption("property_cinematic_video");
  await sleep(800);

  // ——— Archive ———
  await clickTab(page, "Archive");
  await caption(
    page,
    "Archive — архивира имоти/клиенти в cms_archives (.del стил), без изтриване от CRM.",
    3400
  );
  await sleep(1500);

  // ——— Cities ———
  await clickTab(page, "Cities");
  await caption(
    page,
    "Cities / neighborhoods — CRUD на градове и квартали → cms_settings.cities_override.",
    3400
  );
  const cityBtns = page.locator(".main .page-btn");
  const cityCount = await cityBtns.count();
  for (let i = 0; i < Math.min(cityCount, 4); i++) {
    const name = (await cityBtns.nth(i).innerText()).split("\n")[0].trim();
    await cityBtns.nth(i).click();
    await caption(page, `Град ${name}: добавяне/премахване на квартали.`, 2000);
  }
  await page.locator('.field span', { hasText: "City name" }).locator("..").locator("input").fill("Пловдив");
  await page.locator('.field span', { hasText: "Slug" }).locator("..").locator("input").fill("plovdiv");
  await caption(page, "Можете да добавите нов град с име и slug, после квартали.", 2800);

  // ——— Bank ———
  await clickTab(page, "Bank");
  await caption(
    page,
    "Bank — луксозни витрини за банки: име, brand цвят, luxury снимка; live ипотечни лихви.",
    3600
  );
  const bankBtns = page.locator(".main .page-btn");
  const bankCount = await bankBtns.count();
  for (let i = 0; i < Math.min(bankCount, 4); i++) {
    const name = (await bankBtns.nth(i).innerText()).split("\n")[0].trim();
    await bankBtns.nth(i).click();
    await caption(page, `Банка ${name}: редакция на цвят и luxury asset; Save bank assets.`, 2400);
  }
  await sleep(1200);

  // ——— Display ———
  await clickTab(page, "Display");
  await caption(
    page,
    "Display / Resolution — съотношение на preview и device frame (Desktop / Laptop / Mobile).",
    3400
  );
  const range = page.locator('input[type="range"]');
  await range.fill("0.6");
  await sleep(700);
  await range.fill("0.36");
  await sleep(700);
  await page.locator("select").selectOption("laptop");
  await caption(page, "Laptop 1280×800 — превключвате рамката на прегледа.", 2400);
  await page.locator("select").selectOption("mobile");
  await caption(page, "Mobile 390×844 — мобилен преглед на живия сайт.", 2400);
  await page.locator("select").selectOption("desktop");
  await caption(
    page,
    "Инсталация по подразбиране: D:\\ImotiNadezhda-Settings (NSIS / portable).",
    3000
  );

  // ——— Finale ———
  await clickTab(page, "Pages");
  await caption(
    page,
    "Край на обиколката: Pages + редактори, Agent „Видео за имот“, Archive, Cities, Bank, Display.",
    4000
  );
  await caption(page, "Imoti Nadezhda Settings — готов за Windows x64.", 2800);
  await page.evaluate(() => window.__setWalkthroughCaption?.(""));

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();

  // Playwright writes webm; convert to mp4
  const webm = videoPath;
  const tmpMp4 = join(OUT_DIR, "settings-walkthrough.mp4");
  console.log("Recorded:", webm);
  execSync(
    `ffmpeg -y -i ${JSON.stringify(webm)} -c:v libx264 -pix_fmt yuv420p -movflags +faststart ${JSON.stringify(tmpMp4)}`,
    { stdio: "inherit" }
  );

  copyFileSync(tmpMp4, STORE_MP4);
  copyFileSync(tmpMp4, ARTIFACT_MP4);

  const st = statSync(STORE_MP4);
  let duration = "?";
  try {
    duration = execSync(
      `ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 ${JSON.stringify(STORE_MP4)}`,
      { encoding: "utf8" }
    ).trim();
  } catch {
    /* ignore */
  }

  console.log(
    JSON.stringify(
      {
        store: STORE_MP4,
        artifact: ARTIFACT_MP4,
        bytes: st.size,
        durationSec: Number(duration),
        webm
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
