"use client";
import { useEffect,useRef } from "react";
import { Application,Assets,Graphics } from "pixi.js";
import { Spine,SpineDebugRenderer } from "@esotericsoftware/spine-pixi-v8";
import type { HarborProps } from "./HarborStudy";
import s from "../compare/comparison.module.css";

const ease=(n:number)=>{const t=Math.min(1,Math.max(0,n));return t*t*(3-2*t);};
export default function HarborScene(props:HarborProps){
 const host=useRef<HTMLDivElement>(null),state=useRef(props),wake=useRef(()=>{});state.current=props;
 useEffect(()=>wake.current(),[props.detail,props.phase,props.motion,props.view,props.variant,props.playing,props.wide,props.debug,props.smile,props.speed,props.replay]);
 useEffect(()=>{
 const el=host.current;if(!el)return;
 const painted=props.painted;const base=props.candidate?"/characters/mara-arm-candidate/mara":painted?"/characters/mara-painted/mara":"/characters/harbor-spine/harbor";
 let disposed=false,app:Application|undefined,resize:ResizeObserver|undefined,observer:IntersectionObserver|undefined;
 const visibility=()=>wake.current();
 void(async()=>{
  const a=new Application();
  try{
   await a.init({backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true});
   if(disposed){a.destroy({removeView:true,releaseGlobalResources:false},{children:true});return;}app=a;el.appendChild(a.canvas);a.stop();
   await Assets.load([base+".json",base+".atlas"]);if(disposed)return;
   const ground=new Graphics();a.stage.addChild(ground);
   const people=[0,1].map(()=>Spine.from({skeleton:base+".json",atlas:base+".atlas",autoUpdate:false}));people.forEach(p=>{p.state.data.defaultMix=.22;a.stage.addChild(p);});
   const parcel=new Graphics().roundRect(-4,-3,8,6,1).fill(0xc49863).stroke({width:.5,color:0x6c664a}).moveTo(0,-3).lineTo(0,3).stroke({width:.8,color:0xeee2c5});a.stage.addChild(parcel);
   const debugs=people.map(()=>{const d=new SpineDebugRenderer();d.drawBones=true;d.drawMeshTriangles=false;d.drawMeshHull=false;d.drawPaths=false;d.drawBoundingBoxes=false;d.drawRegionAttachments=false;d.drawClipping=false;d.drawEvents=false;return d;});
   const skins=["",""],motions=["",""],debugState=[false,false];let lastPhase=0,clock=0,lastReplay=-1,lastMode="",visible=true;
   const draw=(dt:number)=>{
    const p=state.current;const encounter=p.motion==="encounter";
    if(lastReplay!==p.replay||lastMode!==p.motion){clock=p.playing?0:(p.phase??0)*(p.motion==="walk"?1.2:2);lastReplay=p.replay;lastMode=p.motion;}
    if(p.phase!==undefined&&lastPhase!==p.phase){clock=p.phase*(p.motion==="walk"?1.2:2);lastPhase=p.phase;}
    clock+=dt*p.speed;const t=clock%16;
    const w=el.clientWidth,h=el.clientHeight,scale=Math.min((h-105)/90,w/(encounter?220:120))*(p.detail?2.6:p.wide?.5:1),feet=p.detail?h*.09+84*scale:h*.82;
    const arrival=ease(t/3),departure=ease((t-12)/3);
    const xs=encounter?[w/2+(-80+55*arrival-55*departure)*scale,w/2+(80-55*arrival+55*departure)*scale]:[w/2,w/2];
    ground.clear().ellipse(w/2,feet+5,Math.min(w*.4,300),22).fill({color:0x879574,alpha:.17});
    if(p.motion==="sit")ground.roundRect(w/2-20*scale,feet-(painted?18:21)*scale,40*scale,3*scale,scale).fill(0x9b825c).rect(w/2-17*scale,feet-(painted?15:18)*scale,2*scale,(painted?15:18)*scale).rect(w/2+15*scale,feet-(painted?15:18)*scale,2*scale,(painted?15:18)*scale).fill(0x7b7055);
    people.forEach((person,i)=>{
      person.visible=i===0||encounter;if(!person.visible)return;
      const view=encounter?"side":p.view;
      const skin=painted?"mara-painted":(i===0?p.variant:p.variant==="ivo"?"mara":"ivo")+"-"+view;
      if(skins[i]!==skin){person.skeleton.setSkinByName(skin);person.skeleton.setSlotsToSetupPose();skins[i]=skin;}
      const move=encounter?(t<3||t>12?"walk":t<5?"listen":t<9?"offer":i===0?"talk":"listen"):p.motion;
      if(motions[i]!==move){if(!p.playing){person.state.clearTracks();person.skeleton.setToSetupPose();}person.state.setAnimation(0,move,true);motions[i]=move;}
      if(debugState[i]!==p.debug){person.debug=p.debug?debugs[i]:undefined;debugState[i]=p.debug;}
      const facing=encounter?(i===0?(t>12?-1:1):(t>12?1:-1)):1;
      person.scale.set(scale*facing,scale);person.position.set(xs[i]!,feet);
      person.beforeUpdateWorldTransforms=()=>{
        for(const side of ["far","near"])person.skeleton.findIkConstraint("plant-"+side)!.mix=move==="walk"?1:0;
        const constraint=person.skeleton.findIkConstraint("reach")!;
        constraint.mix=encounter?(i===0?ease((t-5)/1.3):ease((t-6.7)/1.3))*(1-ease((t-8.5)/1.3)):0;
        const target=person.skeleton.findBone("hand-target")!;target.x=(w/2-person.x)/(scale*facing);target.y=51;
        if(painted){
          person.skeleton.setAttachment("arm-art-near",move==="wave"?"wave-arm":"arm-art-near");
          const calibrated=!!p.candidate&&move==="wave";
          person.skeleton.findSlot("arm-art-near")!.color.a=calibrated?0:1;
          person.skeleton.findSlot("wave-hand")!.color.a=move==="wave"&&!calibrated?1:0;
          if(p.candidate){person.skeleton.findSlot("cal-arm")!.color.a=calibrated?1:0;const fore=person.skeleton.findBone("cal-fore")!,support=person.skeleton.findBone("cal-elbow")!;support.rotation=support.data.rotation+(fore.rotation-fore.data.rotation)/2;}
          const blink=(clock+i*.73)%4.1>3.95;
          const talking=move==="talk"&&Math.sin(clock*16)>.15;
          person.skeleton.setAttachment("face",blink?"blink":talking?"talk":p.smile?"smile":"neutral");

        }else if(move!=="talk")person.skeleton.setAttachment("mouth",p.smile?"smile":"mouth");
        // Keep listening alive without asking the agent for animation frames.
        if(move!=="idle"){const eyes=person.skeleton.findBone("eyes")!;eyes.scaleY=(clock+i*.73)%4.1>3.95?.12:1;}
      };
      if(encounter&&move==="walk"){
        const travel=t<3?55*arrival:55*departure;
        const track=person.state.getCurrent(0);if(track)track.trackTime=travel/28*1.2;
      }
      if(!encounter){
        if(!p.playing&&person.state.getCurrent(0)?.mixingFrom){person.state.clearTracks();person.skeleton.setToSetupPose();person.state.setAnimation(0,move,true);}
        const track=person.state.getCurrent(0);if(track)track.trackTime=clock;
      }
      person.update(dt*p.speed);
    });
    parcel.visible=encounter;parcel.scale.set(scale);
    if(encounter){const owner=people[t<8.2?0:1]!;const hand=owner.skeleton.findBone("hand-near")!;const point=owner.toGlobal({x:hand.worldX,y:hand.worldY});parcel.position.set(point.x,point.y);}
   };
   const layout=()=>{a.renderer.resize(el.clientWidth,el.clientHeight);draw(0);a.render();};
   a.ticker.maxFPS=60;a.ticker.add(t=>draw(Math.min(t.deltaMS/1000,.05)));
   wake.current=()=>{layout();if(state.current.playing&&visible&&!document.hidden)a.start();else a.stop();};
   resize=new ResizeObserver(layout);resize.observe(el);observer=new IntersectionObserver(([e])=>{visible=!!e?.isIntersecting;wake.current();});observer.observe(el);document.addEventListener("visibilitychange",visibility);wake.current();state.current.onReady();
  }catch(e){console.error("Harbor rig preview",e);if(!disposed)state.current.onError();}
 })();
 return()=>{disposed=true;wake.current=()=>{};resize?.disconnect();observer?.disconnect();document.removeEventListener("visibilitychange",visibility);app?.destroy({removeView:true,releaseGlobalResources:false},{children:true});};
 },[]);
 return <div ref={host} className={s.host} role="img" aria-label="Original Unwatched citizens animated with Spine"/>;
}
