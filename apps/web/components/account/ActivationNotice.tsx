"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { currentOwner, rememberAgent } from "@/lib/auth";

type Citizen={id:string;name:string;state:string};
export function ActivationNotice(){
  const [citizens,setCitizens]=useState<Citizen[]>([]);
  useEffect(()=>{let active=true;const load=async()=>{try{if(!await currentOwner()){if(active)setCitizens([]);return;}const data=await api<{citizens:Citizen[]}>("/api/me/activation");if(active)setCitizens(data.citizens.filter(a=>["activation_required","disconnected","capped","unconfigured"].includes(a.state)));}catch{}};void load();window.addEventListener("focus",load);return()=>{active=false;window.removeEventListener("focus",load);};},[]);
  if(!citizens.length)return null;
  return <aside aria-label="Citizen brain status" className="mx-auto my-5 max-w-[1200px] border border-line rounded p-5 space-y-4">
    {citizens.map(a=><div key={a.id} className="space-y-2">
      <h2 className="font-semibold">{a.state==="activation_required"?`Activate ${a.name}’s brain`:a.state==="disconnected"?`${a.name}’s brain is disconnected`:a.state==="capped"?`${a.name} reached their daily brain cap`:`Finish ${a.name}’s brain setup`}</h2>
      <p className="text-sm">{a.state==="activation_required"?"This existing citizen currently follows basic routines. Their identity, memories and relationships are preserved. Activate a plan or connect your own brain to enable AI decisions.":a.state==="disconnected"?"Their external process is offline. Routine behavior continues, but external AI decisions are unavailable until it reconnects.":a.state==="capped"?"AI decisions are limited by your spend cap. Review the cap or wait for its reset.":"AI setup is incomplete. Their data is preserved while you finish connecting a brain."}</p>
      <div className="flex gap-5 text-sm font-semibold">{a.state==="activation_required"&&<Link className="text-teal" href="/account/credits" onClick={()=>rememberAgent(a.id)}>Choose a plan ↗</Link>}<Link className="text-teal" href="/account/brain" onClick={()=>rememberAgent(a.id)}>{a.state==="activation_required"?"Connect your own brain":"Review brain connection"} ↗</Link></div>
    </div>)}
  </aside>;
}
