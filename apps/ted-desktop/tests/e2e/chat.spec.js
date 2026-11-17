// Sign-in, the chat with Ted's server, real action statuses, errors and the e-mail confirmation flow.
import { test, expect } from "@playwright/test";
import { guard, lastAnswer, login, mockCalls, open, send } from "./helpers.js";

test("wrong password shows the server message; login opens home with the profile", async ({ page }) => {
  const g = guard(page);
  await open(page, "lat=300");
  await expect(page.getByTestId("conn")).toContainText("Излезли сте");
  await page.fill("#lg-id", "sluzhitel@example.test");
  await page.fill("#lg-pw", "wrong");
  await page.click(".login-btn");
  await expect(page.locator(".login-card .err")).toContainText("Грешен телефон/имейл или парола.");
  await expect(page.locator("#lg-pw")).toHaveValue(""); // the password never stays in the form
  await page.fill("#lg-pw", "test");
  await page.click(".login-btn");
  await expect(page.locator(".home h1")).toContainText("С какво да помогна, Тест?");
  await expect(page.locator(".me .ini")).toHaveText("ТС");
  await expect(page.locator(".me-txt")).toContainText("Тест Служител");
  await expect(page.getByTestId("conn")).toContainText("Свързан с imotinadezhda.bg");
  await expect(page.getByTestId("session-note")).toHaveCount(0);
  await g.check();
});

test("a session that Windows cannot store says the user must log in on each start", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=300&remembered=0");
  await expect(page.getByTestId("session-note")).toContainText("при всяко стартиране");
  await page.getByRole("button", { name: "Настройки" }).first().click();
  await page.getByRole("tab", { name: /Акаунт/ }).click();
  await expect(page.getByTestId("session-note-settings")).toBeVisible();
  await g.check();
});

test("send → live waiting timer → answer with the server's step statuses", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=2300");
  await send(page, "Намери имоти и запиши оглед");
  await expect(page.getByTestId("waiting")).toBeVisible();
  await expect(page.getByTestId("wait-clock")).toHaveText(/^0:0[1-9]$/); // the clock really runs
  const a1 = lastAnswer(page);
  await expect(a1.getByTestId("actions-card")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("waiting")).toHaveCount(0);
  await expect(a1.locator(".run-h .status")).toHaveText("Частично изпълнено");
  await expect(a1.locator(".ribbon")).toHaveText("промени в CRM");
  await expect(a1.locator(".steps li")).toHaveCount(3);
  await expect(a1.locator('.steps li[data-ok="0"]')).toContainText("Търсене на документ");
  await expect(a1.getByTestId("model-chip")).toHaveText("Сървър · Тестов модел А");

  await send(page, "Дай ми справка за месеца");
  await expect(page.locator(".msg.a[data-engine=server]")).toHaveCount(2, { timeout: 15000 });
  await expect(lastAnswer(page).locator(".run-h .status")).toHaveText("Изпълнено");
  await expect(lastAnswer(page).locator(".ribbon")).toHaveCount(0);

  await send(page, "Тест за неуспех");
  await expect(page.locator(".msg.a[data-engine=server]")).toHaveCount(3, { timeout: 15000 });
  await expect(lastAnswer(page).locator(".run-h .status")).toHaveText("Неуспешно");

  const calls = await mockCalls(page);
  expect(calls.chat.map((c) => c.count)).toEqual([1, 3, 5]); // history + the current message
  await g.check();
});

test("history sent to the server is trimmed to 14 turns and messages over 8000 chars are refused locally", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=20");
  for (let i = 1; i <= 9; i++) {
    await send(page, "Въпрос номер " + i);
    await expect(page.locator(".msg.a[data-engine=server]")).toHaveCount(i, { timeout: 10000 });
  }
  let calls = await mockCalls(page);
  expect(Math.max(...calls.chat.map((c) => c.count))).toBe(15);
  expect(calls.chat.at(-1).count).toBe(15);
  await expect(page.getByTestId("error-banner")).toHaveCount(0);

  await page.fill("#composer", "а".repeat(8001));
  await page.keyboard.press("Enter");
  await expect(page.locator(".toast")).toContainText("8000");
  calls = await mockCalls(page);
  expect(calls.chat.length).toBe(9); // nothing left the renderer
  await g.check();
});

test("e-mail card: one confirmation call, follow-up built only from the result", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=300");
  await send(page, "Подготви имейл до клиента");
  const card = page.getByTestId("email-card"); // the only card in this chat
  await expect(card).toBeVisible();
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Тестов Клиент А <klient-a@example.test>");
  await card.getByRole("button", { name: /Да, изпрати/ }).click();
  const follow = page.locator(".msg.a[data-engine=server]").last();
  await expect(follow).toContainText("✔ Изпратено до Тестов Клиент А <klient-a@example.test> от agent@example.test");
  await expect(follow).toContainText("Резултат от сървъра · email.send");
  await expect(follow.locator(".run-h .status")).toHaveText("Изпълнено");
  await expect(card.getByRole("button", { name: /Да, изпрати/ })).toHaveCount(0);
  await expect(card).toContainText("Изпратено.");
  const calls = await mockCalls(page);
  expect(calls.confirmSend).toBe(1);
  expect(calls.chat.length).toBe(1); // no "да" was sent to the assistant
  await g.check();
});

test("typed „да“ while an e-mail card is active goes to the confirmation, never to the server", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=300");
  await send(page, "Подготви имейл до клиента");
  await expect(lastAnswer(page).getByTestId("email-card")).toBeVisible();

  // Cancelled confirmation: nothing is sent and the card stays usable.
  await page.evaluate(() => window.__tedMock.setConfirm(false));
  await send(page, "да");
  await expect(page.locator(".toast")).toContainText("Отказано – нищо не е изпратено.");
  let calls = await mockCalls(page);
  expect(calls.confirmSend).toBe(1);
  expect(calls.chat.length).toBe(1);
  await expect(page.getByTestId("email-card").getByRole("button", { name: /Да, изпрати/ })).toBeEnabled();

  await page.evaluate(() => window.__tedMock.setConfirm(true));
  await send(page, "Да");
  await expect(page.locator(".msg.a[data-engine=server]").last()).toContainText("✔ Изпратено до");
  calls = await mockCalls(page);
  expect(calls.confirmSend).toBe(2);
  expect(calls.chat.length).toBe(1);
  await g.check();
});

test("a longer confirmation („Да, моля“) under a card is never sent to the server", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=300");
  await send(page, "Подготви имейл до клиента");
  await expect(lastAnswer(page).getByTestId("email-card")).toBeVisible();
  for (const text of ["Да, моля", "да, прати го на друг адрес"]) {
    await send(page, text);
    const local = page.locator('.msg.a[data-engine="local"]').last();
    await expect(local).toContainText("Това съобщение не е изпратено към Тед");
    await expect(local).toContainText("Да, изпрати");
  }
  const calls = await mockCalls(page);
  expect(calls.chat.length).toBe(1);
  expect(calls.confirmSend).toBe(0);
  await expect(page.getByTestId("email-card").getByRole("button", { name: /Да, изпрати/ })).toBeEnabled();
  await g.check();
});

test("an older card stays off after the chat with the newer card is deleted", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  await send(page, "Подготви имейл до клиента");
  await expect(lastAnswer(page).getByTestId("email-card")).toBeVisible();
  await page.getByRole("button", { name: "Нов чат" }).first().click();
  await send(page, "Втори имейл до клиента");
  await expect(lastAnswer(page).getByTestId("email-card")).toBeVisible();
  // Delete the chat with the newer card.
  const row = page.locator(".side .row", { hasText: "Втори имейл до клиента" });
  await row.getByRole("button", { name: "Опции на чата" }).click();
  await page.locator(".pop").getByText("Изтрий").click();
  await page.locator(".modal .mf").getByRole("button", { name: "Потвърди" }).click();
  await page.locator(".side .row", { hasText: "Подготви имейл до клиента" }).getByRole("button").first().click();
  const card = page.getByTestId("email-card");
  await expect(card.getByRole("button", { name: /Да, изпрати/ })).toBeDisabled();
  await expect(card.getByTestId("email-block")).toContainText("Има по-нова чернова");
  await send(page, "да");
  await expect(page.locator('.msg.a[data-engine="local"]').last()).toContainText("Нищо не е изпратено. Има по-нова чернова");
  expect((await mockCalls(page)).confirmSend).toBe(0);
  await g.check();
});

test("a question whose answer never arrived (session ended) shows the interrupted warning after sign-in", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=5000");
  await send(page, "Запиши оглед за утре");
  await expect(page.getByTestId("waiting")).toBeVisible();
  await page.waitForTimeout(900); // the chat (with the pending marker) is saved after 500 ms
  await page.evaluate(() => window.__tedMock.expire());
  await page.fill("#lg-id", "sluzhitel@example.test");
  await page.fill("#lg-pw", "test");
  await page.click(".login-btn");
  await page.locator(".side .row", { hasText: "Запиши оглед за утре" }).getByRole("button").first().click();
  const banner = page.getByTestId("error-banner");
  await expect(banner).toContainText("Прекъснато при затваряне – възможно е действия да са изпълнени.");
  await expect(banner.getByTestId("maybe-note")).toBeVisible();
  await banner.getByRole("button", { name: "Опитай отново" }).click();
  await expect(page.locator(".modal").getByText("Да опитам ли отново?")).toBeVisible();
  await page.locator(".modal .mf").getByRole("button", { name: "Отказ" }).click();
  await g.check();
});

test("ok:true without result.sent (mail not set up) is not shown as sent", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=300");
  await page.evaluate(() => window.__tedMock.setEmailOutcome("setup"));
  await send(page, "Подготви имейл до клиента");
  await page.getByTestId("email-card").getByRole("button", { name: /Да, изпрати/ }).click();
  const follow = page.locator(".msg.a[data-engine=server]").last();
  await expect(follow).toContainText("Няма настроена поща за изпращане (тест).");
  await expect(follow.getByTestId("panel-card")).toBeVisible();
  await expect(follow).not.toContainText("✔ Изпратено");
  await expect(follow.locator(".run-h .status")).toHaveText("Неуспешно");
  await g.check();
});

test("quota: amber banner with the may-have-run warning; retry asks first and is never automatic", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=300");
  await send(page, "Провери квота");
  const banner = page.getByTestId("quota-banner");
  await expect(banner).toContainText("Лимитът на тестовия модел е изчерпан");
  await expect(banner.getByTestId("maybe-note")).toContainText("може вече да е изпълнено");
  await banner.getByRole("button", { name: "Опитай отново" }).click();
  await expect(page.locator(".modal").getByText("Да опитам ли отново?")).toBeVisible();
  await page.locator(".modal .mf").getByRole("button", { name: "Отказ" }).click();
  await banner.getByRole("button", { name: "Избери друг модел" }).click();
  await expect(page.locator(".pop")).toContainText("Тестов модел Б");
  await page.keyboard.press("Escape");
  const calls = await mockCalls(page);
  expect(calls.chat.length).toBe(1);
  await g.check();
});

test("HTTP 502 and stop are reported honestly with the may-have-run warning", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=300");
  await send(page, "сървърна грешка");
  await expect(page.getByTestId("error-banner")).toContainText("HTTP 502");
  await expect(page.getByTestId("error-banner").getByTestId("maybe-note")).toBeVisible();
  await g.check();

  await login(page, "lat=6000");
  await send(page, "Дълга задача");
  await expect(page.getByTestId("waiting")).toBeVisible();
  await page.getByTestId("waiting").locator("xpath=..").getByRole("button", { name: "Спри" }).click();
  await expect(page.getByTestId("stop-note")).toContainText("може да бъде довършено");
  await g.check();
});

test("an expired session returns to the login with a notice and keeps the unsent draft", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  await page.fill("#composer", "Недовършен текст");
  await page.evaluate(() => window.__tedMock.expire());
  await expect(page.locator(".login-notice")).toContainText("Сесията е изтекла");
  await page.fill("#lg-id", "sluzhitel@example.test");
  await page.fill("#lg-pw", "test");
  await page.click(".login-btn");
  await expect(page.locator("#composer")).toHaveValue("Недовършен текст");
  await g.check();
});
