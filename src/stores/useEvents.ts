import { createCrud } from "./crud";
import type { EventItem } from "../lib/types";
import { todayISO } from "../lib/dates";

export const useEvents = createCrud<EventItem>("events", () => ({
  name: "",
  category: "",
  type: "",
  startDate: todayISO(),
  startTime: "",
  endDate: todayISO(),
  endTime: "",
  marketRegion: "",
  location: "",
  state: "",
  owner: "",
  priority: "Medium",
  status: "Prospect",
  budget: 0,
  details: "",
  notes: "",
}));
