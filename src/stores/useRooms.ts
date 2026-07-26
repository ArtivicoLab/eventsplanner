import { createCrud } from "./crud";
import type { Room } from "../lib/types";

export const useRooms = createCrud<Room>("rooms", () => ({
  eventId: "",
  name: "",
  shape: "round",
  seats: 8,
  x: 50,
  y: 50,
}));
