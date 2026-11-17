// The gate table over every server tool (docs/CONTRACT.md §9.3) and the labels built from real tool names/inputs.
import { describe, it, expect } from "vitest";
import { asksConfirm, classify, inputLines, stripConfirm, toolLabel, approvalTitle, approvalJson, normalizeInput, isDocSource } from "../../electron/agent/gate.js";
import { STAFF_TOOLS } from "../../electron/agent/tools-spec.js";

const TABLE = {
  auto: [
    "clients.search", "clients.get", "properties.search", "properties.match", "calendar.list", "deals.list", "companies.search",
    "brokers.list", "documents.list", "documents.download_link", "calc.mortgage", "calc.commission", "calc.yield", "rates.live",
    "reports.summary", "documents.find", "documents.inspect", "documents.extract_text", "rentals.list", "inquiries.list",
    "collected.list", "analyze_image", "analyze_document", "contacts.resolve", "email.preview", "memory.search", "cases.list",
    "cases.get", "audit.recent", "nc.help", "projects.list", "projects.get", "units.list", "units.get", "jobs.status", "jobs.result",
    "interior.get_scene", "tour.get", "tour.get_authorized_asset", "cad.inspect", "models.get",
  ],
  generate: ["images.download", "images.generate", "documents.translate", "documents.merge", "documents.split", "documents.create_pdf", "files.to_pdf"],
  approval: [
    "clients.create", "clients.update", "clients.add_note", "properties.create", "properties.update", "calendar.create",
    "calendar.update", "deals.create", "deals.update", "documents.bank_statements_pack", "rentals.create", "rentals.update",
    "rentals.mark_paid", "companies.create", "companies.add_employee", "files.attach", "documents.attach", "contracts.generate",
    "calendar.assign", "memory.remember", "memory.forget", "cases.create", "cases.update", "listings.find_owners",
    "listings.collect_page", "projects.create_draft", "projects.update", "buildings.upsert", "floors.upsert", "units.upsert",
    "imports.start", "jobs.cancel", "interior.geometry_save", "interior.geometry_verify", "interior.style_save", "interior.prepare",
    "interior.validate", "tour.render", "tour.report", "tour.edit", "tour.validate", "tours.request", "models.request",
  ],
  confirm: [
    "clients.delete", "calendar.delete", "properties.set_status", "units.set_status", "projects.mark_reviewed", "projects.publish",
    "projects.archive", "projects.set_media", "imports.apply", "interior.approve", "tour.publish", "tour.unpublish",
    "models.publish", "models.unpublish",
  ],
  never: ["email.send", "cases.log_turn", "video.create"],
};

describe("gate table", () => {
  it("covers all 108 server tools exactly once", () => {
    const all = Object.values(TABLE).flat();
    expect(all).toHaveLength(108);
    expect(new Set(all).size).toBe(108);
    expect([...all].sort()).toEqual([...STAFF_TOOLS].sort());
  });

  for (const [cls, names] of Object.entries(TABLE)) {
    it(`${cls}: ${names.length} tools`, () => {
      for (const name of names) expect(classify(name, {}), name).toBe(cls);
    });
  }

  it("Ted-folder generation becomes an approval as soon as a CRM target is named", () => {
    expect(classify("images.generate", { prompt: "x", property_code: "P-1", photo_index: 0 })).toBe("generate");
    expect(classify("images.generate", { prompt: "x", property_code: "P-1", save_to_property: true })).toBe("approval");
    expect(classify("images.generate", { prompt: "x", client_name: "Тест" })).toBe("approval");
    expect(classify("documents.translate", { path: "a.pdf", target: "bg" })).toBe("generate");
    expect(classify("documents.translate", { doc_id: "d1", target: "bg" })).toBe("approval");
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
    expect(toolLabel("analyze_image")).toBe("анализ на снимка");
    expect(toolLabel("weird.thing")).toBe("weird.thing");
    expect(approvalTitle("calendar.create")).toBe("Тед иска да създаде: календар");
    expect(approvalTitle("files.attach")).toBe("Тед иска да запише файл в CRM: файлове");
    expect(inputLines({ name: "Тест", confirm: true, files: [{ path: "ted-chat/2026-11/a.pdf" }], note: "x".repeat(320), empty: "" })).toEqual([
      ["Име", "Тест"], ["Файлове", "a.pdf"], ["Бележка", `${"x".repeat(300)}…(още 20 знака)`],
    ]);
  });
});

describe("security review fixes", () => {
  it("booleans the server coerces are read and sent the same way (save_to_property)", () => {
    for (const v of [true, "true", 1, "1", "yes"]) expect(classify("images.generate", { prompt: "x", property_code: "A1", save_to_property: v })).toBe("approval");
    for (const v of [false, "false", 0, "0", null, undefined, ""]) expect(classify("images.generate", { prompt: "x", property_code: "A1", save_to_property: v })).toBe("generate");
    expect(normalizeInput({ prompt: "x", save_to_property: "true" })).toEqual({ prompt: "x", save_to_property: true });
    expect(normalizeInput({ prompt: "x", save_to_property: 1 })).toEqual({ prompt: "x", save_to_property: true });
    expect(normalizeInput({ prompt: "x", save_to_property: "false" })).toEqual({ prompt: "x", save_to_property: false });
    expect(normalizeInput({ prompt: "x", save_to_property: "" })).toEqual({ prompt: "x" });
  });

  it("a CRM document as a source in files/paths is a card, exactly as the server's chatSources reads it", () => {
    const uuid = "9b2c1d1e-0000-4000-8000-000000000001";
    expect(classify("documents.translate", { files: [uuid] })).toBe("approval");
    expect(classify("documents.translate", { files: [{ id: uuid }] })).toBe("approval");
    expect(classify("documents.translate", { paths: [uuid] })).toBe("approval");
    expect(classify("files.to_pdf", { files: [uuid, uuid] })).toBe("approval");
    expect(classify("documents.merge", { paths: [uuid] })).toBe("approval");
    expect(classify("documents.translate", { files: ["file:abcdefgh12"] })).toBe("generate");
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
