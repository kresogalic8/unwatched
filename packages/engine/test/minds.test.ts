import { describe, it, expect } from "vitest";
import { Town, Rng, MINUTES_PER_DAY } from "../src/index.ts";
import type { Brain, ReflectContext } from "../src/index.ts";
import { salience } from "../src/salience.ts";
import type { Perception } from "@unwatched/protocol";

const persona = (name: string, rng: Rng) => ({ name, age: 30, origin: "the mainland", summary: "A person.", want: "A room.", fear: "Debt.", secret: "None.", strangers: "Polite.", advice: "Considers it.", traits: { warmth: rng.next(), pride: rng.next(), caution: rng.next(), honesty: rng.next(), ambition: rng.next() } });
/** A mind that plans two steps, answers a letter that asks, and keeps every night's reflection context for the test to read. */
const reflected: ReflectContext[] = []; let seen: Perception | null = null;
const mind: Brain = {
  name: "mind",
  async decide(p) { seen = p; if (p.crossroads && /asks something of you/.test(p.crossroads)) return { action: { kind: "message_owner", text: "Yes, I am eating." }, remember: [] }; return { action: { kind: "wait" }, remember: [] }; },
  async plan() { return { mood: "set", goals: ["bread at the market by nine"], steps: [{ hour: 8, do: "look at the mill", place: "mill" }, { hour: 9, do: "buy bread", place: "market" }] }; },
  async reflect(ctx) { reflected.push(ctx); return { summary: `Day ${ctx.day}.`, insights: [], opinions: [], intentions: [], letter_to_owner: null }; },
  async converse(ctx) { return { lines: [{ speaker: ctx.a.id, text: "Morning." }], outcome: { a_trust_delta: 0, b_trust_delta: 0, a_remember: "Passed.", b_remember: "Passed.", rumor: null } }; },
  async digest() { return { text: "", headline: "" }; }, async child() { throw new Error("no"); },
  async writePaper(ctx) { return { edition: ctx.edition, date: ctx.date, weather: ctx.weather, lead: { headline: "h", deck: "d", body: "b" }, briefs: [], notices: [] }; },
  async life() { return { title: "t", text: "x", epitaph: "e" }; }, async judge() { return { happened: "it passed", plausible: true, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] }; },
};

describe("the mind sees the town, the plan, and itself", () => {
  it("the perception carries the town sheet, the body in words, the shift and the planks; the plan is ticked by where they were, not by the thought; the reflection sees what it meant to do", async () => {
    const town = new Town({ seed: 14, brain: mind }); const rng = new Rng(14);
    const a = town.addAgent({ persona: persona("Mira", rng), owner: "o" }), b = town.addAgent({ persona: persona("Vesna", rng) });
    a.budget.tier2Max = 5; a.job = "bakery.cook"; town.jobs.get("bakery.cook")!.holders.push(a.id);
    b.location = "market"; b.asleep = true; a.relationships.set(b.id, { trust: 0.6, affection: 0.4, lastSeen: 0, opinion: "", lastPlace: null });
    a.needs = { hunger: 0.75, rest: 0.9, social: 0.1 }; a.location = "lane-1";
    const p = town.perceive(a);
    expect(p.town?.people).toBeUndefined(); // Vesna has never been seen, so there is nothing to say about where she is and no sheet to send
    a.relationships.get(b.id)!.lastPlace = "market"; // now she has been seen there once
    expect(town.perceive(a).town?.people).toEqual([{ name: "Vesna", place: "market", asleep: false }]); // where she was last seen; whether she is asleep cannot be told from the lane
    expect(p.self.feels).toEqual({ hunger: "very hungry", rest: "exhausted", social: "content" });
    expect(p.self.shift).toEqual({ place: "bakery", wage: 3, hours: [6, 12] });
    expect(p.place.plot?.planks).toBe(24);
    b.location = "lane-1"; expect(town.perceive(a).nearby[0]?.asleep).toBe(true); b.asleep = false; b.location = "market";
    // the plan: the mill step is never reached and is missed three hours on; the market step is done by being there from nine
    await town.run(2); a.needs.hunger = 0.2;
    while (town.hour < 12) { a.location = town.hour >= 9 ? "market" : "lane-1"; a.asleep = false; a.needs.hunger = 0.2; await town.tick(); }
    expect(a.plan?.day).toBe(2); const mill = a.plan!.steps.find((s) => s.place === "mill")!, market = a.plan!.steps.find((s) => s.place === "market")!;
    expect(mill.done).toBe(false); expect(mill.missed).toBe(true); expect(market.done).toBe(true); expect(market.missed).toBeFalsy();
    expect(town.perceive(a).today?.steps.find((s) => s.place === "mill")?.missed).toBe(true);
    // midnight: the reflection is shown the plan with what came of it, the lists it keeps, and whether the day was quiet
    await town.run(3);
    const ref = reflected.find((r) => r.agent.id === a.id && r.day === 2)!; expect(ref).toBeDefined();
    expect(ref.plan?.goals).toEqual(["bread at the market by nine"]); expect(ref.plan?.steps.map((s) => [s.place, s.done, s.missed])).toEqual([["the mill", false, true], ["the market square", true, false]]);
    expect(Array.isArray(ref.watch)).toBe(true); expect(Array.isArray(ref.projects)).toBe(true); expect(Array.isArray(ref.beliefs)).toBe(true); expect(typeof ref.quiet).toBe("boolean");
    // the digest reads the gap: the plan's steps and whose trust moved go to the writer
    const ctx = town.digestContext(a.id, 0)!; expect(Array.isArray(ctx.trust)).toBe(true); expect(Array.isArray(ctx.projects)).toBe(true);
  });

  it("the body and the calendar interrupt: hunger with coins every two hours, the first day of starving once, a debt due once, a gathering ahead once", () => {
    const town = new Town({ seed: 15, brain: mind }); const rng = new Rng(15);
    const a = town.addAgent({ persona: persona("A", rng) }); a.asleep = false; a.job = "bakery.cook"; // employed, so "broke" never fires
    const view = (extra: Partial<Parameters<typeof salience>[1]> = {}) => ({ hour: 10, t: 10 * 60 + 5000, day: 4, nearby: [], jobsOpenHere: 0, ...extra });
    a.lastThought = view().t - 200;
    expect(salience(a, view())).toBeNull();
    a.needs.hunger = 0.9; a.coins = 0; expect(salience(a, view())).toBeNull();
    a.coins = 3; expect(salience(a, view())?.why).toBe("hungry"); a.lastHungerThought = view().t - 30; expect(salience(a, view())).toBeNull(); a.lastHungerThought = view().t - 121; expect(salience(a, view())?.why).toBe("hungry");
    a.needs.hunger = 0.2;
    a.starving = 1; expect(salience(a, view())).toEqual({ tier: 2, why: "starving" }); a.starvingThoughtDay = 4; expect(salience(a, view())).toBeNull(); a.starving = 0;
    expect(salience(a, view({ debtDue: true }))).toEqual({ tier: 2, why: "debt due" }); a.debtThoughtDay = 4; expect(salience(a, view({ debtDue: true }))).toBeNull();
    expect(salience(a, view({ gathering: { id: 7, what: "The council sits" } }))?.why).toBe("gathering: The council sits"); a.gatheringThoughtId = 7; expect(salience(a, view({ gathering: { id: 7, what: "The council sits" } }))).toBeNull();
    // the town's own day decides which plan is today's: yesterday's plan draws no thought
    a.plan = { day: 3, mood: "", goals: ["x"], steps: [{ hour: 8, do: "wait here", place: null, done: false }] }; expect(salience(a, view())).toBeNull();
    a.plan.day = 4; expect(salience(a, view())?.why).toBe("plan: wait here");
  });

  it("a letter that asks gets its answer within the next thoughts, once, and the answer is not held to the day's one letter home", async () => {
    const town = new Town({ seed: 16, brain: mind }); const rng = new Rng(16);
    const a = town.addAgent({ persona: persona("Mira", rng), owner: "o" }); a.budget.tier2Max = 5; a.budget.tier2Left = 5;
    await town.run(2); while (town.hour < 10) await town.tick();
    town.sendLetter(a.id, "Are you eating enough? Write back.");
    for (let i = 0; i < 30 && !town.events.some((e) => e.kind === "agent.letter" && e.day === 2); i++) { a.asleep = false; await town.tick(); }
    const reply = town.events.find((e) => e.kind === "agent.letter" && e.day === 2); expect(reply?.text).toMatch(/Yes, I am eating/);
    expect(a.letters[0]?.answered).toBe(true); expect(a.replyTo).toBeNull();
    expect(a.ownerLetterDay).not.toBe(2); // the reply did not spend the day's unprompted letter
    expect(town.apply(a, { kind: "message_owner", text: "One more thing." }, "test")).toBe(true); expect(a.ownerLetterDay).toBe(2);
    // a letter that asks nothing sets no crossroads
    town.sendLetter(a.id, "Good luck out there."); a.crossroads = null; a.replyTo = null; a.lastThought = -999; a.hint = "x";
    await town.tick(); expect(a.replyTo).toBeNull();
  });

  it("the digest admits what was said to someone, what the town refused, and the first and last of the day, whatever their weight; no boat leaves in a storm or when it is held", async () => {
    const town = new Town({ seed: 17, brain: mind }); const rng = new Rng(17);
    const a = town.addAgent({ persona: persona("A", rng), owner: "o" }), b = town.addAgent({ persona: persona("B", rng) });
    a.location = b.location = "market"; a.asleep = b.asleep = false;
    expect(town.apply(a, { kind: "say", to: b.id, text: "Any work going?" }, "test")).toBe(true);
    expect(town.apply(a, { kind: "trade", with: "market", buy: "rope" }, "test")).toBe(false);
    expect(town.apply(a, { kind: "trade", with: "market", buy: "bread" }, "test")).toBe(true);
    const d = town.digest(a.id, 0); const kinds = d.items.map((e) => e.kind);
    expect(kinds).toContain("agent.say"); expect(kinds).toContain("action.rejected"); expect(kinds).toContain("agent.arrive"); expect(d.items.at(-1)?.kind).toBe("agent.trade");
    // the boat
    a.location = "harbor"; while (town.hour < 10) await town.tick(); a.location = "harbor"; a.asleep = false;
    town.weather = "storm"; expect(town.apply(a, { kind: "leave", why: "done here" }, "test")).toBe(false); expect(town.events.at(-1)!.text).toMatch(/storm/); expect(town.perceive(a).options).not.toContain("leave");
    town.weather = "clear"; town.boatHeld = true; expect(town.apply(a, { kind: "leave" }, "test")).toBe(false); expect(town.perceive(a).options).not.toContain("leave");
    town.boatHeld = false; expect(town.perceive(a).options).toContain("leave"); expect(town.apply(a, { kind: "leave" }, "test")).toBe(true); expect(town.agents.has(a.id)).toBe(false);
    void seen; void MINUTES_PER_DAY;
  });
});
