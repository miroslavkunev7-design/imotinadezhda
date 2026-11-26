// 0.1.8 · Тед за Mac: the same screens, white with red elements – and nothing changes when it is not a Mac.
import { test, expect } from "@playwright/test";
import { guard, login } from "./helpers.js";

const bg = (page, sel) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundImage + " " + getComputedStyle(e).backgroundColor);

test("on a Mac: white frame, sidebar and title bar, red active elements, „Тед за Mac“, ⌘ shortcuts", async ({ page }) => {
  const g = guard(page);
  await page.addInitScript(() => Object.defineProperty(navigator, "platform", { get: () => "MacIntel" }));
  await login(page);
  await expect(page.locator("html")).toHaveClass(/os-mac/);
  await expect(page.locator(".winbar .wb-sub")).toHaveText("Имоти Надежда · Тед за Mac");
  expect(await bg(page, ".winbar")).toMatch(/rgb\(255, 255, 255\)/);
  expect(await bg(page, ".side")).toMatch(/rgb\(255, 255, 255\)/);
  expect(await page.locator(".side .nav.n-search").evaluate((e) => getComputedStyle(e).color)).toBe("rgb(59, 13, 24)");
  expect(await page.locator(".side .nav.n-new").evaluate((e) => getComputedStyle(e).color)).toBe("rgb(122, 16, 35)");
  expect(await bg(page, ".seg button.on")).toMatch(/rgb\(214, 31, 80\)/);
  await expect(page.locator('[data-testid="side-new"] kbd')).toHaveText("⌘ ⇧ O");
  // the window buttons of a Mac are on the left: the title bar leaves them room
  expect(await page.locator(".winbar").evaluate((e) => parseFloat(getComputedStyle(e).paddingLeft))).toBeGreaterThanOrEqual(78);
  await g.check();
});

test("not a Mac: the burgundy look and „Тед за Windows“ stay exactly as before", async ({ page }) => {
  const g = guard(page);
  await login(page);
  await expect(page.locator("html")).not.toHaveClass(/os-mac/);
  await expect(page.locator(".winbar .wb-sub")).toHaveText("Имоти Надежда · Тед за Windows");
  expect(await bg(page, ".side")).not.toMatch(/rgb\(255, 255, 255\) 0%/);
  await expect(page.locator('[data-testid="side-new"] kbd')).toHaveText("Ctrl ⇧ O");
  await g.check();
});
