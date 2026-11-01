import { describe, it, expect, vi } from "vitest";
import {
  ageLabel,
  ageMonths,
  ageInWeeks,
  dayStats,
  dayPeriodNotice,
  diaryText,
  duration,
  minutes,
  napSummary,
  napNumber,
  nightError,
  nightStats,
  sumDurations,
  timestamp,
  validateEvents,
} from "./domain";
import { compareRange, normsForAge, rangeDifference, nightRangeForAge, totalSleepRangeForAge } from "./norms";
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
  it("складывает промежутки с переносом минут и проверяет ввод", () => {
    expect(sumDurations([{ hours: "2", minutes: "45" }, { hours: "1", minutes: "00" }, { hours: "3", minutes: "54" }])).toBe(459);
    expect(sumDurations([{ hours: "", minutes: "59" }, { hours: "", minutes: "1" }])).toBe(60);
    expect(sumDurations([{ hours: "", minutes: "60" }])).toBeNull();
    expect(sumDurations([{ hours: "-1", minutes: "00" }])).toBeNull();
    expect(sumDurations([{ hours: "2", minutes: "45" }, { hours: "1", minutes: "50", operation: "-" }, { hours: "0", minutes: "30", operation: "+" }])).toBe(85);
    expect(sumDurations([{ hours: "0", minutes: "15" }, { hours: "1", minutes: "00", operation: "-" }])).toBe(-45);
    expect(sumDurations([{ hours: "1", minutes: "00" }, { hours: "1", minutes: "00", operation: "-" }])).toBe(0);
  });
  it("объединяет продления, сохраняя перерывы в суммарном бодрствовании", () => {
    const d: DayRecord = { ...day, events: [
      { id: "1", kind: "wake", at: at(day.date, "14:00"), comment: "" },
      { id: "2", kind: "sleep", at: at(day.date, "14:37"), comment: "" },
      { id: "3", kind: "wake", at: at(day.date, "15:16"), comment: "" },
      { id: "4", kind: "sleep", at: at(day.date, "15:44"), comment: "", continuation: true },
      { id: "5", kind: "wake", at: at(day.date, "15:58"), comment: "" },
      { id: "6", kind: "sleep", at: at(day.date, "16:08"), comment: "", continuation: true },
      { id: "7", kind: "wake", at: at(day.date, "16:13"), comment: "" },
      { id: "8", kind: "sleep", at: at(day.date, "17:00"), comment: "" },
      { id: "9", kind: "wake", at: at(day.date, "17:30"), comment: "" },
      { id: "10", kind: "night", at: at(day.date, "19:23"), comment: "" },
    ] };
    expect(validateEvents(d.events)).toBeNull();
    expect(napSummary(d.events, 4)).toEqual({ sleep: 53, awake: 28 });
    expect(napSummary(d.events, 6)).toEqual({ sleep: 58, awake: 38 });
    expect(napNumber(d.events, 7)).toBe(2);
    expect(dayStats(d)).toMatchObject({ sleep: 88, awake: 235, naps: 2 });
    expect(diaryText(d)).toContain("Итого сон 58 мин, перерыв 38 мин");
    expect(validateEvents([d.events[0], { ...d.events[1], continuation: true }])).toContain("предыдущий");
  });
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
  it("сравнивает ориентиры по возрасту на дату дня и учитывает число снов", () => {
    expect(ageMonths("2026-01-31", "2026-10-30")).toBe(8);
    expect(ageMonths("2026-01-31", "2026-10-31")).toBe(9);
    expect(normsForAge(7)).toBeUndefined();
    expect(normsForAge(19)).toBeUndefined();
    expect(compareRange(195, normsForAge(10)?.wakeRange)).toBe("within");
    expect(compareRange(194, normsForAge(10)?.wakeRange)).toBe("below");
    expect(compareRange(241, normsForAge(10)?.wakeRange)).toBe("above");
    expect(normsForAge(8)?.dayRange).toBeNull();
    expect(rangeDifference(270, [180, 240])).toBe(30);
    expect(rangeDifference(570, [600, 720])).toBe(30);
    expect(rangeDifference(600, [600, 720])).toBe(0);
    expect(nightRangeForAge(10)).toEqual([600, 720]);
    expect(nightRangeForAge(7)).toBeNull();
    expect(totalSleepRangeForAge(12)).toEqual([780, 840]);
    expect(totalSleepRangeForAge(13)).toEqual([720, 840]);
  });
  it("считает полные недели по календарным датам", () => {
    expect(ageInWeeks("2026-01-01", "2026-01-07")).toBe(0);
    expect(ageInWeeks("2026-01-01", "2026-01-08")).toBe(1);
    expect(ageInWeeks("2026-03-01", "2026-04-01")).toBe(4);
    expect(ageInWeeks("2026-10-01", "2026-09-30")).toBeNull();
  });
  it("объясняет сравнение с суточным ориентиром при иной длине периода", () => {
    const start = at("2026-10-23", "07:00");
    expect(dayPeriodNotice(start, at("2026-10-24", "07:00"))).toBeNull();
    expect(dayPeriodNotice(start, at("2026-10-24", "06:00"))).toContain("23 ч");
    expect(dayPeriodNotice(start, at("2026-10-24", "08:30"))).toContain("25 ч 30 мин");
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
