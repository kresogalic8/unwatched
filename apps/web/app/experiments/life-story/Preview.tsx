'use client';
import {useState} from 'react';
import {Desire} from '@unwatched/protocol';
import {Desires} from '@/components/digest/Desires';
import frames from './frames.json';
import s from './preview.module.css';
export default function Preview(){
 const [step,setStep]=useState(0);const f=frames[step]!;
 return <main className={s.page}><a href='/digest'>Back to my digest ↗</a> · <a href='/experiments/life-story/autonomous'>See the real model run ↗</a><p className={s.eyebrow}>A LIFE TAKES SHAPE / LOCAL PREVIEW</p><h1>A wish becomes<br/>something real.</h1><p className={s.intro}>Explore the same journey component now used in the digest. These choices are scripted for demonstration; inventory, rejected actions and repairs come from the real engine. No AI calls.</p><nav aria-label='Story stages'>{frames.map((x,i)=><button key={x.label} aria-pressed={step===i} onClick={()=>setStep(i)}>{String(i+1).padStart(2,'0')} · {x.label}</button>)}</nav><div className={s.columns}><section><Desires desires={f.desires.map(d=>Desire.parse(d))} name='Mara'/></section><aside aria-live='polite'><p className={s.eyebrow}>THE WORLD KEEPS THE SCORE</p><h2>{f.damage?'The boatshed needs work.':'The boatshed works again.'}</h2><p>{f.damage?`${f.damage} day of damage remains.`:'The repair changed the building state.'}</p><h3>What Mara carries</h3><p>{f.inventory.join(', ')||'No materials left.'}</p><h3>Recorded events</h3>{f.events.map((e,i)=><p key={i}>{e}</p>)}<p className={s.note}>A working building is a verified result. Whether this fulfils Mara’s desire remains her decision.</p></aside></div><footer><button disabled={step===0} onClick={()=>setStep(step-1)}>Previous</button><button disabled={step===frames.length-1} onClick={()=>setStep(step+1)}>Next moment →</button></footer></main>;
}
