"use client";
import { useEffect, useRef } from "react";
import { Application, Graphics } from "pixi.js";
import { lookFor, type Pose } from "../world/citizen";
import { Figurine, FIGURE_SCALE } from "../world/figurine";

export default function LifeCharacter({ phase, motion, onReady, onError }: { phase: number; motion: boolean; onReady: () => void; onError: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ phase, motion, onReady, onError });
  state.current = { phase, motion, onReady, onError };
  const wake = useRef(() => {});
  useEffect(() => wake.current(), [phase, motion]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false, app: Application | undefined, observer: IntersectionObserver | undefined, resize: ResizeObserver | undefined;
    const visibility = () => wake.current();
    void (async () => {
      const a = new Application();
      try { await a.init({ backgroundAlpha: 0, antialias: true, resolution: Math.min(devicePixelRatio, 1.5), autoDensity: true }); }
      catch { if (!disposed) state.current.onError(); return; }
      if (disposed) { a.destroy({ removeView: true, releaseGlobalResources: false }, { children: true }); return; }
      app = a; el.appendChild(a.canvas);
      const shadow = new Graphics(); a.stage.addChild(shadow);
      const person = new Figurine(lookFor("Mara — illustrative landing story", { hair: "Curls", hairColor: "Brown", top: "Cream", bottom: "Teal", hat: "None", carrying: "Nothing", beard: "None", skin: 0xb98460, coral: "Buttons" }), .4);
      person.age(32); person.facing4("front"); a.stage.addChild(person);
      let visible = true, time = 0, lastPhase = -1;
      const draw = () => {
        const { phase: step, motion: moving } = state.current;
        if (step !== lastPhase) {
          person.trade(step ? "baker" : null);
          person.hold(step === 2 || step === 3 ? "bread" : null);
          person.setPose((["idle", "work", "talk", "greet"] as Pose[])[step]!, !moving);
          person.mood({ joy: step * .16 });
          lastPhase = step;
        }
        person.update(moving ? time : .4);
      };
      const layout = () => {
        const w = el.clientWidth, h = el.clientHeight;
        a.renderer.resize(w, h);
        person.scale.set(Math.min(h / 94, w / 70) * FIGURE_SCALE);
        person.position.set(w / 2, h * .94);
        shadow.clear().ellipse(w / 2, h * .94, w * .24, 9).fill({ color: 0x454d3b, alpha: .14 });
        draw(); a.render();
      };
      resize = new ResizeObserver(layout); resize.observe(el); layout();
      a.ticker.maxFPS = 30;
      a.ticker.add(tick => { time += tick.deltaMS / 1000; draw(); });
      wake.current = () => { draw(); if (visible && !document.hidden && state.current.motion) a.start(); else { a.stop(); a.render(); } };
      observer = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; wake.current(); });
      observer.observe(el); document.addEventListener("visibilitychange", visibility); wake.current(); state.current.onReady();
    })();
    return () => { disposed = true; wake.current = () => {}; observer?.disconnect(); resize?.disconnect(); document.removeEventListener("visibilitychange", visibility); app?.destroy({ removeView: true, releaseGlobalResources: false }, { children: true }); };
  }, []);
  return <div ref={host} style={{ position: "absolute", inset: 0 }} aria-hidden="true" />;
}
