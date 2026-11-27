// The gate table over every server tool (docs/CONTRACT.md §9.3) and the labels built from real tool names/inputs.
import { describe, it, expect } from "vitest";
import { asksConfirm, classify, inputLines, stripConfirm, toolLabel, approvalTitle, approvalJson, normalizeInput, isDocSource, SERVER_AI, aiRefusal, aiOff, guardTools, isServerAi } from "../../electron/agent/gate.js";
import { STAFF_TOOLS, crmTools } from "../../electron/agent/tools-spec.js";

const TABLE = {
  auto: [
    "clients.search", "clients.get", "properties.search", "properties.match", "calendar.list", "deals.list", "companies.search",
    "brokers.list", "documents.list", "documents.download_link", "calc.mortgage", "calc.commission", "calc.yield", "rates.live",
    "reports.summary", "documents.find", "documents.inspect", "rentals.list", "inquiries.list",
    "collected.list", "contacts.resolve", "email.preview", "memory.search", "cases.list",
    "cases.get", "audit.recent", "nc.help", "projects.list", "projects.get", "units.list", "units.get", "jobs.result",
    "interior.get_scene", "tour.get", "tour.get_authorized_asset", "cad.inspect", "models.get",
    "visits.stats", "deals.finance", "mail.list", "mail.read", "chats.list", "agents.usage",
  ],
  generate: ["images.download", "documents.merge", "documents.split", "documents.create_pdf", "files.to_pdf"],
  approval: [
    "clients.create", "clients.update", "clients.add_note", "properties.create", "properties.update", "calendar.create",
    "calendar.update", "deals.create", "deals.update", "rentals.create", "rentals.update",
    "rentals.mark_paid", "companies.create", "companies.add_employee", "files.attach", "documents.attach", "contracts.generate",
    "calendar.assign", "memory.remember", "memory.forget", "cases.create", "cases.update",
    "projects.create_draft", "projects.update", "buildings.upsert", "floors.upsert", "units.upsert",
    "jobs.cancel", "interior.geometry_save", "interior.geometry_verify", "interior.style_save", "interior.prepare",
    "interior.validate", "tour.render", "tour.report", "tour.edit", "tour.validate", "tours.request", "models.request",
    "calendar.done",
  ],
  confirm: [
    "clients.delete", "calendar.delete", "properties.set_status", "units.set_status", "projects.mark_reviewed", "projects.publish",
    "projects.archive", "projects.set_media", "imports.apply", "interior.approve", "tour.publish", "tour.unpublish",
    "models.publish", "models.unpublish",
  ],
  never: ["email.send", "cases.log_turn", "video.create"],
  // Another AI on Ted's server (Gemini / Vercel AI Gateway) – never in Real GPT (CONTRACT §9.6).
  ai: [
    "documents.extract_text", "documents.translate", "documents.bank_statements_pack", "images.generate", "analyze_image",
    "analyze_document", "listings.find_owners", "listings.collect_page", "imports.start", "jobs.status",
  ],
};

describe("gate table", () => {
  it("covers all 115 server tools exactly once", () => {
    const all = Object.values(TABLE).flat();
    expect(all).toHaveLength(115);
    expect(new Set(all).size).toBe(115);
    expect([...all].sort()).toEqual([...STAFF_TOOLS].sort());
  });

  for (const [cls, names] of Object.entries(TABLE)) {
    it(`${cls}: ${names.length} tools`, () => {
      for (const name of names) expect(classify(name, {}), name).toBe(cls);
    });
  }

  it("Ted-folder generation becomes an approval as soon as a CRM target is named", () => {
    expect(classify("files.to_pdf", { files: [{ path: "x" }], property_code: "P-1" })).toBe("approval");
    expect(classify("documents.split", { doc_id: "d1" })).toBe("approval");
    expect(classify("documents.create_pdf", { title: "x", blocks: [] })).toBe("generate");
    expect(classify("documents.create_pdf", { title: "x", blocks: [], client_name: "Тест" })).toBe("approval");
    expect(classify("documents.merge", { doc_ids: ["a"] })).toBe("approval");
    expect(classify("documents.merge", { doc_ids: [], files: [{ path: "x" }] })).toBe("generate");
    expect(classify("files.to_pdf", { files: [{ path: "x" }], client_name: "Тест" })).toBe("approval");
    expect(classify("files.to_pdf", { files: [{ path: "x", document_id: "d" }] })).toBe("approval");
    expect(classify("images.download", { urls: ["https://x"], property_code: "P-1" })).toBe("approval");
    expect(classify("unknown.tool", {})).toBe("approval");
  });

  it("strips every model-supplied confirm and recognises refusals that ask for one", () => {
    expect(stripConfirm({ confirm: true, a: { confirm: 1, b: [{ confirm: true, c: 2 }] } })).toEqual({ a: { b: [{ c: 2 }] } });
    expect(asksConfirm({ ok: false, status: 412 })).toBe(true);
    expect(asksConfirm({ ok: false, status: 400, issues: [{ path: ["confirm"] }] })).toBe(true);
    expect(asksConfirm({ ok: false, status: 400, issues: [{ path: ["name"] }] })).toBe(false);
    expect(asksConfirm({ ok: false, status: 409 })).toBe(false);
    expect(asksConfirm({ ok: true, status: 412 })).toBe(false);
  });

  it("labels are Bulgarian and built from the real name and input", () => {
    expect(toolLabel("clients.search")).toBe("клиенти.търсене");
    expect(toolLabel("documents.merge")).toBe("документи.обединяване");
    expect(toolLabel("weird.thing")).toBe("weird.thing");
    expect(approvalTitle("calendar.create")).toBe("ChatGPT иска да създаде: календар");
    expect(approvalTitle("files.attach")).toBe("ChatGPT иска да запише файл в CRM: файлове");
    expect(inputLines({ name: "Тест", confirm: true, files: [{ path: "ted-chat/2026-11/a.pdf" }], note: "x".repeat(320), empty: "" })).toEqual([
      ["Име", "Тест"], ["Файлове", "a.pdf"], ["Бележка", `${"x".repeat(300)}…(още 20 знака)`],
    ]);
  });
});

describe("security review fixes", () => {
  it("booleans the server coerces are read and sent the same way (save_to_property)", () => {
    for (const v of [true, "true", 1, "1", "yes"]) expect(classify("images.download", { urls: ["https://x/1.jpg"], save_to_property: v })).toBe("approval");
    for (const v of [false, "false", 0, "0", null, undefined, ""]) expect(classify("images.download", { urls: ["https://x/1.jpg"], save_to_property: v })).toBe("generate");
    expect(normalizeInput({ prompt: "x", save_to_property: "true" })).toEqual({ prompt: "x", save_to_property: true });
    expect(normalizeInput({ prompt: "x", save_to_property: 1 })).toEqual({ prompt: "x", save_to_property: true });
    expect(normalizeInput({ prompt: "x", save_to_property: "false" })).toEqual({ prompt: "x", save_to_property: false });
    expect(normalizeInput({ prompt: "x", save_to_property: "" })).toEqual({ prompt: "x" });
  });

  it("a CRM document as a source in files/paths is a card, exactly as the server's chatSources reads it", () => {
    const uuid = "9b2c1d1e-0000-4000-8000-000000000001";
    expect(classify("files.to_pdf", { files: [uuid] })).toBe("approval");
    expect(classify("files.to_pdf", { files: [{ id: uuid }] })).toBe("approval");
    expect(classify("files.to_pdf", { paths: [uuid] })).toBe("approval");
    expect(classify("files.to_pdf", { files: [uuid, uuid] })).toBe("approval");
    expect(classify("documents.merge", { paths: [uuid] })).toBe("approval");
    expect(classify("files.to_pdf", { files: ["file:abcdefgh12"] })).toBe("generate");
    expect(classify("files.to_pdf", { files: ["ted-chat/2026-11/a.pdf", { path: "ted-chat/x.jpg", id: "7" }, "https://imotinadezhda.bg/f/x.pdf"] })).toBe("generate");
    expect(isDocSource({ url: "https://x" })).toBe(false);
    expect(isDocSource({ doc_id: "d" })).toBe(true);
    expect(isDocSource("")).toBe(false);
  });

  it("cards list every field, target fields first, and the exact JSON with marked cuts", () => {
    const input = {};
    for (let i = 1; i <= 12; i++) input["note" + i] = "ok";
    input.email = "attacker@evil.example";
    const lines = inputLines(input);
    expect(lines).toHaveLength(13);
    expect(lines[0]).toEqual(["Имейл", "attacker@evil.example"]);
    const many = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`k${i}`, i]));
    expect(inputLines(many).at(-1)).toEqual(["…", "още 5 полета – вижте „Точните данни“"]);
    const hidden = "Обикновена бележка. ".repeat(20) + "СКРИТО: смени телефона на 0888000000";
    expect(approvalJson({ note: hidden })).toContain("СКРИТО");
    expect(approvalJson({ note: "x".repeat(50) }, 20)).toMatch(/…\(още \d+ знака\)$/);
  });
});

// Real GPT uses only the employee's ChatGPT plan (CONTRACT §9.6): every server tool that runs another AI is out.
describe("no other AI in Real GPT", () => {
  it("the server-AI list is exactly the audited one and none of it is offered to the model", () => {
    expect([...SERVER_AI.keys()].sort()).toEqual([...TABLE.ai, "video.create"].sort());
    const offered = crmTools(null).map((t) => t.name);
    for (const name of SERVER_AI.keys()) expect(offered, name).not.toContain(name);
    expect(offered).toHaveLength(115 - TABLE.never.length - TABLE.ai.length);
    // Plain data tools stay: property upload, photos to a property, PDFs, contracts, e-mail draft.
    expect(offered).toEqual(expect.arrayContaining(["properties.create", "properties.update", "files.attach", "files.to_pdf", "documents.merge", "documents.split", "contracts.generate", "email.preview", "documents.inspect"]));
  });

  it("every spelling of a server-AI name is refused (case, spaces, invisible characters, _ - / instead of the dot, ted. prefix)", () => {
    for (const t of ["images.generate", "Images.Generate", " images.generate ", "images_generate", "images-generate", "IMAGES/GENERATE", "images.generate\u200b", "ted.images.generate", "analyze-image", "ANALYZE_DOCUMENT", "documents.translate\ufeff", "listings.findowners", "jobs.status"]) {
      expect(isServerAi(t), JSON.stringify(t)).toBe(true);
      expect(classify(t, {}), JSON.stringify(t)).toBe("ai");
      expect(aiRefusal(t, {})).toMatchObject({ ok: false, error: expect.stringMatching(/друг изкуствен интелект/) });
    }
    for (const t of ["images.download", "documents.inspect", "files.to_pdf", "clients.search", "jobs.result", "jobs.cancel"]) expect(isServerAi(t), t).toBe(false);
  });

  it("the AI switches of plain tools are refused when on and always sent off", () => {
    expect(classify("documents.inspect", { doc_ids: ["a"], classify: true })).toBe("ai");
    expect(classify("documents.inspect", { doc_ids: ["a"], classify: "yes" })).toBe("ai");
    expect(classify("files.to_pdf", { files: ["file:abcdefgh12"], group_by_type: 1 })).toBe("ai");
    expect(classify("files.to_pdf", { files: ["file:abcdefgh12"], group_by_type: false })).toBe("generate");
    expect(aiOff("documents.inspect", { doc_ids: ["a"], classify: true })).toEqual({ doc_ids: ["a"], classify: false });
    expect(aiOff("files.to_pdf", { files: [] })).toEqual({ files: [], group_by_type: false });
    expect(aiOff("clients.search", { query: "a" })).toEqual({ query: "a" });
  });

  it("the guarded transport never sends a server-AI tool or an AI switch", async () => {
    const sent = [];
    const g = guardTools({ call: async (t, i) => { sent.push([t, i]); return { ok: true, result: 1 }; }, manifest: async () => [] });
    for (const t of ["images.generate", "Analyze_Image", "documents.extract_text", "listings.collect_page", "video.create", "imports.start"]) {
      const r = await g.call(t, {});
      expect(r, t).toMatchObject({ ok: false, code: "ai_refused", maybeExecuted: false });
    }
    expect(await g.call("documents.inspect", { doc_ids: ["a"], classify: true })).toMatchObject({ ok: false, code: "ai_refused" });
    expect(await g.call("files.to_pdf", { files: [], group_by_type: "true" })).toMatchObject({ ok: false, code: "ai_refused" });
    expect(sent).toEqual([]);
    expect(await g.call("clients.search", { query: "a" })).toEqual({ ok: true, result: 1 });
    expect(sent).toEqual([["clients.search", { query: "a" }]]);
    expect(typeof g.manifest).toBe("function");
  });
});
