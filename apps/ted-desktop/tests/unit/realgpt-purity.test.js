// docs/CONTRACT.md §9.6: when the engine is Real GPT, every bit of intelligence comes from the employee's ChatGPT plan.
// Static seams that keep it so: the agent is wired without Ted's server chat engine, without the server search
// fallback and without AI video; nothing it imports talks to another AI endpoint.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const list = (dir) => fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".js")).map((f) => `${dir}/${f}`);

// Endpoints and hosts of other AIs (Ted's server chat, AI video, Gemini, Vercel AI Gateway, other model vendors).
const OTHER_AI = /\/api\/assistant|\/api\/video|\/api\/scan|\/api\/collect|generativelanguage|ai-gateway|vercel\.sh|anthropic\.com|openrouter|withServerFallback/;

describe("Real GPT uses only the ChatGPT plan", () => {
  it("main.js gives the agent the guarded CRM transport and the local search only – no assistant, no video", () => {
    const main = read("electron/main.js");
    const block = main.slice(main.indexOf("const agent = createAgent({"), main.indexOf("});", main.indexOf("const agent = createAgent({")) + 3);
    expect(block).toContain("tools: guardTools(tools)");
    expect(block).toContain("search: (args, opts) => webSearch(browser, args, opts)");
    expect(block).not.toMatch(/assistant|video|Fallback/);
    expect(main).not.toMatch(/browse\/fallback/);
    expect(fs.existsSync(path.join(root, "electron/browse/fallback.js"))).toBe(false);
  });

  it("the agent, browse and Real GPT modules never reach another AI endpoint or Ted's chat/video engines", () => {
    for (const f of [...list("electron/agent"), ...list("electron/browse"), ...list("electron/realgpt"), ...list("electron/docs")]) {
      const src = read(f);
      expect(src, f).not.toMatch(OTHER_AI);
      expect(src, f).not.toMatch(/from "\.\.\/backend\/assistant\.js"|from "\.\.\/video\//);
    }
  });

  it("the agent offers no server-AI function and its texts never claim Ted/Gemini made something", () => {
    const spec = read("electron/agent/tools-spec.js");
    const loop = read("electron/agent/loop.js");
    expect(spec).not.toMatch(/"video_walk"|"listings_find"/);
    expect(loop).not.toMatch(/"video_walk"|"listings_find"|Генерирам снимка|Превеждам документ/);
    expect(read("electron/agent/instructions.js")).not.toMatch(/сървъра на Тед: първо безплатният Gemini|GPT Image 2/);
  });
});
