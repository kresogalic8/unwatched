import { describe, it, expect } from "vitest";
import { Town, MINUTES_PER_DAY } from "../src/index.ts";
import type { Brain, AgentState, Tier, ActivePlan } from "../src/index.ts";
import type { Perception, ActionProposal } from "@unwatched/protocol";

const persona = (n: string) => ({ name: n, age: 30, origin: "the mainland", summary: "A person.", want: "a quiet life", fear: "debt", secret: "none", strangers: "polite", advice: "listens", traits: { warmth: 0.5, pride: 0.4, caution: 0.5, honesty: 0.7, ambition: 0.5 } });
const none: Brain = {
  name: "none",
  async decide(_p: Perception, _a: AgentState, _t: Tier): Promise<ActionProposal> { return { action: { kind: "wait" }, remember: [] }; },
  async converse() { throw new Error("no"); }, async reflect() { throw new Error("no"); }, async plan() { throw new Error("no"); },
  async digest() { return { text: "", headline: "" }; }, async child() { throw new Error("no"); }, async writePaper() { throw new Error("no"); }, async life() { throw new Error("no"); },
  async judge() { return { happened: "it passed", plausible: true, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] }; },
};

describe("what the week-one review turned up", () => {
  it("will not make a thing from two of an ingredient there is only one of", () => {
    const town = new Town({ seed: 1, brain: none });
    const a = town.addAgent({ persona: persona("Cook") });
    const bakery = town.places.get("bakery")!; a.location = "bakery"; bakery.owner = a.id; bakery.stock.fish = 1;
    expect(town.apply(a, { kind: "make", item: "chowder", from: ["fish", "fish"] }, "test")).toBe(false);
    expect(bakery.stock.fish).toBe(1);
    bakery.stock.fish = 2;
    expect(town.apply(a, { kind: "make", item: "chowder", from: ["fish", "fish"] }, "test")).toBe(true);
    expect(bakery.stock.fish).toBe(0);
  });

  it("gives the writer of a long absence the most recent days, not the first", () => {
    const town = new Town({ seed: 2, brain: none });
    const a = town.addAgent({ persona: persona("Away"), owner: "o1" });
    const clock = town as unknown as { t: number; day: number };
    for (let d = 1; d <= 12; d++) for (const h of [8, 18]) { clock.t = (d - 1) * MINUTES_PER_DAY + h * 60; clock.day = d; town.emit("agent.work", [a.id], "harbor", `day ${d} hour ${h}`, 0.1); }
    clock.t = 12 * MINUTES_PER_DAY; clock.day = 13;
    const ctx = town.digestContext(a.id, 0)!;
    expect(ctx.events.length).toBe(16);
    expect(ctx.events[ctx.events.length - 1]).toContain("day 12");
  });

  it("never bids more for a thing than half of what it charges for it", () => {
    const town = new Town({ seed: 4, brain: none });
    const owner = town.addAgent({ persona: persona("Owner") }); const buyer = town.addAgent({ persona: persona("Buyer") });
    const shop = town.places.get("market")!; shop.owner = owner.id; shop.sells = [{ item: "rope", base: 6 }]; shop.stock.rope = 3;
    owner.location = "harbor"; buyer.location = "market"; owner.coins = 40; buyer.coins = 40;
    town.rules.push({ kind: "cap", item: "rope", price: 2, text: "rope shall not cost more than two" });
    for (let i = 0; i < 5; i++) { town.apply(buyer, { kind: "trade", buy: "rope" }, "test"); town.apply(buyer, { kind: "trade", sell: "rope" }, "test"); }
    expect(buyer.coins).toBeLessThanOrEqual(40);
    expect(owner.coins).toBeGreaterThanOrEqual(40);
  });

  it("carries a letter that asked something, and the answer owed on it, through a restart", () => {
    const town = new Town({ seed: 5, brain: none });
    const a = town.addAgent({ persona: persona("Asked"), owner: "o1" });
    town.sendLetter(a.id, "Will you take the job at the mill?");
    const l = a.letters[0]!; l.read = true; a.replyTo = l.id;
    const town2 = new Town({ seed: 5, brain: none }); town2.restore(town.snapshot());
    const b = town2.agents.get(a.id)!;
    expect(b.letters.map((x) => x.text)).toContain("Will you take the job at the mill?");
    expect(b.replyTo).toBe(l.id);
  });

  it("does not ask the same once-a-day question again after a restart", () => {
    const town = new Town({ seed: 6, brain: none });
    const a = town.addAgent({ persona: persona("Hungry") });
    a.starvingThoughtDay = town.day; a.debtThoughtDay = town.day; a.lastHungerThought = town.t;
    const town2 = new Town({ seed: 6, brain: none }); town2.restore(town.snapshot());
    const b = town2.agents.get(a.id)!;
    expect(b.starvingThoughtDay).toBe(town.day); expect(b.debtThoughtDay).toBe(town.day); expect(b.lastHungerThought).toBe(town.t);
  });

  it("reports the morning digest against the plan the day before was lived on", () => {
    const town = new Town({ seed: 7, brain: none });
    const a = town.addAgent({ persona: persona("Planner"), owner: "o1" });
    const yesterday: ActivePlan = { day: 1, mood: "steady", goals: ["find work at the mill"], steps: [{ hour: 9, do: "ask at the mill", place: "mill", done: true }] };
    a.lastPlan = yesterday; a.plan = { day: 2, mood: "steady", goals: ["today's unstarted thing"], steps: [{ hour: 9, do: "not yet", place: null, done: false }] };
    (town as unknown as { day: number; t: number }).day = 2; (town as unknown as { t: number }).t = MINUTES_PER_DAY + 7 * 60;
    const ctx = town.digestContext(a.id, 0)!;
    expect(ctx.plan?.goals).toEqual(["find work at the mill"]);
  });

  it("thinks about a plan step it can act on, instead of waiting out one it never reached", async () => {
    const { dueThought } = await import("../src/salience.ts");
    const town = new Town({ seed: 8, brain: none });
    const a = town.addAgent({ persona: persona("Stuck") }); a.location = "harbor";
    a.plan = { day: town.day, mood: "steady", goals: ["g"], steps: [{ hour: 9, do: "meet at the market", place: "market", done: false }, { hour: 10, do: "think it over", place: null, done: false }] };
    expect(dueThought(a, 11, town.day)?.do).toBe("think it over");
  });

  it("tells a starving citizen in winter that the cold is the thing that kills, not the fifth day", () => {
    const town = new Town({ seed: 9, brain: none });
    const a = town.addAgent({ persona: persona("Cold") });
    a.starving = 3; a.roofless = 3; a.needs.hunger = 0.9;
    const clock = town as unknown as { t: number; day: number };
    for (let d = 1; d < 400 && town.season !== "winter"; d++) { clock.day = d; clock.t = (d - 1) * MINUTES_PER_DAY; }
    expect(town.season).toBe("winter");
    expect((town.perceive(a).self as { feels: { hunger: string } }).feels.hunger).toContain("cold");
    a.roofless = 0;
    expect((town.perceive(a).self as { feels: { hunger: string } }).feels.hunger).toContain("five kill");
  });
});
