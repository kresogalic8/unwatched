"use client";
import { useEffect, useState } from 'react';
import type { Decoration } from '@unwatched/protocol';

export function PlaceMemory({ marks, onPreview }: { marks: Decoration[]; onPreview: (through: number | null) => void }) {
  const [open,setOpen]=useState(false), [through,setThrough]=useState(marks.length);
  const selected=marks[through-1];
  useEffect(()=>{setThrough(marks.length);onPreview(null);},[marks.length]); // New recorded work returns the map to the present.
  return <div className="border-t border-ink/15 pt-3">
    <button type="button" className="flex w-full items-center justify-between text-left text-sm font-semibold py-2" aria-expanded={open} onClick={()=>{setOpen(!open);if(open)onPreview(null);}}><span>What happened here?</span><span aria-hidden>{open?'−':'+'}</span></button>
    {open && <div className="flex flex-col gap-3 text-sm">
      {marks.length ? <>
        <p className="text-ink2">Replay the additions residents actually made. The rest of the island stays live.</p>
        <label className="flex flex-col gap-2">{through===marks.length?'Present day':through===0?'Before these additions':`Addition ${through} of ${marks.length}`}
          <input className="w-full accent-[#e85b2a]" aria-label="Recorded place additions" type="range" min={0} max={marks.length} value={through} onChange={e=>{const n=Number(e.target.value);setThrough(n);onPreview(n);}} />
        </label>
        {selected ? <div className="border-l-2 border-[#e85b2a] pl-3"><p className="font-semibold">Day {selected.day} · {selected.name}</p><p>Added {selected.kind}.</p><p className="text-ink2 mt-1">{selected.why}</p></div> : <p className="text-ink2">No recorded additions yet at this point.</p>}
        <button className="self-start rounded border border-ink/20 px-3 py-2 font-semibold hover:bg-ink/5" onClick={()=>{setThrough(marks.length);onPreview(null);}}>Return to present</button>
      </> : <p className="text-ink2">No small improvements have been recorded here yet. Residents decide whether to leave their mark.</p>}
    </div>}
  </div>;
}
