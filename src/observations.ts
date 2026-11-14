export const sleepPlaces = {
  crib: "В кроватке",
  stroller: "В коляске",
  arms: "На руках",
  other: "В другом месте",
} as const;

export const wakeMoods = {
  calm: "Спокойно",
  upset: "Расстроился",
} as const;

export const resettleMethods = {
  self: "Сам уснул снова",
  helped: "Помогли уснуть",
} as const;

export const dayContexts = {
  walk: "Прогулка",
  massage: "Массаж",
  illness: "Недомогание",
  guests: "Гости",
  trip: "Поездка",
} as const;

export type SleepPlace = keyof typeof sleepPlaces;
export type WakeMood = keyof typeof wakeMoods;
export type ResettleMethod = keyof typeof resettleMethods;
export type DayContext = keyof typeof dayContexts;
export type NightHelp = { count: number; approximate: boolean };

export function isChoice<T extends string>(options: Record<T, string>, value: unknown): value is T {
  return typeof value === "string" && Object.hasOwn(options, value);
}

export function formatNightHelp(help: NightHelp) {
  return `${help.approximate ? "≈ " : ""}${help.count}`;
}
