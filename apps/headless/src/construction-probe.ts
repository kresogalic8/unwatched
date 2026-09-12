/** Bounded opportunity probe; not a claim of spontaneous society. */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Town } from "@unwatched/engine";
import { MockBrain, OpenRouterBrain, isFromFallback } from "@unwatched/cognition";
const env=fileURLToPath(new URL("../../../.env",import.meta.url));if(existsSync(env))process.loadEnvFile(env);
const live=process.argv.includes("--live");const oi=process.argv.indexOf("--out");const out=oi>=0?process.argv[oi+1]!:"out/construction-probe";
const brain=live?new OpenRouterBrain({timeoutMs:20000}):new MockBrain(7);
const failures:string[]=[]; if(brain instanceof OpenRouterBrain) brain.onFallback=f=>{failures.push(f.reason);};
const town=new Town({seed:7,brain});town.t=540;
const persona=(name:string,summary:string,want:string)=>({name,age:32,origin:"mainland",summary,want,fear:"being dependent on others",secret:"misses home",strangers:"friendly but practical",advice:"makes up their own mind",traits:{warmth:.8,pride:.3,caution:.4,honesty:.8,ambition:.7}});
const builder=town.addAgent({persona:persona("Mira","Patient and sociable. Enjoys making things with other people.","a home of my own")});
const helper=town.addAgent({persona:persona("Luka","Practical, generous with effort, and looking for a way to support himself.","earn an honest living and belong somewhere")});
builder.location=helper.location="shore-1";
town.apply(builder,{kind:"build",what:"house",at:"shore-1",name:"Mira's house"},"probe-setup");
helper.coins=3;for(const a of [builder,helper])a.needs={hunger:0,rest:0,social:.3};
const decisions:{agent:string;action:unknown;applied:boolean;fallback:boolean}[]=[];
for(let i=0;i<8;i++){
 const a=i%2===0?helper:builder;const result=await brain.decide(town.perceive(a),a,1);const fallback=isFromFallback(result);
 const applied=!fallback && town.apply(a,result.action,"probe-model");decisions.push({agent:a.persona.name,action:result.action,applied,fallback});
 console.log(JSON.stringify({decision:i+1,agent:a.persona.name,kind:result.action.kind,applied,fallback}));town.t+=20;if(fallback)break;
}
const site=town.places.get("shore-1")!;const history=site.history!;
const report={setup:"Prestarted house, two rested citizens at its site. No assigned collaboration goal. Eight decisions, no scripted responses after setup.",source:live?"Live model opportunity probe":"Mock opportunity probe",failures,brain:brain.name,model:live?process.env.UW_OR_MODEL_ROUTINE??"anthropic/claude-haiku-4.5":null,decisions,constructionOffers:history.moments.filter(m=>m.kind==="offered").length,accepted:history.moments.filter(m=>m.kind==="accepted").length,usage:brain instanceof OpenRouterBrain?brain.usage():null};
mkdirSync(out,{recursive:true});writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));writeFileSync(`${out}/replay.json`,JSON.stringify({town:"Construction opportunity probe",source:report.source,size:town.pack.size,buildings:[{x:site.x,y:site.y,district:site.district,history}]},null,2));
console.log(JSON.stringify({offers:report.constructionOffers,accepted:report.accepted,usage:report.usage}));
