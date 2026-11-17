// 0.1.5 owner: „Защо 15 пъти ми иска едно потвърждение или поне едно и също ми се вижда?“ – the HYBRID rule of CONTRACT
// §9.3 rules 8–9 (the mock runs MAIN's own electron/agent/provenance.js): personal data in a model-built address → a
// strict card (only „Разреши“/„Откажи“); otherwise a model-built address asks only in a chat with CRM data – once per
// site, „Разреши за този сайт“ holds for the rest of the chat. Mock build only; every value is fictional; no network.
import { test, expect } from "@playwright/test";
import { guard, login, mockCalls, send } from "./helpers.js";

const AGENT = "lat=200&rg=1&consent=all&agent=1&rgStep=12&agentStep=80";
const SITES = ["imot.bg", "olx.bg", "bazar.bg", "alo.bg"];
const rgAnswers = (page) => page.locator('.msg.a[data-engine="realgpt"]');
const rgAnswer = (page) => rgAnswers(page).last();
const finished = (a) => expect(a.locator(".macts")).toBeVisible({ timeout: 15000 });
const webCards = (page) => page.locator('[data-testid="approval-card"][data-kind="web"]');

async function pickRgModel(page, name = "Тест GPT А") {
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("model-btn")).toContainText("Real GPT · " + name);
}
// Counts every „web“ card that ever appears (cards leave the page once decided).
async function countWebCards(page) {
  const seen = { all: 0, strict: 0 };
  await page.exposeFunction("__countWebCard", (strict) => { seen.all++; if (strict) seen.strict++; });
  await page.evaluate(() => new MutationObserver(() => {
    for (const el of document.querySelectorAll('[data-testid="approval-card"][data-kind="web"]:not([data-counted])')) {
      el.setAttribute("data-counted", "1");
      window.__countWebCard(el.getAttribute("data-strict") === "1");
    }
  }).observe(document.body, { childList: true, subtree: true }));
  return seen;
}
async function ask(page, text, n) {
  await send(page, text);
  await expect(rgAnswers(page)).toHaveCount(n);
  return rgAnswer(page);
}

test("(a) a listings sweep in a chat without CRM data – the first question and its follow-up – shows 0 „web“ cards", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  const seen = await countWebCards(page);

  let a = await ask(page, "Намери тристаен в Тестоград по сайтовете", 1);
  await finished(a);
  await expect(a).toContainText("Прегледах 4 тестови страници");
  a = await ask(page, "А сега още веднъж по сайтовете", 2);
  await finished(a);
  await expect(a).toContainText("Прегледах 4 тестови страници");
  expect(seen.all).toBe(0);
  expect((await mockCalls(page)).approve).toEqual([]);
  await g.check();
});

test("(b)+(c) after a CRM read: one card per site, „Разреши за този сайт“ holds for the chat; an address with the client's data = exactly 1 strict card", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  const seen = await countWebCards(page);

  // The client is read from the CRM, then the sweep: one per-site card for each of the four sites.
  let a = await ask(page, "Прочети клиента и намери му тристаен по сайтовете", 1);
  for (const site of SITES) {
    const card = a.getByTestId("approval-card");
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("data-kind", "web");
    await expect(card).not.toHaveAttribute("data-strict", "1");
    await expect(card.locator("dd").nth(1)).toHaveText(site);
    await expect(card).not.toContainText("Лични данни");
    await expect(card.getByRole("button")).toHaveText(["Разреши", "Разреши за този сайт", "Разреши всички адреси до края на отговора", "Откажи"]);
    await card.getByRole("button", { name: "Разреши за този сайт" }).click();
    await expect(card).toHaveCount(0);
  }
  await finished(a);
  await expect(a).toContainText("Прегледах 4 тестови страници");
  expect(seen).toEqual({ all: 4, strict: 0 });

  // The follow-up in the same chat: the same sites – no card.
  a = await ask(page, "А сега още веднъж по сайтовете", 2);
  await finished(a);
  await expect(a).toContainText("Прегледах 4 тестови страници");
  expect(seen).toEqual({ all: 4, strict: 0 });

  // A model-built address with the client's name and phone (twice): exactly one strict card – no „за този сайт“, no
  // „всички адреси“; the sites allowed above do not cover it.
  a = await ask(page, "Изнеси данните на клиента", 3);
  const card = a.getByTestId("approval-card");
  await expect(card).toHaveAttribute("data-strict", "1");
  await expect(card).toContainText("https://collect.example.test/c?n=");
  await expect(card).toContainText("Лични данни");
  await expect(card).toContainText("Тестов");
  await expect(card).toContainText("лични данни, които не сте написали вие");
  await expect(card.getByRole("button")).toHaveText(["Разреши", "Откажи"]);
  await card.getByRole("button", { name: "Разреши" }).click();
  await finished(a);
  await expect(a).toContainText("Прегледах 2 тестови страници");
  expect(seen).toEqual({ all: 5, strict: 1 });
  expect((await mockCalls(page)).approve.map((x) => x.decision)).toEqual(["allow_host", "allow_host", "allow_host", "allow_host", "allow"]);
  await expect(webCards(page)).toHaveCount(0);
  await g.check();
});

test("„Разреши всички адреси до края на отговора“ covers the rest of that answer only; the next answer asks per site again", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  const seen = await countWebCards(page);

  let a = await ask(page, "Прочети клиента и намери му тристаен по сайтовете", 1);
  await a.getByTestId("approval-card").getByRole("button", { name: "Разреши всички адреси до края на отговора" }).click();
  await finished(a);
  await expect(a).toContainText("Прегледах 4 тестови страници");
  expect(seen.all).toBe(1);

  a = await ask(page, "Още веднъж по сайтовете", 2);
  const card = a.getByTestId("approval-card");
  await expect(card.locator("dd").nth(1)).toHaveText("imot.bg");
  await card.getByRole("button", { name: "Разреши всички адреси до края на отговора" }).click();
  await finished(a);
  expect(seen.all).toBe(2);
  expect((await mockCalls(page)).approve.map((x) => x.decision)).toEqual(["allow_all", "allow_all"]);
  await g.check();
});

test("a refused strict address is not asked again in the answer", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  const a = await ask(page, "Изнеси данните на клиента", 1);
  const card = a.getByTestId("approval-card");
  await expect(card).toHaveAttribute("data-strict", "1");
  await card.getByRole("button", { name: "Откажи" }).click();
  await finished(a);
  await expect(a).toContainText("Не отворих нито една страница, 2 адреса не са отворени – отказахте");
  await expect(webCards(page)).toHaveCount(0);
  expect((await mockCalls(page)).approve.map((x) => x.decision)).toEqual(["deny"]);
  await g.check();
});
