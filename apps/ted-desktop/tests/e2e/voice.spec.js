// Microphone paths with Chromium's fake audio device: dictation and the voice mode. The recording is
// read with FileReader (connect-src 'none' forbids fetch of blob: URLs) and sent via the bridge.
import { test, expect } from "@playwright/test";
import { guard, lastAnswer, login, mockCalls } from "./helpers.js";

test.use({
  permissions: ["microphone"],
  launchOptions: {
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  },
});

test("dictation: record → transcribe through the bridge → text in the composer", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  await page.getByRole("button", { name: "Диктовка" }).click();
  await expect(page.locator(".recbar")).toContainText("Записвам");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Спри диктовката" }).click();
  await expect(page.locator("#composer")).toHaveValue("Тестова диктовка");
  expect((await mockCalls(page)).transcribe).toBe(1);
  await g.check();
});

test("voice mode: spoken question → server answer → read aloud", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200");
  await page.getByRole("button", { name: "Гласов режим" }).click();
  const voice = page.getByRole("dialog", { name: "Гласов режим" });
  await voice.getByRole("button", { name: "Микрофон" }).click();
  await expect(voice.locator(".vl")).toContainText("Слушам");
  await page.waitForTimeout(1000);
  await voice.getByRole("button", { name: "Микрофон" }).click();
  await expect(voice.locator(".vq")).toContainText("Тестова диктовка");
  await expect.poll(async () => (await mockCalls(page)).tts.length, { timeout: 15000 }).toBeGreaterThan(0);
  await voice.getByRole("button", { name: "Край" }).click();
  await expect(lastAnswer(page)).toContainText("Тестов отговор");
  const calls = await mockCalls(page);
  expect(calls.chat[0].last).toBe("Тестова диктовка");
  await g.check();
});
