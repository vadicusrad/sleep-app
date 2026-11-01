export const norms = [
  {
    age: "8 месяцев",
    ageMin: 8, ageMax: 8, wakeRange: [180, 240], napRange: [60, 90], dayRange: null, awakeRange: [540, 660],
    naps: "2",
    nap: "1–1,5 ч",
    day: "3 ч",
    night: "10–12 ч",
    total: "13–15 ч",
    wake: "3–4 ч",
    awake: "9–11 ч",
  },
  {
    age: "9 месяцев",
    ageMin: 9, ageMax: 9, wakeRange: [180, 240], napRange: [60, 90], dayRange: [120, 180], awakeRange: [540, 660],
    naps: "2",
    nap: "1–1,5 ч",
    day: "2–3 ч",
    night: "10–12 ч",
    total: "13–15 ч",
    wake: "3–4 ч",
    awake: "9–11 ч",
  },
  {
    age: "10 месяцев",
    ageMin: 10, ageMax: 10, wakeRange: [195, 240], napRange: [60, 90], dayRange: [120, 150], awakeRange: [540, 660],
    naps: "2",
    nap: "1–1,5 ч",
    day: "2–2,5 ч",
    night: "10–12 ч",
    total: "13–15 ч",
    wake: "3 ч 15 мин – 4 ч",
    awake: "9–11 ч",
  },
  {
    age: "11 месяцев",
    ageMin: 11, ageMax: 11, wakeRange: [210, 270], napRange: [60, 90], dayRange: [120, 150], awakeRange: [600, 660],
    naps: "2",
    nap: "1–1,5 ч",
    day: "2–2,5 ч",
    night: "10–12 ч",
    total: "13–14 ч",
    wake: "3,5–4,5 ч",
    awake: "10–11 ч",
  },
  {
    age: "12 месяцев",
    ageMin: 12, ageMax: 12, wakeRange: [210, 270], napRange: [40, 80], dayRange: null, awakeRange: [600, 660],
    naps: "1–2, чаще 2",
    nap: "40 мин – 1 ч 20 мин",
    day: "2 ч*",
    night: "10–12 ч",
    total: "13–14 ч",
    wake: "3,5–4,5 ч",
    awake: "10–11 ч",
  },
  {
    age: "13–15 месяцев",
    ageMin: 13, ageMax: 15, wakeRange: [210, 360], napRange: null, dayRange: null, awakeRange: [600, 720],
    naps: "2 → 1",
    nap: "2 сна: 40 мин – 1 ч 20 мин; 1 сон: 1,5–2 ч",
    day: "Не указан",
    night: "10–12 ч",
    total: "12–14 ч",
    wake: "3,5–6 ч",
    awake: "10–12 ч",
  },
  {
    age: "16–18 месяцев",
    ageMin: 16, ageMax: 18, wakeRange: [300, 360], napRange: [90, 120], dayRange: [90, 120], awakeRange: [600, 720],
    naps: "1",
    nap: "1,5–2 ч",
    day: "1,5–2 ч**",
    night: "10–12 ч",
    total: "12–14 ч",
    wake: "5–6 ч",
    awake: "10–12 ч",
  },
];

export function normsForAge(months: number | null) {
  if (months === null) return undefined;
  return norms.find((row) => months >= row.ageMin && months <= row.ageMax);
}
export function compareRange(value: number, range?: number[] | null) {
  if (!range) return null;
  return value < range[0] ? "below" : value > range[1] ? "above" : "within";
}
export function rangeDifference(value: number, range: number[]): number {
  return value < range[0] ? range[0] - value : value > range[1] ? value - range[1] : 0;
}
export function nightRangeForAge(months: number | null): number[] | null {
  return normsForAge(months) ? [600, 720] : null;
}
export function totalSleepRangeForAge(months: number | null): number[] | null {
  if (months === null || months < 8 || months > 18) return null;
  return months <= 10 ? [780, 900] : months <= 12 ? [780, 840] : [720, 840];
}
