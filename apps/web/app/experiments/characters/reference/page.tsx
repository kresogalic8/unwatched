"use client";
import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { Citizen } from "@/components/world/citizen";
import { Person } from "@/components/world/harbor-art";

export default function HarborReference() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true; const app = new Application();
    void (async () => {
      await app.init({ width:400,height:320,background:0xece8d9,antialias:true,resolution:2 });
      if (!alive) { app.destroy(true); return; }
      host.current!.appendChild(app.canvas); app.canvas.style.width="100%";app.canvas.style.height="auto";
      const c = new Citizen({build:"Average",hair:"Short dark",hairColor:"Dark",hat:"None",carrying:"Nothing",top:"Teal",bottom:"Kelp",coral:"None",skin:0xd3a484,beard:"None",glasses:false,pattern:"Plain",shape:"Straight"}, 0);
      c.scale.set(4);c.position.set(200,280);c.setPose("walk");app.stage.addChild(c);
      // A fixed animation frame makes the silhouette review repeatable.
      c.update(.22);app.ticker.stop();app.render();
    })();
    return () => {alive=false;if(app.renderer)app.destroy(true,{children:true});};
  }, []);
  return <main style={{background:"#eeeadd",color:"#4f6257",minHeight:"100vh",padding:"32px 5vw"}}>
    <a href="/experiments/characters/controls">← Character controls</a>
    <h1 style={{fontFamily:"Georgia,serif",fontSize:36,fontWeight:400,margin:"18px 0 8px"}}>One silhouette. One world.</h1>
    <p>Original Harbor drawing and the production character, at the same scale.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,300px),1fr))",gap:24,maxWidth:1040,marginTop:24}}>
      <section style={{background:"#ece8d9",borderRadius:20,overflow:"hidden"}}><p style={{padding:"16px 24px",fontSize:12,letterSpacing:2}}>ORIGINAL DRAWING</p><svg viewBox="510 140 100 80" style={{width:"100%"}} aria-label="Original Harbor person"><Person u={0} v={0}/></svg></section>
      <section style={{background:"#ece8d9",borderRadius:20,overflow:"hidden"}}><p style={{padding:"16px 24px",fontSize:12,letterSpacing:2}}>PRODUCTION CHARACTER · FIXED FRAME</p><div ref={host}/></section>
    </div>
  </main>;
}
