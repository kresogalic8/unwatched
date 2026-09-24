import {describe,it,expect} from 'vitest';
import {Town,type Brain} from '../src/index.ts';
import {bagView,capacity} from '../src/items.ts';
import {Action,Perception} from '@unwatched/protocol';
const persona={name:'Mara',age:30,origin:'mainland',summary:'Practical',want:'Find my way',fear:'Waste',secret:'None',strangers:'Polite',advice:'Considers',traits:{warmth:.5,pride:.5,caution:.5,honesty:.5,ambition:.5}};
const spec={name:'Harbor work kit',purpose:'Carry supplies and repair things',modules:['carry','repair'] as ('carry'|'repair')[]};
function setup(){const town=new Town({seed:19,brain:{name:'none'} as Brain});const a=town.addAgent({persona});a.location='boatshed';return {town,a};}
function design(){const x=setup();expect(x.town.apply(x.a,{kind:'design_item',spec},'test')).toBe(true);return {...x,id:x.a.blueprints![0]!.id};}
describe('citizen blueprints',()=>{
 it('validates module vocabulary and keeps proposals separate from real inventory',()=>{
  expect(Action.safeParse({kind:'design_item',spec:{...spec,modules:['carry','carry']}}).success).toBe(false);
  expect(Action.safeParse({kind:'design_item',spec:{...spec,modules:['unlimited_money']}}).success).toBe(false);
  const {town,a,id}=design();expect(a.inventory).toEqual(['suitcase']);expect(a.blueprints![0]!.prototyped).toBe(false);
  expect(town.apply(a,{kind:'craft_design',blueprint:id},'test')).toBe(false);
  expect(town.apply(a,{kind:'prototype_item',blueprint:id},'test')).toBe(false);
  expect(a.inventory).toEqual(['suitcase']);
 });
 it('consumes materials, creates a useful composite, wears it, and never fulfils a desire automatically',()=>{
  const {town,a,id}=design();a.inventory=['timber','timber','rope','rope','stone','planks'];
  expect(town.apply(a,{kind:'prototype_item',blueprint:id},'test')).toBe(true);
  const item=a.itemInstances!.find(i=>i.blueprint)!;
  expect(a.inventory).toEqual(['planks','Harbor work kit [crafted]']);
  expect(capacity(a)).toBe(12);expect(town.apply(a,{kind:'equip',item:item.id},'test')).toBe(true);expect(capacity(a)).toBe(15);
  town.places.get('boatshed')!.brokenUntil=town.day+1;
  expect(town.apply(a,{kind:'repair'},'test')).toBe(true);expect(item.condition).toBe(90);
  expect(town.places.get('boatshed')!.brokenUntil).toBe(town.day);
  expect(a.inventory).toEqual(['Harbor work kit [crafted]']);
  expect(town.apply(a,{kind:'prototype_item',blueprint:id},'test')).toBe(false);
  expect(town.apply(a,{kind:'craft_design',blueprint:id},'test')).toBe(false);
  expect(a.blueprints![0]!.made).toBe(1);
 });
 it('preserves artifact capabilities and immutable version through gifting and reload',()=>{
  const {town,a,id}=design();a.inventory=['timber','timber','rope','rope','stone'];town.apply(a,{kind:'prototype_item',blueprint:id},'test');
  const b=town.addAgent({persona:{...persona,name:'Nika'}});b.location=a.location;
  const before=structuredClone(a.itemInstances![0]!);
  expect(town.apply(a,{kind:'give',to:b.id,item:before.name},'test')).toBe(true);
  expect(b.itemInstances![0]?.blueprint??b.itemInstances!.find(i=>i.blueprint)?.blueprint).toEqual(before.blueprint);
  expect(town.apply(a,{kind:'design_item',parent:id,spec:{...spec,name:'Small carrier',modules:['carry']}},'test')).toBe(true);
  expect(a.blueprints![1]!.prototyped).toBe(false);expect(before.blueprint!.spec.modules).toEqual(['carry','repair']);
  const restored=new Town({seed:19,brain:{name:'none'} as Brain});restored.restore(structuredClone(town.snapshot()));
  expect(restored.agents.get(a.id)!.blueprints).toEqual(a.blueprints);
  const receiver=restored.agents.get(b.id)!;const item=receiver.itemInstances!.find(i=>i.blueprint)!;
  expect(restored.apply(receiver,{kind:'equip',item:item.id},'test')).toBe(true);expect(capacity(receiver)).toBe(15);
  expect(Perception.parse(restored.perceive(restored.agents.get(a.id)!)).self.belongings?.blueprints).toHaveLength(2);
 });
 it('rejects duplicate designs, foreign revisions and fabricated intention IDs',()=>{
  const {town,a,id}=design();expect(town.apply(a,{kind:'design_item',spec},'test')).toBe(false);
  expect(town.apply(a,{kind:'design_item',spec,parent:'foreign'},'test')).toBe(false);
  expect(town.apply(a,{kind:'design_item',spec,parent:id,desire_id:'invented'},'test')).toBe(false);
  expect(a.blueprints).toHaveLength(1);
 });
 it('keeps legacy snapshots compatible',()=>{
  const {town,a}=setup();const snap=town.snapshot();delete snap.agents[0]!.state.blueprints;town.restore(snap);
  expect(bagView(town.agents.get(a.id)!,town.t).blueprints).toEqual([]);
 });
});

it('links design and subsequent assembly to the original intention through normal thinking',async()=>{
 let next:import('@unwatched/protocol').Action={kind:'design_item',spec,desire_id:'goal'};
 const brain={name:'test',decide:async()=>({action:next,remember:[]})} as unknown as Brain;
 const town=new Town({seed:19,brain});const a=town.addAgent({persona});a.location='boatshed';
 a.desires=[{id:'goal',title:'Keep my tools together',why:'I keep losing them',state:'active',since:0,updated:0,history:[],attempts:[]}];
 a.inventory=['timber','timber','rope','rope','stone'];a.plan={day:1,mood:'quiet',goals:[],steps:[]};a.hint='Consider the day';
 await town.tick();expect(a.blueprints).toHaveLength(1);
 next={kind:'prototype_item',blueprint:a.blueprints![0]!.id};a.hint='Consider next step';a.lastThought=-100;
 await town.tick();expect(a.desires[0]!.attempts.map(x=>x.action)).toEqual(['design_item','prototype_item']);
 expect(a.desires[0]!.attempts[1]!.events.some(e=>e.kind==='item.crafted')).toBe(true);
 expect(a.desires[0]!.state).toBe('active');
});
