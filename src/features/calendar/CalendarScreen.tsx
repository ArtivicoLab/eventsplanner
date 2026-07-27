// The app's signature view: a month calendar where multi-day events render
// as one continuous colored bar spanning their days, stacked in stable lanes
// so overlapping events never collide (see lib/calendarLayout.ts for the
// packing algorithm, this file only renders what it returns). Ported from
// first-love-calendar.html, the owner's reference mockup, including its
// agenda rail. The Day/Week view switch shown in that mockup was left out:
// neither view exists anywhere in this app yet, and building them is a real
// feature, not a reskin of something already working.
import { useEffect, useMemo, useRef, useState } from "react";
import { useEvents } from "../../stores/useEvents";
import { useSettings } from "../../stores/useSettings";
import { EventSheet } from "../events/EventSheet";
import { Chip, ChipRow } from "../../components/Chip";
import { Toggle } from "../../components/Toggle";
import { IconChevronLeft, IconChevron, IconPlus } from "../../components/icons";
import { layoutMonthEvents, type WeekLayout } from "../../lib/calendarLayout";
import { onActivateKey } from "../../lib/a11y";
import {
  addDaysISO,
  addMonthsISO,
  dayNum,
  endOfMonth,
  fromISO,
  format,
  inSameMonth,
  isTodayISO,
  isValidISO,
  monthGridISO,
  monthTitle,
  rangesOverlap,
  startOfMonth,
  toISO,
  todayISO,
  weekdayShort,
} from "../../lib/dates";
import { categoryColor } from "../../lib/ui";
import { navigate, routeQuery } from "../../router";
import type { EventItem } from "../../lib/types";

const MAX_LANES = 3;
const FLASH_MS = 1600;
const LANE0_TOP = 40;
const LANE_STEP = 26;

function rangeLabel(startIso: string, endIso: string): string {
  const start = format(fromISO(startIso), "MMM d");
  if (startIso === endIso) return start;
  const end = format(fromISO(endIso), "MMM d");
  return `${start} to ${end}`;
}

function isWeekendISO(iso: string): boolean {
  const d = fromISO(iso).getDay();
  return d === 0 || d === 6;
}

function countWeekends(startIso: string, endIso: string): number {
  let count = 0;
  for (let d = startIso; d <= endIso; d = addDaysISO(d, 1)) {
    if (isWeekendISO(d)) count++;
  }
  return count;
}

function hasOverlap(items: EventItem[]): boolean {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (rangesOverlap(items[i].startDate, items[i].endDate, items[j].startDate, items[j].endDate)) return true;
    }
  }
  return false;
}

// A search over real future Saturdays, capped generously (2 years of
// weekends) so a data quirk elsewhere can't turn this into an infinite loop.
function nextFreeWeekend(items: EventItem[], fromIso: string): { start: string; end: string } | null {
  let sat = fromIso;
  while (fromISO(sat).getDay() !== 6) sat = addDaysISO(sat, 1);
  for (let i = 0; i < 104; i++) {
    const sun = addDaysISO(sat, 1);
    const busy = items.some(
      (e) =>
        e.startDate &&
        e.endDate &&
        (rangesOverlap(e.startDate, e.endDate, sat, sat) || rangesOverlap(e.startDate, e.endDate, sun, sun))
    );
    if (!busy) return { start: sat, end: sun };
    sat = addDaysISO(sat, 7);
  }
  return null;
}

export function CalendarScreen() {
  const { items: events } = useEvents();
  const { categories, weekStart } = useSettings();

  // A link elsewhere in the app (the Dashboard's mini calendar, an event's
  // dates) can land here pointed at a specific day via ?date=. It sets which
  // month opens AND gets a brief highlight so landing here doesn't just open
  // "the calendar" with no sign of which day was actually clicked.
  const linkedDate = routeQuery().get("date");
  const [anchor, setAnchor] = useState(() => (linkedDate && isValidISO(linkedDate) ? linkedDate : todayISO()));
  const [flashDate, setFlashDate] = useState<string | null>(() =>
    linkedDate && isValidISO(linkedDate) ? linkedDate : null
  );
  const flashRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!flashDate) return;
    flashRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setFlashDate(null), FLASH_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedCats, setSelectedCats] = useState<string[]>(() => [...categories]);
  const [hideDone, setHideDone] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Which date to prefill the add sheet with — set when a day cell is
  // clicked directly; null means "no override", so EventSheet falls back to
  // today (the top Add Event button's existing behavior).
  const [addDate, setAddDate] = useState<string | null>(null);

  function openAddOn(date: string) {
    setAddDate(date);
    setAddOpen(true);
  }

  const today = todayISO();
  const gridDates = useMemo(() => monthGridISO(anchor, weekStart), [anchor, weekStart]);
  const weekdayLabels = useMemo(
    () => gridDates.slice(0, 7).map((d) => ({ label: weekdayShort(d), wknd: isWeekendISO(d) })),
    [gridDates]
  );

  const filteredEvents = useMemo(
    () =>
      events.filter((e) => {
        if (!selectedCats.includes(e.category)) return false;
        if (hideDone && (e.status === "Complete" || e.status === "Cancelled")) return false;
        return true;
      }),
    [events, selectedCats, hideDone]
  );

  const weeks = useMemo(
    () => layoutMonthEvents(filteredEvents, gridDates, MAX_LANES),
    [filteredEvents, gridDates]
  );

  // Categories actually showing a bar somewhere in the visible grid, so the
  // legend only ever explains colors the user can currently see.
  const legendCats = useMemo(() => {
    const start = gridDates[0];
    const end = gridDates[gridDates.length - 1];
    const set = new Set<string>();
    for (const e of filteredEvents) {
      if (e.startDate && e.endDate && e.startDate <= e.endDate && rangesOverlap(e.startDate, e.endDate, start, end)) {
        set.add(e.category);
      }
    }
    return Array.from(set).sort();
  }, [filteredEvents, gridDates]);

  const monthStart = toISO(startOfMonth(fromISO(anchor)));
  const monthEnd = toISO(endOfMonth(fromISO(anchor)));

  const monthEvents = useMemo(
    () =>
      filteredEvents
        .filter((e) => e.startDate && e.endDate && rangesOverlap(e.startDate, e.endDate, monthStart, monthEnd))
        .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0)),
    [filteredEvents, monthStart, monthEnd]
  );

  const busiestWeek = useMemo(() => {
    let best: WeekLayout | null = null;
    for (const w of weeks) {
      if (w.bars.length > 0 && (!best || w.bars.length > best.bars.length)) best = w;
    }
    return best;
  }, [weeks]);

  const eventDaysCount = useMemo(() => {
    const days = new Set<string>();
    for (const e of monthEvents) {
      const start = e.startDate > monthStart ? e.startDate : monthStart;
      const end = e.endDate < monthEnd ? e.endDate : monthEnd;
      for (let d = start; d <= end; d = addDaysISO(d, 1)) days.add(d);
    }
    return days.size;
  }, [monthEvents, monthStart, monthEnd]);

  const weekendCount = useMemo(() => countWeekends(monthStart, monthEnd), [monthStart, monthEnd]);
  const overlapsThisMonth = useMemo(() => hasOverlap(monthEvents), [monthEvents]);
  // Unfiltered on purpose: "your next free weekend" is a fact about every
  // real event, not just whichever categories happen to be toggled on.
  const freeWeekend = useMemo(() => nextFreeWeekend(events, today), [events, today]);

  function toggleCat(c: string) {
    setSelectedCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button className="icon-btn" aria-label="Previous month" onClick={() => setAnchor(addMonthsISO(anchor, -1))}>
            <IconChevronLeft width={15} height={15} />
          </button>
          <button className="chip" onClick={() => setAnchor(todayISO())}>
            Today
          </button>
          <button className="icon-btn" aria-label="Next month" onClick={() => setAnchor(addMonthsISO(anchor, 1))}>
            <IconChevron width={15} height={15} />
          </button>
        </div>
        <h1 className="page-title" style={{ marginBottom: 0, marginLeft: 6 }}>{monthTitle(anchor)}</h1>
        <span className="muted fs-13">
          {monthEvents.length} event{monthEvents.length === 1 ? "" : "s"}
          {busiestWeek && `, your busiest week is ${rangeLabel(busiestWeek.dates[0], busiestWeek.dates[6])}`}
        </span>
        <button
          className="btn btn--primary btn--auto"
          style={{ marginLeft: "auto" }}
          data-tour="cal-add"
          onClick={() => {
            setAddDate(null);
            setAddOpen(true);
          }}
        >
          <IconPlus width={16} height={16} /> Add Event
        </button>
      </div>

      <div className="filter-row" data-tour="cal-filters">
        <span className="filter-lbl">Quick Filters</span>
        <ChipRow>
          {categories.map((c) => (
            <Chip key={c} active={selectedCats.includes(c)} dotColor={categoryColor(c)} onClick={() => toggleCat(c)}>
              {c}
            </Chip>
          ))}
        </ChipRow>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <Toggle checked={hideDone} onChange={() => setHideDone((v) => !v)} label="Hide completed and cancelled" />
          <span className="fs-13 muted">Hide completed and cancelled</span>
        </div>
      </div>

      {events.length === 0 && (
        <div className="fs-13 muted mb-1">
          No events yet. Tap Add Event to place your first one on the calendar.
        </div>
      )}

      {legendCats.length > 0 && (
        <div className="legend-line" data-tour="cal-legend">
          <span>Bar color means category</span>
          {legendCats.map((c) => (
            <span key={c} className="dotchip">
              <span className="dotchip__dot" style={{ background: categoryColor(c) }} />
              {c}
            </span>
          ))}
        </div>
      )}

      <p className="fs-13 muted mb-1">
        Each bar spans the days its event runs. Tap a bar to open that event. Today's cell is
        highlighted, and a "+N" means more events landed that day than fit here.
      </p>

      <div className="cal-layout">
        <section className="card month-card" data-tour="cal-grid">
          <div className="month-card__scroll">
          <div className="month-card__inner">
          <div className="calgrid">
            {weekdayLabels.map((wd, i) => (
              <div key={i} className={`calgrid__weekday${wd.wknd ? " calgrid__weekday--wknd" : ""}`}>
                {wd.label}
              </div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} className="calweek">
              {week.dates.map((d, i) => {
                const isToday = isTodayISO(d, today);
                return (
                  <button
                    key={d}
                    type="button"
                    ref={d === flashDate ? flashRef : undefined}
                    className={`calcell${!inSameMonth(d, anchor) ? " calcell--out" : ""}${
                      isWeekendISO(d) ? " calcell--wknd" : ""
                    }${isToday ? " calcell--today" : ""}${d === flashDate ? " calcell--flash" : ""}`}
                    style={{ gridColumn: i + 1 }}
                    aria-label={`Add event on ${format(fromISO(d), "MMMM d")}`}
                    onClick={() => openAddOn(d)}
                  >
                    <span className="calcell__num">{dayNum(d)}</span>
                    {isToday && <span className="calcell--today__label">Today</span>}
                  </button>
                );
              })}

              {week.bars.map((bar) => (
                <div
                  key={`${bar.event.id}-${wi}`}
                  className="calbar"
                  role="button"
                  tabIndex={0}
                  style={{
                    left: `calc(${bar.startCol}/7*100% + 3px)`,
                    width: `calc(${bar.span}/7*100% - 6px)`,
                    top: LANE0_TOP + bar.lane * LANE_STEP,
                    background: `color-mix(in srgb, ${categoryColor(bar.event.category)} 45%, var(--surface))`,
                  }}
                  title={`${bar.event.name} (${bar.event.startDate} to ${bar.event.endDate})`}
                  aria-label={`${bar.event.name || "Untitled event"}, ${rangeLabel(bar.event.startDate, bar.event.endDate)}`}
                  onClick={() => navigate("eventdetail", { id: bar.event.id })}
                  onKeyDown={onActivateKey(() => navigate("eventdetail", { id: bar.event.id }))}
                >
                  <span className="calbar__dot" style={{ background: categoryColor(bar.event.category) }} />
                  {bar.event.name}
                </div>
              ))}

              {week.dates.map((d, i) =>
                week.overflowByDate[d] ? (
                  <div
                    key={`overflow-${d}`}
                    className="caloverflow"
                    style={{ left: `calc(${i}/7*100% + 3px)`, top: LANE0_TOP + MAX_LANES * LANE_STEP }}
                    title={`${week.overflowByDate[d]} more event(s) this day, beyond the ${MAX_LANES} shown. Open Events to see the full list.`}
                  >
                    +{week.overflowByDate[d]}
                  </div>
                ) : null
              )}
            </div>
          ))}
          </div>
          </div>
        </section>

        <aside className="rail">
          <div className="card rail-card">
            <div className="section-title">This month</div>
            <div className="month-stats">
              <div className="mstat">
                <div className="mstat__v">{monthEvents.length}</div>
                <div className="mstat__k">events</div>
              </div>
              <div className="mstat">
                <div className="mstat__v">{eventDaysCount}</div>
                <div className="mstat__k">event days</div>
              </div>
              <div className="mstat">
                <div className="mstat__v">{weekendCount}</div>
                <div className="mstat__k">weekends</div>
              </div>
            </div>
          </div>

          {monthEvents.length > 0 && (
            <div className="card rail-card">
              <div className="section-title">Agenda</div>
              <div className="list">
                {monthEvents.map((e) => {
                  const isPast = e.endDate < today;
                  const isNow = e.startDate <= today && today <= e.endDate;
                  return (
                    <button
                      key={e.id}
                      className={`agenda__row${isPast ? " agenda__row--past" : ""}`}
                      onClick={() => navigate("eventdetail", { id: e.id })}
                      style={{ width: "100%", border: "none", background: "none", textAlign: "left" }}
                    >
                      <span
                        className="datechip"
                        style={{ background: `color-mix(in srgb, ${categoryColor(e.category)} 35%, var(--surface))` }}
                      >
                        <span className="datechip__m">{format(fromISO(e.startDate), "MMM")}</span>
                        <span className="datechip__d">{dayNum(e.startDate)}</span>
                      </span>
                      <span className="list__body">
                        <span className="list__title">{e.name || "Untitled event"}</span>
                        <span className="list__sub">
                          {rangeLabel(e.startDate, e.endDate)}, {e.category || "Uncategorized"}
                        </span>
                      </span>
                      {isNow && <span className="agenda__nowdot" title="Happening now" aria-label="Happening now" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card rail-card">
            <p className="fs-13 muted" style={{ lineHeight: 1.55 }}>
              {overlapsThisMonth
                ? "Heads up: some events overlap this month. "
                : monthEvents.length > 0
                  ? "Nothing overlaps this month. "
                  : null}
              {freeWeekend && (
                <>
                  Your next free weekend is <b className="txt-strong">{rangeLabel(freeWeekend.start, freeWeekend.end)}</b>.
                </>
              )}
            </p>
          </div>
        </aside>
      </div>

      <EventSheet
        open={addOpen}
        eventId={null}
        initialDate={addDate ?? undefined}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}
