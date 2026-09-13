"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect,useState } from "react";
import s from "./comparison.module.css";
const SpinePreview=dynamic(()=>import("./SpinePreview"),{ssr:false,loading:()=> <p className={s.loading}>Preparing Spine…</p>});
const ThreePreview=dynamic(()=>import("./ThreePreview"),{ssr:false,loading:()=> <p className={s.loading}>Preparing Three.js…</p>});
export type PreviewProps={playing:boolean;animation:string;speed:number;debug:boolean;wide:boolean;smile:number;onReady:()=>void;onError:()=>void};
export default function Comparison(){
 const [mode,setMode]=useState<"spine"|"three">("spine"),[playing,setPlaying]=useState(false),[animation,setAnimation]=useState("idle"),[speed,setSpeed]=useState(1),[debug,setDebug]=useState(false),[wide,setWide]=useState(false),[smile,setSmile]=useState(.7),[ready,setReady]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{setPlaying(!matchMedia("(prefers-reduced-motion: reduce)").matches);},[]);
 const choose=(next:"spine"|"three")=>{if(next===mode)return;setMode(next);setAnimation("idle");setDebug(false);setReady(false);setError(false);};
 const props={playing,animation,speed,debug,wide,smile,onReady:()=>setReady(true),onError:()=>setError(true)};
 return <main className={s.page}>
 <header className={s.header}><Link href="/">unwatched</Link><Link href="/experiments/characters/harbor/painted">Mara · rebuilt motion rig</Link></header>
 <div className={s.intro}><div><span className={s.eyebrow}>Character lab · Local prototypes</span><h1>How should life move?</h1></div><p>Two different tools. Two different possibilities.<br/>Move them. Look closer. Decide what feels alive.</p></div>
 <nav className={s.tabs} aria-label="Rendering technology"><button aria-pressed={mode==="spine"} onClick={()=>choose("spine")}><span>01</span> Spine + PixiJS <small>Illustrated · 2D</small></button><button aria-pressed={mode==="three"} onClick={()=>choose("three")}><span>02</span> Blender + Three.js <small>Sculpted · 3D</small></button></nav>
 <div className={s.stage}>
 {mode==="spine"?<SpinePreview {...props}/>:<ThreePreview {...props}/>}
 <div className={s.stageLabel}>{mode==="spine"?"Spineboy · Official sample artwork":"Unwatched citizen · Blender blockout"}</div>
 {(!ready||error)&&<p role="status" className={s.loading}>{error?"The preview could not load. Refresh to try again.":"Loading the character…"}</p>}
 <div className={s.stageHint}>{mode==="three"?"Drag to orbit · Scroll to zoom":"Watch the overlap in the arms, hair and clothing"}</div>
 </div>
 <div className={s.toolbar}><button className={s.primary} onClick={()=>setPlaying(!playing)} disabled={!ready}>{playing?"Pause":"Play"}</button><div className={s.group} aria-label="Animation">{(mode==="spine"?["idle","walk","run","jump"]:["idle","walk","wave"]).map(name=><button key={name} aria-pressed={animation===name} onClick={()=>setAnimation(name)}>{name}</button>)}</div><div className={s.group}><button aria-pressed={wide} onClick={()=>setWide(!wide)}>{wide?"Close up":"Town scale"}</button><button aria-pressed={debug} onClick={()=>setDebug(!debug)}>Skeleton</button></div></div>
 <div className={s.sliders}><label>Playback speed <input type="range" min=".25" max="1.5" step=".25" value={speed} onChange={e=>setSpeed(Number(e.target.value))}/><output>{speed}×</output></label>{mode==="three"&&<label>Expression <input aria-label="Smile intensity" type="range" min="0" max="1" step=".05" value={smile} onChange={e=>setSmile(Number(e.target.value))}/><output>{smile>.5?"Smile":"Subtle"}</output></label>}</div>
 <section className={s.explanation}><h2>{mode==="spine"?"Keep the illustration. Give it motion.":"A citizen you can walk around."}</h2><div>{mode==="spine"?<><p>Authored skeletal animation, flexible meshes and blended transitions. This is the official Spineboy sample running in PixiJS, with its original art and animation.</p><p>For Unwatched, we would draw and rig our own citizens. This sample demonstrates the tool; its polish comes from its artists and animators.</p><p className={s.credit}><a href="https://esotericsoftware.com/spine-examples-spineboy" target="_blank" rel="noreferrer">Spineboy by Esoteric Software</a> · <a href="https://esotericsoftware.com/spine-runtimes-license" target="_blank" rel="noreferrer">Separate runtime/editor license</a>. Evaluation only; this page is disabled in production.</p></>:<><p>An original character assembled and rigged in Blender, exported as a GLB and animated here in Three.js. Rotate the view to judge its volume, lighting and silhouette.</p><p>This is an early sculptural blockout with idle, walk and wave motion, plus a smile shape key. It needs an art and animation pass before it represents a finished citizen.</p><p className={s.credit}><a href="/studies/blender-citizen.blend" download>Editable Blender source</a> · <a href="/studies/blender-citizen.glb" download>Animated GLB</a>. Created for this comparison. No live agents or AI calls in this preview.</p></>}</div></section>
 <p className={s.note}>These are different assets at different levels of finish—not a performance benchmark. Compare the possibilities, then we can make a matching character in the direction you choose.</p>
 </main>
}
