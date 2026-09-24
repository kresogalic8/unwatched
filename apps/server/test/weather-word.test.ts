import { describe, expect, it } from "vitest";
import { weatherWord } from "../src/realworld.ts";

describe("the coast's words for the sky", () => {
  it("names a dry gale by where it blows from", () => {
    expect(weatherWord(1, 38, 45, 70)).toBe("bura"); // north-east, gusting
    expect(weatherWord(0, 18, 60, 55)).toBe("bura"); // light between the gusts is still the bura
    expect(weatherWord(3, 30, 140, 45)).toBe("jugo"); // south-east, steady
    expect(weatherWord(0, 40, 280, 60)).toBe("wind"); // a westerly is just wind
  });
  it("keeps rain, thunder and fog before the wind", () => {
    expect(weatherWord(61, 30, 140, 50)).toBe("rain");
    expect(weatherWord(95, 60, 45, 90)).toBe("storm");
    expect(weatherWord(45, 5, 45, 10)).toBe("fog");
    expect(weatherWord(0, 8, 45, 15)).toBe("clear");
  });
});
