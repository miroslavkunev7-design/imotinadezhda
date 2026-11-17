// 0.1.5 „like ChatGPT“ (docs/CONTRACT.md §15, §16): answers without a bubble on one readable panel, the activity as ONE
// line (running: current step + time; done: counted summary, click = all steps), approvals never folded away, GFM
// Markdown (tables, headings, lists), links that open the EXACT address, source chips, pictures inline ONLY from tool
// results (bytes through MAIN – ted.browse.image / ted.files.read), foreign pictures as chips, phone width, and the
// full-colour icons of the „+“ menu, the sidebar and the account menu. Mock build only; fictional data; no network.
import { test, expect } from "@playwright/test";
import { PHONE, guard, login, mockCalls, noHorizontalScroll, openActivity, send, shot } from "./helpers.js";

const LOOK = { width: 1366, height: 820 };
const AGENT = "lat=200&rg=1&consent=all&agent=1&rgStep=8&agentStep=120";
const SLOW = "lat=200&rg=1&consent=all&agent=1&rgStep=8&agentStep=900";
const LISTINGS = "Намери обяви за двустаен в Тестоград";
const PHOTOS = ["101-1", "101-2", "101-3", "102-1", "102-2"].map((k) => `https://example.test/img/obiava-${k}.png`);
const LONG_URL = "https://example.test/tarsene/dvustaen-testograd?sort=price&page=1&filter=" + "nov-stroitelstvo-tuhla-etazh-2-5-".repeat(6) + "end";

const rgAnswer = (page) => page.locator('.msg.a[data-engine="realgpt"]').last();
const finished = (a) => expect(a.locator(".macts")).toBeVisible({ timeout: 20000 });
async function pickRgModel(page, name = "Тест GPT А") {
  await page.getByTestId("model-btn").click();
  await page.locator(".pop").getByRole("menuitem", { name: new RegExp(name) }).click();
  await expect(page.getByTestId("model-btn")).toContainText(name);
}
const toTop = (loc) => loc.evaluate((el) => el.scrollIntoView({ block: "start" }));

test("answers have no bubble: text on the readable thread panel; questions stay right-aligned bubbles; the action row", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(LOOK);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, LISTINGS);
  const a = rgAnswer(page);
  await finished(a);
  await expect(page.locator(".msg.a .bub")).toHaveCount(0);
  const look = await a.locator(".ans").evaluate((el) => {
    const s = getComputedStyle(el);
    const col = el.closest(".cg-col");
    const cs = getComputedStyle(col);
    const u = document.querySelector(".msg.u .bub").getBoundingClientRect();
    const c = col.getBoundingClientRect();
    return { bg: s.backgroundColor, img: s.backgroundImage, border: s.borderTopWidth, shadow: s.boxShadow, panel: cs.backgroundImage, uRight: c.right - u.right, uLeft: u.left - c.left, colW: c.width };
  });
  expect(look).toMatchObject({ bg: "rgba(0, 0, 0, 0)", img: "none", border: "0px", shadow: "none" });
  expect(look.panel).toContain("linear-gradient");          // ONE readable panel for the whole column
  expect(look.uRight).toBeLessThan(40);                     // the question hugs the right edge…
  expect(look.uLeft).toBeGreaterThan(look.colW * 0.4);      // …as a bubble, not a full-width card
  await expect(a.locator(".mav")).toBeHidden();
  const row = a.locator(".macts");
  for (const name of ["Копирай", "Чуй", "Отвори в Canvas", "Отговори пак"]) await expect(row.getByRole("button", { name, exact: true })).toBeVisible();
  // ONE model label per answer, in the action row (0.1.5 review: the second, blue pill is gone).
  await expect(row.locator(".mdl")).toHaveText("Real GPT · Тест GPT А");
  await expect(a.getByTestId("model-chip")).toHaveCount(1);
  await g.check();
});

for (const [kind, size] of [["desktop", LOOK], ["phone", PHONE]]) {
  test(`activity like ChatGPT · ${kind}: one running line, then one collapsed line with the real counts; a click opens and closes`, async ({ page }) => {
    const g = guard(page);
    await page.setViewportSize(size);
    await login(page, SLOW);
    await pickRgModel(page);
    await send(page, LISTINGS);
    const a = rgAnswer(page);
    const act = a.getByTestId("agent-steps");
    await expect(act).toHaveAttribute("data-state", "running");
    await expect(a.getByTestId("activity-text")).toHaveText("Чета страница: example.test/obiava-102", { timeout: 15000 });
    await expect(a.getByTestId("activity-text")).toHaveClass(/shimmer/);
    await expect(a.getByTestId("activity-time")).toHaveText(/^(< 1 с|\d+ с)$/);
    await expect(a.getByTestId("activity-body")).toHaveCount(0);             // collapsed while it runs, too
    await expect(a.getByTestId("activity-line")).toHaveCount(1);            // ONE line, not a list
    await shot(page, `look-${kind}-running.png`);

    await finished(a);
    await expect(act).toHaveAttribute("data-state", "done");
    await expect(a.getByTestId("activity-text")).toHaveText("Претърси интернет и прочете 2 страници · 1 неуспешна");
    await expect(a.getByTestId("activity-text")).not.toHaveClass(/shimmer/);
    await expect(a.getByTestId("activity-time")).toHaveText(/^(< 1 с|\d+ с|\d+ мин( \d+ с)?)$/);
    await expect(a.getByTestId("activity-body")).toHaveCount(0);
    await toTop(a);
    await shot(page, `look-${kind}-collapsed.png`);

    const line = a.getByTestId("activity-line");
    await expect(line).toHaveAttribute("aria-expanded", "false");
    await line.click();
    await expect(line).toHaveAttribute("aria-expanded", "true");
    const body = a.getByTestId("activity-body");
    await expect(body.locator("li")).toHaveCount(4);
    await expect(body.locator('li[data-status="ok"]')).toHaveCount(3);
    await expect(body.locator('li[data-status="fail"]')).toContainText("Чета страница: example.test/obiava-103");
    await expect(body.getByTestId("steps-status")).toHaveText("Частично изпълнено");
    await toTop(a);
    await shot(page, `look-${kind}-expanded.png`);
    await line.click();
    await expect(a.getByTestId("activity-body")).toHaveCount(0);
    await expect(line).toHaveAttribute("aria-expanded", "false");

    await toTop(a.getByTestId("md-table"));
    await shot(page, `look-${kind}-listings.png`);
    if (kind === "phone") {
      await noHorizontalScroll(page);
      // The table scrolls INSIDE the answer; the page itself never does.
      const t = await a.getByTestId("md-table").evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, right: el.getBoundingClientRect().right, vw: window.innerWidth }));
      expect(t.sw).toBeGreaterThan(t.cw);
      expect(t.right).toBeLessThanOrEqual(t.vw);
      await a.getByTestId("md-table").evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      await expect(a.getByTestId("md-table").locator("th").last()).toBeInViewport();
      await toTop(a.getByTestId("md-gallery").first());
      await shot(page, `look-${kind}-photos.png`);
      await noHorizontalScroll(page);
    }
    await g.check();
  });
}

test("approval cards stay visible under the collapsed line – never folded into the activity", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(LOOK);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Намери имоти и запиши оглед");
  const a = rgAnswer(page);
  const ap = a.getByTestId("approval-card");
  await expect(ap).toBeVisible();
  await expect(a.getByTestId("activity-text")).toHaveText("Чака вашето решение: CRM: календар.ново събитие");
  await expect(a.getByTestId("activity-body")).toHaveCount(0);
  await expect(a.getByTestId("agent-steps").getByTestId("approval-card")).toHaveCount(0);
  // Opening and closing the activity never hides the card.
  await openActivity(a);
  await a.getByTestId("activity-line").click();
  await expect(ap).toBeVisible();
  await shot(page, "look-desktop-approval.png");
  await ap.getByRole("button", { name: "Разреши", exact: true }).click();
  await finished(a);
  await expect(a.getByTestId("activity-text")).toHaveText("Претърси интернет, прочете 1 страница, изпълни 2 действия в CRM и направи 1 документ");
  await expect(a.locator(".act-tag")).toHaveText("промени в CRM");
  await g.check();
});

test("Markdown like ChatGPT: GFM table with alignment and zebra rows, headings, lists; links open the EXACT address; source chips", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(LOOK);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, LISTINGS);
  const a = rgAnswer(page);
  await finished(a);
  const table = a.getByTestId("md-table");
  await expect(table.locator("th")).toHaveText(["№", "Обява", "Цена", "Населено място", "Разстояние", "Телефон", "Източник"]);
  await expect(table.locator("th").nth(0)).toHaveClass("al-right");
  await expect(table.locator("th").nth(2)).toHaveClass("al-right");
  await expect(table.locator("th").nth(6)).toHaveClass("al-center");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  const zebra = await table.locator("tbody tr").evaluateAll((rows) => rows.map((r) => getComputedStyle(r.cells[1]).backgroundColor));
  expect(zebra[0]).not.toBe(zebra[1]);
  await expect(table.locator("tbody tr").nth(1).locator("td").nth(5)).toHaveText("скрит");
  await expect(table.locator("tbody tr").nth(0).locator("td").nth(4)).toHaveText("неуточнено");
  await expect(a.locator(".md h5.mdh")).toHaveText(["Снимки", "Недостъпни"]);
  await expect(a.locator(".md ol > li")).toHaveCount(2);
  const unreachable = a.locator(".md ul > li", { hasText: "Тестова обява 103" });
  await expect(unreachable).toHaveCount(1);
  await expect(unreachable.locator("a")).toHaveCount(0);                // an unreachable listing is never a link
  await expect(a.locator(".md")).not.toContainText("https://");          // addresses are links and chips, never raw text

  // A link shows the title; one click opens the EXACT address in the browser.
  const link = table.getByRole("link", { name: "Тестов двустаен с тераса" });
  await expect(link).toHaveAttribute("href", "https://example.test/obiava-102?ref=test&id=102");
  await link.click();
  // A source chip (domain pill) – same exact address.
  const chip = table.locator("tbody tr").nth(0).locator(".src-chip");
  await expect(chip).toHaveText("example.test›");
  await expect(chip).toHaveAttribute("title", "https://example.test/obiava-101");
  await chip.click();
  // A long bare address is a chip too and never widens the answer.
  const longChip = a.locator(".md p .src-chip").last();
  await expect(longChip).toHaveAttribute("title", LONG_URL);
  expect((await longChip.boundingBox()).width).toBeLessThan(290);
  await longChip.click();
  const calls = await mockCalls(page);
  expect(calls.openExternal.slice(-3)).toEqual(["https://example.test/obiava-102?ref=test&id=102", "https://example.test/obiava-101", LONG_URL]);
  await g.check();
});

test("pictures: inline only when the address came from a tool result (loaded through MAIN); a foreign picture is a chip until clicked", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(LOOK);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, LISTINGS);
  let a = rgAnswer(page);
  await finished(a);
  await expect(a.getByTestId("md-gallery")).toHaveCount(2);
  const imgs = a.getByTestId("md-img");
  await expect(imgs).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await expect(imgs.nth(i)).toHaveAttribute("data-state", "ok");
    await expect(imgs.nth(i).locator("img")).toHaveAttribute("src", /^blob:/);
  }
  await expect.poll(() => imgs.locator("img").evaluateAll((list) => list.every((x) => x.naturalWidth > 0))).toBe(true);
  let calls = await mockCalls(page);
  expect([...calls.browseImage].sort()).toEqual([...PHOTOS].sort());     // each exactly once, all from read_page
  await imgs.first().click();
  const lb = page.getByTestId("md-lightbox");
  await expect(lb.locator("img")).toHaveAttribute("src", /^blob:/);
  await expect(lb.getByRole("button", { name: "Отвори източника" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(lb).toHaveCount(0);

  // A picture the model put in its text WITHOUT a tool result: a chip; nothing is loaded before the click.
  await send(page, "Покажи чужда снимка");
  await expect(page.locator('.msg.a[data-engine="realgpt"]')).toHaveCount(2);
  a = rgAnswer(page);
  await finished(a);
  const chip = a.getByTestId("img-chip");
  await expect(chip).toHaveText("Снимка: foreign.example.test›");
  await expect(a.getByTestId("md-img")).toHaveCount(0);
  calls = await mockCalls(page);
  expect(calls.browseImage.filter((u) => /foreign/.test(u))).toEqual([]);
  await expect(a.locator(".md .src-chip").filter({ hasText: "foreign.example.test" })).toHaveCount(2); // picture chip + source chip
  await shot(page, "look-desktop-foreign-chip.png");
  await chip.click();
  await expect(a.getByTestId("md-img")).toHaveAttribute("data-state", "ok");
  await expect(a.getByTestId("md-img").locator("img")).toHaveAttribute("src", /^blob:/);
  calls = await mockCalls(page);
  expect(calls.browseImage.filter((u) => /foreign/.test(u))).toEqual(["https://foreign.example.test/photo-1.png"]);
  await g.check();
});

test("photos fetched into the store (fetch_image) are shown inline from the store – not downloaded a second time", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(LOOK);
  await login(page, AGENT);
  await pickRgModel(page);
  await send(page, "Изтегли снимките от първия линк");
  const a = rgAnswer(page);
  await finished(a);
  const cards = a.locator('[data-testid="file-card"][data-kind="image"]');
  await expect(cards).toHaveCount(2);
  const imgs = a.getByTestId("md-img");
  await expect(imgs).toHaveCount(2);
  await expect(imgs.nth(1)).toHaveAttribute("data-state", "ok");
  const ids = await cards.evaluateAll((list) => list.map((c) => c.getAttribute("data-file")));
  const calls = await mockCalls(page);
  for (const id of ids) expect(calls.filesRead).toContain(id);
  expect(calls.browseImage).toEqual([]);
  await g.check();
});

/* ---------- full-colour icons (owner: „цветни, реални иконки като в ChatGPT“) ---------- */
const ROOT = { "Добави снимки и файлове": "clip", "Последни файлове": "recent", "Създай изображение": "image", "Мислене": "bulb", "Задълбочено проучване": "telescope", "Търсене в мрежата": "globe", "Още": "more", "Проекти": "folder" };
const MORE = { "Назад": "back", "Canvas": "palette", "Видео": "film", "Документи от CRM": "doc", "Имот от CRM": "house", "Нов проект": "folderPlus", "Умения и роли": "bot", "Свързани услуги": "plug" };
async function menuIcons(page) {
  return page.locator(".pop .it").evaluateAll((items) => items.map((it) => {
    const svg = it.querySelector(":scope > .em.ci-tile > svg.ci");
    // Distinct colours of the art (fills and strokes): a full-colour icon has at least two.
    const fills = svg ? new Set([...svg.querySelectorAll("[fill],[stroke]")].flatMap((e) => [e.getAttribute("fill"), e.getAttribute("stroke")]).filter((f) => f && f !== "none")) : new Set();
    return { title: it.querySelector(".tx").childNodes[0].textContent.trim(), ci: svg ? svg.getAttribute("data-ci") : "", colours: fills.size };
  }));
}

test("coloured icons: every „+“ menu item (all levels), sidebar row and account-menu item has its full-colour icon", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(LOOK);
  await login(page, "lat=200&rg=1&consent=all&lib=1");
  await pickRgModel(page);
  await page.locator(".c-plus").first().click();
  let items = await menuIcons(page);
  expect(Object.fromEntries(items.map((x) => [x.title, x.ci]))).toEqual(ROOT);
  for (const x of items) expect(x.colours, x.title).toBeGreaterThanOrEqual(2);
  await shot(page, "icons-desktop-plus.png");
  await page.locator(".pop").getByRole("menuitem", { name: /^Още/ }).click();
  items = await menuIcons(page);
  expect(Object.fromEntries(items.map((x) => [x.title, x.ci]))).toEqual(MORE);
  for (const x of items) expect(x.colours, x.title).toBeGreaterThanOrEqual(2);
  await shot(page, "icons-desktop-more.png");
  await page.locator(".pop").getByRole("menuitem", { name: "Назад" }).click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Последни файлове/ }).click();
  await expect(page.locator(".pop .it")).toHaveCount(4);
  items = await menuIcons(page);
  expect(items[0].ci).toBe("back");
  expect(items.slice(1).map((x) => x.ci).sort()).toEqual(["doc", "doc", "image"]); // the 3 library test files, newest first
  await page.locator(".pop").getByRole("menuitem", { name: "Назад" }).click();
  await page.locator(".pop").getByRole("menuitem", { name: /^Проекти/ }).click();
  items = await menuIcons(page);
  expect(items.map((x) => x.ci)).toEqual(["back", "chat", ...items.slice(2, -1).map(() => "folder"), "folderPlus"]);
  expect(items.length).toBeGreaterThan(3);
  await page.keyboard.press("Escape");

  // Sidebar: same labels and order as 0.1.3, only the art is in colour.
  const side = page.locator("aside.side");
  const rows = { "side-new": ["Нов чат", "newchat"], "side-search": ["Търсене в чатовете", "search"], "side-projects": ["Проекти", "folder"], "side-scheduled": ["Планирани", "clock"],
    "side-library": ["Библиотека", "library"], "side-plugins": ["Плъгини", "plug"], "side-agents": ["Агенти", "bot"] };
  for (const [tid, [label, ci]] of Object.entries(rows)) {
    const b = side.getByTestId(tid);
    await expect(b.locator("span").first()).toHaveText(label);
    await expect(b.locator("svg.ci")).toHaveAttribute("data-ci", ci);
  }
  await expect(side.getByTestId("side-search-ic").locator("svg.ci")).toHaveAttribute("data-ci", "search");
  const cases = side.getByTestId("case-list");
  const caseIcons = await cases.locator(".row .t svg.ci").evaluateAll((l) => l.map((s) => s.getAttribute("data-ci")));
  expect(caseIcons.at(-1)).toBe("folderPlus");
  expect(caseIcons.slice(0, -1).every((c) => c === "folder")).toBe(true);
  expect(caseIcons.length).toBeGreaterThan(1);
  await page.getByTestId("me-btn").click();
  items = await menuIcons(page);
  expect(items.map((x) => x.ci)).toEqual(["gear", "help", "monitor", "bubble", "logout"]); // 0.1.6: + „Балонче“
  await page.keyboard.press("Escape");
  await g.check();
});

test("coloured icons on the phone: drawer rows, „Персонализиране“, the „Чат“ pill and the „+“ sheet", async ({ page }) => {
  const g = guard(page);
  await page.setViewportSize(PHONE);
  await login(page, "lat=200&rg=1&consent=all");
  await page.locator(".top.ph").getByRole("button", { name: "Меню" }).click();
  const d = page.locator(".side.open");
  const want = { "side-scheduled": "clock", "side-projects": "folder", "side-library": "library", "side-plugins": "plug", "side-agents": "bot", "side-personal": "sliders", "drawer-new": "newchat", "side-search": "search" };
  for (const [tid, ci] of Object.entries(want)) await expect(d.getByTestId(tid).locator("svg.ci")).toHaveAttribute("data-ci", ci);
  await shot(page, "icons-phone-drawer.png");
  await d.getByTestId("drawer-new").click();
  await expect(page.locator(".side.open")).toHaveCount(0);
  await page.locator(".c-plus").first().click();
  const items = await menuIcons(page);
  expect(items.map((x) => x.ci)).toEqual(Object.values(ROOT));
  await shot(page, "icons-phone-plus.png");
  await noHorizontalScroll(page);
  await g.check();
});
