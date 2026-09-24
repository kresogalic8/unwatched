/** Bounded real-provider observation, fictional persona, no production writes. */
import {writeFileSync} from 'node:fs';
import {Town,Rng} from '@unwatched/engine';
import {MockBrain,OpenRouterBrain,seedPersonas} from '@unwatched/cognition';
import {reviseDesires,desireEvidence,recordDesireAttempt} from '../../../packages/engine/src/desires.ts';
const town=new Town({seed:19,brain:new MockBrain(19)});town.t=600;
const p=seedPersonas(new Rng(19),1)[0]!;
const a=town.addAgent({persona:{...p,name:'Mara',want:'Find meaningful work making useful things',summary:'A patient, practical craftsperson who prefers fixing things to giving speeches.'}});
a.location='boatshed';a.inventory=['planks','planks'];town.places.get('boatshed')!.brokenUntil=town.day+1;
let attempts=0,cost=0,unknown=false;const usage:unknown[]=[];
const brain=new OpenRouterBrain({allowFallback:false,routine:'anthropic/claude-haiku-4.5',reflect:'anthropic/claude-haiku-4.5',stakes:'anthropic/claude-haiku-4.5',transport:async(url,init)=>{if(attempts>=12||cost>=.1||unknown)throw Error('Observation budget reached');attempts++;return fetch(url,init);}});
brain.onUsage=u=>{console.log(JSON.stringify({call:u.kind,cost:u.costUsd}));usage.push(u);if(u.costUsd===null)unknown=true;else cost+=u.costUsd;};
const frames:unknown[]=[];let error:string|null=null;
try{
 const evidence=desireEvidence(town.events,a.id,0);
 const r=await brain.reflect({agent:a,day:town.day,desireEvidence:evidence,dayMemories:evidence.map(e=>e.text),keyMemories:[],relationships:[],unreadLetters:[],plan:null,projects:[],beliefs:[],watch:[],quiet:false});
 a.desires=reviseDesires([],r.desires??[],evidence,town.t,a.id);
 frames.push({label:'What Mara chose to want',desires:structuredClone(a.desires),inventory:[...a.inventory],events:[],action:null});
 for(let i=0;i<6;i++){
  const proposal=await brain.decide(town.perceive(a),a,1);const start=town.events.length;
  const deferred=['do','talk'].includes(proposal.action.kind);
  const accepted=!deferred&&town.apply(a,proposal.action,'autonomous observation');
  const events=town.events.slice(start).filter(e=>e.actors.includes(a.id));
  if(!deferred)recordDesireAttempt(a.desires??[],proposal.desire_id,town.t,proposal.action.kind,accepted,events);
  frames.push({label:`Decision ${i+1}`,action:proposal.action,intent:proposal.intent,accepted,deferred,desires:structuredClone(a.desires),inventory:[...a.inventory],events:events.map(e=>e.text)});
  town.t++;
 }
}catch(e){error=e instanceof Error?e.message:'Provider failed';}
const report={at:new Date().toISOString(),model:'anthropic/claude-haiku-4.5',attempts,cost:unknown||usage.length!==attempts?null:cost,usage,error,frames,limitation:'Six decision opportunities in a controlled starting scene. No full-day simulation. Dialogue and free-form adjudication are deferred; no synthetic fallback.'};
writeFileSync('../web/app/experiments/life-story/autonomous.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({attempts,cost:report.cost,error,frames:frames.length}));
