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

describe("belongings and tools", () => {
  function setup(items: string[] = []) {
    const town = new Town({seed: 8, brain: none}); town.t = 600; town.weather = "clear";
    const a = town.addAgent({persona: persona("A", new Rng(1))}); a.inventory = items; a.location = "boatshed"; a.home = {place: "boatshed", nightsPaid: 2};
    return {town, a};
  }
  it("consumes real ingredients atomically and preserves a crafted gift's identity", () => {
    const {town,a}=setup(["timber","rope"]);
    expect(town.apply(a,{kind:"craft",recipe:"basket"})).toBe(false);
    expect(a.inventory).toEqual(["timber","rope"]);
    expect(town.apply(a,{kind:"craft",recipe:"fishing rod"})).toBe(true);
    const rod=a.itemInstances![0]!; expect(rod.madeBy).toBe("A");
    const b=town.addAgent({persona:persona("B",new Rng(2))});b.location=a.location;
    expect(town.apply(a,{kind:"give",to:b.id,item:"fishing rod"})).toBe(true);
    expect(b.itemInstances!.find(i=>i.name==="fishing rod")!.id).toBe(rod.id);
    expect(b.itemInstances!.find(i=>i.name==="fishing rod")!.history.at(-1)!.what).toContain("gift");
  });
  it("stores and retrieves the same object across restart, only at its location", () => {
    const {town,a}=setup(["timber","rope"]);town.apply(a,{kind:"craft",recipe:"fishing rod"});const id=a.itemInstances![0]!.id;
    expect(town.apply(a,{kind:"stow",item:id})).toBe(true);expect(a.inventory).toEqual([]);
    const restored=new Town({seed:8,brain:none});restored.restore(town.snapshot());const b=restored.agents.get(a.id)!;
    b.location="harbor";expect(restored.apply(b,{kind:"retrieve",item:id})).toBe(false);
    b.location="boatshed";expect(restored.apply(b,{kind:"retrieve",item:id})).toBe(true);expect(b.itemInstances![0]!.id).toBe(id);
    expect(b.storage![0]!.items).toHaveLength(0);
  });
  it("drops one object and allows only one citizen to pick it up", () => {
    const {town,a}=setup(["stone"]);town.snapshot();const id=a.itemInstances![0]!.id;
    expect(town.apply(a,{kind:"drop",item:id})).toBe(true);
    const b=town.addAgent({persona:persona("B",new Rng(2))});b.location=a.location;
    expect(town.apply(b,{kind:"pickup",item:id})).toBe(true);
    expect(town.apply(a,{kind:"pickup",item:id})).toBe(false);
    expect(b.itemInstances!.find(i=>i.id===id)?.name).toBe("stone");
  });
  it("keeps old overfull bags and rejects new goods; an equipped basket adds space", () => {
    const {town,a}=setup([...Array(12).fill("stone"),"basket"]);town.snapshot();
    expect(a.inventory).toHaveLength(13);a.location="market";
    expect(town.apply(a,{kind:"trade",buy:"bread"})).toBe(false);
    expect(town.apply(a,{kind:"equip",item:a.itemInstances!.find(i=>i.name==="basket")!.id})).toBe(true);
    expect(town.apply(a,{kind:"trade",buy:"bread"})).toBe(true);
    expect(town.apply(a,{kind:"equip",item:null})).toBe(true);expect(a.inventory).toHaveLength(14);
  });
  it("wears a rod, repairs it with material, and does not grant a tool from impossible ingredients", async () => {
    const {town,a}=setup(["fishing rod","planks"]);a.location="harbor";a.needs={hunger:.1,rest:.1,social:.1};town.snapshot();const id=a.itemInstances![0]!.id;
    town.apply(a,{kind:"equip",item:id});town.apply(a,{kind:"fish"});for(let i=0;i<=20;i++)await town.tick();
    expect(a.itemInstances!.find(i=>i.id===id)!.condition).toBe(90);
    expect(town.apply(a,{kind:"repair_tool",item:id})).toBe(true);expect(a.itemInstances!.find(i=>i.id===id)!.condition).toBe(100);expect(a.inventory).not.toContain("planks");
    a.location="smithy";a.job="smithy.smith";town.places.get("smithy")!.stock.bread=1;
    expect(town.apply(a,{kind:"make",item:"hammer",from:["bread"]})).toBe(false);
  });
  it("a used tool keeps condition and maker when sold and bought", () => {
    const {town,a}=setup(["hammer"]);town.snapshot();const tool=a.itemInstances![0]!;tool.condition=40;tool.madeBy="B";
    a.location="smithy";const place=town.places.get("smithy")!;place.sells.push({item:"hammer",base:4});place.stock.hammer=0;
    expect(town.apply(a,{kind:"trade",sell:"hammer"})).toBe(true);
    expect(town.apply(a,{kind:"trade",buy:"hammer"})).toBe(true);
    expect(a.itemInstances![0]).toMatchObject({id:tool.id,condition:40,madeBy:"B"});
  });
});
