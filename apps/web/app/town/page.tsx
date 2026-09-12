"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Page, Card, Label, Chip, Button, Bubble, Tide, LinkButton } from "@/components/ui";
import { api, type PublicAgent, type OwnerAgent } from "@/lib/api";
import { useMyAgent } from "@/lib/useAgent";
const World = dynamic(() => import("@/components/World").then((m) => m.World), { ssr: false, loading: () => <div className="w-full h-full rounded-[28px] bg-glass flex items-center justify-center text-teal font-bold">Crossing to the island…</div> });

export default function Town() {
  const { agent, reason } = useMyAgent();
  const [sel, setSel] = useState<PublicAgent | null>(null);
  // ?clean=1 is film mode: the island with nothing over it, so nothing below is drawn either
  const [clean, setClean] = useState(false);
  useEffect(() => { try { setClean(new URLSearchParams(window.location.search).get("clean") === "1"); } catch {} }, []);
  // a viewer with nobody here is asked once a session, quietly, from a corner
  const visitor = reason === "signed-out" || reason === "none";
  const [nudge, setNudge] = useState(false);
  useEffect(() => { try { setNudge(sessionStorage.getItem("ft.nudge") !== "1"); } catch { setNudge(true); } }, []);
  const dismiss = () => { setNudge(false); try { sessionStorage.setItem("ft.nudge", "1"); } catch {} };
  // ?view=map or ?view=cinema opens the town in that view, for sharing a link and for looking at the island from afar
  const [view, setView] = useState<"street" | "map" | "cinema">("street");
  useEffect(() => { try { const v = new URLSearchParams(window.location.search).get("view"); if (v === "map" || v === "cinema") setView(v); } catch {} }, []);
  const [follow, setFollow] = useState(true);
  // ?fx=1 turns on the GPU light and water, for comparing the old street with the new on the same island
  const [effects, setEffects] = useState(true); // the light, the water, the weather and the life: on, unless ?fx=0 asks for the plain drawing
  useEffect(() => { try { if (new URLSearchParams(window.location.search).get("fx") === "0") setEffects(false); } catch {} }, []);
  const [possessed, setPossessed] = useState(false);
  const [say, setSay] = useState(""); const [busy, setBusy] = useState(false); const [note, setNote] = useState<string | null>(null);
  const [selFull, setSelFull] = useState<OwnerAgent | PublicAgent | null>(null);
  useEffect(() => { if (!sel) return setSelFull(null); void api<OwnerAgent | PublicAgent>(`/api/agents/${sel.id}`).then(setSelFull); }, [sel]);
  const rel = agent?.people.find((p) => p.id === sel?.id);
  async function act(action: unknown) {
    if (!agent) return; setBusy(true); setNote(null);
    try { const r = await api<{ ok: boolean }>(`/api/agents/${agent.id}/possess`, { method: "POST", body: JSON.stringify(action) }); setNote(r.ok ? null : `${agent.name.split(" ")[0]} could not do that here.`); setSay(""); }
    catch (e) { setNote((e as Error).message); }
    setBusy(false);
  }
  return (
    <Page>
      <div className="relative grow min-h-[520px] sm:min-h-[720px]">
        <World mineId={follow && agent ? agent.id : null} onSelect={setSel} view={view} effects={effects} />
        <div className="scrim absolute inset-0 rounded-[28px] pointer-events-none" data-on={possessed ? "true" : "false"} aria-hidden />
        <div className="absolute left-3 top-3 sm:left-6 sm:top-6 flex gap-2 flex-wrap pointer-events-auto">
          <div className="flex gap-1 bg-shell rounded-full p-1"><Chip active={view === "street"} onClick={() => setView("street")}>Street</Chip><Chip active={view === "map"} onClick={() => setView("map")}>Map</Chip><Chip active={view === "cinema"} onClick={() => setView("cinema")}>Follow the day</Chip></div>
          {agent && <div className="flex gap-1 bg-shell rounded-full p-1"><Chip active={follow} onClick={() => setFollow(true)}>Follow {agent.name.split(" ")[0]}</Chip><Chip active={!follow} onClick={() => setFollow(false)}>Free camera</Chip></div>}
          {possessed && agent && <div className="flex items-center gap-2 bg-shell rounded-full px-4"><span className="w-2.5 h-2.5 rounded-full bg-coral" /><span className="font-bold text-sm">You are {agent.name.split(" ")[0]}</span></div>}
        </div>
        {visitor && nudge && !clean && (
          <div className="absolute left-3 top-16 sm:left-6 sm:top-20 w-[calc(100%-24px)] sm:w-[280px] bg-shell rounded-card p-4 flex flex-col gap-2 pointer-events-auto rise">
            <Label>Everyone here belongs to someone</Label>
            <p className="text-sm text-ink2">Forty coins, a suitcase, three nights at the inn.</p>
            <div className="flex items-center justify-between gap-2"><LinkButton href="/board" size={36}>Send someone over</LinkButton><button onClick={dismiss} className="text-[13px] text-drift">Not now</button></div>
          </div>
        )}
        {sel && (
          <div className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:right-6 sm:top-6 sm:bottom-6 sm:w-[360px] max-h-[70%] sm:max-h-none overflow-auto bg-shell rounded-[28px] p-5 sm:p-7 flex flex-col gap-4 pointer-events-auto">
            <div><Label>{sel.asleep ? "Asleep" : `At ${sel.place}`}</Label><div className="display text-[30px] font-bold">{sel.name}</div><div className="text-sm text-drift">{sel.job ?? "no work"} · arrived day {sel.arrivedDay}{sel.ownerId ? "" : " · house-funded"}</div></div>
            {agent && sel.id !== agent.id && <div className="flex flex-col gap-2"><Label>What {agent.name.split(" ")[0]} knows</Label>{rel ? <><Tide name="Trust" trust={rel.trust} word={rel.tide} width={60} />{rel.opinion && <Bubble max={300}>“{rel.opinion}”</Bubble>}</> : <p className="text-sm text-drift">They have not met. {agent.name.split(" ")[0]} would have to be introduced, or introduce themselves.</p>}</div>}
            {visitor && <div className="flex flex-col gap-2"><Label>What your person would know</Label><div className="opacity-40 pointer-events-none" aria-hidden><Tide name="Trust" trust={0.45} word="steady" width={60} /></div><p className="text-[13px] text-drift">What your person would know about them: trust, and what they think. Owners see it here.</p></div>}
            {selFull && "persona" in selFull && <div className="flex flex-col gap-1"><Label>Only you can see this</Label><p className="text-sm text-ink2">{String(selFull.persona.summary)}</p></div>}
            {!("persona" in (selFull ?? {})) && <div className="flex flex-col gap-1"><Label>Unknown</Label><p className="text-sm text-drift">Their money, their family, where they were last night. Someone would have to ask.</p></div>}
            <div className="mt-auto flex flex-col gap-2">
              {agent && sel.id === agent.id && !possessed && <Button onClick={() => setPossessed(true)} disabled={sel.asleep}>{sel.asleep ? `${sel.name.split(" ")[0]} is asleep` : `Possess ${sel.name.split(" ")[0]}`}</Button>}
              {agent && sel.id !== agent.id && !possessed && <Button onClick={() => { setPossessed(true); setFollow(true); }} disabled={agent.asleep}>Possess {agent.name.split(" ")[0]} and go talk</Button>}
              {visitor && <div className="flex flex-col gap-1"><Button disabled>Possess and go talk</Button><p className="text-[12px] text-drift text-center">Owners can walk their citizen through the street. <Link href="/board" className="font-bold text-teal">Send someone over</Link></p></div>}
              <LinkButton href={`/agent/${sel.id}`} kind="secondary">Their page</LinkButton>
              <button onClick={() => setSel(null)} className="text-sm text-drift">Close</button>
            </div>
          </div>
        )}
        {possessed && agent && (
          <div className="absolute left-3 right-3 bottom-3 sm:left-6 sm:right-6 sm:bottom-6 grid gap-4 items-end pointer-events-auto grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
            <div className="bg-shell rounded-card p-4 flex flex-col gap-1.5"><Label>You speak with {agent.name.split(" ")[0]}'s memory</Label><p className="text-sm text-ink2">{agent.memories[0]?.text ?? "Nothing yet."}</p><button onClick={() => setPossessed(false)} className="self-start mt-1 text-sm font-bold text-coral">Let {agent.name.split(" ")[0]} go</button></div>
            <div className="bg-shell rounded-card p-4 flex flex-col gap-3">
              <div className="flex gap-2 flex-wrap">{sel && sel.id !== agent.id && <Chip onClick={() => act({ kind: "move", to: sel.location })}>Walk to {sel.name.split(" ")[0]}</Chip>}<Chip onClick={() => act({ kind: "wait" })}>Wait</Chip><Chip onClick={() => act({ kind: "work" })}>Work</Chip><Chip onClick={() => act({ kind: "sleep" })}>Sleep</Chip></div>
              <form onSubmit={(e) => { e.preventDefault(); if (say.trim()) void act({ kind: "say", ...(sel && sel.id !== agent.id ? { to: sel.id } : {}), text: say.trim() }); }} className="flex gap-2.5 items-center"><input value={say} onChange={(e) => setSay(e.target.value)} placeholder={sel && sel.id !== agent.id ? `Say something to ${sel.name.split(" ")[0]}` : "Say something to whoever is here"} className="grow h-12 rounded-full bg-sand px-5 text-base" /><Button type="submit" disabled={busy || !say.trim()}>Say it</Button></form>
              {note && <div className="text-[13px] text-coral">{note}</div>}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
