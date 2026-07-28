// First-run / demo sample data — a realistic slate of events spanning the
// current and next month, some single-day, some multi-day, across every
// category/status/priority so every screen (Calendar's multi-day bars,
// Dashboard's charts, Budget vs Actual) has something real to show.

import { newId, nowIso } from "./id";
import { addDaysISO, todayISO } from "./dates";
import type { EventItem, EventTask, Expense, Guest, Room } from "./types";

export interface Seed {
  events: EventItem[];
  eventTasks: EventTask[];
  expenses: Expense[];
  rooms: Room[];
  guests: Guest[];
}

function event(
  offsetStart: number,
  span: number,
  fields: Partial<EventItem> & Pick<EventItem, "name" | "category" | "type" | "priority" | "status">
): EventItem {
  const ts = nowIso();
  const startDate = addDaysISO(todayISO(), offsetStart);
  const endDate = addDaysISO(startDate, Math.max(0, span - 1));
  return {
    id: newId(),
    startDate,
    startTime: "",
    endDate,
    endTime: "",
    marketRegion: "",
    location: "",
    state: "",
    owner: "",
    budget: 0,
    details: "",
    notes: "",
    createdAt: ts,
    updatedAt: ts,
    ...fields,
  };
}

export function buildSample(): Seed {
  const ts = nowIso();

  const techSummit = event(-2, 4, {
    name: "Tech Summit",
    category: "Conference",
    type: "Corporate",
    marketRegion: "New York City, NY",
    location: "45 Liberty Rd.",
    state: "New York",
    owner: "John Carter",
    priority: "VeryHigh",
    status: "Active",
    budget: 8500,
  });
  const musical = event(-1, 4, {
    name: "Musical Showcase",
    category: "Concert",
    type: "Social",
    marketRegion: "Chicago, IL",
    location: "12 Garden Ln.",
    state: "Illinois",
    owner: "Sophia Wilson",
    priority: "Medium",
    status: "Confirmed",
    budget: 6200,
  });
  const codeItUp = event(2, 3, {
    name: "Code It Up Hackathon",
    category: "Conference",
    type: "Educational",
    marketRegion: "Miami, FL",
    location: "89 Sunset Dr.",
    state: "Florida",
    owner: "Sophia Wilson",
    priority: "Low",
    status: "Prospect",
    budget: 9200,
  });
  const symphoria = event(4, 2, {
    name: "Symphoria Night",
    category: "Concert",
    type: "Community",
    marketRegion: "Dallas, TX",
    location: "67 Main St.",
    state: "Texas",
    owner: "David Brown",
    priority: "Low",
    status: "Active",
    budget: 4800,
  });
  const lollaPalooza = event(11, 1, {
    name: "Lolla Palooza",
    category: "Concert",
    type: "Educational",
    marketRegion: "Las Vegas, NV",
    location: "23 Oak Ave.",
    state: "Texas",
    owner: "Sarah Williams",
    priority: "OnHold",
    status: "Confirmed",
    budget: 5900,
  });
  const bridalShow = event(16, 2, {
    name: "Bridal Show",
    category: "Wedding",
    type: "Virtual",
    marketRegion: "Atlanta, GA",
    location: "14 River Rd.",
    state: "Georgia",
    owner: "John Carter",
    priority: "OnHold",
    status: "Active",
    budget: 9700,
  });
  const beatFest = event(13, 2, {
    name: "Beat Fest",
    category: "Concert",
    type: "Social",
    marketRegion: "Los Angeles, CA",
    location: "72 Elm Rd.",
    state: "California",
    owner: "Sarah Williams",
    priority: "High",
    status: "Complete",
    budget: 5800,
  });
  const springGala = event(21, 1, {
    name: "Spring Gala",
    category: "Corporate",
    type: "Corporate",
    marketRegion: "Washington, D.C.",
    location: "56 Broadway Ave.",
    state: "Pennsylvania",
    owner: "Jessica Miller",
    priority: "Medium",
    status: "Tentative",
    budget: 9400,
  });
  const vowsDay = event(24, 2, {
    name: "Vows Day",
    category: "Wedding",
    type: "Social",
    marketRegion: "Dallas, TX",
    location: "25 Cherry Ln.",
    state: "New York",
    owner: "Jessica Miller",
    priority: "VeryHigh",
    status: "Prospect",
    budget: 8300,
  });
  const babyShower = event(-6, 1, {
    name: "Willow's Baby Shower",
    category: "Baby Shower",
    type: "Social",
    marketRegion: "Seattle, WA",
    location: "78 Hillcrest St.",
    state: "Ohio",
    owner: "Michael Smith",
    priority: "Low",
    status: "Complete",
    budget: 1500,
  });
  const knotDay = event(28, 1, {
    name: "Knot Day",
    category: "Wedding",
    type: "Corporate",
    marketRegion: "Atlanta, GA",
    location: "22 Meadow St.",
    state: "Georgia",
    owner: "Matthew Davis",
    priority: "VeryHigh",
    status: "Active",
    budget: 6300,
  });

  const events = [
    techSummit, musical, codeItUp, symphoria, lollaPalooza, bridalShow,
    beatFest, springGala, vowsDay, babyShower, knotDay,
  ];

  function task(
    eventId: string,
    task: string,
    priority: EventTask["priority"],
    status: EventTask["status"],
    dueOffset: number,
    assignedTo: string
  ): EventTask {
    return {
      id: newId(),
      eventId,
      task,
      priority,
      status,
      dueDate: addDaysISO(todayISO(), dueOffset),
      assignedTo,
      notes: "",
      createdAt: ts,
      updatedAt: ts,
    };
  }

  const eventTasks: EventTask[] = [
    task(techSummit.id, "Decoration Setup", "High", "NotStarted", -1, "Emily Johnson"),
    task(techSummit.id, "Seating Arrangement", "High", "Cancelled", -2, "David Brown"),
    task(techSummit.id, "Security Briefing", "Low", "NotStarted", 1, "John Carter"),
    task(techSummit.id, "Sound Check", "OnHold", "InProgress", 3, "Olivia Taylor"),
    task(musical.id, "Costume Preparation", "VeryLow", "OnHold", -1, "Matthew Davis"),
    task(musical.id, "Lighting Arrangement", "Medium", "NotStarted", 5, "Sophia Wilson"),
    task(codeItUp.id, "Mic Testing", "Medium", "NotStarted", 4, "Jessica Miller"),
    task(codeItUp.id, "Banner Placement", "VeryHigh", "OnHold", 2, "Olivia Taylor"),
    task(bridalShow.id, "Photography Setup", "Low", "InProgress", 15, "Sarah Williams"),
    task(bridalShow.id, "Final Script Review", "Low", "Review", 14, "David Brown"),
    task(springGala.id, "Props Management", "High", "Review", 19, "David Brown"),
    task(vowsDay.id, "Rehearsal Coordination", "OnHold", "OnHold", 23, "Michael Smith"),
  ];

  function expense(eventId: string, dateOffset: number, amount: number, category: string, details: string): Expense {
    return {
      id: newId(),
      eventId,
      date: addDaysISO(todayISO(), dateOffset),
      amount,
      category,
      details,
      createdAt: ts,
      updatedAt: ts,
    };
  }

  const expenses: Expense[] = [
    expense(techSummit.id, -1, 3200, "Venue", "Venue booking"),
    expense(techSummit.id, 0, 1330, "Miscellaneous", "Event setup"),
    expense(techSummit.id, 1, 2300, "Catering", "Catering charges"),
    expense(techSummit.id, 2, 1000, "Entertainment", "Lighting hire"),
    expense(musical.id, -1, 1800, "Entertainment", "Stage crew"),
    expense(musical.id, 1, 900, "Decor", "Rentals"),
    expense(symphoria.id, 4, 2400, "Entertainment", "Orchestra booking"),
    expense(beatFest.id, 13, 5800, "Entertainment", "Headliner fee"),
    expense(babyShower.id, -6, 850, "Decor", "Decorations + catering"),
  ];

  // ---- Seating Chart sample: Vows Day's wedding floor plan ----
  // Rooms are free-named by the user — "Head Table"/"Family Table" are
  // natural wedding labels even though the underlying entity is a Room.
  function room(name: string, shape: Room["shape"], seats: number, x: number, y: number): Room {
    return { id: newId(), eventId: vowsDay.id, name, shape, seats, x, y, createdAt: ts, updatedAt: ts };
  }
  const headTable = room("Head Table", "rectangle", 6, 50, 14);
  const familyTable = room("Family Table", "round", 8, 22, 55);
  const friendsTable = room("Friends Table", "round", 8, 50, 62);
  const table4 = room("Table 4", "round", 6, 78, 55);
  const rooms: Room[] = [headTable, familyTable, friendsTable, table4];

  function guest(
    eventId: string,
    name: string,
    roomId: string,
    seatIndex: number,
    arrivalTime = "",
    notes = "",
    arrived = false
  ): Guest {
    return { id: newId(), eventId, name, roomId, seatIndex, arrivalTime, arrived, notes, createdAt: ts, updatedAt: ts };
  }
  const weddingGuests: Guest[] = [
    guest(vowsDay.id, "Jessica Miller", headTable.id, 0, "13:00", "Bride"),
    guest(vowsDay.id, "David Brown", headTable.id, 1, "13:00", "Groom"),
    guest(vowsDay.id, "Sarah Williams", headTable.id, 2, "13:00", "Maid of honor"),
    guest(vowsDay.id, "Matthew Davis", headTable.id, 3, "13:00", "Best man"),
    guest(vowsDay.id, "Olivia Taylor", familyTable.id, 0, "14:00"),
    guest(vowsDay.id, "John Carter", familyTable.id, 1, "14:00"),
    guest(vowsDay.id, "Sophia Wilson", familyTable.id, 2, "14:15"),
    guest(vowsDay.id, "Michael Smith", familyTable.id, 3, "14:15", "Vegetarian"),
    guest(vowsDay.id, "Emily Johnson", friendsTable.id, 0, "14:30"),
    guest(vowsDay.id, "Chris Anderson", friendsTable.id, 1, "14:30"),
    guest(vowsDay.id, "Priya Patel", friendsTable.id, 2, "14:30", "Gluten-free"),
    guest(vowsDay.id, "Marcus Lee", table4.id, 0, "14:45"),
    guest(vowsDay.id, "Grace Kim", table4.id, 1, "14:45"),
    guest(vowsDay.id, "Noah Rivera", "", -1),
    guest(vowsDay.id, "Ava Thompson", "", -1, "", "+1"),
  ];

  // ---- Live-feed sample: Tech Summit's registration desk ----
  // Tech Summit (offset -2, span 4) is always "live" the moment the demo
  // loads, so this is the roster that actually shows up in the Sidebar/
  // LiveTicker's rotating feed. A conference check-in list rather than a
  // seating chart on purpose — attendees don't need assigned seats, just an
  // arrival record — so every guest here stays unseated (roomId "").
  // Deliberately staggered across 3 states so the feed demonstrates all of
  // them at once: already checked in (`arrived: true`, feed skips them),
  // checking in right now, and checking in later — plus one walk-up with no
  // pre-registered time at all, same as Vows Day's Noah/Ava above.
  function attendee(name: string, arrivalTime: string, arrived: boolean, notes = ""): Guest {
    return guest(techSummit.id, name, "", -1, arrivalTime, notes, arrived);
  }
  const registrationDesk: Guest[] = [
    // Already checked in — Live feed correctly has nothing to say about these.
    attendee("Grace Liu", "08:00", true, "Speaker"),
    attendee("Daniel Osei", "08:10", true),
    attendee("Priya Nair", "08:20", true, "Sponsor"),
    attendee("Tomas Herrera", "08:30", true),
    attendee("Hannah Fischer", "08:40", true),
    // Still arriving — this is the pool the Live feed actually draws from.
    attendee("Marcus Webb", "08:50", false),
    attendee("Ling Zhao", "09:00", false, "Press"),
    attendee("Aiden Murphy", "09:05", false),
    attendee("Freya Larsen", "09:15", false),
    attendee("Diego Alvarez", "09:30", false),
    attendee("Chloe Bennett", "09:40", false),
    attendee("Omar Farouk", "09:50", false, "Sponsor"),
    attendee("Ingrid Solberg", "10:00", false),
    attendee("Kwame Mensah", "10:15", false),
    attendee("Rosa Delgado", "10:30", false),
    // Walked up without a pre-registered slot — same convention as Vows Day's
    // Noah/Ava: a real, valid guest with no arrivalTime set.
    attendee("Leo Tanaka", "", false, "Walk-in registration"),
  ];

  const guests: Guest[] = [...weddingGuests, ...registrationDesk];

  return { events, eventTasks, expenses, rooms, guests };
}
