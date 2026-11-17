// Fixes from the 0.1.3 review (FIXER): updates when „Автоматично…“ is off, focus after the first question, every chat
// in „Вижте всички…“, the Canvas belongs to one chat, Чат | Работа on pages, readable model name, the „+“ menu keeps
// its side, „Мислене“ raises a low effort, the light segmented control, the phone Плъгини rows, the Library link to
// the chat of an agent-made file, and small arrangement polish. Mock build only; every value is fictional.
import { test, expect } from "@playwright/test";
import { PHONE, guard, login, mockCalls, openSettings, send } from "./helpers.js";

const AGENT = "lat=200&rg=1&consent=all&agent=1&rgStep=12&agentStep=60";
const rgAnswer = (page) => page.locator('.msg.a[data-engine="realgpt"]').last();
const finished = (a) => expect(a.locator(".macts")).toBeVisible({ timeout: 15000 });
async function pickRgModel(page, name = "Тест GPT А") {
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("model-btn")).toContainText("Real GPT · " + name);
}
async function openCanvasFromPlus(page) {
  await page.locator(".c-plus").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Още/ }).click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Canvas/ }).click();
}

test("updates with „Автоматично изтегляне и инсталиране“ off: honest texts and an „Изтегли“ button", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=150&upd=ready");
  await openSettings(page);
  const upd = page.getByTestId("updates");
  await expect(upd.getByTestId("upd-status")).toContainText("Ще се инсталира при затваряне на програмата.");
  await upd.locator("#sw-upd-auto").click();
  await expect(upd.getByTestId("upd-status")).toHaveText("Версия 0.1.4-test е изтеглена и проверена. Ще се инсталира, когато натиснете „Рестартирай и обнови“.");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("upd-banner")).toContainText("Ще се инсталира, когато натиснете „Рестартирай и обнови“.");

  // A new version is available and nothing downloads by itself: „Изтегли“ (ted.updates.download) does it.
  await page.evaluate(() => window.__tedMock.setUpd("available"));
  await openSettings(page);
  await upd.locator("#sw-upd-auto").click(); // the mock state of setUpd starts with auto on
  await expect(upd.getByTestId("upd-status")).toHaveText("Има нова версия 0.1.4-test. Натиснете „Изтегли“.");
  await upd.getByTestId("upd-download").click();
  await expect(upd.getByTestId("upd-status")).toContainText(/Изтеглям версия 0\.1\.4-test|е изтеглена и проверена/);
  await expect(upd.getByTestId("upd-status")).toContainText("когато натиснете „Рестартирай и обнови“");
  expect((await mockCalls(page)).updDownload).toBe(1);
  await g.check();
});

test("the first question from the Home keeps the keyboard in the composer", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  await page.locator("#composer").fill("Първи въпрос");
  await page.keyboard.press("Enter");
  await expect(page.locator(".msg.u")).toContainText("Първи въпрос");
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.id)).toBe("composer");
  await page.keyboard.type("абв");
  await expect(page.locator("#composer")).toHaveValue("абв");
  await g.check();
});

test("„Вижте всички…“ lists every chat, newest first", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=200&chats=33");
  const side = page.locator("aside.side");
  await expect(side.locator(".row", { hasText: /^Чат номер/ })).toHaveCount(20);
  await side.getByTestId("side-all").click();
  const rows = page.locator(".modal .sres .it");
  await expect(rows).toHaveCount(34); // „Нов чат“ + 33 chats
  await expect(rows.nth(1)).toContainText("Чат номер 33");
  await expect(rows.nth(32)).toContainText("Чат номер 2");
  await expect(rows.nth(33)).toContainText("Чат номер 1");
  await rows.nth(33).click();
  await expect(page.locator(".msg.u")).toContainText("Тестов въпрос 1");
  await g.check();
});

test("the Canvas belongs to its chat: not shown or sent in another chat, back with its chat", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await openCanvasFromPlus(page);
  await expect(page.getByTestId("canvas-pill")).toContainText("Canvas: Нов документ"); // the composer says it goes along
  await page.fill("#cv-txt", "Чернова на договор");
  await send(page, "Напиши договор за наем в Canvas");
  await finished(rgAnswer(page));
  expect((await mockCalls(page)).rgSend.at(-1).canvas).toBeTruthy();
  const first = page.locator("aside.side .row", { hasText: "Напиши договор за наем" });

  await page.getByTestId("side-new").click();
  await expect(page.getByTestId("canvas")).toHaveCount(0);
  await expect(page.getByTestId("canvas-pill")).toHaveCount(0);
  await send(page, "Друг въпрос без документ");
  await rgAnswer(page).getByTestId("approval-card").getByRole("button", { name: "Откажи" }).click();
  await finished(rgAnswer(page));
  expect((await mockCalls(page)).rgSend.at(-1).canvas).toBeUndefined(); // nothing of the other chat's Canvas went along

  await first.click();
  await expect(page.getByTestId("canvas")).toBeVisible();
  await expect(page.locator("#cv-ver option")).toContainText(["Тед: първа чернова"]);
  await expect(page.locator("#cv-ver option")).toContainText(["ваша незапазена редакция"]);
  // Removing the tag closes the Canvas: nothing goes with the next question.
  await page.getByTestId("canvas-pill").getByRole("button", { name: "Затвори Canvas" }).click();
  await expect(page.getByTestId("canvas")).toHaveCount(0);
  await g.check();
});

test("Чат | Работа on a page opens that mode's start screen; arrow keys move between the tabs", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=200&lib=1");
  await page.locator("aside.side").getByTestId("side-library").click();
  await expect(page.getByTestId("library-page")).toBeVisible();
  const toggle = page.getByTestId("mode-toggle");
  await toggle.getByRole("tab", { name: "Работа" }).click();
  await expect(page.getByTestId("library-page")).toHaveCount(0);
  await expect(page.locator(".home h1")).toHaveText("Върху какво ще работим?");
  const chat = toggle.getByRole("tab", { name: "Чат" });
  await expect(chat).toHaveAttribute("aria-controls", "main-area");
  await chat.focus();
  await page.keyboard.press("ArrowRight"); // from „Чат“ (not selected) the next tab is „Работа“
  await expect(toggle.getByRole("tab", { name: "Работа" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(chat).toHaveAttribute("aria-selected", "true");
  await expect(chat).toBeFocused();
  await expect(page.locator(".home h1")).toContainText("Готови ли сте?");
  await g.check();
});

test("the Real GPT model stays readable at 1024 px; the „+“ menu never covers the top bar and keeps its side", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1024, height: 760 });
  await login(page, AGENT);
  await pickRgModel(page);
  const btn = page.getByTestId("model-btn");
  await expect(btn.locator(".ml-pfx")).toBeHidden();
  await expect(btn).toHaveAttribute("title", "Real GPT · Тест GPT А");
  const span = btn.locator("span").first();
  expect(await span.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true); // not cut with „…“

  const topBottom = (await page.locator(".shell .top").boundingBox()).y + (await page.locator(".shell .top").boundingBox()).height;
  await page.locator(".c-plus").click();
  const pop = page.locator(".pop");
  const root = await pop.boundingBox();
  expect(root.y).toBeGreaterThanOrEqual(topBottom);
  const plus = await page.locator(".c-plus").boundingBox();
  const below = root.y > plus.y;
  for (const name of [/^Последни файлове/, /^Проекти/]) {
    await pop.getByRole("menuitem", { name }).click();
    const box = await pop.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(topBottom);
    expect(box.y > plus.y).toBe(below); // the same side as the first level
    await pop.getByRole("menuitem", { name: /^Назад/ }).click();
  }
  await g.check();
});

test("„Мислене“ raises an explicit „Мигновено“ effort to high for that question", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await page.getByTestId("effort-pill").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Усилие/ }).click();
  await page.locator(".pop").getByRole("menuitem", { name: /Мигновено/ }).click();
  await page.locator(".c-plus").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Мислене/ }).click();
  await send(page, "Сравни два тестови имота");
  await rgAnswer(page).getByTestId("approval-card").getByRole("button", { name: "Откажи" }).click();
  await finished(rgAnswer(page));
  expect((await mockCalls(page)).rgSend.at(-1)).toMatchObject({ effort: "high", hints: ["thinking"] });
  await send(page, "Още един въпрос");
  await rgAnswer(page).getByTestId("approval-card").getByRole("button", { name: "Откажи" }).click();
  await finished(rgAnswer(page));
  expect((await mockCalls(page)).rgSend.at(-1).effort).toBe("none"); // without the hint the chosen effort stays
  await g.check();
});

test("light sheets: the unselected „Въпрос към Тед“ is readable; phone Плъгини rows do not squeeze the text", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=200&sched=1");
  await page.locator("aside.side").getByTestId("side-scheduled").click();
  await page.getByRole("button", { name: /Нова задача/ }).click();
  const off = page.locator(".sched-form .seg button", { hasText: "Въпрос към Тед" });
  const color = await off.evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe("rgb(88, 13, 34)"); // --ink, not the cream text of the dark bar

  await page.setViewportSize(PHONE);
  await page.locator(".burger").first().click();
  await page.getByTestId("side-plugins").click();
  const crm = page.locator('.conn[data-plugin="crm"] .tx b');
  const lh = await crm.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || 20);
  expect((await crm.boundingBox()).height).toBeLessThan(lh * 1.6); // one line, not „CRM / „Имоти / Надежда““
  await g.check();
});

test("an agent-made file in Библиотека opens its chat", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Намери имоти и запиши оглед");
  const a = rgAnswer(page);
  await a.getByTestId("approval-card").getByRole("button", { name: "Откажи" }).click();
  await finished(a);
  await page.locator("aside.side").getByTestId("side-library").click();
  const item = page.locator(".lib-it", { hasText: "Тестова справка.docx" });
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "Отвори чата" }).click();
  await expect(page.locator(".msg.u").first()).toContainText("Намери имоти и запиши оглед");
  await g.check();
});

test("arrangement polish: disclaimer under the chips, Модел with the app settings, phone drawer logo, no repeated title", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, "lat=200");
  const chips = await page.getByTestId("home-chips").boundingBox();
  const disc = await page.locator(".home .home-disc .disc").boundingBox();
  expect(disc.y).toBeGreaterThan(chips.y + chips.height - 1);
  await openSettings(page);
  const appGroup = page.locator('.set-grp[aria-label="Настройки на приложението"]');
  await expect(appGroup.locator('.set-row[data-row="model"]')).toBeVisible();
  await expect(page.locator('.set-grp[aria-label="Акаунт"] .set-row[data-row="model"]')).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.setViewportSize(PHONE);
  await page.locator(".burger").first().click();
  await expect(page.locator(".ph-drawer .drawer-head .logo-tile img")).toBeVisible();
  await page.locator(".ph-drawer").getByTestId("me-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Настройки/ }).click();
  await page.locator('.set-row[data-row="general"]').click();
  await expect(page.locator(".modal .set-ph .pane > h3").first()).toBeHidden();
  await g.check();
});
