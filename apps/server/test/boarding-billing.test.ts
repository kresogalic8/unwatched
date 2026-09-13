import {afterEach,describe,it,expect,vi} from 'vitest';
import {Billing} from '../src/billing.ts';
afterEach(()=>vi.unstubAllEnvs());
describe('hosted boarding entitlement',()=>{
 it('does not admit a free account or a manual wallet assignment in live mode',async()=>{
  vi.stubEnv('STRIPE_SECRET_KEY','sk_test_placeholder');const b=new Billing(null,()=>{});
  expect(await b.boardingReady('owner')).toBe(false);
  b.wallet('owner').plan='resident';expect(await b.boardingReady('owner')).toBe(false);
 });
 it('requires the Stripe subscription status and wallet plan to match',async()=>{
  vi.stubEnv('STRIPE_SECRET_KEY','sk_test_placeholder');const b=new Billing(null,()=>{});
  const w=b.wallet('owner');w.plan='resident';w.stripeCustomer='cus_test';
  const list=vi.spyOn(b.stripe!.subscriptions,'list');
  for(const [status,plan,expected] of [['active','resident',true],['past_due','resident',false],['canceled','resident',false],['active','visitor',false]] as const){
   list.mockResolvedValue({data:[{status,metadata:{plan},items:{data:[]}}]} as never);
   expect(await b.boardingReady('owner')).toBe(expected);
  }
 });
});
