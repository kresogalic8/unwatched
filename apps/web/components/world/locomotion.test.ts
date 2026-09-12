import { describe, expect, it } from "vitest";
import { advanceWalk, walkFacing } from "./locomotion";

describe("world locomotion", () => {
  it("accelerates and brakes to the target without overshooting at different refresh rates", () => {
    const arrivals: number[] = [];
    for (const hz of [30, 60, 120]) {
      let remaining = 180, speed = 0, peak = 0, t = 0;
      while (remaining > .01 && t < 10) {
        const next = advanceWalk(remaining, speed, 48, 1 / hz);
        expect(next.distance).toBeLessThanOrEqual(remaining);
        if (remaining < 2) expect(next.speed).toBeLessThan(30);
        remaining -= next.distance; speed = next.speed; peak = Math.max(peak, speed); t += 1 / hz;
      }
      expect(remaining).toBeLessThanOrEqual(.01);
      expect(peak).toBeCloseTo(48);
      arrivals.push(t);
    }
    expect(Math.max(...arrivals) - Math.min(...arrivals)).toBeLessThan(.1);
  });
  it("holds the facing within the diagonal dead band", () => {
    expect(walkFacing(10, 13, "right")).toBe("right");
    expect(walkFacing(10, 13, "front")).toBe("front");
    expect(walkFacing(10, 16, "right")).toBe("front");
    expect(walkFacing(-10, 9, "front")).toBe("left");
  });
});
