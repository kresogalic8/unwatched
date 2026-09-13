import {expect,it} from 'vitest';
import {Town,type Brain} from '../src/index.ts';
import {Action,Passenger,Perception} from '@unwatched/protocol';
const no=async():Promise<never>=>{throw Error('No model call permitted');};
const brain:Brain={name:'none',decide:no,converse:no,reflect:no,plan:no,digest:no,child:no,writePaper:no,life:no,judge:no};
const persona={name:'Learner',age:30,origin:'mainland',summary:'curious',want:'help',fear:'harm',secret:'none',strangers:'polite',advice:'listens',traits:{warmth:.5,pride:.5,caution:.5,honesty:.5,ambition:.5}};
function setup(){const t=new Town({seed:7,brain});const a=t.addAgent({persona});t.t=600;a.location='mill';a.inventory=['planks','planks','planks','planks'];t.places.get('mill')!.brokenUntil=t.day+3;return{t,a};}
const recipe={name:'Patch the damaged mill',goal:'repair' as const,steps:[{kind:'repair' as const}]};
it('isolates the trial from real inventory and damage; a trial cannot license teaching',()=>{
 const {t,a}=setup();expect(t.apply(a,{kind:'propose_skill',recipe},'test')).toBe(true);const skill=a.skills![0]!;
 const before=JSON.stringify({inventory:a.inventory,damage:t.places.get('mill')!.brokenUntil,coins:a.coins});
 expect(t.apply(a,{kind:'test_skill',id:skill.id},'test')).toBe(true);expect(skill.trial?.success).toBe(true);expect(skill.successes).toBe(0);
 expect(JSON.stringify({inventory:a.inventory,damage:t.places.get('mill')!.brokenUntil,coins:a.coins})).toBe(before);
 const b=t.addAgent({persona:{...persona,name:'Neighbor'}});b.location=a.location;
 expect(t.apply(a,{kind:'share_skill',id:skill.id,to:b.id},'test')).toBe(false);
 expect(t.apply(a,{kind:'test_skill',id:skill.id},'test')).toBe(false);
});
it('executes a real repair, teaches without inheriting success, and survives restart and travel',async()=>{
 const {t,a}=setup();t.apply(a,{kind:'propose_skill',recipe},'test');const skill=a.skills![0]!;
 t.apply(a,{kind:'practice_skill',id:skill.id},'test');await t.tick();expect(skill.successes).toBe(1);expect(a.inventory).toHaveLength(2);expect(t.places.get('mill')!.brokenUntil).toBe(t.day+2);
 const b=t.addAgent({persona:{...persona,name:'Neighbor'}});b.location=a.location;b.inventory=['planks','planks'];
 expect(t.apply(a,{kind:'share_skill',id:skill.id,to:b.id},'test')).toBe(true);expect(b.skills![0]!.successes).toBe(0);
 const restored=new Town({seed:7,brain});restored.restore(structuredClone(t.snapshot()));const b2=restored.agents.get(b.id)!;
 expect(restored.apply(b2,{kind:'practice_skill',id:skill.id},'test')).toBe(true);await restored.tick();expect(b2.skills![0]!.successes).toBe(1);
 const passenger=Passenger.parse(restored.passengerOf(b2,null));const island=new Town({seed:9,brain,name:'Other island'});const visitor=island.arrive(passenger);
 expect(visitor.skills![0]!.id).toBe(skill.id);expect(visitor.skills![0]!.successes).toBe(0);expect(visitor.skills![0]!.origin.name).toBe('Learner');expect(Perception.safeParse(island.perceive(visitor)).success).toBe(true);
 expect(restored.evolution.some(s=>s.moments.some(m=>m.kind==='skill.shared'))).toBe(true);
});
it('rejects recursive or executable steps and insufficient materials',async()=>{
 expect(Action.safeParse({kind:'propose_skill',recipe:{...recipe,steps:[{kind:'practice_skill',id:'recursive'}]}}).success).toBe(false);
 const {t,a}=setup();a.inventory=[];t.apply(a,{kind:'propose_skill',recipe},'test');t.apply(a,{kind:'practice_skill',id:a.skills![0]!.id},'test');await t.tick();expect(a.skills![0]!.successes).toBe(0);expect(a.skills![0]!.attempts).toBe(1);expect(t.places.get('mill')!.brokenUntil).toBe(t.day+3);
});
it('does not credit an unrelated change while walking to a different place',async()=>{
 const {t,a}=setup();const to=t.places.get('mill')!.exits[0]!;
 t.apply(a,{kind:'propose_skill',recipe:{name:'Walk past damage',goal:'repair',steps:[{kind:'move',to}]}},'test');t.apply(a,{kind:'practice_skill',id:a.skills![0]!.id},'test');await t.tick();expect(a.skills![0]!.successes).toBe(0);
});
it('institutions require a place owner and voluntary membership; records survive restart',()=>{
 const {t,a}=setup();const b=t.addAgent({persona:{...persona,name:'Neighbor'}});b.location=a.location;
 expect(t.apply(a,{kind:'found_institution',name:'Repair school',charter:'Share repair experience freely.'},'test')).toBe(false);
 t.places.get('mill')!.owner=a.id;expect(t.apply(a,{kind:'found_institution',name:'Repair school',charter:'Share repair experience freely.'},'test')).toBe(true);
 expect(t.places.get('mill')!.institution!.members).toEqual([a.id]);t.apply(b,{kind:'join_institution'},'test');t.apply(b,{kind:'leave_institution'},'test');
 const restored=new Town({seed:7,brain});restored.restore(structuredClone(t.snapshot()));expect(restored.places.get('mill')!.institution!.members).toEqual([a.id]);expect(restored.evolution).toEqual(t.evolution);
});
