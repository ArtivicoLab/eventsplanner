import { describe, expect, it } from "vitest";
import { layoutMonthEvents } from "../src/lib/calendarLayout";
import { monthGridISO } from "../src/lib/dates";
import type { EventItem } from "../src/lib/types";

function ev(id: string, startDate: string, endDate: string): EventItem {
  return {
    id,
    name: id,
    category: "Corporate",
    type: "Corporate",
    startDate,
    startTime: "",
    endDate,
    endTime: "",
    marketRegion: "",
    location: "",
    state: "",
    owner: "",
    priority: "Medium",
    status: "Active",
    budget: 0,
    details: "",
    notes: "",
    createdAt: "",
    updatedAt: "",
  };
}

// A fixed, deterministic month grid: September 2025, week starting Sunday.
// Sun Aug 31 .. Sat Oct 4 (five full weeks, 35 days).
const GRID = monthGridISO("2025-09-15", 0);

describe("layoutMonthEvents", () => {
  it("throws on a grid that isn't a multiple of 7", () => {
    expect(() => layoutMonthEvents([], ["2025-09-01"])).toThrow();
  });

  it("lays out a single-day event as a single-column bar with rounded start and end", () => {
    const weeks = layoutMonthEvents([ev("a", "2025-09-03", "2025-09-03")], GRID);
    const week = weeks.find((w) => w.dates.includes("2025-09-03"))!;
    const bar = week.bars.find((b) => b.event.id === "a")!;
    expect(bar.span).toBe(1);
    expect(bar.lane).toBe(0);
    expect(bar.isStart).toBe(true);
    expect(bar.isEnd).toBe(true);
  });

  it("lays out a multi-day event entirely inside one week as one wide bar", () => {
    const weeks = layoutMonthEvents([ev("a", "2025-09-03", "2025-09-05")], GRID);
    const week = weeks.find((w) => w.dates.includes("2025-09-03"))!;
    const bar = week.bars.find((b) => b.event.id === "a")!;
    expect(bar.startCol).toBe(week.dates.indexOf("2025-09-03"));
    expect(bar.span).toBe(3);
    expect(bar.isStart).toBe(true);
    expect(bar.isEnd).toBe(true);
  });

  it("splits an event that crosses a week boundary into two bars in the SAME lane", () => {
    // Sep 5, 2025 is a Friday under a Sunday-start grid -> this run spans into the next week row.
    const events = [ev("a", "2025-09-05", "2025-09-09")];
    const weeks = layoutMonthEvents(events, GRID);
    const firstWeek = weeks.find((w) => w.dates.includes("2025-09-05"))!;
    const secondWeek = weeks.find((w) => w.dates.includes("2025-09-09"))!;
    expect(firstWeek).not.toBe(secondWeek);
    const barA = firstWeek.bars.find((b) => b.event.id === "a")!;
    const barB = secondWeek.bars.find((b) => b.event.id === "a")!;
    expect(barA.lane).toBe(barB.lane);
    expect(barA.isStart).toBe(true);
    expect(barA.isEnd).toBe(false);
    expect(barA.startCol).toBe(firstWeek.dates.indexOf("2025-09-05"));
    expect(barA.span).toBe(firstWeek.dates.length - barA.startCol);
    expect(barB.isStart).toBe(false);
    expect(barB.isEnd).toBe(true);
    expect(barB.startCol).toBe(0);
    expect(barB.span).toBe(secondWeek.dates.indexOf("2025-09-09") + 1);
  });

  it("gives two overlapping events different lanes", () => {
    const events = [ev("a", "2025-09-03", "2025-09-06"), ev("b", "2025-09-04", "2025-09-08")];
    const weeks = layoutMonthEvents(events, GRID);
    const week = weeks.find((w) => w.dates.includes("2025-09-04"))!;
    const barA = week.bars.find((b) => b.event.id === "a")!;
    const barB = week.bars.find((b) => b.event.id === "b")!;
    expect(barA.lane).not.toBe(barB.lane);
  });

  it("reuses a lane once its previous occupant has ended", () => {
    const events = [ev("a", "2025-09-01", "2025-09-02"), ev("b", "2025-09-03", "2025-09-05")];
    const weeks = layoutMonthEvents(events, GRID);
    const week = weeks.find((w) => w.dates.includes("2025-09-03"))!;
    const barA = week.bars.find((b) => b.event.id === "a")!;
    const barB = week.bars.find((b) => b.event.id === "b")!;
    expect(barA.lane).toBe(0);
    expect(barB.lane).toBe(0);
  });

  it("prefers a longer event for the lowest lane over shorter same-day events", () => {
    const events = [
      ev("short1", "2025-09-10", "2025-09-10"),
      ev("short2", "2025-09-10", "2025-09-10"),
      ev("long", "2025-09-10", "2025-09-14"),
    ];
    const weeks = layoutMonthEvents(events, GRID);
    const week = weeks.find((w) => w.dates.includes("2025-09-10"))!;
    const barLong = week.bars.find((b) => b.event.id === "long")!;
    expect(barLong.lane).toBe(0);
  });

  it("moves events past maxLanes into overflowByDate instead of rendering a bar", () => {
    const events = [
      ev("a", "2025-09-08", "2025-09-08"),
      ev("b", "2025-09-08", "2025-09-08"),
      ev("c", "2025-09-08", "2025-09-08"),
      ev("d", "2025-09-08", "2025-09-08"),
    ];
    const weeks = layoutMonthEvents(events, GRID, 3);
    const week = weeks.find((w) => w.dates.includes("2025-09-08"))!;
    const shown = week.bars.filter((b) => b.startCol === week.dates.indexOf("2025-09-08"));
    expect(shown.length).toBe(3);
    expect(week.overflowByDate["2025-09-08"]).toBe(1);
  });

  it("ignores events entirely outside the visible grid", () => {
    const weeks = layoutMonthEvents([ev("far", "2020-01-01", "2020-01-02")], GRID);
    const anyBar = weeks.some((w) => w.bars.some((b) => b.event.id === "far"));
    expect(anyBar).toBe(false);
  });

  it("ignores an event with endDate before startDate rather than crashing", () => {
    const weeks = layoutMonthEvents([ev("bad", "2025-09-10", "2025-09-05")], GRID);
    const anyBar = weeks.some((w) => w.bars.some((b) => b.event.id === "bad"));
    expect(anyBar).toBe(false);
  });
});
