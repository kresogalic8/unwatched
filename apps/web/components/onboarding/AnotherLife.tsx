"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { LookPreview } from "@/components/LookPreview";
import type { Look, Pose } from "@/components/world/citizen";
import s from "./another-life.module.css";

import { situations, type LifeDraft } from "@/lib/another-life";
const stages = ["A beginning", "Your instincts", "The little things", "Your reflection", "Another life"];
const initial = { name:"", strength:"", flaw:"", habit:"", dream:"" };
export default function AnotherLife({initialDraft,onSave,onComplete,continuation}:{continuation?:{index:number;content:React.ReactNode;name:string;age:number;dream:string;look:Partial<Look>;pose:Pose};initialDraft?:LifeDraft;onSave?:(d:LifeDraft)=>void;onComplete?:(d:LifeDraft)=>void}) {
 const integrated=!!onComplete;
 const activeStep=continuation?.index;
 const [age,setAge]=useState(initialDraft?.age??30);
 const [step,setStep]=useState(initialDraft?.step??0), [question,setQuestion]=useState(initialDraft?.question??0), [mode,setMode]=useState(initialDraft?.mode??"self");
 const [answers,setAnswers]=useState<number[]>(initialDraft?.answers??Array(5).fill(-1));
 const [person,setPerson]=useState(initialDraft?.person??initial), [note,setNote]=useState(initialDraft?.note??"");
 const [hair,setHair]=useState(initialDraft?.hair??"Bob"), [color,setColor]=useState(initialDraft?.color??"Teal"), [day,setDay]=useState(0);
 const draft:LifeDraft={step,question,mode,answers,person,note,hair,color,age};
 const save=useRef(onSave);save.current=onSave;
 useEffect(()=>{save.current?.({step,question,mode,answers,person,note,hair,color,age});},[step,question,mode,answers,person,note,hair,color,age]);
 const heading=useRef<HTMLHeadingElement>(null), first=useRef(true);
 useEffect(()=>{if(first.current){first.current=false;return;} heading.current?.focus({preventScroll:true}); window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});},[step,question,activeStep]);
 const name=continuation?.name || person.name.trim() || "You";
 const traits=answers.flatMap((a,i)=>a<0?[]:[situations[i]!.traits[a]!]);
 const look:Partial<Look>={hair:hair as Look["hair"],top:color as Look["top"],bottom:"Sand",carrying:"Satchel",skin:1};
 const ready=step===0?!!person.name.trim()&&age>=16&&age<=99:step===1?(answers[question] ?? -1)>=0:step===2?!!person.dream.trim():true;
 const change=(key:keyof typeof person,value:string)=>setPerson(p=>({...p,[key]:value}));
 const forward=()=>{if(integrated&&step===3){onComplete?.(draft);return;}if(step===1&&question<4)setQuestion(question+1);else setStep(Math.min(4,step+1));};
 const back=()=>{if(step===1&&question>0)setQuestion(question-1);else setStep(Math.max(0,step-1));};
 const scenes=[
  {time:"08:20 / ARRIVAL",title:`A place for ${name.toLowerCase()==="you"?"you":name}.`,body:answers[0]===0?"At the harbor, you introduce yourself to the table before your suitcase touches the ground.":answers[0]===1?"You skip the crowded table. Later, a quiet conversation with the innkeeper feels like a better beginning.":"You take the long way to the inn, learning the island on your own terms."},
  {time:"14:10 / A POSSIBILITY",title:"An ordinary moment. A possible beginning.",body:`You notice an empty shop. Your wish — “${person.dream}” — makes you stop. ${answers[2]===0?"You ask who owns it.":answers[2]===1?"You begin a list of what you would need.":"You keep walking, but remember the address."}`},
  {time:"21:45 / A LETTER HOME",title:"Some things came with you.",body:`“I caught myself doing it again: ${person.habit.toLowerCase()}. A new island, same little ritual. I wonder what else will follow me here.”`},
 ];
 return <main className={s.page}>
  <header className={s.header}><Link href="/" aria-label="Unwatched home"><Wordmark/></Link><span>ANOTHER LIFE <i/> {integrated?"YOUR BEGINNING":"LOCAL STUDY 01"}</span><Link href={integrated?"/":"/board"}>{integrated?"Back to the island":"Exit preview"} ↗</Link></header>
  <nav className={s.progress} aria-label="Your story"><ol>{(integrated?[...stages.slice(0,4),"Your appearance","Your mind","Boarding"]:stages).map((label,i)=><li key={label} aria-current={(activeStep??step)===i?"step":undefined} data-active={(activeStep??step)===i} data-complete={(activeStep??step)>i}><span>{String(i+1).padStart(2,"0")}</span>{label}</li>)}</ol><span>{integrated?"Draft saved on this device":"No account needed · Nothing is sent"}</span></nav>
  <div className={s.layout}>
   <aside className={s.portrait}><div className={s.portraitTop}><span>ONE PERSON. AN OPEN FUTURE.</span><span>↗</span></div><div className={s.orbit}/><LookPreview name={name} age={continuation?.age??age} look={continuation?.look??look} pose={continuation?.pose??(step===4?"walk":"idle")} className={s.character}/><div className={s.identity}><span>{mode==="self"?"YOU, SOMEWHERE ELSE":"SOMEONE NEW"}</span><h2>{name}{step<4&&<span className={s.dot}>.</span>}</h2><p>{continuation?.dream || person.dream || "A familiar soul. An unfamiliar shore."}</p></div><div className={s.traits} aria-live="polite">{traits.length?traits.slice(-3).map(t=><span key={t}>{t}</span>):<p>Your choices will leave their mark here.</p>}</div><footer>Personality is a beginning.<br/>What happens next belongs to them.</footer></aside>
   <section className={s.panel}>
    {continuation ? <div key={continuation.index} className={`${s.enter} ${s.continuation}`}>{continuation.content}</div> : <><div key={`${step}-${question}`} className={s.enter}>
    <div className={s.eyebrow}>{step===1?`YOUR INSTINCTS / ${question+1} OF 5`: `CHAPTER ${String(step+1).padStart(2,"0")}`}</div>
    <h1 ref={heading} tabIndex={-1}>{step===0?<>What if you could<br/><em>begin again?</em></>:step===1?situations[question]!.title:step===2?<>The things that<br/>make you, <em>you.</em></>:step===3?<>Does this<br/>feel like <em>you?</em></>:<>Same you.<br/><em>Another life.</em></>}</h1>
    <p className={s.intro}>{step===0?"Bring your habits, your contradictions, that thing you’ve always wanted to try. See who you become on the island.":step===1?situations[question]!.detail:step===2?"Not a perfect version. A recognizable one. A few words is enough. Strength, flaw and ritual are optional. Your name and persona will be visible on the island; avoid sensitive real-life details.":step===3?"This is a starting portrait, not a psychological assessment. Correct anything that doesn’t fit.":"An illustrated possibility based on your answers. This is a scripted preview, not a live simulation."}</p>
    {step===0&&<><div className={s.modes}>{[["self","Myself, elsewhere","Start with the person I know best."],["invented","Someone imagined","Give a new person a beginning."]].map(([id,title,desc])=><button key={id} aria-pressed={mode===id} onClick={()=>setMode(id!)}><span className={s.radio}/><div><strong>{title}</strong><small>{desc}</small></div></button>)}</div><label className={s.field}>What should we call you?<input maxLength={40} value={person.name} onChange={e=>change("name",e.target.value)} placeholder="A name, or a nickname" autoComplete="off"/></label><label className={s.field}>Age on the island<input type="number" min={16} max={99} value={age} onChange={e=>setAge(Number(e.target.value))}/></label><p className={s.note}>About 3 minutes. No right answers.</p></>}
    {step===1&&<><div className={s.questions}>{situations[question]!.answers.map((a,i)=><button key={a} aria-pressed={answers[question]===i} onClick={()=>setAnswers(old=>old.map((v,j)=>j===question?i:v))}><span>{String.fromCharCode(65+i)}</span><strong>{a}</strong><span className={s.radio}/></button>)}</div><div className={s.questionProgress}>{situations.map((_,i)=><span key={i} data-done={(answers[i] ?? -1)>=0}/>)}</div><p className={s.note}>Pick what feels closest. You can go back and change it.</p></>}
    {step===2&&<div className={s.fields}>{([['strength','Something you’re good at','Making people feel welcome'],['flaw','Something that gets in your way','I say yes to too many things'],['habit','A little ritual you bring everywhere','Coffee alone before anyone wakes up'],['dream','If you could start again…','I would open a tiny bookshop by the sea']] as const).map(([key,label,placeholder])=><label key={key} className={s.field}>{label}<input maxLength={key==="strength"?120:160} value={person[key]} onChange={e=>change(key,e.target.value)} placeholder={placeholder}/></label>)}</div>}
    {step===3&&<><div className={s.reflection}><span>A FIRST PORTRAIT / {name.toUpperCase()}</span><p>{traits[0]}. {traits[1]}. You bring <b>{person.strength.toLowerCase() || "strengths still to discover"}</b>, but <b>{person.flaw.toLowerCase() || "room to grow"}</b> is part of your starting story.</p><p>Your familiar ritual: {person.habit.toLowerCase() || "still to discover"}. Somewhere in the back of your mind: <b>{person.dream.toLowerCase()}</b>.</p></div><label className={s.field}>What else should this portrait say? <small>Optional</small><textarea maxLength={300} value={note} onChange={e=>setNote(e.target.value)} placeholder="There’s another side to me…"/></label><div className={s.appearance}>{!integrated&&<><label>Hair<select value={hair} onChange={e=>setHair(e.target.value)}>{["Bob","Short dark","Curls","Bun","Grey","Under a hat"].map(v=><option key={v}>{v}</option>)}</select></label><label>Clothing<select value={color} onChange={e=>setColor(e.target.value)}>{["Teal","Sage","Cream","Sand","Kelp"].map(v=><option key={v}>{v}</option>)}</select></label></>}<button onClick={()=>{setStep(2);}}>Edit my details ↗</button></div></>}
    {step===4&&<><div className={s.timeline} role="group" aria-label="Preview time of day">{["Morning","Afternoon","Evening"].map((v,i)=><button key={v} aria-pressed={day===i} onClick={()=>setDay(i)}>{v}</button>)}</div><article key={day} className={`${s.story} ${s.enter}`} aria-live="polite"><span>{scenes[day]!.time}</span><h2>{scenes[day]!.title}</h2><p>{scenes[day]!.body}</p></article>{note&&<p className={s.note}>Your addition to the portrait: “{note}”</p>}<p className={s.note}>In the full experience, your citizen will make their own choices. No citizen has been created here.</p></>}
    </div>
    <footer className={s.controls}><button onClick={back} disabled={step===0}>← Back</button>{step<4?<button className={s.primary} disabled={!ready} onClick={forward}>{step===0?"Meet yourself":step===3?(integrated?"Next, my appearance":"Imagine my first day"):"Continue"}<span>↗</span></button>:<button className={s.primary} onClick={()=>{setStep(0);setQuestion(0);}}>Revisit my beginning <span>↗</span></button>}</footer></>}
   </section>
  </div>
 </main>;
}
