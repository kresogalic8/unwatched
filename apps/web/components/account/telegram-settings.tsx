"use client";
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
type Settings={connected:boolean;chatName:string|null;pendingName:string|null;pendingId:string|null;agentIds:string[];agents:{id:string;name:string}[]};
export function TelegramSettings(){
 const [state,setState]=useState<Settings|null>(null),[link,setLink]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{setState(await api<Settings>('/api/me/telegram'));},[]);
 useEffect(()=>{void load().catch(()=>setError('Telegram settings are unavailable.'));},[load]);
 useEffect(()=>{if(!link)return;const id=setInterval(()=>{void load().catch(()=>{});},3000);return()=>clearInterval(id);},[link,load]);
 async function act(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="border-t border-drift/20 pt-5 mt-4 flex flex-col gap-3" aria-labelledby="telegram-heading">
 <h2 id="telegram-heading" className="text-lg font-semibold">Letters on Telegram</h2>
 <p className="text-sm text-ink2">Get a private message when your agent writes to you. No bot setup or token needed. Replies on Telegram do not reach your agent yet.</p>
 {state?.connected&&<p className="text-sm">Connected to <strong>{state.chatName??'your private chat'}</strong>.</p>}
 {state&&!state.connected&&<Button size={36} disabled={busy} onClick={()=>void act(async()=>{const r=await api<{url:string}>('/api/me/telegram/link',{method:'POST'});setLink(r.url);})}>Connect Telegram</Button>}
 {link&&<div className="rounded-2xl bg-glass p-4 text-sm flex flex-col gap-2"><a href={link} target="_blank" rel="noreferrer" className="font-bold text-teal underline">Open Telegram and press Start</a><p>Return here to confirm your chat. This link expires in ten minutes.</p><Button kind="secondary" size={36} disabled={busy} onClick={()=>void act(load)}>Check connection</Button></div>}
 {state?.pendingName&&<div className="rounded-2xl bg-sand p-4 flex flex-col gap-2"><p className="text-sm">Connect the Telegram chat named <strong>{state.pendingName}</strong>? Confirm only if this is your chat.</p><Button size={36} disabled={busy} onClick={()=>void act(async()=>{await api('/api/me/telegram/confirm',{method:'POST',body:JSON.stringify({pendingId:state.pendingId})});setLink(null);})}>Confirm my chat</Button></div>}
 {state?.connected&&<fieldset disabled={busy} className="flex flex-col gap-2"><legend className="text-sm font-semibold mb-2">Which agents can write to you?</legend>{state.agents.length===0&&<p className="text-sm text-ink2">Create an agent first, then choose it here.</p>}{state.agents.map(a=><label key={a.id} className="flex gap-3 items-center text-sm py-2"><input type="checkbox" className="accent-teal w-4 h-4" checked={state.agentIds.includes(a.id)} onChange={()=>void act(async()=>{const agentIds=state.agentIds.includes(a.id)?state.agentIds.filter(id=>id!==a.id):[...state.agentIds,a.id];await api('/api/me/telegram/agents',{method:'PUT',body:JSON.stringify({agentIds})});})}/>{a.name}</label>)}</fieldset>}
 {(state?.connected||link||state?.pendingName)&&<Button kind="tertiary" size={36} disabled={busy} onClick={()=>void act(async()=>{await api('/api/me/telegram',{method:'DELETE'});setLink(null);})}>{state?.connected?'Disconnect Telegram':'Cancel connection'}</Button>}
 {error&&<p role="alert" className="text-sm text-coral">{error}</p>}
 </section>;
}
