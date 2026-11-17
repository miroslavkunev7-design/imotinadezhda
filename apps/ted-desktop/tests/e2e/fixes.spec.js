// Defects found by the end-to-end audit of 0.1.1, pinned so they stay fixed (mock build, no network).
import { test, expect } from "@playwright/test";
import { guard, lastAnswer, login, mockCalls, open, send } from "./helpers.js";

const activeIn = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return { id: a ? a.id : "", tag: a ? a.tagName : "", inModal: !!(a && a.closest(".modal")) };
});

test("a double-click on „Изпрати“ sends once and does not stop the request", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=2500");
  await page.fill("#composer", "Двоен клик");
  // While busy the Send button is replaced by Stop at the same spot: the second click of the double-click lands on Stop.
  await page.locator('.snd[aria-label="Изпрати"]').dblclick({ delay: 60 });
  await expect(page.getByTestId("waiting")).toBeVisible();
  await expect(page.getByTestId("stop-note")).toHaveCount(0);
  await expect(lastAnswer(page)).toContainText("Тестов отговор", { timeout: 15000 });
  await expect(page.getByTestId("stop-note")).toHaveCount(0);
  expect((await mockCalls(page)).chat).toHaveLength(1);
  // A deliberate single click on Stop still stops.
  await send(page, "Дълга задача");
  await page.locator('.snd[aria-label="Спри"]').click();
  await expect(page.getByTestId("stop-note")).toContainText("може да бъде довършено");
  await g.check();
});

test("deleting the chat Ted is still answering stops the waiting; the next message can be sent", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=6000");
  await send(page, "Дълга задача");
  await expect(page.getByTestId("waiting")).toBeVisible();
  await page.locator(".side .row", { hasText: "Дълга задача" }).getByRole("button", { name: "Опции на чата" }).click();
  await page.locator(".pop").getByText("Изтрий").click();
  await page.locator(".modal .mf").getByRole("button", { name: "Потвърди" }).click();
  await expect(page.locator(".home h1")).toBeVisible();
  // Checked at once (no retry): the orphaned request must not leave a lone Stop button on the Home screen.
  expect(await page.locator('.snd[aria-label="Спри"]').count()).toBe(0);
  // ...and the next message is not refused with "Тед още отговаря" for the rest of the orphan's 6 s.
  await send(page, "Ново съобщение");
  await expect(lastAnswer(page)).toContainText("Тестов отговор", { timeout: 15000 });
  expect((await mockCalls(page)).chat).toHaveLength(2);
  await g.check();
});

test("a chat title and its export file name are cut by code points (no broken emoji)", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=100");
  await send(page, "а".repeat(47) + "👋 и още текст");
  await expect(lastAnswer(page)).toBeVisible();
  const title = await page.locator(".side .row .t", { hasText: "ааааа" }).first().textContent();
  expect(title.isWellFormed()).toBe(true);
  expect(title).toBe("а".repeat(47) + "👋");
  await page.getByRole("button", { name: "Опции на разговора" }).click();
  await page.getByRole("menuitem", { name: /Експорт/ }).click();
  await expect(page.locator(".toast")).toContainText("Запазено");
  const name = (await mockCalls(page)).saveFile[0];
  expect(name.isWellFormed()).toBe(true);
  expect(name).toBe("а".repeat(47) + "👋.md");
  await g.check();
});

test("after a failed sign-in the focus returns to the password field", async ({ page }) => {
  const g = guard(page);
  await open(page, "lat=200");
  await page.fill("#lg-id", "sluzhitel@example.test");
  await page.fill("#lg-pw", "wrong");
  await page.click(".login-btn");
  await expect(page.locator(".login-card .err")).toContainText("Грешен телефон/имейл или парола.");
  await expect.poll(() => activeIn(page).then((a) => a.id)).toBe("lg-pw");
  await g.check();
});

// In the real program the sign-in screen is taller than the mock's, so at the minimum window (360x560, electron/window.js)
// the card was already clipped; the mock needs a slightly shorter viewport to overflow the same way.
test("the sign-in card is reachable when the window is shorter than the card (360x500)", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 360, height: 500 });
  await open(page, "lat=200");
  const box = await page.locator(".login-card").boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0); // the top of the card (logo) was clipped above the viewport and could not be scrolled to
  await expect(page.locator(".login-logo img")).toBeInViewport();
  const scroll = await page.locator(".login").evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, top: el.scrollTop }));
  expect(scroll.sh).toBeGreaterThan(scroll.ch); // the card is taller than the window: it scrolls instead of being cut
  await page.locator(".login").evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect(page.locator(".login-btn")).toBeInViewport();
  await g.check();
});

test("Escape closes only the topmost dialog; Tab stays inside an open dialog", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  await page.getByRole("button", { name: "Настройки" }).first().click();
  await expect(page.locator(".modal")).toHaveCount(1);
  // Tab never leaves the dialog (the composer behind it would send on Enter).
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    const a = await activeIn(page);
    expect(a.inModal, "Tab " + (i + 1) + " left the dialog: " + a.tag + "#" + a.id).toBe(true);
  }
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Shift+Tab");
    const a = await activeIn(page);
    expect(a.inModal, "Shift+Tab " + (i + 1) + " left the dialog: " + a.tag + "#" + a.id).toBe(true);
  }
  await page.keyboard.type("Зад диалога");
  await expect(page.locator("#composer")).toHaveValue("");
  expect((await mockCalls(page)).chat).toHaveLength(0);
  await expect(page.locator(".modal")).toHaveCount(1);

  // A confirmation over Settings: one Escape closes the confirmation, Settings stays; the next one closes Settings.
  await page.getByRole("tab", { name: /Данни/ }).click();
  await page.locator(".modal").getByRole("button", { name: "Архивирай" }).click();
  await expect(page.locator(".modal")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal")).toHaveCount(1);
  await expect(page.locator('.pane[data-pane="data"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal")).toHaveCount(0);
  await g.check();
});

test("every refused attachment is named, not only the first", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  await page.locator("input.file-in").nth(1).setInputFiles([
    { name: "setup.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ not a document") },
    { name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(10 * 1024 * 1024, 1) },
  ]);
  const toast = page.locator(".toast");
  await expect(toast).toContainText("Файлът „setup.exe“ не се поддържа");
  await expect(toast).toContainText("Файловете са твърде големи (общо над 3,8 MB) – „big.pdf“ не е добавен.");
  await expect(page.locator(".cfile")).toHaveCount(0);
  await g.check();
});

test("a sign-in that timed out offers a fresh registration (dead issued client id)", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200&rgFail=signin_timeout");
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: /Продължи с ChatGPT/ }).click();
  await page.getByTestId("rg-continue").click();
  await expect(page.locator(".modal .err")).toContainText("не беше завършен");
  await expect(page.getByTestId("rg-new-account")).toBeVisible();
  await page.getByTestId("rg-new-account").click();
  await expect(page.getByTestId("rg-connected")).toBeVisible();
  expect((await mockCalls(page)).rgSignIn).toEqual([{ newAccount: false }, { newAccount: true }]);
  await g.check();
});

test("a dialog opened from the keyboard takes the focus: Enter does not send the text typed behind it", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  await page.fill("#composer", "Недовършено съобщение");
  await page.locator("#composer").focus();
  await page.keyboard.press("Control+/");
  await expect(page.locator(".modal")).toHaveCount(1);
  expect((await activeIn(page)).inModal).toBe(true);
  await page.keyboard.type("x");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  expect((await mockCalls(page)).chat).toHaveLength(0);
  await expect(page.locator("#composer")).toHaveValue("Недовършено съобщение");
  await g.check();
});
