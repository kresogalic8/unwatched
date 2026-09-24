"use client";
import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics } from "pixi.js";
import { lookFor, aged, type Look, type Pose } from "@/components/world/citizen";
import { Figurine, FIGURE_SCALE } from "@/components/world/figurine";
import { CREAM_DARK, SAND } from "@/components/world/palette";

/**
 * The passenger as they will stand on the quay: the same painted figurine that walks the street, live, at four times the size,
 * redrawn the moment a choice changes. A strip of ground, a shadow, and the small life the rig has on its own.
 */
export function LookPreview({ name, look, age, pose = "idle", className = "" }: { name: string; look: Partial<Look>; age: number; pose?: Pose; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const rig = useRef<{ app: Application; stage: Container; c: Figurine | null }>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = host.current; if (!el) return; let dead = false; let app: Application | null = null;
    (async () => {
      const a = new Application();
      await a.init({ backgroundAlpha: 0, resizeTo: el, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
      if (dead) { a.destroy(true, { children: true }); return; }
      app = a;
      el.appendChild(app.canvas); const stage = new Container(); app.stage.addChild(stage);
      rig.current = { app, stage, c: null }; setReady(true);
      let t = 0; app.ticker.add((tk) => { t += tk.deltaMS / 1000; const c = rig.current?.c; if (c) c.update(t); });
    })();
    return () => { dead = true; rig.current = null; app?.destroy(true, { children: true }); };
  }, []);
  // every change is a new person on the same spot; the ground and the shadow are drawn with them
  useEffect(() => {
    const r = rig.current; if (!r || !ready) return;
    r.stage.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    const W = r.app.screen.width, H = r.app.screen.height; const S = Math.min(4.2, H / 118, W / 110);
    const ground = new Graphics(); ground.ellipse(W / 2, H * 0.8, Math.min(120, W * 0.36), 16).fill({ color: CREAM_DARK, alpha: 0.9 }).stroke({ width: 1.5, color: SAND }); r.stage.addChild(ground);
    const c = new Figurine(aged(lookFor(name || "someone", look), age)); c.age(age); c.setPose(pose); c.scale.set(S * FIGURE_SCALE); c.position.set(W / 2, H * 0.8); c.facing4("right"); r.stage.addChild(c); r.c = c;
  }, [name, look, age, pose, ready]);
  return <div ref={host} className={className} aria-label={`${name || "The passenger"}, as they will look in town`} role="img" />;
}
