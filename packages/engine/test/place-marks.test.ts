import { describe, expect, it } from "vitest";
import { Town } from "../src/index.ts";
import type { Brain, TownSnapshot } from "../src/index.ts";
import { Action, Perception, coastalWonder } from "@unwatched/protocol";

const mind: Brain = {
  name: "builder-test",
  async decide() { return { action: { kind: "wait" }, remember: [] }; },
  async reflect() { return { summary: "I say it is finished.", insights: [], opinions: [], intentions: [], letter_to_owner: null, projects: [{ title: "A home", progress: "Finished!", done: true }] }; },
  async plan() { return { mood: "working", goals: [], steps: [] }; },
  async converse() { throw new Error("no conversation"); },
  async digest() { return { text: "", headline: "" }; },
  async child() { throw new Error("no child"); },
  async writePaper() { throw new Error("no paper"); },
  async life() { return { title: "A life", text: "", epitaph: "" }; },
  async judge() { return { happened: "nothing", plausible: false, coins_spent: 0, item_gained: null, item_lost: null, eases: null, trust: [] }; },
};
const persona = (name: string) => ({ name, age: 30, origin: "mainland", summary: "A builder", want: "a home", fear: "rain", secret: "none", strangers: "polite", advice: "listens", traits: { warmth: 0.5, pride: 0.5, caution: 0.5, honesty: 0.5, ambition: 0.5 } });

describe("places shaped by citizens", () => {
  function setup(){const town=new Town({seed:7,brain:mind});const a=town.addAgent({persona:persona("Mira")});a.location="harbor";a.asleep=false;a.coins=20;town.weather="clear";return{town,a,p:town.places.get("harbor")!};}
  it("spends real materials, publishes evidence and survives snapshot restoration",()=>{
    const {town,a,p}=setup();a.inventory=["planks","planks","bread"];const treasury=p.treasury;
    expect(town.apply(a,Action.parse({kind:"decorate",what:"bench",why:"A place to watch the boats"}),"test")).toBe(true);
    expect(a.coins).toBe(17);expect(p.treasury).toBe(treasury+3);expect(a.inventory).toEqual(["bread"]);
    expect(town.evolution.some(s=>s.moments.some(m=>m.kind==="place.decorated"))).toBe(true);
    expect(p.decorations).toHaveLength(1);expect(town.events.some(e=>e.kind==="place.decorated"&&e.actors[0]===a.id)).toBe(true);
    expect(Perception.parse(town.perceive(a)).place.decorations?.[0]?.why).toBe("A place to watch the boats");
    const back=new Town({seed:7,brain:mind});back.restore(JSON.parse(JSON.stringify(town.snapshot())));expect(back.places.get("harbor")?.decorations).toEqual(p.decorations);
  });
  it("rejects unfunded work, repetition, other people's property and storms without charging",()=>{
    const {town,a,p}=setup();expect(town.apply(a,{kind:"decorate",what:"bench",why:"Watch boats"},"test")).toBe(false);expect(a.coins).toBe(20);expect(p.decorations).toBeUndefined();
    expect(town.apply(a,{kind:"decorate",what:"flowers",why:"Some colour"},"test")).toBe(true);
    expect(town.apply(a,{kind:"decorate",what:"cairn",why:"A marker"},"test")).toBe(false);expect(p.decorations).toHaveLength(1);expect(a.coins).toBe(18);
    p.decorations=[];p.owner="someone-else";expect(town.apply(a,{kind:"decorate",what:"cairn",why:"A marker"},"test")).toBe(false);
    p.owner=null;town.weather="storm";expect(town.apply(a,{kind:"decorate",what:"cairn",why:"A marker"},"test")).toBe(false);
  });
  it("caps additions without dropping the permanent archive",()=>{
    const {town,a,p}=setup();p.decorations=Array.from({length:6},(_,i)=>({kind:"cairn" as const,by:`other${i}`,name:"Neighbour",why:"A marker",day:0,t:0}));
    expect(town.apply(a,{kind:"decorate",what:"flowers",why:"Some colour"},"test")).toBe(false);expect(p.decorations).toHaveLength(6);expect(a.coins).toBe(20);
  });
  it("shares a bounded summer-night phenomenon between renderer and perception",()=>{
    expect(coastalWonder(4,22,"summer","clear")).toBe(true);
    expect(coastalWonder(5,1,"summer","clear")).toBe(true);expect(coastalWonder(5,3,"summer","clear")).toBe(false);
    for(const args of [[4,12,"summer","clear"],[5,22,"summer","clear"],[4,22,"winter","clear"],[4,22,"summer","storm"]] as const)expect(coastalWonder(args[0],args[1],args[2],args[3])).toBe(false);
    const {town,a}=setup();town.t=3*1440+22*60;town.day=4;town.seasonOverride="summer";expect(town.perceive(a).time.occasion).toContain("bioluminescent");
  });
});
