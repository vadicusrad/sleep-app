import { expect, it } from "vitest";
import { timestamp } from "./domain";
import type { DayRecord, SleepEvent } from "./domain";
import { analyzeDay } from "./sleepAnalysis";

const date = "2026-11-05";
function event(kind: SleepEvent["kind"], time: string, continuation?: boolean): SleepEvent {
  return { id: time, kind, at: timestamp(date, time), comment: "", continuation };
}

it("separates the first nap segment, resettled sleep and gaps on a common clock axis", () => {
  const day: DayRecord = {
    date,
    events: [
      event("wake", "07:05"), event("sleep", "10:15"), event("wake", "10:57"),
      event("sleep", "11:01", true), event("wake", "11:40"), event("night", "19:00"),
    ],
    note: "",
    night: { complete: true, rows: [
      { id: "first", start: `${date}T19:00`, end: "2026-11-06T02:15", comment: "" },
      { id: "second", start: "2026-11-06T02:20", end: "2026-11-06T06:00", comment: "" },
    ] },
  };
  const result = analyzeDay(day);
  expect(result.naps).toHaveLength(1);
  expect(result.naps[0]).toMatchObject({ awakeBefore: 190, firstSleep: 42, resumed: 39, gap: 4, total: 81 });
  expect(result.night).toMatchObject({ sleep: 655, awake: 5 });
  expect(result.intervals.map(({ kind, start, end }) => [kind, start, end])).toEqual([
    ["nap", 615, 657], ["resumed", 661, 700], ["night", 1140, 1575], ["night", 1580, 1800],
  ]);
  expect(result.nextWake).toBe("06:00");
  expect(result.awakeBeforeNight).toBe(440);

  day.events = day.events.slice(0, 4);
  day.night.complete = false;
  const incomplete = analyzeDay(day);
  expect(incomplete.dayComplete).toBe(false);
  expect(incomplete.naps[0]).toMatchObject({ total: 42, resumed: 0, gap: 4, openPart: day.events[3] });
  expect(incomplete.night).toBeNull();
  expect(incomplete.intervals).toHaveLength(1);
});
