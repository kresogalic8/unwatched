import {expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
import {telegramRoutes,pairingHash,webhookAuthorized} from '../src/telegram-routes.ts';
const config={username:'test_bot',secret:'webhook-secret',enabled:true};
it('requires a signed-in owner for every settings operation',async()=>{
 const db={from:vi.fn(),rpc:vi.fn()};const app=telegramRoutes(db as unknown as SupabaseClient,async()=>null,()=>[],config);
 for(const [method,path] of [['GET',''],['POST','/link'],['POST','/confirm'],['PUT','/agents'],['DELETE','']]){
 const r=await app.request('/me/telegram'+path,{method});expect(r.status).toBe(401);
 }expect(db.from).not.toHaveBeenCalled();
});
it('rejects selecting another owners agent before writing settings',async()=>{
 const db={from:vi.fn()};const app=telegramRoutes(db as unknown as SupabaseClient,async()=> 'owner',()=>[{id:'mine',name:'Mine'}],config);
 const r=await app.request('/me/telegram/agents',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentIds:['theirs']})});expect(r.status).toBe(403);expect(db.from).not.toHaveBeenCalled();
});
it('accepts only authenticated private-chat start updates and passes only a hash to the database',async()=>{
 const rpc=vi.fn(async()=>({error:null}));const app=telegramRoutes({rpc} as unknown as SupabaseClient,async()=>null,()=>[],config);
 const token='a'.repeat(32);const message={chat:{id:123,type:'private',first_name:'User'},text:'/start '+token};
 expect((await app.request('/telegram/webhook',{method:'POST',body:JSON.stringify({message})})).status).toBe(401);
 const headers={'x-telegram-bot-api-secret-token':config.secret};
 await app.request('/telegram/webhook',{method:'POST',headers,body:JSON.stringify({message:{...message,chat:{...message.chat,type:'group'}}})});expect(rpc).not.toHaveBeenCalled();
 expect((await app.request('/telegram/webhook',{method:'POST',headers,body:JSON.stringify({message})})).status).toBe(200);
 expect(rpc).toHaveBeenCalledWith('claim_telegram_pair',{p_hash:pairingHash(token),p_chat:'123',p_name:'User'});
 expect(JSON.stringify(rpc.mock.calls)).not.toContain(token);
});
it('never accepts an unset or wrong webhook secret',()=>{expect(webhookAuthorized('','')).toBe(false);expect(webhookAuthorized('wrong','secret')).toBe(false);expect(webhookAuthorized('secret','secret')).toBe(true);});
