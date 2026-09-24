/** Actual minute-by-minute engine run, isolated fictional citizen. */
import {writeFileSync} from 'node:fs';
import {Town,Rng} from '@unwatched/engine';
import {OpenRouterBrain,seedPersonas} from '@unwatched/cognition';
let attempts=0,cost=0,unknown=false,error:string|null=null;
const usage:unknown[]=[];
const brain=new OpenRouterBrain({allowFallback:false,log:line=>console.log(line),routine:'anthropic/claude-haiku-4.5',stakes:'anthropic/claude-haiku-4.5',reflect:'anthropic/claude-haiku-4.5',transport:async(url,init)=>{
 if(error||attempts>=24||cost>=.1||unknown){error??='Observation spending guard reached';throw Error(error);}
 attempts++;return fetch(url,init);
}});
brain.onUsage=u=>{usage.push(u);if(u.costUsd===null)unknown=true;else cost+=u.costUsd;console.log(JSON.stringify({call:u.kind,cost:u.costUsd}));};
brain.onFallback=f=>{error=`${f.what}: ${f.reason}`;};
const town=new Town({seed:19,brain,minutesPerTick:1});town.t=300;
const p=seedPersonas(new Rng(19),1)[0]!;
const a=town.addAgent({persona:{...p,name:'Mara',want:'Find meaningful work making useful things',summary:'A patient, practical craftsperson who prefers fixing things to giving speeches.'},budget:{tier1Max:4,tier1Left:4,tier2Max:1,tier2Left:1,planningIncluded:true,reflectionIncluded:true}});
a.location='boatshed';a.inventory=['planks','planks'];town.places.get('boatshed')!.brokenUntil=town.day+2;
const frames:unknown[]=[];let previous=0;
function capture(){
 frames.push({label:`${town.clock()}`,desires:structuredClone(a.desires??[]),inventory:[...a.inventory],events:town.events.slice(previous).filter(e=>e.actors.includes(a.id)).map(e=>e.text),action:null,plan:structuredClone(a.plan),coins:a.coins,location:a.location});previous=town.events.length;
}
function save(completed=false){writeFileSync('../web/app/experiments/life-story/day.json',JSON.stringify({at:new Date().toISOString(),model:'anthropic/claude-haiku-4.5',attempts,cost:unknown||usage.length!==attempts?null:cost,error,completed,minute:town.t,frames,limitation:'Isolated minute-by-minute engine run from day 1 at 05:00 through two midnights. One citizen; experimental allowance of four routine and one higher-priority thought per day, plus planning and reflection. All model slots use Haiku for this test, not subscriber settings. No assigned goal or scripted action. No other citizens are present, so social outcomes cannot be evaluated.'},null,2)+'\n');}
capture();save();
try{
 while(town.t<2880&&!error){
  await town.tick();
  if(town.t%360===0||error){capture();save();console.log(JSON.stringify({minute:town.t,desires:a.desires?.length,cost,error}));}
  if(!town.agents.has(a.id)){error='Citizen left the simulation';break;}
 }
}catch(e){error=e instanceof Error?e.message:'Run failed';}
if(previous!==town.events.length)capture();save(town.t>=2880&&!error);
console.log(JSON.stringify({completed:town.t>=2880&&!error,minute:town.t,cost,error}));
