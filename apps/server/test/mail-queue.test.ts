import {afterEach,describe,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {configureDeliveryLog} from '../src/delivery-log.ts';
import {sendMail} from '../src/mail.ts';
function queue(){
 const jobs=new Map<string,Record<string,any>>();const attempts:unknown[]=[];
 const db={from(table:string){let operation='read';let value:any;const filters:Record<string,unknown>={};let single=false;
 const q:any={select(){return q;},eq(k:string,v:unknown){filters[k]=v;return q;},maybeSingle(){single=true;return q;},insert(v:unknown){operation='insert';value=v;return q;},update(v:unknown){operation='update';value=v;return q;},then(resolve:(v:unknown)=>void){
 if(table==='delivery_attempts'){attempts.push(value);return resolve({data:[],error:null});}
 if(operation==='insert'){if(jobs.has(value.id))return resolve({data:null,error:{message:'duplicate'}});jobs.set(value.id,{...value,created_at:new Date().toISOString()});return resolve({data:null,error:null});}
 const matches=[...jobs.values()].filter(j=>Object.entries(filters).every(([k,v])=>j[k]===v));if(operation==='update')matches.forEach(j=>Object.assign(j,value));return resolve({data:single?matches[0]??null:matches,error:null});}};return q;}};
 configureDeliveryLog(db as unknown as SupabaseClient);return {jobs,attempts};
}
afterEach(()=>{configureDeliveryLog(null);vi.unstubAllEnvs();});
const mail={to:'test@example.com',subject:'Preview',html:'<p>Preview</p>',text:'Preview',ownerId:'owner',agentId:'agent',kind:'digest',deliveryKey:'digest:owner:agent:1'};
describe('durable email queue',()=>{
 it('does not resend an accepted daily notification',async()=>{const q=queue();vi.stubEnv('RESEND_API_KEY','test-only');const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'provider-id'})});expect(await sendMail(mail,()=>{},fetcher)).toBe(true);expect(await sendMail(mail,()=>{},fetcher)).toBe(true);expect(fetcher).toHaveBeenCalledOnce();expect([...q.jobs.values()][0]!.payload).toEqual({});});
 it('retries failures with identical payload and idempotency key',async()=>{queue();vi.stubEnv('RESEND_API_KEY','test-only');const fetcher=vi.fn().mockResolvedValueOnce({ok:false,status:429,text:async()=>''}).mockResolvedValueOnce({ok:true,json:async()=>({id:'provider-id'})});expect(await sendMail(mail,()=>{},fetcher)).toBe(false);expect(await sendMail({...mail,text:'Changed body'},()=>{},fetcher)).toBe(true);const first=fetcher.mock.calls[0]![1],second=fetcher.mock.calls[1]![1];expect(first.headers['Idempotency-Key']).toBe(second.headers['Idempotency-Key']);expect(first.body).toBe(second.body);});
 it('will not retry stale jobs or send to a changed recipient',async()=>{const q=queue();vi.stubEnv('RESEND_API_KEY','test-only');const fetcher=vi.fn().mockResolvedValue({ok:false,status:500,text:async()=>''});await sendMail(mail,()=>{},fetcher);expect(await sendMail({...mail,to:'other@example.com'},()=>{},fetcher)).toBe(false);[...q.jobs.values()][0]!.created_at=new Date(Date.now()-24*3600000).toISOString();expect(await sendMail(mail,()=>{},fetcher)).toBe(false);expect(fetcher).toHaveBeenCalledOnce();});
});
