import { describe, expect, it } from "vitest";
import { divergenceCopy, selfDifferences, selfPortrait } from "./another-you";

describe("another you comparison", () => {
  const origin = selfPortrait({ summary: "Quiet, but curious.", want: "a bakery", fear: "being forgotten", strangers: "careful", advice: "listens" });

  it("shows only changes supported by saved selves", () => {
    const changes = selfDifferences(origin, { ...origin, want: "a home", strangers: "open" });
    expect(changes.map((change) => change.key)).toEqual(["want", "strangers"]);
    expect(changes[0]).toMatchObject({ before: "a bakery", now: "a home" });
  });

  it("does not invent empty differences", () => {
    expect(selfDifferences(selfPortrait({ want: "a home" }), selfPortrait({ want: "", fear: "storms" }))).toEqual([]);
    expect(divergenceCopy(0).title).toContain("you");
    expect(divergenceCopy(4).label).toBe("A life of their own");
  });
});
