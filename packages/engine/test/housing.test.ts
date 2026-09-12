import { describe, it, expect } from "vitest";
import { Town, Rng, MINUTES_PER_DAY } from "../src/index.ts";
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
const persona = (name: string, rng: Rng) => ({ name, age: 30, origin: "the mainland", summary: "A person.", want: "A room.", fear: "Debt.", secret: "None.", strangers: "Polite.", advice: "Considers it.", traits: { warmth: 0.5, pride: 0.4, caution: 0.4, honesty: 0.7, ambition: rng.next() } });

describe("a roof, and what is owed on it", () => {
  it("a bed that is taken is taken, free or not", () => {
    const t = new Town({ seed: 2, brain: none }); const rng = new Rng(2);
    const shed = t.places.get("boatshed")!; const beds = shed.beds!.capacity;
    const sleepers = Array.from({ length: beds }, (_, i) => { const a = t.addAgent({ persona: persona(`Sleeper${i}`, rng) }); a.location = "boatshed"; return a; });
    for (const a of sleepers) expect(t.apply(a, { kind: "sleep" }, "test")).toBe(true);
    const late = t.addAgent({ persona: persona("Late", rng) }); late.location = "boatshed";
    expect(t.apply(late, { kind: "sleep" }, "test")).toBe(false); // the free beds are finite too
  });

  it("rent is paid from what is left after eating, and three nights behind puts a person out with the debt following them", async () => {
    const t = new Town({ seed: 3, brain: none }); const rng = new Rng(3);
    const landlord = t.addAgent({ persona: persona("Vesna", rng) }), tenant = t.addAgent({ persona: persona("Mara", rng) });
    const house = t.places.get("boatshed")!; house.owner = landlord.id; house.beds = { price: 2, capacity: 4 }; house.freeBeds = 4;
    tenant.home = { place: house.id, nightsPaid: 0 }; tenant.location = house.id; tenant.coins = 5; landlord.coins = 0;

    t.apply(tenant, { kind: "sleep" }, "test"); // five coins: two kept back to eat, the rest against a rent of two
    expect(tenant.coins).toBe(3); expect(landlord.coins).toBe(2); expect(tenant.home!.arrears ?? 0).toBe(0);

    tenant.asleep = false; tenant.coins = 0;
    t.apply(tenant, { kind: "sleep" }, "test"); // nothing to pay with
    expect(tenant.home!.arrears).toBe(2);

    tenant.home!.arrears = 6; // three nights behind
    await t.run(2);
    expect(tenant.home).toBeNull();
    expect(tenant.debts.find((d) => d.to === landlord.id)?.coins ?? 0).toBeGreaterThanOrEqual(6); // what was owed follows them, the last night included
    expect(t.events.some((e) => e.kind === "agent.evicted")).toBe(true);
  });

  it("what is overdue grows a tenth a day and stops at twice what was lent", async () => {
    const t = new Town({ seed: 4, brain: none }); const rng = new Rng(4);
    const lender = t.addAgent({ persona: persona("Rosa", rng) }), debtor = t.addAgent({ persona: persona("Luka", rng) });
    debtor.debts.push({ to: lender.id, coins: 20, due: -1 });
    debtor.debts.push({ to: lender.id, coins: 39, due: -1, principal: 20 } as (typeof debtor.debts)[number]); // one already near the ceiling
    await t.run(t.day + 1); // one midnight
    expect(debtor.debts[0]!.coins).toBe(22); // a tenth of twenty
    expect(debtor.debts[1]!.coins).toBe(40); // and it stops at twice what was lent
    await t.run(t.day + 1);
    expect(debtor.debts[1]!.coins).toBe(40); // still
  }, 30000);
});
