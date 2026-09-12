"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Page, Card, Label, Strip, Bubble, Tide, LinkButton } from "@/components/ui";
import { api, hhmm, dayOf, type OwnerAgent, type PublicAgent, type TownEvent } from "@/lib/api";
import { Portrait } from "@/components/Portrait";

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const [a, setA] = useState<OwnerAgent | PublicAgent | null>(null); const [evs, setEvs] = useState<TownEvent[]>([]);
  useEffect(() => { void api<OwnerAgent | PublicAgent>(`/api/agents/${id}`).then(setA); void api<TownEvent[]>(`/api/agents/${id}/events?since=0`).then((e) => setEvs(e.filter((x) => x.importance >= 0.3).reverse())); }, [id]);
  if (!a) return <Page><div className="text-drift">Looking for them…</div></Page>;
  const own = "coins" in a; const first = a.name.split(" ")[0];
  return (
    <Page>
      <div className="grid gap-5 grow grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
        <Card className="p-7 items-start">
          <Portrait name={a.name} appearance={a.appearance} age={a.age} size={160} locked={a.perks === false} />
          <div className="display text-[28px] font-bold">{a.name}</div>
          <div className="text-sm text-ink2">{a.age} · arrived day {a.arrivedDay} · from {a.origin}</div>
          <div className="text-sm text-ink2">{a.asleep ? "Asleep" : `At ${a.place}`}.</div>
          <div className="flex gap-2 flex-wrap">{own ? <LinkButton href="/letters" kind="secondary" size={36}>Write to {first}</LinkButton> : null}{own ? <LinkButton href={`/agent/${a.id}/book`} kind="tertiary" size={36}>The book</LinkButton> : null}<LinkButton href="/town" kind="tertiary" size={36}>Watch</LinkButton></div>
          {own && <div className="mt-auto bg-sand rounded-[18px] p-4 flex flex-col gap-1"><Label>Only you can see this</Label><div className="text-sm"><b>The secret</b> · {String((a as OwnerAgent).persona.secret)}</div><div className="text-[13px] text-drift">Still a secret, as far as the record shows.</div></div>}
          {!own && <div className="mt-auto text-[13px] text-drift">You are seeing what the town knows. The owner sees the rest.</div>}
        </Card>
        <Card className="min-h-0 overflow-hidden"><div className="flex justify-between items-center"><h1 className="text-[26px] font-semibold">{own ? "Life" : "What the town knows"}</h1><span className="text-[13px] text-drift">{evs.length} things on the record</span></div><div className="overflow-auto"><Strip items={evs.slice(0, 60).map((e) => ({ t: `Day ${dayOf(e.t)} ${hhmm(e.t)}`, changed: e.importance >= 0.45, text: e.text.length > 220 ? e.text.slice(0, 218) + "…" : e.text }))} /></div></Card>
        <div className="flex flex-col gap-4">
          <Card><Label>Knowledge passed on</Label><p className="text-sm text-ink2">Advice heard from neighbors. These are shared experiences, not guarantees.</p>
            {(a.sharedKnowledge ?? []).slice(-4).reverse().map(k => <div key={k.eventId} className="border-t border-ink/10 pt-3 text-sm">
              <p><a className="text-teal underline" href={`/agent/${k.from}`}>{k.name}</a> → {first}</p>
              <p>{k.item} at {k.place}: {k.confidence >= .5 ? "recent attempts mostly worked" : "recent attempts were unreliable"}.</p>
              <p className="text-xs text-drift">Experience from day {dayOf(k.sourceT)} · shared day {dayOf(k.sharedT)} · record #{k.eventId}</p>
              {own && (() => { const test = (a as OwnerAgent).foodAdvice?.find(x=>x.eventId===k.eventId)?.tested; return <p className="mt-1 text-teal">{test ? `Checked on day ${dayOf(test.t)}: ${test.matched ? "this attempt agreed" : "this attempt disagreed"}.` : "Not checked firsthand yet."}</p>; })()}
            </div>)}
            {!a.sharedKnowledge?.length && <p className="text-sm text-drift">No practical advice has been shared with them yet.</p>}
          </Card>
          <Card><Label>Observed routines</Label><p className="text-sm text-ink2">Purchases recorded by the town, not inferred thoughts.</p>
            {(a.observedPurchases ?? []).slice(-4).map(r=><div key={`${r.place}:${r.item}`} className="border-t border-ink/10 pt-3 text-sm"><b>{r.item} · {r.place}</b><p>{r.receipts.length} recent successful {r.receipts.length===1?"purchase":"purchases"}.</p><details><summary className="cursor-pointer text-teal">Show evidence</summary>{r.receipts.slice(-5).map(e=><p key={e.eventId}>Day {dayOf(e.t)}, {hhmm(e.t)} · {e.cost} coins · record #{e.eventId}</p>)}</details></div>)}
            {!a.observedPurchases?.length && <p className="text-sm text-drift">No purchase evidence recorded yet.</p>}
          </Card>
          {own && <Card><Label>Learning from experience</Label><p className="text-sm text-ink2">When food shops are equally near, recent purchase outcomes help choose between them. Availability and affordability still come first. Old experiences lose influence.</p>
            {((a as OwnerAgent).foodRoutineDecisions ?? []).slice(-3).map((d,i)=><p key={`${d.t}:${i}`} className="text-sm border-l-2 border-teal pl-3">Day {dayOf(d.t)} · From {d.from}, took the road to {d.next} toward {d.preferred}. Without learning, the food routine would have chosen {d.baseline}.</p>)}
            {((a as OwnerAgent).foodLessons ?? []).slice(-4).map(l=><div key={`${l.place}:${l.item}`} className="text-sm"><b>{l.item} · {l.place}</b><p>{l.evidence.filter(e=>e.success).length} successful, {l.evidence.filter(e=>!e.success).length} unavailable observations in retained evidence.</p></div>)}
          </Card>}

          {own ? <>
            <Card><Label>Money</Label><div className="display text-[26px] font-semibold tabular">{(a as OwnerAgent).coins} <span className="text-sm text-drift font-normal">coins</span></div><div className="text-sm text-ink2">{a.job ? `Works as ${a.job}.` : "No work."} {a.home ? `Sleeps at the ${a.home}, ${(a as OwnerAgent).nightsPaid} nights paid.` : "No roof."}</div></Card>
            <Card><Label>People</Label>{(a as OwnerAgent).people.slice(0, 6).map((p) => <Tide key={p.id} name={p.name} trust={p.trust} word={p.tide} />)}</Card>
            <Card tone="glass"><Label tone="teal">What {first} keeps coming back to</Label>{(a as OwnerAgent).memories.filter((m) => m.kind === "reflect").slice(0, 2).map((m, k) => <Bubble key={k} max={320}>“{m.text}”</Bubble>)}{(a as OwnerAgent).memories.filter((m) => m.kind === "reflect").length === 0 && <p className="text-sm text-ink2">The first reflection is written after midnight.</p>}</Card>
          </> : <>
            <Card><Label>Known about {first}</Label><div className="text-sm">Job: {a.job ?? "none that anyone knows of"}</div><div className="text-sm">Lives at: {a.home ?? "nobody knows"}</div><div className="text-sm">Money: nobody knows</div></Card>
            <Card><Label>Unknown</Label><p className="text-sm text-ink2">Where they really came from, what they are saving for, what they fear. Someone would have to ask, and they would have to answer.</p></Card>
          </>}
        </div>
      </div>
    </Page>
  );
}
