// Real GPT (Sign in with ChatGPT): connect, plan indicator, streamed answer and the result codes.
import { test, expect } from "@playwright/test";
import { guard, login, mockCalls, send, shot } from "./helpers.js";

const USAGE = "https://chatgpt.com/settings/usage";
const rgAnswer = (page) => page.locator('.msg.a[data-engine="realgpt"]').last();

async function pickRgModel(page, name = "Тест GPT А") {
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("model-btn")).toContainText("Real GPT · " + name);
}

test("Продължи с ChatGPT → plan indicator → streamed answer without CRM history", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200&rgStep=120");
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: /Продължи с ChatGPT/ }).click();
  await page.getByTestId("rg-continue").click();
  await expect(page.locator(".rg-wait")).toContainText("Чакаме входа в браузъра");
  await expect(page.getByTestId("rg-connected")).toBeVisible();
  await expect(page.locator(".modal .mh h2")).toHaveText("Използвате своя ChatGPT план");
  await page.getByRole("button", { name: "Разбрах" }).click();

  await page.getByTestId("model-btn").click();
  const pop = page.locator(".pop");
  await expect(pop).toContainText("chatgpt.test@example.test");
  await expect(pop.getByTestId("rg-use")).toContainText("Използва вашия ChatGPT план");
  await pop.getByRole("menuitem", { name: /Тест GPT А/ }).click();
  const ind = page.getByTestId("rg-ind");
  await expect(ind).toContainText("Използва вашия ChatGPT план");
  await ind.getByRole("button", { name: "Управление на лимита" }).click();
  expect((await mockCalls(page)).openExternal).toContain(USAGE);

  // A server exchange first: its answer must not be forwarded to OpenAI.
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: /По подразбиране/ }).click();
  await send(page, "Дай ми справка");
  await expect(page.locator('.msg.a[data-engine="server"]')).toHaveCount(1);
  await pickRgModel(page);

  await send(page, "Здравей");
  const a = rgAnswer(page);
  await expect(a.locator(".caret")).toBeVisible();          // streaming: partial text with the caret
  await expect(a).toContainText("Това е тестов отговор");
  await expect(a.locator(".caret")).toHaveCount(0, { timeout: 10000 });
  await expect(a).toContainText("Данните са измислени.");
  await expect(a.getByTestId("model-chip")).toHaveText("Real GPT · Тест GPT А");
  const calls = await mockCalls(page);
  expect(calls.rgSend).toHaveLength(1);
  expect(calls.rgSend[0].roles).toEqual(["user"]);   // only the current message: no CRM answer in the history
  expect(calls.rgSend[0].instructions).toBeUndefined(); // the module's own no-CRM instructions apply
  await shot(page, "real-desktop-realgpt.png");
  await g.check();
});

test("usage_limit offers the usage page; reauth offers a new sign-in; no automatic retry", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200&rg=1");
  await pickRgModel(page);
  await send(page, "Стигнах ли лимит?");
  const banner = rgAnswer(page).getByTestId("quota-banner");
  await expect(banner).toContainText("Достигнат е лимитът на вашия ChatGPT план");
  await expect(banner.getByRole("button", { name: "Опитай отново" })).toHaveCount(0);
  await banner.getByRole("button", { name: "Управление на лимита" }).click();
  expect((await mockCalls(page)).openExternal).toContain(USAGE);

  await send(page, "Нужен е повторен вход");
  const err = rgAnswer(page).getByTestId("error-banner");
  await expect(err).toContainText("Входът с ChatGPT е изтекъл");
  await err.getByRole("button", { name: "Продължи с ChatGPT" }).click();
  await expect(page.locator(".modal")).toBeVisible();
  expect((await mockCalls(page)).rgSend).toHaveLength(2);
  await g.check();
});

test("plan not granted offers sign-in again; unconfirmed revocation is explained", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200&rg=1&rgPlan=0&revoked=0");
  await page.getByTestId("model-btn").click();
  const pop = page.locator(".pop");
  await expect(pop).toContainText("Използването на ChatGPT плана не е разрешено");
  await expect(pop.getByRole("button", { name: "Продължи с ChatGPT" })).toBeVisible();
  await pop.getByRole("menuitem", { name: /Прекъсни връзката/ }).click();
  await expect(page.locator(".toast")).toContainText("Отдалеченото прекратяване не е потвърдено");
  await g.check();
});

test("a sign-out that cannot remove the saved tokens is reported, and the connection stays shown", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200&rg=1&rgOutFail=1");
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: /Прекъсни връзката/ }).click();
  await expect(page.locator(".toast")).toContainText("Връзката с Real GPT не беше премахната: Защитеното хранилище на Windows не е достъпно (тест)");
  await expect(page.locator(".toast")).not.toContainText("премахната от този компютър");
  await page.getByTestId("model-btn").click();
  await expect(page.locator(".pop").getByRole("menuitem", { name: /Прекъсни връзката/ })).toBeVisible();
  await g.check();
});

test("a failed registration offers a fresh sign-in; a connected user can switch account", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200&rgFail=account_mismatch");
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: /Продължи с ChatGPT/ }).click();
  await page.getByTestId("rg-continue").click();
  await expect(page.locator(".modal .err")).toContainText("не беше завършен");
  await page.getByTestId("rg-new-account").click();
  await expect(page.getByTestId("rg-connected")).toBeVisible();
  await expect(page.locator(".modal")).toContainText("drug.akaunt@example.test");

  // Connected: "Смени ChatGPT акаунта" is always offered and is a new registration again.
  await page.getByTestId("rg-new-account").click();
  await expect(page.getByTestId("rg-connected")).toBeVisible();
  expect((await mockCalls(page)).rgSignIn).toEqual([{ newAccount: false }, { newAccount: true }, { newAccount: true }]);
  await g.check();
});
