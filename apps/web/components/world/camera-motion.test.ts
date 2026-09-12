import { describe, expect, it } from "vitest";
import { coast, previewZoom } from "./camera-motion";

describe("camera preview zoom", () => {
  it("keeps missing and invalid values out of camera targets", () => {
    for (const value of [null, undefined, "", " ", "0", "-1", "Infinity", "bad"]) expect(previewZoom(value)).toBeNaN();
  });
  it("preserves valid views and clamps extreme links", () => {
    expect(previewZoom("1.15")).toBe(1.15);
    expect(previewZoom("0.1")).toBe(0.55);
    expect(previewZoom("10")).toBe(1.9);
  });
});

describe("camera coasting", () => {
  it("travels the same distance across different frame rates", () => {
    function travel(step: number) {
      let velocity = 20, distance = 0;
      for (let elapsed = 0; elapsed < 60; elapsed += step) {
        const next = coast(velocity, step); velocity = next.velocity; distance += next.distance;
      }
      return distance;
    }
    expect(travel(2)).toBeCloseTo(travel(1), 8);
    expect(travel(0.5)).toBeCloseTo(travel(1), 8);
  });
  it("does not move during a zero-duration frame and bounds stalled frames", () => {
    expect(coast(10, 0)).toEqual({ distance: 0, velocity: 10 });
    expect(coast(-10, 100)).toEqual(coast(-10, 3));
  });
});
