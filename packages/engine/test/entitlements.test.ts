import { describe, it, expect } from 'vitest';
import { Town, type Brain } from '../src/index.ts';
const persona = { name:'Mira', age:30, origin:'mainland', summary:'worker', want:'work', fear:'hunger', secret:'none', strangers:'polite', advice:'listen', traits:{warmth:.5,pride:.5,caution:.5,honesty:.5,ambition:.5} };
const failure = async (): Promise<never> => { throw Error('provider unavailable'); };
const brain: Brain = { name:'test', decide:failure, converse:failure, reflect:failure, plan:failure, digest:failure, child:failure, writePaper:failure, life:failure, judge:failure };
function setup(extra = {}) { const t = new Town({seed:7,brain,...extra}); const a=t.addAgent({persona,owner:'owner',budget:{tier1Max:10,tier1Left:10,tier2Max:1,tier2Left:1,reflectionIncluded:false}}); a.plan={day:1,mood:'',goals:[],steps:[]};return {t,a}; }
describe('subscription entitlements',()=>{
 it('refunds failed decisions and preserves unread input; backs off retries',async()=>{
  const {t,a}=setup();t.sendLetter(a.id,'Please find work');const before={...a.budget};await t.tick();
  expect(a.budget).toMatchObject(before);expect(a.letters[0]?.read).toBe(false);expect(t.events.some(e=>e.kind==='agent.say')).toBe(false);
  await t.tick();expect(a.budget).toMatchObject(before);
 });
 it('returns credits when exhausted daily allowance was used for a failed call',async()=>{
  let credits=20;const {t,a}=setup({creditBank:()=>{credits-=4;return true;},creditRefund:()=>{credits+=4;}});
  a.budget.tier1Left=0;a.budget.tier2Left=0;t.sendLetter(a.id,'Please answer');await t.tick();expect(credits).toBe(20);
 });
 it('renews daily allowance even when reflection is unavailable or not included',async()=>{
  for(const included of [true,false]){
   const {t,a}=setup();a.budget.reflectionIncluded=included;a.budget.tier1Left=0;a.budget.tier2Left=0;a.asleep=true;a.needs.rest=1;t.t=1439;
   await t.tick();expect(a.budget.tier1Left).toBe(10);expect(a.budget.tier2Left).toBe(1);
  }
 });
 it('included planning does not use up promised decision quotas',async()=>{
  const {t,a}=setup();a.plan=null;a.budget.planningIncluded=true;await t.tick();expect(a.budget.tier1Left).toBe(10);expect(a.budget.tier2Left).toBe(1);expect(a.plan).toBeNull();
 });
});
