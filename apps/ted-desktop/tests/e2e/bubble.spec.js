// 0.1.6 „Балонче“ (docs/CONTRACT.md §22) against the mock build: the title-bar button right next to the Windows caption
// buttons, Ctrl+Shift+B, the phone layout and the profile menu, the mini chat's header (Нормален прозорец and ONE way
// back to the bubble: Windows' own „—“, or the header's „–“ without the Windows caption buttons; Esc),
// and the bubble page itself (badge, pulse, click, double click, drag, right click). Every value is fictional.
import { test, expect } from "@playwright/test";
import { DESKTOP, guard, login, mockCalls, noHorizontalScroll, open, shot } from "./helpers.js";
import { MINI_GUARD_MS, SYSTEM_DOUBLE_MS, TAP_MS } from "../../src/bubble/gesture.js";

const winCalls = async (page) => (await mockCalls(page)).window;
const bubbleCalls = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__tedBubbleMock.calls)).filter((c) => c[0] !== "ready"));

test("title bar: „Балонче“ is the last item, immediately left of the caption buttons; click and Ctrl+Shift+B", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(DESKTOP);
  await login(page, "lat=200");
  const bar = page.locator(".winbar");
  const btn = bar.getByTestId("bubble-btn");
  await expect(btn).toBeVisible();
  await expect(btn).toContainText("Балонче");
  await expect(btn).toHaveAttribute("title", "Балонче – свий Тед в балонче (Ctrl + Shift + B)");
  await expect(btn.locator("svg.i")).toHaveCount(1);
  // The last element of the bar; the bar keeps its 140 px room for minimise/maximise/close on the right.
  const geo = await page.evaluate(() => {
    const barEl = document.querySelector(".winbar");
    const kids = [...barEl.children];
    const b = document.querySelector('[data-testid="bubble-btn"]').getBoundingClientRect();
    const q = document.querySelector(".winbar .wq").getBoundingClientRect();
    const cs = getComputedStyle(barEl);
    return { last: kids[kids.length - 1].getAttribute("data-testid"), right: b.right, qRight: q.right, left: b.left, vw: innerWidth, pad: parseFloat(cs.paddingRight), h: barEl.getBoundingClientRect().height, appRegion: cs.webkitAppRegion || cs.getPropertyValue("-webkit-app-region"), btnRegion: getComputedStyle(document.querySelector('[data-testid="bubble-btn"]')).getPropertyValue("-webkit-app-region") };
  });
  expect(geo.last).toBe("bubble-btn");
  expect(geo.pad).toBeGreaterThanOrEqual(140);
  expect(geo.h).toBe(36);
  expect(Math.abs(geo.right - (geo.vw - geo.pad))).toBeLessThanOrEqual(1); // touches the caption-button area
  expect(geo.left).toBeGreaterThanOrEqual(geo.qRight - 1);                 // ⚡ stays on its left
  expect(geo.appRegion).toBe("drag");
  expect(geo.btnRegion).toBe("no-drag");
  await shot(page, "bubble-titlebar-desktop.png");
  await page.screenshot({ path: "test-results/shots/bubble-titlebar-strip.png", clip: { x: 0, y: 0, width: 1366, height: 36 } });

  await btn.click();
  expect(await winCalls(page)).toEqual(["bubble"]);
  // The mock answers "bubble"; the page in a browser cannot hide – back to normal for the shortcut.
  await page.evaluate(() => window.__tedMock.setWinMode("normal"));
  await page.locator("#composer").click();
  await page.keyboard.press("Control+Shift+KeyB");
  await expect.poll(() => winCalls(page)).toEqual(["bubble", "bubble"]);
  // Any keyboard layout: the physical B key (a Bulgarian layout gives „Б“).
  await page.evaluate(() => window.__tedMock.setWinMode("normal"));
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Б", code: "KeyB", ctrlKey: true, shiftKey: true, bubbles: true })));
  await expect.poll(() => winCalls(page)).toEqual(["bubble", "bubble", "bubble"]);
  await g.check();
});

test("phone / narrow layout: the button stays in the bar, also in the profile menu; no sideways scroll", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 420, height: 860 });
  await login(page, "lat=200");
  await expect(page.locator(".shell.phone")).toHaveCount(1);
  const btn = page.locator(".winbar").getByTestId("bubble-btn");
  await expect(btn).toBeVisible();
  await expect(btn).toContainText("Балонче");
  await noHorizontalScroll(page);
  await shot(page, "bubble-titlebar-phone.png");
  await page.locator(".top.ph").getByRole("button", { name: "Меню" }).click();
  await page.getByTestId("me-btn").click();
  const item = page.locator(".pop").getByRole("menuitem", { name: /Балонче/ });
  await expect(item).toBeVisible();
  await expect(item.locator("svg.ci[data-ci='bubble']")).toHaveCount(1);
  await item.click();
  expect(await winCalls(page)).toEqual(["bubble"]);
  // The narrowest window (360 px): only the icon, still clickable.
  await page.evaluate(() => window.__tedMock.setWinMode("normal"));
  await page.setViewportSize({ width: 360, height: 700 });
  await expect(btn).toBeVisible();
  await expect(btn.locator(".wbub-t")).toBeHidden();
  await noHorizontalScroll(page);
  await g.check();
});

test("mini chat: header with „Нормален прозорец“ and one „–“; Esc goes to the bubble only when nothing else takes it", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 400, height: 640 });
  await open(page, "signedIn=1&lat=200&win=mini");
  await expect(page.locator(".shell.mini.phone")).toHaveCount(1);
  const bar = page.getByTestId("mini-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("Тед");
  await expect(bar.getByTestId("mini-normal")).toHaveText("⤢ Нормален прозорец");
  // A browser draws no Windows caption buttons: the header has its own single „–“ back to the bubble (no × next to it).
  await expect(bar.getByTestId("mini-bubble")).toHaveAttribute("title", "Обратно в балончето (Esc)");
  await expect(bar.getByTestId("mini-bubble")).toHaveText("–");
  await expect(bar.getByTestId("mini-close")).toHaveCount(0);
  await expect(bar.locator("button")).toHaveCount(2);
  await expect(page.getByTestId("bubble-btn")).toHaveCount(0);
  await expect(page.getByTestId("conn")).toHaveCount(0);
  // The chat itself: the phone layout with the composer and the model pill.
  await expect(page.locator("#composer")).toBeVisible();
  await expect(page.locator("#composer")).toBeFocused();
  await expect(page.getByTestId("effort-pill")).toBeVisible();
  const h = await bar.evaluate((el) => ({ h: el.getBoundingClientRect().height, region: getComputedStyle(el).getPropertyValue("-webkit-app-region"), pad: parseFloat(getComputedStyle(el).paddingRight), right: el.querySelector('[data-testid="mini-bubble"]').getBoundingClientRect().right }));
  expect(h).toMatchObject({ h: 36, region: "drag" });
  expect(h.right).toBeLessThanOrEqual(400 - h.pad + 1);
  expect(h.right).toBeLessThanOrEqual(400);
  await noHorizontalScroll(page);
  await page.fill("#composer", "Незавършен тестов въпрос");
  await shot(page, "bubble-mini-chat.png");
  await page.screenshot({ path: "test-results/shots/bubble-mini-header.png", clip: { x: 0, y: 0, width: 400, height: 36 } });

  // Esc with a dialog open closes the dialog only.
  await page.keyboard.press("Control+k");
  await expect(page.locator(".modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal")).toHaveCount(0);
  expect(await winCalls(page)).toEqual([]);
  // Esc that closes the quick window (a React key handler that removes it at once) is not also „back to the bubble“.
  await page.keyboard.press("Control+Shift+Space");
  await expect(page.locator("#quick-in")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".quick-back")).toHaveCount(0);
  await page.waitForTimeout(150);
  expect(await winCalls(page)).toEqual([]);
  await expect(bar).toBeVisible();
  // Then Esc goes back to the bubble.
  await page.locator("#composer").click();
  await page.keyboard.press("Escape");
  await expect.poll(() => winCalls(page)).toEqual(["bubble"]);
  await expect(bar).toHaveCount(0); // the mode is "bubble" now (a browser page cannot hide)

  // Back as the mini chat: the unsent text is still there. (Fresh from the bubble it takes no click for the rest of
  // Windows' double-click time – the test below; a person's next click comes later anyway.)
  await page.evaluate(() => window.__tedMock.setWinMode("mini"));
  await expect(page.locator("#composer")).toHaveValue("Незавършен тестов въпрос");
  await page.waitForTimeout(MINI_GUARD_MS + 40);
  await page.getByTestId("mini-bubble").click();
  expect(await winCalls(page)).toEqual(["bubble", "bubble"]);

  // The profile menu of the mini chat: „Нормален прозорец“ instead of „Компактен прозорец“ and „Балонче“.
  await page.evaluate(() => window.__tedMock.setWinMode("mini"));
  await page.waitForTimeout(MINI_GUARD_MS + 40);
  await page.locator(".top.ph").getByRole("button", { name: "Меню" }).click();
  await page.getByTestId("me-btn").click();
  await expect(page.locator(".pop").getByRole("menuitem", { name: /Компактен прозорец/ })).toHaveCount(0);
  await page.keyboard.press("Escape"); // closes the menu, not the mini chat
  expect(await winCalls(page)).toEqual(["bubble", "bubble"]);
  await page.keyboard.press("Escape"); // closes the drawer
  await expect(page.locator(".side.open")).toHaveCount(0);

  // „⤢ Нормален прозорец“: the normal title bar comes back.
  await page.getByTestId("mini-normal").click();
  await expect.poll(() => winCalls(page)).toEqual(["bubble", "bubble", "restore"]);
  await expect(page.getByTestId("mini-bar")).toHaveCount(0);
  await expect(page.getByTestId("bubble-btn")).toBeVisible();
  // In the normal window Esc never goes to the bubble.
  await page.locator("#composer").click();
  await page.keyboard.press("Escape");
  expect(await winCalls(page)).toEqual(["bubble", "bubble", "restore"]);
  await g.check();
});

// Release gate 0.1.6 (C4/C6): the bubble sends its single click 240 ms after the release, Windows counts a double click up
// to 500 ms press to press. MAIN puts the mini chat over the bubble's place – its corner is the composer's round button –,
// so the second click of a slower double click landed on „Изпрати“ (a half-written draft was sent), „Гласов режим“ (the
// microphone) or „Спри“ (the answer was dropped). Fresh from the bubble the mini chat now takes no pointer input for the
// rest of Windows' double-click time; that second click is the double click: the normal window.
async function sndCentre(page) {
  const b = await page.locator(".snd").boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
}
async function fromBubble(page) {
  await page.evaluate(() => { window.__tedMock.setWinMode("bubble"); window.__tedMock.setWinMode("mini"); });
}

test("mini chat fresh from the bubble: the second click of a slow double click sends no draft, opens no voice mode – it is the normal window", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 400, height: 640 });
  await open(page, "signedIn=1&lat=200&win=mini");
  await page.fill("#composer", "Незавършен въп");
  await expect(page.locator(".snd")).toHaveAttribute("aria-label", "Изпрати");
  const [x, y] = await sndCentre(page);
  await page.mouse.move(x, y);

  // A kept draft: the second click lands on „Изпрати“ right after MAIN has shown the mini chat.
  await fromBubble(page);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => winCalls(page)).toEqual(["restore"]);
  expect((await mockCalls(page)).chat).toHaveLength(0);
  await expect(page.locator("#composer")).toHaveValue("Незавършен въп");
  await expect(page.getByTestId("mini-bar")).toHaveCount(0); // the normal window
  await expect(page.getByTestId("bubble-btn")).toBeVisible();

  // A press held past the guard is still nothing: no click when it is released over „Изпрати“.
  await fromBubble(page);
  await page.mouse.down();
  await page.waitForTimeout(MINI_GUARD_MS + 150);
  await page.mouse.up();
  await page.waitForTimeout(100);
  expect((await mockCalls(page)).chat).toHaveLength(0);
  await expect(page.locator("#composer")).toHaveValue("Незавършен въп");
  expect(await winCalls(page)).toEqual(["restore", "restore"]);

  // After Windows' double-click time the mini chat works as always: one click sends at once.
  await fromBubble(page);
  await page.waitForTimeout(MINI_GUARD_MS + 40);
  await page.mouse.click(x, y);
  await expect.poll(async () => (await mockCalls(page)).chat.length).toBe(1);
  await expect(page.locator("#composer")).toHaveValue("");
  expect(await winCalls(page)).toEqual(["restore", "restore"]);
  await expect(page.locator(".snd")).toHaveAttribute("aria-label", "Гласов режим", { timeout: 5000 });

  // An empty composer: the same spot is „Гласов режим“ (the microphone) – it does not open.
  await fromBubble(page);
  await page.mouse.click(x, y);
  await page.waitForTimeout(MINI_GUARD_MS + 40);
  await expect(page.locator(".voice")).toHaveCount(0);
  expect(await winCalls(page)).toEqual(["restore", "restore", "restore"]);
  await g.check();
});

test("mini chat fresh from the bubble: „Спри“ and „Добави“ under the bubble's place are not pressed either", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 400, height: 640 });
  await open(page, "signedIn=1&lat=8000&win=mini");
  await page.fill("#composer", "Здравей, разкажи подробно за имота");
  await page.keyboard.press("Enter");
  await expect(page.locator(".snd")).toHaveAttribute("aria-label", "Спри");
  const [x, y] = await sndCentre(page);
  // The answer is still on its way; the second click lands on „Спри“ (its detail is 1 – the first click went to the bubble).
  await fromBubble(page);
  await page.mouse.click(x, y);
  await expect.poll(() => winCalls(page)).toEqual(["restore"]);
  await page.waitForTimeout(200);
  await expect(page.getByTestId("stop-note")).toHaveCount(0);
  await expect(page.locator(".snd")).toHaveAttribute("aria-label", "Спри");
  // A bubble at the left edge: the same corner of the mini chat is „Добави“.
  const plus = page.locator(".c-plus");
  await fromBubble(page);
  const b = await plus.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(150);
  await expect(plus).toHaveAttribute("aria-expanded", "false");
  expect(await winCalls(page)).toEqual(["restore", "restore"]);
  await g.check();
});

// Release gate 0.1.6, attacks on the first fix: a bubble parked at the top puts the mini chat's header under it (its drag
// region is Windows', a press there never reached the page); the second press lost to the bubble as MAIN hid it (only its
// release reached the mini chat); the second press dispatched before the "mini" push (input and IPC are not ordered).
const appRegion = (loc) => loc.evaluate((el) => getComputedStyle(el).getPropertyValue("-webkit-app-region"));
const guardClass = (page) => page.evaluate(() => document.documentElement.classList.contains("mini-guard"));

test("mini chat fresh from the bubble: the header is no drag region meanwhile; a press there, a lost press's release and input before the „mini“ push are the double click", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 400, height: 640 });
  await open(page, "signedIn=1&lat=200&win=mini");
  await page.fill("#composer", "Незавършен въп");
  const [x, y] = await sndCentre(page);
  const bar = page.getByTestId("mini-bar");
  expect(await appRegion(bar)).toBe("drag");
  expect(await guardClass(page)).toBe(false);

  // Hidden behind the bubble the title bar is client area already; the mini chat from the bubble keeps it so for the guard.
  await page.evaluate(() => window.__tedMock.setWinMode("bubble"));
  expect(await guardClass(page)).toBe(true);
  expect(await appRegion(page.locator(".winbar"))).toBe("no-drag");
  await page.evaluate(() => window.__tedMock.setWinMode("mini"));
  expect(await appRegion(bar)).toBe("no-drag");
  const t = await bar.locator("b").boundingBox(); // „Тед“ in the header: Windows' drag region otherwise
  await page.mouse.click(t.x + t.width / 2, t.y + t.height / 2);
  await expect.poll(() => winCalls(page)).toEqual(["restore"]);
  await page.waitForTimeout(MINI_GUARD_MS + 40);
  expect(await guardClass(page)).toBe(false);   // the normal window: its title bar drags again
  expect(await appRegion(page.locator(".winbar"))).toBe("drag");
  // A mini chat not from the bubble (the program started so, or MAIN's own path): the header drags at once.
  await page.evaluate(() => window.__tedMock.setWinMode("mini"));
  expect(await appRegion(bar)).toBe("drag");

  // Only the release of the second click reaches the mini chat (its press hit the bubble just as MAIN hid it).
  const cdp = await page.context().newCDPSession(page);
  await page.mouse.move(x, y);
  await fromBubble(page);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
  await expect.poll(() => winCalls(page)).toEqual(["restore", "restore"]);
  expect((await mockCalls(page)).chat).toHaveLength(0);

  // The whole second click before the renderer has the "mini" push: held, and the double click once the push is there.
  await page.evaluate(() => window.__tedMock.setWinMode("bubble"));
  await page.evaluate(() => window.__tedMock.setWinMode("mini"));
  await page.waitForTimeout(MINI_GUARD_MS + 40);
  await page.evaluate(() => window.__tedMock.setWinMode("bubble"));
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(50);
  expect(await winCalls(page)).toEqual(["restore", "restore"]);
  await page.evaluate(() => window.__tedMock.setWinMode("mini"));
  await expect.poll(() => winCalls(page)).toEqual(["restore", "restore", "restore"]);
  await page.waitForTimeout(MINI_GUARD_MS + 40);
  expect((await mockCalls(page)).chat).toHaveLength(0);
  await expect(page.locator("#composer")).toHaveValue("Незавършен въп");
  // After the guard the mini chat takes a click at once.
  await page.evaluate(() => window.__tedMock.setWinMode("mini"));
  await page.mouse.click(x, y);
  await expect.poll(async () => (await mockCalls(page)).chat.length).toBe(1);
  await g.check();
});

test.describe("touch screen", () => {
  test.use({ hasTouch: true, viewport: { width: 400, height: 640 } });

  // Chromium sends a tap's mousedown/mouseup/click only after the touch has ended (a later task than its pointerup).
  for (const hold of [MINI_GUARD_MS + 40, 150]) {
    test(`a double tap: the second tap lands on „Изпрати“ inside the guard and is released after it (${hold} ms) – nothing is sent`, async ({ page }) => {
      const g = guard(page);
      await open(page, "signedIn=1&lat=200&win=mini");
      await page.fill("#composer", "Незавършен въп");
      await expect(page.locator(".snd")).toHaveAttribute("aria-label", "Изпрати");
      const [x, y] = await sndCentre(page);
      const cdp = await page.context().newCDPSession(page);
      const touch = (type) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
      await fromBubble(page);
      await page.waitForTimeout(Math.max(0, MINI_GUARD_MS + 40 - hold));
      await touch("touchStart");
      await page.waitForTimeout(hold);
      await touch("touchEnd");
      await page.waitForTimeout(600);
      expect((await mockCalls(page)).chat).toHaveLength(0);
      await expect(page.locator("#composer")).toHaveValue("Незавършен въп");
      expect(await winCalls(page)).toEqual(["restore"]);
      // A tap later on is the employee's own: it sends.
      await page.evaluate(() => window.__tedMock.setWinMode("mini"));
      await page.waitForTimeout(TAP_MS);
      await page.touchscreen.tap(x, y);
      await expect.poll(async () => (await mockCalls(page)).chat.length).toBe(1);
      await g.check();
    });
  }
});

test("mini chat with the Windows caption buttons (Window Controls Overlay): no own „–“/× next to Windows' „—“", async ({ page }) => {
  const g = guard(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "windowControlsOverlay", { configurable: true, value: { visible: true, getTitlebarAreaRect: () => ({ x: 0, y: 0, width: 260, height: 36 }), addEventListener() {}, removeEventListener() {} } });
  });
  await page.setViewportSize({ width: 400, height: 640 });
  await open(page, "signedIn=1&lat=200&win=mini");
  const bar = page.getByTestId("mini-bar");
  await expect(bar.getByTestId("mini-normal")).toBeVisible();
  // Windows' own „—“ (and ✕) go back to the bubble (MAIN, tests/unit/bubble-controller.test.js): no look-alike „–“ here.
  await expect(bar.getByTestId("mini-bubble")).toHaveCount(0);
  await expect(bar.getByTestId("mini-close")).toHaveCount(0);
  await expect(bar.locator("button")).toHaveCount(1);
  const r = await bar.evaluate((el) => ({ pad: parseFloat(getComputedStyle(el).paddingRight), right: el.querySelector('[data-testid="mini-normal"]').getBoundingClientRect().right, nl: el.querySelector('[data-testid="mini-normal"]').getBoundingClientRect().left, b: el.querySelector("b").getBoundingClientRect().right }));
  expect(r.pad).toBeGreaterThanOrEqual(140);
  expect(r.right).toBeLessThanOrEqual(400 - 140 + 1);
  expect(r.nl).toBeGreaterThan(r.b); // nothing overlaps „Тед“
  await page.screenshot({ path: "test-results/shots/bubble-mini-header-wco.png", clip: { x: 0, y: 0, width: 400, height: 36 } });
  await g.check();
});

test.describe("the bubble page", () => {
  test.use({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 3 });

  test("badge, pulse and side; no window.ted; the same CSP", async ({ page }) => {
    const g = guard(page);
    await page.goto("/bubble.html?unread=2");
    const b = page.getByTestId("bubble");
    await expect(b).toBeVisible();
    const badge = page.getByTestId("bubble-badge");
    await expect(badge).toHaveText("2");
    expect(await page.evaluate(() => ({ ted: typeof window.ted, meta: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content, bg: getComputedStyle(document.body).backgroundColor }))).toEqual({
      ted: "undefined", meta: "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'", bg: "rgba(0, 0, 0, 0)",
    });
    // The badge sits towards the screen centre: on the left for a bubble at the right edge.
    const pos = await badge.evaluate((el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right }; });
    expect(pos.l).toBeLessThan(10);
    await page.screenshot({ path: "test-results/shots/bubble-unread.png", omitBackground: true });
    await page.evaluate(() => window.__tedBubbleMock.push({ unread: 0 }));
    await expect(badge).toBeHidden();
    await page.evaluate(() => window.__tedBubbleMock.push({ attention: true, working: true, side: "left" }));
    await expect(badge).toHaveText("!");
    await expect(b).toHaveClass(/working/);
    await expect(b).toHaveAttribute("data-side", "left");
    const pos2 = await badge.evaluate((el) => el.getBoundingClientRect().right);
    expect(pos2).toBeGreaterThan(54);
    await expect(b).toHaveAttribute("aria-label", /чака вашето решение/);
    await page.screenshot({ path: "test-results/shots/bubble-working-attention.png", omitBackground: true });
    await page.evaluate(() => window.__tedBubbleMock.push({ attention: false, working: false, unread: 150 }));
    await expect(badge).toHaveText("99+");
    await g.check();
  });

  test("click = mini chat, double click = normal window, drag = moves (one per frame) and snaps, right click = menu", async ({ page }) => {
    const g = guard(page);
    await page.goto("/bubble.html");
    await expect(page.getByTestId("bubble")).toBeVisible();
    await page.mouse.move(32, 32);
    await page.mouse.down();
    await page.mouse.move(33, 34); // 2.2 px: still a click
    await page.mouse.up();
    await expect.poll(() => bubbleCalls(page)).toEqual([["click"]]);
    await page.evaluate(() => { window.__tedBubbleMock.calls.length = 0; });
    // (A press within Windows' double-click time of that click would still be its double click – the next test.)
    await page.waitForTimeout(SYSTEM_DOUBLE_MS);

    await page.mouse.dblclick(32, 32);
    await page.waitForTimeout(400);
    expect(await bubbleCalls(page)).toEqual([["openNormal"]]);
    await page.evaluate(() => { window.__tedBubbleMock.calls.length = 0; });

    await page.mouse.move(32, 32);
    await page.mouse.down();
    for (let x = 34; x <= 60; x += 2) await page.mouse.move(x, 30);
    await page.mouse.up();
    await page.waitForTimeout(350);
    const drag = await bubbleCalls(page);
    expect(drag[0]).toEqual(["dragStart"]);
    expect(drag.at(-1)).toEqual(["dragEnd", 28, -2]);
    const moves = drag.filter((c) => c[0] === "dragMove");
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.length).toBeLessThanOrEqual(13); // at most one per animation frame
    expect(drag.some((c) => c[0] === "click")).toBe(false);
    await page.evaluate(() => { window.__tedBubbleMock.calls.length = 0; });

    await page.mouse.click(32, 32, { button: "right" });
    await page.waitForTimeout(300);
    expect(await bubbleCalls(page)).toEqual([["menu"]]);
    await page.evaluate(() => { window.__tedBubbleMock.calls.length = 0; });

    // Keyboard: Enter on the focused bubble opens the chat at once.
    await page.getByTestId("bubble").focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => bubbleCalls(page)).toEqual([["click"]]);
    await g.check();
  });

  test("a slower double click (Windows: up to 500 ms press to press) is still the double click – never a click and a lost second click", async ({ page }) => {
    const g = guard(page);
    const clear = () => page.evaluate(() => { window.__tedBubbleMock.calls.length = 0; });
    await page.goto("/bubble.html");
    await expect(page.getByTestId("bubble")).toBeVisible();
    await page.mouse.move(32, 32);
    // The second press while the click still waits, released after the click was due (the gate's ~320 ms): one double
    // click (before: the click was sent while the button was down again and the double click was lost).
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    await page.waitForTimeout(120);
    await page.mouse.down(); await page.waitForTimeout(200); await page.mouse.up();
    await page.waitForTimeout(400);
    expect(await bubbleCalls(page)).toEqual([["openNormal"]]);
    await clear();
    await page.waitForTimeout(SYSTEM_DOUBLE_MS);

    // The second press after the click was sent (the mini chat is opening), within 500 ms of the first press: the
    // double click at once (MAIN then turns the mini chat into the normal window).
    const t0 = Date.now();
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
    await expect.poll(() => bubbleCalls(page), { intervals: [15] }).toEqual([["click"]]);
    expect(Date.now() - t0).toBeLessThan(SYSTEM_DOUBLE_MS - 60);
    await page.mouse.down();
    await expect.poll(() => bubbleCalls(page), { intervals: [15] }).toEqual([["click"], ["openNormal"]]);
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect(await bubbleCalls(page)).toEqual([["click"], ["openNormal"]]);
    await clear();
    await page.waitForTimeout(SYSTEM_DOUBLE_MS);

    // Further apart than Windows' double-click time: two clicks.
    await page.mouse.click(32, 32);
    await expect.poll(() => bubbleCalls(page)).toEqual([["click"]]);
    await page.waitForTimeout(SYSTEM_DOUBLE_MS);
    await page.mouse.click(32, 32);
    await expect.poll(() => bubbleCalls(page)).toEqual([["click"], ["click"]]);
    await g.check();
  });
});
