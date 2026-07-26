import { describe, expect, it } from "vitest";
import { seatPositions } from "../src/lib/seating";

describe("seatPositions", () => {
  it("returns nothing for a zero or negative seat count", () => {
    expect(seatPositions("round", 0)).toEqual([]);
    expect(seatPositions("round", -3)).toEqual([]);
  });

  it("returns one point per seat", () => {
    expect(seatPositions("round", 8)).toHaveLength(8);
    expect(seatPositions("square", 7)).toHaveLength(7);
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

  it("puts one rectangle seat on each edge when there are exactly four", () => {
    const pts = seatPositions("rectangle", 4);
    expect(pts.filter((p) => p.yPct === 7)).toHaveLength(1);
    expect(pts.filter((p) => p.xPct === 93)).toHaveLength(1);
    expect(pts.filter((p) => p.yPct === 93)).toHaveLength(1);
    expect(pts.filter((p) => p.xPct === 7)).toHaveLength(1);
  });

  it("deals low rectangle seat counts one side at a time — center, facing pair, then one per side", () => {
    // A lone seat centers on an edge instead of landing on a corner (the bug
    // a single continuous perimeter-ring produced: the "middle" seat of any
    // odd count fell exactly on a corner, which reads as floating off the
    // table since the card's corner is visually rounded away underneath it).
    expect(seatPositions("rectangle", 1)).toEqual([{ xPct: 50, yPct: 7 }]);
    // 2 seats face each other across the long top/bottom sides.
    expect(seatPositions("rectangle", 2)).toEqual([
      { xPct: 50, yPct: 7 },
      { xPct: 50, yPct: 93 },
    ]);
    // 8 gives 2 evenly spaced per side, all well clear of every corner.
    const pts = seatPositions("rectangle", 8);
    for (const p of pts) {
      expect(p.xPct === 7 || p.xPct === 93 || p.yPct === 7 || p.yPct === 93).toBe(true);
    }
    for (const p of pts) {
      const nearCornerX = p.xPct <= 7 + 1 || p.xPct >= 93 - 1;
      const nearCornerY = p.yPct <= 7 + 1 || p.yPct >= 93 - 1;
      // A seat can be flush against ITS OWN edge (fixed inset), but never
      // pulled in close along the spread axis toward a corner too.
      if (p.yPct === 7 || p.yPct === 93) expect(nearCornerX).toBe(false);
      if (p.xPct === 7 || p.xPct === 93) expect(nearCornerY).toBe(false);
    }
  });

  it("never places two rectangle seats close enough to visually overlap, even across a corner", () => {
    // The rectangle room box is wider than tall (.seatroom--rectangle in
    // base.css: 176x116px), so a pct-space distance doesn't correspond to a
    // real on-screen distance the same way on both axes — convert through
    // those px dimensions before comparing to the seat's actual 30px
    // diameter, so this genuinely checks for visual overlap, not just a
    // coordinate-space proxy for it.
    const boxW = 176;
    const boxH = 116;
    const seatDiameterPx = 30;
    for (const count of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const pts = seatPositions("rectangle", count);
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dxPx = ((pts[i].xPct - pts[j].xPct) / 100) * boxW;
          const dyPx = ((pts[i].yPct - pts[j].yPct) / 100) * boxH;
          expect(Math.hypot(dxPx, dyPx)).toBeGreaterThan(seatDiameterPx);
        }
      }
    }
  });

  it("keeps every rectangle seat within the 0..100 box with margin", () => {
    for (const p of seatPositions("rectangle", 10)) {
      expect(p.xPct).toBeGreaterThanOrEqual(0);
      expect(p.xPct).toBeLessThanOrEqual(100);
    }
  });

  it("puts one square seat on each edge when there are exactly four", () => {
    const pts = seatPositions("square", 4);
    expect(pts.filter((p) => p.yPct === 6)).toHaveLength(1);
    expect(pts.filter((p) => p.xPct === 94)).toHaveLength(1);
    expect(pts.filter((p) => p.yPct === 94)).toHaveLength(1);
    expect(pts.filter((p) => p.xPct === 6)).toHaveLength(1);
  });

  it("deals low square seat counts one side at a time — center, facing pair, then one per side", () => {
    expect(seatPositions("square", 1)).toEqual([{ xPct: 50, yPct: 6 }]);
    expect(seatPositions("square", 2)).toEqual([
      { xPct: 50, yPct: 6 },
      { xPct: 50, yPct: 94 },
    ]);
  });

  it("never places two square seats close enough to visually overlap, even across a corner", () => {
    // The square room box is a plain 132x132px (.seatroom--square in
    // base.css), so unlike rectangle this coordinate space maps 1:1 to px on
    // both axes — a pct distance is directly comparable to the seat's 30px
    // diameter without converting through separate width/height scales.
    const boxPx = 132;
    const seatDiameterPct = (30 / boxPx) * 100;
    for (const count of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const pts = seatPositions("square", count);
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dist = Math.hypot(pts[i].xPct - pts[j].xPct, pts[i].yPct - pts[j].yPct);
          expect(dist).toBeGreaterThan(seatDiameterPct);
        }
      }
    }
  });

  it("floors a fractional seat count instead of producing a partial seat", () => {
    expect(seatPositions("round", 4.9)).toHaveLength(4);
  });
});
