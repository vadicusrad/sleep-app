import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DayRecord, SleepEvent, NightRow } from "./domain";
import { uid, validateEvents, dateKey, nightError } from "./domain";

export const STORAGE_KEY = "quiet-hour-v1";
let initialIssue = "";
let blocked = false;
function notify(message: string) {
  initialIssue = message;
  window.dispatchEvent(new CustomEvent("storage-issue", { detail: message }));
}
export const storageIssue = () => initialIssue;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";
function validState(v: unknown): boolean {
  if (
    !object(v) ||
    !object(v.days) ||
    typeof v.birthDate !== "string" ||
    !(v.lastWake === null || typeof v.lastWake === "number")
  )
    return false;
  if (v.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(v.birthDate)) return false;
  return Object.entries(v.days).every(
    ([key, d]) =>
      object(d) &&
      d.date === key &&
      /^\d{4}-\d{2}-\d{2}$/.test(key) &&
      typeof d.note === "string" &&
      Array.isArray(d.events) &&
      d.events.every(
        (e) =>
          object(e) &&
          typeof e.id === "string" &&
          ["wake", "sleep", "night"].includes(String(e.kind)) &&
          typeof e.at === "number" &&
          Number.isFinite(e.at) &&
          typeof e.comment === "string" &&
          (e.plannedMinutes === undefined ||
            typeof e.plannedMinutes === "number"),
      ) &&
      object(d.night) &&
      typeof d.night.complete === "boolean" &&
      Array.isArray(d.night.rows) &&
      d.night.rows.every(
        (r) =>
          object(r) &&
          ["id", "start", "end", "comment"].every(
            (k) => typeof r[k] === "string",
          ),
      ),
  );
}
const storage = {
  getItem(name: string) {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      const data: unknown = JSON.parse(raw);
      if (!object(data) || data.version !== 1 || !validState(data.state))
        throw Error("format");
      return raw;
    } catch {
      blocked = true;
      notify(
        "Не удалось прочитать сохраненный дневник. Исходные данные сохранены; изменения сейчас остаются только в памяти.",
      );
      return null;
    }
  },
  setItem(name: string, value: string) {
    if (blocked) return;
    try {
      localStorage.setItem(name, value);
      if (initialIssue) {
        initialIssue = "";
        window.dispatchEvent(new CustomEvent("storage-issue", { detail: "" }));
      }
    } catch {
      notify(
        "Не удалось сохранить изменения на устройстве. Не закрывайте приложение, пока не освободите место или не разрешите хранение данных.",
      );
    }
  },
  removeItem(name: string) {
    if (!blocked) localStorage.removeItem(name);
  },
};
interface AppState {
  birthDate: string;
  lastWake: number | null;
  days: Record<string, DayRecord>;
  setBirth: (date: string) => void;
  addEvent: (date: string, event: Omit<SleepEvent, "id">) => string | null;
  editEvent: (
    date: string,
    id: string,
    patch: Partial<SleepEvent>,
  ) => string | null;
  undoEvent: (date: string) => string | null;
  setPlan: (date: string, id: string, value: number) => void;
  setNote: (date: string, note: string) => void;
  draftNight: (date: string, rows: NightRow[]) => void;
  completeNight: (date: string) => string | null;
}
const blank = (date: string): DayRecord => ({
  date,
  events: [],
  note: "",
  night: { rows: [], complete: false },
});
export const useDiary = create<AppState>()(
  persist(
    (set, get) => ({
      birthDate: "",
      lastWake: null,
      days: {},
      setBirth: (birthDate) => set({ birthDate }),
      addEvent: (date, event) => {
        const day = get().days[date] ?? blank(date),
          events = [...day.events, { ...event, id: uid() }];
        const error = validateEvents(events);
        if (error) return error;
        if (dateKey(new Date(events[0].at)) !== date)
          return "Утренний подъем должен относиться к выбранному дню.";
        const others = Object.values(get().days).filter((d) => d.events.length);
        const previous = others
          .filter((d) => d.date < date)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        if (!day.events.length && previous) {
          const last = previous.events.at(-1)!;
          if (last.kind !== "night")
            return "Сначала завершите предыдущий день: отметьте «Уснул на ночь» в истории.";
          if (last.at >= event.at)
            return "Подъем должен быть позже начала предыдущей ночи.";
          if (
            previous.night.complete &&
            new Date(previous.night.rows.at(-1)!.end).getTime() !== event.at
          )
            return "Подъем не совпадает с концом заполненной ночи. Проверьте предыдущую ночь.";
        }
        const following = others
          .filter((d) => d.date > date)
          .sort((a, b) => a.date.localeCompare(b.date))[0];
        if (following && event.at >= following.events[0].at)
          return "Событие должно быть раньше следующего утреннего подъема.";
        set({ days: { ...get().days, [date]: { ...day, events } } });
        return null;
      },
      editEvent: (date, id, patch) => {
        const day = get().days[date];
        if (!day) return "День не найден.";
        const events = day.events.map((e) =>
          e.id === id ? { ...e, ...patch, id: e.id, kind: e.kind } : e,
        );
        const error = validateEvents(events);
        if (error) return error;
        if (dateKey(new Date(events[0].at)) !== date)
          return "Утренний подъем должен относиться к выбранному дню.";
        const all = Object.values(get().days)
          .filter((d) => d.events.length)
          .sort((a, b) => a.date.localeCompare(b.date));
        const index = all.findIndex((d) => d.date === date);
        const prev = all[index - 1],
          next = all[index + 1];
        if (prev && events[0].at <= prev.events.at(-1)!.at)
          return "Подъем должен быть позже предыдущего дня.";
        if (next && events.at(-1)!.at >= next.events[0].at)
          return "Событие должно быть раньше следующего дня.";
        const changedTime =
          patch.at !== undefined &&
          patch.at !== day.events.find((e) => e.id === id)?.at;
        const days = {
          ...get().days,
          [date]: {
            ...day,
            events,
            night: {
              ...day.night,
              complete: changedTime ? false : day.night.complete,
            },
          },
        };
        if (prev && events[0].at !== day.events[0].at)
          days[prev.date] = {
            ...prev,
            night: { ...prev.night, complete: false },
          };
        set({ days });
        return null;
      },
      undoEvent: (date) => {
        const day = get().days[date];
        if (!day) return "День не найден.";
        const following = Object.values(get().days).some(
          (d) => d.date > date && d.events.length,
        );
        if (
          following &&
          (day.events.length === 1 || day.events.at(-1)?.kind === "night")
        )
          return "Уже начат следующий день. Время можно изменить в записи; отменить его сейчас нельзя.";
        const days = {
          ...get().days,
          [date]: {
            ...day,
            events: day.events.slice(0, -1),
            night: { ...day.night, complete: false },
          },
        };
        const previous = Object.values(days)
          .filter((d) => d.date < date && d.events.length)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        if (day.events.length === 1 && previous)
          days[previous.date] = {
            ...previous,
            night: { ...previous.night, complete: false },
          };
        set({ days });
        return null;
      },
      setPlan: (date, id, value) => {
        const day = get().days[date];
        if (!day) return;
        set({
          lastWake: value,
          days: {
            ...get().days,
            [date]: {
              ...day,
              events: day.events.map((e) =>
                e.id === id ? { ...e, plannedMinutes: value } : e,
              ),
            },
          },
        });
      },
      setNote: (date, note) =>
        set({
          days: {
            ...get().days,
            [date]: { ...(get().days[date] ?? blank(date)), note },
          },
        }),
      draftNight: (date, rows) => {
        const day = get().days[date];
        if (day) {
          const sameTimes =
            rows.length === day.night.rows.length &&
            rows.every(
              (r, i) =>
                r.id === day.night.rows[i].id &&
                r.start === day.night.rows[i].start &&
                r.end === day.night.rows[i].end,
            );
          set({
            days: {
              ...get().days,
              [date]: {
                ...day,
                night: { rows, complete: sameTimes && day.night.complete },
              },
            },
          });
        }
      },
      completeNight: (date) => {
        const day = get().days[date];
        if (!day?.events.length) return "Сначала заполните дневные события.";
        const next = Object.values(get().days)
          .filter((d) => d.date > date && d.events.length)
          .sort((a, b) => a.date.localeCompare(b.date))[0];
        const last = day.events.at(-1)!;
        if (last.kind !== "night")
          return "Сначала отметьте «Уснул на ночь» в дневнике этого дня.";
        const err = nightError(day.night.rows, last.at, next?.events[0].at);
        if (err) return err;
        const end = new Date(day.night.rows.at(-1)!.end).getTime();
        const endDate = dateKey(new Date(end));
        if (endDate <= date)
          return "Утренний подъем должен относиться к следующей дате.";
        if (
          endDate !== dateKey(new Date(last.at)) &&
          endDate > dateKey(new Date(last.at + 86400000))
        )
          return "Проверьте дату: ночь не должна растягиваться на несколько дней.";
        const days = {
          ...get().days,
          [date]: { ...day, night: { ...day.night, complete: true } },
        };
        if (!next) {
          const existing = days[endDate] ?? blank(endDate);
          days[endDate] = {
            ...existing,
            events: [{ id: uid(), kind: "wake", at: end, comment: "" }],
          };
        }
        set({ days });
        return null;
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => storage),
      partialize: (s) => ({
        birthDate: s.birthDate,
        lastWake: s.lastWake,
        days: s.days,
      }),
    },
  ),
);
