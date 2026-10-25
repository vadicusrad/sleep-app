import { describe, it, expect, vi } from "vitest";
import {
  ageLabel,
  dayStats,
  diaryText,
  duration,
  minutes,
  nightError,
  nightStats,
  timestamp,
  validateEvents,
} from "./domain";
import type { DayRecord, NightRow } from "./domain";

vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date(2026, 9, 25, 12));
const at = (date: string, time: string) => timestamp(date, time);
const rows: NightRow[] = [
  { id: "1", start: "2026-10-23T21:00", end: "2026-10-24T00:00", comment: "" },
  {
    id: "2",
    start: "2026-10-24T01:00",
    end: "2026-10-24T03:00",
    comment: "После кормления",
  },
  { id: "3", start: "2026-10-24T03:15", end: "2026-10-24T06:00", comment: "" },
];
const day: DayRecord = {
  date: "2026-10-23",
  note: "Прививка",
  events: [
    {
      id: "1",
      kind: "wake",
      at: at("2026-10-23", "06:50"),
      comment: "",
      plannedMinutes: 195,
    },
    {
      id: "2",
      kind: "sleep",
      at: at("2026-10-23", "10:15"),
      comment: "Засыпал 15 минут",
    },
    { id: "3", kind: "wake", at: at("2026-10-23", "11:35"), comment: "" },
    { id: "4", kind: "sleep", at: at("2026-10-23", "14:30"), comment: "" },
    { id: "5", kind: "wake", at: at("2026-10-23", "15:35"), comment: "" },
    { id: "6", kind: "night", at: at("2026-10-23", "21:00"), comment: "" },
  ],
  night: { rows, complete: true },
};
describe("время и фактические итоги", () => {
  it("рассчитывает ближайший сон и отличает реальное ВБ", () => {
    expect(duration(195)).toBe("3 ч 15 мин");
    expect(new Date(at("2026-10-23", "06:50") + 195 * 60000).getHours()).toBe(
      10,
    );
    expect(minutes(day.events[0].at, day.events[1].at)).toBe(205);
  });
  it("считает СДС и завершенное ВБ, исключая ночь", () => {
    const result = dayStats(day);
    expect(result.sleep).toBe(145);
    expect(result.awake).toBe(705);
    expect(result.naps).toBe(2);
    expect(result.night).toBe(465);
    expect(result.sleep + result.night).toBe(610);
  });
  it("считает чистый ночной сон и бодрствование", () =>
    expect(nightStats(rows)).toEqual({ sleep: 465, awake: 75, span: 540 }));
  it("правильно считает переход через полночь", () =>
    expect(minutes(at("2026-10-23", "21:10"), at("2026-10-24", "02:00"))).toBe(
      290,
    ));
  it("выявляет пересекающиеся интервалы", () =>
    expect(
      nightError([rows[0], { ...rows[1], start: "2026-10-23T23:30" }]),
    ).toContain("пересекается"));
  it("не считает одинаковые время и дату сутками сна", () =>
    expect(nightError([{ ...rows[0], end: rows[0].start }])).toContain(
      "позже",
    ));
  it("требует закончить все интервалы и сверяет подъем", () => {
    expect(nightError([{ ...rows[0], end: "" }])).toContain("оба");
    expect(
      nightError(rows, day.events.at(-1)!.at, at("2026-10-24", "06:10")),
    ).toContain("подъемом");
  });
  it("проверяет чередование событий и хронологию", () => {
    expect(validateEvents(day.events, at("2026-10-25", "12:00"))).toBeNull();
    expect(
      validateEvents([day.events[0], { ...day.events[1], kind: "wake" }]),
    ).toContain("После");
    expect(
      validateEvents([
        day.events[0],
        { ...day.events[1], at: day.events[0].at },
      ]),
    ).toContain("позже");
  });
  it("восстанавливает текущую длительность по отметке", () => {
    const d = { ...day, events: day.events.slice(0, 2), date: "2026-10-23" };
    expect(dayStats(d, at("2026-10-23", "10:57")).sleep).toBe(42);
  });
  it("считает календарный возраст на границе месяца", () => {
    expect(ageLabel("2026-01-31", "2026-02-28")).toBe("1 мес.");
    expect(ageLabel("2026-01-31", "2026-03-01")).toBe("1 мес. 1 дн.");
    expect(ageLabel("2026-10-01", "2026-09-30")).toBe("");
  });
  it("копирует факты и комментарии, без выдуманной полной ночи", () => {
    const next = {
      ...day,
      date: "2026-10-24",
      events: [{ ...day.events[0], at: at("2026-10-24", "06:00") }],
    };
    const text = diaryText(day, next);
    expect(text).toContain("10 ч 10 мин");
    expect(text).toContain("Прививка");
    expect(text).toContain("После кормления");
    expect(text).toContain("Засыпал 15 минут");
    expect(
      diaryText({ ...day, night: { rows: [], complete: false } }),
    ).toContain("Ночь не заполнена");
  });
});
