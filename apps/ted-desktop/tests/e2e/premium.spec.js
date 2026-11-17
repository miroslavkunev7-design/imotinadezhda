// 0.1.5 (Builder C): the premium look (solid menus and settings pages, contrast WCAG AA, typography of the bundled fonts),
// project folders (Папка tab, ZIP, „Запази в сайта“ only after approval, agent create/zip), the property upload from the
// chat (data + photos → card → created → photos into the gallery) and the CRM skills done in the program.
// Mock build only; all data is fictional; screenshots go to $TED_SHOTS_DIR.
import { test, expect } from "@playwright/test";
import { PHONE, guard, login, mockCalls, noHorizontalScroll, openSettings, send, shot } from "./helpers.js";

const AGENT = "lat=120&rg=1&consent=all&agent=1&rgStep=10&agentStep=60";
const SHOT_DESKTOP = { width: 1366, height: 820 }; // the owner's screenshots: desktop 1366×820, phone 400×860
test.use({ viewport: SHOT_DESKTOP });
const rgAnswer = (page) => page.locator('.msg.a[data-engine="realgpt"]').last();
async function pickRgModel(page, name = "Тест GPT А") {
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("model-btn")).toContainText("Real GPT · " + name);
}

// WCAG contrast of every visible text in `selector` against the opaque background behind it (computed colours; a
// gradient counts with its worst stop). -> [{text, ratio, need}] of the failures.
async function contrastFailures(page, selector) {
  return page.evaluate((sel) => {
    const rgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ""); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
    function backgrounds(el) {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        // Several layered gradients: the first fully opaque one is what the text sits on (a glow on top is ignored).
        for (const layer of (cs.backgroundImage || "").split(/(?=(?:repeating-)?(?:linear|radial|conic)-gradient\()/)) {
          const stops = [...layer.matchAll(/rgba?\([^)]+\)/g)].map((m) => rgb(m[0]));
          if (stops.length && stops.every((c) => c.a >= 0.9) && !/transparent/.test(layer)) return stops;
        }
        const bc = rgb(cs.backgroundColor);
        if (bc && bc.a >= 0.9) return [bc];
      }
      return [{ r: 255, g: 255, b: 255, a: 1 }];
    }
    const out = [];
    for (const root of document.querySelectorAll(sel)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.textContent.trim();
        const el = n.parentElement;
        if (!t || !el || !el.getClientRects().length) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || Number(cs.opacity) < 0.5 || cs.color === "rgba(0, 0, 0, 0)" || /transparent/.test(cs.webkitTextFillColor || "")) continue;
        const fg = rgb(cs.color);
        const size = parseFloat(cs.fontSize);
        const big = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
        const need = big ? 3 : 4.5;
        const worst = Math.min(...backgrounds(el).map((bg) => ratio(blend(fg, bg), bg)));
        if (worst < need) out.push({ text: t.slice(0, 40), ratio: Math.round(worst * 100) / 100, need, cls: String(el.className).slice(0, 40) });
      }
    }
    return out;
  }, selector);
}

test("menus and settings pages: solid sheets (no blur) with readable text – WCAG AA on computed colours", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=50&rg=1&consent=all");
  // The „+“ menu: an opaque ivory sheet, clearly above the dark window.
  await page.locator(".c-plus").click();
  const pop = page.locator(".pop");
  await expect(pop).toBeVisible();
  const look = await pop.evaluate((el) => { const cs = getComputedStyle(el); return { bf: cs.backdropFilter, bg: cs.backgroundImage, border: cs.borderTopColor }; });
  expect(look.bf).toBe("none");
  expect(look.bg).toMatch(/rgb\(255, 253, 248\)/);
  expect(await contrastFailures(page, ".pop")).toEqual([]);
  await shot(page, "c-desktop-plus.png");
  await page.keyboard.press("Escape");
  // The model menu (groups, engine notes, the selected row).
  await page.getByTestId("model-btn").click();
  await expect(page.locator(".pop .grp").first()).toBeVisible();
  expect(await contrastFailures(page, ".pop")).toEqual([]);
  await page.keyboard.press("Escape");
  // Settings: every page title big and serif, every page readable.
  await openSettings(page);
  // Every pane of the list (review: „Плъгини“/apps and the others were not checked) – only „Излизане“ is not a pane.
  const rows = await page.locator(".modal .set-row[data-row]").evaluateAll((els) => els.map((e) => e.dataset.row).filter((r) => r !== "logout"));
  expect(rows.length).toBeGreaterThanOrEqual(15);
  for (const row of rows) {
    await page.locator(`.modal .set-row[data-row="${row}"]`).click();
    const pane = page.locator(`.pane[data-pane="${row}"]`);
    await expect(pane).toBeVisible();
    await page.mouse.move(1, 400);
    await page.waitForTimeout(300); // colour transitions of the rows (.18 s) settle before the colours are read
    const h = await pane.locator("h3").first().evaluate((el) => { const cs = getComputedStyle(el); return { size: parseFloat(cs.fontSize), family: cs.fontFamily, weight: cs.fontWeight }; });
    expect(h.size, row).toBeGreaterThanOrEqual(24);
    expect(h.family, row).toMatch(/^"?PT Serif Local/);
    expect(h.weight).toBe("700");
    const fails = await contrastFailures(page, `.pane[data-pane="${row}"], .modal .sv-list`);
    expect(fails, row).toEqual([]);
    // The selected row of the list is unmistakable: the wine band.
    const on = await page.locator(`.modal .set-row[data-row="${row}"]`).evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(on).toMatch(/linear-gradient/);
  }
  await page.locator('.modal .set-row[data-row="general"]').click();
  await shot(page, "c-desktop-settings-general.png");
  await page.locator('.modal .set-row[data-row="voice"]').click();
  await shot(page, "c-desktop-settings-voice.png");
  await g.check();
});

test("typography: the bundled fonts only, larger titles, crisp text; no blur layer anywhere", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(SHOT_DESKTOP);
  await login(page, "lat=50&long=2");
  await page.evaluate(() => document.fonts.ready);
  const t = await page.evaluate(() => {
    const cs = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el) : null; };
    const h1 = cs(".home h1");
    const body = getComputedStyle(document.body);
    const families = new Set();
    let thin = 0;
    for (const el of document.querySelectorAll(".shell *")) {
      if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const s = getComputedStyle(el);
      families.add(s.fontFamily.split(",")[0].replace(/"/g, "").trim());
      if (Number(s.fontWeight) < 400) thin++;
    }
    const blur = [...document.querySelectorAll("*")].filter((el) => { const f = getComputedStyle(el).backdropFilter; return f && f !== "none"; }).length;
    return {
      h1: { size: parseFloat(h1.fontSize), family: h1.fontFamily, weight: h1.fontWeight },
      body: { family: body.fontFamily, rendering: body.textRendering, kerning: body.fontKerning, synth: body.fontSynthesisWeight },
      families: [...families], thin, blur,
      serif: document.fonts.check('700 24px "PT Serif Local"', "Здравейте"), text: document.fonts.check('400 16px TedText', "Тест"),
    };
  });
  expect(t.h1.size).toBeGreaterThanOrEqual(40); // clamp(32px, 4.3vw, 50px) at 1366 px
  expect(t.h1.family).toMatch(/^"?PT Serif Local/);
  expect(t.h1.weight).toBe("700");
  expect(t.body.family).toMatch(/^TedText/);
  expect(t.body.rendering).toBe("optimizelegibility");
  expect(t.body.kerning).toBe("normal");
  expect(t.body.synth).toBe("none");
  expect(t.families.filter((f) => !["TedText", "PT Serif Local", "ui-monospace"].includes(f))).toEqual([]);
  expect(t.thin).toBe(0);
  expect(t.blur).toBe(0);
  expect(t.serif && t.text).toBe(true);
  await shot(page, "c-desktop-home.png");
  // An answer with headings, a list and a table: serif headings, 17 px body in soft charcoal, contrast AA.
  await page.locator(".side .row .t", { hasText: "Дълъг чат А" }).click();
  const ans = page.locator(".msg.a .ans .md").last();
  await expect(ans).toBeVisible();
  const a = await ans.evaluate((el) => { const cs = getComputedStyle(el); const h = el.querySelector(".mdh"); const hs = getComputedStyle(h); return { size: parseFloat(cs.fontSize), color: cs.color, hSize: parseFloat(hs.fontSize), hFamily: hs.fontFamily }; });
  expect(a.size).toBe(17);
  expect(a.hSize).toBeGreaterThanOrEqual(19.5);
  expect(a.hFamily).toMatch(/^"?PT Serif Local/);
  expect(await contrastFailures(page, ".msg.a .ans .md")).toEqual([]);
  await shot(page, "c-desktop-thread.png");
  await g.check();
});

test("reduced motion: nothing animates", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: SHOT_DESKTOP, locale: "bg-BG" });
  const page = await ctx.newPage();
  await login(page, "lat=50");
  await page.locator(".c-plus").click();
  const anim = await page.evaluate(() => [...document.querySelectorAll("*")].filter((el) => { const s = getComputedStyle(el); return s.animationName !== "none" && parseFloat(s.animationDuration) > 0; }).length);
  expect(anim).toBe(0);
  await ctx.close();
});

test("project folder: add, ZIP via the save dialog, „Запази в сайта“ only after approval, take out", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=50");
  await page.getByTestId("side-projects").click();
  await expect(page.getByTestId("project-item")).toHaveCount(2);
  await page.getByTestId("project-item").first().getByTestId("project-folder-btn").click();
  const folder = page.getByTestId("project-folder");
  await expect(folder).toContainText("Празна папка");
  await expect(folder.getByTestId("folder-zip")).toBeDisabled();
  await page.getByTestId("folder-in").setInputFiles([
    { name: "тестова-скица.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% тестов файл\n") },
    { name: "тестови-бележки.txt", mimeType: "text/plain", buffer: Buffer.from("Тестови бележки за клиента.") },
  ]);
  await expect(folder.getByTestId("folder-item")).toHaveCount(2);
  await expect(folder).toContainText("2 файла");
  let calls = await mockCalls(page);
  expect(calls.filesAdd.map((c) => c.caseId)).toEqual(["case-test-1", "case-test-1"]);
  // „Изтегли папката“: one ZIP, written where the employee picks.
  await folder.getByTestId("folder-zip").click();
  await expect(page.locator(".toast")).toContainText("Тестов казус · продажба.zip");
  calls = await mockCalls(page);
  expect(calls.projZip[0]).toMatchObject({ caseId: "case-test-1", names: expect.arrayContaining(["тестова-скица.pdf", "тестови-бележки.txt"]) });
  // „Запази в сайта“: the card shows the target and the exact files; a refused Windows dialog uploads nothing.
  await folder.getByTestId("folder-crm").click();
  const modal = page.locator(".modal", { hasText: "Запази папката в сайта" });
  await expect(modal).toContainText("тестова-скица.pdf");
  await expect(modal.locator("#crm-client")).toHaveValue("Тестов Клиент А");
  await shot(page, "c-desktop-folder-crm-card.png");
  await page.evaluate(() => window.__tedMock.setConfirm(false));
  await modal.getByTestId("crm-save-go").click();
  await expect(page.locator(".toast")).toContainText("нищо не е качено");
  expect((await mockCalls(page)).site.filter((c) => /files\.attach/.test(c.fn))).toEqual([]);
  await page.evaluate(() => window.__tedMock.setConfirm(true));
  await modal.getByTestId("crm-save-go").click();
  await expect(modal.getByTestId("crm-save-result")).toContainText("2 записани");
  calls = await mockCalls(page);
  expect(calls.projCrm.pop()).toMatchObject({ caseId: "case-test-1", target: { clientName: "Тестов Клиент А" } });
  await modal.getByRole("button", { name: "Готово" }).click();
  await expect(folder.getByTestId("folder-item").first()).toContainText("Записано: CRM: клиент Тестов Клиент А");
  await shot(page, "c-desktop-folder.png");
  // Take one out of the folder (it stays in the Библиотека).
  await folder.getByTestId("folder-remove").first().click();
  await expect(folder.getByTestId("folder-item")).toHaveCount(1);
  await page.getByTestId("side-library").click();
  await expect(page.locator(".lib-it")).toHaveCount(2);
  await expect(page.getByTestId("lib-proj-tag")).toHaveCount(1);
  await page.locator("#lib-proj").selectOption({ label: "📁 Тестов казус · продажба" });
  await expect(page.locator(".lib-it")).toHaveCount(1);
  await g.check();
});

test("Real GPT in a Проект: attachments and Ted's files go into the folder; „събирай в папка“ and the ZIP from chat", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await page.getByTestId("side-projects").click();
  await page.getByTestId("project-item").first().getByRole("button", { name: "Нов чат" }).click();
  await expect(page.getByTestId("case-pill")).toContainText("Тестов казус · продажба");
  await page.setInputFiles('[data-testid="files-in"]', { name: "тестов-договор.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("PK\u0003\u0004 тестов word/document.xml") });
  await expect(page.locator(".cfile")).toContainText("тестов-договор.docx");
  await send(page, "Преработи договора");
  await expect(rgAnswer(page).locator(".macts")).toBeVisible({ timeout: 15000 });
  let files = await page.evaluate(() => window.__tedMock.files());
  expect(files.filter((f) => f.caseId === "case-test-1").map((f) => f.name).sort()).toEqual(["Преработен – тестов-договор.docx", "тестов-договор.docx"]);
  // „Запази в папката“ under the answer.
  await rgAnswer(page).getByTestId("save-to-folder").click();
  await expect(page.locator(".toast")).toContainText("в папката на проекта");
  files = await page.evaluate(() => window.__tedMock.files());
  expect(files.some((f) => f.caseId === "case-test-1" && /^Отговор на Тед.*\.md$/.test(f.name) && f.origin === "ted")).toBe(true);
  // The ZIP from the chat: a FileCard with „Запази…“, outside the folder.
  await send(page, "Изтегли папката като zip");
  const a = rgAnswer(page);
  await expect(a.getByTestId("file-card").filter({ hasText: ".zip" })).toBeVisible({ timeout: 15000 });
  await expect(a.getByTestId("file-card").filter({ hasText: ".zip" }).getByRole("button", { name: "Отвори" })).toHaveCount(0);
  // A new project from the chat: a card for cases.create first.
  await page.getByTestId("side-new").click();
  await send(page, "Събирай всичко за Тестов Клиент В в папка");
  const b = rgAnswer(page);
  const ap = b.getByTestId("approval-card");
  await expect(ap).toContainText("cases.create");
  await ap.getByRole("button", { name: "Разреши", exact: true }).click();
  await expect(b).toContainText("Създадох проекта", { timeout: 15000 });
  files = await page.evaluate(() => window.__tedMock.files());
  expect(files.find((f) => f.name === "Тестово досие на клиента.docx")).toMatchObject({ caseTitle: "Тестов клиент В · папка" });
  await g.check();
});

test("property upload from the chat: data + photos → card → created P-1042 → card → photos in the gallery", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 48, height: 36 } });
  await pickRgModel(page);
  await page.setInputFiles('[data-testid="files-in"]', [
    { name: "тест-хол.png", mimeType: "image/png", buffer: png },
    { name: "тест-кухня.png", mimeType: "image/png", buffer: png },
  ]);
  await expect(page.locator(".cfile")).toHaveCount(2);
  await send(page, "Качи нов имот: двустаен в Тестоград, Център, 65 м², 99 000 €, продажба");
  const a = rgAnswer(page);
  const card = a.getByTestId("approval-card");
  await expect(card).toContainText("properties.create");
  await expect(card).toContainText("Тестов двустаен апартамент, Център");
  // Values in Bulgarian, not machine words (review): „продажба“, „99 000 €“; the photo card has its own title.
  await expect(card).toContainText("Цена99 000 €");
  await expect(card).toContainText("Сделкапродажба"); // the exact JSON below still says what is sent ("sale")
  await shot(page, "c-desktop-property-approval.png");
  await card.getByRole("button", { name: "Разреши", exact: true }).click();
  const photos = a.getByTestId("approval-card");
  await expect(photos).toContainText("images.download");
  await expect(photos).toContainText("тест-хол.jpg");
  await expect(photos).toContainText("ChatGPT иска да добави 2 снимки в галерията на имот P-1042");
  await expect(photos.getByRole("button", { name: /Разреши всички/ })).toHaveCount(0); // never covered by „всички“
  await photos.getByRole("button", { name: "Разреши", exact: true }).click();
  await expect(a).toContainText("P-1042", { timeout: 15000 });
  await expect(a).toContainText("в галерията на имота");
  await expect(a.locator(".macts")).toBeVisible();
  const calls = await mockCalls(page);
  expect(calls.approve.map((x) => x.decision)).toEqual(["allow", "allow"]);
  expect(calls.rgSend.pop().files).toHaveLength(2);
  await a.getByTestId("activity-line").click();
  await expect(a.getByTestId("activity-body")).toContainText("Качвам „тест-хол.jpg“ в хранилището на CRM");
  await expect(a.getByTestId("activity-body")).toContainText("2 снимки в галерията на P-1042");
  await expect(a.getByTestId("activity-text")).toContainText("добави 2 снимки в галерията");
  await expect(a.getByTestId("activity-text")).not.toContainText("от CRM");
  await g.check();
});

test("property upload with missing data: Ted asks once, nothing is written", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Качи нов имот");
  const a = rgAnswer(page);
  await expect(a).toContainText("ми трябват още");
  await expect(a.getByTestId("approval-card")).toHaveCount(0);
  expect((await mockCalls(page)).approve).toEqual([]);
  await g.check();
});

test("CRM skills of the site are done here; only „Моята поща“ sends to the CRM, saying why", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=50");
  await page.getByTestId("side-agents").click();
  await expect(page.getByTestId("agents-page")).not.toContainText("работят в CRM на сайта");
  await page.locator(".gcard", { hasText: "АИ Качване на имот" }).click();
  const m = page.locator(".modal");
  await expect(m).not.toContainText("не се стартира");
  await expect(m).toContainText("Тед качва имота и тук");
  await m.getByTestId("skill-here").click();
  await expect(page.locator("#composer")).toHaveValue("Качи нов имот в CRM: ");
  await page.getByTestId("side-agents").click();
  await page.locator(".gcard", { hasText: "Моята поща" }).click();
  await expect(page.locator(".modal")).toContainText("паролата на пощата");
  await expect(page.locator(".modal").getByTestId("skill-here")).toHaveCount(0);
  await expect(page.locator(".modal").getByRole("button", { name: "Отвори в CRM" })).toBeVisible();
  await g.check();
});

test("phone 400×860: menu, settings page, project folder and the property card fit", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(PHONE);
  await login(page, AGENT);
  await shot(page, "c-phone-home.png");
  await page.locator(".c-plus").click();
  await expect(page.locator(".pop")).toBeVisible();
  expect(await contrastFailures(page, ".pop")).toEqual([]);
  await shot(page, "c-phone-plus.png");
  await page.keyboard.press("Escape");
  await openSettings(page, "voice");
  expect(await contrastFailures(page, '.pane[data-pane="voice"]')).toEqual([]);
  await shot(page, "c-phone-settings-voice.png");
  await page.keyboard.press("Escape");
  await page.locator(".top.ph").getByRole("button", { name: "Меню" }).click();
  await page.getByTestId("side-projects").click();
  await page.getByTestId("project-item").first().getByTestId("project-folder-btn").click();
  await page.getByTestId("folder-in").setInputFiles({ name: "тестова-скица.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%тест\n") });
  await expect(page.getByTestId("folder-item")).toHaveCount(1);
  await noHorizontalScroll(page);
  await shot(page, "c-phone-folder.png");
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: /Тест GPT А/ }).click();
  await page.locator(".top.ph").getByRole("button", { name: "Меню" }).click();
  await page.getByTestId("drawer-new").click();
  await send(page, "Качи нов имот: двустаен в Тестоград, 65 м², 99 000 €, продажба");
  await expect(rgAnswer(page).getByTestId("approval-card")).toBeVisible({ timeout: 15000 });
  await noHorizontalScroll(page);
  await shot(page, "c-phone-property-approval.png");
  await g.check();
});
