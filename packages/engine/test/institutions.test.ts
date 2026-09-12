import { describe, it, expect } from "vitest";
import { Town, Rng } from "../src/index.ts";
import type { Brain } from "../src/index.ts";

const none: Brain = {
  name: "none",
  async decide() { return { action: { kind: "wait" }, remember: [] }; },
  async converse() { throw new Error("no"); }, async reflect() { throw new Error("no"); }, async plan() { throw new Error("no"); },
  async digest() { return { text: "", headline: "" }; }, async child() { throw new Error("no"); }, async writePaper() { throw new Error("no"); }, async life() { throw new Error("no"); }, async judge() { return { happened: "it passed", plausible: true, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] }; },
};
function persona(name: string, rng: Rng) {
  return { name, age: 30, origin: "the mainland", summary: "A person.", want: "A room.", fear: "Debt.", secret: "None.", strangers: "Polite.", advice: "Considers it.", traits: { warmth: rng.next(), pride: rng.next(), caution: rng.next(), honesty: rng.next(), ambition: rng.next() } };
}

describe("institutions with teeth", () => {
  it("the council chooses the most trusted person as mayor, who can fund a granary; a thief is fined, then exiled", async () => {
    const town = new Town({ seed: 11, brain: none }); const rng = new Rng(11);
    for (let i = 0; i < 6; i++) town.addAgent({ persona: persona(`P${i}`, rng) });
    const people = [...town.agents.values()]; const a = people[0]!, b = people[1]!, c = people[2]!;
    // everyone trusts P1
    for (const x of town.agents.values()) if (x.id !== b.id) x.relationships.set(b.id, { trust: 0.9, affection: 0.5, lastSeen: 0, opinion: "", lastPlace: null });
    await town.run(2); // day 2 at ten the council sits for the first time
    while (town.hour < 11) await town.tick();
    expect(town.mayor).toBe(b.id);
    expect(town.events.some((e) => e.kind === "town.mayor" && e.actors[0] === b.id)).toBe(true);
    // the mayor funds a granary
    const council = town.places.get("council")!; council.treasury = 80; b.location = "council"; b.asleep = false;
    const grain0 = town.places.get("mill")!.stock.grain ?? 0;
    expect(town.apply(b, { kind: "fund", what: "granary" }, "test")).toBe(true);
    expect(town.places.get("mill")!.stock.grain).toBe(grain0 + 60); expect(council.treasury).toBe(30); expect(town.works).toContain("granary");
    // not the mayor: refused
    a.location = "council"; expect(town.apply(a, { kind: "fund", what: "bridge" }, "test")).toBe(false);
    // the court: c takes from a twice on the record, then is accused
    c.location = a.location = "market"; c.coins = 20; a.inventory.push("bread", "bread");
    expect(town.apply(c, { kind: "take", item: "bread", from: a.id }, "test")).toBe(true);
    a.location = "council"; while (town.hour < 9 || town.hour >= 14) await town.tick(); a.location = "council"; a.asleep = false;
    // the accusation is heard at three, in front of the town
    expect(town.apply(a, { kind: "accuse", who: c.persona.name, of: "taking my bread" }, "test")).toBe(true);
    expect(town.gatherings.some((g) => g.kind === "hearing" && !g.held)).toBe(true);
    const hearing = async () => { while (!(town.hour === 15 && town.minuteOfDay % 60 === 0)) await town.tick(); };
    await hearing();
    expect(c.convictions).toBe(1); expect(c.coins).toBeLessThanOrEqual(16);
    expect(town.events.some((e) => e.kind === "town.gathering" && (e.payload as { verdict?: string }).verdict === "fine")).toBe(true);
    // a false accusation costs the accuser, at the next hearing
    a.location = "council"; a.asleep = false; while (town.hour < 9 || town.hour >= 14) { await town.tick(); } a.location = "council"; a.asleep = false;
    const coinsA = a.coins; expect(town.apply(a, { kind: "accuse", who: b.persona.name, of: "nothing really" }, "test")).toBe(true);
    await hearing(); expect(a.coins).toBeLessThanOrEqual(Math.max(0, coinsA - 3) + 6); // wages may have come in between
    expect(town.events.some((e) => e.kind === "town.gathering" && (e.payload as { verdict?: string }).verdict === "dismissed")).toBe(true);
    // second conviction: the boat
    while (town.hour < 9 || town.hour >= 14) await town.tick();
    c.location = "market"; a.location = "market"; a.asleep = false; c.asleep = false; a.inventory.push("bread"); expect(town.apply(c, { kind: "take", item: "bread", from: a.id }, "test")).toBe(true);
    a.location = "council"; expect(town.apply(a, { kind: "accuse", who: c.persona.name, of: "again" }, "test")).toBe(true);
    await hearing();
    expect(town.agents.has(c.id)).toBe(false);
    expect(town.events.some((e) => e.kind === "agent.leave" && e.actors[0] === c.id && (e.payload as { reason: string }).reason === "exiled")).toBe(true);
  });
});

describe("the vote", () => {
  it("records who voted, takes one vote per citizen per proposal, and puts the vote on the record", () => {
    const town = new Town({ seed: 13, brain: none }); const rng = new Rng(13);
    const a = town.addAgent({ persona: persona("A", rng) }), b = town.addAgent({ persona: persona("B", rng) });
    a.location = b.location = "council";
    expect(town.apply(a, { kind: "propose", law: "Bread may cost no more than 2 coins" }, "test")).toBe(true);
    const law = town.laws[0]!; expect(law.voters).toEqual([a.id]);
    expect(town.apply(b, { kind: "vote", proposal: "Bread may cost", yes: true }, "test")).toBe(true);
    expect(law.yes).toBe(2); expect(law.voters).toEqual([a.id, b.id]);
    const vote = town.events.at(-1)!; expect(vote.kind).toBe("law.vote"); expect(vote.actors).toEqual([b.id, a.id]); expect(vote.importance).toBe(0.3);
    expect(town.apply(b, { kind: "vote", proposal: "Bread may cost", yes: false }, "test")).toBe(false); expect(law.no).toBe(0);
    expect(town.apply(a, { kind: "vote", proposal: "Bread may cost", yes: true }, "test")).toBe(false); expect(law.yes).toBe(2);
    expect(town.apply(b, { kind: "vote", proposal: "No such thing", yes: true }, "test")).toBe(false);
  });
});
