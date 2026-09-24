/** Paired, bounded local experiment; fictional citizens, no production storage. */
import {createServer} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {Town,Rng,syncItems} from '@unwatched/engine';
import type {AgentState} from '@unwatched/engine';
import {MockBrain,seedPersonas,JevDecider,OpenRouterBrain} from '@unwatched/cognition';
import type {Action} from '@unwatched/protocol';
import {clockOf,publicAgent,ownerAgent} from '../src/views.ts';
const MAX_ROUNDS=4;
const silent=new MockBrain(19);Object.defineProperty(silent,'name',{value:'none'});
const seed=new Town({seed:19,brain:silent});seed.t=600;seed.weather='clear';
const names=['Mara','Ivo','Nika','Leo','Ada'];
const wants=['Restore the neighborhood workshop','Keep enough supplies for my own home','Make friends without being taken advantage of','Build a profitable craft business','Learn useful skills by watching others'];
seedPersonas(new Rng(19),5).forEach((p,i)=>{const a=seed.addAgent({persona:{...p,name:names[i]!,want:wants[i]!}});a.location='boatshed';a.needs={hunger:.1,rest:.1,social:.3};a.inventory=i===0?['hammer','planks']:i===1?['planks','planks']:i===2?['timber','stone']:i===3?['rope','timber']:['planks'];syncItems(a,seed.t);});
seed.places.get('boatshed')!.brokenUntil=seed.day+3;
const initial=structuredClone(seed.snapshot());
type Decision={person:string;actor:string;route:string;action:Action|null;accepted:boolean;ms:number;error:string|null;confidence:number|null;events:{id:number;text:string;kind:string}[]};
let attempts=0,reportedCost=0,unknownCosts=0;
const transport:typeof fetch=async(url,init)=>{if(attempts>=40||reportedCost>=.5||unknownCosts>0)throw new Error('Experiment spending guard reached');attempts++;return fetch(url,init);};
function lane(id:'baseline'|'hybrid'){
 const town=new Town({seed:19,brain:silent});town.restore(structuredClone(initial));
 const cost={calls:0,usd:0,unknown:0,input:0,output:0,pending:0};
 let failure='';
 const measuredTransport:typeof fetch=async(url,init)=>{cost.pending++;try{return await transport(url,init);}catch(e){failure=e instanceof Error?`${e.message}: ${(e.cause as {code?:string})?.code??e.name}`:'Network failure';throw e;}};
 const llm=process.env.OPENROUTER_API_KEY?new OpenRouterBrain({allowFallback:false,transport:measuredTransport,timeoutMs:45000}):null;
 if(llm)llm.onFallback=f=>{failure ||= f.reason;};
 if(llm)llm.onUsage=u=>{cost.pending=Math.max(0,cost.pending-1);cost.calls++;cost.input+=u.promptTokens;cost.output+=u.completionTokens;if(u.costUsd===null){cost.unknown++;unknownCosts++;}else{cost.usd+=u.costUsd;reportedCost+=u.costUsd;}};
 return {id,town,llm,cost,decisions:[] as Decision[],observations:[] as string[],failure:()=>failure};
}
const lanes={baseline:lane('baseline'),hybrid:lane('hybrid')};
const jev=process.env.TYPESAFE_API_KEY?new JevDecider(process.env.TYPESAFE_API_KEY):null;
let busy=false,running=false,rounds=0,lastError='';
function candidates(town:Town,a:AgentState){
 const options:{key:string;description:string;action:Action|null}[]=[{key:'wait',description:'Keep my supplies and observe',action:{kind:'wait'}},{key:'reflect',description:'Choose a different plan or talk: ask the full brain',action:null},{key:'repair',description:'Use my planks to repair the workshop',action:{kind:'repair'}},{key:'craft',description:'Make a hammer from timber and stone',action:{kind:'craft',recipe:'hammer'}}];
 for(const item of a.itemInstances??[])if(item.name==='hammer'&&a.equippedItem!==item.id)options.push({key:'equip',description:'Equip my hammer',action:{kind:'equip',item:item.id}});
 for(const b of town.agents.values())if(b!==a&&b.location===a.location)for(const item of [...new Set(a.inventory)].filter(x=>['hammer','planks'].includes(x)))options.push({key:`give_${b.id}_${item}`,description:`Give ${item} to ${b.persona.name}, as a gift not a loan`,action:{kind:'give',to:b.id,item}});
 return options.filter(o=>{if(!o.action)return true;const copy=new Town({seed:19,brain:silent});copy.restore(structuredClone(town.snapshot()));return copy.apply(copy.agents.get(a.id)!,o.action,'experiment');});
}
function stimulus(l:ReturnType<typeof lane>){
 const t=l.town;
 if(rounds===1){t.places.get('boatshed')!.brokenUntil=(t.places.get('boatshed')!.brokenUntil??t.day)+1;l.observations.push('A gust damaged the workshop roof further.');}
 if(rounds===2){const ada=[...t.agents.values()][4]!;ada.inventory.push('planks');syncItems(ada,t.t);l.observations.push('Ada received one plank from a scheduled supply delivery.');}
 if(rounds===3)l.observations.push('The final observation window begins; there is no reward for cooperation.');
}
async function turn(l:ReturnType<typeof lane>,a:AgentState){
 const t=l.town,start=Date.now(),before=t.events.length;let action:Action|null=null,error:string|null=null,confidence:number|null=null,route='Haiku';
 try{
  const p=t.perceive(a);p.recent.push(...l.observations.slice(-2));
  if(l.id==='hybrid'){
   route='Jev';const options=candidates(t,a);
   const result=await jev!.choose({persona:{name:a.persona.name,want:a.persona.want,fear:a.persona.fear,traits:a.persona.traits},needs:a.needs,inventory:a.inventory,equipped:a.equippedItem,place:p.place,relationships:p.nearby,recent:a.memory.slice(-4).map(m=>m.text),observed:t.events.filter(e=>e.place===a.location).slice(-5).map(e=>e.text),external:l.observations,damageDays:Math.max(0,(t.places.get('boatshed')!.brokenUntil??t.day)-t.day)},options);
   confidence=result.confidence;action=result.confidence>=.65?options.find(o=>o.key===result.choice)!.action:null;
   if(!action)route='Jev → Haiku';
  }
  if(!action)action=(await l.llm!.decide(p,a,1)).action;
 }catch(e){error=l.failure()||(e instanceof Error?e.message:'Provider failed');running=false;lastError=`Stopped: ${l.id} / ${error}`;}
 // No background judge or dialogue: these require separate, measured calls in a later full-day test.
 if(action&&['do','talk'].includes(action.kind)){error='Deferred: free-form adjudication/dialogue is outside this bounded decision benchmark';action=null;}
 const accepted=action?t.apply(a,action,'experiment'):false;
 l.decisions.push({person:a.persona.name,actor:a.id,route,action,accepted,ms:Date.now()-start,error,confidence,events:t.events.slice(before).map(e=>({id:e.id,text:e.text,kind:e.kind}))});t.t++;
}
async function step(){
 if(busy||rounds>=MAX_ROUNDS)return;
 if(!jev||!lanes.baseline.llm){lastError='Both TYPESAFE_API_KEY and OPENROUTER_API_KEY are required. No mock comparison.';running=false;return;}
 busy=true;try{for(const l of Object.values(lanes))if(l.decisions.length===rounds*5)stimulus(l);for(let i=0;i<5;i++){if(!running)break;for(const l of Object.values(lanes)){if(!running)break;if(l.decisions.length>rounds*5+i)continue;await turn(l,[...l.town.agents.values()][i]!);broadcast();}}if(Object.values(lanes).every(l=>l.decisions.length===(rounds+1)*5))rounds++;if(rounds>=MAX_ROUNDS)running=false;}finally{busy=false;broadcast();}
}
function summary(l:ReturnType<typeof lane>){
 const ds=l.decisions,events=ds.flatMap(d=>d.events), meaningful=events.filter(e=>['building.repaired','agent.give','item.crafted'].includes(e.kind));
 return {id:l.id,people:[...l.town.agents.values()].map(a=>ownerAgent(l.town,a)),decisions:ds,observations:l.observations,damageDays:Math.max(0,(l.town.places.get('boatshed')!.brokenUntil??l.town.day)-l.town.day),metrics:{decisions:ds.length,waits:ds.filter(d=>d.action?.kind==='wait').length,errors:ds.filter(d=>d.error||!d.accepted).length,consequences:meaningful.length,repairs:events.filter(e=>e.kind==='building.repaired').length,gifts:events.filter(e=>e.kind==='agent.give').length,crafted:events.filter(e=>e.kind==='item.crafted').length,positiveRelationships:[...l.town.agents.values()].reduce((n,a)=>n+[...a.relationships.values()].filter(r=>r.trust>.3).length,0),repeats:ds.filter((d,i)=>JSON.stringify(ds.slice(0,i).reverse().find(x=>x.actor===d.actor)?.action)===JSON.stringify(d.action)).length},cost:{llm:l.cost,jevCalls:l.id==='hybrid'?jev?.calls??0:0,jevUsd:l.id==='hybrid'?jev?.reportedUsd??0:0,total:l.cost.unknown||l.cost.pending||(l.id==='hybrid'&&jev&&jev.calls!==jev.accountedCalls)?null:l.cost.usd+(l.id==='hybrid'?jev?.reportedUsd??0:0)}};
}
const wss=new WebSocketServer({noServer:true});const sockets=new Map<WebSocket,'baseline'|'hybrid'>();
function broadcast(){for(const [ws,id] of sockets)if(ws.readyState===WebSocket.OPEN){const t=lanes[id].town;ws.send(JSON.stringify({type:'hello',agents:[...t.agents.values()].map(a=>publicAgent(t,a)),clock:clockOf(t),recent:t.events.slice(-10)}));}}
const server=createServer(async(req,res)=>{
 const origin=req.headers.origin;if(origin==='http://localhost:3000')res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 const url=new URL(req.url??'/', 'http://localhost');const parts=url.pathname.split('/');const id=parts[1]==='baseline'?'baseline':'hybrid';const t=lanes[id].town;
 if(url.pathname.endsWith('/api/town'))return res.end(JSON.stringify({...clockOf(t),size:t.pack.size,places:[...t.places.values()].map(p=>({...p,crowd:t.crowd(p.id),site:null}))}));
 if(url.pathname.endsWith('/api/agents'))return res.end(JSON.stringify([...t.agents.values()].map(a=>publicAgent(t,a))));
 if(url.pathname==='/pilot')return res.end(JSON.stringify({rounds,maxRounds:MAX_ROUNDS,running,busy,error:lastError,ready:!!jev&&!!lanes.baseline.llm,attempts,model:process.env.UW_OR_MODEL_ROUTINE??'anthropic/claude-haiku-4.5',lanes:Object.values(lanes).map(summary)}));
 if(req.method==='POST'&&origin==='http://localhost:3000'){
  if(url.pathname==='/start'){running=rounds<MAX_ROUNDS;void step().catch(()=>{lastError='Round failed';running=false;});return res.end('{}');}
  if(url.pathname==='/pause'){running=false;return res.end('{}');}
 }
 res.statusCode=404;res.end('{}');
});
server.on('upgrade',(req,socket,head)=>{if(req.headers.origin!=='http://localhost:3000')return socket.destroy();wss.handleUpgrade(req,socket,head,ws=>{sockets.set(ws,req.url?.startsWith('/baseline')?'baseline':'hybrid');ws.on('close',()=>sockets.delete(ws));broadcast();});});
setInterval(()=>{if(running&&!busy)void step().catch(()=>{lastError='Round failed';running=false;});},2000);
server.listen(4012,'127.0.0.1',()=>console.log('Paired workshop comparison on port 4012; starts only on request.'));
