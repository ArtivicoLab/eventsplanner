import { describe, expect, it } from "vitest";
import { seatPositions } from "../src/lib/seating";

describe("seatPositions", () => {
  it("returns nothing for a zero or negative seat count", () => {
    expect(seatPositions("round", 0)).toEqual([]);
    expect(seatPositions("round", -3)).toEqual([]);
  });

  it("returns one point per seat", () => {
    expect(seatPositions("round", 8)).toHaveLength(8);
    expect(seatPositions("rectangle", 7)).toHaveLength(7);
  });

  it("spaces round seats evenly around the center, starting at 12 o'clock", () => {
    const pts = seatPositions("round", 4);
    // 12 o'clock: centered horizontally, above center.
    expect(pts[0].xPct).toBeCloseTo(50, 5);
    expect(pts[0].yPct).toBeLessThan(50);
    // 3 o'clock (clockwise from 12): right of center, vertically centered.
    expect(pts[1].xPct).toBeGreaterThan(50);
    expect(pts[1].yPct).toBeCloseTo(50, 5);
    // Every point sits the same distance from the center (a real circle).
    const dist = (p: { xPct: number; yPct: number }) => Math.hypot(p.xPct - 50, p.yPct - 50);
    const radii = pts.map(dist);
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 5);
  });

  it("spaces rectangle seats clockwise around all four edges, extras landing on earlier edges", () => {
    const pts = seatPositions("rectangle", 5);
    const top = pts.filter((p) => p.yPct === 6);
    const right = pts.filter((p) => p.xPct === 94);
    const bottom = pts.filter((p) => p.yPct === 94);
    const left = pts.filter((p) => p.xPct === 6);
    expect(top).toHaveLength(2);
    expect(right).toHaveLength(1);
    expect(bottom).toHaveLength(1);
    expect(left).toHaveLength(1);
  });

  it("puts one rectangle seat on each edge when there are exactly four", () => {
    const pts = seatPositions("rectangle", 4);
    expect(pts.filter((p) => p.yPct === 6)).toHaveLength(1);
    expect(pts.filter((p) => p.xPct === 94)).toHaveLength(1);
    expect(pts.filter((p) => p.yPct === 94)).toHaveLength(1);
    expect(pts.filter((p) => p.xPct === 6)).toHaveLength(1);
  });

  it("keeps every rectangle seat within the 0..100 box with margin", () => {
    for (const p of seatPositions("rectangle", 10)) {
      expect(p.xPct).toBeGreaterThanOrEqual(0);
      expect(p.xPct).toBeLessThanOrEqual(100);
    }
  });

  it("floors a fractional seat count instead of producing a partial seat", () => {
    expect(seatPositions("round", 4.9)).toHaveLength(4);
  });
});
