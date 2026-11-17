// 0.1.5 renderer: Markdown like ChatGPT (src/lib/md.js – a plain tree, never HTML), the ChatGPT activity summary and
// the provenance of pictures (src/lib/agent.js). No DOM, no network.
import { describe, it, expect } from "vitest";
import { bareUrl, domainOf, imagesOf, parseBlocks, parseInline, safeHref, splitRow } from "../../src/lib/md.js";
import { AGENT_INIT, activitySummary, agentReduce, agentSnapshot, answerMedia, cleanImageUrls, currentStep, fmtDur } from "../../src/lib/agent.js";

const T = (v) => ({ t: "text", v });

describe("inline Markdown", () => {
  it("bold, italic, bold-italic, strike, code, escapes; snake_case and lone stars stay text", () => {
    expect(parseInline("**а** *б* ***в*** ~~г~~ `д*е*`")).toEqual([
      { t: "b", c: [T("а")] }, T(" "), { t: "i", c: [T("б")] }, T(" "), { t: "b", c: [{ t: "i", c: [T("в")] }] }, T(" "),
      { t: "s", c: [T("г")] }, T(" "), { t: "code", v: "д*е*" },
    ]);
    expect(parseInline("file_name_x и 2 * 3 * 4 и \\*звезда\\*")).toEqual([T("file_name_x и 2 * 3 * 4 и *звезда*")]);
    expect(parseInline("__силно__ и _наклонено_")).toEqual([{ t: "b", c: [T("силно")] }, T(" и "), { t: "i", c: [T("наклонено")] }]);
  });

  it("a link shows its text and keeps the EXACT address; only https and mailto are links", () => {
    expect(parseInline("[Двустаен, Център](https://www.olx.bg/d/ad/dvustaen-CID368-ID9XNHd.html?x=1&y=(2))")).toEqual([
      { t: "a", href: "https://www.olx.bg/d/ad/dvustaen-CID368-ID9XNHd.html?x=1&y=(2)", title: "https://www.olx.bg/d/ad/dvustaen-CID368-ID9XNHd.html?x=1&y=(2)", dom: "olx.bg", c: [T("Двустаен, Център")] },
    ]);
    // The hover title is always the real address (a model-supplied title cannot disguise it – review F1).
    expect(parseInline('[тук](https://a.example.com/p "Заглавие")')[0]).toMatchObject({ t: "a", href: "https://a.example.com/p", title: "https://a.example.com/p", dom: "a.example.com" });
    expect(parseInline("[поща](mailto:office@example.com)")[0]).toMatchObject({ t: "a", href: "mailto:office@example.com" });
    expect(parseInline("[стар сайт](http://old.example.com/x)")[0]).toMatchObject({ t: "nolink", href: "http://old.example.com/x" });
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///C:/x", "vbscript:x"]) expect(parseInline(`[x](${bad})`)).toEqual([T("x")]);
    expect(parseInline("<b>не е HTML</b>")).toEqual([T("<b>не е HTML</b>")]);
  });

  it("source chips: a link whose text is its domain, an autolink and a bare https address (punctuation trimmed)", () => {
    expect(parseInline("[olx.bg](https://www.olx.bg/d/ad/x)")).toEqual([{ t: "chip", href: "https://www.olx.bg/d/ad/x", label: "olx.bg" }]);
    expect(parseInline("<https://imot.bg/a>")).toEqual([{ t: "chip", href: "https://imot.bg/a", label: "imot.bg" }]);
    expect(parseInline("Виж https://www.alo.bg/obiava-1.")).toEqual([T("Виж "), { t: "chip", href: "https://www.alo.bg/obiava-1", label: "alo.bg" }, T(".")]);
    expect(parseInline("(https://bg.wikipedia.org/wiki/Шумен_(град))")).toEqual([T("("), { t: "chip", href: "https://bg.wikipedia.org/wiki/Шумен_(град)", label: "bg.wikipedia.org" }, T(")")]);
    expect(parseInline("http://plain.example.com/x")).toEqual([T("http://plain.example.com/x")]);
    expect(bareUrl("https://x.example.com/a?b=1,")).toBe("https://x.example.com/a?b=1");
  });

  it("images: https and file:<id> only; anything else becomes text", () => {
    expect(parseInline("![Хол](https://img.example.com/1.jpg)")).toEqual([{ t: "img", src: "https://img.example.com/1.jpg", alt: "Хол" }]);
    expect(parseInline("![снимка](file:file000001)")).toEqual([{ t: "img", src: "file:file000001", alt: "снимка" }]);
    expect(parseInline("![x](http://img.example.com/1.jpg)")).toEqual([T("[снимка: x]")]);
    expect(parseInline("![x](data:image/png;base64,AAAA)")).toEqual([T("[снимка: x]")]);
  });
});

describe("blocks", () => {
  it("headings h1–h4, rules, quotes with Markdown inside, fenced code (also unclosed while streaming)", () => {
    const t = parseBlocks("# Едно\n## Две\n### Три\n#### Четири\n##### Пет\n\n---\n\n> **цитат**\n> ред 2\n\n```js\nconst a = 1;\n```\n\n~~~\nне е затворен");
    expect(t.map((n) => (n.t === "h" ? "h" + n.level : n.t))).toEqual(["h1", "h2", "h3", "h4", "h4", "hr", "quote", "code", "code"]);
    expect(t[6].c[0]).toEqual({ t: "p", c: [{ t: "b", c: [T("цитат")] }, { t: "br" }, T("ред 2")] });
    expect(t[7]).toEqual({ t: "code", lang: "js", code: "const a = 1;" });
    expect(t[8]).toEqual({ t: "code", lang: "", code: "не е затворен" });
  });

  it("numbered lists keep their start, nest by indentation and carry continuation lines", () => {
    const t = parseBlocks("3. Първа\n   **Цена:** 99 000 €\n   - под 1\n   - под 2\n4. Втора\n\nТекст след списъка");
    expect(t[0]).toMatchObject({ t: "list", ordered: true, start: 3, loose: false });
    expect(t[0].items).toHaveLength(2);
    const first = t[0].items[0].c;
    expect(first[0]).toEqual({ t: "p", c: [T("Първа"), { t: "br" }, { t: "b", c: [T("Цена:")] }, T(" 99 000 €")] });
    expect(first[1]).toMatchObject({ t: "list", ordered: false });
    expect(first[1].items.map((i) => i.c[0].c[0].v)).toEqual(["под 1", "под 2"]);
    expect(t[1]).toEqual({ t: "p", c: [T("Текст след списъка")] });
    const tasks = parseBlocks("- [x] готово\n- [ ] чака");
    expect(tasks[0].items.map((i) => i.task)).toEqual([true, false]);
    // A year at the start of a sentence inside a paragraph does not start a list.
    expect(parseBlocks("През\n2024. година")[0].t).toBe("p");
  });

  it("GFM table: header, alignment, inline Markdown in cells, escaped pipes, rows padded to the header", () => {
    const t = parseBlocks("| № | Обява | Цена |\n|---:|:---|:---:|\n| 1 | [Къща](https://a.example.com/1) | 35 000 € |\n| 2 | a \\| b |\n\nСлед");
    expect(t[0].t).toBe("table");
    expect(t[0].align).toEqual(["right", "left", "center"]);
    expect(t[0].head.map((c) => c[0].v)).toEqual(["№", "Обява", "Цена"]);
    expect(t[0].rows[0][1]).toEqual([{ t: "a", href: "https://a.example.com/1", title: "https://a.example.com/1", dom: "a.example.com", c: [T("Къща")] }]);
    expect(t[0].rows[1]).toEqual([[T("2")], [T("a | b")], []]);
    expect(t[1]).toEqual({ t: "p", c: [T("След")] });
    expect(splitRow("| `a|b` | c |")).toEqual(["`a|b`", "c"]);
    // A paragraph followed by --- is a rule, not a one-column table.
    expect(parseBlocks("Текст\n---").map((n) => n.t)).toEqual(["p", "hr"]);
  });

  it("a paragraph of images only is a gallery; imagesOf finds every picture", () => {
    const t = parseBlocks("**1. Обява**\n\n![a](https://i.example.com/1.jpg) ![b](https://i.example.com/2.jpg)\n\n| x |\n|---|\n| ![c](https://i.example.com/3.jpg) |");
    expect(t[1]).toEqual({ t: "gallery", c: [{ t: "img", src: "https://i.example.com/1.jpg", alt: "a" }, { t: "img", src: "https://i.example.com/2.jpg", alt: "b" }] });
    expect(imagesOf(t)).toEqual(["https://i.example.com/1.jpg", "https://i.example.com/2.jpg", "https://i.example.com/3.jpg"]);
  });

  it("never throws on hostile or huge input", () => {
    for (const x of [null, undefined, "", "[".repeat(5000), "*".repeat(5000), "|".repeat(3000) + "\n|---|", "> ".repeat(500) + "x", "- ".repeat(800) + "x", "`".repeat(999)]) {
      expect(() => parseBlocks(x)).not.toThrow();
    }
    expect(safeHref("https://a.example.com/ x")).toBe(false);
    expect(domainOf("https://www.imot.bg/a")).toBe("imot.bg");
    expect(domainOf("mailto:a@b.bg?subject=x")).toBe("a@b.bg");
  });
});

describe("activity line (ChatGPT): counts from the real steps", () => {
  const st = (id, kind, status, s, e) => ({ id, kind, label: kind + " " + id, status, startedAt: `2026-11-17T10:00:${s}.000Z`, ...(e ? { endedAt: `2026-11-17T10:${e}.000Z` } : {}) });
  it("„Претърси интернет 6 пъти и прочете 4 страници · 1 неуспешна · 1 мин 26 с“", () => {
    const steps = [
      ...Array.from({ length: 6 }, (_, i) => st("w" + i, "web_search", "ok", "0" + i, "00:1" + i)),
      ...Array.from({ length: 4 }, (_, i) => st("p" + i, "read_page", "ok", "2" + i, "00:3" + i)),
      st("pf", "read_page", "fail", "40", "01:26"),
    ];
    const a = activitySummary(steps, false);
    expect(a.text).toBe("Претърси интернет 6 пъти и прочете 4 страници · 1 неуспешна");
    expect(fmtDur(a.ms)).toBe("1 мин 26 с");
    expect(a).toMatchObject({ done: 10, failed: 1, denied: 0, cut: 0, changed: false });
  });

  it("CRM, documents, refusals, cut-off steps and „promени в CRM“", () => {
    const steps = [st("a", "web_search", "ok", "00", "00:01"), st("b", "crm", "ok", "01", "00:02"), { ...st("c", "crm", "denied", "02", "00:03") },
      { ...st("d", "crm", "ok", "03", "00:04"), mutating: true }, st("e", "doc", "ok", "04", "00:05"), st("f", "read_page", "run", "05")];
    const a = activitySummary(steps, false);
    expect(a.text).toBe("Претърси интернет, изпълни 2 действия в CRM и направи 1 документ · 1 отказана · 1 прекъсната");
    expect(a.changed).toBe(true);
    expect(activitySummary(steps, true).text).toBe("Претърси интернет, изпълни 2 действия в CRM и направи 1 документ · 1 отказана");
    expect(activitySummary([st("x", "read_page", "fail", "00", "00:01")], false).text).toBe("Нищо не е изпълнено · 1 неуспешна");
    expect(fmtDur(400)).toBe("< 1 с");
    expect(fmtDur(61000)).toBe("1 мин 1 с");
    expect(fmtDur(120000)).toBe("2 мин");
  });

  it("the running line shows the newest step that waits for the employee, else the newest running one", () => {
    expect(currentStep([st("a", "web_search", "ok", "00"), st("b", "read_page", "run", "01"), st("c", "crm", "wait", "02")]).id).toBe("c");
    expect(currentStep([st("a", "web_search", "run", "00"), st("b", "read_page", "run", "01")]).id).toBe("b");
    expect(currentStep([st("a", "web_search", "ok", "00")])).toBeNull();
  });
});

describe("pictures: provenance from tool results only", () => {
  it("the `images` event keeps https addresses only, deduplicated, and the snapshot persists them", () => {
    let s = agentReduce(AGENT_INIT, { requestId: "r1", type: "images", urls: ["https://i.example.com/1.jpg", "http://i.example.com/2.jpg", "javascript:x", "https://i.example.com/1.jpg", 5] });
    s = agentReduce(s, { requestId: "r1", type: "images", urls: ["https://i.example.com/3.jpg"] });
    expect(s.r1.images).toEqual(["https://i.example.com/1.jpg", "https://i.example.com/3.jpg"]);
    expect(agentReduce(s, { requestId: "r1", type: "images", urls: ["https://i.example.com/1.jpg"] })).toBe(s);
    expect(agentSnapshot(s, "r1").images).toEqual(["https://i.example.com/1.jpg", "https://i.example.com/3.jpg"]);
    expect(cleanImageUrls(["https://a.example.com/" + "x".repeat(2100)])).toEqual([]);
  });

  it("answerMedia: tool-result addresses + fetched pictures (by their source) + own image files; nothing else", () => {
    const m = answerMedia({
      images: ["https://i.example.com/1.jpg"],
      files: [{ id: "file000001", kind: "image", sourceUrl: "https://i.example.com/2.jpg" }, { id: "file000002", kind: "pdf", sourceUrl: "https://i.example.com/x.pdf" }],
    });
    expect([...m.allowed].sort()).toEqual(["https://i.example.com/1.jpg", "https://i.example.com/2.jpg"]);
    expect(m.bySource.get("https://i.example.com/2.jpg")).toBe("file000001");
    expect([...m.ids]).toEqual(["file000001"]);
    expect(answerMedia(null).allowed.size).toBe(0);
  });
});
