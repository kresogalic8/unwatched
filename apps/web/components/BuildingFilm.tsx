"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { constructionStage, type BuildingReplay } from "@unwatched/protocol";
import { API } from "@/lib/api";
import { Wordmark } from "./ui";

/** Architectural reconstruction from measured labor; no invented citizen movements or dialogue. */
function House({ labor, needed, shop = false }: { labor: number; needed: number; shop?: boolean }) {
  const ratio = labor / Math.max(1, needed); const finished = ratio >= 1;
  return <g stroke="#274c48" strokeWidth="2.5" strokeLinejoin="round">
    <ellipse cx="0" cy="30" rx="150" ry="23" fill="#264d4820" stroke="none" />
    <path d="M-112 6 L-76 -12 H104 L126 6 L92 23 H-88Z" fill="#d3c6a9" />
    {ratio < .3 && <g strokeDasharray="5 5"><path d="M-92 4V-39H94V4Z" fill="#eee5d0" /><path d="M-92 -39L-63 -60H121L94 -39" fill="none" /></g>}
    {ratio >= .3 && <g><path d={`M-92 4V${-32-Math.min(ratio,.8)*115}H94V4Z`} fill="#f7f3e9" /><path d={`M94 4L122 -17V${-53-Math.min(ratio,.8)*115}L94 ${-32-Math.min(ratio,.8)*115}Z`} fill="#cccfba" />
      {Array.from({length: Math.floor(Math.min(ratio,.8)*10)},(_,i)=><path key={i} d={`M-91 ${-12-i*14}H93`} stroke="#c9c4b0" strokeWidth="1" />)}
      <path d="M-14 4V-54Q4 -73 22 -54V4" fill="#305954" />
      {ratio >= .6 && <g fill="#aec8bf"><path d="M-70 -70H-38V-33H-70Z" /><path d="M47 -70H77V-33H47Z" /><path d="M-54 -70V-33M62 -70V-33" /></g>}
    </g>}
    {ratio >= .8 && <g><path d="M-112 -127L0 -199L112 -127Z" fill="#557b70" /><path d="M0 -199L28 -215L137 -145L112 -127Z" fill="#355e55" /><path d="M-118 -124H116" strokeWidth="6" /></g>}
    {!finished && <g stroke="#9e8962" fill="none"><path d="M-114 8V-156M-81 8V-139M113 8V-152M-120 -95H121M-120 -144H121M-114 -95L-81 -140M-81 -95L-114 -40" strokeWidth="4" /><path d="M132 9L157 -110M143 9L168 -110" />{Array.from({length:7},(_,i)=><path key={i} d={`M${134+i*3.5} ${-i*16}h12`} />)}</g>}
    {finished && <g><path d="M-93 4H94" strokeWidth="6" />{shop ? <g><path d="M-85 -79H85L95 -58H-95Z" fill="#bd694b" /><path d="M-48 -108H48V-89H-48Z" fill="#e5cf9e" /></g> : <g fill="#6c8662"><ellipse cx="-107" cy="-7" rx="18" ry="25" /><ellipse cx="119" cy="-6" rx="15" ry="21" /></g>}</g>}
    {!finished && <g fill="#c5ab79">{[0,1,2].map(i=><path key={i} d={`M-167 ${8-i*7}h40v5h-40Z`} />)}</g>}
  </g>;
}

export function BuildingFilm({ place, demo = false }: { place?: string; demo?: boolean }) {
  const [data,setData] = useState<BuildingReplay | null>(null);
  const [error,setError] = useState(""); const [index,setIndex] = useState(0); const [playing,setPlaying] = useState(false);
  const [overview,setOverview] = useState(false);
  const [notice,setNotice] = useState(""); const [attempt,setAttempt] = useState(0);
  const art = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError(""); setIndex(0); setPlaying(false);
    const through = new URLSearchParams(location.search).get("through");
    const query = place && through ? `?through=${encodeURIComponent(through)}` : "";
    fetch(demo ? "/demo/construction.json" : `${API}/api/construction${place ? `/${encodeURIComponent(place)}` : ""}${query}`, { signal:controller.signal }).then(async r => {
      const body = await r.json().catch(()=>null); if (!r.ok || !body) throw new Error(body?.error ?? "The construction record is unavailable on this island. Try again, or open the recorded mock demo."); return body as BuildingReplay;
    }).then(body=>{
      if(demo){const q=new URLSearchParams(location.search);const chosen=q.get("place");const end=q.get("through");if(chosen)body.buildings=body.buildings.filter(b=>b.history.place===chosen);if(end)body.buildings=body.buildings.map(b=>({...b,history:{...b.history,moments:b.history.moments.filter(m=>m.sequence<=Number(end))}}));}
      setData(body); if(through) setIndex(Math.max(0,body.buildings.reduce((n,b)=>n+b.history.moments.length,0)-1));
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  },[place,demo,attempt]);
  const frames = (data?.buildings.flatMap(b => b.history.moments.map(m => ({ b,m }))) ?? []).sort((a,b) => a.m.t-b.m.t || a.b.history.place.localeCompare(b.b.history.place) || a.m.sequence-b.m.sequence);
  const frame = frames[index]; const count = frames.length;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setIndex(i => { if (i >= count-1) { setPlaying(false); return i; } return i+1; }), Math.max(500,Math.min(5000,60000/Math.max(1,count))));
    return () => clearInterval(timer);
  },[playing,count]);
  const h = frame?.b.history; const m = frame?.m;
  const share = async () => {
    if (!h || !m) return;
    const url = demo ? `${location.origin}/built/demo?place=${encodeURIComponent(h.place)}&through=${m.sequence}` : `${location.origin}/built/${encodeURIComponent(h.place)}?through=${m.sequence}`;
    try { await navigator.clipboard.writeText(url); setNotice("Link copied. It opens this recorded chapter."); } catch { setNotice(`Copy this link: ${url}`); }
  };
  const savePicture = () => {
    if (!art.current || !h) return;
    const blob = new Blob([new XMLSerializer().serializeToString(art.current)], {type:"image/svg+xml"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=`unwatched-${h.place}-${m?.sequence}.svg`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-5">
    <header className="flex items-center justify-between gap-4"><Wordmark /><Link href="/town" className="text-sm font-semibold text-teal">Watch the island live ↗</Link></header>
    <div className="mt-10 mb-7 flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm text-drift">{demo ? "Recorded mock demo · 30 days" : "The building record"} · {data?.town ?? "Unwatched"}</p><h1 className="display text-4xl sm:text-6xl leading-tight mt-2">They left a mark.</h1></div><p className="max-w-[32ch] text-ink2">An intention. Someone else's help. A place that wasn't here before.</p></div>
    {error && <div role="alert" className="py-12 max-w-xl"><p>{error}</p><button className="mt-4 underline text-teal" onClick={()=>setAttempt(n=>n+1)}>Try again</button><Link className="ml-5 underline" href="/built">All buildings</Link><Link className="ml-5 underline" href="/built/demo">Try the recorded mock demo</Link></div>}
    {!data && !error && <div role="status" className="bg-glass rounded-3xl p-16 text-ink2">Opening the building record…</div>}
    {data && !frame && <section className="rounded-3xl bg-glass py-20 px-8 max-w-3xl"><h2 className="display text-3xl">The first foundation is still ahead.</h2><p className="mt-4 text-ink2">New buildings will leave their history here as citizens start them. Older buildings have no recorded construction replay.</p><Link href="/town" className="inline-block mt-6 text-teal underline">Spend a minute on the island →</Link><Link href="/built/demo" className="inline-block ml-5 mt-6 text-teal underline">Try the recorded mock demo →</Link></section>}
    {data && frame && h && m && <>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-7">
        <section className="min-w-0">
          <svg ref={art} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 560" role="img" aria-label={`${h.name}, day ${m.day}: ${constructionStage(m.labor,h.needed)}, ${m.labor} of ${h.needed} mornings worked`} className="w-full rounded-3xl" style={{background:"#eee7d8"}}>
            <rect width="880" height="560" fill="#eee7d8" rx="24" />
            <path d="M0 370Q210 314 460 393T880 366V560H0Z" fill="#cbd8cc" /><path d="M0 416Q220 355 460 429T880 404V560H0Z" fill="#afc9bd" />
            <g stroke="#f5f1e5" opacity=".55" fill="none">{[0,1,2,3].map(i=><path key={i} d={`M20 ${456+i*18}Q250 ${414+i*18} 480 ${457+i*18}T850 ${450+i*18}`} />)}</g>
            <text x="36" y="48" fontFamily="Georgia,serif" fontSize="23" fill="#274c48">UNWATCHED</text><text x="844" y="46" textAnchor="end" fontFamily="sans-serif" fontSize="13" fill="#274c48">DAY {m.day} · {constructionStage(m.labor,h.needed).toUpperCase()}</text>
            {overview ? <g>{data.buildings.map(b=>{
              const at=b.history.moments.filter(x=>x.t<=m.t).at(-1);
              const x=100+b.x/data.size.w*660;const y=125+b.y/data.size.h*260;
              return <g key={b.history.place} transform={`translate(${x} ${y})`} opacity={at ? 1 : .22}>
                {at ? <g transform="scale(.29)"><House labor={at.labor} needed={b.history.needed} shop={b.history.what==="shop"} /></g> : <path d="M-25 0H25M0 -10V10" stroke="#274c48" strokeDasharray="3 3" />}
                <text x="0" y="28" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fill="#274c48">{at ? b.history.name : "Unbuilt plot"}</text>
              </g>;
            })}</g> : <g transform="translate(438 347) scale(1.18)"><House labor={m.labor} needed={h.needed} shop={h.what==="shop"} /></g>}
            <text x="36" y="495" fontFamily="Georgia,serif" fontSize="27" fill="#274c48">{h.name.length>48 ? h.name.slice(0,45)+"…" : h.name}</text>
            <text x="36" y="523" fontFamily="sans-serif" fontSize="13" fill="#274c48">{m.labor} / {h.needed} mornings worked · {m.people.map(p=>p.name).join(", ").slice(0,82)}</text>
            <text x="844" y="546" textAnchor="end" fontFamily="sans-serif" fontSize="10" fill="#46665d">RECONSTRUCTION FROM RECORDED ACTIONS · unwatched.world</text>
          </svg>
          <div className="flex gap-4 items-center mt-4"><button className="rounded-full bg-teal text-shell px-6 py-3 font-semibold min-w-28" aria-label={playing ? "Pause replay" : "Play replay"} onClick={()=>{if(index===count-1)setIndex(0);setPlaying(!playing);}}>{playing ? "Pause" : index===count-1 ? "Replay" : "Play"}</button><input className="w-full accent-teal" type="range" min="0" max={count-1} value={index} aria-label="Recorded moment" onChange={e=>{setPlaying(false);setIndex(Number(e.target.value));}} /><span className="text-xs tabular text-drift whitespace-nowrap">{index+1} / {count}</span></div>
          <div className="flex gap-4 mt-4 text-sm text-teal"><button aria-pressed={!overview} onClick={()=>setOverview(false)} className="underline underline-offset-4">This building</button><button aria-pressed={overview} onClick={()=>setOverview(true)} className="underline underline-offset-4">Island growth</button></div>
          <p className="mt-3 text-xs text-drift">{data.source}. Time between recorded moments is compressed. Drawings reconstruct labor stages; they are not historical footage. The overview shows recorded building plots on the current map layout.</p>
        </section>
        <aside className="flex flex-col gap-5 py-2 min-w-0">
          <div><p className="text-sm text-drift">{frame.b.district} · {h.what}</p><h2 className="display text-3xl mt-2">{h.project}</h2><p className="mt-2 text-ink2">Started by {h.builder.name}, day {Math.floor(h.started/1440)+1}.</p></div>
          <div className="border-y border-drift/20 py-5"><p className="text-xs uppercase tracking-widest text-teal">Day {m.day} · {m.kind}</p><p className="mt-3 text-xl leading-snug">{m.text}</p><div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">{m.people.map(p=>demo ? <span key={p.id} className="text-sm text-teal">{p.name}</span> : <Link key={p.id} className="text-sm text-teal underline underline-offset-4" href={`/agent/${p.id}`}>{p.name}</Link>)}</div></div>
          <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-drift">Land</dt><dd>{h.landCoins} coins</dd></div><div><dt className="text-drift">Materials</dt><dd>{h.planks} planks · {h.materialCoins} coins</dd></div><div><dt className="text-drift">Work recorded</dt><dd>{m.labor} / {h.needed} mornings</dd></div><div><dt className="text-drift">Help paid so far</dt><dd>{h.moments.filter(x=>x.sequence<=m.sequence && x.kind==="paid").reduce((n,x)=>n+(x.coins??0),0)} coins</dd></div></dl>
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-teal"><button onClick={()=>void share()} className="underline underline-offset-4">Share this chapter ↗</button><button onClick={savePicture} className="underline underline-offset-4">Save picture ↓</button></div><p role="status" className="text-xs text-ink2 break-words">{notice}</p>
          {(place || demo) && <Link href={demo ? "/built/demo" : "/built"} className="text-sm text-teal">← Watch every building</Link>}
        </aside>
      </div>
      <section className="mt-12 mb-12"><h2 className="display text-2xl mb-5">The marks on the island</h2><div className="flex flex-wrap gap-3">{data.buildings.map(b=>{const latest=b.history.moments.at(-1);return <Link key={b.history.place} href={demo ? `/built/demo?place=${encodeURIComponent(b.history.place)}&through=${latest?.sequence??1}` : `/built/${encodeURIComponent(b.history.place)}?through=${latest?.sequence??1}`} className="bg-glass rounded-xl px-5 py-4 hover:bg-sand transition-colors"><span className="block font-semibold">{b.history.name}</span><span className="text-sm text-drift">{b.history.builder.name} · {constructionStage(latest?.labor??0,b.history.needed)}</span></Link>;})}</div></section>
    </>}
  </main>;
}
