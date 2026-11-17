// Window frame, phone layout and the reference screenshots (desktop 1366x860, phone 400x860).
import { test, expect } from "@playwright/test";
import { DESKTOP, PHONE, guard, lastAnswer, login, noHorizontalScroll, open, openSettings, send, shot } from "./helpers.js";

for (const [kind, size] of [["desktop", DESKTOP], ["phone", PHONE]]) {
  test(`screenshots and layout · ${kind}`, async ({ page }) => {
    const g = guard(page);
    await page.setViewportSize(size);
    await open(page, "lat=400");
    await expect(page.locator(".winbar")).toBeVisible();
    await shot(page, `real-${kind}-login.png`);
    if (kind === "phone") await noHorizontalScroll(page);

    await login(page, "lat=400");
    await expect(page.locator(".shell")).toHaveClass(kind === "phone" ? /phone/ : /^(?!.*phone).*$/);
    await shot(page, `real-${kind}-home.png`);
    if (kind === "phone") await noHorizontalScroll(page);

    await send(page, "Намери имоти и запиши оглед");
    await expect(lastAnswer(page).getByTestId("actions-card")).toBeVisible();
    await lastAnswer(page).getByTestId("actions-card").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await shot(page, `real-${kind}-actions.png`);
    await send(page, "Подготви имейл до клиента");
    await expect(lastAnswer(page).getByTestId("email-card")).toBeVisible();
    // The e-mail answer from its top: text, its actions card and the prepared e-mail.
    await lastAnswer(page).evaluate((el) => el.scrollIntoView({ block: "start" }));
    await shot(page, `real-${kind}-chat.png`);
    if (kind === "phone") await noHorizontalScroll(page);

    await page.getByTestId("model-btn").click();
    await expect(page.locator(".pop")).toBeVisible();
    await shot(page, `real-${kind}-model.png`);
    await page.keyboard.press("Escape");
    await expect(page.locator(".pop")).toHaveCount(0);

    if (kind === "phone") {
      await page.getByRole("button", { name: "Меню" }).click();
      await expect(page.locator(".side.open")).toBeVisible();
      await noHorizontalScroll(page);
      await shot(page, `real-${kind}-drawer.png`);
      await page.locator(".scrim").click({ position: { x: 380, y: 400 } });
      await page.getByRole("button", { name: "Опции на разговора" }).first().waitFor();
    }
    await openSettings(page, "model");
    await expect(page.locator('.pane[data-pane="model"]')).toBeVisible();
    await shot(page, `real-${kind}-settings.png`);
    await g.check();
  });
}

test("title bar is the drag region and leaves room for the caption buttons", async ({ page }) => {
  const g = guard(page);
  await login(page);
  const bar = await page.locator(".winbar").evaluate((el) => {
    const cs = getComputedStyle(el);
    const btn = el.querySelector("button");
    return { drag: cs.getPropertyValue("-webkit-app-region") || cs.webkitAppRegion, pad: parseFloat(cs.paddingRight), h: el.offsetHeight,
      btnDrag: btn ? getComputedStyle(btn).getPropertyValue("-webkit-app-region") || getComputedStyle(btn).webkitAppRegion : "no-drag" };
  });
  expect(bar.drag).toBe("drag");
  expect(bar.btnDrag).toBe("no-drag");
  expect(bar.pad).toBeGreaterThanOrEqual(140);
  expect(bar.h).toBe(36);
  // Phone layout keeps the bar (it carries the drag area and the native buttons).
  await page.setViewportSize(PHONE);
  await expect(page.locator(".shell.phone .winbar")).toBeVisible();
  await expect(page.locator(".winbar")).toHaveCSS("height", "36px");
  // Modal layers start below the bar so the caption buttons never cover their controls.
  await openSettings(page);
  const top = await page.locator(".back").evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBe(36);
  await g.check();
});
