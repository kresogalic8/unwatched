import { describe, expect, it } from "vitest";
import { Town, type Brain, type ReflectContext } from "../src/index.ts";
import { memoryForMind } from "../src/memory.ts";

const persona = (name: string) => ({ name, age: 30, origin: "mainland", summary: "A builder", want: "Fix the mill roof", fear: "hunger", secret: "I think the roof is broken", strangers: "polite", advice: "check", traits: { warmth: .5, pride: .5, caution: .5, honesty: .5, ambition: .5 } });
const brain: Brain = {
  name: "grounding-test",
  async decide() { return { action: { kind: "wait" }, remember: [] }; },
  async converse(ctx) { return { lines: [{ speaker: ctx.a.id, text: "I repaired the mill." }], outcome: { a_remember: "I repaired the mill.", b_remember: "The mill was repaired.", a_trust_delta: 0, b_trust_delta: 0, rumor: null } }; },
  async reflect() { return { summary: "I believe the roof is fixed.", insights: [], opinions: [], intentions: [], letter_to_owner: null, projects: [{ title: "Fix roof", progress: "I believe it is fixed", done: true }] }; },
  async plan() { throw Error("not used"); }, async digest() { throw Error("not used"); }, async child() { throw Error("not used"); }, async writePaper() { throw Error("not used"); }, async life() { throw Error("not used"); }, async judge() { throw Error("not used"); },
};

describe("grounded memory", () => {
  it("keeps a model's pre-action success claim subjective when validation rejects its purchase", async () => {
    const town = new Town({ seed: 7, brain: { ...brain, async decide() { return { action: { kind: "trade", buy: "bread", with: "mill" }, remember: ["I bought bread at the mill."] }; } } });
    const a = town.addAgent({ persona: persona("Mira") }); a.location = "bakery"; a.hint = "Decide now";
    await town.tick();
    expect(town.events.some(e => e.kind === "action.rejected")).toBe(true);
    expect(a.memory.find(m => m.text === "I bought bread at the mill.")?.kind).toBe("reflect");
    expect(a.foodLessons).toEqual([]);
    expect(a.inventory).not.toContain("bread");
    expect(town.perceive(a).recent.some(m => m.includes("personal interpretation") && m.includes("I bought bread"))).toBe(true);
  });

  it("keeps dialogue claims separate from observed condition, including after restart", async () => {
    const town = new Town({ seed: 7, brain });
    const a = town.addAgent({ persona: persona("Mira") }), b = town.addAgent({ persona: persona("Ivo") });
    a.location = b.location = "mill"; a.seek = b.id;
    await town.tick();
    expect(town.events.some(e => e.kind === "conversation")).toBe(true);
    expect(a.memory.filter(m => m.text.includes("repaired")).every(m => m.kind !== "obs")).toBe(true);
    expect(a.memory.some(m => m.kind === "obs" && m.text.includes("no active damage recorded"))).toBe(true);
    expect(a.memory.some(m => m.text.includes("Observed local state at") && m.text.includes("bakery"))).toBe(false);
    const restored = new Town({ seed: 7, brain }); restored.restore(town.snapshot());
    const citizen = restored.agents.get(a.id)!;
    expect(citizen.memory.filter(m => m.text.includes("repaired")).map(memoryForMind).every(s => s.includes("not verified experience"))).toBe(true);
    expect(restored.perceive(citizen).place.broken).toBe(false);
    restored.places.get("mill")!.brokenUntil = restored.day + 2;
    expect(restored.perceive(citizen).place.broken).toBe(true);
  });

  it("supplies personal event references and reports subjective goal completion as a claim", async () => {
    const contexts: ReflectContext[] = [];
    const town = new Town({ seed: 7, brain: { ...brain, async reflect(ctx) { contexts.push(ctx); return brain.reflect(ctx); } } });
    const a = town.addAgent({ persona: persona("Mira") }), other = town.addAgent({ persona: persona("Ivo") });
    a.location = other.location = "bakery";
    town.apply(a, { kind: "trade", buy: "bread", with: "bakery" }, "test");
    town.apply(other, { kind: "trade", buy: "bread", with: "bakery" }, "test");
    const purchase = town.events.find(e => e.kind === "agent.trade" && e.actors[0] === a.id)!;
    const otherPurchase = town.events.find(e => e.kind === "agent.trade" && e.actors[0] === other.id)!;
    a.projects.push({ title: "Fix roof", why: "I want it", progress: "not begun", since: 1, done: false });
    town.remember(a, "Someone says the roof is repaired", .8, "rumor");
    for (const c of [a, other]) { c.asleep = true; c.needs.rest = 1; c.location = "inn"; }
    town.t = 1439; await town.tick();
    const ctx = contexts.find(c => c.agent.id === a.id)!;
    expect(ctx.actionEvidence?.some(s => s.includes(`event ${purchase.id},`))).toBe(true);
    expect(ctx.actionEvidence?.some(s => s.includes(`event ${otherPurchase.id},`))).toBe(false);
    expect(ctx.dayMemories.some(s => s.includes("reported speech, not verified experience"))).toBe(true);
    expect(town.events.find(e => e.payload?.project === "Fix roof")?.payload?.reported).toBe(true);
    expect(town.events.some(e => e.kind === "town.built")).toBe(false);
    expect(town.places.get("mill")!.site).toBeNull();
  });
});
