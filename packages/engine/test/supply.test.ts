import { describe, it, expect } from "vitest";
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

describe("the supply chain", () => {
  it("moves grain to flour to bread, keeps the shelves stocked, and rests on Sunday", async () => {
    const town = new Town({ seed: 3, brain: none }); const rng = new Rng(3);
    for (let i = 0; i < 14; i++) town.addAgent({ persona: persona(`P${i}`, rng) });
    // everyone takes a job, one per post, the way the brain would on the first morning
    const people = [...town.agents.values()]; let i = 0;
    for (const job of town.jobs.values()) { const a = people[i++]; if (!a) break; a.job = job.id; job.holders.push(a.id); }
    const bakery = town.places.get("bakery")!, market = town.places.get("market")!;
    town.places.get("mill")!.stock.grain = 0; bakery.stock.flour = 2; // an empty mill and a low bin, so the cart has to run
    await town.run(10);
    // the cart ran: grain went from the fields to the mill and flour from the mill to the bakery
    expect((town.places.get("fields")!.stock.grain ?? 0)).toBeLessThan(90);
    const legs = town.events.filter((e) => e.kind === "cart.leg" && (e.payload as { qty: number }).qty > 0).map((e) => e.payload as { from: string; to: string; item: string });
    expect(legs.some((l) => l.from === "fields" && l.to === "mill" && l.item === "grain")).toBe(true);
    expect(legs.some((l) => l.from === "mill" && l.to === "bakery" && l.item === "flour")).toBe(true);
    // people ate all week from what the island made, and nobody went hungry
    // the shelves are finite now and a fire can take the bakery for days; with the bakery standing the chain feeds everyone, and even without it nobody dies in ten days
    void bakery; void market;
    // beds are finite too, so somebody occasionally sleeps rough and misses a meal; the chain still feeds the island and nobody starves on
    if (!town.events.some((e) => e.kind === "town.fire")) for (const a of town.agents.values()) expect(a.starving, a.persona.name).toBeLessThanOrEqual(1);
    expect(town.events.filter((e) => e.kind === "agent.died").length).toBe(0);
    expect(town.events.filter((e) => e.kind === "agent.eat").length).toBeGreaterThan(14 * 6);
    const bought = town.events.filter((e) => e.kind === "agent.trade" && /bread/.test(e.text)).length; expect(bought).toBeGreaterThan(10);
    // day 1 is a Sunday when the island keeps its own calendar: nobody was paid that day
    const sundayWages = town.events.filter((e) => e.kind === "agent.work" && e.day === 1); expect(sundayWages.length).toBe(0);
    const mondayWages = town.events.filter((e) => e.kind === "agent.work" && e.day === 2); expect(mondayWages.length).toBeGreaterThan(0);
    // stock is never negative
    for (const p of town.places.values()) for (const [k, v] of Object.entries(p.stock)) expect(v, `${p.id} ${k}`).toBeGreaterThanOrEqual(0);
    // the perception carries the calendar
    const any = [...town.agents.values()][0]!; const per = town.perceive(any); expect(per.time.weekday).toBeDefined();
  });
  it("a shortage is real: with no flour and no bread the bakery says so, and bread returns when the mill turns", async () => {
    const town = new Town({ seed: 4, brain: none }); const rng = new Rng(4);
    for (let i = 0; i < 10; i++) town.addAgent({ persona: persona(`P${i}`, rng) });
    const people = [...town.agents.values()]; let i = 0;
    for (const job of town.jobs.values()) { const a = people[i++]; if (!a) break; a.job = job.id; job.holders.push(a.id); }
    const bakery = town.places.get("bakery")!, market = town.places.get("market")!, mill = town.places.get("mill")!;
    bakery.stock = { bread: 0, flour: 0 }; market.stock.bread = 0; mill.stock = { grain: 0, flour: 0 }; town.places.get("fields")!.stock.grain = 0;
    await town.run(2);
    expect(town.flourShortage).toBe(true);
    expect(town.price(bakery, "bread")).toBeNull();
    town.places.get("fields")!.stock.grain = 90; await town.run(6);
    expect(town.flourShortage).toBe(false);
  });
});

describe("finite goods", () => {
  it("a shelf runs out, a theft reaches the owner, the wild is gathered, a counter buys at half the shelf, only food is eaten, and the surplus goes stale", async () => {
    const town = new Town({ seed: 12, brain: none }); const rng = new Rng(12);
    const a = town.addAgent({ persona: persona("A", rng) }); const b = town.addAgent({ persona: persona("B", rng) });
    const coinsOnIsland = () => [...town.agents.values()].reduce((s, x) => s + x.coins, 0) + [...town.places.values()].reduce((s, p) => s + p.treasury, 0);
    const start = coinsOnIsland();
    // every shelf item has a count now, and taking counts it down to nothing
    for (const p of town.places.values()) for (const s of p.sells) expect(p.stock[s.item], `${p.id} ${s.item}`).toBeGreaterThan(0);
    const inn = town.places.get("inn")!; a.location = "inn"; const bread0 = inn.stock.bread!;
    expect(town.apply(a, { kind: "take", item: "bread" }, "test")).toBe(true); expect(inn.stock.bread).toBe(bread0 - 1);
    inn.stock.bread = 0; expect(town.apply(a, { kind: "take", item: "bread" }, "test")).toBe(false);
    expect(town.events.at(-1)!.text).toMatch(/no bread left/);
    // a shop of B's: A's theft is on the record with B as the second actor, so it reaches B's digest
    const shop = town.places.get("lane-1")!; shop.kind = "shop"; shop.owner = b.id; shop.sells = [{ item: "bread", base: 2 }]; shop.stock = { bread: 3 }; a.location = "lane-1"; b.location = "market";
    expect(town.apply(a, { kind: "take", item: "bread" }, "test")).toBe(true);
    const theft = town.events.at(-1)!; expect(theft.kind).toBe("agent.take"); expect(theft.actors).toEqual([a.id, b.id]); expect(shop.stock.bread).toBe(2);
    expect(town.digest(b.id, 0).items.some((e) => e === theft)).toBe(true);
    // the wild is nobody's: gathering timber is not theft
    a.location = "pinewood"; const timber0 = town.places.get("pinewood")!.stock.timber!;
    expect(town.apply(a, { kind: "take", item: "timber" }, "test")).toBe(true); expect(town.places.get("pinewood")!.stock.timber).toBe(timber0 - 1); expect(town.events.at(-1)!.payload?.forage).toBe(true);
    // a counter buys what it sells at half the shelf price, a coin at least, out of its own till, and puts it on the shelf; it has no use for the rest
    const market = town.places.get("market")!; a.location = "market"; a.inventory.push("fish", "rope"); const till = market.treasury, coins = a.coins, fish0 = market.stock.fish!;
    expect(town.apply(a, { kind: "trade", with: "market", sell: "fish" }, "test")).toBe(true);
    expect(a.coins).toBe(coins + 1); expect(market.treasury).toBe(till - 1); expect(market.stock.fish).toBe(fish0 + 1);
    expect(town.apply(a, { kind: "trade", with: "market", sell: "rope" }, "test")).toBe(false); expect(town.events.at(-1)!.text).toMatch(/no use for rope/);
    // the mill buys grain, its shift's makings, at half the cart's price
    a.location = "mill"; a.inventory.push("grain"); const mill = town.places.get("mill")!; const grain0 = mill.stock.grain!;
    expect(town.buyPrice(mill, "grain")).toBe(1); expect(town.apply(a, { kind: "trade", with: "mill", sell: "grain" }, "test")).toBe(true); expect(mill.stock.grain).toBe(grain0 + 1);
    // selling to your own counter moves no coins
    b.location = "lane-1"; b.inventory.push("bread"); const bc = b.coins; expect(town.apply(b, { kind: "trade", with: "lane-1", sell: "bread" }, "test")).toBe(true); expect(b.coins).toBe(bc); expect(shop.stock.bread).toBe(3);
    // a broke till cannot buy
    market.treasury = 0; a.location = "market"; a.inventory.push("fish"); expect(town.apply(a, { kind: "trade", with: "market", sell: "fish" }, "test")).toBe(false); market.treasury = till - 1;
    // rope is not eaten; bread is
    expect(town.apply(a, { kind: "use", item: "rope" }, "test")).toBe(false); expect(a.inventory).toContain("rope");
    const loaves = a.inventory.filter((x) => x === "bread").length; expect(town.apply(a, { kind: "use", item: "bread" }, "test")).toBe(true); expect(a.inventory.filter((x) => x === "bread").length).toBe(loaves - 1);
    expect(coinsOnIsland()).toBe(start);
    // midnight: a third of what sits above a day's shelf goes stale; flour keeps
    while (town.hour < 9) await town.tick();
    const bakery = town.places.get("bakery")!; bakery.stock.bread = 27; bakery.stock.flour = 24; market.stock.fish = 15; for (const x of town.agents.values()) { x.location = "boatshed"; x.needs.hunger = 0; }
    await town.run(2);
    expect(bakery.stock.bread).toBe(22); expect(bakery.stock.flour).toBe(24); expect(market.stock.fish).toBe(14);
    expect(town.events.some((e) => /went stale/.test(e.text))).toBe(true);
    for (const p of town.places.values()) for (const [k, v] of Object.entries(p.stock)) expect(v, `${p.id} ${k}`).toBeGreaterThanOrEqual(0);
  });
});
