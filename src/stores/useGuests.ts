import { createCrud } from "./crud";
import type { Guest } from "../lib/types";

export const useGuests = createCrud<Guest>("guests", () => ({
  eventId: "",
  name: "",
  roomId: "",
  seatIndex: -1,
  arrivalTime: "",
  arrived: false,
  notes: "",
}));
