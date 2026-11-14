import { useMemo } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { analyzeDay, clockLabel, eventClock } from "./sleepAnalysis";
import { dateLabel, duration, eventObservations, shiftDate, timeInput } from "./domain";
import { dayContexts, formatNightHelp } from "./observations";
import { useDiary } from "./store";
import app from "./App.module.css";
import s from "./Analytics.module.css";

type DayAnalysis = ReturnType<typeof analyzeDay>;
const shortDate = (date: string) => dateLabel(date, { day: "numeric", month: "short" });
const dayLink = (date: string) => `/history?date=${date}`;
const durationOrEmpty = (value: number | null) => value === null ? "—" : duration(value);

function TimelineChart({ days, selected, onToggle }: {
  days: DayAnalysis[];
  selected: string[];
  onToggle: (date: string) => void;
}) {
  const start = Math.min(240, ...days.map((d) => Math.floor((d.start ?? 0) / 240) * 240));
  const end = Math.max(1920, ...days.map((d) => Math.ceil(d.end / 240) * 240));
  const ticks = Array.from({ length: (end - start) / 240 + 1 }, (_, index) => start + index * 240);
  const offset = (minute: number) => `${(minute - start) / (end - start) * 100}%`;
  return (
    <section className={app.card} aria-labelledby="analytics-rhythm">
      <h2 id="analytics-rhythm">Ритм по дням</h2>
      <p className={s.hint}>Ночь стоит в строке дня засыпания. Выберите даты для сравнения.</p>
      <a className={s.jump} href="#analytics-compare" aria-live="polite">К сравнению · выбрано {selected.length}</a>
      <div className={s.legend}>
        <span><i className={s.nap} /> Дневной сон</span>
        <span><i className={s.resumed} /> Досып</span>
        <span><i className={s.night} /> Ночной сон</span>
        <span><i className={s.pending} /> Ночь не заполнена</span>
      </div>
      <div className={s.chartScroll}>
        <div className={s.chart}>
          <div className={s.chartRow} aria-hidden="true">
            <span />
            <div className={s.axis}>
              {ticks.map((tick) => <span key={tick} style={{ left: offset(tick) }}>{clockLabel(tick)}{tick >= 1440 ? "⁺¹" : ""}</span>)}
            </div>
          </div>
          {days.map((d) => {
            const date = d.day.date;
            const intervalLabels = d.intervals.map((segment) => `${segment.kind === "night" ? "ночной сон" : segment.kind === "resumed" ? "досып" : "дневной сон"} ${clockLabel(segment.start)}–${clockLabel(segment.end)}`);
            const missingNight = d.dayComplete && !d.night;
            const description = [
              `Подъём ${eventClock(d.day.events[0])}`,
              ...intervalLabels,
              d.bedtime !== undefined && `Уснул на ночь ${timeInput(d.bedtime)}`,
              missingNight ? "Ночь не заполнена" : !d.dayComplete && "День не завершён",
            ].filter(Boolean).join(". ");
            return (
              <div className={s.chartRow} key={date}>
                <button type="button" className={s.dateButton} aria-pressed={selected.includes(date)}
                  onClick={() => onToggle(date)} aria-label={`Сравнить ${shortDate(date)}`}>
                  {shortDate(date)}
                </button>
                <div className={s.track} role="img" aria-label={description} title={description}>
                  {ticks.map((tick) => <i key={tick} className={s.gridline} style={{ left: offset(tick) }} />)}
                  {d.start !== undefined && <i className={s.wakeMarker} style={{ left: offset(d.start) }} />}
                  {d.intervals.map((segment) => (
                    <i className={`${s.segment} ${s[segment.kind]}`} key={`${segment.kind}-${segment.start}`}
                      style={{ left: offset(segment.start), width: `calc(${offset(segment.end)} - ${offset(segment.start)})` }} />
                  ))}
                  {missingNight && <i className={`${s.segment} ${s.pending}`} style={{ left: offset(d.end) }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Comparison({ days }: { days: DayAnalysis[] }) {
  const maxNaps = Math.max(0, ...days.map((d) => d.naps.length));
  const rows: [string, (d: DayAnalysis) => ReactNode][] = [
    ["Утренний подъём", (d) => eventClock(d.day.events[0])],
    ["Дневной сон", (d) => `${duration(d.daySleep)}${d.dayComplete ? "" : " · пока"}`],
    ["Число дневных снов", (d) => d.naps.length],
    ...Array.from({ length: maxNaps }, (_, index): typeof rows[number] => [
      `${index + 1}-й сон`, (d) => {
        const nap = d.naps[index];
        if (!nap) return "—";
        const napEvents = nap.parts.flatMap(({ start, end }) => [start, end]);
        if (nap.openPart) napEvents.push(nap.openPart);
        const observations = napEvents
          .map((event, eventIndex) => eventObservations(event, napEvents[eventIndex + 1]?.continuation))
          .filter(Boolean);
        const comments = napEvents.map((event) => event.comment).filter(Boolean);
        return (
          <div className={s.napDetail}>
            <strong>{timeInput(nap.start.at)}–{eventClock(nap.finalWake)}{nap.openPart && " · нет отметки пробуждения"}</strong>
            <span>Бодрствовал до сна {duration(nap.awakeBefore)}</span>
            <span>До первого пробуждения {durationOrEmpty(nap.firstSleep)}</span>
            <span>Досып {durationOrEmpty(nap.openPart && !nap.resumed ? null : nap.resumed)}{nap.gap ? ` · перерыв ${duration(nap.gap)}` : ""}</span>
            {nap.openPart ? <span>Записано сна {duration(nap.total)}</span> : <span>Всего сна {duration(nap.total)}</span>}
            {observations.map((value, index) => <span key={index}>{value}</span>)}
            {comments.length > 0 && <details><summary>Комментарии</summary>{comments.map((value, index) => <p key={index}>{value}</p>)}</details>}
          </div>
        );
      },
    ]),
    ["Уснул на ночь", (d) => d.bedtime === undefined ? "—" : timeInput(d.bedtime)],
    ["Бодрствование перед ночью", (d) => durationOrEmpty(d.awakeBeforeNight)],
    ["Ночной сон", (d) => d.night ? duration(d.night.sleep) : "Не заполнено"],
    ["Между ночными отрезками", (d) => durationOrEmpty(d.night?.awake ?? null)],
    ["Пробуждения с помощью", (d) => d.day.night.help ? formatNightHelp(d.day.night.help) : "Не отмечено"],
    ["Следующий подъём", (d) => d.nextWake ?? "—"],
    ["Комментарии к ночи", (d) => [
      d.bedtime === undefined ? undefined : d.day.events.at(-1)?.comment,
      ...d.day.night.rows.map((row) => row.comment),
    ].filter((comment) => comment?.trim()).join("\n\n") || "—"],
    ["Сон от подъёма до подъёма", (d) => d.night && d.dayComplete ? duration(d.daySleep + d.night.sleep) : "—"],
    ["Обстоятельства", (d) => d.day.contexts?.map((key) => dayContexts[key]).join(", ") || "—"],
    ["Заметка дня", (d) => d.day.note || "—"],
  ];
  return (
    <section className={app.card} aria-labelledby="analytics-compare">
      <h2 id="analytics-compare">Сравнение дней</h2>
      {days.length ? (
        <div className={s.tableScroll} role="region" aria-label="Показатели выбранных дней" tabIndex={0}>
          <table className={s.comparison}>
            <thead><tr><th scope="col">Показатель</th>{days.map(({ day }) =>
              <th key={day.date} scope="col"><Link to={dayLink(day.date)}>{shortDate(day.date)}</Link></th>,
            )}</tr></thead>
            <tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{days.map((d) => <td key={d.day.date}>{value(d)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : <p className={s.hint}>Выберите даты на графике.</p>}
    </section>
  );
}

export function Analytics() {
  const diary = useDiary((state) => state.days);
  const [query, setQuery] = useSearchParams();
  const records = useMemo(() => Object.values(diary).filter((day) => day.events.length)
    .sort((a, b) => a.date.localeCompare(b.date)).map(analyzeDay), [diary]);
  const last = records.at(-1)?.day.date ?? "";
  const first = records[0]?.day.date ?? "";
  const from = query.get("from") || (last ? [first, shiftDate(last, -13)].sort().at(-1)! : "");
  const to = query.get("to") || last;
  const visible = records.filter(({ day }) => day.date >= from && day.date <= to);
  const selected = query.has("days") ? query.getAll("days").filter(Boolean) : visible.slice(-2).map(({ day }) => day.date);
  const compared = visible.filter(({ day }) => selected.includes(day.date));
  function setRange(start: string, end: string) {
    if (!start || !end) return;
    const params = new URLSearchParams(query);
    params.set("from", start);
    params.set("to", end);
    setQuery(params, { replace: true });
  }
  function toggle(date: string) {
    const next = selected.includes(date) ? selected.filter((value) => value !== date) : [...selected, date];
    const params = new URLSearchParams(query);
    params.delete("days");
    for (const value of next.length ? next : [""]) params.append("days", value);
    setQuery(params, { replace: true });
  }
  return (
    <div className={s.page}>
      <header className={s.header}>
        <h1>Аналитика сна</h1>
        <p>Сравните расписание, отдельные сны и ночи по записям дневника.</p>
      </header>
      {records.length ? <>
        <div className={s.filters} aria-label="Период аналитики">
          <label>С <input type="date" min={first} max={to} value={from} onChange={(e) => setRange(e.target.value, to)} /></label>
          <label>По <input type="date" min={from} max={last} value={to} onChange={(e) => setRange(from, e.target.value)} /></label>
          <button className={app.outlineButton} type="button" onClick={() => setRange(first, last)}>Весь период</button>
        </div>
        {from > to ? <p role="alert">Дата начала должна быть не позже даты окончания.</p> : visible.length ? <>
          <TimelineChart days={visible} selected={compared.map(({ day }) => day.date)} onToggle={toggle} />
          <Comparison days={compared} />
        </> : <p>За этот период записей нет.</p>}
      </> : <section className={app.card}>
        <p>Добавьте день в дневник, чтобы увидеть его на графике.</p>
        <Link to="/">Открыть дневник</Link>
      </section>}
    </div>
  );
}
