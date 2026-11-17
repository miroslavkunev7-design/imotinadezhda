// AI video flow (docs/CONTRACT.md §12) against a fake /api/video, fake storage and fake files: engines,
// estimate, approval, 3 parts at a time, polling, retries, FATAL stop, no-engine message, free-text refusal.
import { describe, it, expect } from "vitest";
import { createVideo, durFor, estimate, walkParts, NO_ENGINE, FEW_PHOTOS } from "../../electron/video/flow.js";
import { move, WALK_BASE, FATAL } from "../../electron/video/prompts.js";

const SITE_VIDEO = "https://imotinadezhda.bg/api/video";

function setup({ engines = [{ id: "kling", name: "Kling 3.0", note: "", price: 0.17, frames: 2, durs: [3, 5, 10] }, { id: "sora", name: "Sora 2", price: 0.1, frames: 1, durs: [4, 8, 12] }], pics = ["p/1.jpg", "p/2.jpg", "p/3.jpg", "p/4.jpg"], statusPlan, startFail } = {}) {
  const calls = [];
  const events = [];
  const added = [];
  let started = 0;
  let inflight = 0;
  let maxInflight = 0;
  const session = {
    authed: async (opts) => {
      calls.push(opts);
      if (opts.url === SITE_VIDEO) {
        const b = opts.json;
        if (b.action === "engines") return { status: 200, ok: true, json: { ok: true, engines, gateway: { ok: true, balance: 12.5 } } };
        if (b.action === "route") return { status: 200, ok: true, json: { ok: true, order: [{ i: 1, room: "out" }, { i: 0, room: "living" }, { i: 2, room: "kitchen" }], aspect: "16:9" } };
        if (b.action === "start") {
          started++;
          if (startFail) { const f = startFail(started, b); if (f) return f; }
          inflight++;
          maxInflight = Math.max(maxInflight, inflight);
          return { status: 200, ok: true, json: { ok: true, job: `gw:${started}` } };
        }
        if (b.action === "status") {
          const plan = statusPlan ? statusPlan(b.job) : null;
          if (plan) return plan;
          inflight--;
          return { status: 200, ok: true, json: { ok: true, done: true, path: b.save, url: `https://hyvwfsmjbaynozceookv.supabase.co/storage/v1/object/sign/nd-files/${b.save}?token=t`, size: 10, mime: "video/mp4" } };
        }
      }
      if (opts.url.includes("/rest/v1/nd_properties")) return { status: 200, ok: true, json: [{ data: { pics } }] };
      if (opts.url.includes("/storage/v1/object/sign/nd-files")) return { status: 200, ok: true, json: opts.json.paths.map((p) => ({ path: p, signedURL: `/object/sign/nd-files/${p}?token=t` })) };
      throw new Error(`unexpected ${opts.url}`);
    },
  };
  const http = {
    request: async (opts) => {
      calls.push({ ...opts, plain: true });
      expect(opts.headers?.Authorization).toBeUndefined();
      return { status: 200, ok: true, buffer: Buffer.from("\0\0\0\x18ftypmp42", "latin1").buffer };
    },
  };
  const tools = {
    call: async (tool, input) => {
      calls.push({ tool, input });
      if (input.code === "MANY") return { ok: true, result: { candidates: [{ id: "1", code: "P-1" }, { id: "2", code: "P-2" }] } };
      if (input.code === "NONE") return { ok: false, status: 404, error: "Не намирам обява" };
      return { ok: true, result: { start_video: { mode: "walk", property: { id: "prop-1", code: "P-1001", title: "Тестов апартамент", photos: pics.length } } } };
    },
  };
  let n = 0;
  const store = new Map();
  const files = {
    add: (spec) => { const id = `vid${String(++n).padStart(5, "0")}`; added.push({ id, ...spec }); store.set(id, { id, kind: /^video/.test(spec.mime) ? "video" : "image", name: spec.name, mime: spec.mime }); return { ok: true, file: { id, name: spec.name } }; },
    ref: (id) => store.get(id) || null,
    get: (id) => (store.get(id) ? { ref: store.get(id), bytes: Buffer.from([0xff, 0xd8, 0xff]) } : null),
    update: (id, patch) => { if (!store.has(id)) return null; store.set(id, { ...store.get(id), ...patch }); return store.get(id); },
  };
  const uploads = { ensure: async (id) => ({ path: `ted-chat/2026-11/${id}.jpg`, name: id, mime: "image/jpeg" }) };
  const video = createVideo({
    session, http, tools, files, uploads, thumb: () => ({ data: "AAAA", width: 1600, height: 1200 }), emit: (j) => events.push(j),
    sleep: () => new Promise((r) => setImmediate(r)), pollMs: 1, retryPollMs: 1,
  });
  const settle = async () => { for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r)); };
  return { video, calls, events, added, settle, files, maxInflight: () => maxInflight, started: () => started };
}

describe("prepare", () => {
  it("listing photos -> route order, walk prompts, engines and an estimate; needs approval", async () => {
    const t = setup();
    const r = await t.video.prepare({ code: "P-1001" });
    expect(r.ok).toBe(true);
    expect(t.calls.find((c) => c.tool)).toEqual({ tool: "video.create", input: { code: "P-1001", mode: "walk" } });
    expect(t.calls.find((c) => c.url && c.url.includes("nd_properties")).url).toBe("https://hyvwfsmjbaynozceookv.supabase.co/rest/v1/nd_properties?id=eq.prop-1&select=data");
    const job = r.job;
    expect(job).toMatchObject({ status: "approval", aspect: "16:9", source: { code: "P-1001", title: "Тестов апартамент", photos: 4 }, defaults: { engine: "kling", duration: 5 } });
    expect(job.parts.map((p) => p.title)).toEqual(["Част 1: Отвън → Хол", "Част 2: Хол → Кухня", "Част 3: Кухня → Краен кадър"]);
    expect(job.est).toEqual({ n: 3, sec: 15, cost: 2.55, min: 2 });
    expect(job.gateway).toEqual({ ok: true, balance: 12.5 });
    expect(t.calls.filter((c) => c.started)).toEqual([]);
    expect(t.calls.some((c) => c.json && c.json.action === "start")).toBe(false); // nothing paid before the approval
  });

  it("candidates, not found, free text without photos, no engine", async () => {
    const t = setup();
    expect(await t.video.prepare({ code: "MANY" })).toMatchObject({ ok: false, code: "candidates", candidates: [{ code: "P-1" }, { code: "P-2" }] });
    expect(await t.video.prepare({ code: "NONE" })).toMatchObject({ ok: false, code: "not_found" });
    expect(await t.video.prepare({ prompt: "клип на къща до морето" })).toEqual({ ok: false, code: "few_photos", error: FEW_PHOTOS });
    const t2 = setup({ engines: [] });
    const r = await t2.video.prepare({ code: "P-1001" });
    expect(r).toMatchObject({ ok: false, code: "no_engine", error: NO_ENGINE, job: { status: "need_engine" } });
  });

  it("attached photos are uploaded and used; one photo + prompt = one clip", async () => {
    const t = setup();
    t.files.add({ name: "a.jpg", mime: "image/jpeg", data: Buffer.from([1]) });
    t.files.add({ name: "b.jpg", mime: "image/jpeg", data: Buffer.from([1]) });
    const r = await t.video.prepare({ fileIds: ["vid00001", "vid00002"] });
    expect(r.ok).toBe(true);
    expect(r.job.parts).toHaveLength(1);
    const one = await t.video.prepare({ fileIds: ["vid00001"], prompt: "slow push in" });
    expect(one.job.parts).toEqual([{ n: 1, title: "Част 1: клип от снимката", status: "idle" }]);
  });
});

describe("run", () => {
  it("validates the choice, runs parts 3 at a time, downloads each without a token, then asks to stitch", async () => {
    const t = setup({ pics: ["1", "2", "3", "4", "5", "6"] });
    const { job } = await t.video.prepare({ code: "P-1001" });
    expect(await t.video.start({ jobId: job.id, engine: "nope", duration: 5 })).toMatchObject({ ok: false });
    expect(await t.video.start({ jobId: job.id, engine: "kling", duration: 7 })).toMatchObject({ ok: false });
    expect(await t.video.start({ jobId: job.id, engine: "kling", duration: 10 })).toEqual({ ok: true });
    await t.settle();
    const last = t.events.at(-1);
    expect(last.status).toBe("stitch");
    expect(last.parts.every((p) => p.status === "done" && p.fileId)).toBe(true);
    expect(t.maxInflight()).toBeLessThanOrEqual(3);
    const starts = t.calls.filter((c) => c.json && c.json.action === "start").map((c) => c.json);
    expect(starts).toHaveLength(5);
    expect(starts[0]).toMatchObject({ engine: "kling", aspect: "16:9", duration: 10, resolution: "720p", first: { path: expect.any(String) }, last: { path: expect.any(String) } });
    expect(starts[0].prompt.startsWith(WALK_BASE)).toBe(true);
    const status = t.calls.find((c) => c.json && c.json.action === "status").json;
    expect(status.save).toMatch(/^ted\/video\/P-1001\/part-\d+-\d+\.mp4$/);
    expect(t.added.every((a) => a.origin === "crm" && a.mime === "video/mp4")).toBe(true);
    const fin = t.video.finish({ jobId: job.id, fileId: last.parts[0].fileId });
    expect(fin.ok).toBe(true);
    // The stitched clip reached the store through files.add (origin "user"); finish marks it as Ted's work.
    expect(fin.file.origin).toBe("ted");
    expect(t.files.ref(last.parts[0].fileId).origin).toBe("ted");
    expect(t.events.at(-1)).toMatchObject({ status: "done", fileId: last.parts[0].fileId });
  });

  it("single-frame engines get no last frame; a FATAL server error stops everything", async () => {
    const t = setup({ startFail: (n) => (n === 2 ? { status: 502, ok: false, json: { ok: false, error: "Липсва AI_GATEWAY_API_KEY" } } : null) });
    const { job } = await t.video.prepare({ code: "P-1001" });
    await t.video.start({ jobId: job.id, engine: "sora", duration: 4 });
    await t.settle();
    const starts = t.calls.filter((c) => c.json && c.json.action === "start").map((c) => c.json);
    expect(starts[0]).not.toHaveProperty("last");
    expect(t.events.at(-1)).toMatchObject({ status: "failed", error: "Спрях: Липсва AI_GATEWAY_API_KEY" });
  });

  it("5xx without JSON while polling is retried; a part error is retried up to 3 times", async () => {
    let polls = 0;
    const t = setup({
      pics: ["1", "2"],
      statusPlan: () => (++polls <= 2 ? { status: 503, ok: false, json: null } : polls === 3 ? { status: 200, ok: true, json: { ok: true, done: false, status: "running" } } : null),
    });
    const { job } = await t.video.prepare({ code: "P-1001" });
    await t.video.start({ jobId: job.id, engine: "kling", duration: 5 });
    await t.settle();
    expect(t.events.at(-1).status).toBe("done");
    const t2 = setup({ pics: ["1", "2"], startFail: () => ({ status: 502, ok: false, json: { ok: false, error: "Временна грешка на двигателя" } }) });
    const r = await t2.video.prepare({ code: "P-1001" });
    await t2.video.start({ jobId: r.job.id, engine: "kling", duration: 5 });
    await t2.settle();
    expect(t2.started()).toBe(3);
    expect(t2.events.at(-1)).toMatchObject({ status: "failed" });
  });

  it("cancel stops polling", async () => {
    const t = setup({ statusPlan: () => ({ status: 200, ok: true, json: { ok: true, done: false } }) });
    const { job } = await t.video.prepare({ code: "P-1001" });
    await t.video.start({ jobId: job.id, engine: "kling", duration: 5 });
    await t.settle();
    t.video.cancel({ jobId: job.id });
    await t.settle();
    expect(t.video.get(job.id).status).toBe("cancelled");
  });
});

describe("helpers", () => {
  it("prompts, durations and estimates match the site", () => {
    expect(move("out", "entry")).toBe("Start outside and move towards the entrance.");
    expect(move("living", "kitchen")).toBe("Pull back through the living room, then push forward into the kitchen.");
    expect(durFor({ durs: [4, 6, 8] })).toBe(4);
    expect(estimate(7, { price: 0.1 }, 8)).toEqual({ n: 7, sec: 56, cost: 5.6, min: 6 });
    expect(walkParts([{ room: "out", ref: { path: "a" } }, { room: "entry", ref: { path: "b" } }])[0].prompt).toBe(`${WALK_BASE} Start outside and move towards the entrance.`);
    expect(FATAL.test("insufficient credits")).toBe(true);
  });
});
