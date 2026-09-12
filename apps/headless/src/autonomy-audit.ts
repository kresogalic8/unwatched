/** Unscripted, bounded observation. Never sends letters or seeds project decisions. */
import { existsSync, mkdirSync, readdirSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Town, Rng, type Brain, type AgentState } from "@unwatched/engine";
import { OpenRouterBrain, MockBrain, seedPersonas, isFromFallback } from "@unwatched/cognition";
const arg=(name:string,fallback:string)=>{const i=process.argv.indexOf(`--${name}`);return i<0?fallback:process.argv[i+1]??fallback;};
const days=Number(arg("days","3")), population=Number(arg("agents","6")), seed=Number(arg("seed","7")), cap=Number(arg("max-calls","400"));
const live=process.argv.includes("--live"), out=resolve(arg("out","out/autonomy-audit"));
if(!Number.isSafeInteger(seed))throw Error("Invalid seed");
for(const [name,value,max] of [["days",days,30],["agents",population,20],["max-calls",cap,2000]] as const)if(!Number.isInteger(value)||value<1||value>max)throw Error(`Invalid ${name}`);
const env=fileURLToPath(new URL("../../../.env",import.meta.url));if(existsSync(env))process.loadEnvFile(env);
if(existsSync(out)&&readdirSync(out).length)throw Error("Output directory must be empty; preserve previous audit evidence");
mkdirSync(out,{recursive:true});
for(const file of ["decisions.jsonl","events.jsonl"])writeFileSync(resolve(out,file),"");
const raw=live?new OpenRouterBrain({timeoutMs:20000,reflectTimeoutMs:30000}):new MockBrain(seed);
let stopped:string|null=null,calls=0;
const methods:Record<string,number>={}, actions:Record<string,number>={}, rejected:Record<string,number>={}, events:Record<string,number>={};
const failures:{what:string;model:string;reason:string}[]=[];
if(raw instanceof OpenRouterBrain)raw.onFallback=f=>{failures.push(f);stopped=`Model fallback: ${f.what}: ${f.reason}`;};
const opportunities={decisions:0,freePlot:0,teaching:0,sharedProjectVisible:0,atSharedProject:0};
const daily:unknown[]=[];
let town:Town;
const brain=new Proxy(raw,{get(target,key){
 const value=Reflect.get(target,key,target);
 if(typeof value!=="function"||!["decide","converse","reflect","plan","digest","child","writePaper","life","judge"].includes(String(key)))return typeof value==="function"?value.bind(target):value;
 return async(...args:unknown[])=>{
  if(stopped)throw Error(stopped);
  if(calls>=cap){stopped="Call cap reached; observation is incomplete";throw Error(stopped);}
  calls++;methods[String(key)]=(methods[String(key)]??0)+1;
  const result=await value.apply(target,args);
  if(isFromFallback(result)){stopped??=`Fallback answer for ${String(key)}`;throw Error(stopped);}
  if(key==="decide"){
   const p=args[0] as Parameters<Brain["decide"]>[0],a=args[1] as AgentState;
   opportunities.decisions++;if(p.options.includes("start_project"))opportunities.freePlot++;
   if(p.options.includes("teach"))opportunities.teaching++;
   if(p.town?.projects?.length)opportunities.sharedProjectVisible++;
   if(p.place.community)opportunities.atSharedProject++;
   appendFileSync(resolve(out,"decisions.jsonl"),JSON.stringify({t:town.t,agent:a.id,name:a.persona.name,place:a.location,options:p.options,projects:p.town?.projects?.length??0,action:result.action})+"\n");
  }
  return result;
 };
}}) as Brain;
town=new Town({seed,brain,onEvent:e=>{events[e.kind]=(events[e.kind]??0)+1;appendFileSync(resolve(out,"events.jsonl"),JSON.stringify(e)+"\n");}});
if(raw instanceof OpenRouterBrain){
 const places=[...town.places.values()].filter(p=>p.kind!=="plot").map(p=>`${p.id}: ${p.name}${p.sells.length?`, sells ${p.sells.map(s=>s.item).join(", ")}`:""}${p.beds?`, beds ${p.beds.price?`${p.beds.price} coins a night`:"free"}`:""}`);
 raw.primer=`The island of ${town.name}:\nPlaces: ${places.join("; ")}.\nWork: ${town.pack.jobs.map(j=>`${j.title} at ${j.place}, ${j.wage} coins a shift, ${j.hours[0]} to ${j.hours[1]}`).join("; ")}.\nThe boat comes each morning; the six o'clock cart moves grain to the mill, flour to the bakery, bread and fish and apples to the market. Sundays have no shifts, Saturday is market day, the first of the month is council day.\nFeasts: ${town.pack.feasts.map(f=>`${f.name} on the ${f.day}th of month ${f.month} at ${f.place}`).join("; ")}.\nPlots for sale are listed in the morning plan; the council sells them.`;
}
const personas=seedPersonas(new Rng(seed),population);
const initialPersonas=structuredClone(personas);
for(const persona of personas)town.addAgent({persona,budget:{tier1Max:8,tier2Max:2,tier1Left:8,tier2Left:2}});
const originalApply=town.apply.bind(town);
town.apply=(a,action,source)=>{const ok=originalApply(a,action,source);if(source!=="habit"){const bucket=ok?actions:rejected;bucket[action.kind]=(bucket[action.kind]??0)+1;}return ok;};
const started=Date.now(), startT=town.t, end=startT+days*1440;
function report(){
 const citizens=[...town.agents.values()];const projects=[...town.places.values()].filter(p=>p.community);
 return {opportunityDefinition:"Action listed in perception; not proof every possible target would validate",source:live?"live unscripted model observation":"mock instrumentation check — not evidence of autonomy",completed:town.t>=end&&!stopped,stopped,seed,requestedDays:days,startT,simulatedMinutes:town.t-startT,simDay:town.day,population,elapsedSeconds:Math.round((Date.now()-started)/1000),calls,cap,methods,models:live?{routine:process.env.UW_OR_MODEL_ROUTINE??"anthropic/claude-haiku-4.5",stakes:process.env.UW_OR_MODEL_STAKES??"anthropic/claude-sonnet-5",reflect:process.env.UW_OR_MODEL_REFLECT??"anthropic/claude-opus-5"}:null,conditions:{tickMinutes:1,initialSeason:"winter",dailyBudget:{routine:8,stakes:2},ownerLetters:0,seededProjects:0,assignedActions:0,personas:initialPersonas.map(p=>({name:p.name,want:p.want,traits:p.traits}))},opportunities,acceptedModelActions:actions,rejectedModelActions:rejected,eventCounts:events,projects:projects.map(p=>({place:p.id,...p.community})),learning:{retainedReceipts:citizens.reduce((n,a)=>n+(a.foodLessons??[]).reduce((s,l)=>s+l.evidence.filter(e=>e.success).length,0),0),receivedAdvice:citizens.reduce((n,a)=>n+(a.foodAdvice?.length??0),0),testedAdvice:citizens.reduce((n,a)=>n+(a.foodAdvice??[]).filter(x=>x.tested).length,0),changedRoutineSteps:citizens.reduce((n,a)=>n+(a.foodRoutineDecisions?.length??0),0)},citizens:citizens.map(a=>({id:a.id,name:a.persona.name,location:a.location,coins:a.coins,job:a.job,starving:a.starving,projects:a.projects})),daily,failures,usage:raw instanceof OpenRouterBrain?raw.usage():null};
}
function save(){writeFileSync(resolve(out,"report.json"),JSON.stringify(report(),null,2)+"\n");}
let lastDay=town.day,lastProgress=Date.now();
try{
 while(town.t<end&&!stopped){
  await town.tick();
  if(town.day!==lastDay){daily.push({day:lastDay,calls,events:{...events},alive:town.agents.size});lastDay=town.day;save();}
  if(Date.now()-lastProgress>15000){console.log(JSON.stringify({day:town.day,time:town.clock(),calls,projects:events["project.proposed"]??0,teaching:events["knowledge.shared"]??0}));save();lastProgress=Date.now();}
 }
}catch(e){stopped??=(e as Error).message;}
save();writeFileSync(resolve(out,"snapshot.json"),JSON.stringify(town.snapshot()));
console.log(JSON.stringify({completed:report().completed,stopped,day:town.day,calls,report:resolve(out,"report.json")}));
if(stopped)process.exitCode=2;
