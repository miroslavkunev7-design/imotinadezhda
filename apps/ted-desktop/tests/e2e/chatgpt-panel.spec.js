// 0.1.7 „ChatGPT панел“ (docs/CONTRACT.md §23) against the mock: the mock bridge draws a FAKE page (#mock-chatgpt-view,
// no network) above everything over the rectangle the renderer reports – exactly where MAIN puts its native view.
import { test, expect } from "@playwright/test";
import { PHONE, guard, lastAnswer, login, mockCalls, noHorizontalScroll, send, shot } from "./helpers.js";

const AGENT = "lat=200&rg=1&consent=all&agent=1&rgStep=12&agentStep=120";
const SERVER = "lat=200";
const rgAnswer = (page) => page.locator('.msg.a[data-engine="realgpt"]').last();
const finished = (a) => expect(a.locator(".macts")).toBeVisible({ timeout: 15000 });
const fake = (page) => page.getByTestId("mock-chatgpt-view");
const rectOf = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
const PROMPT = "фасада на къща вечер, топла светлина";

async function pickRgModel(page, name = "Тест GPT А") {
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("model-btn")).toContainText("Real GPT · " + name);
}
// The fake page lies exactly over the placeholder (±1 px for sub-pixel layout).
async function expectOver(page) {
  await expect(fake(page)).toBeVisible();
  await expect.poll(async () => {
    const a = await rectOf(page.getByTestId("chatgpt-view"));
    const b = await rectOf(fake(page));
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
  }).toBeLessThanOrEqual(1);
}
async function serverCard(page) {
  await send(page, "Създай изображение: " + PROMPT);
  const a = lastAnswer(page);
  const card = a.getByTestId("chatgpt-card");
  await expect(card).toBeVisible();
  return { a, card };
}
const lastBounds = async (page) => (await mockCalls(page)).chatgptBounds.at(-1);

test("Real GPT card: „Отвори в ChatGPT“ opens the panel in Ted with the prompt only filled in; the page follows the layout", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Създай снимка на хол в стил минимализъм");
  const a = rgAnswer(page);
  await finished(a);
  const card = a.getByTestId("chatgpt-card");
  await expect(card).toBeVisible();
  await expect(page.getByTestId("chatgpt-panel")).toHaveCount(0); // nothing opens by itself
  expect((await mockCalls(page)).chatgptOpen).toEqual([]);
  await shot(page, "panel-desktop-1-card.png");
  const prompt = await card.getByTestId("chatgpt-prompt").inputValue();
  await card.getByTestId("chatgpt-open").click();
  const panel = page.getByTestId("chatgpt-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".cgp-ttl b")).toHaveText("ChatGPT");
  for (const id of ["chatgpt-add", "chatgpt-reload", "chatgpt-browser", "chatgpt-close"]) await expect(panel.getByTestId(id)).toBeVisible();
  await expect(panel.getByTestId("chatgpt-add")).toContainText("Добави снимката в чата");
  await expect(panel.getByTestId("chatgpt-back")).toHaveCount(0); // „Назад“ only in the phone layout
  await expectOver(page);
  await expect(page.getByTestId("mock-chatgpt-prompt")).toHaveValue(prompt); // filled in …
  await expect(page.getByTestId("mock-chatgpt-picture")).toBeHidden();       // … and not sent
  const calls = await mockCalls(page);
  expect(calls.chatgptOpen).toEqual([{ prompt, url: "https://chatgpt.com/?q=" + encodeURIComponent(prompt) }]);
  expect(calls.openInChatGpt).toEqual([]);
  expect(calls.openExternal).toEqual([]);
  // Beside the chat, like Canvas: the thread stays usable on the left.
  const pr = await rectOf(panel);
  expect(pr.x + pr.w).toBe(1366);
  expect(pr.w).toBeGreaterThan(400);
  await shot(page, "panel-desktop-2-open.png");
  // The page follows the layout: a smaller window and a collapsed sidebar.
  await page.setViewportSize({ width: 1180, height: 760 });
  await expectOver(page);
  await page.getByTestId("side-toggle").click();
  await expectOver(page);
  const b = await lastBounds(page);
  expect(b.visible).toBe(true);
  // ↻ and „Отвори в браузъра“ of the header; × closes (the page leaves, the chat stays).
  await panel.getByTestId("chatgpt-reload").click();
  await panel.getByTestId("chatgpt-browser").click();
  await expect(page.locator(".toast")).toContainText("Отворих ChatGPT във вашия браузър");
  await panel.getByTestId("chatgpt-close").click();
  await expect(panel).toHaveCount(0);
  await expect(fake(page)).toBeHidden();
  const after = await mockCalls(page);
  expect([after.chatgptReload, after.chatgptBrowser, after.chatgptClose]).toEqual([1, 1, 1]);
  expect(after.chatgptBounds.at(-1).visible).toBe(false);
  await g.check();
});

test("Ted server: a failed images.generate (free limit, no credits) shows „Направи снимката в ChatGPT“ with the question as prompt", async ({ page }) => {
  const g = guard(page);
  await login(page, SERVER);
  const { a, card } = await serverCard(page);
  await expect(a.getByTestId("activity-text")).toContainText("1 неуспешно");
  await expect(card).toHaveAttribute("data-from", "server");
  await expect(card.locator("h4")).toHaveText("Направи снимката в ChatGPT");
  await expect(card).toContainText("Сървърът на Тед не можа да направи снимката");
  await expect(card.getByTestId("chatgpt-prompt")).toHaveValue(PROMPT); // the „Създай изображение: “ prefix is not part of it
  await expect(card.getByTestId("chatgpt-open")).toHaveText(/Направи снимката в ChatGPT/);
  expect((await mockCalls(page)).chatgptOpen).toEqual([]); // only on the click
  await card.getByTestId("chatgpt-open").click();
  await expectOver(page);
  await expect(page.getByTestId("mock-chatgpt-prompt")).toHaveValue(PROMPT);
  expect((await mockCalls(page)).chatgptOpen).toEqual([{ prompt: PROMPT, url: "https://chatgpt.com/?q=" + encodeURIComponent(PROMPT) }]);
  // The card is kept with the answer (another chat and back).
  await page.getByTestId("side-new").click();
  await page.locator(".side .row .t", { hasText: "Създай изображение" }).first().click();
  await expect(lastAnswer(page).getByTestId("chatgpt-card")).toHaveAttribute("data-from", "server");
  // An answer without a failed picture has no card.
  await send(page, "справка за седмицата");
  await expect(lastAnswer(page).getByTestId("actions-card")).toBeVisible();
  await expect(lastAnswer(page).getByTestId("chatgpt-card")).toHaveCount(0);
  await g.check();
});

test("„📋 Добави снимката в чата“: an empty clipboard is explained; a copied picture becomes an attachment like a picked file", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, SERVER);
  const { card } = await serverCard(page);
  await card.getByTestId("chatgpt-open").click();
  const panel = page.getByTestId("chatgpt-panel");
  await expectOver(page);
  await panel.getByTestId("chatgpt-add").click();
  await expect(page.locator(".toast")).toContainText("В клипборда няма снимка");
  await expect(page.locator(".compose .cfile")).toHaveCount(0);
  // The employee sends the prompt in ChatGPT, copies the finished picture and adds it.
  await page.getByTestId("mock-chatgpt-send").click();
  await page.getByTestId("mock-chatgpt-copy").click();
  await panel.getByTestId("chatgpt-add").click();
  const chip = page.locator(".compose .cfile");
  await expect(chip).toHaveCount(1);
  await expect(chip).toContainText(/Снимка от ChatGPT .*\.jpg/); // re-encoded like every attached picture
  await expect(chip.locator("img")).toBeVisible();
  await expect(page.locator(".toast")).toContainText("Снимката от ChatGPT е добавена към съобщението");
  // The toast sits in the chat column, not under the page.
  const tr = await rectOf(page.locator(".toast"));
  const vr = await rectOf(page.getByTestId("chatgpt-view"));
  expect(tr.x + tr.w).toBeLessThanOrEqual(vr.x);
  expect((await mockCalls(page)).chatgptClip).toBe(2);
  await shot(page, "panel-desktop-3-attached.png");
  await page.fill("#composer", "Какво мислиш за тази снимка?");
  await page.keyboard.press("Enter");
  await expect(page.locator(".msg.u").last().locator(".ufiles img")).toBeVisible();
  await expect(page.locator(".compose .cfile")).toHaveCount(0);
  await g.check();
});

test("„📋 Добави снимката в чата“: a picture over 8 MB is refused with the reason", async ({ page }) => {
  const g = guard(page);
  await login(page, SERVER + "&clip=big");
  const { card } = await serverCard(page);
  await card.getByTestId("chatgpt-open").click();
  await page.getByTestId("chatgpt-add").click();
  await expect(page.locator(".toast")).toContainText("над 8 MB");
  await expect(page.locator(".compose .cfile")).toHaveCount(0);
  await g.check();
});

test("Ctrl+V of a picture in the composer attaches it (the same path as a picked file)", async ({ page }) => {
  const g = guard(page);
  await login(page, SERVER);
  await page.locator("#composer").focus();
  await page.evaluate(async () => {
    const cv = document.createElement("canvas"); cv.width = 200; cv.height = 120;
    const c = cv.getContext("2d"); c.fillStyle = "#850F2D"; c.fillRect(0, 0, 200, 120);
    const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "image.png", { type: "image/png" }));
    document.querySelector("#composer").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  const chip = page.locator(".compose .cfile");
  await expect(chip).toHaveCount(1);
  await expect(chip).toContainText("image.jpg");
  await g.check();
});

test("overlays hide the native page: Settings, search, a menu over it, the picture preview; a menu beside it does not", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, SERVER);
  const { card } = await serverCard(page);
  await card.getByTestId("chatgpt-open").click();
  await expectOver(page);
  // A menu beside the panel (the „+“ menu at the composer) leaves the page on screen – no flicker.
  await page.locator(".c-plus").click();
  await expect(page.locator(".pop")).toBeVisible();
  await page.waitForTimeout(300);
  await expect(fake(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop")).toHaveCount(0);
  // Settings (a dialog over the whole window).
  await page.getByTestId("me-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: "Настройки" }).click();
  await expect(page.locator(".modal .set-list")).toBeVisible();
  await expect(fake(page)).toBeHidden();
  expect((await lastBounds(page)).visible).toBe(false);
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal")).toHaveCount(0);
  await expectOver(page);
  // Search (Ctrl+K).
  await page.keyboard.press("Control+k");
  await expect(page.locator("#srch")).toBeVisible();
  await expect(fake(page)).toBeHidden();
  await page.keyboard.press("Escape");
  await expectOver(page);
  // The chat's „…“ menu drops down over the panel.
  await page.locator(".top").getByRole("button", { name: "Опции на разговора" }).click();
  await expect(page.locator(".pop")).toBeVisible();
  await expect(fake(page)).toBeHidden();
  await page.keyboard.press("Escape");
  await expectOver(page);
  // The picture preview (lightbox) of an attached picture.
  await page.getByTestId("mock-chatgpt-send").click();
  await page.getByTestId("mock-chatgpt-copy").click();
  await page.getByTestId("chatgpt-add").click();
  await page.fill("#composer", "ето снимката");
  await page.keyboard.press("Enter");
  await page.locator(".msg.u").last().locator(".ufiles img").click();
  await expect(page.locator(".lb")).toBeVisible();
  await expect(fake(page)).toBeHidden();
  await page.locator(".lb .b").click();
  await expectOver(page);
  await g.check();
});

test("phone 400×860: the panel takes the whole content area with „Назад“; messages in its status line; a picture returns to the chat", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(PHONE);
  await login(page, SERVER);
  const { card } = await serverCard(page);
  await shot(page, "panel-phone-1-card.png");
  await card.getByTestId("chatgpt-open").click();
  const panel = page.getByTestId("chatgpt-panel");
  await expect(panel).toBeVisible();
  const pr = await rectOf(panel);
  expect(pr).toMatchObject({ x: 0, y: 36, w: 400 });
  expect(pr.y + pr.h).toBe(860);
  await expect(panel.getByTestId("chatgpt-back")).toBeVisible();
  await expect(panel.getByTestId("chatgpt-close")).toHaveCount(0);
  await expect(panel.getByTestId("chatgpt-add")).toContainText("Добави в чата");
  await expectOver(page);
  // The answer of a button appears in the panel's own status line (a floating toast would lie under the page).
  await expect(panel.getByTestId("chatgpt-notice")).toContainText("ChatGPT е отворен в панела");
  await expect(page.locator(".toast")).toHaveCount(0);
  await noHorizontalScroll(page);
  await shot(page, "panel-phone-2-open.png");
  await page.getByTestId("mock-chatgpt-send").click();
  await page.getByTestId("mock-chatgpt-copy").click();
  await panel.getByTestId("chatgpt-add").click();
  await expect(panel).toHaveCount(0); // back to the chat, the picture waits in the composer
  await expect(page.locator(".compose .cfile")).toHaveCount(1);
  await expect(page.locator(".toast")).toContainText("Снимката от ChatGPT е добавена");
  await expect(fake(page)).toBeHidden();
  await shot(page, "panel-phone-3-attached.png");
  // „Назад“ closes the panel.
  await card.getByTestId("chatgpt-open").click();
  await expect(panel).toBeVisible();
  await panel.getByTestId("chatgpt-back").click();
  await expect(panel).toHaveCount(0);
  await expect(fake(page)).toBeHidden();
  await g.check();
});

test("the bubble and the mini chat show no panel; back in the normal window it is there again", async ({ page }) => {
  const g = guard(page);
  await login(page, SERVER);
  const { card } = await serverCard(page);
  await card.getByTestId("chatgpt-open").click();
  await expectOver(page);
  await page.evaluate(() => window.__tedMock.setWinMode("bubble"));
  await expect(page.getByTestId("chatgpt-panel")).toHaveCount(0);
  await expect(fake(page)).toBeHidden();
  await page.evaluate(() => window.__tedMock.setWinMode("mini"));
  await expect(page.getByTestId("mini-bar")).toBeVisible();
  await expect(page.getByTestId("chatgpt-panel")).toHaveCount(0);
  await expect(fake(page)).toBeHidden();
  await page.evaluate(() => window.__tedMock.setWinMode("normal"));
  await expectOver(page);
  await expect(page.getByTestId("mock-chatgpt-prompt")).toHaveValue(PROMPT); // the same page, not reloaded
  // A card clicked in the mini chat brings the normal window back with the panel.
  await page.evaluate(() => window.__tedMock.setWinMode("mini"));
  await lastAnswer(page).getByTestId("chatgpt-open").click();
  await expect(page.getByTestId("mini-bar")).toHaveCount(0);
  await expectOver(page);
  expect((await mockCalls(page)).window).toContain("restore");
  await g.check();
});

test("Real GPT text only + „Създай изображение“: GPT cannot draw – the card with the question opens the panel", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=200&rg=1&consent=text&rgStep=12");
  await pickRgModel(page);
  await page.locator(".c-plus").click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Създай изображение/ }).click();
  await expect(page.getByTestId("hint-image")).toBeVisible();
  await send(page, "уютна кухня с дървени шкафове");
  const a = rgAnswer(page);
  await finished(a);
  const card = a.getByTestId("chatgpt-card");
  await expect(card).toHaveAttribute("data-from", "local");
  await expect(card.getByTestId("chatgpt-prompt")).toHaveValue("уютна кухня с дървени шкафове");
  await card.getByTestId("chatgpt-open").click();
  await expectOver(page);
  // Without the hint there is no such card.
  await send(page, "здравей");
  await finished(rgAnswer(page));
  await expect(rgAnswer(page).getByTestId("chatgpt-card")).toHaveCount(0);
  await g.check();
});

test("phone: an approval card that arrives never waits behind the panel", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(PHONE);
  await login(page, "lat=200&rg=1&consent=all&agent=1&rgStep=12&agentStep=350");
  await pickRgModel(page);
  await send(page, "Създай снимка на хол в стил минимализъм");
  const first = page.locator('.msg.a[data-engine="realgpt"]').first();
  await finished(first);
  const card = first.getByTestId("chatgpt-card");
  await send(page, "Намери имоти в Тестоград и запиши оглед");
  await card.getByTestId("chatgpt-open").click();
  await expect(page.getByTestId("chatgpt-panel")).toBeVisible();
  await expect(page.locator(".ap-stack")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("chatgpt-panel")).toHaveCount(0);
  await expect(fake(page)).toBeHidden();
  await expect(page.locator(".toast")).toContainText("Тед чака вашето решение");
  await g.check();
});

test("Canvas and the panel: the panel hides Canvas without losing it; „Отвори в Canvas“ closes the panel", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, SERVER);
  const { a, card } = await serverCard(page);
  await a.getByRole("button", { name: "Отвори в Canvas" }).click();
  await expect(page.getByTestId("canvas")).toBeVisible();
  await page.fill("#cv-txt", "Незапазен текст в Canvas");
  await card.getByTestId("chatgpt-open").click();
  await expectOver(page);
  await expect(page.getByTestId("canvas")).toBeHidden();
  await page.getByTestId("chatgpt-close").click();
  await expect(page.getByTestId("canvas")).toBeVisible();
  await expect(page.locator("#cv-txt")).toHaveValue("Незапазен текст в Canvas");
  await card.getByTestId("chatgpt-open").click();
  await expectOver(page);
  await a.getByRole("button", { name: "Отвори в Canvas" }).click();
  await expect(page.getByTestId("chatgpt-panel")).toHaveCount(0);
  await expect(fake(page)).toBeHidden();
  await expect(page.getByTestId("canvas")).toBeVisible();
  await g.check();
});

// Finding (review): at 641–899 px (Ted snapped to half a 1366/1536/1600 px screen) the panel's CSS already covers the whole
// content area – its narrow behaviour must follow the same breakpoint, or toasts and approval cards wait behind the page.
test("a window 800 px wide: the panel's narrow layout – „Назад“, messages in its footer, back to the chat after a picture", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 800, height: 820 });
  await login(page, SERVER);
  const { card } = await serverCard(page);
  await card.getByTestId("chatgpt-open").click();
  const panel = page.getByTestId("chatgpt-panel");
  await expect(panel).toBeVisible();
  const pr = await rectOf(panel);
  expect(pr).toMatchObject({ x: 0, y: 36, w: 800 });
  await expect(panel.getByTestId("chatgpt-back")).toBeVisible();
  await expect(panel.getByTestId("chatgpt-close")).toHaveCount(0);
  await expectOver(page);
  // The card's message is in the panel's own footer – never a floating toast under the native page.
  await expect(panel.getByTestId("chatgpt-notice")).toContainText("ChatGPT е отворен в панела");
  await expect(page.locator(".toast")).toHaveCount(0);
  // An empty clipboard: the explanation is readable (in the footer, not under the page).
  await panel.getByTestId("chatgpt-add").click();
  await expect(panel.getByTestId("chatgpt-notice")).toContainText("В клипборда няма снимка");
  await expect(page.locator(".toast")).toHaveCount(0);
  const n = await panel.getByTestId("chatgpt-notice").boundingBox();
  const v = await rectOf(page.getByTestId("chatgpt-view"));
  expect(n.y).toBeGreaterThanOrEqual(v.y + v.h - 1); // below the page, not covered by it
  await noHorizontalScroll(page);
  await shot(page, "panel-800-open.png");
  // A picture: back to the chat, where it waits in the composer – with the confirmation as a normal toast.
  await page.getByTestId("mock-chatgpt-send").click();
  await page.getByTestId("mock-chatgpt-copy").click();
  await panel.getByTestId("chatgpt-add").click();
  await expect(panel).toHaveCount(0);
  await expect(fake(page)).toBeHidden();
  await expect(page.locator(".compose .cfile")).toHaveCount(1);
  await expect(page.locator(".toast")).toContainText("Снимката от ChatGPT е добавена");
  await g.check();
});

test("a window 800 px wide: an approval card that arrives closes the panel – it never waits behind the page", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 800, height: 820 });
  await login(page, "lat=200&rg=1&consent=all&agent=1&rgStep=12&agentStep=350");
  await pickRgModel(page);
  await send(page, "Създай снимка на хол в стил минимализъм");
  const first = page.locator('.msg.a[data-engine="realgpt"]').first();
  await finished(first);
  const card = first.getByTestId("chatgpt-card");
  await send(page, "Намери имоти в Тестоград и запиши оглед");
  await card.getByTestId("chatgpt-open").click();
  await expect(page.getByTestId("chatgpt-panel")).toBeVisible();
  await expect(page.locator(".ap-stack")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("chatgpt-panel")).toHaveCount(0);
  await expect(fake(page)).toBeHidden();
  await expect(page.locator(".toast")).toContainText("Тед чака вашето решение");
  // Nothing of the window lies under the (gone) page: the approval card is the topmost element at its centre.
  const ap = await page.locator(".ap-stack").boundingBox();
  const top = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest(".ap-stack") ? "approval" : e.id || e.className) : null; }, [ap.x + ap.width / 2, ap.y + Math.min(ap.height / 2, 40)]);
  expect(top).toBe("approval");
  await g.check();
});

test("the note about a page outside the panel: „Отвори в браузъра“ only on the employee's click; a refused download is explained", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 1366, height: 820 });
  await login(page, SERVER);
  const { card } = await serverCard(page);
  await card.getByTestId("chatgpt-open").click();
  await expectOver(page);
  const panel = page.getByTestId("chatgpt-panel");
  await expect(panel.getByTestId("chatgpt-blocked")).toHaveCount(0);
  // A script / frame / redirect of the page tried another site: MAIN opened nothing, the note offers the button.
  await page.evaluate(() => window.__tedMock.panelBlocked({ host: "example.org", external: false, canOpen: true }));
  const note = panel.getByTestId("chatgpt-blocked");
  await expect(note).toContainText("„example.org“ не се отваря в панела.");
  await expect(note.getByTestId("chatgpt-blocked-open")).toHaveText("Отвори в браузъра");
  await expectOver(page); // the note pushes the page down; the native view follows the placeholder
  expect((await mockCalls(page)).chatgptBrowserBlocked).toBe(0);
  await shot(page, "panel-blocked-note.png");
  await note.getByTestId("chatgpt-blocked-open").click();
  await expect(note).toContainText("отворих го във вашия браузър");
  await expect(note.getByTestId("chatgpt-blocked-open")).toHaveCount(0);
  expect((await mockCalls(page)).chatgptBrowserBlocked).toBe(1);
  expect((await mockCalls(page)).chatgptBrowser).toBe(0); // not the panel's own „Отвори в браузъра“
  // An address MAIN may not hand on (a user part, another scheme): no button.
  await page.evaluate(() => window.__tedMock.panelBlocked({ host: "evil.example", external: false, canOpen: false }));
  await expect(note).toContainText("Ако ви трябва, отворете ChatGPT в браузъра.");
  await expect(note.getByTestId("chatgpt-blocked-open")).toHaveCount(0);
  // A refused download (another site, no click, a program or a disk image).
  await page.evaluate(() => window.__tedMock.panelBlocked({ host: "thirdparty.example", external: false, canOpen: false, download: true }));
  await expect(note).toContainText("Изтеглянето от „thirdparty.example“ е спряно");
  // The employee moves on in ChatGPT: the note goes away.
  await page.evaluate(() => window.__tedMock.panelBlocked(null));
  await expect(note).toHaveCount(0);
  await expectOver(page);
  await g.check();
});
