export type EventKind = "wake" | "sleep" | "night";
export interface SleepEvent {
  id: string;
  kind: EventKind;
  at: number;
  comment: string;
  plannedMinutes?: number;
}
export interface NightRow {
  id: string;
  start: string;
  end: string;
  comment: string;
}
export interface DayRecord {
  date: string;
  events: SleepEvent[];
  note: string;
  night: { rows: NightRow[]; complete: boolean };
}
export const uid = () => crypto.randomUUID();
export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function shiftDate(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
export const timeInput = (at = Date.now()) =>
  new Date(at).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
export const timestamp = (date: string, time: string) =>
  new Date(`${date}T${time}:00`).getTime();
export const localDateTime = (at: number) =>
  `${dateKey(new Date(at))}T${timeInput(at)}`;
export const minutes = (start: number, end: number) =>
  Math.max(0, Math.floor((end - start) / 60000));
export function duration(value: number) {
  const m = Math.max(0, Math.floor(value));
  return m >= 60
    ? `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ""}`
    : `${m} мин`;
}
export function dateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", options);
}
export function ageLabel(birth: string, on = dateKey()) {
  if (!birth || birth > on) return "";
  const b = new Date(`${birth}T12:00:00`),
    d = new Date(`${on}T12:00:00`);
  let months =
    (d.getFullYear() - b.getFullYear()) * 12 + d.getMonth() - b.getMonth();
  const anniversary = (m: number) => {
    const year = b.getFullYear() + Math.floor((b.getMonth() + m) / 12);
    const month = (b.getMonth() + m) % 12;
    return new Date(
      year,
      month,
      Math.min(b.getDate(), new Date(year, month + 1, 0).getDate()),
      12,
    );
  };
  if (anniversary(months) > d) months--;
  const days = Math.round(
    (d.getTime() - anniversary(months).getTime()) / 86400000,
  );
  return `${months} мес.${days ? ` ${days} дн.` : ""}`;
}
export function validateEvents(
  events: SleepEvent[],
  now = Date.now(),
): string | null {
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!Number.isFinite(e.at)) return "Укажите корректное время.";
    if (e.at > now + 60000)
      return "Фактическое событие не может быть в будущем.";
    if (i === 0 && e.kind !== "wake")
      return "Начните день с утреннего подъема.";
    if (i && e.at <= events[i - 1].at)
      return "Событие должно быть позже предыдущего. Проверьте время.";
    if (
      i &&
      (events[i - 1].kind === "night" ||
        (events[i - 1].kind === "sleep"
          ? e.kind !== "wake"
          : e.kind === "wake"))
    )
      return "После сна нужно отметить пробуждение, а после пробуждения — сон.";
  }
  return null;
}
export function nightError(
  rows: NightRow[],
  start?: number,
  end?: number,
): string | null {
  if (!rows.length) return "Добавьте хотя бы один интервал сна.";
  let previousEnd: number | undefined;
  for (let i = 0; i < rows.length; i++) {
    const a = new Date(rows[i].start).getTime(),
      b = new Date(rows[i].end).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b))
      return `Заполните оба времени в интервале ${i + 1}.`;
    if (b <= a)
      return `В интервале ${i + 1} пробуждение должно быть позже засыпания. Проверьте дату.`;
    if (b > Date.now() + 60000)
      return "Ночь заполняется по факту: время не может быть в будущем.";
    if (previousEnd !== undefined && a < previousEnd)
      return `Интервал ${i + 1} пересекается с предыдущим.`;
    if (start !== undefined && a < start)
      return "Ночной сон не может начаться раньше отметки «Уснул на ночь».";
    if (end !== undefined && b > end)
      return "Интервал заканчивается позже утреннего подъема. Проверьте время.";
    previousEnd = b;
  }
  if (start !== undefined && new Date(rows[0].start).getTime() !== start)
    return "Начало первого интервала должно совпадать с отметкой «Уснул на ночь». Исправьте интервал или вечернее событие.";
  if (end !== undefined && new Date(rows.at(-1)!.end).getTime() !== end)
    return "Последнее пробуждение должно совпадать с утренним подъемом. Исправьте интервал или подъем.";
  return null;
}
export function nightStats(rows: NightRow[]) {
  const valid = rows.filter(
    (r) =>
      r.start &&
      r.end &&
      new Date(r.end).getTime() > new Date(r.start).getTime(),
  );
  const sleep = valid.reduce(
    (sum, r) =>
      sum + minutes(new Date(r.start).getTime(), new Date(r.end).getTime()),
    0,
  );
  const span = valid.length
    ? minutes(
        new Date(valid[0].start).getTime(),
        new Date(valid.at(-1)!.end).getTime(),
      )
    : 0;
  return { sleep, awake: Math.max(0, span - sleep), span };
}
export function dayStats(day?: DayRecord, now = Date.now()) {
  let sleep = 0,
    awake = 0,
    naps = 0;
  if (day)
    for (let i = 0; i < day.events.length; i++) {
      const e = day.events[i],
        next = day.events[i + 1];
      if (e.kind === "night") break;
      const end = next?.at ?? now;
      if (e.kind === "sleep") {
        sleep += minutes(e.at, end);
        naps++;
      } else awake += minutes(e.at, end);
    }
  return {
    sleep,
    awake,
    naps,
    night: day ? nightStats(day.night.rows).sleep : 0,
  };
}
export function diaryText(day: DayRecord, next?: DayRecord) {
  const stats = dayStats(day),
    lines = [
      `Дата: ${dateLabel(day.date, { day: "2-digit", month: "2-digit", year: "numeric" })}`,
      "",
      "Днем:",
    ];
  day.events.forEach((e, i) => {
    const prev = day.events[i - 1];
    if (prev?.kind === "wake")
      lines.push(`ВБ ${duration(minutes(prev.at, e.at))}`);
    const nap =
      e.kind === "sleep"
        ? day.events.slice(0, i + 1).filter((x) => x.kind === "sleep").length
        : 0;
    lines.push(
      `${e.kind === "night" ? "НС" : e.kind === "sleep" ? `${nap} ДС — уснул` : i === 0 ? "Подъем" : "Проснулся"} ${timeInput(e.at)}${e.kind === "wake" && prev?.kind === "sleep" ? ` (сон ${duration(minutes(prev.at, e.at))})` : ""}${e.comment ? ` — ${e.comment}` : ""}`,
    );
  });
  lines.push(
    `СДС ${duration(stats.sleep)}`,
    `Суммарное дневное ВБ ${duration(stats.awake)}`,
    "",
    "Ночью:",
  );
  if (!day.night.complete)
    lines.push(
      day.night.rows.length
        ? "Черновик: ночь заполнена не полностью"
        : "Ночь не заполнена",
    );
  day.night.rows.forEach((r) =>
    lines.push(
      `${r.start ? timeInput(new Date(r.start).getTime()) : "…"}–${r.end ? timeInput(new Date(r.end).getTime()) : "…"}${r.start && r.end ? ` (${duration(minutes(new Date(r.start).getTime(), new Date(r.end).getTime()))})` : ""}${r.comment ? ` — ${r.comment}` : ""}`,
    ),
  );
  if (day.night.complete) lines.push(`Фактический НС ${duration(stats.night)}`);
  if (next?.events[0])
    lines.push(`Следующий подъем ${timeInput(next.events[0].at)}`);
  lines.push(
    day.night.complete && next
      ? `Сон за сутки ${duration(stats.sleep + stats.night)}`
      : "Суточный итог пока неполный",
  );
  if (day.note) lines.push("", `Заметка дня: ${day.note}`);
  return lines.join("\n");
}
