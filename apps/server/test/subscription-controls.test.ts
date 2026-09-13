import {afterEach,describe,it,expect,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {FileStore} from '@unwatched/store';
import {Billing} from '../src/billing.ts';
import type {AgentState} from '@unwatched/engine';
const dirs:string[]=[];
afterEach(()=>{vi.unstubAllEnvs();for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});
async function setup(){vi.stubEnv('STRIPE_SECRET_KEY','');const dir=mkdtempSync(join(tmpdir(),'uw-billing-'));dirs.push(dir);const store=new FileStore(dir,"island");const b=new Billing(store,()=>{});await b.load();await b.grant('owner',100,'grant');return {b,store,dir};}
const citizen=(id='a')=>({id,owner:'owner',brainKind:'hosted'} as AgentState);
describe('persistent subscription controls',()=>{
 it('does not spend extra credits without opt-in',async()=>{const {b}=await setup();expect(await b.bank(citizen(),1)).toBe(false);expect(b.wallet('owner').credits).toBe(100);});
 it('shares a daily cap across citizens, keeps it on restart, and refunds exactly once',async()=>{
  const {b,store,dir}=await setup();await b.setSpending('owner',true,5);
  const results=await Promise.all([b.bank(citizen('a'),2),b.bank(citizen('b'),2)]);
  expect(results.filter(Boolean)).toHaveLength(1);expect((await b.spending('owner')).spentToday).toBe(4);
  const restarted=new Billing(new FileStore(dir,"island"),()=>{});await restarted.load();expect(await restarted.bank(citizen(),2)).toBe(false);
  const refund=results.find(x=>typeof x==='function')!;if(typeof refund==='function'){await refund();await refund();}
  expect((await store.wallet('owner')).credits).toBe(100);expect((await b.spending('owner')).spentToday).toBe(0);
 });
 it('makes duplicate checkout delivery idempotent across process restarts',async()=>{
  const {b,dir}=await setup();await b.grant('owner',100,'purchase','cs_test');
  const restarted=new Billing(new FileStore(dir,"island"),()=>{});await restarted.load();await restarted.grant('owner',100,'purchase','cs_test');expect(restarted.wallet('owner').credits).toBe(200);
 });
 it('binds a paid plan to one citizen and persists that assignment',async()=>{
  const {b,dir}=await setup();await b.setPlan('owner','patron');await b.claim('owner','a');await b.claim('owner','a');
  await expect(b.claim('owner','b')).rejects.toThrow(/assigned/);
  const restarted=new Billing(new FileStore(dir,"island"),()=>{});await restarted.load();expect(restarted.planFor(citizen('a'))).toBe('patron');expect(restarted.planFor(citizen('b'))).toBe('none');
 });
});
