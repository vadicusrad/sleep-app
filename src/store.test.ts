import { beforeEach, describe, expect, it, vi } from "vitest";
import { dateKey, timestamp } from "./domain";
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
const { useDiary, STORAGE_KEY } = await import("./store");
const add = (d: string, k: "wake" | "sleep" | "night", t: string) =>
  useDiary
    .getState()
    .addEvent(d, { kind: k, at: timestamp(d, t), comment: "" });
beforeEach(() => {
  memory.clear();
  useDiary.setState({ birthDate: "", days: {}, lastWake: null });
});
describe("журнал и сохранение", () => {
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
