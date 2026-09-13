"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { Citizen, type Look } from "@/components/world/citizen";
import s from "./study.module.css";

const beats = [
  [0, "Someone familiar.", "A different pace for each citizen. Their steps follow the distance travelled, and slow as they approach."],
  [3, "A moment of recognition.", "They settle before the exchange. Attention shifts to the other person, with a small nod in reply."],
  [5, "An offer. A little hesitation.", "The giver extends a parcel. The other citizen takes a moment, then reaches for the same point in space."],
  [8, "The smallest act of kindness.", "The parcel changes hands at contact. A brighter expression and a quiet response follow the gesture."],
  [11, "And life continues.", "The receiver carries the parcel away. A brief pause gives the encounter a little room to end."],
] as const;
const ease = (t: number) => { const v = Math.max(0, Math.min(1, t)); return v*v*(3-2*v); };
export default function Encounter() {
  const host = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [wide, setWide] = useState(false);
  const [error, setError] = useState(false);
  const state = useRef({ playing, wide }); state.current = { playing, wide };
  const clock = useRef(0), seek = useRef((_:number) => {}), wake = useRef(() => {});
  useEffect(() => { setPlaying(!matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => wake.current(), [playing, wide]);
  useEffect(() => {
    if (!host.current) return;
    const el = host.current;
    let disposed = false, app: Application | undefined, resize: ResizeObserver | undefined, visibility: IntersectionObserver | undefined;
    const onVisibility = () => wake.current();
    void (async () => {
      const a = new Application();
      try { await a.init({ backgroundAlpha:0, antialias:true, resolution:Math.min(devicePixelRatio,2), autoDensity:true }); }
      catch { if (!disposed) setError(true); return; }
      if (disposed) { a.destroy({removeView:true,releaseGlobalResources:false},{children:true}); return; }
      app=a; el.appendChild(a.canvas);
      const scene = new Container(); a.stage.addChild(scene);
      const ground = new Graphics(); scene.addChild(ground);
      ground.ellipse(130,144,180,30).fill(0xcbd3bb);
      ground.roundRect(-100,136,460,24,12).fill(0xe8dfc8);
      for (let i=0;i<32;i++) ground.circle(-85+i*14,143+(i%3)*4,.6).fill({color:0x9f9f86,alpha:.35});
      const look: Look = { build:"Average",hair:"Bun",hairColor:"Brown",top:"Cream",bottom:"Teal",hat:"None",carrying:"Nothing",beard:"None",skin:0xb98460,coral:"Buttons" };
      const giver = new Citizen(look,.3), receiver = new Citizen({...look,build:"Tall",hair:"Short dark",hairColor:"Fair",top:"Sage",bottom:"Kelp",skin:0xe7c3a5,coral:"None"},1.7);
      giver.age(32); receiver.age(38); scene.addChild(giver,receiver);
      const parcel = new Graphics().roundRect(-4,-3,8,6,1).fill(0xc98d51).stroke({color:0x6c664a,width:.5}).moveTo(0,-3).lineTo(0,3).stroke({color:0xf2e8cc,width:1}); scene.addChild(parcel);
      let previous = 0, oldA = 43, oldB = 211, visible = true;
      const draw = () => {
        const t = clock.current, departure = ease((t-11.5)/3.5);
        const xA = 43+66*ease(t/3)-65*departure, xB = 211-60*ease(t/3.2)+64*departure;
        const moving = t < 3.2 || t > 11.5;
        giver.position.set(xA,140); receiver.position.set(xB,140);
        giver.face(t>11.5 ? -1:1); receiver.face(t>11.5 ? 1:-1);
        giver.setPose(moving ? "walk" : t>8.7&&t<9.7 ? "talk":"idle");
        receiver.setPose(moving ? "walk" : t>9.8&&t<10.8 ? "talk":"idle");
        giver.travel(Math.abs(xA-oldA)); receiver.travel(Math.abs(xB-oldB)); oldA=xA;oldB=xB;
        giver.lookAt(t<11.5?45:0); receiver.lookAt(t<11.5?35:0);
        giver.mood({joy:.12+.35*ease((t-8)/1.5)}); receiver.mood({joy:.5*ease((t-8)/1.2),surprise:.25*(ease((t-5)/.5)-ease((t-7)/.5))});
        if (t>=3.7&&previous<3.7) receiver.glance(.13,40);
        if (t>=8.5&&previous<8.5) giver.glance(-.08,40);
        giver.update(t); receiver.update(t);
        // Both wrists meet here. Blend into the target before contact, then carry
        // the object on its new owner's wrist while the arms recover.
        const target=scene.toGlobal({x:130,y:101});
        const offer=ease((t-5)/1.4)*(1-ease((t-8.4)/1.2));
        const accept=ease((t-6.8)/1.2)*(1-ease((t-8.4)/1.4));
        giver.reachFor("right",target,offer); receiver.reachFor("right",target,accept);
        const owner=t<8.15?giver:receiver;
        const wrist=scene.toLocal(owner.wrist("right")); parcel.position.set(wrist.x,wrist.y);
        previous=t;
      };
      const layout=()=>{
        const w=el.clientWidth,h=el.clientHeight; a.renderer.resize(w,h);
        const scale=Math.min(w/(w<600?200:260),h/170)*(state.current.wide?.5:1);
        scene.scale.set(scale);scene.position.set(w/2-130*scale,h/2-90*scale);
        draw();a.render();
      };
      seek.current=(t)=>{clock.current=t;previous=t;oldA=43+66*ease(t/3)-65*ease((t-11.5)/3.5);oldB=211-60*ease(t/3.2)+64*ease((t-11.5)/3.5);draw();a.render();setTime(t);};
      a.ticker.maxFPS=60; let published=-1;
      a.ticker.add(tick=>{clock.current=Math.min(15,clock.current+tick.deltaMS/1000);draw();const tenth=Math.floor(clock.current*10);if(tenth!==published){setTime(clock.current);published=tenth;}if(clock.current>=15){setPlaying(false);a.stop();}});
      wake.current=()=>{layout();if(state.current.playing&&visible&&!document.hidden)a.start();else a.stop();};
      resize=new ResizeObserver(layout);resize.observe(el);
      visibility=new IntersectionObserver(([entry])=>{visible=!!entry?.isIntersecting;wake.current();});visibility.observe(el);
      document.addEventListener("visibilitychange",onVisibility);wake.current();
    })();
    return()=>{disposed=true;wake.current=()=>{};seek.current=()=>{};resize?.disconnect();visibility?.disconnect();document.removeEventListener("visibilitychange",onVisibility);app?.destroy({removeView:true,releaseGlobalResources:false},{children:true});};
  }, []);
  const beat = [...beats].reverse().find(b=>time>=b[0])!;
  return <main className={s.page}>
    <header className={s.header}><Link href="/">unwatched</Link><Link href="/experiments/characters/compare">Compare Spine &amp; 3D</Link></header>
    <div className={s.intro}><div><span className={s.eyebrow}>Motion study · 01</span><h1>A small encounter.</h1></div><p>Two lives cross for a moment.<br/>The story is in how they move.</p></div>
    <div className={s.stage}><div ref={host} className={s.canvas} role="img" aria-label="Animated study of two citizens meeting and exchanging a parcel"/><span className={s.label}>{wide?"Town scale":"Close observation"} · Illustrative scene</span>{error&&<p className={s.error}>This browser could not start the animation. Try refreshing or another browser.</p>}</div>
    <div className={s.controls}><button className={s.primary} onClick={()=>{if(time>=15)seek.current(0);setPlaying(!playing);}}>{playing?"Pause":time>=15?"Play again":"Play"}</button><button onClick={()=>{seek.current(0);setPlaying(true);}}>Replay</button><span className={s.spacer}/><button aria-pressed={!wide} onClick={()=>setWide(false)}>Close up</button><button aria-pressed={wide} onClick={()=>setWide(true)}>Town scale</button></div>
    <label className={s.timeline}><span>{time.toFixed(1)}s</span><input aria-label="Scrub encounter" type="range" min="0" max="15" step=".05" value={time} onChange={e=>{setPlaying(false);seek.current(Number(e.target.value));}}/><span>15s</span></label>
    <div className={s.caption}><h2>{beat[1]}</h2><p>{beat[2]}</p></div>
    <p className={s.note}>Scripted animation preview using the island’s existing character rig. No live agent decisions or AI calls. Use the timeline to inspect the exchange.</p>
  </main>;
}
