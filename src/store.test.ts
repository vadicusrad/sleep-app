import { beforeEach, describe, expect, it, vi } from "vitest";
import { dateKey, timestamp } from "./domain";

vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date(2026, 9, 25, 12));
const memory = new Map<string, string>();
vi.stubGlobal("window", { dispatchEvent: vi.fn() });
vi.stubGlobal(
  "CustomEvent",
  class {
    constructor(
      public type: string,
      public data: unknown,
    ) {}
  },
);
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => memory.set(k, v),
  removeItem: (k: string) => memory.delete(k),
});
const { useDiary, STORAGE_KEY, exportDiary, parseDiaryBackup, importDiary } = await import("./store");
const add = (d: string, k: "wake" | "sleep" | "night", t: string) =>
  useDiary
    .getState()
    .addEvent(d, { kind: k, at: timestamp(d, t), comment: "" });
beforeEach(() => {
  memory.clear();
  useDiary.setState({ birthDate: "", days: {}, lastWake: null });
});
describe("журнал и сохранение", () => {
  it("переносит весь дневник, планы, комментарии и черновик ночи", () => {
    add("2026-10-23", "wake", "07:00");
    const wake = useDiary.getState().days["2026-10-23"].events[0];
    useDiary.getState().setPlan("2026-10-23", wake.id, 180);
    add("2026-10-23", "sleep", "10:00");
    add("2026-10-23", "wake", "11:00");
    expect(useDiary.getState().addEvent("2026-10-23", { kind: "sleep", at: timestamp("2026-10-23", "11:15"), comment: "Продлили", continuation: true })).toBeNull();
    useDiary.getState().setBirth("2025-12-25");
    useDiary.getState().setNote("2026-10-23", "Заметка");
    useDiary.getState().draftNight("2026-10-23", [{ id: "draft", start: "2026-10-23T21:00", end: "", comment: "Черновик" }]);
    const backup = parseDiaryBackup(exportDiary());
    useDiary.setState({ birthDate: "", days: {}, lastWake: null });
    expect(importDiary(backup)).toBeNull();
    const stored = memory.get(STORAGE_KEY)!;
    useDiary.setState({ birthDate: "", days: {}, lastWake: null });
    memory.set(STORAGE_KEY, stored);
    useDiary.persist.rehydrate();
    expect(useDiary.getState()).toMatchObject(backup);
    expect(useDiary.getState().days["2026-10-23"].events[3]).toMatchObject({ comment: "Продлили", continuation: true });
    expect(useDiary.getState().days["2026-10-23"].night.rows[0].comment).toBe("Черновик");
  });
  it("отклоняет повреждённый файл и не меняет существующий дневник", () => {
    add("2026-10-23", "wake", "07:00");
    const original = memory.get(STORAGE_KEY);
    expect(() => parseDiaryBackup("{ошибка")).toThrow();
    expect(() => parseDiaryBackup(JSON.stringify({ format: "quiet-hour-backup", version: 1, data: { birthDate: "", lastWake: null, days: { invalid: {} } } }))).toThrow();
    expect(memory.get(STORAGE_KEY)).toBe(original);
    expect(useDiary.getState().days["2026-10-23"].events).toHaveLength(1);
  });
  it("не меняет записи в памяти, если сохранить импорт не удалось", () => {
    add("2026-10-23", "wake", "07:00");
    const backup = parseDiaryBackup(exportDiary());
    const original = memory.get(STORAGE_KEY);
    const fail = vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(importDiary({ ...backup, days: {} })).toContain("Не удалось сохранить");
    fail.mockRestore();
    expect(memory.get(STORAGE_KEY)).toBe(original);
    expect(useDiary.getState().days["2026-10-23"].events).toHaveLength(1);
  });
  it("позволяет исправить старую запись и сохраняет продление после перезагрузки", () => {
    add("2026-10-23", "wake", "07:00");
    add("2026-10-23", "sleep", "14:37");
    add("2026-10-23", "wake", "15:16");
    add("2026-10-23", "sleep", "15:44");
    const event = useDiary.getState().days["2026-10-23"].events[3];
    expect(useDiary.getState().editEvent("2026-10-23", event.id, { continuation: true })).toBeNull();
    const saved = memory.get(STORAGE_KEY)!;
    useDiary.setState({ days: {} });
    memory.set(STORAGE_KEY, saved);
    useDiary.persist.rehydrate();
    expect(useDiary.getState().days["2026-10-23"].events[3].continuation).toBe(true);
    expect(useDiary.getState().editEvent("2026-10-23", event.id, { continuation: false })).toBeNull();
  });
  it("сохраняет факты и план независимо и восстанавливает данные", () => {
    add("2026-10-23", "wake", "06:50");
    const event = useDiary.getState().days["2026-10-23"].events[0];
    useDiary.getState().setPlan("2026-10-23", event.id, 195);
    add("2026-10-23", "sleep", "10:15");
    useDiary.getState().setBirth("2025-12-25");
    const stored = memory.get(STORAGE_KEY)!;
    expect(
      JSON.parse(stored).state.days["2026-10-23"].events[0].plannedMinutes,
    ).toBe(195);
    useDiary.setState({ days: {} });
    memory.set(STORAGE_KEY, stored);
    useDiary.persist.rehydrate();
    expect(useDiary.getState().days["2026-10-23"].events).toHaveLength(2);
    expect(useDiary.getState().birthDate).toBe("2025-12-25");
  });
  it("создает следующий утренний подъем после сохранения ночи", () => {
    add("2026-10-23", "wake", "07:00");
    add("2026-10-23", "night", "21:00");
    useDiary
      .getState()
      .draftNight("2026-10-23", [
        {
          id: "r",
          start: "2026-10-23T21:00",
          end: "2026-10-24T06:50",
          comment: "Спокойная ночь",
        },
      ]);
    expect(useDiary.getState().completeNight("2026-10-23")).toBeNull();
    const next = useDiary.getState().days["2026-10-24"];
    expect(next.events[0].kind).toBe("wake");
    expect(dateKey(new Date(next.events[0].at))).toBe("2026-10-24");
  });
  it("не меняет утренний подъем молча при несовпадении ночи", () => {
    add("2026-10-23", "wake", "07:00");
    add("2026-10-23", "night", "21:00");
    add("2026-10-24", "wake", "06:50");
    useDiary
      .getState()
      .draftNight("2026-10-23", [
        {
          id: "r",
          start: "2026-10-23T21:00",
          end: "2026-10-24T06:40",
          comment: "",
        },
      ]);
    expect(useDiary.getState().completeNight("2026-10-23")).toContain(
      "подъемом",
    );
    expect(useDiary.getState().days["2026-10-24"].events[0].at).toBe(
      timestamp("2026-10-24", "06:50"),
    );
  });
  it("комментарий не отменяет завершенную ночь, а удаление связанной границы защищено", () => {
    add("2026-10-23", "wake", "07:00");
    add("2026-10-23", "night", "21:00");
    useDiary
      .getState()
      .draftNight("2026-10-23", [
        {
          id: "r",
          start: "2026-10-23T21:00",
          end: "2026-10-24T06:50",
          comment: "",
        },
      ]);
    useDiary.getState().completeNight("2026-10-23");
    const night = useDiary.getState().days["2026-10-23"];
    useDiary
      .getState()
      .editEvent("2026-10-23", night.events[1].id, {
        comment: "Новый комментарий",
      });
    expect(useDiary.getState().days["2026-10-23"].night.complete).toBe(true);
    useDiary
      .getState()
      .draftNight("2026-10-23", [
        { ...night.night.rows[0], comment: "После кормления" },
      ]);
    expect(useDiary.getState().days["2026-10-23"].night.complete).toBe(true);
    expect(useDiary.getState().undoEvent("2026-10-23")).toContain(
      "следующий день",
    );
    expect(useDiary.getState().days["2026-10-23"].events).toHaveLength(2);
  });
  it("после изменения времени снимает статус полной ночи", () => {
    add("2026-10-23", "wake", "07:00");
    add("2026-10-23", "night", "21:00");
    useDiary
      .getState()
      .draftNight("2026-10-23", [
        {
          id: "r",
          start: "2026-10-23T21:00",
          end: "2026-10-24T06:50",
          comment: "",
        },
      ]);
    useDiary.getState().completeNight("2026-10-23");
    const e = useDiary.getState().days["2026-10-24"].events[0];
    expect(
      useDiary
        .getState()
        .editEvent("2026-10-24", e.id, {
          at: timestamp("2026-10-24", "07:00"),
        }),
    ).toBeNull();
    expect(useDiary.getState().days["2026-10-23"].night.complete).toBe(false);
  });
});
