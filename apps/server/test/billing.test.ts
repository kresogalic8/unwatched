import { describe,it,expect,vi,afterEach } from 'vitest';
import { Billing } from '../src/billing.ts';
import { Town, type Brain } from '@unwatched/engine';
const nope=async():Promise<never>=>{throw Error('unused');};
const brain:Brain={name:'none',decide:nope,converse:nope,reflect:nope,plan:nope,digest:nope,child:nope,writePaper:nope,life:nope,judge:nope};
const persona={name:'Mira',age:30,origin:'mainland',summary:'worker',want:'work',fear:'hunger',secret:'none',strangers:'polite',advice:'listen',traits:{warmth:.5,pride:.5,caution:.5,honesty:.5,ambition:.5}};
afterEach(()=>vi.unstubAllEnvs());
describe('plan allowance changes',()=>{
 it('grants purchased quotas immediately without replenishing them on repeated application or restart',async()=>{
  vi.stubEnv('STRIPE_SECRET_KEY','');const billing=new Billing(null,()=>{});const town=new Town({seed:7,brain});const a=town.addAgent({persona,owner:'owner'});
  billing.applyPlan(a);expect(a.budget.tier1Left).toBe(0);
  await billing.setPlan('owner','resident');await billing.claim('owner',a.id);billing.applyPlan(a);expect(a.budget.tier1Left).toBe(50);expect(a.budget.tier2Left).toBe(6);expect(a.budget.reflectionIncluded).toBe(true);
  a.budget.tier1Left-=3;a.budget.tier1Used=3;billing.applyPlan(a);expect(a.budget.tier1Left).toBe(47);
  const restored=new Town({seed:7,brain});restored.restore(town.snapshot());const b=restored.agents.get(a.id)!;billing.applyPlan(b);expect(b.budget.tier1Left).toBe(47);
  await billing.setPlan('owner','patron');billing.applyPlan(a);expect(a.budget.tier1Left).toBe(117);expect(a.budget.tier2Left).toBe(15);
  a.budget.tier1Used=60;a.budget.tier1Left=60;
  await billing.setPlan("owner","visitor");billing.applyPlan(a);
  await billing.setPlan("owner","patron");billing.applyPlan(a);expect(a.budget.tier1Left).toBe(60);
 });
 it('visitor does not receive an included nightly reflection',async()=>{
  vi.stubEnv('STRIPE_SECRET_KEY','');const billing=new Billing(null,()=>{});const a=new Town({seed:7,brain}).addAgent({persona,owner:'owner'});
  await billing.setPlan('owner','visitor');await billing.claim('owner',a.id);billing.applyPlan(a);expect(a.budget.reflectionIncluded).toBe(false);expect(a.budget.planningIncluded).toBe(true);
 });
});
