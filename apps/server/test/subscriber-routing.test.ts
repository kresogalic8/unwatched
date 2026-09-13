import {describe,it,expect,vi} from 'vitest';
import {BrainRouter} from '../src/brains.ts';
import {Town,type Brain} from '@unwatched/engine';
const failure=async():Promise<never>=>{throw Error('public budget exhausted');};
const world:Brain={name:'test',decide:failure,converse:failure,reflect:failure,plan:failure,digest:failure,child:failure,writePaper:failure,life:failure,judge:failure};
const persona={name:'Mira',age:30,origin:'mainland',summary:'worker',want:'work',fear:'hunger',secret:'none',strangers:'polite',advice:'listen',traits:{warmth:.5,pride:.5,caution:.5,honesty:.5,ambition:.5}};
describe('separate subscriber compute',()=>{
 it('delivers a paid decision even when the public brain cannot serve requests',async()=>{
  const decide=vi.fn(async()=>({action:{kind:'wait' as const},remember:[]}));const paid:Brain={...world,decide};
  const town=new Town({seed:7,brain:world}),a=town.addAgent({persona,owner:'subscriber'}),b=town.addAgent({persona});
  const router=new BrainRouter(world,()=>{},agent=>agent.owner?paid:undefined);
  await router.decide(town.perceive(a),a,1);expect(decide).toHaveBeenCalledTimes(1);
  await expect(router.decide(town.perceive(b),b,1)).rejects.toThrow('public budget exhausted');
 });
});
