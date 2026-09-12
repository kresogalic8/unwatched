/** Reproducible engine scenario, never loaded into the live island. No model calls. */
import { writeFileSync } from "node:fs";
import { Town } from "../packages/engine/src/index.ts";
import { MockBrain } from "../packages/cognition/src/index.ts";
import { publicProject } from "../apps/server/src/views.ts";
import type { Action } from "../packages/protocol/src/index.ts";
const town=new Town({seed:7,brain:new MockBrain(7)});town.seasonOverride="spring";
const person=(name:string,want:string)=>town.addAgent({persona:{name,age:32,origin:"the coast",summary:"A neighbor making a life here.",want,fear:"an empty table",secret:"not part of this public demo",strangers:"welcoming",advice:"test it first",traits:{warmth:.7,pride:.4,caution:.6,honesty:.8,ambition:.5}}});
const mira=person("Mira","grow food for the neighborhood"),ivo=person("Ivo","help build something useful"),ana=person("Ana","find dependable food");
const act=(a:typeof mira,action:Action)=>{if(!town.apply(a,action,"scripted-demo"))throw Error(`Rejected ${action.kind}`);town.t++;};
const at=(day:number)=>{town.day=day;town.t=(day-1)*1440+600;};
at(1);for(const a of [mira,ivo,ana])a.location="bakery";
act(mira,{kind:"trade",buy:"bread"});act(mira,{kind:"teach",to:ivo.id,place:"bakery",item:"bread"});act(ivo,{kind:"trade",buy:"bread"});act(ivo,{kind:"teach",to:ana.id,place:"bakery",item:"bread"});
for(const a of [mira,ivo,ana])a.location="shore-1";
act(mira,{kind:"start_project",at:"shore-1",name:"The neighbors' table",why:"When the bakery runs out, we should have another place to find a meal."});
for(const a of [mira,ivo,ana])act(a,{kind:"contribute_project",at:"shore-1",coins:6,help:true});
for(const day of [1,2]){at(day);for(const a of [mira,ivo,ana])act(a,{kind:"work"});}
at(4);for(const a of [mira,ivo,ana])act(a,{kind:"work"});act(ana,{kind:"trade",with:"shore-1",buy:"vegetables"});
ana.location="lane-1";act(ana,{kind:"start_project",at:"lane-1",name:"A garden up the lane",why:"The first garden feeds the shore. Our neighbors up here could use one too."});act(ana,{kind:"contribute_project",at:"lane-1",coins:5,help:true});
const places=[...town.places.values()].filter(p=>p.community).map(p=>({id:p.id,community:publicProject(town,p),site:p.site?{done:p.site.labor,of:p.site.laborNeeded}:null,stock:p.stock}));
const events=town.events.filter(e=>["knowledge.shared","project.proposed","project.contributed","agent.build","town.built","garden.harvest"].includes(e.kind));
writeFileSync(new URL("../apps/web/public/demo/community.json",import.meta.url),JSON.stringify({source:"Scripted engine scenario — no live model; not the production island",places,events},null,2)+"\n");
console.log(`Recorded ${events.length} real engine events, ${places.length} project stages; ${town.places.get("shore-1")!.community!.foodProduced} vegetables grown.`);
