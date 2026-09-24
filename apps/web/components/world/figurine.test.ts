import { describe, expect, it } from "vitest";
import { Figurine } from "./figurine";
import type { Look, Pose } from "./citizen";

const look: Look = { build: "Average", hair: "Short dark", top: "Teal", bottom: "Kelp", hat: "None", carrying: "Nothing", coral: "None" };
const POSES: Pose[] = ["idle", "walk", "run", "sleep", "sit", "talk", "work", "crouch", "read", "write", "eat", "drink", "greet", "argue"];

describe("figurine rig", () => {
  it("takes every pose the town asks for and settles in it", () => {
    for (const pose of POSES) {
      const f = new Figurine(look, 0);
      try {
        f.setPose(pose); for (let k = 0; k <= 30; k++) f.update(k / 30);
        const n = f["now"]; for (const v of Object.values(n)) expect(Number.isFinite(v)).toBe(true);
        if (pose === "sleep") expect(n.lying).toBeGreaterThan(0.9);
        if (pose === "greet") expect(n.armR).toBeLessThan(-1.5);
      } finally { f.destroy({ children: true }); }
    }
  });
  it("sits at the seat it is given, off its base", () => {
    const f = new Figurine(look, 0);
    try {
      f.seatAt(20); f.setPose("sit"); for (let k = 0; k <= 30; k++) f.update(k / 30);
      expect(f["base"].visible).toBe(false); expect(f["now"].hip).toBeCloseTo(15 - 20, 0);
    } finally { f.destroy({ children: true }); }
  });
  it("steps with the ground covered, not the clock", () => {
    const f = new Figurine(look, 0);
    try { f.setPose("walk"); f.update(0); f.travel(0); f.update(1); const still = f["gait"]; f.travel(14); f.update(1.1); expect(f["gait"] - still).toBeCloseTo(2, 5); }
    finally { f.destroy({ children: true }); }
  });
  it("turns away to show the back of the head", () => {
    const f = new Figurine(look, 0);
    try { f.facing4("back"); expect(f["faceParts"].visible).toBe(false); expect(f["backHair"].visible).toBe(true); f.face(-1); expect(f["faceParts"].visible).toBe(true); }
    finally { f.destroy({ children: true }); }
  });
});
