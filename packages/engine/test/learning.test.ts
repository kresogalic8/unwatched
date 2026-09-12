import { describe, expect, it } from "vitest";
import { Town, habit, type Brain } from "../src/index.ts";
import { foodExperience, recordPurchase, type FoodLesson } from "../src/learning.ts";
import { Perception } from "@unwatched/protocol";
const none: Brain = { name: "none", async decide(){return {action:{kind:"wait"},remember:[]};}, async reflect(){throw Error("unused");},async converse(){throw Error("unused");},async plan(){throw Error("unused");},async digest(){throw Error("unused");},async child(){throw Error("unused");},async writePaper(){throw Error("unused");},async life(){throw Error("unused");},async judge(){throw Error("unused");} };
function setup(learning=true) {
  const town=new Town({seed:7,brain:none,learning});
  const agent=town.addAgent({persona:{name:"Learner",age:30,origin:"mainland",summary:"curious",want:"eat",fear:"hunger",secret:"none",strangers:"polite",advice:"listens",traits:{warmth:.5,pride:.5,caution:.5,honesty:.5,ambition:.5}}});
  town.t=600; agent.location="bakery"; agent.coins=100;
  const bakery=town.places.get("bakery")!; bakery.stock.bread=20;
  return {town,agent,bakery};
}
describe("learning from actual outcomes",()=>{
  it("records validated purchases with public evidence; failures cannot fabricate success",()=>{
    const {town,agent,bakery}=setup();
    expect(town.apply(agent,{kind:"trade",buy:"bread",with:"bakery"},"test")).toBe(true);
    const e=agent.foodLessons![0]!.evidence[0]!;
    expect(e.success).toBe(true); expect(e.cost).toBeGreaterThan(0);
    expect(town.events.find(x=>x.id===e.eventId)?.kind).toBe("agent.trade");
    bakery.stock.bread=0;
    expect(town.apply(agent,{kind:"trade",buy:"bread",with:"bakery"},"test")).toBe(false);
    town.apply(agent,{kind:"trade",buy:"bread",with:"bakery"},"test");
    expect(agent.foodLessons![0]!.evidence).toHaveLength(2);
    expect(agent.foodLessons![0]!.evidence[1]!.eventId).toBeUndefined();
    bakery.stock.bread=10; agent.coins=0;
    town.apply(agent,{kind:"trade",buy:"bread",with:"bakery"},"test");
    expect(agent.foodLessons![0]!.evidence).toHaveLength(2);
  });
  it("changes an otherwise identical routine only when learning is enabled",()=>{
    const {town,agent}=setup();
    for(let i=0;i<3;i++){town.t+=60;town.apply(agent,{kind:"trade",buy:"bread"},"test");}
    agent.location="harbor";agent.inventory=[];agent.needs.hunger=.8;
    const market=town.places.get("market")!;market.stock.bread=20;
    const view={places:town.places,jobs:town.jobs,hour:10,now:town.t,crowd:()=>0,price:(p:typeof market,item:string)=>item==="bread" && (p.stock.bread??0)>0?2:null,path:(_:string,to:string)=>to,hops:()=>1};
    expect(habit(agent,{...view,learning:false})).toEqual({kind:"move",to:"market"});
    expect(habit(agent,{...view,learning:true})).toEqual({kind:"move",to:"bakery"});
    town.places.get("bakery")!.stock.bread=0;
    expect(habit(agent,{...view,learning:true})).toEqual({kind:"move",to:"market"});
  });
  it("records only an executed change of route, with a learning-off control",async()=>{
    for(const enabled of [false,true]) {
      const {town,agent}=setup(enabled);
      for(let i=0;i<3;i++){town.t+=60;town.apply(agent,{kind:"trade",buy:"bread"},"test");}
      for(const p of town.places.values())p.sells=[];
      for(const id of ["market","bakery"]){const p=town.places.get(id)!;p.sells=[{item:"bread",base:2}];p.stock.bread=20;p.exits=["harbor"];}
      town.places.get("harbor")!.exits=["market","bakery"];
      agent.location="harbor";agent.inventory=[];agent.needs.hunger=.8;agent.heading=null;
      await town.tick();
      expect(agent.location).toBe(enabled?"bakery":"market");
      expect(agent.foodRoutineDecisions??[]).toHaveLength(enabled?1:0);
      if(enabled) {
        expect(agent.foodRoutineDecisions![0]).toMatchObject({from:"harbor",next:"bakery",baseline:"market",preferred:"bakery"});
        const back=new Town({seed:7,brain:none});back.restore(JSON.parse(JSON.stringify(town.snapshot())));
        expect(back.agents.get(agent.id)!.foodRoutineDecisions).toEqual(agent.foodRoutineDecisions);
      }
    }
  });
  it("restores evidence without aliasing snapshots and accepts old saves",()=>{
    const {town,agent}=setup();town.apply(agent,{kind:"trade",buy:"bread"},"test");
    const snap=town.snapshot();const restored=new Town({seed:7,brain:none});restored.restore(JSON.parse(JSON.stringify(snap)));
    expect(restored.agents.get(agent.id)!.foodLessons).toEqual(agent.foodLessons);
    expect(Perception.parse(restored.perceive(restored.agents.get(agent.id)!)).self.learned_food?.[0]?.observations).toBe(1);
    snap.agents[0]!.state.foodLessons![0]!.evidence[0]!.cost=999;
    expect(agent.foodLessons![0]!.evidence[0]!.cost).not.toBe(999);
    delete snap.agents[0]!.state.foodLessons;restored.restore(snap);
    expect(restored.agents.get(agent.id)!.foodLessons).toEqual([]);
  });
  it("forgets stale certainty, reverses with contrary evidence and bounds storage",()=>{
    const lessons:FoodLesson[]=[];
    for(let i=0;i<8;i++)recordPurchase(lessons,"bakery","bread",{t:i*60,success:true,cost:2});
    expect(foodExperience(lessons,"bakery","bread",500).confidence).toBeGreaterThan(.8);
    expect(foodExperience(lessons,"bakery","bread",1440*100).confidence).toBeCloseTo(.5,3);
    for(let i=8;i<32;i++)recordPurchase(lessons,"bakery","bread",{t:i*60,success:false,cost:0});
    expect(lessons[0]!.evidence).toHaveLength(16);
    expect(foodExperience(lessons,"bakery","bread",32*60).confidence).toBeLessThan(.2);
    for(let i=0;i<30;i++)recordPurchase(lessons,`place${i}`,"bread",{t:i,success:true,cost:2});
    expect(lessons).toHaveLength(24);
  });
  it("can disable recording and perception for controlled comparisons",()=>{
    const {town,agent}=setup(false);town.apply(agent,{kind:"trade",buy:"bread"},"test");
    expect(agent.foodLessons??[]).toEqual([]);expect(town.perceive(agent).self.learned_food).toBeUndefined();
  });
});
