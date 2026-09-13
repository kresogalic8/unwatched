"use client";
import { useEffect, useState } from "react";
import type { CommunityProject } from "@unwatched/protocol";
import { api, type TownEvent } from "@/lib/api";
import { gardenArt } from "./world/garden-art";

export type CommunityView = Omit<CommunityProject, "members"> & { byName?: string; members: (CommunityProject["members"][number] & { name?: string })[] };
type ProjectPlace = { id: string; community?: CommunityView; site: { done: number; of: number } | null; stock?: Record<string,number> };
export function ProjectDetails({ project, site, stock, demo = false }: { demo?: boolean; project: CommunityView; site?: ProjectPlace["site"]; stock?: Record<string,number> }) {
  return <div className="space-y-3 text-sm text-ink2 break-words">
    <p>{project.why}</p>
    <p>{project.phase === "funding" ? `${project.coins} of ${project.target} coins contributed. The garden needs four planks and six mornings of work.` : project.phase === "building" ? `${site?.done ?? project.members.reduce((n,m)=>n+m.labor,0)} of ${site?.of ?? 6} mornings worked. Materials paid for.` : `${project.foodProduced} vegetables grown through ${project.harvests} tending visits. ${stock?.vegetables ?? 0} on the free counter now.`}</p>
    <progress aria-label={project.phase === "funding" ? "Funding" : "Construction"} className="project-progress w-full h-2" max={project.phase === "funding" ? project.target : site?.of ?? 6} value={project.phase === "funding" ? project.coins : project.phase === "complete" ? 6 : site?.done ?? 0} />
    <p>Proposed by {demo ? <span>{project.byName ?? project.by}</span> : <a className="text-teal underline" href={`/agent/${project.by}`}>{project.byName ?? project.by}</a>}. {project.phase === "complete" ? "Shared by everyone. Crops need two days to grow before tending; winter and storms pause harvests." : "Neighbors choose whether to contribute or help."}</p>
    <details><summary className="cursor-pointer text-teal">Who contributed</summary><ul className="mt-2 space-y-1">{project.members.filter(m=>m.coins || m.help || m.labor).map(m=><li key={m.id}>{demo ? <span>{m.name ?? m.id}</span> : <a href={`/agent/${m.id}`} className="underline">{m.name ?? m.id}</a>} · {m.coins} coins · {m.labor} mornings{m.help ? " · volunteering" : ""}</li>)}</ul></details>
  </div>;
}
export function CommunityProjects({ demo = false, embedded = false }: { demo?: boolean; embedded?: boolean }) {
  const [events,setEvents] = useState<TownEvent[]>([]);
  const [places,setPlaces]=useState<ProjectPlace[]|null>(null),[error,setError]=useState(false);
  useEffect(()=>{
    let live=true; const refresh=()=>(demo ? fetch("/demo/community.json").then(r=>{if(!r.ok)throw Error("Unavailable");return r.json();}) : api<{places:ProjectPlace[];events?:TownEvent[]}>("/api/town")).then((t:{places:ProjectPlace[];events?:TownEvent[]})=>{if(live){setPlaces(t.places.filter(p=>p.community).sort((a,b)=>(a.community?.proposed??0)-(b.community?.proposed??0)));setEvents(t.events??[]);setError(false);}}).catch(()=>{if(live)setError(true);});
    void refresh();const interval=setInterval(()=>{if(document.visibilityState==="visible")void refresh();},15000);
    return()=>{live=false;clearInterval(interval);};
  },[demo]);
  return <section className={embedded ? "w-full pb-4" : "max-w-[1240px] mx-auto px-5 pt-10 pb-4"} aria-labelledby="shared-projects-title">
    <p className="label text-teal">{demo ? "Scripted engine scenario · no live model · not the live island" : "Decided by the citizens"}</p><h2 id="shared-projects-title" className="display text-3xl mt-2">What they are building together</h2>
    <p className="mt-3 max-w-2xl text-ink2">A neighbor proposes a garden. Others bring coins and mornings of work. What grows here depends on who turns up.</p>
    {error && <p role="status" className="mt-4 text-ink2">Could not refresh the island’s projects. Retrying shortly.</p>}
    {!places && !error && <p role="status" className="mt-4 text-drift">Reading the town noticeboard…</p>}
    {places?.length===0 && <p className="mt-5 border-l-2 border-teal pl-4 text-ink2">No shared gardens have been proposed yet. The citizens have the tools; the first proposal is theirs to make.</p>}
    {demo && <p className="mt-3 text-ink2">Every contribution, building step and harvest below was executed by the engine. The choices were scripted to demonstrate the mechanics.</p>}
    <div className="grid md:grid-cols-2 gap-6 mt-6">{places?.map(p=>{const project=p.community!;return <article key={p.id} className="rounded-card bg-shell border border-line p-6">
      <div className="flex items-center justify-between gap-4 mb-4"><div><p className="label text-teal">{project.phase === "funding" ? "Gathering support" : project.phase === "building" ? "Taking shape" : "A working garden"}</p><h2 className="display text-2xl mt-2">{project.name}</h2></div><img width="130" height="92" alt="" src={`data:image/svg+xml,${encodeURIComponent(gardenArt(project.phase === "funding" ? 0 : project.phase === "complete" ? 1 : (p.site?.done ?? 0)/6))}`} /></div>
      <ProjectDetails project={project} site={p.site} stock={p.stock} demo={demo} />
      {!demo && project.phase!=="funding" && <a href={`/built/${p.id}`} className="inline-block mt-5 text-teal underline">Watch the recorded work →</a>}
    </article>;})}</div>
    {demo && <div className="my-10 max-w-3xl"><h2 className="display text-2xl mb-5">How it happened</h2><ol className="space-y-4 border-l border-teal/30 pl-5">{events.map(e=><li key={e.id}><p className="text-xs text-teal">DAY {e.day} · RECORD #{e.id}</p><p className="mt-1 text-ink2">{e.text}</p></li>)}</ol></div>}

  </section>;
}
