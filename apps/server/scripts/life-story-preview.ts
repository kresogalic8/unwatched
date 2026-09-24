/** Scripted UI fixture with real engine outcomes. No model calls. */
import {writeFileSync} from 'node:fs';
import {Town,Rng} from '@unwatched/engine';
import {MockBrain,seedPersonas} from '@unwatched/cognition';
import {reviseDesires} from '../../../packages/engine/src/desires.ts';
const brain=new MockBrain(19);
brain.decide=async(_p,a)=>({action:{kind:'repair'},remember:[],desire_id:a.desires![0]!.id});
const t=new Town({seed:19,brain});t.t=600;
const [pa,pb]=seedPersonas(new Rng(19),2);
const a=t.addAgent({persona:{...pa!,name:'Mara'}}),b=t.addAgent({persona:{...pb!,name:'Nika'}});
a.location=b.location='boatshed';b.asleep=true;b.needs.rest=1;
const place=t.places.get('boatshed')!;place.brokenUntil=t.day+1;
a.desires=reviseDesires([],[{title:'Make the boatshed useful again',why:'I want somewhere to work with my hands.',state:'active',evidence:[1]}],[{id:1,t:599,day:1,kind:'action.rejected',actors:[a.id],text:'The boatshed is damaged.',importance:.5}],600,a.id);
a.plan={day:1,mood:'determined',goals:[],steps:[]};a.hint='Consider your own wants';
const frames:unknown[]=[];
function capture(label:string){frames.push({label,desires:structuredClone(a.desires),inventory:[...a.inventory],damage:Math.max(0,(place.brokenUntil??t.day)-t.day),events:t.events.slice(-4).map(e=>e.text)});}
capture('A desire');await t.tick();capture('An obstacle');
b.asleep=false;b.location=a.location;b.inventory=['planks','planks'];
for(let i=0;i<2;i++)if(!t.apply(b,{kind:'give',to:a.id,item:'planks'},'preview'))throw Error('Gift fixture failed');
capture('Help from Nika');b.asleep=true;b.needs.rest=1;a.hint='New supplies arrived';a.lastThought=-100;
await t.tick();if(place.brokenUntil!==t.day)throw Error('Repair fixture failed');capture('A visible result');
writeFileSync('../web/app/experiments/life-story/frames.json',JSON.stringify(frames,null,2)+'\n');
console.log('Wrote four verified engine frames; no AI calls.');
