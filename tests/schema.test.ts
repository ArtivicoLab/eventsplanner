import { describe, expect, it } from "vitest";
import {
  eventToRow,
  eventTaskToRow,
  expenseToRow,
  guestToRow,
  HEADERS,
  rowToEvent,
  rowToEventTask,
  rowToExpense,
  rowToGuest,
  TAB,
} from "../src/lib/schema";
import type { EventItem, EventTask, Expense, Guest } from "../src/lib/types";

const event: EventItem = {
  id: "ev1",
  name: "Tech Summit",
  category: "Conference",
  type: "Corporate",
  startDate: "2025-09-04",
  startTime: "08:15",
  endDate: "2025-09-06",
  endTime: "17:00",
  marketRegion: "New York City, NY",
  location: "45 Liberty Rd.",
  state: "New York",
  owner: "John Carter",
  priority: "VeryHigh",
  status: "Active",
  budget: 8500.5,
  details: "Next gen ideas",
  notes: "Bring badges",
  createdAt: "2025-08-01T00:00:00.000Z",
  updatedAt: "2025-08-02T00:00:00.000Z",
};

const task: EventTask = {
  id: "t1",
  eventId: "ev1",
  task: "Decoration Setup",
  priority: "High",
  status: "InProgress",
  dueDate: "2025-09-05",
  assignedTo: "Emily Johnson",
  notes: "",
  createdAt: "2025-08-01T00:00:00.000Z",
  updatedAt: "2025-08-02T00:00:00.000Z",
};

const expense = {
  id: "x1",
  eventId: "ev1",
  date: "2025-09-05",
  amount: 133,
  category: "Venue",
  details: "Event setup",
  createdAt: "2025-08-01T00:00:00.000Z",
  updatedAt: "2025-08-02T00:00:00.000Z",
} satisfies Expense;

const guest = {
  id: "g1",
  eventId: "ev1",
  name: "Emily Johnson",
  roomId: "room1",
  seatIndex: 2,
  arrivalTime: "14:30",
  notes: "Gluten-free",
  createdAt: "2025-08-01T00:00:00.000Z",
  updatedAt: "2025-08-02T00:00:00.000Z",
} satisfies Guest;

describe("schema roundtrips", () => {
  it("Event survives toRow/fromRow", () => {
    expect(rowToEvent(eventToRow(event))).toEqual(event);
  });

  it("EventTask survives toRow/fromRow", () => {
    expect(rowToEventTask(eventTaskToRow(task))).toEqual(task);
  });

  it("Expense survives toRow/fromRow", () => {
    expect(rowToExpense(expenseToRow(expense))).toEqual(expense);
  });

  it("Guest survives toRow/fromRow", () => {
    expect(rowToGuest(guestToRow(guest))).toEqual(guest);
  });

  it("falls back to a sensible default when a row is missing optional fields", () => {
    const minimal = rowToEvent(["ev2", "Untitled"]);
    expect(minimal.priority).toBe("Medium");
    expect(minimal.budget).toBe(0);
    expect(minimal.status).toBe("");
  });

  it("an event row missing endDate falls back to startDate (never a blank/invalid range)", () => {
    const row = eventToRow(event);
    row[6] = ""; // blank out endDate
    const parsed = rowToEvent(row);
    expect(parsed.endDate).toBe(event.startDate);
  });

  it("every tab's header list has no duplicate columns", () => {
    for (const tab of Object.values(TAB)) {
      const headers = HEADERS[tab];
      expect(new Set(headers).size).toBe(headers.length);
    }
  });

  it("row width always matches its tab's header width", () => {
    expect(eventToRow(event).length).toBe(HEADERS[TAB.Events].length);
    expect(eventTaskToRow(task).length).toBe(HEADERS[TAB.EventTasks].length);
    expect(expenseToRow(expense).length).toBe(HEADERS[TAB.Expenses].length);
  });
});
