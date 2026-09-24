import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
export const pairingHash = (s: string) => createHash('sha256').update(s).digest('hex');
export function webhookAuthorized(actual: string, expected: string) {
  return !!expected && timingSafeEqual(createHash('sha256').update(actual).digest(), createHash('sha256').update(expected).digest());
}
export function telegramRoutes(db: SupabaseClient, ownerOf: (req: Request) => Promise<string | null>, agents: (owner: string) => { id: string; name: string }[], config: { username: string; secret: string; enabled: boolean }) {
  const app = new Hono();
  app.use('/me/*', async (c,next) => { if(!config.enabled) return c.json({error:'Telegram is not available yet.'},503); await next(); });
  app.get('/me/telegram', async c => {
    const owner=await ownerOf(c.req.raw);if(!owner)return c.json({error:'Sign in first.'},401);
    const {data,error}=await db.from('owner_telegram').select('chat_id,chat_name,agent_ids,pending_chat,pending_name,pair_expires').eq('owner_id',owner).maybeSingle();
    if(error)return c.json({error:'Could not load Telegram settings.'},503);
    return c.json({connected:!!data?.chat_id,chatName:data?.chat_name??null,agentIds:data?.agent_ids??[],agents:agents(owner),pendingId:data?.pending_chat && data.pair_expires ? pairingHash(data.pending_chat+data.pair_expires) : null,pendingName:data?.pending_chat && Date.parse(data.pair_expires)>Date.now()?data.pending_name:null});
  });
  app.post('/me/telegram/link',async c=>{
    const owner=await ownerOf(c.req.raw);if(!owner)return c.json({error:'Sign in first.'},401);
    const token=randomBytes(24).toString('base64url');const expires=new Date(Date.now()+10*60*1000).toISOString();
    const {error}=await db.from('owner_telegram').upsert({owner_id:owner,pair_hash:pairingHash(token),pair_expires:expires,pending_chat:null,pending_name:null},{onConflict:'owner_id'});
    if(error)return c.json({error:'Could not create a connection link.'},503);
    return c.json({url:`https://t.me/${config.username}?start=${token}`,expires});
  });
  app.post('/me/telegram/confirm',async c=>{
    const owner=await ownerOf(c.req.raw);if(!owner)return c.json({error:'Sign in first.'},401);
    const body=z.object({pendingId:z.string().length(64)}).safeParse(await c.req.json().catch(()=>null));if(!body.success)return c.json({error:'Refresh the connection and confirm your chat.'},409);
    const {data,error}=await db.from('owner_telegram').select('pending_chat,pending_name,pair_expires').eq('owner_id',owner).maybeSingle();
    if(error||!data?.pending_chat||Date.parse(data.pair_expires)<=Date.now()||body.data.pendingId!==pairingHash(data.pending_chat+data.pair_expires))return c.json({error:'Open a new connection link and press Start first.'},409);
    const result=await db.from('owner_telegram').update({chat_id:data.pending_chat,chat_name:data.pending_name,pending_chat:null,pending_name:null,pair_hash:null,pair_expires:null}).eq('owner_id',owner).eq('pending_chat',data.pending_chat).eq('pair_expires',data.pair_expires).gt('pair_expires',new Date().toISOString()).select('owner_id');
    if(result.error||!result.data?.length)return c.json({error:'This chat could not be connected. It may already belong to another account.'},409);
    return c.json({ok:true});
  });
  app.put('/me/telegram/agents',async c=>{
    const owner=await ownerOf(c.req.raw);if(!owner)return c.json({error:'Sign in first.'},401);
    const body=z.object({agentIds:z.array(z.string()).max(100)}).safeParse(await c.req.json().catch(()=>null));
    if(!body.success)return c.json({error:'Choose your agents.'},400);
    const mine=new Set(agents(owner).map(a=>a.id));if(body.data.agentIds.some(id=>!mine.has(id)))return c.json({error:'Choose only your own agents.'},403);
    const {data,error}=await db.from('owner_telegram').update({agent_ids:[...new Set(body.data.agentIds)]}).eq('owner_id',owner).not('chat_id','is',null).select('owner_id');
    if(error||!data?.length)return c.json({error:'Connect Telegram first.'},409);return c.json({ok:true});
  });
  app.delete('/me/telegram',async c=>{
    const owner=await ownerOf(c.req.raw);if(!owner)return c.json({error:'Sign in first.'},401);
    const {error}=await db.from('owner_telegram').delete().eq('owner_id',owner);if(error)return c.json({error:'Could not disconnect Telegram.'},503);return c.json({ok:true});
  });
  app.post('/telegram/webhook',async c=>{
    if(!webhookAuthorized(c.req.header('x-telegram-bot-api-secret-token')??'',config.secret))return c.json({error:'Unauthorized'},401);
    if(Number(c.req.header('content-length')??0)>16384)return c.json({error:'Too large'},413);
    const raw=await c.req.text();if(raw.length>16384)return c.json({error:'Too large'},413);
    let update:any;try{update=JSON.parse(raw);}catch{return c.json({error:'Invalid JSON'},400);}
    const m=update?.message;
    if(m?.chat?.type!=='private'||!Number.isSafeInteger(m.chat.id)||typeof m.text!=='string')return c.json({ok:true});
    const match=/^\/start ([A-Za-z0-9_-]{32})$/.exec(m.text);if(!match)return c.json({ok:true});
    const {error}=await db.rpc('claim_telegram_pair',{p_hash:pairingHash(match[1]!),p_chat:String(m.chat.id),p_name:String(m.chat.first_name??m.chat.username??'Private chat').slice(0,120)});
    if(error)return c.json({error:'Try again later.'},503);return c.json({ok:true});
  });
  return app;
}
