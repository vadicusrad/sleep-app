import { localDateTime, minutes, nightStats, timeInput } from "./domain";
import type { DayRecord, SleepEvent } from "./domain";

export type SleepInterval = { start: number; end: number; kind: "nap" | "resumed" | "night" };
type Nap = {
  start: SleepEvent;
  awakeBefore: number;
  parts: { start: SleepEvent; end: SleepEvent }[];
  openPart?: SleepEvent;
};

function localMinute(date: string, dateTime: string) {
  const midnight = Date.parse(`${date}T00:00:00Z`);
  const day = Date.parse(`${dateTime.slice(0, 10)}T00:00:00Z`);
  return (day - midnight) / 60000 + Number(dateTime.slice(11, 13)) * 60 + Number(dateTime.slice(14, 16));
}

export function analyzeDay(day: DayRecord) {
  const naps: Nap[] = [];
  const intervals: SleepInterval[] = [];
  const toMinute = (at: number) => localMinute(day.date, localDateTime(at));
  for (const [index, event] of day.events.entries()) {
    if (event.kind !== "sleep") continue;
    if (!event.continuation || !naps.length) {
      naps.push({
        start: event, awakeBefore: minutes(day.events[index - 1]?.at ?? event.at, event.at),
        parts: [],
      });
    }
    const nap = naps.at(-1)!;
    const wake = day.events[index + 1];
    if (wake?.kind === "wake") {
      nap.parts.push({ start: event, end: wake });
      intervals.push({ start: toMinute(event.at), end: toMinute(wake.at), kind: event.continuation ? "resumed" : "nap" });
    } else {
      nap.openPart = event;
    }
  }
  const last = day.events.at(-1);
  const dayComplete = last?.kind === "night";
  const night = day.night.complete ? nightStats(day.night.rows) : null;
  if (night) {
    for (const row of day.night.rows) {
      intervals.push({ start: localMinute(day.date, row.start), end: localMinute(day.date, row.end), kind: "night" });
    }
  }
  const napStats = naps.map((nap) => {
    const first = nap.parts[0];
    const last = nap.parts.at(-1);
    const total = nap.parts.reduce((sum, part) => sum + minutes(part.start.at, part.end.at), 0);
    const firstSleep = first ? minutes(first.start.at, first.end.at) : null;
    const gap = nap.parts.slice(1).reduce((sum, part, index) => sum + minutes(nap.parts[index].end.at, part.start.at), 0);
    return {
      ...nap, firstSleep, total,
      resumed: firstSleep === null ? null : total - firstSleep,
      gap: nap.openPart && last ? gap + minutes(last.end.at, nap.openPart.at) : gap,
      finalWake: nap.openPart ? undefined : last?.end,
    };
  });
  const daySleep = napStats.reduce((sum, nap) => sum + nap.total, 0);
  return {
    day, naps: napStats, intervals, daySleep, dayComplete, night,
    start: day.events[0] && toMinute(day.events[0].at),
    end: Math.max(last ? toMinute(last.at) : 0, intervals.at(-1)?.end ?? 0),
    bedtime: dayComplete ? last.at : undefined,
    awakeBeforeNight: dayComplete && day.events.at(-2)?.kind === "wake"
      ? minutes(day.events.at(-2)!.at, last.at)
      : null,
    nextWake: night ? day.night.rows.at(-1)?.end.slice(11, 16) : undefined,
  };
}

export function clockLabel(value: number) {
  const minute = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function eventClock(event?: SleepEvent) {
  return event ? timeInput(event.at) : "—";
}
