import { describe, it, expect } from "vitest";
import { Town, Rng, MINUTES_PER_DAY } from "../src/index.ts";
import type { Brain, AgentState, Tier } from "../src/index.ts";
import type { Perception, ActionProposal } from "@unwatched/protocol";

/** A brain that never thinks. Habit only. Proves the physics stand on their own. */
const none: Brain = {
  name: "none",
  async decide(_p: Perception, _a: AgentState, _t: Tier): Promise<ActionProposal> { return { action: { kind: "wait" }, remember: [] }; },
  async converse() { throw new Error("no"); },
  async reflect() { throw new Error("no"); },
  async plan() { throw new Error("no"); },
  async digest() { return { text: "a day", headline: "A day" }; },
  async child() { throw new Error("no"); },
  async writePaper() { throw new Error("no"); },
  async life() { throw new Error("no"); }, async judge() { return { happened: "it passed", plausible: true, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] }; },
};

function persona(name: string, rng: Rng) {
  return { name, age: 30, origin: "the mainland", summary: "A person.", want: "A room.", fear: "Debt.", secret: "None.", strangers: "Polite.", advice: "Considers it.", traits: { warmth: rng.next(), pride: rng.next(), caution: rng.next(), honesty: rng.next(), ambition: rng.next() } };
}

describe("the town on habit alone", () => {
  it("runs three days, nobody starves, everyone sleeps somewhere, coins are conserved", async () => {
    const town = new Town({ seed: 1, brain: none });
    const rng = new Rng(1);
    for (let i = 0; i < 12; i++) town.addAgent({ persona: persona(`P${i}`, rng) });
    // shelves are finite now: an island where nobody works eats itself bare in three days, so the food posts are staffed the way the brain would staff them on the first morning
    const people = [...town.agents.values()]; let k = 0;
    for (const id of ["bakery.cook", "bakery.cook", "fishhouse.gutter", "fishhouse.gutter", "mill.hand", "fields.hand", "inn.help"]) { const a = people[k++]!; a.job = id; town.jobs.get(id)!.holders.push(a.id); }
    const coinsOnIsland = () => [...town.agents.values()].reduce((s, a) => s + a.coins, 0) + [...town.places.values()].reduce((s, p) => s + p.treasury, 0);
    const start = coinsOnIsland() - town.minted;
    await town.run(4);
    for (const a of town.agents.values()) {
      expect(a.needs.hunger).toBeLessThan(1);
      expect(a.coins).toBeGreaterThanOrEqual(0);
    }
    const slept = town.events.filter((e) => e.kind === "agent.sleep").length;
    expect(slept).toBeGreaterThanOrEqual(12 * 3);
    // Nothing is created: what is on the island is what arrived plus what the mainland paid, less what left.
    expect(coinsOnIsland()).toBe(start + town.minted - town.burned);
  });

  it("is deterministic for a seed", async () => {
    const run = async () => { const t = new Town({ seed: 9, brain: none }); const r = new Rng(9); for (let i = 0; i < 6; i++) t.addAgent({ persona: persona(`Q${i}`, r) }); await t.run(3); return t.events.map((e) => e.text).join("\n"); };
    expect(await run()).toEqual(await run());
  });

  it("rejects what the world cannot carry out", () => {
    const town = new Town({ seed: 2, brain: none });
    const a = town.addAgent({ persona: persona("R", new Rng(2)), coins: 0 });
    expect(town.apply(a, { kind: "move", to: "nowhere" }, "test")).toBe(false); // no such place
    expect(town.apply(a, { kind: "move", to: "mill" }, "test")).toBe(true); // far away: one road now, a heading for the rest
    expect(a.location).not.toBe("harbor"); expect(a.heading).toBe("mill");
    a.location = "harbor"; a.heading = null;
    expect(town.apply(a, { kind: "trade", with: "harbor", buy: "bread", coins: 1 }, "test")).toBe(false); // nothing for sale
    expect(town.apply(a, { kind: "move", to: "inn" }, "test")).toBe(true);
    expect(town.apply(a, { kind: "trade", with: "inn", buy: "bread", coins: 1 }, "test")).toBe(false); // no coins
    expect(town.apply(a, { kind: "take", item: "bread" }, "test")).toBe(true); // theft is physics-legal
    expect(a.inventory).toContain("bread");
  });

  it("time runs a day in 1440 minutes", () => {
    expect(MINUTES_PER_DAY).toBe(1440);
  });
});
