import { createCrud } from "./crud";
import type { EventTask } from "../lib/types";

export const useEventTasks = createCrud<EventTask>("eventTasks", () => ({
  eventId: "",
  task: "",
  priority: "Medium",
  status: "NotStarted",
  dueDate: "",
  assignedTo: "",
  notes: "",
}));
