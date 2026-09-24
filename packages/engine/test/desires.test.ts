import { describe, expect, it } from "vitest";
import { Town, type Brain, type ReflectContext } from "../src/index.ts";
import { desireEvidence, reviseDesires, recordDesireAttempt, desiresForMind } from "../src/desires.ts";
import { ActionProposal, Perception, Reflection, type TownEvent } from "@unwatched/protocol";
const persona = { name: "Mira", age: 30, origin: "mainland", summary: "curious", want: "find my way", fear: "being forgotten", secret: "none", strangers: "polite", advice: "considers", traits: { warmth: .5, pride: .5, caution: .5, honesty: .5, ambition: .5 } };
const base: Brain = { name: "desire-test", async decide() { return { action: { kind: "wait" }, remember: [] }; }, async reflect() { return { summary: "A quiet evening", insights: [], opinions: [], intentions: [], letter_to_owner: null }; }, async plan() { return { mood: "quiet", goals: [], steps: [] }; }, async converse() { throw Error("unused"); }, async digest() { throw Error("unused"); }, async child() { throw Error("unused"); }, async writePaper() { throw Error("unused"); }, async life() { throw Error("unused"); }, async judge() { throw Error("unused"); } };
const event: TownEvent = { id: 10, t: 600, day: 1, kind: "agent.trade", actors: ["ag_1"], text: "Mira bought bread.", importance: .4 };
const update = { title: "Learn to make something nourishing", why: "That loaf made me curious", state: "active" as const, evidence: [10] };
describe("self-directed desires", () => {
  it("rejects invented, foreign and missing evidence; omission preserves existing wants", () => {
    expect(reviseDesires([], [{...update,evidence:[99]}], [event], 1440, "ag_1")).toEqual([]);
    expect(reviseDesires([], [update], [event], 1440, "ag_2")).toEqual([]);
    expect(reviseDesires([], [{...update,evidence:[]}], [event], 1440, "ag_1")).toEqual([]);
    const desires = reviseDesires([], [update], [event], 1440, "ag_1");
    expect(reviseDesires(desires, [], [], 2880, "ag_1")).toEqual(desires);
    expect(desires[0]!.history[0]!.evidence[0]!.text).toBe(event.text);
  });
  it("allows reconsideration, caps active wants and never overwrites another desire through an unknown id", () => {
    let ds = reviseDesires([], [update, {...update,title:"Know my neighbors"}], [event], 1440, "ag_1");
    ds = reviseDesires(ds, [{...update,title:"Find a quiet place"},{...update,title:"Explore the sea"}], [event], 2880, "ag_1");
    expect(ds).toHaveLength(3);
    expect(reviseDesires(ds,[{...update,id:"invented"}],[event],4320,"ag_1")).toEqual(ds);
    const next = reviseDesires(ds, [{...update,id:ds[0]!.id,state:"set_aside"}], [event],4320,"ag_1");
    expect(next[0]!.history).toHaveLength(2); expect(ds[0]!.state).toBe("active");
    expect(reviseDesires(next,[{...update,id:ds[0]!.id}],[event],4320,"ag_1")[0]!.state).toBe("set_aside");
    expect(reviseDesires(next,[{...update,id:ds[0]!.id}],[event],5760,"ag_1")[0]!.state).toBe("active");
  });
  it("keeps interpretations out of evidence and action acceptance separate from fulfilment", () => {
    expect(desireEvidence([event,{...event,id:11,kind:"agent.reflect"},{...event,id:12,kind:"agent.letter"},{...event,id:13,actors:["other"]}],"ag_1",0)).toEqual([event]);
    const ds = reviseDesires([], [update], [event],1440,"ag_1");
    for(let i=0;i<15;i++) recordDesireAttempt(ds,ds[0]!.id,1500+i,"trade",false,[]);
    expect(ds[0]!.attempts).toHaveLength(8); expect(ds[0]!.state).toBe("active");
  });
  it("forms desires in existing reflection, survives restart and reaches perception without changing persona or spending an extra call", async () => {
    let calls = 0, context: ReflectContext | undefined;
    const town = new Town({ seed: 7, brain: {...base, async reflect(ctx) { calls++; context=ctx; return {...await base.reflect(ctx),desires:[{...update,evidence:[ctx.desireEvidence!.find(e=>e.kind==="agent.trade")!.id]}]}; }} });
    const a=town.addAgent({persona:structuredClone(persona)});a.location="bakery";a.coins=50;town.places.get("bakery")!.stock.bread=10;
    town.apply(a,{kind:"trade",buy:"bread",with:"bakery"},"test");
    a.asleep=true;a.needs.rest=1;a.location="inn";town.t=1439;await town.tick();
    expect(calls).toBe(1);expect(context?.desireEvidence?.some(e=>e.kind==="agent.trade")).toBe(true);
    expect(a.desires).toHaveLength(1);expect(a.persona).toEqual(persona);
    const restored=new Town({seed:7,brain:base});restored.restore(structuredClone(town.snapshot()));
    const b=restored.agents.get(a.id)!;expect(b.desires).toEqual(a.desires);
    expect(Perception.parse(restored.perceive(b)).self.desires).toEqual(desiresForMind(a.desires));
    const old=town.snapshot(); delete old.agents[0]!.state.desires; restored.restore(old);
    expect(restored.agents.get(a.id)!.desires).toEqual([]);
  });
  it("links a rejected real action to its desire and keeps the desired outcome unrealized", async () => {
    const town=new Town({seed:7,brain:{...base,async decide(_p,a){return {action:{kind:"trade",buy:"bread",with:"mill"},remember:[],desire_id:a.desires![0]!.id};}}});
    const a=town.addAgent({persona});
    // Use a contemporaneous receipt for this fixture.
    a.desires=reviseDesires([],[update],[{...event,t:0,actors:[a.id]}],0,a.id);
    a.location="bakery";a.hint="Consider your own wants";a.plan={day:1,mood:"",goals:[],steps:[]};
    await town.tick();expect(a.desires[0]!.attempts.at(-1)?.accepted).toBe(false);
    expect(a.desires[0]!.attempts.at(-1)?.events[0]?.text).toBeTruthy();expect(a.desires[0]!.state).toBe("active");
  });
  it("keeps old brain responses compatible",()=>{
    expect(ActionProposal.parse({action:{kind:"wait"}}).desire_id).toBeUndefined();
    expect(Reflection.parse({summary:"quiet",insights:[],opinions:[],intentions:[],letter_to_owner:null}).desires).toBeUndefined();
  });
});

it('closes the outcome loop: obstacle, real help, repair, and memory survive reload', async () => {
  const town=new Town({seed:7,brain:{...base,async decide(_p,a){return {action:{kind:'repair'},remember:[],desire_id:a.desires![0]!.id};}}});
  const a=town.addAgent({persona});
  const neighbor=town.addAgent({persona:{...persona,name:'Nika'}});
  neighbor.asleep=true;neighbor.needs.rest=1;
  a.location=neighbor.location='boatshed';
  const place=town.places.get('boatshed')!;place.brokenUntil=town.day+1;
  a.desires=reviseDesires([],[{...update,title:'Restore the boatshed'}],[{...event,t:0,actors:[a.id]}],0,a.id);
  a.plan={day:1,mood:'determined',goals:[],steps:[]};a.hint='Consider your own wants';
  await town.tick();
  expect(a.desires[0]!.attempts.at(-1)?.accepted).toBe(false);
  neighbor.asleep=false;neighbor.location=a.location;neighbor.inventory=['planks','planks'];
  expect(town.apply(neighbor,{kind:'give',to:a.id,item:'planks'},'test')).toBe(true);
  expect(town.apply(neighbor,{kind:'give',to:a.id,item:'planks'},'test')).toBe(true);
  a.hint='New supplies arrived';a.lastThought=-100;
  await town.tick();
  expect(a.desires[0]!.attempts.at(-1)?.accepted).toBe(true);
  expect(place.brokenUntil).toBe(town.day);
  expect(a.inventory).not.toContain('planks');
  expect(a.desires[0]!.state).toBe('active'); // Engine does not decide personal fulfilment.
  const restored=new Town({seed:7,brain:base});restored.restore(structuredClone(town.snapshot()));
  const context=Perception.parse(restored.perceive(restored.agents.get(a.id)!)).self.desires![0]!;
  expect(context.recent_attempts?.map(x=>x.accepted)).toEqual([false,true]);
  expect(context.recent_attempts?.[0]?.outcomes[0]?.kind).toBe('action.rejected');
  expect(context.recent_attempts?.[1]?.outcomes[0]?.kind).toBe('building.repaired');
});

it('keeps recent concrete outcomes available even without a desire, bounded and private to the actor',()=>{
 const town=new Town({seed:7,brain:base});const a=town.addAgent({persona});town.t=100;
 for(let i=0;i<10;i++)town.events.push({id:100+i,t:90+i,day:1,kind:'agent.move',actors:[a.id],text:`Move ${i}`,importance:.02});
 town.events.push({id:200,t:100,day:1,kind:'agent.move',actors:['other'],text:'Private other movement',importance:.02});
 const context=Perception.parse(town.perceive(a)).self;
 expect(context.desires).toBeUndefined();
 expect(context.recent_outcomes?.map(e=>e.text)).toEqual(['Move 4','Move 5','Move 6','Move 7','Move 8','Move 9']);
});
