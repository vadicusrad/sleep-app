import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { NavLink, Link, Route, Routes, useLocation } from "react-router";
import { registerSW } from "virtual:pwa-register";
import { Icon } from "./components/Icon";
import { useDiary, storageIssue } from "./store";
import {
  ageLabel,
  dateKey,
  dateLabel,
  dayStats,
  diaryText,
  duration,
  localDateTime,
  minutes,
  nightStats,
  shiftDate,
  timeInput,
  timestamp,
  uid,
} from "./domain";
import type { DayRecord, EventKind, NightRow, SleepEvent } from "./domain";
import { norms } from "./norms";
import s from "./App.module.css";

const nav = [
  { to: "/", label: "Сегодня", icon: "sun" },
  { to: "/history", label: "История", icon: "history" },
  { to: "/norms", label: "Нормы сна", icon: "book" },
  { to: "/settings", label: "Настройки", icon: "settings" },
] as const;
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 1000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}
function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={s.modal}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={s.modalHead}>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button className={s.iconButton} onClick={onClose} aria-label="Закрыть">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function ErrorText({ message }: { message: string }) {
  return message ? (
    <p role="alert" className={s.error}>
      {message}
    </p>
  ) : null;
}
function Toast({ text }: { text: string }) {
  return text ? (
    <div className={s.toast} role="status">
      <Icon name="check" />
      {text}
    </div>
  ) : null;
}
function CloudArt() {
  return (
    <svg className={s.art} viewBox="0 0 260 180" fill="none" aria-hidden="true">
      <circle cx="157" cy="76" r="39" fill="#e9b373" />
      <circle
        cx="157"
        cy="76"
        r="55"
        stroke="#e9b373"
        strokeOpacity=".3"
        strokeDasharray="2 8"
      />
      <path
        d="M40 122c-1-19 13-32 31-30 6-32 53-38 67-9 24-3 42 13 39 37 19 1 29 13 26 27H27c-5-13 0-22 13-25Z"
        fill="#fff"
        fillOpacity=".87"
      />
      <path
        d="M118 148c2-16 13-25 29-22 3-23 37-29 48-7 17-2 32 9 30 26 13 0 20 8 18 18H108c-3-7 1-13 10-15Z"
        fill="#dce5d9"
      />
      <path
        d="m49 48 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Zm163-13 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"
        fill="#b5c3a5"
      />
    </svg>
  );
}

function EventForm({
  date,
  event,
  kind,
  onClose,
  onSaved,
}: {
  date: string;
  event?: SleepEvent;
  kind: EventKind;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [time, setTime] = useState(timeInput(event?.at));
  const [eventDate, setEventDate] = useState(
    event ? dateKey(new Date(event.at)) : date,
  );
  const [comment, setComment] = useState(event?.comment ?? "");
  const [error, setError] = useState("");
  const add = useDiary((x) => x.addEvent),
    edit = useDiary((x) => x.editEvent);
  const title =
    kind === "night"
      ? "Уснул на ночь"
      : kind === "sleep"
        ? "Малыш уснул"
        : "Малыш проснулся";
  function submit(e: FormEvent) {
    e.preventDefault();
    const at = timestamp(eventDate, time);
    const err = event
      ? edit(date, event.id, { at, comment })
      : add(date, { kind, at, comment });
    if (err) setError(err);
    else {
      onSaved();
      onClose();
    }
  }
  return (
    <Modal
      title={event ? "Изменить событие" : title}
      description="Укажите фактическое время. Его всегда можно поправить."
      onClose={onClose}
    >
      <form onSubmit={submit} className={s.form}>
        <div className={s.twoFields}>
          <label>
            Дата
            <input
              type="date"
              required
              value={eventDate}
              min={date}
              max={shiftDate(date, 1)}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </label>
          <label>
            Время
            <input
              autoFocus
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        </div>
        <label>
          Комментарий <span className={s.optional}>необязательно</span>
          <textarea
            placeholder="Как прошло засыпание? Какое настроение?"
            rows={3}
            maxLength={1500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <ErrorText message={error} />
        <button className={s.primary} type="submit">
          <Icon name="check" />
          Сохранить событие
        </button>
      </form>
    </Modal>
  );
}
function NoteModal({ date, onClose }: { date: string; onClose: () => void }) {
  const note = useDiary((x) => x.days[date]?.note ?? "");
  const set = useDiary((x) => x.setNote);
  return (
    <Modal title="Заметка дня" description={dateLabel(date)} onClose={onClose}>
      <div className={s.form}>
        <textarea
          autoFocus
          rows={5}
          value={note}
          maxLength={3000}
          placeholder="Например, была прививка или много впечатлений…"
          onChange={(e) => set(date, e.target.value)}
        />
        <p className={s.small}>Сохраняется автоматически на этом устройстве.</p>
        <button className={s.primary} onClick={onClose}>
          Готово
        </button>
      </div>
    </Modal>
  );
}
function PlanForm({ day, last }: { day: DayRecord; last: SleepEvent }) {
  const previous = useDiary((x) => x.lastWake),
    save = useDiary((x) => x.setPlan);
  const value = last.plannedMinutes ?? previous ?? 180;
  const [hours, setHours] = useState(
    last.plannedMinutes !== undefined || previous !== null
      ? String(Math.floor(value / 60))
      : "",
  );
  const [mins, setMins] = useState(
    last.plannedMinutes !== undefined || previous !== null
      ? String(value % 60)
      : "0",
  );
  const [editing, setEditing] = useState(false);
  const now = useNow();
  const planned = last.plannedMinutes;
  const target = planned !== undefined ? last.at + planned * 60000 : null;
  if (target !== null && !editing)
    return (
      <div className={s.planResult}>
        <div className={s.resultIcon}>
          <Icon name="moon" size={24} />
        </div>
        <div>
          <span className={s.eyebrow}>СЛЕДУЮЩИЙ СОН</span>
          <strong>{timeInput(target)}</strong>
          <p>
            {target > now
              ? `Примерно через ${duration(minutes(now, target))}`
              : `Плановое время ${duration(minutes(target, now))} назад`}
          </p>
        </div>
        <button
          className={s.iconButton}
          aria-label="Изменить следующее ВБ"
          onClick={() => setEditing(true)}
        >
          <Icon name="edit" />
        </button>
      </div>
    );
  return (
    <form
      className={s.planForm}
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(hours) * 60 + Number(mins);
        if (n > 0 && n <= 1440) {
          save(day.date, last.id, n);
          setEditing(false);
        }
      }}
    >
      <div>
        <h3>Сколько бодрствуем дальше?</h3>
        <p>
          {previous !== null
            ? "Подставили последнее ВБ. Подтвердите или измените."
            : "Выберите ВБ — мы рассчитаем ближайший сон."}
        </p>
      </div>
      <div className={s.durationFields}>
        <label>
          <input
            aria-label="Часы бодрствования"
            type="number"
            min="0"
            max="23"
            placeholder="3"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          ч
        </label>
        <label>
          <input
            aria-label="Минуты бодрствования"
            type="number"
            min="0"
            max="59"
            placeholder="00"
            value={mins}
            onChange={(e) => setMins(e.target.value)}
          />
          мин
        </label>
        <button
          className={s.primary}
          aria-label="Рассчитать следующий сон"
          disabled={Number(hours) * 60 + Number(mins) <= 0}
        >
          <Icon name="arrow" />
        </button>
      </div>
      {Number(hours) * 60 + Number(mins) > 0 && (
        <p className={s.planPreview}>
          Следующий сон в{" "}
          <b>
            {timeInput(last.at + (Number(hours) * 60 + Number(mins)) * 60000)}
          </b>
        </p>
      )}
    </form>
  );
}

function NightEditor({
  day,
  next,
  onClose,
  onSaved,
}: {
  day: DayRecord;
  next?: DayRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const draft = useDiary((x) => x.draftNight),
    complete = useDiary((x) => x.completeNight);
  const live = useDiary((x) => x.days[day.date]);
  const rows = live.night.rows;
  const [error, setError] = useState("");
  const nightStart = day.events.find((e) => e.kind === "night")?.at;
  useEffect(() => {
    if (!day.night.rows.length) {
      draft(day.date, [
        {
          id: uid(),
          start: nightStart ? localDateTime(nightStart) : "",
          end: next?.events[0] ? localDateTime(next.events[0].at) : "",
          comment: "",
        },
      ]);
    }
  }, []);
  const stats = nightStats(rows);
  function update(id: string, patch: Partial<NightRow>) {
    draft(
      day.date,
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    setError("");
  }
  function timeChange(row: NightRow, field: "start" | "end", time: string) {
    if (!time) {
      update(row.id, { [field]: "" });
      return;
    }
    const base =
      field === "start"
        ? row.start ||
          rows[rows.findIndex((r) => r.id === row.id) - 1]?.end ||
          `${day.date}T21:00`
        : row.end || row.start || `${shiftDate(day.date, 1)}T07:00`;
    let d = base.slice(0, 10);
    if (
      field === "end" &&
      !row.end &&
      row.start &&
      time <= row.start.slice(11, 16)
    )
      d = shiftDate(row.start.slice(0, 10), 1);
    update(row.id, { [field]: `${d}T${time}` });
  }
  function save() {
    const err = complete(day.date);
    if (err) setError(err);
    else {
      onSaved();
      onClose();
    }
  }
  return (
    <Modal
      title="Как прошла ночь?"
      description={`Ночь ${dateLabel(day.date)} → ${dateLabel(shiftDate(day.date, 1))}. Запишите только время сна.`}
      onClose={onClose}
    >
      <div className={s.nightBody}>
        {rows.map((r, i) => (
          <div className={s.nightRow} key={r.id}>
            <div className={s.rowTitle}>
              <span>
                <Icon name="moon" size={16} />
                Сон {i + 1}
              </span>
              <button
                className={s.iconButton}
                aria-label={`Удалить интервал ${i + 1}`}
                onClick={() =>
                  draft(
                    day.date,
                    rows.filter((x) => x.id !== r.id),
                  )
                }
              >
                <Icon name="trash" size={17} />
              </button>
            </div>
            <div className={s.twoFields}>
              {(["start", "end"] as const).map((field) => (
                <label key={field}>
                  {field === "start" ? "Уснул" : "Проснулся"}
                  <input
                    type="time"
                    aria-label={`${field === "start" ? "Уснул" : "Проснулся"}, интервал ${i + 1}`}
                    value={r[field].slice(11, 16)}
                    onChange={(e) => timeChange(r, field, e.target.value)}
                  />
                  <select
                    aria-label={`Дата ${field === "start" ? "засыпания" : "пробуждения"}, интервал ${i + 1}`}
                    value={
                      r[field].slice(0, 10) ||
                      (field === "start" ? day.date : shiftDate(day.date, 1))
                    }
                    onChange={(e) =>
                      update(r.id, {
                        [field]: `${e.target.value}T${r[field].slice(11, 16) || "00:00"}`,
                      })
                    }
                  >
                    {[day.date, shiftDate(day.date, 1)].map((d) => (
                      <option key={d} value={d}>
                        {dateLabel(d)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <textarea
              rows={2}
              aria-label={`Комментарий к интервалу ${i + 1}`}
              maxLength={1500}
              placeholder="Комментарий к этому сну…"
              value={r.comment}
              onChange={(e) => update(r.id, { comment: e.target.value })}
            />
            {r.start && r.end && new Date(r.end) > new Date(r.start) && (
              <span className={s.intervalDuration}>
                <Icon name="clock" size={14} />
                {duration(
                  minutes(
                    new Date(r.start).getTime(),
                    new Date(r.end).getTime(),
                  ),
                )}{" "}
                сна
              </span>
            )}
          </div>
        ))}
        <button
          className={s.dashedButton}
          onClick={() =>
            draft(day.date, [
              ...rows,
              { id: uid(), start: "", end: "", comment: "" },
            ])
          }
        >
          <Icon name="plus" size={18} />
          Добавить интервал сна
        </button>
        <div className={s.nightSummary}>
          <span>
            Всего сна <strong>{duration(stats.sleep)}</strong>
          </span>
          <span>
            Между снами <strong>{duration(stats.awake)}</strong>
          </span>
        </div>
        <p className={s.small}>
          Пока это черновик. Если утреннего подъема еще нет в дневнике, он
          добавится из последнего интервала.
        </p>
        <ErrorText message={error} />
        <button className={s.primary} onClick={save}>
          <Icon name="check" />
          Ночь заполнена
        </button>
        <button className={s.textButton} onClick={onClose}>
          Продолжить позже · черновик сохранен
        </button>
      </div>
    </Modal>
  );
}

function Stats({
  day,
  next,
  now,
}: {
  day?: DayRecord;
  next?: DayRecord;
  now: number;
}) {
  const stats = dayStats(day, now);
  const complete = !!day?.night.complete && !!next;
  return (
    <div className={s.statsGrid}>
      <div className={s.stat}>
        <span>
          <Icon name="sun" size={17} />
          Дневной сон
        </span>
        <strong>{day?.events.length ? duration(stats.sleep) : "—"}</strong>
        <small>
          {stats.naps
            ? `${stats.naps} ${stats.naps === 1 ? "дневной сон" : "дневных сна"}`
            : "Пока без дневных снов"}
        </small>
      </div>
      <div className={s.stat}>
        <span>
          <Icon name="clock" size={17} />
          Бодрствование
        </span>
        <strong>{day?.events.length ? duration(stats.awake) : "—"}</strong>
        <small>
          {day?.events.at(-1)?.kind === "night"
            ? "За дневной период"
            : "На данный момент"}
        </small>
      </div>
      <div className={s.stat}>
        <span>
          <Icon name="moon" size={17} />
          Ночной сон
        </span>
        <strong>{day?.night.complete ? duration(stats.night) : "—"}</strong>
        <small>
          {day?.night.complete
            ? "Фактическое время сна"
            : day?.night.rows.length
              ? "Есть черновик"
              : "Заполняем утром"}
        </small>
      </div>
      <div className={`${s.stat} ${s.totalStat}`}>
        <span>
          <Icon name="leaf" size={17} />
          Сон за сутки
        </span>
        <strong>{complete ? duration(stats.sleep + stats.night) : "—"}</strong>
        <small>
          {complete ? "От подъема до подъема" : "Итог после заполнения ночи"}
        </small>
      </div>
    </div>
  );
}
function Timeline({
  day,
  onEdit,
  onUndo,
  onNote,
}: {
  day?: DayRecord;
  onEdit: (e: SleepEvent) => void;
  onUndo: () => void;
  onNote: () => void;
}) {
  return (
    <section className={s.card}>
      <div className={s.sectionHead}>
        <div>
          <h2>Ритм дня</h2>
          <p>Маленькие события большого дня</p>
        </div>
        <span className={s.pill}>{day?.events.length ?? 0} событий</span>
      </div>
      {!day?.events.length ? (
        <div className={s.emptyTimeline}>
          <div className={s.emptyIcon}>
            <Icon name="leaf" size={28} />
          </div>
          <h3>У каждого дня свой ритм</h3>
          <p>
            Отметьте утренний подъем.
            <br />
            Все следующие события появятся здесь.
          </p>
          <div className={s.emptyDots}>
            <i />
            <i />
            <i />
          </div>
        </div>
      ) : (
        <div className={s.timeline}>
          {day.events.map((e, i) => {
            const prev = day.events[i - 1];
            const isSleep = e.kind === "sleep" || e.kind === "night";
            return (
              <div key={e.id} className={s.timelineItem}>
                {prev?.kind === "wake" && (
                  <div className={s.between}>
                    <span />
                    {duration(minutes(prev.at, e.at))} бодрствования
                    {prev.plannedMinutes !== undefined && (
                      <small>план {duration(prev.plannedMinutes)}</small>
                    )}
                  </div>
                )}
                <div className={s.event}>
                  <span
                    className={`${s.eventDot} ${isSleep ? s.sleepDot : ""}`}
                  >
                    <Icon name={isSleep ? "moon" : "sun"} size={17} />
                  </span>
                  <div className={s.eventText}>
                    <h3>
                      {e.kind === "night"
                        ? "Уснул на ночь"
                        : e.kind === "sleep"
                          ? `${day.events.slice(0, i + 1).filter((x) => x.kind === "sleep").length}-й дневной сон`
                          : i === 0
                            ? "Утренний подъем"
                            : "Проснулся"}
                    </h3>
                    {prev?.kind === "sleep" && (
                      <p>Спал {duration(minutes(prev.at, e.at))}</p>
                    )}
                    {e.comment && <p className={s.eventComment}>{e.comment}</p>}
                    <button
                      className={s.commentButton}
                      onClick={() => onEdit(e)}
                    >
                      <Icon name={e.comment ? "edit" : "message"} size={13} />
                      {e.comment ? "Изменить" : "Комментарий"}
                    </button>
                  </div>
                  <button
                    className={s.eventTime}
                    onClick={() => onEdit(e)}
                    aria-label={`Изменить событие ${timeInput(e.at)}`}
                  >
                    {timeInput(e.at)}
                    <Icon name="edit" size={13} />
                  </button>
                </div>
              </div>
            );
          })}
          <button className={s.undoButton} onClick={onUndo}>
            Отменить последнее событие
          </button>
        </div>
      )}
      <button className={s.noteButton} onClick={onNote}>
        <Icon name="message" size={18} />
        <span>{day?.note || "Добавить заметку о дне"}</span>
        <Icon name={day?.note ? "edit" : "plus"} size={17} />
      </button>
    </section>
  );
}

function DayPage({ initialDate }: { initialDate?: string }) {
  const [date, setDate] = useState(initialDate ?? dateKey());
  const days = useDiary((x) => x.days),
    birth = useDiary((x) => x.birthDate);
  const day = days[date];
  const last = day?.events.at(-1);
  const now = useNow();
  const [eventModal, setEventModal] = useState<{
      kind: EventKind;
      event?: SleepEvent;
    } | null>(null),
    [nightDate, setNightDate] = useState<string | null>(null),
    [note, setNote] = useState(false),
    [toast, setToast] = useState(""),
    [undo, setUndo] = useState(false),
    [undoError, setUndoError] = useState(""),
    [copyFallback, setCopyFallback] = useState("");
  const undoEvent = useDiary((x) => x.undoEvent);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const nextFor = (d: string) =>
    Object.values(days)
      .filter((x) => x.date > d && x.events.length)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
  const next = nextFor(date);
  const previous = Object.values(days)
    .filter((d) => d.date < date && d.events.some((e) => e.kind === "night"))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const nightDay = day?.events.some((e) => e.kind === "night") ? day : previous;
  const isNight = last?.kind === "night";
  const sleeping = last?.kind === "sleep";
  const finished = isNight && !!next;
  const todayKey = dateKey(new Date(now)),
    rollover = useRef(todayKey);
  useEffect(() => {
    if (rollover.current !== todayKey && !eventModal && !nightDate && !note) {
      if (date === rollover.current && !initialDate) setDate(todayKey);
      rollover.current = todayKey;
    }
  }, [todayKey, date, eventModal, nightDate, note, initialDate]);
  async function copy() {
    if (!day?.events.length) return;
    const text = diaryText(day, next);
    try {
      await navigator.clipboard.writeText(text);
      setToast("Дневник скопирован");
    } catch {
      setCopyFallback(text);
    }
  }
  return (
    <>
      <div className={s.pageHeading}>
        <div>
          <div className={s.kicker}>ДНЕВНИК СНА МАЛЫША</div>
          <h1>{date === dateKey() ? "Сегодня" : dateLabel(date)}</h1>
          <p>Меньше подсчетов. Больше спокойствия.</p>
        </div>
        <div className={s.dateSwitcher}>
          <button
            className={s.iconButton}
            onClick={() => setDate(shiftDate(date, -1))}
            aria-label="Предыдущий день"
          >
            <Icon name="chevron" style={{ transform: "rotate(180deg)" }} />
          </button>
          <label className={s.dateLabel}>
            {dateLabel(date, { day: "numeric", month: "short" })}
            <input
              aria-label="Выбрать день"
              type="date"
              value={date}
              max={dateKey()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <button
            className={s.iconButton}
            onClick={() => setDate(shiftDate(date, 1))}
            aria-label="Следующий день"
            disabled={date >= dateKey()}
          >
            <Icon name="chevron" />
          </button>
        </div>
      </div>
      {!birth && (
        <Link to="/settings" className={s.birthdayHint}>
          <span>
            <Icon name="heart" size={17} />
            Давайте познакомимся с малышом
          </span>
          <span>
            Указать дату рождения
            <Icon name="arrow" size={16} />
          </span>
        </Link>
      )}
      <div className={s.dayColumns}>
        <div className={s.mainColumn}>
          <section
            className={`${s.statusCard} ${sleeping || isNight ? s.statusSleeping : ""}`}
          >
            <div className={s.statusTop}>
              <span className={s.statusBadge}>
                <i />
                {!last
                  ? "НОВЫЙ ДЕНЬ"
                  : finished
                    ? "ДЕНЬ ЗАВЕРШЕН"
                    : isNight
                      ? "НОЧНОЙ СОН"
                      : sleeping
                        ? "СЕЙЧАС СПИТ"
                        : "СЕЙЧАС БОДРСТВУЕТ"}
              </span>
              <span className={s.statusDate}>
                {dateLabel(date, { weekday: "long" })}
              </span>
            </div>
            <div className={s.statusContent}>
              <div>
                {!last ? (
                  <>
                    <h2>
                      Доброе утро,
                      <br />
                      маленький мир.
                    </h2>
                    <p>
                      Новый день начинается с пробуждения.
                      <br />
                      Во сколько малыш открыл глазки?
                    </p>
                  </>
                ) : (
                  <>
                    <h2>
                      {finished
                        ? "День в вашем ритме"
                        : isNight
                          ? "Спокойной ночи"
                          : sleeping
                            ? `Спит ${duration(minutes(last.at, now))}`
                            : `Бодрствует ${duration(minutes(last.at, now))}`}
                    </h2>
                    <p>
                      {finished
                        ? `От ${timeInput(day.events[0].at)} до ${timeInput(next!.events[0].at)} следующего утра.`
                        : isNight
                          ? `Уснул в ${timeInput(last.at)}. Ночь можно заполнить утром.`
                          : sleeping
                            ? `Уснул в ${timeInput(last.at)}. Пусть отдых будет спокойным.`
                            : `Проснулся в ${timeInput(last.at)}. Впереди маленькие открытия.`}
                    </p>
                  </>
                )}
                {!isNight && (
                  <div className={s.statusActions}>
                    <button
                      className={s.primary}
                      onClick={() =>
                        setEventModal({
                          kind: sleeping || !last ? "wake" : "sleep",
                        })
                      }
                    >
                      <Icon
                        name={sleeping || !last ? "sun" : "moon"}
                        size={20}
                      />
                      {sleeping || !last ? "Проснулся" : "Уснул"}
                      <Icon name="arrow" size={18} />
                    </button>
                    {last && !sleeping && (
                      <button
                        className={s.softButton}
                        onClick={() => setEventModal({ kind: "night" })}
                      >
                        <Icon name="moon" size={17} />
                        Уснул на ночь
                      </button>
                    )}
                  </div>
                )}
              </div>
              <CloudArt />
            </div>
            {last?.kind === "wake" && (
              <PlanForm key={last.id} day={day} last={last} />
            )}
            {isNight && (
              <div className={s.nightCardFooter}>
                <Icon name="moon" size={18} />
                <span>
                  {finished
                    ? day.night.complete
                      ? "День и ночь записаны. Все подсчеты уже готовы."
                      : "Осталось заполнить ночь, чтобы подвести итог суток."
                    : "Отдыхайте. Все ночные события запишем утром."}
                </span>
              </div>
            )}
          </section>
          <Stats day={day} next={next} now={now} />
          <Timeline
            day={day}
            onEdit={(event) => setEventModal({ kind: event.kind, event })}
            onUndo={() => {
              setUndoError("");
              setUndo(true);
            }}
            onNote={() => setNote(true)}
          />
        </div>
        <aside className={s.rightColumn}>
          <section className={`${s.card} ${s.nightCard}`}>
            <div className={s.roundIcon}>
              <Icon name="moon" size={24} />
            </div>
            <h2>Как прошла ночь?</h2>
            <p>
              Запишите ночные сны утром.
              <br />
              Мы посчитаем, сколько малыш
              <br className={s.desktopBreak} /> отдыхал на самом деле.
            </p>
            {nightDay && (
              <span className={s.nightDate}>
                {dateLabel(nightDay.date, { day: "numeric", month: "short" })} →{" "}
                {dateLabel(shiftDate(nightDay.date, 1), {
                  day: "numeric",
                  month: "short",
                })}
                {nightDay.night.complete
                  ? " · заполнена"
                  : nightDay.night.rows.length
                    ? " · черновик"
                    : ""}
              </span>
            )}
            <button
              className={s.outlineButton}
              disabled={!nightDay}
              onClick={() => nightDay && setNightDate(nightDay.date)}
            >
              <Icon
                name={nightDay?.night.complete ? "edit" : "plus"}
                size={17}
              />
              {nightDay?.night.complete ? "Посмотреть ночь" : "Заполнить ночь"}
            </button>
            {!nightDay && (
              <small>Станет доступно после отметки «На ночь»</small>
            )}
          </section>
          <section className={s.gentleNote}>
            <Icon name="leaf" size={24} />
            <h3>
              У каждого малыша
              <br />
              свой ритм
            </h3>
            <p>
              Короткий сон, долгое укладывание — просто часть дня. Отмечайте,
              наблюдайте и находите свой ритм.
            </p>
            <Link to="/norms">
              Ориентиры по возрасту
              <Icon name="arrow" size={15} />
            </Link>
          </section>
          <button
            className={s.copyButton}
            disabled={!day?.events.length}
            onClick={copy}
          >
            <Icon name="copy" size={17} />
            Скопировать дневник
          </button>
          <div className={s.localNote}>
            <Icon name="check" size={14} />
            Все записи только на вашем устройстве
          </div>
        </aside>
      </div>
      {eventModal && (
        <EventForm
          date={date}
          {...eventModal}
          onClose={() => setEventModal(null)}
          onSaved={() => setToast("Событие сохранено")}
        />
      )}
      {note && <NoteModal date={date} onClose={() => setNote(false)} />}
      {nightDate && days[nightDate] && (
        <NightEditor
          day={days[nightDate]}
          next={nextFor(nightDate)}
          onClose={() => setNightDate(null)}
          onSaved={() => setToast("Ночь сохранена")}
        />
      )}
      {undo && (
        <Modal
          title="Отменить последнее событие?"
          description="Последняя отметка и ее комментарий будут удалены. Итоги пересчитаются."
          onClose={() => setUndo(false)}
        >
          <div className={s.form}>
            <ErrorText message={undoError} />
            <button
              className={s.primary}
              onClick={() => {
                const err = undoEvent(date);
                if (err) setUndoError(err);
                else setUndo(false);
              }}
            >
              Отменить событие
            </button>
            <button className={s.textButton} onClick={() => setUndo(false)}>
              Оставить запись
            </button>
          </div>
        </Modal>
      )}
      {copyFallback && (
        <Modal
          title="Текст дневника"
          description="Автоматическое копирование недоступно. Выделите текст и скопируйте его вручную."
          onClose={() => setCopyFallback("")}
        >
          <textarea
            className={s.copyText}
            readOnly
            value={copyFallback}
            onFocus={(e) => e.target.select()}
          />
        </Modal>
      )}
      <Toast text={toast} />
    </>
  );
}
function History() {
  const days = useDiary((x) => x.days);
  const [selected, setSelected] = useState<string | null>(null);
  const records = Object.values(days)
    .filter((d) => d.events.length)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (selected)
    return (
      <>
        <button className={s.backButton} onClick={() => setSelected(null)}>
          <Icon name="arrow" style={{ transform: "rotate(180deg)" }} />К истории
        </button>
        <DayPage key={selected} initialDate={selected} />
      </>
    );
  return (
    <>
      <PageTitle
        kicker="ДЕНЬ ЗА ДНЕМ"
        title="История"
        subtitle="Каждое пробуждение, каждый маленький сон."
      />
      {records.length ? (
        <div className={s.historyList}>
          {records.map((day) => {
            const stats = dayStats(day);
            return (
              <button
                key={day.date}
                className={s.historyDay}
                onClick={() => setSelected(day.date)}
              >
                <span className={s.historyDate}>
                  <b>{dateLabel(day.date, { day: "numeric" })}</b>
                  <span>{dateLabel(day.date, { month: "short" })}</span>
                </span>
                <div>
                  <h3>{dateLabel(day.date, { weekday: "long" })}</h3>
                  <p>
                    {stats.naps} ДС · дневной сон {duration(stats.sleep)}
                  </p>
                  {day.note && <small>{day.note}</small>}
                </div>
                <span className={s.historyNight}>
                  {day.night.complete
                    ? `Ночь ${duration(stats.night)}`
                    : "Ночь не заполнена"}
                </span>
                <Icon name="chevron" />
              </button>
            );
          })}
        </div>
      ) : (
        <section className={`${s.card} ${s.largeEmpty}`}>
          <Icon name="history" size={42} />
          <h2>Здесь будет ваша история</h2>
          <p>
            Начните с утреннего подъема.
            <br />
            Дни будут сохраняться здесь автоматически.
          </p>
          <Link className={s.primary} to="/">
            Перейти к сегодняшнему дню
            <Icon name="arrow" size={18} />
          </Link>
        </section>
      )}
    </>
  );
}
function PageTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className={s.pageHeading}>
      <div>
        <div className={s.kicker}>{kicker}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
function Norms() {
  return (
    <>
      <PageTitle
        kicker="ПОД РУКОЙ"
        title="Ориентиры сна"
        subtitle="От 8 до 18 месяцев. Посмотрите, когда захочется свериться."
      />
      <div className={s.infoBanner}>
        <Icon name="leaf" size={23} />
        <p>
          Справочные значения для самостоятельного просмотра. У каждого малыша
          свой ритм — таблица помогает держать ориентиры под рукой.
        </p>
      </div>
      <section className={`${s.card} ${s.normCard}`}>
        <div className={s.sectionHead}>
          <div>
            <h2>Сон и бодрствование по возрасту</h2>
            <p>ДС — дневной сон · ВБ — время бодрствования</p>
          </div>
          <span className={s.pill}>8–18 месяцев</span>
        </div>
        <div className={s.tableScroll}>
          <table>
            <thead>
              <tr>
                {[
                  "Возраст",
                  "Дневных снов",
                  "Один ДС",
                  "Дневной сон",
                  "Ночной сон",
                  "Сон за сутки",
                  "Одно ВБ",
                  "ВБ за сутки",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {norms.map((n) => (
                <tr key={n.age}>
                  {[
                    n.age,
                    n.naps,
                    n.nap,
                    n.day,
                    n.night,
                    n.total,
                    n.wake,
                    n.awake,
                  ].map((x, i) => (
                    <td key={i}>{x}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={s.normFootnotes}>
          <p>
            * В исходной таблице для 12 месяцев указано «2» без единицы
            измерения; по контексту — часа.
          </p>
          <p>** При одном дневном сне СДС совпадает с его длительностью.</p>
          <p>
            В источнике основные диапазоны, уточнения «на практике» и примеры
            местами различаются. Здесь приведены основные табличные значения. В
            комментариях для 13–15 месяцев встречается вечернее ВБ 6 ч 15 мин, а
            для 16–18 месяцев — 6 ч 30 мин.
          </p>
          <p>
            Источник: предоставленный справочник «Пример режимов по возрастам»,
            страницы 9–15.
          </p>
        </div>
      </section>
    </>
  );
}
function Settings({
  install,
  onInstall,
}: {
  install: InstallEvent | null;
  onInstall: () => Promise<void>;
}) {
  const birth = useDiary((x) => x.birthDate),
    save = useDiary((x) => x.setBirth);
  const [date, setDate] = useState(birth),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <PageTitle
        kicker="ВАШ МАЛЕНЬКИЙ МИР"
        title="Настройки"
        subtitle="Один раз настроить, а дальше — просто отмечать сон."
      />
      <div className={s.settingsGrid}>
        <section className={s.card}>
          <div className={s.sectionHead}>
            <div>
              <h2>О малыше</h2>
              <p>Будем считать возраст автоматически</p>
            </div>
            <span className={s.settingsIcon}>
              <Icon name="heart" size={23} />
            </span>
          </div>
          <form
            className={s.settingsForm}
            onSubmit={(e) => {
              e.preventDefault();
              if (
                !date ||
                date > dateKey() ||
                Number.isNaN(new Date(`${date}T12:00:00`).getTime())
              ) {
                setError(
                  "Укажите корректную дату рождения не позже сегодняшнего дня.",
                );
                return;
              }
              save(date);
              setSaved(true);
              setError("");
            }}
          >
            <label>
              Дата рождения
              <input
                type="date"
                required
                max={dateKey()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            {birth && (
              <div className={s.ageDisplay}>
                <Icon name="leaf" size={20} />
                <span>
                  Малышу сейчас <b>{ageLabel(birth)}</b>
                </span>
              </div>
            )}
            <p className={s.small}>
              Дата хранится на этом устройстве. Обновлять возраст вручную не
              нужно.
            </p>
            <ErrorText message={error} />
            <button className={s.primary} type="submit">
              <Icon name={saved ? "check" : "heart"} size={18} />
              {saved ? "Сохранено" : "Сохранить"}
            </button>
          </form>
        </section>
        <section className={`${s.card} ${s.installCard}`}>
          <div className={s.roundIcon}>
            <Icon name="download" size={24} />
          </div>
          <h2>Всегда под рукой</h2>
          <p>
            Установите «Тихий час» на главный экран Android. После первой
            загрузки дневник работает и без интернета.
          </p>
          {install ? (
            <button className={s.outlineButton} onClick={onInstall}>
              Установить приложение
            </button>
          ) : (
            <p className={s.installHint}>
              В Chrome откройте меню ⋮ → «Добавить на главный экран» или
              «Установить приложение».
            </p>
          )}
          <div className={s.localNote}>
            <Icon name="check" size={15} />
            Без аккаунта. Только ваше устройство.
          </div>
        </section>
      </div>
      <div className={s.storageInfo}>
        <Icon name="leaf" size={22} />
        <div>
          <h3>Ваш дневник остается с вами</h3>
          <p>
            Записи сохраняются в браузере на этом устройстве. Очистка данных
            сайта удалит дневник. Для сохранения записей пользуйтесь одним
            адресом приложения и обычным режимом браузера.
          </p>
        </div>
      </div>
    </>
  );
}
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}
export default function App() {
  const birth = useDiary((x) => x.birthDate);
  const [issue, setIssue] = useState(storageIssue());
  const [update, setUpdate] = useState<
    ((reload?: boolean) => Promise<void>) | null
  >(null);
  const location = useLocation();
  const [install, setInstall] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  useEffect(() => {
    const handler = (e: Event) => setIssue((e as CustomEvent<string>).detail);
    window.addEventListener("storage-issue", handler);
    return () => window.removeEventListener("storage-issue", handler);
  }, []);
  useEffect(() => {
    const apply = registerSW({
      onNeedRefresh() {
        setUpdate(() => apply);
      },
    });
  }, []);
  return (
    <div className={s.app}>
      <aside className={s.sidebar}>
        <Link to="/" className={s.brand}>
          <span className={s.logo}>
            <Icon name="moon" size={26} />
            <i />
          </span>
          <span>
            тихий час<small>ДНЕВНИК СНА МАЛЫША</small>
          </span>
        </Link>
        <div className={s.sidebarLabel}>ВАШ ДНЕВНИК</div>
        <nav className={s.nav}>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `${s.navLink} ${isActive ? s.navActive : ""}`
              }
            >
              <Icon name={n.icon} size={21} />
              <span>{n.label}</span>
              {location.pathname === n.to && <i />}
            </NavLink>
          ))}
        </nav>
        <div className={s.sidebarBottom}>
          <div className={s.sidebarIllustration}>
            <Icon name="leaf" size={30} />
            <span>
              В своем ритме.
              <br />С вашей любовью.
            </span>
          </div>
          <div className={s.sidebarLocal}>
            <i />
            Сохранено на устройстве
          </div>
        </div>
      </aside>
      <div className={s.workspace}>
        <header className={s.topbar}>
          <span className={s.topbarTitle}>
            <Icon name="leaf" size={17} />
            Пусть день будет спокойным
          </span>
          <Link to="/settings" className={s.childChip}>
            <span className={s.childAvatar}>
              <Icon name="heart" size={17} />
            </span>
            {birth ? ageLabel(birth) : "Ваш малыш"}
            <Icon name="chevron" size={14} />
          </Link>
        </header>
        <main className={s.main}>
          {issue && (
            <div className={s.storageError} role="alert">
              {issue}
            </div>
          )}
          {update && (
            <div className={s.updateBanner}>
              <span>
                Доступна новая версия. Записи останутся на устройстве.
              </span>
              <button onClick={() => update(true)}>Обновить</button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<DayPage />} />
            <Route path="/history" element={<History />} />
            <Route path="/norms" element={<Norms />} />
            <Route
              path="/settings"
              element={
                <Settings
                  install={install}
                  onInstall={async () => {
                    await install?.prompt();
                    setInstall(null);
                  }}
                />
              }
            />
            <Route
              path="*"
              element={
                <div className={s.largeEmpty}>
                  <h1>Страница не найдена</h1>
                  <Link to="/">К дневнику</Link>
                </div>
              }
            />
          </Routes>
          <footer className={s.footer}>
            Один сон за раз <span>✦</span> Тихий час
          </footer>
        </main>
      </div>
      <nav className={s.mobileNav}>
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) => (isActive ? s.mobileActive : "")}
          >
            <Icon name={n.icon} size={21} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
