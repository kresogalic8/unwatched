/** Scripted demonstration of real engine rules. No model calls. */
import {writeFileSync} from 'node:fs';
import {Town,Rng} from '@unwatched/engine';
import {MockBrain,seedPersonas} from '@unwatched/cognition';
import {bagView} from '../../../packages/engine/src/items.ts';
import type {Action} from '@unwatched/protocol';
const town=new Town({seed:19,brain:new MockBrain(19)});
const [pa,pb]=seedPersonas(new Rng(19),2);
const a=town.addAgent({persona:{...pa!,name:'Mara'}}),b=town.addAgent({persona:{...pb!,name:'Nika'}});
a.location=b.location='boatshed';a.inventory=[];b.inventory=['timber','timber','rope','rope','stone','planks'];
town.places.get('boatshed')!.brokenUntil=town.day+1;
const frames:unknown[]=[];let last=town.events.length;
function capture(label:string){frames.push({label,bag:bagView(a,town.t),events:town.events.slice(last).map(e=>e.text),damage:Math.max(0,town.places.get('boatshed')!.brokenUntil!-town.day)});last=town.events.length;town.t++;}
function act(action:Action){if(!town.apply(a,action,'scripted blueprint preview'))throw Error(`Fixture failed: ${action.kind}`);}
act({kind:'design_item',spec:{name:'Harbor work kit',purpose:'Keep supplies close while repairing the boatshed',modules:['carry','repair']}});capture('A design, not an item');
const id=a.blueprints![0]!.id;
if(town.apply(a,{kind:'prototype_item',blueprint:id},'scripted blueprint preview'))throw Error('Materials were required');capture('An honest obstacle');
for(const item of [...b.inventory])if(!town.apply(b,{kind:'give',to:a.id,item},'scripted blueprint preview'))throw Error('Gift failed');capture('Materials received');
act({kind:'prototype_item',blueprint:id});capture('A real prototype');
act({kind:'equip',item:a.itemInstances!.find(i=>i.blueprint)!.id});capture('Equipped: 15 slots');
act({kind:'repair'});capture('Used: building repaired');
writeFileSync('../web/app/experiments/blueprints/frames.json',JSON.stringify(frames,null,2)+'\n');
console.log('Six engine-verified frames, no provider calls.');
