// Seat geometry for the Seating Chart. Pure math, no DOM — given a room's
// shape and seat count, returns where each seat sits as a percentage (0..100)
// within that room's own square bounding box, so the screen can position a
// seat dot with `left: ${xPct}%, top: ${yPct}%` regardless of how big the
// room renders on screen. Seat index in the returned array IS the seat's
// identity — Guest.seatIndex indexes directly into it.

import type { RoomShape } from "./types";

export interface SeatPoint {
  xPct: number;
  yPct: number;
}

const ROUND_RADIUS_PCT = 42; // leaves room inside the 0..100 box for the seat dot itself
const RECT_EDGE_MARGIN_PCT = 12;

/**
 * Evenly spaces `count` points around a circle, starting at 12 o'clock and
 * going clockwise — matches how a real round table's place settings read.
 */
function roundSeats(count: number): SeatPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      xPct: 50 + ROUND_RADIUS_PCT * Math.cos(angle),
      yPct: 50 + ROUND_RADIUS_PCT * Math.sin(angle),
    };
  });
}

function evenlySpread(index: number, count: number): number {
  if (count === 1) return 50;
  return RECT_EDGE_MARGIN_PCT + (index * (100 - 2 * RECT_EDGE_MARGIN_PCT)) / (count - 1);
}

/**
 * Spaces `count` seats clockwise around all four edges of a rectangular room
 * — top, right, bottom, left — like place settings around a real table
 * rather than two facing rows. Extra seats (count not divisible by 4) land on
 * the earlier edges first, same leans-toward-the-head idea the old two-row
 * split used.
 */
function rectangleSeats(count: number): SeatPoint[] {
  if (count <= 0) return [];
  const base = Math.floor(count / 4);
  const extra = count % 4;
  const perSide = [0, 1, 2, 3].map((i) => base + (i < extra ? 1 : 0));
  const [top, right, bottom, left] = perSide;
  const points: SeatPoint[] = [];
  for (let i = 0; i < top; i++) points.push({ xPct: evenlySpread(i, top), yPct: 6 });
  for (let i = 0; i < right; i++) points.push({ xPct: 94, yPct: evenlySpread(i, right) });
  for (let i = 0; i < bottom; i++) points.push({ xPct: evenlySpread(bottom - 1 - i, bottom), yPct: 94 });
  for (let i = 0; i < left; i++) points.push({ xPct: 6, yPct: evenlySpread(left - 1 - i, left) });
  return points;
}

export function seatPositions(shape: RoomShape, seatCount: number): SeatPoint[] {
  if (!Number.isFinite(seatCount) || seatCount <= 0) return [];
  const count = Math.floor(seatCount);
  return shape === "round" ? roundSeats(count) : rectangleSeats(count);
}
