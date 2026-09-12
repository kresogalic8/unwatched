"use client";
import { useEffect, useState } from "react";
import { Page, Card, Label, Tide, Bubble, LinkButton } from "@/components/ui";
import { useMyAgent } from "@/lib/useAgent";

export default function People() {
  const { agent, reason } = useMyAgent(); const [sel, setSel] = useState<string | null>(null);
  // arrived from the digest with someone named: open on them
  useEffect(() => { try { const id = new URLSearchParams(location.search).get("id"); if (id) setSel(id); } catch {} }, []);
  if (reason !== "ok" || !agent) return <Page><Card className="max-w-[560px]"><Label>People</Label><h1 className="text-[28px] font-bold">{reason === "loading" ? "Asking around…" : "Nobody to know yet."}</h1>{reason !== "loading" && <LinkButton href={reason === "signed-out" ? "/gate" : "/board"}>{reason === "signed-out" ? "Sign in" : "Send someone over"}</LinkButton>}</Card></Page>;
  const p = agent.people.find((x) => x.id === sel) ?? agent.people[0];
  const first = agent.name.split(" ")[0];
  return (
    <Page>
      <div className="grid gap-5 grow grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card><div className="flex justify-between items-baseline"><h1 className="text-[26px] font-semibold">People {first} knows</h1><span className="text-[13px] text-drift">{agent.people.length}</span></div><p className="text-[13px] text-drift">Trust is a tide. Teal is coming in, coral is going out.</p><div className="flex flex-col gap-1">{agent.people.map((x) => <button key={x.id} onClick={() => setSel(x.id)} className={`text-left rounded-2xl px-3 py-2.5 ${p?.id === x.id ? "bg-glass" : ""}`}><Tide name={x.name} trust={x.trust} word={x.tide} width={120} /></button>)}</div></Card>
        {p ? <Card className="px-8 py-7"><div className="flex justify-between items-start"><div><div className="display text-[30px] font-bold">{p.name}</div><div className="text-sm text-drift">Last seen together day {Math.floor(p.lastSeen / 1440) + 1}</div></div><LinkButton href={`/agent/${p.id}`} kind="secondary" size={36}>What the town knows</LinkButton></div><div className="grid gap-6 grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px]"><div><Label>Trust</Label><div className="mt-2 flex flex-col gap-2"><Tide name={`${first} → ${p.name.split(" ")[0]}`} trust={p.trust} word={p.tide} width={150} /><Tide name={`${p.name.split(" ")[0]} → ${first}`} trust={0} word="unknown" width={150} /></div><p className="text-xs text-drift mt-2">You only see what {first} feels. What {p.name.split(" ")[0]} feels, {first} would have to find out.</p></div><div><Label>What {first} thinks</Label>{p.opinion ? <Bubble max={320}>“{p.opinion}”</Bubble> : <p className="text-sm text-drift">No settled opinion yet. Reflection writes one after a real conversation.</p>}</div></div></Card> : <Card><p className="text-drift">Nobody yet.</p></Card>}
      </div>
    </Page>
  );
}
