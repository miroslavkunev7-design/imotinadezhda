// Cross-area seams of docs/CONTRACT.md: the window.ted surface must be the same in the contract,
// the smoke test, the mock bridge and every call the renderer makes; the CSP must be the same in
// protocol.js and index.html; the packaging config must match the file layout.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TED_SURFACE, parseSmokeArgs } from "../../electron/smoke.js";
import { CSP, META_CSP } from "../../electron/protocol.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const sortedSurface = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, [...o[k]].sort()]));

describe("window.ted surface", () => {
  it("CONTRACT.md §2 lists exactly the surface the smoke test checks", () => {
    const block = read("docs/CONTRACT.md").split("## 2.")[1].split("## 3.")[0];
    const found = {};
    for (const m of block.matchAll(/^ted\.(\w+)\.(\w+)\(/gm)) (found[m[1]] = found[m[1]] || []).push(m[2]);
    expect(sortedSurface(found)).toEqual(sortedSurface(TED_SURFACE));
  });

  it("every window.ted call in the renderer exists in the contract", () => {
    const files = fs.readdirSync(path.join(root, "src"), { recursive: true })
      .map(String).filter((f) => /\.(js|jsx)$/.test(f) && !f.startsWith("mock"));
    const used = new Set();
    for (const f of files) for (const m of read(path.join("src", f)).matchAll(/\bted\.(\w+)\.(\w+)\(/g)) used.add(`${m[1]}.${m[2]}`);
    expect(used.size).toBeGreaterThan(30);
    const known = new Set(Object.entries(TED_SURFACE).flatMap(([g, fns]) => fns.map((fn) => `${g}.${fn}`)));
    expect([...used].filter((u) => !known.has(u))).toEqual([]);
  });

  describe("mock bridge", () => {
    let saved;
    beforeAll(() => { saved = globalThis.window; globalThis.window = {}; });
    afterAll(() => { if (saved === undefined) delete globalThis.window; else globalThis.window = saved; });

    it("implements exactly the contract surface, all functions", async () => {
      const { createMockBridge } = await import("../../src/mock/bridge.mock.js");
      const bridge = createMockBridge();
      const shape = Object.fromEntries(Object.entries(bridge).map(([k, v]) => [k, Object.keys(v)]));
      expect(sortedSurface(shape)).toEqual(sortedSurface(TED_SURFACE));
      for (const group of Object.values(bridge)) for (const fn of Object.values(group)) expect(typeof fn).toBe("function");
    });
  });
});

describe("CSP", () => {
  it("index.html carries META_CSP: the header policy without frame-ancestors", () => {
    const meta = read("index.html").match(/http-equiv="Content-Security-Policy" content="([^"]*)"/);
    expect(meta && meta[1]).toBe(META_CSP);
    expect(META_CSP).toBe(CSP.replace("; frame-ancestors 'none'", ""));
    expect(CSP).toContain("frame-ancestors 'none'");
  });
});

describe("smoke arguments", () => {
  it("is off unless --smoke-test is given; paths are resolved", () => {
    expect(parseSmokeArgs(["electron", "."])).toBeNull();
    const s = parseSmokeArgs(["x", "--smoke-test", "--smoke-report=out/r.json"]);
    expect(s.report).toBe(path.resolve("out/r.json"));
    expect(s.shot).toBeNull();
    expect(parseSmokeArgs(["x", "--smoke-test", '--smoke-shot="a b.png"']).shot).toBe(path.resolve("a b.png"));
  });
});

describe("packaging layout", () => {
  const pkg = JSON.parse(read("package.json"));
  const builder = read("electron-builder.yml");
  const workflow = read("../../.github/workflows/ted-desktop.yml");

  it("package.json main, preload and dist are where electron-builder packs them", () => {
    expect(pkg.main).toBe("electron/main.js");
    expect(fs.existsSync(path.join(root, pkg.main))).toBe(true);
    expect(read("electron/main.js")).toMatch(/path\.join\(here, "preload\.cjs"\)/);
    expect(read("electron/main.js")).toMatch(/path\.join\(app\.getAppPath\(\), "dist"\)/);
    for (const entry of ["- dist/**", "- electron/**", "- package.json"]) expect(builder).toContain(entry);
    expect(Object.keys(pkg.dependencies)).toEqual(["jose"]); // packed by electron-builder from node_modules
  });

  it("the workflow uses existing npm scripts and the packaged exe name", () => {
    for (const m of workflow.matchAll(/npm run ([\w:-]+)/g)) expect(pkg.scripts, m[1]).toHaveProperty(m[1]);
    const exe = builder.match(/executableName:\s*(\S+)/)[1];
    expect(workflow).toContain(`win-unpacked\\${exe}.exe`);
    expect(workflow).toContain("--smoke-test");
    expect(workflow).toContain("--smoke-report=");
  });
});
