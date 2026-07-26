import { createCrud } from "./crud";
import type { Expense } from "../lib/types";
import { todayISO } from "../lib/dates";

export const useExpenses = createCrud<Expense>("expenses", () => ({
  eventId: "",
  date: todayISO(),
  amount: 0,
  category: "",
  details: "",
}));
