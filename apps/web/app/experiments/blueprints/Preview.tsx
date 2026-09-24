'use client';
import {useState} from 'react';
import {InventoryView} from '@unwatched/protocol';
import {Inventory} from '@/components/citizen/Inventory';
import frames from './frames.json';
import s from '../life-story/preview.module.css';
export default function Preview(){
 const [step,setStep]=useState(0);const f=frames[step]!;
 return <main className={s.page}><a href='/town'>Back to the island ↗</a> · <a href='/experiments/blueprints/observe'>What the agent chose ↗</a><p className={s.eyebrow}>CITIZEN-AUTHORED ITEMS / ENGINE WALKTHROUGH</p><h1>An idea becomes<br/>a useful object.</h1><p className={s.intro}>A scripted demonstration of the real blueprint system. Mara's design combines carrying and repair. Materials, inventory, equipment and building damage are checked by the engine. This is not evidence of an autonomous invention.</p><nav aria-label='Blueprint stages'>{frames.map((x,i)=><button key={x.label} aria-pressed={i===step} onClick={()=>setStep(i)}>{i+1} · {x.label}</button>)}</nav><div className={s.columns}><Inventory key={step} data={InventoryView.parse(f.bag)}/><aside aria-live='polite'><p className={s.eyebrow}>THE ACTUAL OUTCOME</p><h2>{f.label}</h2><p>{f.damage?`Boatshed damage: ${f.damage} day remaining.`:'The boatshed is working again.'}</p>{f.events.map((e,i)=><p key={i}>{e}</p>)}<p className={s.note}>Open Crafting to see Mara's design. Open the item to inspect its capabilities, condition and provenance. A prototype is a real item, not proof that every idea works.</p></aside></div><footer><button disabled={step===0} onClick={()=>setStep(step-1)}>Previous</button><button disabled={step===frames.length-1} onClick={()=>setStep(step+1)}>Next stage →</button></footer></main>;
}
