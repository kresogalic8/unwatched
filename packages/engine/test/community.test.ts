import { describe, expect, it } from "vitest";
import { Town } from "../src/index.ts";
import type { Brain } from "../src/types.ts";
import { Action, Perception } from "@unwatched/protocol";
import { habit } from "../src/habit.ts";

const brain: Brain = {
  name: "community-test", async decide() { return { action: { kind: "wait" }, remember: [] }; },
  async reflect() { return { summary: "", insights: [], opinions: [], intentions: [], letter_to_owner: null }; },
  async plan() { return { mood: "", goals: [], steps: [] }; }, async converse() { throw Error("unused"); },
  async digest() { return { text: "", headline: "" }; }, async child() { throw Error("unused"); },
  async writePaper() { throw Error("unused"); }, async life() { return { title: "", text: "", epitaph: "" }; },
  async judge() { throw Error("unused"); },
};
const persona = (name: string) => ({ name, age: 30, origin: "mainland", summary: "gardener", want: "feed neighbors", fear: "hunger", secret: "private", strangers: "kind", advice: "verify", traits: { warmth: .7, pride: .5, caution: .5, honesty: .8, ambition: .6 } });
function setup() {
  const t = new Town({ seed: 7, brain }); t.t = 540; t.seasonOverride = "spring";
  const a = t.addAgent({ persona: persona("Mira") }), b = t.addAgent({ persona: persona("Ivo") });
  a.location = b.location = "shore-1";
  const p = t.places.get(a.location)!;
  const propose = () => t.apply(a, Action.parse({ kind: "start_project", at: p.id, name: "Neighbors' garden", why: "We need another food source" }), "test");
  return { t,a,b,p,propose };
}
function contribute(f: ReturnType<typeof setup>, who = f.a, coins = 9) { return f.t.apply(who, { kind: "contribute_project", at: f.p.id, coins, help: true }, "test"); }
function wealth(t: Town) { return [...t.agents.values()].reduce((s,a) => s+a.coins,0) + [...t.places.values()].reduce((s,p) => s+p.treasury+(p.community?.phase === "funding" ? p.community.coins : 0),0); }
function finish(f: ReturnType<typeof setup>) {
  f.propose(); contribute(f); contribute(f,f.b);
  for (let day=1;day<=3;day++) { f.t.day=day;f.t.t=(day-1)*1440+540; f.t.apply(f.a,{kind:"work"},"test"); f.t.apply(f.b,{kind:"work"},"test"); }
}

describe("citizen-led shared gardens", () => {
  it("reserves a proposed plot, pools actual coins and materials, counts each volunteer once, then produces finite food only after tending", () => {
    const f=setup(), before=wealth(f.t), planks=f.t.places.get("sawpit")!.stock.planks!;
    expect(f.propose()).toBe(true);
    expect(f.p.site).toBeNull(); expect(f.a.coins).toBe(40);
    expect(f.t.apply(f.b,{kind:"build",what:"house",at:f.p.id},"test")).toBe(false);
    expect(contribute(f)).toBe(true); expect(f.p.site).toBeNull(); expect(wealth(f.t)).toBe(before);
    expect(contribute(f,f.b)).toBe(true); expect(wealth(f.t)).toBe(before);
    expect(f.t.places.get("sawpit")!.stock.planks).toBe(planks-4);
    expect(contribute(f,f.b,1)).toBe(false);
    for(let day=1;day<=3;day++){
      f.t.day=day;f.t.t=(day-1)*1440+540;
      f.t.apply(f.a,{kind:"work"},"test");f.t.apply(f.a,{kind:"work"},"test");f.t.apply(f.b,{kind:"work"},"test");
    }
    expect(f.p.community?.members.map(m=>m.labor)).toEqual([3,3]);
    expect(f.p.site).toBeNull();expect(f.p.owner).toBeNull();expect(f.p.sprite).toBe("garden");
    expect(f.p.stock.vegetables).toBe(0);expect(f.t.apply(f.a,{kind:"work"},"test")).toBe(false);
    f.t.day=5;f.t.t=4*1440+540;f.t.weather="clear";
    expect(f.t.apply(f.a,{kind:"work"},"test")).toBe(true);
    expect(f.t.apply(f.a,{kind:"work"},"test")).toBe(false);
    expect(f.p.stock.vegetables).toBe(3);
    f.b.coins=0;expect(f.t.apply(f.b,{kind:"trade",buy:"vegetables",with:f.p.id},"test")).toBe(true);
    expect(f.b.inventory).toContain("vegetables");expect(f.p.stock.vegetables).toBe(2);
    f.b.needs.hunger=.9;f.t.apply(f.b,{kind:"use",item:"vegetables"},"test");expect(f.b.needs.hunger).toBeCloseTo(.3);
    expect(f.p.history?.moments.at(-1)?.kind).toBe("finished");
    expect(Perception.parse(f.t.perceive(f.b)).town?.projects?.[0]?.phase).toBe("complete");
  });
  it("waits for real planks, refunds only unspent funds and allows volunteers to stop",()=>{
    const f=setup();f.propose();f.t.places.get("sawpit")!.stock.planks=0;contribute(f);contribute(f,f.b);
    expect(f.p.community?.phase).toBe("funding");expect(f.t.apply(f.a,{kind:"work"},"test")).toBe(false);
    f.t.apply(f.b,{kind:"withdraw_project",at:f.p.id},"test");expect(f.b.coins).toBe(40);expect(f.p.community?.coins).toBe(9);
    contribute(f,f.b);f.t.places.get("sawpit")!.stock.planks=4;
    expect(f.t.apply(f.a,{kind:"work"},"test")).toBe(true);expect(f.p.community?.phase).toBe("building");
    const coins=f.a.coins;f.t.apply(f.a,{kind:"withdraw_project",at:f.p.id},"test");expect(f.a.coins).toBe(coins);expect(f.p.community?.members[0]?.help).toBe(false);
  });
  it("restores funding, labor and harvest limits; old snapshots need no project data",()=>{
    const f=setup();finish(f);f.t.day=5;f.t.t=4*1440+540;f.t.weather="clear";f.t.apply(f.a,{kind:"work"},"test");
    const saved=JSON.parse(JSON.stringify(f.t.snapshot()));const back=new Town({seed:7,brain});back.restore(saved);back.seasonOverride="spring";
    const a=back.agents.get(f.a.id)!;expect(back.apply(a,{kind:"work"},"test")).toBe(false);
    expect(back.places.get(f.p.id)?.community?.foodProduced).toBe(3);
    const before=back.places.get(f.p.id)?.stock.vegetables;
    back.day++;back.weather="storm";expect(back.apply(a,{kind:"work"},"test")).toBe(false);expect(back.places.get(f.p.id)?.stock.vegetables).toBe(before);
    for(const p of saved.places)delete p.community;
    expect(()=>new Town({seed:7,brain}).restore(saved)).not.toThrow();
  });
  it("follows a chosen contribution, but does not assign strangers to work or invent a proposal",()=>{
    const f=setup();f.propose();contribute(f);contribute(f,f.b);f.a.location="harbor";f.a.needs={hunger:.1,rest:.1,social:.1};
    const v={now:f.t.t,day:f.t.day,places:f.t.places,jobs:new Map(),hour:9,crowd:()=>0,price:(p:any,i:string)=>f.t.price(p,i),path:()=>f.p.id};
    expect(habit(f.a,v)).toEqual({kind:"move",to:f.p.id});
    f.a.location=f.p.id;f.t.apply(f.a,{kind:"withdraw_project",at:f.p.id},"test");f.a.location="harbor";
    expect(habit(f.a,v)).toEqual({kind:"wait"});
    const empty=setup();empty.a.needs={hunger:.1,rest:.1,social:.1};
    expect(habit(empty.a,{...v,places:empty.t.places})).toEqual({kind:"wait"});expect(empty.p.community).toBeUndefined();
  });
  it("caps harvests and respects winter, hunger and paid shifts before volunteering",()=>{
    const f=setup();finish(f);f.t.day=5;f.t.t=4*1440+540;f.t.weather="clear";
    f.p.stock.vegetables=23;expect(f.t.apply(f.a,{kind:"work"},"test")).toBe(true);expect(f.p.stock.vegetables).toBe(24);
    expect(f.t.apply(f.b,{kind:"work"},"test")).toBe(false);f.p.stock.vegetables=0;f.t.seasonOverride="winter";
    expect(f.t.apply(f.b,{kind:"work"},"test")).toBe(false);
    f.t.seasonOverride="spring";f.a.location="harbor";f.a.needs={hunger:.1,rest:.1,social:.1};
    const job={id:"shift",place:"market",title:"Market work",hours:[8,17] as [number,number],wage:2,slots:1,holders:[f.a.id]};f.a.job=job.id;
    const v={now:f.t.t,day:f.t.day,places:f.t.places,jobs:new Map([[job.id,job]]),hour:9,weekday:1,season:"spring",weather:"clear",crowd:()=>0,price:(p:any,i:string)=>f.t.price(p,i),path:(_from:string,to:string)=>to};
    expect(habit(f.a,v)).toEqual({kind:"move",to:"market"});f.a.inventory=["bread"];f.a.needs.hunger=.9;
    expect(habit(f.a,v)).toEqual({kind:"use",item:"bread"});
  });
  it("rejects remote, unaffordable and duplicate proposals; abandoned unfunded plots become free",()=>{
    const f=setup();f.a.location="market";expect(f.propose()).toBe(false);f.a.location=f.p.id;f.propose();expect(f.propose()).toBe(false);
    expect(contribute(f,f.b,19)).toBe(false);f.b.coins=1;expect(contribute(f,f.b,9)).toBe(false);
    f.t.apply(f.a,{kind:"withdraw_project",at:f.p.id},"test");expect(f.p.community).toBeUndefined();
  });
});
