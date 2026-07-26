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
const SPREAD_MARGIN_PCT = 26; // keeps a side's outermost seat well clear of the corner —
// close enough to the corner and it'd sit inside the table card's rounded-corner
// recess, reading as "floating" off the table instead of seated against an edge,
// and it'd also crowd the perpendicular side's own outermost seat (see below).

// How far a square/rectangle's seat ring sits inside the 0..100 box, on both
// axes. Square rooms are a plain 132x132 box with a uniform 26px shape inset
// (see .seatroom--square in base.css); rectangle rooms are wider than tall
// (176x116, asymmetric inset) — different pixel geometry per shape, but each
// constant here is tuned so the seat ring still lands in the gap just outside
// the shape on EITHER axis. If either shape's box size or inset changes in
// base.css, recheck these still center there.
const SQUARE_FIXED_INSET_PCT = 6;
const RECT_FIXED_INSET_PCT = 7;

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

// Position of seat `index` of `count` along one side, stopping well short of
// either end (a lone seat centers on the side rather than sitting in a corner).
function sidePosition(index: number, count: number): number {
  if (count === 1) return 50;
  return SPREAD_MARGIN_PCT + (index * (100 - 2 * SPREAD_MARGIN_PCT)) / (count - 1);
}

/**
 * Deals `count` seats round-robin across the four sides of a square or
 * rectangular room — top, bottom, right, left, in that priority order —
 * like a real table: 1 seat centers on one side, 2 face each other across
 * the long sides, 4 gives one per side, and only larger counts start
 * doubling up a side. Each side then places its own seats independently,
 * well clear of its corners (see SPREAD_MARGIN_PCT), which is what keeps two
 * different sides' seats from bunching up near a shared corner — the
 * failure mode a single continuous ring around the perimeter runs into
 * (a seat can land exactly on the corner for some seat counts).
 */
function fourSidedSeats(count: number, fixedInset: number): SeatPoint[] {
  if (count <= 0) return [];
  const perSide = [0, 0, 0, 0]; // top, bottom, right, left
  for (let i = 0; i < count; i++) perSide[i % 4]++;
  const [top, bottom, right, left] = perSide;
  const points: SeatPoint[] = [];
  for (let i = 0; i < top; i++) points.push({ xPct: sidePosition(i, top), yPct: fixedInset });
  for (let i = 0; i < bottom; i++) points.push({ xPct: sidePosition(i, bottom), yPct: 100 - fixedInset });
  for (let i = 0; i < right; i++) points.push({ xPct: 100 - fixedInset, yPct: sidePosition(i, right) });
  for (let i = 0; i < left; i++) points.push({ xPct: fixedInset, yPct: sidePosition(i, left) });
  return points;
}

export function seatPositions(shape: RoomShape, seatCount: number): SeatPoint[] {
  if (!Number.isFinite(seatCount) || seatCount <= 0) return [];
  const count = Math.floor(seatCount);
  if (shape === "round") return roundSeats(count);
  return fourSidedSeats(count, shape === "square" ? SQUARE_FIXED_INSET_PCT : RECT_FIXED_INSET_PCT);
}
