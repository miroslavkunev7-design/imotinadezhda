// Scheduled tasks (docs/CONTRACT.md §13): next-run calculation in Europe/Sofia (weekdays, end of month, DST),
// validation, due/missed reporting (never executed silently), per-user storage.
import { describe, it, expect } from "vitest";
import { createScheduled, nextRun, fromSofia, sofiaParts, cleanTask } from "../../electron/scheduled.js";
import { memoryStore } from "./core-helpers.js";

const iso = (s) => new Date(s).toISOString();

describe("next run (Europe/Sofia)", () => {
  it("wall-clock conversion across DST", () => {
    expect(iso(fromSofia(2026, 1, 15, 9, 0))).toBe("2026-01-15T07:00:00.000Z"); // EET +2
    expect(iso(fromSofia(2026, 7, 15, 9, 0))).toBe("2026-07-15T06:00:00.000Z"); // EEST +3
    const gap = fromSofia(2026, 3, 29, 3, 30); // 03:00 -> 04:00 on the last Sunday of March
    expect(sofiaParts(gap).hh).toBe(4);
  });

  it("daily keeps 09:00 local across the DST change", () => {
    const at = iso("2026-03-27T07:00:00Z"); // Fri 09:00 EET
    expect(iso(nextRun(at, "daily", new Date("2026-03-28T08:00:00Z")))).toBe("2026-03-29T06:00:00.000Z"); // Sun 09:00 EEST
    expect(iso(nextRun(at, "daily", new Date("2026-10-24T07:00:00Z")))).toBe("2026-10-25T07:00:00.000Z"); // back to EET
  });

  it("weekdays skip the weekend; weekly keeps the weekday", () => {
    const fri = iso("2026-11-20T07:00:00Z"); // Fri 09:00
    expect(iso(nextRun(fri, "weekdays", new Date("2026-11-20T08:00:00Z")))).toBe("2026-11-23T07:00:00.000Z"); // Mon
    expect(iso(nextRun(fri, "weekly", new Date("2026-11-20T08:00:00Z")))).toBe("2026-11-27T07:00:00.000Z");
  });

  it("monthly on the 31st falls on the last day of shorter months, then returns to the 31st", () => {
    const at = iso("2027-01-31T08:00:00Z"); // 10:00 EET
    const feb = nextRun(at, "monthly", new Date("2027-01-31T09:00:00Z"));
    expect(iso(feb)).toBe("2027-02-28T08:00:00.000Z");
    expect(iso(nextRun(at, "monthly", feb))).toBe("2027-03-31T07:00:00.000Z"); // EEST from Mar 28
    expect(iso(nextRun(iso("2028-01-31T08:00:00Z"), "monthly", new Date("2028-02-01T00:00:00Z")))).toBe("2028-02-29T08:00:00.000Z"); // leap year
  });

  it("one-off tasks run once; the first run is the start time", () => {
    const at = iso("2026-12-01T08:00:00Z");
    expect(iso(nextRun(at, "none", new Date("2026-11-30T00:00:00Z")))).toBe(at);
    expect(nextRun(at, "none", new Date("2026-12-02T00:00:00Z"))).toBeNull();
  });
});

describe("tasks", () => {
  function setup(t0 = "2026-11-17T08:00:00Z") {
    const store = memoryStore();
    let clock = new Date(t0);
    let user = "u1";
    const due = [];
    const notes = [];
    const s = createScheduled({ secureStore: store, owner: () => user, notify: (t, b) => notes.push([t, b]), emitDue: (d) => due.push(d), now: () => clock, setTimer: () => null, clearTimer: () => {} });
    return { s, store, due, notes, tick: (to) => { clock = new Date(to); s.tick(); }, setUser: (u) => { user = u; } };
  }

  it("validates input; saves per CRM user; a past one-off time is not run by saving", () => {
    const { s, store, setUser } = setup();
    expect(s.save({ title: "", kind: "reminder", at: "2026-11-18T08:00:00Z" })).toMatchObject({ ok: false, code: "invalid" });
    expect(s.save({ title: "x", kind: "shell", at: "2026-11-18T08:00:00Z" })).toMatchObject({ ok: false, code: "invalid" });
    expect(s.save({ title: "x", kind: "prompt", text: "  ", at: "2026-11-18T08:00:00Z" })).toMatchObject({ ok: false });
    const r = s.save({ title: "Оглед", kind: "reminder", text: "ул. Тест 1", at: "2026-11-18T08:00:00Z", repeat: "daily", extra: "dropped" });
    expect(r.item).toMatchObject({ title: "Оглед", kind: "reminder", engine: "server", repeat: "daily", enabled: true, nextRun: "2026-11-18T08:00:00.000Z" });
    expect(r.item).not.toHaveProperty("extra");
    expect(store.data.get("scheduled-u1").items).toHaveLength(1);
    const past = s.save({ title: "Минало", kind: "reminder", at: "2026-11-01T08:00:00Z" });
    expect(past.item).toMatchObject({ enabled: false, nextRun: null });
    setUser("u2");
    expect(s.list().items).toEqual([]);
    expect(cleanTask({ title: "t", kind: "prompt", text: "Справка", engine: "realgpt", at: "2026-11-18T08:00:00Z", lastResult: { ok: false, error: "Няма връзка с ChatGPT" } }).lastResult).toEqual({ ok: false, error: "Няма връзка с ChatGPT" });
  });

  it("fires due reminders with a notification and advances the next run", () => {
    const { s, due, notes, tick, store } = setup();
    s.save({ title: "Обади се на клиента", kind: "reminder", text: "Тест", at: "2026-11-17T08:30:00Z", repeat: "weekdays" });
    tick("2026-11-17T08:00:10Z"); // first tick of the run: nothing due yet
    expect(due).toEqual([]);
    tick("2026-11-17T08:30:05Z");
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ missed: false, task: { title: "Обади се на клиента" } });
    expect(notes[0]).toEqual(["Обади се на клиента", "Тест"]);
    expect(store.data.get("scheduled-u1").items[0].nextRun).toBe("2026-11-18T08:30:00.000Z");
  });

  it("a question to Тед that runs on time also raises a Windows notification (as Настройки → Известия says)", () => {
    const { s, due, notes, tick } = setup();
    s.save({ title: "Справка", kind: "prompt", text: "Направи справка", engine: "server", at: "2026-11-17T08:30:00Z" });
    tick("2026-11-17T08:00:10Z");
    tick("2026-11-17T08:30:05Z");
    expect(due).toEqual([expect.objectContaining({ missed: false })]);
    expect(notes).toEqual([["Задача на Тед: Справка", "Тед започна задачата – отговорът е в нов чат „Планирано“."]]);
  });

  it("runs missed while the program was closed are reported once as missed, never twice", () => {
    const { s, due, notes, tick } = setup("2026-11-17T06:00:00Z");
    s.save({ title: "Справка", kind: "prompt", text: "Направи справка за огледите", engine: "realgpt", at: "2026-11-17T07:00:00Z", repeat: "daily" });
    s.ownerChanged();
    tick("2026-11-17T10:00:00Z"); // program opened 3 h later
    expect(due).toEqual([expect.objectContaining({ missed: true })]);
    expect(notes[0][0]).toBe("Пропусната задача: Справка");
    tick("2026-11-17T10:00:30Z");
    expect(due).toHaveLength(1);
  });

  it("notifications can be switched off; the tasks still report", () => {
    const store = memoryStore();
    const due = [];
    const notes = [];
    let clock = new Date("2026-11-17T08:00:00Z");
    const s = createScheduled({ secureStore: store, owner: () => "u1", notify: (t) => notes.push(t), emitDue: (d) => due.push(d), getSettings: () => ({ notify: { scheduled: false } }), now: () => clock, setTimer: () => null });
    s.save({ title: "Тест", kind: "reminder", at: "2026-11-17T08:00:20Z" });
    s.tick();
    clock = new Date("2026-11-17T08:00:30Z");
    s.tick();
    expect(due).toHaveLength(1);
    expect(notes).toEqual([]);
    expect(s.list().items[0]).toMatchObject({ enabled: false, nextRun: null });
  });
});
