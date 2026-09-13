"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Application,Assets,Graphics} from 'pixi.js';
import {Spine,SpineDebugRenderer} from '@esotericsoftware/spine-pixi-v8';
import s from '../compare/comparison.module.css';
export default function JointLab(){
 const [elbow,setElbow]=useState(0),[wrist,setWrist]=useState(0),[debug,setDebug]=useState(false),[error,setError]=useState(false);
 const host=useRef<HTMLDivElement>(null),state=useRef({elbow,wrist,debug}),draw=useRef(()=>{});state.current={elbow,wrist,debug};
 useEffect(()=>draw.current(),[elbow,wrist,debug]);
 useEffect(()=>{
  let app:Application|undefined,observer:ResizeObserver|undefined,disposed=false;
  const el=host.current!;
  void(async()=>{
   const a=new Application();await a.init({backgroundAlpha:0,antialias:true,autoDensity:true,resolution:Math.min(devicePixelRatio,2)});
   if(disposed){a.destroy({removeView:true,releaseGlobalResources:false},{children:true});return;}app=a;el.appendChild(a.canvas);a.stop();
   await Assets.load(['/characters/joint-lab/arm.json','/characters/joint-lab/arm.atlas']);if(disposed)return;
   const people=['plain','supported'].map(skin=>{const p=Spine.from({skeleton:'/characters/joint-lab/arm.json',atlas:'/characters/joint-lab/arm.atlas',autoUpdate:false});p.skeleton.setSkinByName(skin);p.skeleton.setSlotsToSetupPose();a.stage.addChild(p);return p;});
   const debugs=people.map(()=>{const d=new SpineDebugRenderer();d.drawBones=true;d.drawMeshTriangles=true;d.drawMeshHull=true;d.drawRegionAttachments=false;return d;});
   const divider=new Graphics();a.stage.addChild(divider);
   draw.current=()=>{
    const {elbow,wrist,debug}=state.current,w=el.clientWidth,h=el.clientHeight;a.renderer.resize(w,h);
    const scale=Math.min((h-80)/2550,w/5400);
    people.forEach((p,i)=>{
     p.skeleton.setToSetupPose();const f=p.skeleton.findBone('fore')!,hand=p.skeleton.findBone('hand')!,support=p.skeleton.findBone('elbow-support')!;
     f.rotation=f.data.rotation+elbow;hand.rotation=hand.data.rotation+wrist;support.rotation=support.data.rotation+elbow/2;
     p.debug=debug?debugs[i]:undefined;p.scale.set(scale);p.position.set(w*(i===0?.13:.63),60);p.update(0);
    });
    divider.clear().moveTo(w/2,15).lineTo(w/2,h-15).stroke({width:1,color:0x9da792,alpha:.5});a.render();
   };
   observer=new ResizeObserver(()=>draw.current());observer.observe(el);draw.current();
  })().catch(e=>{console.error('Joint lab',e);if(!disposed)setError(true);});
  return()=>{disposed=true;draw.current=()=>{};observer?.disconnect();app?.destroy({removeView:true,releaseGlobalResources:false},{children:true});};
 },[]);
 return <main className={s.page}>
  <header className={s.header}><Link href="/experiments/characters/harbor/painted">← Mara V4</Link><span>Isolated rig research · no production changes</span></header>
  <div className={s.intro}><div><span className={s.eyebrow}>One joint at a time</span><h1>Before it joins the body.</h1></div><p>Same artwork. Same proportions.<br/>Left: two-bone blending. Right: elbow support bone.</p></div>
  <div className={s.stage}><div ref={host} className={s.host} role="img" aria-label="Side-by-side elbow deformation comparison"/>{error&&<p className={s.loading}>The study could not load.</p>}<div className={s.stageLabel}>Source proportions preserved · measured pivots</div></div>
  <div className={s.toolbar}><div className={s.group}>{[0,45,90,120].map(n=><button key={n} aria-pressed={elbow===n} onClick={()=>setElbow(n)}>{n===0?'Rest pose':`${n}° elbow`}</button>)}</div><button aria-pressed={debug} onClick={()=>setDebug(!debug)}>Show mesh & bones</button></div>
  <div className={s.sliders}><label>Elbow<input aria-label="Elbow angle" type="range" min="0" max="120" value={elbow} onChange={e=>setElbow(+e.target.value)}/><output>{elbow}°</output></label><label>Wrist<input aria-label="Wrist angle" type="range" min="-25" max="25" value={wrist} onChange={e=>setWrist(+e.target.value)}/><output>{wrist}°</output></label></div>
  <section className={s.explanation}><h2>A test, not a new character.</h2><div><p>This reuses an existing generated arm to inspect binding and volume. It does not establish Mara’s final artwork or shoulder fit. Both versions must reproduce the source image in rest pose before bend quality is judged.</p><p>Landmarks are manually estimated. The support bone follows half the elbow rotation. This is a candidate construction to inspect, not a guarantee of anatomical correctness.</p><p><a href="https://esotericsoftware.com/blog/Mesh-creation-tips-vertex-placement">Spine mesh placement</a> · <a href="https://esotericsoftware.com/forum/d/7673-best-practices-for-rigging-mesh-joints">Spine joint-volume discussion</a></p></div></section>
 </main>;
}
