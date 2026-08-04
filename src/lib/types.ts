// Domain types — mirror the Google Sheet schema (see schema.ts).

// Six-level scale (not the usual five) to match the reference product's own
// Priority legend: Very High, High, Medium, Low, Very Low, On Hold. Shared by
// both Events and Event Tasks.
export type Priority = "VeryHigh" | "High" | "Medium" | "Low" | "VeryLow" | "OnHold";
export const PRIORITIES: Priority[] = ["VeryHigh", "High", "Medium", "Low", "VeryLow", "OnHold"];

export type TaskStatus = "NotStarted" | "InProgress" | "Review" | "OnHold" | "Cancelled" | "Complete";
export const TASK_STATUSES: TaskStatus[] = [
  "NotStarted",
  "InProgress",
  "Review",
  "OnHold",
  "Cancelled",
  "Complete",
];

/**
 * A single event on the calendar — the core record of the app. `status` is a
 * free string, not a fixed union: it references one of `Settings.eventStatuses`
 * (Setup-customizable, like `category`/`type`/`state`/`marketRegion`/`owner`
 * below), not a hardcoded enum, mirroring the reference product's own
 * "Event Status: customize based on your workflow" Setup panel.
 */
export interface EventItem {
  id: string;
  name: string;
  category: string;
  type: string;
  startDate: string; // ISO yyyy-mm-dd
  startTime: string; // "HH:mm" or "" (all-day / unspecified)
  endDate: string; // ISO yyyy-mm-dd, >= startDate — multi-day events span the calendar
  endTime: string;
  marketRegion: string; // e.g. "Austin, TX" — free text, Setup-suggested
  location: string;
  state: string;
  owner: string;
  priority: Priority;
  status: string;
  budget: number;
  details: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** A task tracked against a specific event (Event Task Tracker). */
export interface EventTask {
  id: string;
  eventId: string;
  task: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string; // ISO yyyy-mm-dd, "" allowed
  assignedTo: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** A single expense line logged against an event (Event Budget). */
export interface Expense {
  id: string;
  eventId: string;
  date: string; // ISO yyyy-mm-dd
  amount: number;
  category: string; // "" allowed, picklist lives in Settings.expenseCategories
  details: string;
  createdAt: string;
  updatedAt: string;
}

export type RoomShape = "round" | "square" | "rectangle";

/** A room (a table/pod of seats) on an event's Seating Chart. Seats around
    it are computed, not stored — see lib/seating.ts's
    seatPositions(shape, seats). `x`/`y` are percentages (0..100) of the
    seating canvas, so the layout is resolution-independent. The `name` is
    free text — "Table 1", "Head Table", "VIP Room" are all valid room names. */
export interface Room {
  id: string;
  eventId: string;
  name: string; // "Table 1", "Head Table"
  shape: RoomShape;
  seats: number; // total seat count
  x: number; // 0..100, canvas position
  y: number; // 0..100, canvas position
  createdAt: string;
  updatedAt: string;
}

/**
 * A guest on an event's Seating Chart. The guest record is the ONLY source
 * of truth for seat occupancy — there is no separate "seat" entity to keep
 * in sync. `roomId` "" means unseated. `seatIndex` indexes into that
 * room's own seatPositions(shape, seats) array; it's meaningless while
 * roomId is "".
 */
export interface Guest {
  id: string;
  eventId: string;
  name: string;
  roomId: string; // "" = unseated
  seatIndex: number;
  arrivalTime: string; // "HH:mm", "" = not set — same free-form convention as Event's startTime/endTime
  // Whether this guest has actually checked in, distinct from `arrivalTime`
  // (their scheduled/expected time). Toggled by hand at the door — the app
  // has no way to detect a real-world arrival on its own. Once true, the
  // Live feed stops surfacing them as "arriving soon" (see useLiveFeed.ts).
  arrived: boolean;
  notes: string; // dietary notes, +1, etc.
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  name: string; // what to call the user in greetings ("" = not set yet)
  currency: string;
  weekStart: 0 | 1; // 0 = Sunday, 1 = Monday
  theme: "auto" | "light" | "dark";
  // ---- Setup lists (all user-editable: add/rename/remove), see SettingsScreen ----
  categories: string[];
  categoryColors: Record<string, string>; // category name -> chosen swatch token
  eventTypes: string[];
  marketRegions: string[];
  states: string[];
  owners: string[]; // team-member names — feeds Event "Owner" + Task "Assigned To"
  eventStatuses: string[]; // Event Tracker's status picklist
  eventStatusIcons: Record<string, string>; // status label -> icon name (see components/icons.tsx NAMED_ICONS)
  expenseCategories: string[]; // Expense Tracker's category picklist (Venue, Catering, ...)
  accessCode: string; // Etsy purchase code the buyer entered ("" = not activated)
  activated: boolean; // true once a valid accessCode was entered — unlocks Google Sheets connect
  // Which Google account the Sheets connection last WORKED with ("" = never
  // connected). Someone with several Google accounts otherwise ends up
  // guessing at the account picker on every reauth — this is surfaced on the
  // sync pill, Sidebar footer, and Settings so the right email is always one
  // glance away. Recorded only after a successful sheet operation (never from
  // a failed/wrong-account attempt), local-only like every per-device field.
  googleAccountEmail: string;
}

export const DEFAULT_CATEGORIES = [
  "Wedding",
  "Corporate",
  "Concert",
  "Conference",
  "Birthday",
  "Baby Shower",
];

export const DEFAULT_EVENT_TYPES = ["Corporate", "Social", "Community", "Sporting", "Educational", "Virtual"];

export const DEFAULT_STATES = [
  "California",
  "Texas",
  "New York",
  "Florida",
  "Illinois",
  "Pennsylvania",
  "Ohio",
  "Georgia",
];

// Order mirrors the reference product's own Event Status legend.
export const DEFAULT_EVENT_STATUSES = ["Prospect", "Tentative", "Confirmed", "Active", "Complete", "Cancelled"];

export const DEFAULT_EVENT_STATUS_ICONS: Record<string, string> = {
  Prospect: "trending-up",
  Tentative: "file-clock",
  Confirmed: "badge-check",
  Active: "zap",
  Complete: "check-circle-2",
  Cancelled: "x-circle",
};

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Venue",
  "Catering",
  "Decor",
  "Entertainment",
  "Photography",
  "Attire",
  "Invitations",
  "Favors",
  "Miscellaneous",
];
