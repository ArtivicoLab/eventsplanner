// Single source of truth for the Google Sheet layout. Row 1 of every tab is a
// header written by the app. Records are keyed by `id` (column A) — NEVER by
// row position. Serializers here roundtrip a domain object <-> a flat
// string[] row so the Sheets sync layer stays trivial.

import type { EventItem, EventTask, Expense, Guest, Priority, Room, RoomShape, TaskStatus } from "./types";

export const SPREADSHEET_TITLE = "Event Planner";

// Tab names shown to the user in their actual Google Sheet — kept human-
// readable (not internal camelCase collection names) so a buyer who opens
// the raw Sheet recognizes it as the same app they use day to day. See
// CLAUDE.md's Life Planner history for why this matters: a mismatch here
// reads as "the sheet tabs don't match what's on the site."
export const TAB = {
  Meta: "Settings",
  Events: "Events",
  EventTasks: "Tasks",
  Expenses: "Budget",
  Rooms: "Seating",
  Guests: "Guests",
} as const;

export const HEADERS: Record<string, string[]> = {
  // A generic key/value tab — currently used to carry the buyer's Etsy access
  // code across devices, so connecting to the same Sheet elsewhere skips
  // re-entering it. Not part of the normal per-collection sync loop.
  [TAB.Meta]: ["key", "value"],
  [TAB.Events]: [
    "id", "name", "category", "type", "startDate", "startTime", "endDate", "endTime",
    "marketRegion", "location", "state", "owner", "priority", "status", "budget",
    "details", "notes", "createdAt", "updatedAt",
  ],
  [TAB.EventTasks]: [
    "id", "eventId", "task", "priority", "status", "dueDate", "assignedTo", "notes",
    "createdAt", "updatedAt",
  ],
  // "category" appended at the end, not inserted after "amount": an
  // already-synced real Sheet has rows written before this column existed,
  // and rowToExpense() reads by fixed position, so appending keeps every
  // existing column's meaning intact instead of shifting them.
  [TAB.Expenses]: ["id", "eventId", "date", "amount", "details", "createdAt", "updatedAt", "category"],
  [TAB.Rooms]: ["id", "eventId", "name", "shape", "seats", "x", "y", "createdAt", "updatedAt"],
  // "arrivalTime" and "arrived" appended at the end, same backward-compat
  // reason as Expenses' "category" above.
  [TAB.Guests]: [
    "id", "eventId", "name", "roomId", "seatIndex", "notes", "createdAt", "updatedAt",
    "arrivalTime", "arrived",
  ],
};

// ---- primitive (de)serializers ----
const num = (n: number): string => String(n ?? 0);
const pn = (s: string | undefined): number => {
  const v = parseFloat(String(s ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(v) ? v : 0;
};
const s = (v: string | undefined): string => (v ?? "").toString();

// ---- Events ----
export function eventToRow(e: EventItem): string[] {
  return [
    e.id, e.name, e.category, e.type, e.startDate, e.startTime, e.endDate, e.endTime,
    e.marketRegion, e.location, e.state, e.owner, e.priority, e.status, num(e.budget),
    e.details, e.notes, e.createdAt, e.updatedAt,
  ];
}
export function rowToEvent(r: string[]): EventItem {
  return {
    id: s(r[0]), name: s(r[1]), category: s(r[2]), type: s(r[3]),
    startDate: s(r[4]), startTime: s(r[5]), endDate: s(r[6]) || s(r[4]), endTime: s(r[7]),
    marketRegion: s(r[8]), location: s(r[9]), state: s(r[10]), owner: s(r[11]),
    priority: (s(r[12]) || "Medium") as Priority, status: s(r[13]),
    budget: pn(r[14]), details: s(r[15]), notes: s(r[16]),
    createdAt: s(r[17]), updatedAt: s(r[18]),
  };
}

// ---- Event Tasks ----
export function eventTaskToRow(t: EventTask): string[] {
  return [
    t.id, t.eventId, t.task, t.priority, t.status, t.dueDate, t.assignedTo, t.notes,
    t.createdAt, t.updatedAt,
  ];
}
export function rowToEventTask(r: string[]): EventTask {
  return {
    id: s(r[0]), eventId: s(r[1]), task: s(r[2]),
    priority: (s(r[3]) || "Medium") as Priority,
    status: (s(r[4]) || "NotStarted") as TaskStatus,
    dueDate: s(r[5]), assignedTo: s(r[6]), notes: s(r[7]),
    createdAt: s(r[8]), updatedAt: s(r[9]),
  };
}

// ---- Expenses ----
export function expenseToRow(x: Expense): string[] {
  return [x.id, x.eventId, x.date, num(x.amount), x.details, x.createdAt, x.updatedAt, x.category];
}
export function rowToExpense(r: string[]): Expense {
  return {
    id: s(r[0]), eventId: s(r[1]), date: s(r[2]), amount: pn(r[3]), details: s(r[4]),
    createdAt: s(r[5]), updatedAt: s(r[6]), category: s(r[7]),
  };
}

// ---- Seating: Rooms ----
export function roomToRow(rm: Room): string[] {
  return [rm.id, rm.eventId, rm.name, rm.shape, num(rm.seats), num(rm.x), num(rm.y), rm.createdAt, rm.updatedAt];
}
export function rowToRoom(r: string[]): Room {
  return {
    id: s(r[0]), eventId: s(r[1]), name: s(r[2]),
    shape: (s(r[3]) || "round") as RoomShape,
    seats: pn(r[4]) || 8, x: pn(r[5]), y: pn(r[6]),
    createdAt: s(r[7]), updatedAt: s(r[8]),
  };
}

// ---- Seating: Guests ----
export function guestToRow(g: Guest): string[] {
  return [
    g.id, g.eventId, g.name, g.roomId, num(g.seatIndex), g.notes, g.createdAt, g.updatedAt,
    g.arrivalTime, g.arrived ? "TRUE" : "FALSE",
  ];
}
export function rowToGuest(r: string[]): Guest {
  return {
    id: s(r[0]), eventId: s(r[1]), name: s(r[2]), roomId: s(r[3]),
    seatIndex: r[4] === undefined || r[4] === "" ? -1 : pn(r[4]),
    notes: s(r[5]), createdAt: s(r[6]), updatedAt: s(r[7]), arrivalTime: s(r[8]),
    arrived: s(r[9]).toUpperCase() === "TRUE",
  };
}
