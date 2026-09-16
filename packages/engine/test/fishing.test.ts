import { describe, it, expect, vi } from "vitest";
import { Town, Rng } from "../src/index.ts";
import type { Brain, AgentState, Tier } from "../src/index.ts";
import type { Perception, ActionProposal } from "@unwatched/protocol";

const none: Brain = {
  name: "none",
  async decide(_p: Perception, _a: AgentState, _t: Tier): Promise<ActionProposal> { return { action: { kind: "wait" }, remember: [] }; },
  async converse() { throw new Error("no"); }, async reflect() { throw new Error("no"); }, async plan() { throw new Error("no"); },
  async digest() { return { text: "a day", headline: "A day" }; }, async child() { throw new Error("no"); }, async writePaper() { throw new Error("no"); }, async life() { throw new Error("no"); }, async judge() { return { happened: "it passed", plausible: true, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] }; },
};
function persona(name: string, rng: Rng) {
  return { name, age: 30, origin: "the mainland", summary: "A person.", want: "A room.", fear: "Debt.", secret: "None.", strangers: "Polite.", advice: "Considers it.", traits: { warmth: rng.next(), pride: rng.next(), caution: rng.next(), honesty: rng.next(), ambition: rng.next() } };
}

describe("agent-chosen pier fishing", () => {
  function setup() {
    const town = new Town({seed: 4, brain: none});
    const a = town.addAgent({persona: persona("Mara", new Rng(3))});
    town.t = 600; town.weather = "clear"; a.location = "harbor"; a.needs = {hunger: .1, rest: .1, social: .1};
    return {town, a};
  }
  it("waits twenty minutes, survives a restart and gives at most one actual fish", async () => {
    const {town, a} = setup();
    expect(town.apply(a, {kind: "fish"})).toBe(true);
    expect(a.inventory).not.toContain("fish");
    const resumed = new Town({seed: 4, brain: none}); resumed.restore(town.snapshot());
    const b = resumed.agents.get(a.id)!;
    vi.spyOn(resumed.rng, "chance").mockReturnValue(true);
    expect(b.activity?.until).toBe(620);
    for (let n = 0; n < 20; n++) await resumed.tick();
    expect(b.inventory).not.toContain("fish");
    await resumed.tick();
    const result = resumed.events.find(e => e.kind === "agent.fishing-ended")!;
    expect(result).toBeDefined();
    expect(b.inventory.filter(i => i === "fish").length).toBe(result.payload?.caught);
    expect(b.activity).toBeNull();
    expect(resumed.apply(b, {kind: "fish"})).toBe(false);
    expect(b.lastThought).toBe(-999);
    expect(b.inventory).toContain("fish");
    {
      const shelf = resumed.places.get("fishhouse")!; const before = shelf.stock.fish ?? 0;
      const coins = b.coins;
      expect(resumed.apply(b, {kind: "move", to: "fishhouse"})).toBe(true);
      expect(resumed.apply(b, {kind: "trade", sell: "fish"})).toBe(true);
      expect(shelf.stock.fish).toBe(before + 1);
      expect(b.inventory).not.toContain("fish");
      expect(b.coins).toBeGreaterThan(coins);
    }
  });
  it("interrupts in a storm without manufacturing a catch", async () => {
    const {town, a} = setup(); town.apply(a, {kind: "fish"}); town.weather = "storm";
    await town.tick();
    expect(a.activity?.kind).not.toBe("fish");
    expect(a.inventory).not.toContain("fish");
    expect(town.events.find(e => e.kind === "agent.fishing-ended")?.payload?.interrupted).toBe(true);
  });
  it("can finish without a catch", async () => {
    const {town, a} = setup(); vi.spyOn(town.rng, "chance").mockReturnValue(false);
    town.apply(a, {kind: "fish"});
    for (let n = 0; n <= 20; n++) await town.tick();
    expect(a.inventory).not.toContain("fish");
    expect(town.events.find(e => e.kind === "agent.fishing-ended")?.payload).toMatchObject({caught: 0, interrupted: false});
  });
  it("shows work only after an accepted action and clears it when leaving", () => {
    const {town, a} = setup(); town.t = 600; town.weekdayOverride = 1; a.location = "fishhouse";
    expect(town.apply(a, {kind: "work"})).toBe(false);
    expect(a.activity).toBeUndefined();
    a.job = "fishhouse.gutter";
    expect(town.apply(a, {kind: "work"})).toBe(true);
    expect(a.activity).toMatchObject({kind: "work", place: "fishhouse"});
    expect(town.apply(a, {kind: "move", to: "harbor"})).toBe(true);
    expect(a.activity).toBeNull();
  });
  it("rejects fishing inland, in storms and with a full inventory", () => {
    const {town, a} = setup(); a.location = "market"; expect(town.apply(a, {kind: "fish"})).toBe(false);
    a.location = "harbor"; town.weather = "storm"; expect(town.apply(a, {kind: "fish"})).toBe(false);
    town.weather = "clear"; a.inventory = Array(12).fill("bread"); expect(town.apply(a, {kind: "fish"})).toBe(false);
  });
});
