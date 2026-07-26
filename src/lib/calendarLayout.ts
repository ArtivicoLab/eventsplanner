// Multi-day event bar layout for the Event Calendar — the app's signature
// view. A month grid is a set of 7-day week rows; a multi-day event (Sep 4-6)
// must render as ONE continuous horizontal bar spanning its days within each
// week row it touches, stacked in a stable "lane" so two overlapping events
// never occupy the same visual row (a classic interval-graph / Gantt packing
// problem, done here with a simple greedy algorithm — no library).
//
// A single event keeps the SAME lane across every week it spans (computed
// once, globally, across the whole visible grid) so an event that wraps a
// week boundary doesn't visually jump to a different row — exactly what a
// real desk calendar does.

import type { EventItem } from "./types";
import { rangesOverlap } from "./dates";

export interface EventBar {
  event: EventItem;
  lane: number;
  startCol: number; // 0..6, this week's column the bar begins at
  span: number; // number of day-columns this bar covers within the week (1..7)
  isStart: boolean; // true if the event's real startDate falls in this week (rounded left edge)
  isEnd: boolean; // true if the event's real endDate falls in this week (rounded right edge)
}

export interface WeekLayout {
  dates: string[]; // 7 ISO dates
  bars: EventBar[]; // only lanes < maxLanes — the rest are summarized below
  overflowByDate: Record<string, number>; // date -> count of events hidden past maxLanes that day
}

/**
 * Lay out `events` across `gridDates` (a flat list of ISO dates, a multiple
 * of 7 — see monthGridISO). Returns one WeekLayout per 7-day row.
 */
export function layoutMonthEvents(events: EventItem[], gridDates: string[], maxLanes = 3): WeekLayout[] {
  if (gridDates.length === 0 || gridDates.length % 7 !== 0) {
    throw new Error("gridDates must be a non-empty multiple of 7");
  }
  const gridStart = gridDates[0];
  const gridEnd = gridDates[gridDates.length - 1];

  const visible = events
    .filter((e) => e.startDate && e.endDate && e.startDate <= e.endDate)
    .filter((e) => rangesOverlap(e.startDate, e.endDate, gridStart, gridEnd));

  // Longer events first (then earlier start, then id) so a multi-day event
  // claims a low, stable lane before shorter same-day events crowd it —
  // otherwise a 4-day event could get pushed to lane 2 by two 1-day events
  // that each individually started earlier that same morning.
  const sorted = [...visible].sort((a, b) => {
    const aLen = a.endDate.localeCompare(a.startDate);
    const bLen = b.endDate.localeCompare(b.startDate);
    if (aLen !== bLen) return aLen > bLen ? -1 : 1;
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // Greedy lane assignment: give each event the lowest-numbered lane whose
  // current occupant already ends strictly before this event starts.
  const laneLastEnd: string[] = []; // lane index -> end date of its current occupant
  const laneOf = new Map<string, number>();
  for (const e of sorted) {
    let lane = laneLastEnd.findIndex((end) => e.startDate > end);
    if (lane === -1) lane = laneLastEnd.length;
    laneLastEnd[lane] = e.endDate < gridEnd ? e.endDate : gridEnd;
    laneOf.set(e.id, lane);
  }

  const weeks: WeekLayout[] = [];
  for (let w = 0; w < gridDates.length; w += 7) {
    const dates = gridDates.slice(w, w + 7);
    const weekStart = dates[0];
    const weekEnd = dates[6];
    const bars: EventBar[] = [];
    const overflowByDate: Record<string, number> = {};

    for (const e of visible) {
      if (!rangesOverlap(e.startDate, e.endDate, weekStart, weekEnd)) continue;
      const lane = laneOf.get(e.id)!;
      const clippedStart = e.startDate > weekStart ? e.startDate : weekStart;
      const clippedEnd = e.endDate < weekEnd ? e.endDate : weekEnd;
      const startCol = dates.indexOf(clippedStart);
      const endCol = dates.indexOf(clippedEnd);
      const span = endCol - startCol + 1;

      if (lane < maxLanes) {
        bars.push({
          event: e,
          lane,
          startCol,
          span,
          isStart: clippedStart === e.startDate,
          isEnd: clippedEnd === e.endDate,
        });
      } else {
        for (let c = startCol; c <= endCol; c++) {
          overflowByDate[dates[c]] = (overflowByDate[dates[c]] ?? 0) + 1;
        }
      }
    }

    weeks.push({ dates, bars, overflowByDate });
  }

  return weeks;
}
