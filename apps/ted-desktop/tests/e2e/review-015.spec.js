// 0.1.5 review fixes (purity, honesty, UX). One test per finding that the renderer can show; MAIN findings are pinned
// in tests/unit/review-015.test.js.
import { test, expect } from "@playwright/test";
import { guard, login, mockCalls, send } from "./helpers.js";

const rgAnswer = (page) => page.locator('.msg.a[data-engine="realgpt"]').last();

async function pickRgModel(page, name = "Тест GPT А") {
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("model-btn")).toContainText("Real GPT · " + name);
}

test("H1: a lost ChatGPT connection never switches to Ted's server – sending stays blocked until the employee chooses", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=100&rg=1&consent=text");
  await pickRgModel(page);
  await send(page, "Нужен е повторен вход");
  await expect(rgAnswer(page).getByTestId("error-banner")).toContainText("Входът с ChatGPT е изтекъл");
  // The engine stays Real GPT and says so; a banner offers sign-in or an explicit switch.
  await expect(page.getByTestId("rg-off")).toBeVisible();
  await expect(page.getByTestId("rg-off")).toContainText("не превключва сам");
  await expect(page.getByTestId("model-btn")).toContainText("Real GPT");
  const before = await mockCalls(page);
  await send(page, "Следващ въпрос след изтеклия вход");
  await expect(page.locator(".modal")).toBeVisible(); // the ChatGPT sign-in, not an answer from the server
  const after = await mockCalls(page);
  expect(after.chat.length).toBe(before.chat.length); // nothing went to /api/assistant
  expect(after.rgSend.length).toBe(before.rgSend.length);
  await expect(page.locator('.msg.a[data-engine="server"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  // Only the employee's own click switches the engine.
  await page.getByTestId("rg-off-server").click();
  await expect(page.getByTestId("rg-off")).toHaveCount(0);
  await expect(page.getByTestId("model-btn")).not.toContainText("Real GPT");
  await g.check();
});

test("H2/F11: with Real GPT the Agents video skill never opens the server AI video wizard", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=100&rg=1&consent=all");
  await pickRgModel(page);
  await page.getByTestId("side-agents").click();
  await expect(page.getByTestId("agents-page")).toBeVisible();
  await page.getByTestId("agents-page").getByRole("button", { name: /AI Видео на имот/ }).click();
  const m = page.locator(".modal");
  await expect(m).toContainText("в приложението ChatGPT");
  const here = m.getByTestId("skill-here");
  await expect(here).toHaveText("Подготви заявка за ChatGPT");
  // The skill is done here: no big „Отвори в CRM“ button (review: only for what truly needs the site).
  await expect(m.getByRole("button", { name: "Отвори в CRM" })).toHaveCount(0);
  await here.click();
  await expect(page.locator(".modal").filter({ hasText: "Видео на имот" })).toHaveCount(0);
  await expect(page.getByTestId("hint-video")).toBeVisible();
  await expect(page.locator("#composer")).toHaveValue("Видео на имот: ");
  const c = await mockCalls(page);
  expect(c.videoPrepare).toEqual([]);
  expect(c.videoStart).toEqual([]);
  await g.check();
});

test("L19: skills done here show no „Отвори в CRM“ button; „Събрани“ keeps a small link with the reason", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=50");
  await page.getByTestId("side-agents").click();
  for (const [name, crm] of [["АИ Качване на имот", null], ["AI Видео на имот", null], ["Събиране на имоти", "записът в „Събрани“ е само в сайта"]]) {
    await page.getByTestId("agents-page").getByRole("button", { name: new RegExp(name) }).first().click();
    const m = page.locator(".modal");
    await expect(m.getByTestId("skill-here")).toBeVisible();
    await expect(m.getByRole("button", { name: "Отвори в CRM", exact: true })).toHaveCount(0);
    if (crm) await expect(m).toContainText(crm);
    await page.keyboard.press("Escape");
    await expect(m).toHaveCount(0);
  }
  await g.check();
});

const AGENT = "lat=200&rg=1&consent=all&agent=1&rgStep=8&agentStep=120";
const finished = (a) => expect(a.locator(".macts")).toBeVisible({ timeout: 20000 });

test("F1: every link shows its real domain; a link text that looks like an address is the real-domain chip", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Намери обяви за двустаен в Тестоград");
  const a = rgAnswer(page);
  await finished(a);
  const link = a.getByTestId("md-table").getByRole("link", { name: /Тестов двустаен с тераса/ });
  await expect(link.getByTestId("link-domain")).toHaveText("example.test");
  await g.check();
});

test("F13: a foreign picture is fetched only with the employee's click; tool-result pictures load by themselves", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Намери обяви за двустаен в Тестоград");
  await finished(rgAnswer(page));
  await expect(rgAnswer(page).getByTestId("md-img").first()).toHaveAttribute("data-state", "ok");
  let calls = await mockCalls(page);
  expect(calls.browseImageClicked).toEqual([]); // provenance: no click needed, MAIN knows these addresses
  await send(page, "Покажи чужда снимка");
  await expect(page.locator('.msg.a[data-engine="realgpt"]')).toHaveCount(2);
  const a = rgAnswer(page);
  await finished(a);
  await a.getByTestId("img-chip").click();
  await expect(a.getByTestId("md-img")).toHaveAttribute("data-state", "ok");
  calls = await mockCalls(page);
  expect(calls.browseImageClicked).toEqual(["https://foreign.example.test/photo-1.png"]);
  await g.check();
});

test("F5: a prompt too long for a link is copied and chatgpt.com opens without it", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Създай снимка на хол в стил минимализъм");
  const a = rgAnswer(page);
  await finished(a);
  const card = a.getByTestId("chatgpt-card");
  const ta = card.getByTestId("chatgpt-prompt");
  const long = "Фотореалистична снимка на двуетажна къща в Шумен, ".repeat(40).slice(0, 1500);
  await ta.fill(long);
  await expect(card.getByTestId("chatgpt-len")).toContainText("Твърде дълга за линк");
  await expect(card.getByTestId("chatgpt-open")).toHaveText(/Копирай и отвори ChatGPT/);
  await card.getByTestId("chatgpt-open").click();
  await expect(page.locator(".toast")).toContainText("Заявката е копирана и ChatGPT е отворен");
  const calls = await mockCalls(page);
  expect(calls.copy.at(-1)).toBe(long);
  expect(calls.openInChatGpt).toEqual([{ prompt: "", url: "https://chatgpt.com/" }]);
  await ta.fill("Кратка заявка");
  await expect(card.getByTestId("chatgpt-open")).toHaveText(/Отвори в ChatGPT/);
  await g.check();
});

test("M1: with Real GPT the voice (Gemini on Ted's server) asks first; refused = nothing sent; answers are never read by themselves", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=100&rg=1&consent=text");
  await pickRgModel(page);
  await send(page, "Здравей");
  const a = rgAnswer(page);
  await finished(a);
  expect((await mockCalls(page)).tts).toEqual([]); // „Кога да говори“ = default: no automatic reading of a Real GPT answer
  await a.getByRole("button", { name: "Чуй" }).click();
  const m = page.locator(".modal").filter({ hasText: "Гласът не е от вашия ChatGPT план" });
  await expect(m).toContainText("Google Gemini");
  await m.getByRole("button", { name: "Отказ" }).click();
  expect((await mockCalls(page)).tts).toEqual([]);
  await a.getByRole("button", { name: "Чуй" }).click();
  await page.getByTestId("confirm-ok").click();
  await expect.poll(async () => (await mockCalls(page)).tts.length).toBeGreaterThan(0);
  // Asked once per session: the next „Чуй“ goes straight on.
  await page.getByTestId("confirm-ok").waitFor({ state: "detached" });
  await g.check();
});

test("L1: with Real GPT nothing goes to /api/assistant at start; the server model list loads when the model menu opens", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=50&rg=1&eng=rg&consent=text");
  await expect(page.getByTestId("model-btn")).toContainText("Real GPT");
  await page.waitForTimeout(600);
  const site = async () => (await mockCalls(page)).site.map((c) => c.fn);
  expect((await site()).filter((f) => f === "api.models")).toEqual([]);
  await page.getByTestId("model-btn").click();
  await expect.poll(async () => (await site()).filter((f) => f === "api.models").length).toBe(1);
  await g.check();
});

for (const vp of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1366, height: 820 }]) {
  test(`„+“ menu on the Home at ${vp.width}×${vp.height}: every root item is inside the visible menu (no scroll box)`, async ({ page }) => {
    const g = guard(page);
    await page.setViewportSize(vp);
    await login(page, "lat=50");
    await page.locator(".c-plus").click();
    const r = await page.locator(".pop").evaluate((pop) => {
      const b = pop.getBoundingClientRect();
      const items = [...pop.querySelectorAll('[role="menuitem"]')].map((x) => { const q = x.getBoundingClientRect(); return { t: x.textContent.trim().slice(0, 30), in: q.top >= b.top - 1 && q.bottom <= b.bottom + 1 && q.bottom <= innerHeight }; });
      return { scroll: pop.scrollHeight > pop.clientHeight + 1, out: items.filter((x) => !x.in).map((x) => x.t), n: items.length, top: b.top, topBar: document.querySelector(".shell .top").getBoundingClientRect().bottom };
    });
    expect(r.n).toBe(8);
    expect(r.out).toEqual([]);
    expect(r.scroll).toBe(false);
    expect(r.top).toBeGreaterThanOrEqual(r.topBar); // never over the top bar (Чат | Работа)
    await g.check();
  });
}

test("keyboard: + → Enter opens with the focus inside; ↓↓ Enter = „Създай изображение“; Tab stays in the menu; Esc returns to +", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=50");
  await page.locator(".c-plus").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.textContent)).toMatch(/^Добави снимки и файлове/);
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement.closest(".pop"))).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => page.evaluate(() => document.activeElement.textContent)).toMatch(/^Създай изображение/);
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop")).toHaveCount(0);
  await expect(page.locator("#composer")).toHaveValue(/^Създай изображение: /);
  await expect(page.locator("#composer")).toBeFocused(); // the hint puts the focus into the composer
  // Esc closes and gives the focus back to „+“.
  await page.locator(".c-plus").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".pop")).toBeVisible();
  await page.keyboard.press("End");
  await expect.poll(() => page.evaluate(() => document.activeElement.textContent)).toMatch(/^Проекти/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".pop")).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement.classList.contains("c-plus"))).toBe(true);
  await g.check();
});

test("phone: the drawer closes with Esc and the focus returns to „Меню“", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 400, height: 860 });
  await login(page, "lat=50");
  await page.locator(".top.ph").getByRole("button", { name: "Меню" }).click();
  await expect(page.locator(".ph-drawer.open")).toHaveCount(1);
  expect(await page.evaluate(() => !!document.activeElement.closest(".ph-drawer"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator(".ph-drawer.open")).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement.getAttribute("aria-label"))).toBe("Меню");
  await g.check();
});

test("phone: the failure count of the collapsed activity line is never cut off", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 400, height: 860 });
  await login(page, AGENT);
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: /Тест GPT А/ }).click();
  await send(page, "Намери обяви за двустаен в Тестоград");
  const a = rgAnswer(page);
  await finished(a);
  const tail = a.locator(".act-tail");
  await expect(tail).toContainText("1 неуспешна");
  const fit = await a.getByTestId("activity-line").evaluate((line) => {
    const t = line.querySelector(".act-tail").getBoundingClientRect(); const l = line.getBoundingClientRect();
    return { inside: t.right <= l.right + 1 && t.width > 0, overflow: line.querySelector(".act-tail").scrollWidth > line.querySelector(".act-tail").clientWidth + 1 };
  });
  expect(fit).toEqual({ inside: true, overflow: false });
  await g.check();
});

test("phone: a long file name in a project folder wraps inside its card", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize({ width: 400, height: 860 });
  await login(page, "lat=50");
  await page.locator(".top.ph").getByRole("button", { name: "Меню" }).click();
  await page.getByTestId("side-projects").click();
  await page.getByTestId("project-item").first().getByTestId("project-folder-btn").click();
  const long = "тестова-скица-на-апартамента-в-центъра-на-тестоград-окончателна-версия.pdf";
  await page.getByTestId("folder-in").setInputFiles({ name: long, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%тест\n") });
  await expect(page.getByTestId("folder-item")).toHaveCount(1);
  const r = await page.getByTestId("folder-item").locator(".fcard").evaluate((card) => {
    const c = card.getBoundingClientRect();
    return [...card.querySelectorAll(".fc-main, .fx, .fx b, .fc-acts")].map((el) => Math.round(el.getBoundingClientRect().right - c.right)).filter((d) => d > 1);
  });
  expect(r).toEqual([]);
  await expect(page.getByTestId("case-tab-chats")).toHaveText("Чатове");
  const tabH = await page.getByTestId("case-tab-chats").evaluate((b) => b.getBoundingClientRect().height);
  expect(tabH).toBeLessThan(44); // one line
  await g.check();
});

test("tools refused: the card alone explains it (no second red line); the waiting line of the server looks like Real GPT's", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=150&rg=1&consent=all&agentFail=tools_unsupported&rgStep=12");
  await pickRgModel(page);
  await send(page, "Намери обяви за наем");
  const a = rgAnswer(page);
  await expect(a.getByTestId("tools-unsupported")).toBeVisible();
  await expect(a.getByTestId("error-banner")).toHaveCount(0);
  await g.check();
});

test("server waiting line: one label, time as „N с“, then one model label per answer (action row)", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=2300");
  await send(page, "Намери имоти и запиши оглед");
  const w = page.getByTestId("waiting");
  await expect(w).toHaveText("Тед работи на сървъра…");
  await expect(page.locator(".srv-wait .lw-n")).toHaveCount(0);
  await expect(page.getByTestId("wait-clock")).toHaveText(/^(< 1|[1-9]) с$/);
  const a = page.locator('.msg.a[data-engine="server"]').last();
  await expect(a.locator(".macts")).toBeVisible({ timeout: 15000 });
  await expect(a.getByTestId("model-chip")).toHaveCount(1);
  await expect(a.locator(".foot-tags [data-testid=model-chip]")).toHaveCount(0);
  await g.check();
});

test("lightbox: the focus moves to „Затвори“ and back to the picture", async ({ page }) => {
  const g = guard(page);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Намери обяви за двустаен в Тестоград");
  const a = rgAnswer(page);
  await finished(a);
  const img = a.getByTestId("md-img").first();
  await expect(img).toHaveAttribute("data-state", "ok");
  await img.click();
  await expect(page.getByTestId("md-lightbox")).toBeVisible();
  expect(await page.evaluate(() => document.activeElement.textContent)).toBe("Затвори");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("md-lightbox")).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement.getAttribute("data-testid"))).toBe("md-img");
  await g.check();
});

test("Settings: the Real GPT tools choice is a segmented control – the chosen side is clear, not greyed out", async ({ page }) => {
  const g = guard(page);
  await login(page, "lat=50&rg=1&consent=all");
  await page.getByTestId("me-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: "Настройки" }).click();
  await page.locator('.modal .set-row[data-row="safety"]').click();
  const seg = page.locator(".consent-seg");
  await expect(seg.getByRole("button", { name: "Разреши" })).toHaveAttribute("aria-pressed", "true");
  await expect(seg.getByRole("button", { name: "Разреши" })).toBeEnabled();
  const op = await seg.getByRole("button", { name: "Разреши" }).evaluate((b) => getComputedStyle(b).opacity);
  expect(op).toBe("1");
  await seg.getByRole("button", { name: "Само текст" }).click();
  await expect(seg.getByRole("button", { name: "Само текст" })).toHaveAttribute("aria-pressed", "true");
  await g.check();
});
