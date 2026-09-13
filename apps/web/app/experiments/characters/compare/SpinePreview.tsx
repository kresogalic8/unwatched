"use client";
import { useEffect,useRef } from "react";
import { Application,Assets,Graphics } from "pixi.js";
import { Spine,SpineDebugRenderer } from "@esotericsoftware/spine-pixi-v8";
import type { PreviewProps } from "./Comparison";
import s from "./comparison.module.css";
const base="https://esotericsoftware.com/files/examples/4.2/spineboy/export/";
export default function SpinePreview(props:PreviewProps){
 const host=useRef<HTMLDivElement>(null),state=useRef(props),wake=useRef(()=>{});state.current=props;
 useEffect(()=>wake.current(),[props.playing,props.animation,props.speed,props.debug,props.wide]);
 useEffect(()=>{
  const el=host.current;if(!el)return;
  let disposed=false,app:Application|undefined,resize:ResizeObserver|undefined,observer:IntersectionObserver|undefined;
  const visibility=()=>wake.current();
  void(async()=>{
   const a=new Application();
   try{
    await a.init({backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true});
    if(disposed){a.destroy({removeView:true,releaseGlobalResources:false},{children:true});return;}
    app=a;el.appendChild(a.canvas);a.stop();
    await Assets.load([base+"spineboy-pro.skel",base+"spineboy-pma.atlas"]);
    if(disposed)return;
    const floor=new Graphics();a.stage.addChild(floor);
    const citizen=Spine.from({skeleton:base+"spineboy-pro.skel",atlas:base+"spineboy-pma.atlas",autoUpdate:false});
    citizen.state.data.defaultMix=.25;a.stage.addChild(citizen);
    const debug=new SpineDebugRenderer();debug.drawBones=true;debug.drawMeshTriangles=false;debug.drawMeshHull=false;debug.drawRegionAttachments=false;debug.drawPaths=false;debug.drawBoundingBoxes=false;debug.drawClipping=false;debug.drawEvents=false;
    let lastAnimation="",lastDebug=false,visible=true;
    const sync=()=>{
     const p=state.current;
     if(lastAnimation!==p.animation){citizen.state.setAnimation(0,p.animation,true);lastAnimation=p.animation;}
     if(lastDebug!==p.debug){citizen.debug=p.debug?debug:undefined;lastDebug=p.debug;}
     const w=el.clientWidth,h=el.clientHeight;
     a.renderer.resize(w,h);
     const scale=Math.min((h-100)/740,(w-70)/650)*(p.wide?.48:1);
     citizen.scale.set(scale);citizen.position.set(w*.5,h*.82);
     floor.clear().ellipse(w*.5,h*.82+5,Math.min(w*.36,220),18).fill({color:0x7c8e6c,alpha:.2});
     citizen.update(0);a.render();
    };
    a.ticker.maxFPS=60;a.ticker.add(t=>citizen.update(t.deltaMS/1000*state.current.speed));
    wake.current=()=>{sync();if(state.current.playing&&visible&&!document.hidden)a.start();else a.stop();};
    resize=new ResizeObserver(()=>wake.current());resize.observe(el);
    observer=new IntersectionObserver(([e])=>{visible=!!e?.isIntersecting;wake.current();});observer.observe(el);
    document.addEventListener("visibilitychange",visibility);wake.current();state.current.onReady();
   }catch{if(!disposed)state.current.onError();}
  })();
  return()=>{disposed=true;wake.current=()=>{};resize?.disconnect();observer?.disconnect();document.removeEventListener("visibilitychange",visibility);app?.destroy({removeView:true,releaseGlobalResources:false},{children:true});};
 },[]);
 return <div className={s.host} ref={host} role="img" aria-label="Official Spineboy character animated by Spine in PixiJS"/>;
}
