import { describe, expect, it } from "vitest";
import { MockBrain } from "@unwatched/cognition";
import { Metrics, costOf } from "../src/ops.ts";

const call = (o: Partial<Parameters<typeof costOf>[0]> = {}) => ({ agentId: "a", kind: "action_proposal" as const, model: "anthropic/claude-sonnet-5", promptTokens: 0, completionTokens: 0, cachedTokens: 0, costUsd: null, ...o });

describe("the day's spend and its ceiling", () => {
  it("counts what the provider billed, and prices what it did not", () => {
    expect(costOf(call({ costUsd: 0.25 }))).toBe(0.25);
    expect(costOf(call({ model: "claude-sonnet-5-20260401", promptTokens: 1_000_000, completionTokens: 100_000 }))).toBeCloseTo(2 + 1, 6);
    // cache reads cost a tenth of fresh input
    expect(costOf(call({ model: "anthropic/claude-haiku-4.5", promptTokens: 1_000_000, cachedTokens: 1_000_000 }))).toBeCloseTo(0.1, 6);
    // an unknown model is priced high, so it trips the ceiling early rather than late
    expect(costOf(call({ model: "someone/new-model", promptTokens: 1_000_000 }))).toBeGreaterThanOrEqual(5);
  });
  it("counts the world and subscribers toward the ceiling, and owners' own keys apart", () => {
    const m = new Metrics(new MockBrain(1), () => ({ day: 3, hour: 9, t: 3 * 1440 + 540 }));
    m.record(call({ costUsd: 1.5 }), "world");
    m.record(call({ costUsd: 2 }), "subscriber");
    m.record(call({ costUsd: 7 }), "user_key");
    const today = m.today(3);
    expect(today.cost).toBeCloseTo(3.5, 6);
    expect(today.userKeyCost).toBeCloseTo(7, 6);
  });
  it("carries what was spent before a restart into the same day only", () => {
    const m = new Metrics(new MockBrain(1), () => ({ day: 3, hour: 9, t: 3 * 1440 + 540 }));
    m.carry(3, 40);
    m.record(call({ costUsd: 1 }), "world");
    expect(m.today(3).cost).toBeCloseTo(41, 6);
    expect(m.today(4).cost).toBe(0);
  });
  it("attributes concurrent calls to the right model, each by its own report", () => {
    const m = new Metrics(new MockBrain(1), () => ({ day: 1, hour: 6, t: 360 }));
    // two calls finishing in either order: each report carries its own model and tokens
    m.record(call({ model: "claude-opus-5", promptTokens: 1_000_000 }), "world");
    m.record(call({ model: "claude-haiku-4-5", promptTokens: 1_000_000 }), "world");
    expect(m.today(1).cost).toBeCloseTo(5 + 1, 6);
  });
});
