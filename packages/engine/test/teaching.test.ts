import { describe, expect, it } from "vitest";
import { Town, type Brain } from "../src/index.ts";
import { Perception } from "@unwatched/protocol";
import { ADVICE_LIFETIME, socialFoodConfidence } from "../src/learning.ts";
const brain: Brain={name:"teaching",async decide(){return {action:{kind:"wait"},remember:[]};},async reflect(){throw Error("unused");},async converse(){throw Error("unused");},async plan(){throw Error("unused");},async digest(){throw Error("unused");},async child(){throw Error("unused");},async writePaper(){throw Error("unused");},async life(){throw Error("unused");},async judge(){throw Error("unused");}};
const persona=(name:string)=>({name,age:30,origin:"mainland",summary:"curious",want:"eat",fear:"hunger",secret:"private",strangers:"polite",advice:"check it",traits:{warmth:.5,pride:.5,caution:.5,honesty:.5,ambition:.5}});
function setup(learning=true){
 const t=new Town({seed:7,brain,learning});t.t=600;
 const a=t.addAgent({persona:persona("Mira")}),b=t.addAgent({persona:persona("Ivo")}),c=t.addAgent({persona:persona("Ana")});
 for(const x of [a,b,c]){x.location="bakery";x.coins=100;}
 t.places.get("bakery")!.stock.bread=20;
 const buy=(who=a)=>t.apply(who,{kind:"trade",buy:"bread",with:"bakery"},"test");
 const teach=(from=a,to=b)=>t.apply(from,{kind:"teach",to:to.id,place:"bakery",item:"bread"},"test");
 return {t,a,b,c,buy,teach};
}
describe("knowledge learned from other citizens",()=>{
 it("shares only recent firsthand evidence, in person, once; hearsay cannot be relayed as experience",()=>{
  const f=setup();expect(f.teach()).toBe(false);f.buy();f.t.t++;
  f.b.location="harbor";expect(f.teach()).toBe(false);f.b.location="bakery";f.b.asleep=true;expect(f.teach()).toBe(false);f.b.asleep=false;
  expect(f.teach()).toBe(true);expect(f.b.foodLessons).toEqual([]);expect(f.teach()).toBe(false);expect(f.teach(f.b,f.c)).toBe(false);
  expect(f.b.foodAdvice).toHaveLength(1);expect(Perception.parse(f.t.perceive(f.b)).self.food_advice?.[0]?.from).toBe(f.a.id);
  expect(f.t.events.find(e=>e.kind==="knowledge.shared")?.payload?.sourceT).toBe(600);
  f.t.t+=ADVICE_LIFETIME+1;expect(f.teach(f.a,f.c)).toBe(false);
 });
 it("lets a recipient verify and then teach their own result; rewards trust once",()=>{
  const f=setup();f.buy();f.t.t++;f.teach();const trust=f.b.relationships.get(f.a.id)?.trust??.3;
  f.t.t++;f.buy(f.b);expect(f.b.foodAdvice?.[0]?.tested).toMatchObject({success:true,matched:true});
  expect(f.b.relationships.get(f.a.id)?.trust).toBeCloseTo(trust+.04);
  f.t.t++;f.buy(f.b);expect(f.b.relationships.get(f.a.id)?.trust).toBeCloseTo(trust+.04);
  expect(f.teach(f.b,f.c)).toBe(true);expect(f.c.foodAdvice?.[0]?.from).toBe(f.b.id);
 });
 it("disconfirmed tips lower trust, but an empty purse is not evidence against the teacher",()=>{
  const f=setup();f.buy();f.t.t++;f.teach();f.t.t++;f.b.coins=0;f.buy(f.b);expect(f.b.foodAdvice?.[0]?.tested).toBeUndefined();
  f.b.coins=100;f.t.places.get("bakery")!.stock.bread=0;f.buy(f.b);
  expect(f.b.foodAdvice?.[0]?.tested).toMatchObject({success:false,matched:false});expect(f.b.relationships.get(f.a.id)?.trust).toBeCloseTo(.24);
  f.buy(f.b);expect(f.b.relationships.get(f.a.id)?.trust).toBeCloseTo(.24);
 });
 it("changes an executed route in a controlled comparison, while live stock wins",async()=>{
  for(const [enabled,stocked] of [[true,true],[false,true],[true,false]]){
   const f=setup();f.buy();f.t.t++;f.teach();
   for(const p of f.t.places.values())p.sells=[];
   for(const id of ["market","bakery"]){const p=f.t.places.get(id)!;p.sells=[{item:"bread",base:2}];p.stock.bread=id==="bakery"&&!stocked?0:20;p.exits=["harbor"];}
   f.t.places.get("harbor")!.exits=["market","bakery"];
   f.b.location="harbor";f.b.inventory=[];f.b.needs.hunger=.8;f.b.heard=[];f.b.budget.tier1Left=0;f.b.budget.tier2Left=0;f.t.agents.delete(f.a.id);f.t.agents.delete(f.c.id);
   const active=enabled?f.t:new Town({seed:7,brain,learning:false});if(!enabled)active.restore(JSON.parse(JSON.stringify(f.t.snapshot())));
   await active.tick();expect(active.agents.get(f.b.id)?.location).toBe(enabled&&stocked?"bakery":"market");
  }
 });
 it("does not amplify duplicate tips, expires them, and restores testing across snapshots",()=>{
  const f=setup();f.buy();f.t.t++;f.teach();
  const tip=f.b.foodAdvice![0]!;
  const score=socialFoodConfidence([], [tip], new Map(),"bakery","bread",f.t.t);
  expect(socialFoodConfidence([], Array(20).fill(tip),new Map(),"bakery","bread",f.t.t)).toBe(score);
  expect(socialFoodConfidence([], [tip],new Map(),"bakery","bread",f.t.t+ADVICE_LIFETIME+1)).toBe(.5);
  expect(socialFoodConfidence([], [tip],new Map([[f.a.id,{trust:.1}]]),"bakery","bread",f.t.t)).toBe(.5);
  f.t.t++;f.buy(f.b);const snap=f.t.snapshot();const back=new Town({seed:7,brain});back.restore(JSON.parse(JSON.stringify(snap)));
  expect(back.agents.get(f.b.id)?.foodAdvice).toEqual(f.b.foodAdvice);
  back.agents.get(f.b.id)!.foodAdvice![0]!.confidence=0;expect(snap.agents.find(a=>a.id===f.b.id)?.state.foodAdvice?.[0]?.confidence).not.toBe(0);
  for(const a of snap.agents)delete a.state.foodAdvice;expect(()=>new Town({seed:7,brain}).restore(snap)).not.toThrow();
  const off=setup(false);off.buy();expect(off.teach()).toBe(false);
 });
});
