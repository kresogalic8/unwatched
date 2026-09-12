"use client";
import { useEffect, useRef } from "react";
import { Application, Container } from "pixi.js";
import { Citizen, type Look } from "@/components/world/citizen";
import { loadWorldArt, drawThing } from "@/components/world/buildings";
import { seatsFor } from "@/components/world/seating";
export default function ContactStudy() {
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{let alive=true;const app=new Application();
    void(async()=>{await loadWorldArt();await app.init({width:1040,height:360,background:0xece8d9,antialias:true,resolution:2});if(!alive){app.destroy(true);return;}
      host.current!.appendChild(app.canvas);app.canvas.style.width="100%";app.canvas.style.height="auto";
      const look:Look={build:"Average",hair:"Short dark",hat:"None",top:"Teal",bottom:"Kelp",coral:"None",carrying:"Nothing",skin:0xd3a484,beard:"None",glasses:false};
      for(const [index,sprite] of ["bench","terrace"].entries()) {
        const group=new Container();group.position.set(index?740:240,280);group.scale.set(2.8);app.stage.addChild(group);
        const art=drawThing(sprite);if(art)group.addChild(art.c);
        for(const [i,seat] of seatsFor({sprite,x:0,y:0},index).entries()) {
          const c=new Citizen({...look,top:i?"Sand":"Teal",hair:i?"Bob":"Short dark"},0);c.scale.set(.82);c.position.set(seat.x,seat.y);c.seatAt(seat.height/.82);c.face(seat.facing);c.setPose(index===1&&i===0?"drink":i?"talk":"sit");c.update(1/(4*.7));group.addChild(c);
        }
      }
      app.ticker.stop();app.render();
    })();return()=>{alive=false;if(app.renderer)app.destroy(true,{children:true});};
  },[]);
  return <main style={{minHeight:"100vh",background:"#eeeadd",color:"#4f6257",padding:"32px 5vw"}}><a href="/town">← World</a><h1 style={{fontFamily:"Georgia,serif",fontWeight:400,fontSize:36,margin:"20px 0 10px"}}>A place to sit. A moment to share.</h1><p>Staged contact study · actual world furniture and production character poses.</p><div ref={host} style={{maxWidth:1040,marginTop:24,borderRadius:24,overflow:"hidden"}}/><div style={{maxWidth:1040,display:"flex",justifyContent:"space-around",padding:20,fontSize:13}}><span>Bench · seated conversation</span><span>Terrace · cup meets the mouth</span></div></main>;
}
