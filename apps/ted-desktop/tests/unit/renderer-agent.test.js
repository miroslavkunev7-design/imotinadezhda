// Renderer side of the Real GPT agent (docs/CONTRACT.md §8.3, §16): the pure reducer of AgentEvents, the
// persisted snapshot, the messages of ted.realgpt.send, the step summary, the video estimate and the SVG
// sanitiser of Canvas „Преглед“. No DOM, no network.
import { describe, it, expect } from "vitest";
import { AGENT_INIT, agentReduce, agentSnapshot, fmtUsd, rgMessages, stepTime, stepsSummary, videoEstimate } from "../../src/lib/agent.js";
import { safeSvg, splitSvg, svgDataUrl } from "../../src/lib/svg.js";

const R = "r_test1";
const ev = (e) => ({ requestId: R, ...e });
const run = (events, state = AGENT_INIT) => events.reduce(agentReduce, state);
const step = (id, status, extra = {}) => ev({ type: "step", step: { id, kind: "crm", label: "CRM: тест " + id, status, startedAt: "2026-11-17T10:00:00.000Z", ...extra } });

describe("agentReduce", () => {
  it("keeps steps in first-seen order and updates them by id with the newest status", () => {
    const s = run([step("s1", "run"), step("s2", "run"), step("s1", "ok", { detail: "2 имота", endedAt: "2026-11-17T10:00:02.000Z" })]);
    expect(s[R].steps.map((x) => [x.id, x.status])).toEqual([["s1", "ok"], ["s2", "run"]]);
    expect(s[R].steps[0]).toMatchObject({ detail: "2 имота", label: "CRM: тест s1", kind: "crm" });
  });

  it("ignores malformed events and events without a requestId (state object unchanged)", () => {
    const s0 = run([step("s1", "ok")]);
    for (const bad of [null, "x", {}, { type: "step" }, { requestId: R }, { requestId: R, type: "step", step: null }, { requestId: R, type: "file", file: { name: "x" } },
      { requestId: R, type: "nope" }, { requestId: "", type: "limit" }, { requestId: R, type: "approval", approval: {} }]) {
      expect(agentReduce(s0, bad)).toBe(s0);
    }
    expect(agentReduce(s0, step("s1", "weird"))[R].steps[0].status).toBe("ok"); // an unknown status never replaces a real one
  });

  it("collects files (no duplicates), approvals, the limit, the e-mail draft and the video job per request", () => {
    const file = { id: "f_test0001", name: "Тест.docx", kind: "docx", size: 10 };
    const s = run([
      ev({ type: "file", file, stepId: "s4" }),
      ev({ type: "file", file: { ...file, size: 11 }, stepId: "s4" }),
      ev({ type: "approval", approval: { id: "ap_1", kind: "crm_write", title: "Тест" } }),
      ev({ type: "limit", rounds: 8, calls: 40 }),
      ev({ type: "email", email: { subject: "Тест" } }),
      ev({ type: "video", job: { id: "v_test1", status: "approval", parts: [] } }),
      ev({ type: "canvas", canvas: { text: "x", label: "чернова" } }),
      { requestId: "r_other", type: "limit", rounds: 1, calls: 1 },
    ]);
    expect(s[R].files).toEqual([{ ...file, size: 11, stepId: "s4" }]);
    expect(s[R].approvals.map((a) => a.id)).toEqual(["ap_1"]);
    expect(s[R].limited).toEqual({ rounds: 8, calls: 40 });
    expect(s[R].email).toEqual({ subject: "Тест" });
    expect(s[R].video).toEqual({ jobId: "v_test1", status: "approval" });
    expect(s[R].canvas).toBe(1);
    expect(s.r_other.limited).toEqual({ rounds: 1, calls: 1 });
    const d = agentReduce(s, { requestId: R, type: "decided", approvalId: "ap_1" });
    expect(d[R].approvals).toEqual([]);
    expect(agentReduce(d, { requestId: R, type: "decided", approvalId: "ap_1" })).toBe(d);
  });
});

describe("agentSnapshot", () => {
  it("is what the finished message keeps: steps, files without stepId, limit, video, e-mail – never pending approvals", () => {
    const s = run([step("s1", "ok"), ev({ type: "file", file: { id: "f_test0001", name: "a.pdf" }, stepId: "s1" }), ev({ type: "approval", approval: { id: "ap_1" } }), ev({ type: "limit", rounds: 2, calls: 3 })]);
    const snap = agentSnapshot(s, R);
    expect(snap).toEqual({ steps: [expect.objectContaining({ id: "s1", status: "ok" })], files: [{ id: "f_test0001", name: "a.pdf" }], limited: { rounds: 2, calls: 3 } });
    expect(snap).not.toHaveProperty("approvals");
    expect(agentSnapshot(AGENT_INIT, "missing")).toEqual({ steps: [], files: [] });
    snap.steps[0].status = "fail"; // a copy: the live state is not changed through the snapshot
    expect(s[R].steps[0].status).toBe("ok");
  });

  it("keeps the „Отвори в ChatGPT“ cards (id, kind, prompt only; unknown kind = other; ≤ 10) and persists them", () => {
    const s = run([
      ev({ type: "chatgpt", handoff: { id: "cg_1", kind: "image", prompt: "Снимка на къща", url: "https://evil.example", extra: 1 } }),
      ev({ type: "chatgpt", handoff: { id: "cg_2", kind: "weird", prompt: "x".repeat(5000) } }),
      ev({ type: "chatgpt", handoff: { id: "cg_3", kind: "video", prompt: "   " } }),
      ev({ type: "chatgpt", handoff: { kind: "video", prompt: "без id" } }),
      ...Array.from({ length: 12 }, (_, i) => ev({ type: "chatgpt", handoff: { id: "cg_x" + i, kind: "video", prompt: "видео " + i } })),
    ]);
    expect(s[R].chatgpt).toHaveLength(10);
    expect(s[R].chatgpt[0]).toEqual({ id: "cg_1", kind: "image", prompt: "Снимка на къща" });
    expect(s[R].chatgpt[1]).toEqual({ id: "cg_2", kind: "other", prompt: "x".repeat(4000) });
    expect(agentSnapshot(s, R).chatgpt).toEqual(s[R].chatgpt);
    expect(agentSnapshot(run([step("s1", "ok")]), R)).not.toHaveProperty("chatgpt");
  });
});

describe("rgMessages", () => {
  const T = 1_800_000_000_000;
  it("earlier Real GPT exchanges + the current question with images and store file ids (≤ 10, valid ids only)", () => {
    const prior = [
      { id: "u1", role: "user", text: "Първи", time: T, files: [{ id: "c1", name: "a.docx", fileId: "f_test0001" }] },
      { id: "a1", role: "assistant", engine: "realgpt", text: "Отговор", time: T },
      { id: "u2", role: "user", text: "На сървъра", time: T },
      { id: "a2", role: "assistant", engine: "server", text: "CRM данни", time: T },
    ];
    const ids = Array.from({ length: 12 }, (_, i) => "f_test" + String(i).padStart(4, "0"));
    const out = rgMessages(prior, { text: "игнорира се" }, { text: "Сега", images: [{ mime: "image/jpeg", data: "AAA" }, { mime: "" }], fileIds: [...ids, "../bad", 7] });
    expect(out[0]).toEqual({ role: "user", text: "Първи", files: ["f_test0001"] });
    expect(out[1]).toEqual({ role: "assistant", text: "Отговор" });
    expect(out.some((m) => m.text === "CRM данни")).toBe(false); // a server answer never goes to OpenAI
    const cur = out[out.length - 1];
    expect(cur).toMatchObject({ role: "user", text: "Сега", images: [{ mime: "image/jpeg", data: "AAA" }] });
    expect(cur.files).toEqual(ids.slice(0, 10));
    expect(rgMessages([], { text: "Само текст" }, null)).toEqual([{ role: "user", text: "Само текст" }]);
  });
});

describe("step summary and times", () => {
  const s = (status, mutating) => ({ id: status + String(mutating), label: "x", status, ...(mutating ? { mutating: true } : {}) });
  it("comes only from the real statuses", () => {
    expect(stepsSummary([s("ok"), s("ok", true)], false)).toEqual({ status: "succeeded", label: "Изпълнено", changed: true });
    expect(stepsSummary([s("ok"), s("wait", true)], true)).toMatchObject({ status: "waiting_for_input", label: "Чака вашето решение" });
    expect(stepsSummary([s("ok"), s("run")], true)).toMatchObject({ status: "running", label: "Изпълнява се" });
    expect(stepsSummary([s("ok"), s("run")], false)).toMatchObject({ status: "cancelled", label: "Прекъснато" }); // never shown as done
    expect(stepsSummary([s("ok"), s("denied", true)], false)).toEqual({ status: "partially_succeeded", label: "Частично изпълнено", changed: false });
    expect(stepsSummary([s("denied")], false).label).toBe("Отказано");
    expect(stepsSummary([s("fail"), s("denied")], false).label).toBe("Неуспешно");
    expect(stepTime({ startedAt: "2026-11-17T10:00:00Z", endedAt: "2026-11-17T10:00:03.4Z" })).toBe("3 с");
    expect(stepTime({ startedAt: "2026-11-17T10:00:00Z", endedAt: "2026-11-17T10:01:05Z" })).toBe("1 мин 5 с");
    expect(stepTime({ startedAt: "2026-11-17T10:00:00Z" })).toBe("");
  });
});

describe("video estimate (the site's formula: parts × length × price, minutes ≈ max(2, ceil(parts/3) × 2))", () => {
  it("matches crm-video.js", () => {
    expect(videoEstimate(3, { price: 0.17 }, 5)).toEqual({ n: 3, sec: 15, cost: 2.55, min: 2 });
    expect(videoEstimate(7, { price: 0.1 }, 8)).toEqual({ n: 7, sec: 56, cost: 5.6, min: 6 });
    expect(fmtUsd(2.55)).toBe("$2,55");
  });
});

describe("safeSvg (Canvas „Преглед“)", () => {
  it("keeps drawing elements and drops script, handlers, styles, foreignObject, images, links and animation", () => {
    const out = safeSvg('<p>текст</p><svg viewBox="0 0 10 10" onload="x()"><script>alert(1)</script><style>rect{fill:url(http://e)}</style>' +
      '<rect width="5" height="5" onclick="x()" fill="url(#g)" style="fill:red"/><foreignObject><div>html</div></foreignObject>' +
      '<image href="https://example.test/i.png"/><a href="javascript:alert(1)"><circle r="1"/></a><set attributeName="fill" to="red"/>' +
      '<text x="1" y="2">Тест &amp; &lt;б&gt;</text></svg><script>after()</script>');
    expect(out).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="5" fill="url(#g)"/><text x="1" y="2">Тест &amp; &lt;б&gt;</text></svg>');
  });

  it("refuses external or data: references and javascript: values; <use> only to #ids", () => {
    const out = safeSvg('<svg><rect width="1" height="1" fill="url(https://e/x)"/><rect width="2" height="2" filter="url(data:x)"/>' +
      '<use href="https://e/s.svg#a"/><use xlink:href="#a"/><path d="M0 0" stroke="java&#115;cript:x"/><line x1="0" x2="1" stroke="&#106;avascript:1"/></svg>');
    expect(out).toBe('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/><rect width="2" height="2"/><use href="#a"/><path d="M0 0"/><line x1="0" x2="1"/></svg>');
  });

  it("keeps camelCase SVG names, drops comments/CDATA, returns null without anything to draw", () => {
    expect(safeSvg('<SVG><!-- <script>x</script> --><LinearGradient id="g"><stop offset="0" stop-color="#850F2D"/></LinearGradient><rect width="1" height="1" fill="url(#g)"/></SVG>'))
      .toBe('<svg xmlns="http://www.w3.org/2000/svg"><linearGradient id="g"><stop offset="0" stop-color="#850F2D"/></linearGradient><rect width="1" height="1" fill="url(#g)"/></svg>');
    expect(safeSvg("без графика")).toBeNull();
    expect(safeSvg("<svg><script>x</script></svg>")).toBeNull();
    expect(safeSvg("<svg><defs><linearGradient id='g'/></defs></svg>")).toBeNull();
  });

  it("splits Canvas text into Markdown and SVG parts and makes a UTF-8 data URL", () => {
    expect(splitSvg("# Заглавие\n```svg\n<svg><rect/></svg>\n```\nи <svg><circle/></svg>")).toEqual([
      { type: "md", text: "# Заглавие\n" }, { type: "svg", text: "<svg><rect/></svg>\n" }, { type: "md", text: "\nи " }, { type: "svg", text: "<svg><circle/></svg>" },
    ]);
    const url = svgDataUrl("<svg>Тест</svg>");
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(Buffer.from(url.split(",")[1], "base64").toString("utf8")).toBe("<svg>Тест</svg>");
  });
});
