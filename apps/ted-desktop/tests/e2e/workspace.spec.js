// Cases, the model menu, settings, memory, clipboard/save and reading answers aloud.
import { test, expect } from "@playwright/test";
import { guard, lastAnswer, login, mockCalls, openSettings, send } from "./helpers.js";

test("cases: list from the server, open with server history, create and chat inside a case", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=300");
  const list = page.getByTestId("case-list");
  await expect(list).toContainText("Тестов казус · продажба");
  await expect(list).toContainText("Тестов казус · наем");

  await list.getByRole("button", { name: "Тестов казус · продажба" }).click();
  const cp = page.getByTestId("case-page");
  await expect(cp.locator("h1")).toHaveText("Тестов казус · продажба");
  await expect(cp).toContainText("Тестово съобщение от служител по казуса.");
  await cp.getByRole("button", { name: "Факти" }).click();
  await expect(cp).toContainText("клиентът търси двустаен");

  await list.getByRole("button", { name: "Нов проект…" }).click();
  await page.fill("#nc-t", "Нов тестов казус");
  await page.fill("#nc-c", "Тестов Клиент В");
  await expect(page.locator(".modal")).toContainText("Нов проект"); // one term: Проект (казус in the explanation)
  await page.getByRole("button", { name: "Създай проект" }).click();
  await expect(cp.locator("h1")).toHaveText("Нов тестов казус");
  await expect(list).toContainText("Нов тестов казус");
  let calls = await mockCalls(page);
  expect(calls.casesCreate).toEqual([{ title: "Нов тестов казус", clientName: "Тестов Клиент В" }]);

  await cp.getByRole("button", { name: "Нов чат в този казус" }).click();
  await expect(page.getByTestId("case-pill")).toContainText("Казус: Нов тестов казус");
  await send(page, "Какво знаем по казуса?");
  await expect(lastAnswer(page)).toContainText("Казус case-test-3");
  calls = await mockCalls(page);
  expect(calls.chat.at(-1)).toMatchObject({ caseId: "case-test-3", count: 1 }); // only the current message inside a case
  // In a case the server's history is the case memory: a bare confirmation never goes to the server.
  await send(page, "да");
  await expect(page.locator('.msg.a[data-engine="local"]').last()).toContainText("в казус Тед вижда разговорите по казуса");
  expect((await mockCalls(page)).chat.length).toBe(calls.chat.length);
  await g.check();
});

test("model menu lists the server models and the Real GPT group; the choice is sent", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  await page.getByTestId("model-btn").click();
  const pop = page.locator(".pop");
  for (const t of ["По подразбиране", "Тестов модел А", "Тестов модел Б", "Real GPT · вашият ChatGPT план", "Продължи с ChatGPT"]) await expect(pop).toContainText(t);
  await pop.getByRole("menuitem", { name: /Тестов модел Б/ }).click();
  await expect(page.getByTestId("model-btn")).toContainText("Тестов модел Б");
  await send(page, "Кратък въпрос");
  await expect(lastAnswer(page).getByTestId("model-chip")).toHaveText("Сървър · Тестов модел Б");
  const calls = await mockCalls(page);
  expect(calls.chat[0].model).toBe("test-model-b");
  await g.check();
});

test("settings: every section opens; memory search, remember and forget go through the bridge", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  await openSettings(page);
  // The 0.1.2 panes keep their keys (now in the ChatGPT order and names); „Относно“ is last.
  const rows = { personal: "Персонализиране", memory: "Памет", apps: "Плъгини", account: "Имейл", chatgpt: "ChatGPT акаунт", usage: "Използване и лимити", model: "Модел",
    theme: "Външен вид", accent: "Акцентен цвят", general: "Общи", notify: "Известия", voice: "Глас", dict: "Диктовка", safety: "Безопасност", security: "Сигурност и вход",
    browser: "Браузър", storage: "Съхранение", data: "Контрол на данните", report: "Съобщете за проблем", helpc: "Помощен център", privacy: "Център за поверителност", about: "Относно" };
  for (const [key, name] of Object.entries(rows)) {
    await page.locator(`.modal .set-row[data-row="${key}"]`).click();
    await expect(page.locator(`.pane[data-pane="${key}"] h3`)).toHaveText(name);
  }
  await expect(page.getByTestId("app-version")).toHaveText("0.1.0-mock");
  await page.getByRole("button", { name: "Провери" }).click();
  await expect(page.getByTestId("conn-ok")).toContainText("2 модела");

  await page.locator('.modal .set-row[data-row="memory"]').click();
  await page.fill("#mem-q", "кратки");
  await page.locator(".modal").getByRole("button", { name: "Търси", exact: true }).click();
  const item = page.getByTestId("mem-item");
  await expect(item).toHaveCount(1);
  await item.getByRole("button", { name: "Забрави" }).click();
  await expect(item).toHaveCount(0);
  await page.fill("#mem-new", "Тестов нов факт");
  await page.getByRole("button", { name: "Запомни", exact: true }).click();
  await expect(page.locator(".toast")).toContainText("Запомнено");
  const calls = await mockCalls(page);
  expect(calls.forget.map((f) => f.id)).toEqual(["mem-test-1"]);
  expect(calls.remember.map((r) => r.text)).toEqual(["Тестов нов факт"]);
  await g.check();
});

test("copy and export use the bridge; long answers are read aloud in parts under the TTS limit", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  await send(page, "Дай дълъг отговор");
  const a = lastAnswer(page);
  await expect(a).toContainText("Изречение 1 от дългия тестов отговор");
  await a.locator(".macts").getByRole("button", { name: "Копирай" }).click();
  await expect(page.locator(".toast")).toContainText("Копирано");
  await a.locator(".macts").getByRole("button", { name: "Чуй" }).click();
  await expect.poll(async () => (await mockCalls(page)).tts.length, { timeout: 15000 }).toBeGreaterThanOrEqual(3);
  const calls = await mockCalls(page);
  expect(calls.copy[0]).toContain("Изречение 1 от дългия тестов отговор");
  expect(calls.tts[0]).toBeLessThanOrEqual(300);           // quick first part
  expect(Math.max(...calls.tts)).toBeLessThanOrEqual(900); // never near the 1200-char bridge limit
  await page.getByRole("button", { name: "Опции на разговора" }).click();
  await page.getByRole("menuitem", { name: /Експорт/ }).click();
  await expect(page.locator(".toast")).toContainText("Запазено");
  expect((await mockCalls(page)).saveFile[0]).toMatch(/\.md$/);
  await g.check();
});
