import { describe, it, expect } from "vitest";
import { Town, Rng } from "../src/index.ts";
import type { Brain } from "../src/index.ts";
import type { ActionProposal } from "@unwatched/protocol";

const none: Brain = {
  name: "none",
  async decide(): Promise<ActionProposal> { return { action: { kind: "wait" }, remember: [] }; },
  async converse() { throw new Error("no"); }, async reflect() { throw new Error("no"); }, async plan() { throw new Error("no"); },
  async digest() { return { text: "a day", headline: "A day" }; }, async child() { throw new Error("no"); },
  async writePaper() { throw new Error("no"); }, async life() { throw new Error("no"); },
  async judge() { return { happened: "it passed", plausible: true, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] }; },
};

const persona = (name: string, rng: Rng) => ({ name, age: 30, origin: "the mainland", summary: "A person.", want: "A room.", fear: "Debt.", secret: "None.", strangers: "Polite.", advice: "Considers it.", traits: { warmth: 0.5 + rng.next() * 0.2, pride: 0.4, caution: 0.4, honesty: 0.7, ambition: 0.5 } });
const town = () => new Town({ seed: 5, brain: none });

/** A promise is a thing the town holds until it is kept or broken. */
describe("promises", () => {
  it("is offered, taken, kept, and paid for", async () => {
    const t = town(); const rng = new Rng(5);
    const a = t.addAgent({ persona: persona("Luka", rng) }), b = t.addAgent({ persona: persona("Franjo", rng) });
    a.location = b.location = "market"; b.coins = 20; a.coins = 0;
    t.apply(a, { kind: "offer", to: b.id, what: "mend the mill roof", coins: 6, days: 2 }, "test");
    expect(a.deals[0]).toMatchObject({ what: "mend the mill roof", coins: 6, mine: true, state: "offered" });
    expect(b.deals[0]).toMatchObject({ id: a.deals[0]!.id, mine: false, state: "offered" });
    expect(t.perceive(b).self.deals?.[0]).toMatchObject({ what: "mend the mill roof", mine: false, state: "offered", due_in_days: 2 });

    t.apply(b, { kind: "accept" }, "test");
    expect(a.deals[0]!.state).toBe("open"); expect(b.deals[0]!.state).toBe("open");

    const trustBefore = b.relationships.get(a.id)!.trust;
    t.apply(a, { kind: "settle" }, "test");
    expect(a.deals[0]!.state).toBe("kept"); expect(a.coins).toBe(6); expect(b.coins).toBe(14);
    expect(b.relationships.get(a.id)!.trust).toBeGreaterThan(trustBefore);
  });

  it("a promise whose day passes unsettled breaks in the open, and costs the trust", async () => {
    const t = town(); const rng = new Rng(6);
    const a = t.addAgent({ persona: persona("Mara", rng) }), b = t.addAgent({ persona: persona("Rosa", rng) });
    a.location = b.location = "market";
    t.apply(a, { kind: "offer", to: b.id, what: "bring the flour up", days: 1 }, "test");
    t.apply(b, { kind: "accept" }, "test");
    const trustBefore = b.relationships.get(a.id)!.trust;
    a.deals[0]!.due = -1; // the day has passed
    await t.run(2); // past the midnight where a promise comes due
    expect(a.deals[0]!.state).toBe("broken"); expect(b.deals[0]!.state).toBe("broken");
    expect(b.relationships.get(a.id)!.trust).toBeLessThan(trustBefore);
  });

  it("a refusal ends it, and the physics refuses what cannot be promised", async () => {
    const t = town(); const rng = new Rng(7);
    const a = t.addAgent({ persona: persona("Ana", rng) }), b = t.addAgent({ persona: persona("Petar", rng) });
    a.location = "market"; b.location = "harbor";
    expect(t.apply(a, { kind: "offer", to: b.id, what: "keep the books" }, "test")).toBe(false); // not here to hear it
    b.location = "market";
    expect(t.apply(b, { kind: "accept" }, "test")).toBe(false); // nothing offered yet
    t.apply(a, { kind: "offer", to: b.id, what: "keep the books" }, "test");
    t.apply(b, { kind: "refuse", why: "I keep my own." }, "test");
    expect(a.deals[0]!.state).toBe("refused");
    expect(t.perceive(a).self.deals).toBeUndefined(); // nothing open, nothing on the sheet
  });
});
