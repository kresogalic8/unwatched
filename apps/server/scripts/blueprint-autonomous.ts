/** One fictional citizen, normal engine ticks, no assigned invention. Explicit --live required. */
import {writeFileSync,mkdirSync} from 'node:fs';
import {Town,Rng,type AgentState} from '@unwatched/engine';
import {OpenRouterBrain,seedPersonas} from '@unwatched/cognition';
import type {Action,ActionProposal} from '@unwatched/protocol';
import {bagView} from '../../../packages/engine/src/items.ts';
import {ObservationBudget} from './observation-budget.ts';

if(!process.argv.includes('--live')) {
  console.log('No requests sent. Use --live for one isolated observation: at most 12 HTTP attempts, estimated $0.10 budget.');
  process.exit(0);
}
if(!process.env.OPENROUTER_API_KEY)throw Error('OPENROUTER_API_KEY is required');
const model='anthropic/claude-haiku-4.5';
const metadata=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(15000)});
if(!metadata.ok)throw Error('Could not verify model pricing');
const catalog=await metadata.json() as {data:{id:string;pricing:Record<string,string>}[]};
const price=catalog.data.find(m=>m.id===model)?.pricing;
if(!price)throw Error('Model pricing unavailable');
const budget=new ObservationBudget(Math.max(Number(price.prompt)*2,Number(price.input_cache_write??price.prompt)),Number(price.completion),Number(price.request??'0'));
let error:string|null=null;
const usage:unknown[]=[];
const brain=new OpenRouterBrain({apiKey:process.env.OPENROUTER_API_KEY,allowFallback:false,routine:model,stakes:model,reflect:model,transport:async(url,init)=>{
  const body=String(init?.body??'');const request=JSON.parse(body) as {max_tokens:number};
  budget.reserve(body,request.max_tokens);
  try { const response=await fetch(url,init);if(!response.ok)budget.fail();return response; }
  catch(e){budget.fail();throw e;}
}});
brain.onUsage=u=>{budget.settle(u.costUsd);usage.push(u);console.log(JSON.stringify({kind:u.kind,cost:u.costUsd}));};
brain.onFallback=()=>{error=budget.stopped??'Provider returned no usable response; no synthetic fallback';};
const proposals:{minute:number;proposal:ActionProposal}[]=[];
const originalDecide=brain.decide.bind(brain);
brain.decide=async(...args)=>{const proposal=await originalDecide(...args);proposals.push({minute:town.t,proposal:structuredClone(proposal)});return proposal;};
const decisions:{minute:number;action:Action;accepted:boolean;events:string[]}[]=[];
class ObservedTown extends Town {
  override apply(a:AgentState,action:Action,source='agent') {
    const from=this.events.length;const accepted=super.apply(a,action,source);
    if(source.startsWith('tier '))decisions.push({minute:this.t,action:structuredClone(action),accepted,events:this.events.slice(from).filter(e=>e.actors.includes(a.id)).map(e=>e.text)});
    return accepted;
  }
}
const town=new ObservedTown({seed:19,brain,minutesPerTick:1});town.t=360;
const p=seedPersonas(new Rng(19),1)[0]!;
const a=town.addAgent({persona:{...p,name:'Mara',want:'Find a place where I belong',summary:'A patient, curious newcomer. Enjoys practical work, values independence, and sometimes avoids asking for help.'},budget:{tier1Max:6,tier1Left:6,tier2Max:2,tier2Left:2,planningIncluded:true,reflectionIncluded:true}});
a.location='boatshed';a.inventory=['timber','timber','rope','rope','stone','planks'];
town.places.get('boatshed')!.brokenUntil=town.day+1;
const frames:{label:string;minute:number;bag:ReturnType<typeof bagView>;desires:unknown[];plan:unknown;location:string;damage:number;events:string[]}[]=[];
let previous=0;
function capture(label:string){frames.push({label,minute:town.t,bag:bagView(a,town.t),desires:structuredClone(a.desires??[]),plan:structuredClone(a.plan),location:a.location,damage:Math.max(0,(town.places.get('boatshed')!.brokenUntil??town.day)-town.day),events:town.events.slice(previous).filter(e=>e.actors.includes(a.id)).map(e=>e.text)});previous=town.events.length;}
const at=new Date().toISOString();
const destination=new URL('../../web/app/experiments/blueprints/observation.json',import.meta.url);
const archive=new URL('../../../docs/experiments/blueprints/',import.meta.url);mkdirSync(archive,{recursive:true});
function save(completed=false){
 const report={at,model,completed,error:error??budget.stopped,attempts:budget.attempts,cost:budget.reserved?null:budget.cost,knownCost:budget.cost,usage,proposals,decisions,frames,summary:{designs:a.blueprints?.length??0,prototypes:a.blueprints?.reduce((n,d)=>n+Number(d.prototyped),0)??0},limitation:'One fictional citizen in a supplied starting scene: a damaged boatshed and raw materials. Ordinary planning, habits and engine decisions; no assigned design or desired action. All model slots use Haiku. No other citizens, no proof of long-term learning. Budget uses conservative request estimates, not a provider-enforced cap. A stopped run is incomplete.'};
 const json=JSON.stringify(report,null,2)+'\n';writeFileSync(destination,json);writeFileSync(new URL(`${at.replaceAll(':','-')}.json`,archive),json);
}
capture('Starting conditions');save();
try{
 while(town.t<1320&&!error&&!budget.stopped){
  const count=decisions.length;await town.tick();
  if(decisions.length!==count||town.t%120===0){capture(town.clock());save();}
  if(!town.agents.has(a.id)){error='Citizen left the simulation';break;}
 }
}catch(e){error=e instanceof Error?e.message:'Observation failed';}
capture(`Stopped at ${town.clock()}`);save(town.t>=1320&&!error&&!budget.stopped);
console.log(JSON.stringify({attempts:budget.attempts,cost:budget.cost,stop:error??budget.stopped,decisions:decisions.length,designs:a.blueprints?.length??0}));
