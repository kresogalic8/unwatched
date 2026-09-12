import { describe, it, expect } from "vitest";
import { Town, Rng } from "../src/index.ts";
import type { Brain } from "../src/index.ts";

/** A brain that only names children, so the nightly generations run and a couple can marry. */
const quiet: Brain = {
  name: "quiet", async judge() { return { happened: "it passed", plausible: true, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] }; }, async decide() { return { action: { kind: "wait" }, remember: [] }; },
  async converse() { throw new Error("no"); }, async reflect() { throw new Error("no"); }, async plan() { throw new Error("no"); },
  async digest() { return { text: "", headline: "" }; }, async child() { throw new Error("no children in this test"); }, async writePaper() { return { edition: 1, date: "d", weather: "clear", lead: { headline: "h", deck: "d", body: "b" }, briefs: [], notices: [] }; }, async life() { return { title: "t", text: "x", epitaph: "Loved the sea." }; },
};
const persona = (name: string, rng: Rng) => ({ name, age: 30, origin: "the mainland", summary: "A person.", want: "A room.", fear: "Debt.", secret: "None.", strangers: "Polite.", advice: "Considers it.", traits: { warmth: rng.next(), pride: rng.next(), caution: rng.next(), honesty: rng.next(), ambition: rng.next() } });

describe("the town gathers", () => {
  it("a couple under their own roof marry on a Saturday in front of the town; a death brings a funeral the next morning", async () => {
    const town = new Town({ seed: 21, brain: quiet }); const rng = new Rng(21);
    for (let i = 0; i < 8; i++) town.addAgent({ persona: persona(`P${i}`, rng) });
    const [a, b] = [...town.agents.values()]; const house = [...town.places.values()].find((p) => p.beds && p.kind !== "inn")!;
    house.kind = "home"; house.owner = a!.id; a!.home = { place: house.id, nightsPaid: 36500 }; b!.home = { place: house.id, nightsPaid: 36500 };
    a!.relationships.set(b!.id, { trust: 0.8, affection: 0.8, lastSeen: 0, opinion: "", lastPlace: null }); b!.relationships.set(a!.id, { trust: 0.8, affection: 0.8, lastSeen: 0, opinion: "", lastPlace: null });
    for (const x of town.agents.values()) x.coins = 30;
    await town.run(2); // the first night schedules the wedding
    const wedding = town.gatherings.find((g) => g.kind === "wedding"); expect(wedding).toBeDefined(); expect(wedding!.hour).toBe(11);
    expect((wedding!.day - 1) % 7).toBe(6); // a Saturday, by the island's own calendar
    await town.run(wedding!.day); while (town.hour < 12) await town.tick();
    const held = town.events.find((e) => e.kind === "town.gathering" && (e.payload as { kind: string }).kind === "wedding");
    expect(held).toBeDefined(); expect((held!.payload as { crowd: string[] }).crowd.length).toBeGreaterThan(2);
    expect(town.wedded.size).toBe(1);
    expect(town.perceive(a!).time.gathering ?? null).toBeNull();
    // a death: the funeral is on the calendar for ten the next morning, and the town comes
    const victim = [...town.agents.values()][5]!; victim.coins = 0; victim.inventory = []; victim.needs.hunger = 1; victim.starving = 5;
    const before = town.day; await town.run(before + 1);
    const funeral = town.gatherings.find((g) => g.kind === "funeral"); expect(funeral).toBeDefined(); expect(funeral!.hour).toBe(10);
    expect(town.perceive(a!).time.gathering).toMatch(/funeral/);
    while (town.hour < 11) await town.tick();
    const buried = town.events.find((e) => e.kind === "town.gathering" && (e.payload as { kind: string }).kind === "funeral"); expect(buried).toBeDefined();
    expect((buried!.payload as { crowd: string[] }).crowd.length).toBeGreaterThan(1);
  });
});
