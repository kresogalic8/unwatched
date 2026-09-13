import { describe, expect, it } from "vitest";
import { citizenLabels } from "./ops-citizens";

describe("citizen funding labels", () => {
  it("does not treat the funded engine flag as a subscription", () => {
    expect(citizenLabels({ owner: "user", brain: "hosted", plan: "none", funded: true, credits: 0 }).ai_access).toBe("Routine only");
  });
  it("keeps world citizens and personal keys separate from subscriptions", () => {
    expect(citizenLabels({ owner: null, brain: "hosted" }).funding).toBe("World-funded");
    expect(citizenLabels({ owner: "user", brain: "own_key", plan: "none" }).funding).toBe("Personal API key");
  });
  it("accounts for purchased credits and exhausted plan allowances", () => {
    expect(citizenLabels({ owner: "user", brain: "hosted", plan: "none", credits: 5 }).ai_access).toBe("Credits available");
    const exhausted = citizenLabels({ owner: "user", brain: "hosted", plan: "patron", credits: 0 });
    expect(exhausted.subscription).toBe("Patron");
    expect(exhausted.ai_access).toBe("Routine only");
  });
  it("does not assume missing credit data means zero", () => {
    expect(citizenLabels({ owner: "user", brain: "hosted", plan: "none" }).ai_access).toContain("credits unknown");
  });
});
