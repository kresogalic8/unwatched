import { describe, it, expect } from "vitest";
import { Town } from "@unwatched/engine";
import { MockBrain } from "@unwatched/cognition";
import { constructionRoutes } from "../src/construction.ts";
import type { BuildingReplay } from "@unwatched/protocol";

const persona = (name:string) => ({name,age:30,origin:"mainland",summary:"A patient builder",want:"a home",fear:"rain",secret:"PRIVATE_SENTINEL",strangers:"polite",advice:"listens",traits:{warmth:.7,pride:.5,caution:.5,honesty:.8,ambition:.7}});
function world() {
  const town = new Town({seed:7,brain:new MockBrain(7)});town.t=540;
  const a=town.addAgent({persona:persona("Mira")});const b=town.addAgent({persona:persona("Luka")});
  a.location=b.location="shore-1";
  town.apply(a,{kind:"build",what:"house",at:"shore-1",name:"Mira's house",project:"A roof"},"test");
  return {town,a,b};
}
describe("public construction record",()=>{
  it("keeps the last morning and off-site payment, with frozen names after departures and restarts",async()=>{
    const {town,a,b}=world();
    town.apply(b,{kind:"offer",to:a.id,what:"help",coins:3,construction:{site:"shore-1",mornings:3}},"test");
    town.apply(a,{kind:"accept"},"test");
    for(let day=1;day<=3;day++){town.t=(day-1)*1440+540;town.day=day;town.apply(a,{kind:"work"},"test");town.apply(b,{kind:"work"},"test");}
    a.location=b.location="market";town.apply(b,{kind:"settle"},"test");
    town.emit("agent.letter",[a.id],"shore-1","PRIVATE_SENTINEL",1,{text:"PRIVATE_SENTINEL"});
    town.agents.delete(b.id);
    const restored=new Town({seed:7,brain:new MockBrain(7)});restored.restore(JSON.parse(JSON.stringify(town.snapshot())));
    const app=constructionRoutes(restored,"Test island");
    const response=await app.request("/shore-1");expect(response.status).toBe(200);
    const body=await response.json() as BuildingReplay;const h=body.buildings[0]!.history;
    expect(h.moments.find(m=>m.kind==="finished")).toMatchObject({labor:6,people:expect.arrayContaining([{id:b.id,name:"Luka"}])});
    expect(h.moments.at(-1)).toMatchObject({kind:"paid",coins:3,people:expect.arrayContaining([{id:b.id,name:"Luka"}])});
    expect(JSON.stringify(body)).not.toContain("PRIVATE_SENTINEL");
    expect(h.moments.map(m=>m.sequence)).toEqual(h.moments.map((_,i)=>i+1));
  });
  it("pins a shared chapter, excludes future labor and rejects invalid or unavailable chapters",async()=>{
    const {town,a}=world();const app=constructionRoutes(town,"Test");
    const first=await (await app.request("/shore-1?through=1")).json();
    town.apply(a,{kind:"work"},"test");
    expect(await(await app.request("/shore-1?through=1")).json()).toEqual(first);
    expect((await app.request("/shore-1?through=0")).status).toBe(400);
    expect((await app.request("/shore-1?through=1.5")).status).toBe(400);
    expect((await app.request("/shore-1?through=99")).status).toBe(404);
    expect((await app.request("/inn")).status).toBe(404);
    expect((await app.request("/")).status).toBe(200);
  });
  it("records no extra morning after restart, and does not invent history for older snapshots",async()=>{
    const {town,a}=world();town.apply(a,{kind:"work"},"test");
    const snap=JSON.parse(JSON.stringify(town.snapshot()));const restored=new Town({seed:7,brain:new MockBrain(7)});restored.restore(snap);
    restored.apply(restored.agents.get(a.id)!,{kind:"work"},"test");
    expect(restored.places.get("shore-1")!.history!.moments).toHaveLength(2);
    for(const p of snap.places) delete p.history;
    restored.restore(snap);expect(restored.places.get("shore-1")!.history).toBeUndefined();
  });
});
