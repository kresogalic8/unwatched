import { describe, it, expect } from "vitest";
import { Town, MINUTES_PER_DAY } from "../src/index.ts";
import type { Brain, AgentState, Tier } from "../src/index.ts";
import type { Perception, ActionProposal, Persona } from "@unwatched/protocol";

const persona = (name: string): Persona => ({ name, age: 33, origin: "the mainland", summary: "A restless person.", want: "somewhere better", fear: "staying", secret: "none", strangers: "curious", advice: "weighs it", traits: { warmth: 0.6, pride: 0.4, caution: 0.3, honesty: 0.7, ambition: 0.8 } });
const none: Brain = {
  name: "none",
  async decide(_p: Perception, _a: AgentState, _t: Tier): Promise<ActionProposal> { return { action: { kind: "wait" }, remember: [] }; },
  async converse() { throw new Error("no"); }, async reflect() { throw new Error("no"); }, async plan() { throw new Error("no"); },
  async digest() { return { text: "", headline: "" }; }, async child() { throw new Error("no"); }, async writePaper() { throw new Error("no"); }, async life() { throw new Error("no"); }, async judge() { return { happened: "it passed", plausible: true, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] }; },
};

describe("the boat between islands", () => {
  it("carries a person, their coins, their memories and the news to another island; a harbor that does not answer keeps them home", async () => {
    // two islands in one process, each the other's harbor
    let north!: Town;
    const south = new Town({ seed: 1, brain: none, minutesPerTick: 1, name: "The island", idPrefix: "south", harbors: [{ id: "north", name: "Northreach" }], onDepart: async (p, to) => { if (to !== "north") return false; north.arrive(p); return true; } });
    north = new Town({ seed: 2, brain: none, minutesPerTick: 1, name: "Northreach", idPrefix: "north", harbors: [{ id: "south", name: "The island" }], onDepart: async () => false });
    south.papers.push({ edition: 1, date: "Day 1", weather: "rain", lead: { headline: "The mill roof came off", deck: "", body: "" }, briefs: [{ headline: "Bread at two coins", body: "" }], notices: [] });
    const a = south.addAgent({ persona: persona("Vera Lučić"), owner: "o1" });
    a.coins = 27; a.inventory.push("rope"); a.location = "harbor"; south.remember(a, "Rosa cheated me at the inn.", 0.9);
    const b = north.addAgent({ persona: persona("Local Northerner"), owner: null }); b.location = "harbor";
    while (south.hour < 9) await south.tick();
    a.location = "harbor";
    // a thought decides to cross; the crossing happens at the end of that minute
    expect(south.apply(a, { kind: "leave", to: "Northreach", why: "nothing left for me here" }, "test")).toBe(true);
    await south.tick();
    expect(south.agents.has(a.id)).toBe(false);
    expect(south.events.some((e) => e.kind === "agent.leave" && /for Northreach/.test(e.text))).toBe(true);
    const arrived = [...north.agents.values()].find((x) => x.persona.name === "Vera Lučić")!;
    expect(arrived).toBeTruthy();
    expect(arrived.coins).toBe(27); expect(arrived.inventory).toContain("rope"); expect(arrived.owner).toBe("o1");
    expect(arrived.memory.some((m) => m.text.includes("Rosa cheated me"))).toBe(true);
    expect(arrived.memory.some((m) => m.text.includes("came here from The island"))).toBe(true);
    expect(north.events.some((e) => e.kind === "boat.news" && /mill roof/.test(e.text))).toBe(true);
    expect(north.events.some((e) => e.kind === "agent.arrive" && /from The island/.test(e.text))).toBe(true);
    expect(b.memory.some((m) => m.text.startsWith("News from The island"))).toBe(true);
    // and back the other way, to a harbor that does not answer: she stays
    arrived.location = "harbor"; north.setWeather("clear"); // a calm sea, so only the far harbor can keep her
    expect(north.apply(arrived, { kind: "leave", to: "south" }, "test")).toBe(true);
    await north.tick();
    expect(north.agents.has(arrived.id)).toBe(true);
    expect(north.events.some((e) => /did not sail today/.test(e.text))).toBe(true);
    void MINUTES_PER_DAY;
  });
});
